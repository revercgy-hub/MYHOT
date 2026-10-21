import "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { collectWebListLatest, newWebListBackfillCursor } from "@aihot/backend/sources/web-list-pagination";
import { collectLatestSource } from "@aihot/backend/sources/collect";
import type { Candidate, SourceRow } from "@aihot/backend/sources/types";
import type { GuardedFetchRunBudget } from "@aihot/backend/lib/http-fetch";
import { tag } from "./setup.ts";

const T = tag();
const BASE = "https://gx.mof.gov.cn/gzdt/caizhengjiancha/";
const SOURCE_IDS: string[] = [];

function config() {
  return {
    url: BASE, parseMode: "html", itemSelector: "li.item", linkSelector: "a[href]", titleSelector: "a", publishedAtSelector: "time",
    allowUrlPrefixes: [BASE], _aihot: { initialBackfillMonths: 3, initialBackfillLimit: 30, initialBackfillRequirePublishedAt: true },
    pagination: { mode: "mof_index_v1", maxPagesPerRun: 1, maxDispatches: 2, maxPageIndex: 8 },
  };
}

async function insertSource(suffix: string, withDetailMode = false) {
  const id = `test-web-list-latest-${suffix}-${T}`;
  SOURCE_IDS.push(id);
  const sourceConfig = config() as Record<string, any>;
  if (withDetailMode) {
    sourceConfig.pagination.detailMode = "direct_html_metadata_v1";
    sourceConfig.detail = { maxFetches: 2, publishedAtSelector: "time.published", titleSelector: "h1" };
  }
  await sql`INSERT INTO sources (id, name, kind, config, tier, participation_mode, first_party, enabled, site_fulltext,
      syndicate_fulltext, cursor, next_fetch_at)
    VALUES (${id}, 'Synthetic latest fixture', 'web_list', ${sql.json(sourceConfig)}, 'T1', 'editorial', false,
      false, false, false, '{}'::jsonb, '2100-01-01')`;
  const source = { id, kind: "web_list", config: sourceConfig, cursor: {} } as unknown as SourceRow;
  const cursor = newWebListBackfillCursor(source, new Date("2026-10-20T00:00:00.000Z"));
  await sql`UPDATE sources SET cursor = ${sql.json({ webListBackfill: cursor } as never)} WHERE id = ${id}`;
  return { id, cursor };
}

function candidate(path: string, title = `Latest fixture ${T}`): Candidate {
  return { url: new URL(path, BASE).toString(), title, excerpt: `Synthetic listing excerpt for ${title}`, publishedAt: new Date("2026-10-20T02:00:00.000Z") };
}

function reader(rows: Candidate[], calls: string[] = []) {
  return async (_source: SourceRow, listUrl: string, budget: GuardedFetchRunBudget) => {
    calls.push(listUrl);
    budget.beforeDispatch({ url: new URL(listUrl), method: "GET", redirectHop: 0 });
    return rows;
  };
}

after(async () => {
  try {
    if (SOURCE_IDS.length) await sql`DELETE FROM pgboss.job WHERE data->>'articleId' IN (SELECT id FROM articles WHERE source_id IN ${sql(SOURCE_IDS)})`;
    for (const id of SOURCE_IDS) await sql`DELETE FROM articles WHERE source_id = ${id}`;
    for (const id of SOURCE_IDS) await sql`DELETE FROM sources WHERE id = ${id}`;
  } finally {
    await stopBoss();
    await closeDb();
  }
});

test("latest mode reads one base page, queues only new material, and preserves the full history cursor", async () => {
  const { id, cursor } = await insertSource("base-only");
  const calls: string[] = [];
  const row = candidate("2026/10/latest-base-only.htm");
  const first = await collectWebListLatest(id, { force: true, fetchPage: reader([row], calls) });
  assert.deepEqual([first.status, first.found, first.created, first.skippedKnown], ["ok", 1, 1, 0]);
  assert.deepEqual(calls, [BASE]);
  const [saved] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${id}`;
  assert.deepEqual(saved!.cursor.webListBackfill, cursor);
  const [stored] = await sql<{ title: string; revision: number; processing_queued_at: Date | null; body_status: string; body_text: string | null; raw: Record<string, any> }[]>`
    SELECT title, revision, processing_queued_at, body_status, body_text, raw FROM articles WHERE source_id = ${id}`;
  assert.equal(stored!.title, row.title);
  assert.equal(stored!.revision, 1);
  assert.ok(stored!.processing_queued_at);
  assert.deepEqual([stored!.body_status, stored!.body_text], ["pending", null]);
  assert.deepEqual([stored!.raw.latestList.titleSource, stored!.raw.latestList.publishedAtSource, stored!.raw.latestList.detailFetched], ["listing", "listing", false]);
  const [jobs] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM pgboss.job WHERE data->>'articleId' = (SELECT id FROM articles WHERE source_id = ${id})`;
  assert.equal(jobs!.n, 1);

  const second = await collectWebListLatest(id, { force: true, fetchPage: reader([candidate("2026/10/latest-base-only.htm", "Changed list title")]) });
  assert.deepEqual([second.status, second.created, second.skippedKnown], ["ok", 0, 1]);
  const [unchanged] = await sql<{ title: string; revision: number }[]>`SELECT title, revision FROM articles WHERE source_id = ${id}`;
  assert.deepEqual(unchanged, { title: row.title, revision: 1 }, "a known material cannot be downgraded by list metadata");
  const [jobCount] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM pgboss.job WHERE data->>'articleId' = (SELECT id FROM articles WHERE source_id = ${id})`;
  assert.equal(jobCount!.n, 1, "a duplicate latest observation adds no queue job");
});

test("latest mode accepts existing backfill detail config but dispatches only the base page", async () => {
  const { id, cursor } = await insertSource("backfill-detail-mode", true);
  const calls: string[] = [];
  const result = await collectWebListLatest(id, { force: true, fetchPage: reader([candidate("2026/10/detail-config.htm")], calls) });
  assert.deepEqual([result.status, result.created], ["ok", 1]);
  assert.deepEqual(calls, [BASE], "the configured detail selectors are never used by latest mode");
  const [saved] = await sql<{ config: Record<string, any>; cursor: Record<string, any> }[]>`SELECT config, cursor FROM sources WHERE id = ${id}`;
  assert.equal(saved!.config.pagination.detailMode, "direct_html_metadata_v1");
  assert.deepEqual(saved!.cursor.webListBackfill, cursor);
  const [stored] = await sql<{ body_status: string; raw: Record<string, any> }[]>`SELECT body_status, raw FROM articles WHERE source_id = ${id}`;
  assert.equal(stored!.body_status, "pending");
  assert.equal(stored!.raw.latestList.detailFetched, false);
});

test("collectLatestSource applies the complete source configuration validator before dispatch", async () => {
  const { id } = await insertSource("unsupported-config");
  await sql`UPDATE sources SET config = jsonb_set(config, '{unhandledFutureOption}', 'true'::jsonb) WHERE id = ${id}`;
  const result = await collectLatestSource(id, { force: true });
  assert.equal(result.status, "failed");
  assert.match(result.error ?? "", /unhandledFutureOption/u);
});

test("latest mode rejects article and redirected page dispatches at the actual budget boundary", async () => {
  for (const [suffix, target] of [["detail", `${BASE}2026/10/not-a-list-page.htm`], ["redirect", `${BASE}index_1.htm`]] as const) {
    const { id } = await insertSource(suffix);
    let dispatches = 0;
    const result = await collectWebListLatest(id, {
      force: true,
      fetchPage: async (_source, listUrl, budget) => {
        budget.beforeDispatch({ url: new URL(listUrl), method: "GET", redirectHop: 0 });
        dispatches++;
        if (suffix === "redirect") {
          const accepted = budget.allowRedirect?.({ from: new URL(listUrl), to: new URL(target), redirectHop: 1 }) ?? false;
          if (!accepted) throw new Error("redirect refused by latest budget");
          budget.beforeDispatch({ url: new URL(target), method: "GET", redirectHop: 1 });
          dispatches++;
        } else {
          budget.beforeDispatch({ url: new URL(target), method: "GET", redirectHop: 0 });
          dispatches++;
        }
        return [];
      },
    });
    assert.equal(result.status, "failed");
    assert.equal(dispatches, 1, "the exact base dispatch is the only permitted request");
  }
});

test("latest mode fails closed for an empty page or a page over the source's existing item cap", async () => {
  const cases: Array<[string, Candidate[]]> = [
    ["empty", []],
    ["over-cap", Array.from({ length: 31 }, (_, index) => candidate(`2026/10/over-cap-${index}.htm`))],
  ];
  for (const [suffix, rows] of cases) {
    const { id } = await insertSource(suffix);
    const result = await collectWebListLatest(id, { force: true, fetchPage: reader(rows) });
    assert.equal(result.status, "failed");
    assert.equal(result.created, 0);
    const [articles] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM articles WHERE source_id = ${id}`;
    assert.equal(articles!.n, 0);
  }
});

test("latest mode skips a globally known identity without changing its confirmed material", async () => {
  const origin = await insertSource("known-origin");
  const latest = await insertSource("known-latest");
  const known = candidate("2026/10/shared-known.htm", "Confirmed original title");
  const inserted = await upsertMaterial({ sourceId: origin.id, url: known.url, title: known.title, bodyText: "confirmed body", bodyStatus: "ok", via: "fetch" });
  assert.equal(inserted.created, true);
  const result = await collectWebListLatest(latest.id, { force: true, fetchPage: reader([candidate("2026/10/shared-known.htm", "New list metadata title")]) });
  assert.deepEqual([result.status, result.created, result.skippedKnown], ["ok", 0, 1]);
  const [saved] = await sql<{ title: string; body_text: string; revision: number }[]>`SELECT title, body_text, revision FROM articles WHERE id = ${inserted.articleId}`;
  assert.deepEqual(saved, { title: "Confirmed original title", body_text: "confirmed body", revision: 1 });
  const [discoveries] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM article_discoveries WHERE article_id = ${inserted.articleId} AND source_id = ${latest.id}`;
  assert.equal(discoveries!.n, 0, "latest skip does not add a new discovery write");
});

test("latest mode shares the backfill advisory lock and CAS fails atomically on cursor drift", async () => {
  const { id } = await insertSource("lock-cas");
  let release!: () => void;
  let entered!: () => void;
  const waiting = new Promise<void>((resolve) => (release = resolve));
  const dispatched = new Promise<void>((resolve) => (entered = resolve));
  const first = collectWebListLatest(id, { force: true, fetchPage: async (_source, listUrl, budget) => {
    budget.beforeDispatch({ url: new URL(listUrl), method: "GET", redirectHop: 0 });
    entered(); await waiting; return [candidate("2026/10/lock-cas.htm")];
  } });
  await dispatched;
  const concurrent = await collectWebListLatest(id, { force: true, fetchPage: reader([]) });
  assert.deepEqual([concurrent.status, concurrent.error], ["skipped", "concurrent_run"]);
  release();
  assert.equal((await first).status, "ok");

  const drift = await insertSource("cursor-drift");
  const result = await collectWebListLatest(drift.id, { force: true, fetchPage: async (_source, listUrl, budget) => {
    budget.beforeDispatch({ url: new URL(listUrl), method: "GET", redirectHop: 0 });
    await sql`UPDATE sources SET cursor = jsonb_set(cursor, '{webListBackfill,nextPageIndex}', '9'::jsonb) WHERE id = ${drift.id}`;
    return [candidate("2026/10/cursor-drift.htm")];
  } });
  assert.equal(result.status, "failed");
  const [articles] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM articles WHERE source_id = ${drift.id}`;
  assert.equal(articles!.n, 0, "cursor drift prevents material and queue writes");
  const [saved] = await sql<{ cursor: Record<string, unknown> }[]>`SELECT cursor FROM sources WHERE id = ${drift.id}`;
  assert.equal((saved!.cursor.webListBackfill as Record<string, any>).nextPageIndex, 9);

  const configDrift = await insertSource("config-drift");
  const changed = await collectWebListLatest(configDrift.id, { force: true, fetchPage: async (_source, listUrl, budget) => {
    budget.beforeDispatch({ url: new URL(listUrl), method: "GET", redirectHop: 0 });
    await sql`UPDATE sources SET config = jsonb_set(config, '{titleSelector}', '"h1"'::jsonb) WHERE id = ${configDrift.id}`;
    return [candidate("2026/10/config-drift.htm")];
  } });
  assert.equal(changed.status, "failed");
  const [configArticles] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM articles WHERE source_id = ${configDrift.id}`;
  assert.equal(configArticles!.n, 0, "config drift prevents material and queue writes");
});

test("latest mode rolls back an inserted prefix and reports zero created when a later candidate fails", async () => {
  const { id } = await insertSource("transaction-rollback");
  const before = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM pgboss.job`;
  const malformed = { ...candidate("2026/10/rollback-failure.htm"), raw: 1n } as unknown as Candidate;
  const result = await collectWebListLatest(id, { force: true, fetchPage: reader([
    candidate("2026/10/rollback-prefix.htm"), malformed,
  ]) });
  assert.deepEqual([result.status, result.created], ["failed", 0]);
  const [articles] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM articles WHERE source_id = ${id}`;
  const after = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM pgboss.job`;
  assert.equal(articles!.n, 0, "the first candidate insert rolled back with the later serialization failure");
  assert.equal(after[0]!.n, before[0]!.n, "the first candidate's body job rolled back with its article");
  const [run] = await sql<{ new_count: number; detail: Record<string, any> }[]>`
    SELECT new_count, detail FROM fetch_runs WHERE source_id = ${id} ORDER BY id DESC LIMIT 1`;
  assert.equal(run!.new_count, 0);
  assert.equal(run!.detail.created, 0);
});
