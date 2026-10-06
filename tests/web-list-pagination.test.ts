import "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { assertPendingWebListPage, collectWebListBackfill, createPendingWebListPage, createWebListPaginationBudget,
  readWebListPagination, usesWebListPagination, validateWebListMetadataConfig, validateWebListPagination,
  webListMetadataSnapshotHash, webListPageUrl, type PendingWebListPage } from "@aihot/backend/sources/web-list-pagination";
import { identityKeyFor } from "@aihot/backend/content/materials";
import type { GuardedFetchOptions, GuardedResponse } from "@aihot/backend/lib/http-fetch";
import type { GuardedFetchRunBudget } from "@aihot/backend/lib/http-fetch";
import type { Candidate, SourceRow } from "@aihot/backend/sources/types";
import { tag } from "./setup.ts";

const T = tag();
const BASE = "https://gx.mof.gov.cn/gzdt/caizhengjiancha/";
const CREATED_SOURCE_IDS: string[] = [];

function metadataConfig() {
  return {
    ...config({ mode: "mof_index_v1", maxPagesPerRun: 1, maxDispatches: 12, maxPageIndex: 45, detailMode: "direct_html_metadata_v1" }),
    detail: { maxFetches: 2, publishedAtSelector: "time.published", titleSelector: "h1" },
  };
}

function metadataSource(sourceConfig: Record<string, any> = metadataConfig()): SourceRow {
  return { id: "metadata-fixture", kind: "web_list", config: sourceConfig, cursor: null } as unknown as SourceRow;
}

test("metadata mode is explicit, strictly bounded, and pending snapshots reject mutation", () => {
  const cfg = metadataConfig() as Record<string, any>;
  const source = metadataSource(cfg);
  assert.deepEqual(readWebListPagination(cfg)?.detailMode, "direct_html_metadata_v1");
  assert.deepEqual(validateWebListPagination("web_list", cfg), []);
  assert.deepEqual(validateWebListMetadataConfig("web_list", cfg), []);

  const legacy = config();
  assert.equal(readWebListPagination(legacy)?.detailMode, undefined);
  assert.deepEqual(validateWebListPagination("web_list", legacy), []);
  for (const bad of [0, 11, 1.5, "2", null]) {
    assert.notEqual(validateWebListPagination("web_list", { ...cfg, detail: { ...cfg.detail, maxFetches: bad } }).length, 0);
  }
  for (const detail of [
    { ...cfg.detail, pdfDirect: true },
    { ...cfg.detail, attachmentSelector: ".files" },
    { ...cfg.detail, maxFetches: undefined },
    { ...cfg.detail, titleAuthoritative: true, titleSelector: undefined },
  ]) assert.notEqual(validateWebListPagination("web_list", { ...cfg, detail }).length, 0);
  assert.notEqual(validateWebListPagination("web_list", { ...cfg, pagination: { ...cfg.pagination, detailMode: "future" } }).length, 0);

  const page = createPendingWebListPage(source, 0, [article("news/a", "Synthetic metadata title", "2026-10-01T00:00:00.000Z")]);
  assertPendingWebListPage(page, source, 0);
  const badHash = structuredClone(page) as PendingWebListPage;
  badHash.candidates[0]!.identityHash = "0".repeat(64);
  assert.throws(() => assertPendingWebListPage(badHash, source, 0), /invalid pending metadata page/);
  const unknown = { ...page, unreviewed: true };
  assert.throws(() => assertPendingWebListPage(unknown, source), /invalid pending metadata page/);
  const wrongPage = { ...page, pageIndex: 1 };
  assert.throws(() => assertPendingWebListPage(wrongPage, source, 0), /invalid pending metadata page/);
  const forgedDuplicate = structuredClone(page) as PendingWebListPage;
  forgedDuplicate.candidates[0] = { ...forgedDuplicate.candidates[0]!, state: "excluded", outcome: "duplicate" };
  forgedDuplicate.metadataHash = webListMetadataSnapshotHash(forgedDuplicate.candidates);
  assert.throws(() => assertPendingWebListPage(forgedDuplicate, source), /invalid pending metadata page/);
  const forgedResolved = structuredClone(page) as PendingWebListPage;
  forgedResolved.candidates[0] = { ...forgedResolved.candidates[0]!, state: "resolved", resolvedTitle: "Synthetic title", titleSource: "list",
    resolvedPublishedAt: null, dateSource: "list" };
  assert.throws(() => assertPendingWebListPage(forgedResolved, source), /invalid pending metadata page/);
  const fixedWindow = { anchorAt: "2026-10-06T00:00:00.000Z", cutoffAt: "2026-07-08T00:00:00.000Z" };
  const forgedInWindowExclusion = structuredClone(page) as PendingWebListPage;
  forgedInWindowExclusion.candidates[0] = { ...forgedInWindowExclusion.candidates[0]!, state: "excluded", outcome: "outside_window",
    resolvedPublishedAt: "2026-10-01T00:00:00.000Z", dateSource: "list" };
  forgedInWindowExclusion.metadataHash = webListMetadataSnapshotHash(forgedInWindowExclusion.candidates);
  assert.throws(() => assertPendingWebListPage(forgedInWindowExclusion, source, 0, true, fixedWindow), /invalid pending metadata page/);
  const authoritativeSource = metadataSource({ ...cfg, detail: { ...cfg.detail, publishedAtAuthoritative: true } });
  const forgedFutureResolution = structuredClone(page) as PendingWebListPage;
  forgedFutureResolution.candidates[0] = { ...forgedFutureResolution.candidates[0]!, state: "resolved", resolvedTitle: "Synthetic metadata title",
    titleSource: "list", resolvedPublishedAt: "2099-01-01T00:00:00.000Z", dateSource: "configured_rule" };
  forgedFutureResolution.metadataHash = webListMetadataSnapshotHash(forgedFutureResolution.candidates);
  assert.throws(() => assertPendingWebListPage(forgedFutureResolution, authoritativeSource, 0, true, fixedWindow), /invalid pending metadata page/);
  assert.throws(() => createPendingWebListPage(source, 0, [article("news/a", "X".repeat(1001), null)]), /too long/);
  const longUrl = { ...article("news/a", "Synthetic title", null), url: `${BASE}${"x".repeat(2048)}` };
  assert.throws(() => createPendingWebListPage(source, 0, [longUrl]), /URL is invalid or too long/);
  assert.equal(webListMetadataSnapshotHash(page.candidates), page.metadataHash);
});

test("metadata detail target admissions share dispatch and target budgets and bind redirects to identity", () => {
  const source = metadataSource();
  const pagination = readWebListPagination(source.config)!;
  const budget = createWebListPaginationBudget(source, pagination);
  const targetA = `${BASE}20261006/a.htm`;
  const targetB = `${BASE}20261006/b.htm`;
  const identityA = identityKeyFor({ url: targetA, title: "", sourceId: source.id, via: "fetch" });
  const identityB = identityKeyFor({ url: targetB, title: "", sourceId: source.id, via: "fetch" });
  try {
    budget.setCurrentDetailTarget(targetA, identityA);
    assert.equal(budget.runBudget.allowRedirect?.({ from: new URL(targetA), to: new URL(targetB), redirectHop: 1 }), false);
    budget.runBudget.beforeDispatch({ url: new URL(targetA), method: "GET", redirectHop: 0 });
    assert.equal(budget.dispatchesUsed(), 1);
    assert.equal(budget.detailTargetsUsed(), 1);
    budget.clearCurrentDetailTarget();
    assert.throws(() => budget.setCurrentDetailTarget(targetA, identityA), /identity or budget rejected/);
    budget.clearCurrentDetailTarget();
    budget.setCurrentDetailTarget(targetB, identityB);
    budget.runBudget.beforeDispatch({ url: new URL(targetB), method: "GET", redirectHop: 0 });
    assert.equal(budget.detailTargetsUsed(), 2);
    budget.clearCurrentDetailTarget();
    assert.throws(() => budget.setCurrentDetailTarget(`${BASE}index_1.htm`, identityB), /outside the direct article/);
  } finally {
    budget.dispose();
  }
});

test("metadata pending page resumes in order without refetching its listing or completed detail rows", async () => {
  const id = `test-web-list-metadata-resume-${T}`;
  const cfg = metadataConfig() as Record<string, any>;
  cfg.detail = { maxFetches: 1, publishedAtSelector: "time.published", titleSelector: "h1", publishedAtAuthoritative: true, titleAuthoritative: true };
  await insertSource(id, cfg);
  const listCalls: string[] = [];
  const detailCalls: string[] = [];
  const pageReader = syntheticPages({ 0: [
    article("news/a", `Synthetic metadata A ${T}`, "2026-10-01T00:00:00.000Z"),
    article("news/b", `Synthetic metadata B ${T}`, "2026-10-01T00:00:00.000Z"),
    article("news/c", `Synthetic metadata C ${T}`, "2026-10-01T00:00:00.000Z"),
  ] }, listCalls);
  const metadataFetcher = async (url: string, options: GuardedFetchOptions = {}): Promise<GuardedResponse> => {
    options.runBudget!.beforeDispatch({ url: new URL(url), method: "GET", redirectHop: 0 });
    detailCalls.push(url);
    const slug = /\/([abc])\.htm$/u.exec(new URL(url).pathname)?.[1] ?? "unknown";
    const body = Buffer.from(`<html><h1>Verified detail ${slug} ${T}</h1><time class="published" datetime="2026-10-01T00:00:00.000Z"></time></html>`);
    return { status: 200, url, headers: new Headers({ "content-type": "text/html; charset=utf-8" }), body, text: () => body.toString("utf8") };
  };

  const first = await collectWebListBackfill(id, { force: true, fetchPage: pageReader, testMetadataFetcher: metadataFetcher });
  assert.deepEqual([first.status, first.found, first.created], ["ok", 3, 0]);
  assert.deepEqual(listCalls, [BASE]);
  assert.equal(detailCalls.length, 1, "the run-wide detail target cap stops before the second request");
  const [afterFirst] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${id}`;
  const firstPending = afterFirst!.cursor.webListBackfill.pendingPage;
  assert.deepEqual([firstPending.pageIndex, firstPending.candidates.map((row: any) => row.state)], [0, ["resolved", "pending", "pending"]]);
  assert.equal(afterFirst!.cursor.webListBackfill.nextPageIndex, 0);
  assert.equal(afterFirst!.cursor.initializedAt, undefined);

  const second = await collectWebListBackfill(id, { force: true, fetchPage: async () => { throw new Error("resumed run must not reread list"); }, testMetadataFetcher: metadataFetcher });
  assert.deepEqual([second.status, second.found, second.created], ["ok", 0, 0]);
  const [afterSecond] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${id}`;
  assert.deepEqual(afterSecond!.cursor.webListBackfill.pendingPage.candidates.map((row: any) => row.state), ["resolved", "resolved", "pending"]);

  const third = await collectWebListBackfill(id, { force: true, fetchPage: async () => { throw new Error("resumed run must not reread list"); }, testMetadataFetcher: metadataFetcher });
  assert.deepEqual([third.status, third.found, third.created], ["ok", 0, 3]);
  assert.deepEqual(listCalls, [BASE]);
  assert.equal(detailCalls.length, 3, "the completed first row is not fetched again");
  const [afterThird] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${id}`;
  assert.deepEqual([afterThird!.cursor.webListBackfill.nextPageIndex, afterThird!.cursor.webListBackfill.pagesCommitted,
    afterThird!.cursor.webListBackfill.state, afterThird!.cursor.webListBackfill.coverage], [1, 1, "active", "unproven"]);
  assert.equal(afterThird!.cursor.webListBackfill.pendingPage, undefined);
  assert.equal(afterThird!.cursor.initializedAt, undefined);
  const rows = await stored(id);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => row.title).sort(), ["Verified detail a", "Verified detail b", "Verified detail c"].map((title) => `${title} ${T}`).sort());
});

test("metadata snapshot and per-row checkpoints survive injected database failures", async () => {
  const page = [
    article("news/tx-a", `Synthetic metadata tx A ${T}`, "2026-10-01T00:00:00.000Z"),
    article("news/tx-b", `Synthetic metadata tx B ${T}`, "2026-10-01T00:00:00.000Z"),
    article("news/tx-c", `Synthetic metadata tx C ${T}`, "2026-10-01T00:00:00.000Z"),
  ];
  const makeFetcher = (calls: string[]) => async (url: string, options: GuardedFetchOptions = {}): Promise<GuardedResponse> => {
    options.runBudget!.beforeDispatch({ url: new URL(url), method: "GET", redirectHop: 0 });
    calls.push(url);
    const slug = /\/([a-z]+)\.htm$/u.exec(new URL(url).pathname)?.[1] ?? "unknown";
    const body = Buffer.from(`<html><h1>Durable detail ${slug} ${T}</h1><time class="published" datetime="2026-10-01T00:00:00.000Z"></time></html>`);
    return { status: 200, url, headers: new Headers({ "content-type": "text/html" }), body, text: () => body.toString("utf8") };
  };

  const snapshotId = `test-web-list-metadata-snapshot-fault-${T}`;
  const snapshotConfig = metadataConfig() as Record<string, any>;
  snapshotConfig.detail = { ...snapshotConfig.detail, publishedAtAuthoritative: true, titleAuthoritative: true };
  await insertSource(snapshotId, snapshotConfig);
  const snapshotFn = `test_metadata_snapshot_fail_${T}`;
  const snapshotTrigger = `test_metadata_snapshot_trigger_${T}`;
  try {
    await sql.unsafe(`CREATE FUNCTION public.${snapshotFn}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.id = '${snapshotId}' AND OLD.cursor->'webListBackfill'->'pendingPage' IS NULL AND
           NEW.cursor->'webListBackfill'->'pendingPage' IS NOT NULL THEN RAISE EXCEPTION 'synthetic pending snapshot failure'; END IF;
        RETURN NEW;
      END; $$`);
    await sql.unsafe(`CREATE TRIGGER ${snapshotTrigger} BEFORE UPDATE OF cursor ON sources FOR EACH ROW EXECUTE FUNCTION public.${snapshotFn}()`);
    let snapshotDetails = 0;
    const failedSnapshot = await collectWebListBackfill(snapshotId, {
      force: true, fetchPage: syntheticPages({ 0: page }), testMetadataFetcher: async (...args) => { snapshotDetails++; return makeFetcher([])(...args); },
    });
    assert.equal(failedSnapshot.status, "failed");
    assert.equal(snapshotDetails, 0, "snapshot write failure occurs before any detail request");
    assert.equal((await stored(snapshotId)).length, 0);
    const [snapshotState] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${snapshotId}`;
    assert.equal(snapshotState!.cursor.webListBackfill.nextPageIndex, 0);
    assert.equal(snapshotState!.cursor.webListBackfill.pendingPage, undefined);
  } finally {
    await sql.unsafe(`DROP TRIGGER IF EXISTS ${snapshotTrigger} ON sources`);
    await sql.unsafe(`DROP FUNCTION IF EXISTS public.${snapshotFn}()`);
  }

  const rowId = `test-web-list-metadata-row-fault-${T}`;
  const rowConfig = metadataConfig() as Record<string, any>;
  rowConfig.detail = { ...rowConfig.detail, maxFetches: 2, publishedAtAuthoritative: true, titleAuthoritative: true };
  await insertSource(rowId, rowConfig);
  const rowFn = `test_metadata_row_fail_${T}`;
  const rowTrigger = `test_metadata_row_trigger_${T}`;
  const rowCalls: string[] = [];
  const listingCalls: string[] = [];
  try {
    await sql.unsafe(`CREATE FUNCTION public.${rowFn}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.id = '${rowId}' AND OLD.cursor->'webListBackfill'->'pendingPage'->'candidates'->1->>'state' = 'pending' AND
           NEW.cursor->'webListBackfill'->'pendingPage'->'candidates'->1->>'state' = 'resolved' THEN
          RAISE EXCEPTION 'synthetic second row checkpoint failure';
        END IF;
        RETURN NEW;
      END; $$`);
    await sql.unsafe(`CREATE TRIGGER ${rowTrigger} BEFORE UPDATE OF cursor ON sources FOR EACH ROW EXECUTE FUNCTION public.${rowFn}()`);
    const first = await collectWebListBackfill(rowId, {
      force: true, fetchPage: syntheticPages({ 0: page }, listingCalls), testMetadataFetcher: makeFetcher(rowCalls),
    });
    assert.equal(first.status, "failed");
    assert.equal(rowCalls.length, 2, "the second network response is not treated as durable after its row checkpoint fails");
    const [afterFault] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${rowId}`;
    assert.deepEqual(afterFault!.cursor.webListBackfill.pendingPage.candidates.map((row: any) => row.state), ["resolved", "pending", "pending"]);
    await sql.unsafe(`DROP TRIGGER ${rowTrigger} ON sources`);
    await sql.unsafe(`DROP FUNCTION public.${rowFn}()`);
    const resumed = await collectWebListBackfill(rowId, {
      force: true, fetchPage: async () => { throw new Error("durable pending snapshot must not be refetched"); }, testMetadataFetcher: makeFetcher(rowCalls),
    });
    assert.deepEqual([resumed.status, resumed.created], ["ok", 3]);
    assert.equal(rowCalls.length, 4, "the durable first resolution is not refetched; only the failed and later rows are fetched");
    assert.deepEqual(listingCalls, [BASE]);
    assert.equal((await stored(rowId)).length, 3);
  } finally {
    await sql.unsafe(`DROP TRIGGER IF EXISTS ${rowTrigger} ON sources`);
    await sql.unsafe(`DROP FUNCTION IF EXISTS public.${rowFn}()`);
  }
});

test("metadata final article, queue, and cursor commit rolls back together and replays only durable metadata", async () => {
  const id = `test-web-list-metadata-atomic-${T}`;
  const cfg = metadataConfig() as Record<string, any>;
  cfg.detail = { ...cfg.detail, maxFetches: 1, publishedAtAuthoritative: true, titleAuthoritative: true };
  await insertSource(id, cfg);
  const fn = `test_metadata_final_fail_${T}`;
  const trigger = `test_metadata_final_trigger_${T}`;
  const page = [article("news/final", `Synthetic metadata final ${T}`, "2026-10-01T00:00:00.000Z")];
  const detailCalls: string[] = [];
  const listingCalls: string[] = [];
  const metadataFetcher = async (url: string, options: GuardedFetchOptions = {}): Promise<GuardedResponse> => {
    options.runBudget!.beforeDispatch({ url: new URL(url), method: "GET", redirectHop: 0 });
    detailCalls.push(url);
    const body = Buffer.from(`<html><h1>Committed detail ${T}</h1><time class="published" datetime="2026-10-01T00:00:00.000Z"></time></html>`);
    return { status: 200, url, headers: new Headers({ "content-type": "text/html" }), body, text: () => body.toString("utf8") };
  };
  const [beforeJobs] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM pgboss.job WHERE name = 'events.group'`;
  try {
    await sql.unsafe(`CREATE FUNCTION public.${fn}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.id = '${id}' AND NEW.cursor->'webListBackfill'->>'nextPageIndex' = '1' THEN
          RAISE EXCEPTION 'synthetic metadata page commit failure';
        END IF;
        RETURN NEW;
      END; $$`);
    await sql.unsafe(`CREATE TRIGGER ${trigger} BEFORE UPDATE OF cursor ON sources FOR EACH ROW EXECUTE FUNCTION public.${fn}()`);
    const failed = await collectWebListBackfill(id, {
      force: true, fetchPage: syntheticPages({ 0: page }, listingCalls), testMetadataFetcher: metadataFetcher,
    });
    assert.equal(failed.status, "failed");
    assert.equal(detailCalls.length, 1);
    assert.equal((await stored(id)).length, 0, "article upsert rolls back when the cursor checkpoint fails");
    const [afterJobs] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM pgboss.job WHERE name = 'events.group'`;
    assert.equal(afterJobs!.n, beforeJobs!.n, "queue writes roll back with the page transaction");
    const [pending] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${id}`;
    assert.deepEqual([pending!.cursor.webListBackfill.nextPageIndex, pending!.cursor.webListBackfill.pendingPage.candidates[0].state], [0, "resolved"]);
    await sql.unsafe(`DROP TRIGGER ${trigger} ON sources`);
    await sql.unsafe(`DROP FUNCTION public.${fn}()`);

    const replay = await collectWebListBackfill(id, {
      force: true, fetchPage: async () => { throw new Error("final replay must use durable pending metadata"); },
      testMetadataFetcher: async () => { throw new Error("resolved metadata must not be fetched again"); },
    });
    assert.deepEqual([replay.status, replay.created], ["ok", 1]);
    assert.equal(detailCalls.length, 1);
    assert.deepEqual(listingCalls, [BASE]);
    assert.equal((await stored(id)).length, 1);
    const [after] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${id}`;
    assert.deepEqual([after!.cursor.webListBackfill.nextPageIndex, after!.cursor.webListBackfill.pendingPage], [1, undefined]);
    assert.equal(after!.cursor.initializedAt, undefined);
  } finally {
    await sql.unsafe(`DROP TRIGGER IF EXISTS ${trigger} ON sources`);
    await sql.unsafe(`DROP FUNCTION IF EXISTS public.${fn}()`);
  }
});

test("generation initialization merges cursor namespaces read after the collector's initial source snapshot", async () => {
  const id = `test-web-list-pagination-namespace-${T}`;
  await insertSource(id);
  const fn = `test_cursor_namespace_race_${T}`;
  const trigger = `test_cursor_namespace_trigger_${T}`;
  try {
    await sql.unsafe(`CREATE FUNCTION public.${fn}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.source_id = '${id}' THEN
          UPDATE sources SET cursor = coalesce(cursor, '{}'::jsonb) || '{"concurrentNamespace":{"retained":true}}'::jsonb WHERE id = '${id}';
        END IF;
        RETURN NEW;
      END; $$`);
    await sql.unsafe(`CREATE TRIGGER ${trigger} AFTER INSERT ON fetch_runs FOR EACH ROW EXECUTE FUNCTION public.${fn}()`);
    const run = await collectWebListBackfill(id, {
      force: true, fetchPage: syntheticPages({ 0: [article("2026/10/ns", `Synthetic namespace ${T}`, "2026-10-01T00:00:00.000Z")] }),
    });
    assert.equal(run.status, "ok");
    const [state] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${id}`;
    assert.deepEqual(state!.cursor.concurrentNamespace, { retained: true }, "generation init merges the locked current cursor, including namespaces added after initial load");
    assert.ok(state!.cursor.webListBackfill);
  } finally {
    await sql.unsafe(`DROP TRIGGER IF EXISTS ${trigger} ON fetch_runs`);
    await sql.unsafe(`DROP FUNCTION IF EXISTS public.${fn}()`);
  }
});

test("malformed committed-page cursor counters fail closed before another page dispatch", async () => {
  const id = `test-web-list-pagination-counter-corrupt-${T}`;
  await insertSource(id);
  assert.equal((await collectWebListBackfill(id, {
    force: true, fetchPage: syntheticPages({ 0: [article("2026/10/counter", `Synthetic counter ${T}`, "2026-10-01T00:00:00.000Z")] }),
  })).status, "ok");
  const [saved] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${id}`;
  const corrupted = structuredClone(saved!.cursor);
  corrupted.webListBackfill.pagesCommitted = 0;
  await sql`UPDATE sources SET cursor = ${sql.json(corrupted)} WHERE id = ${id}`;
  let dispatches = 0;
  const rejected = await collectWebListBackfill(id, { force: true, fetchPage: async () => { dispatches++; return []; } });
  assert.equal(rejected.status, "failed");
  assert.equal(dispatches, 0, "a cursor whose committed count disagrees with the page index cannot authorize another request");
});

test("tampered fixed cutoff fails closed against the frozen backfill month count", async () => {
  const id = `test-web-list-pagination-cutoff-corrupt-${T}`;
  await insertSource(id);
  assert.equal((await collectWebListBackfill(id, {
    force: true, fetchPage: syntheticPages({ 0: [article("2026/10/cutoff", `Synthetic cutoff ${T}`, "2026-10-01T00:00:00.000Z")] }),
  })).status, "ok");
  const [saved] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${id}`;
  const corrupted = structuredClone(saved!.cursor);
  corrupted.webListBackfill.cutoffAt = new Date(Date.parse(corrupted.webListBackfill.cutoffAt) + 86_400_000).toISOString();
  await sql`UPDATE sources SET cursor = ${sql.json(corrupted)} WHERE id = ${id}`;
  let dispatches = 0;
  const rejected = await collectWebListBackfill(id, { force: true, fetchPage: async () => { dispatches++; return []; } });
  assert.equal(rejected.status, "failed");
  assert.equal(dispatches, 0, "a valid-looking but mismatched cutoff cannot change the configured fixed window");
  const [state] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${id}`;
  assert.deepEqual([state!.cursor.webListBackfill.state, state!.cursor.webListBackfill.stopReason], ["blocked", "invalid_anchor"]);
});

function config(pagination: Record<string, any> = { mode: "mof_index_v1", maxPagesPerRun: 1, maxDispatches: 2, maxPageIndex: 5 }) {
  return {
    url: BASE,
    parseMode: "html",
    itemSelector: "li.item",
    linkSelector: "a[href]",
    titleSelector: "a",
    publishedAtSelector: "time",
    allowUrlPrefixes: [BASE],
    _aihot: { initialBackfillMonths: 3, initialBackfillLimit: 30, initialBackfillRequirePublishedAt: true },
    pagination,
  };
}

async function insertSource(id: string, sourceConfig: Record<string, any> = config()) {
  CREATED_SOURCE_IDS.push(id);
  await sql`INSERT INTO sources (id, name, kind, config, tier, participation_mode, first_party, enabled, site_fulltext,
      syndicate_fulltext, cursor, next_fetch_at)
    VALUES (${id}, 'Synthetic web-list pagination test', 'web_list', ${sql.json(sourceConfig)}, 'T1', 'isolated', false,
      false, false, false, '{}'::jsonb, '2100-01-01')`;
}

function article(suffix: string, title: string, publishedAt: string | null): Candidate {
  return {
    url: new URL(`${suffix}.htm`, BASE).toString(),
    title,
    excerpt: `Synthetic pagination fixture only: ${title}. No source article text is present.`,
    publishedAt: publishedAt ? new Date(publishedAt) : null,
  };
}

/** Synthetic candidate reader: admissions/URLs are checked, while HTTP dispatch is tested separately by transport tests. */
function syntheticPages(pages: Record<number, Candidate[] | Error>, calls: string[] = []) {
  return async (_source: SourceRow, listUrl: string, runBudget: GuardedFetchRunBudget) => {
    calls.push(listUrl);
    runBudget.beforeDispatch({ url: new URL(listUrl), method: "GET", redirectHop: 0 });
    const index = listUrl === BASE ? 0 : Number(/^index_(\d+)\.htm$/i.exec(new URL(listUrl).pathname.split("/").at(-1) ?? "")?.[1]);
    const value = pages[index];
    if (value instanceof Error) throw value;
    return value ?? [];
  };
}

async function stored(id: string) {
  return sql<{ id: string; url: string; title: string; revision: number; published_at: Date | null }[]>`
    SELECT id, url, title, revision, published_at FROM articles WHERE source_id = ${id} ORDER BY url`;
}

after(async () => {
  let cleanupError: unknown;
  try {
    for (const id of CREATED_SOURCE_IDS) await sql`DELETE FROM articles WHERE source_id = ${id}`;
    for (const id of CREATED_SOURCE_IDS) await sql`DELETE FROM sources WHERE id = ${id}`;
  } catch (error) {
    cleanupError = error;
  }
  try {
    await stopBoss();
  } finally {
    await closeDb();
  }
  if (cleanupError) throw cleanupError;
});

test("web-list first-import pages are checkpointed atomically, resumably and always coverage-unproven", async (t) => {
  try {
    const resumedId = `test-web-list-pagination-resume-${T}`;
    await insertSource(resumedId);
    assert.equal(usesWebListPagination({ kind: "web_list", config: config(), cursor: {} }), true);

    const calls: string[] = [];
    const pages = {
      0: [
        article("2026/10/new-a", `Synthetic first page A ${T}`, "2026-10-05T00:00:00.000Z"),
        article("2026/07/old", `Synthetic first page outside ${T}`, "2026-07-01T00:00:00.000Z"),
      ],
      1: [
        article("2026/10/new-a", `Synthetic first page A ${T}`, "2026-10-05T00:00:00.000Z"),
        article("2026/08/new-b", `Synthetic second page B ${T}`, "2026-08-20T00:00:00.000Z"),
      ],
    } satisfies Record<number, Candidate[]>;
    const reader = syntheticPages(pages, calls);
    const firstRunStartedAt = Date.now();
    const first = await collectWebListBackfill(resumedId, { force: true, fetchPage: reader });
    const firstRunFinishedAt = Date.now();
    assert.deepEqual([first.status, first.found, first.created, first.revised], ["ok", 2, 1, 0], first.error ?? "");
    assert.deepEqual(calls, [BASE]);
    const [afterFirst] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${resumedId}`;
    const firstCursor = afterFirst!.cursor.webListBackfill;
    assert.equal(afterFirst!.cursor.initializedAt, undefined, "a successful bounded page must not initialize/claim completeness");
    assert.deepEqual([firstCursor.nextPageIndex, firstCursor.pagesCommitted, firstCursor.state, firstCursor.coverage], [1, 1, "active", "unproven"]);
    const anchorAt = Date.parse(firstCursor.anchorAt);
    assert.ok(anchorAt >= firstRunStartedAt && anchorAt <= firstRunFinishedAt, "generation anchor is created once during the first run");
    assert.equal(Date.parse(firstCursor.cutoffAt), anchorAt - 90 * 86_400_000, "three backfill months use the fixed 90-day window");
    assert.equal((await stored(resumedId)).length, 1, "the trusted out-of-window row is excluded without fetching another page early");

    const second = await collectWebListBackfill(resumedId, { force: true, fetchPage: reader });
    assert.deepEqual([second.status, second.found, second.created, second.revised], ["ok", 2, 1, 0]);
    assert.deepEqual(calls, [BASE, webListPageUrl(BASE, 1)]);
    const [afterSecond] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${resumedId}`;
    const secondCursor = afterSecond!.cursor.webListBackfill;
    assert.deepEqual([secondCursor.nextPageIndex, secondCursor.pagesCommitted, secondCursor.state, secondCursor.coverage], [2, 2, "active", "unproven"]);
    assert.deepEqual([secondCursor.anchorAt, secondCursor.cutoffAt], [firstCursor.anchorAt, firstCursor.cutoffAt], "resumption reuses the fixed source clock");
    assert.equal(afterSecond!.cursor.initializedAt, undefined);
    const resumedRows = await stored(resumedId);
    assert.equal(resumedRows.length, 2, "the repeated cross-page identity is stored once");
    assert.ok(resumedRows.every((row) => row.revision === 1), "replaying a listing identity does not revise it");
    const [lastRun] = await sql<{ status: string; detail: Record<string, any> }[]>`SELECT status, detail FROM fetch_runs WHERE source_id = ${resumedId} ORDER BY id DESC LIMIT 1`;
    assert.deepEqual([lastRun!.status, lastRun!.detail.coverage, lastRun!.detail.partial, lastRun!.detail.dispatchesUsed], ["ok", "unproven", true, 1]);

    const subsetId = `test-web-list-pagination-subset-${T}`;
    await insertSource(subsetId);
    const subsetA = article(`2026/10/subset-a-${T}`, `Synthetic subset A ${T}`, "2026-10-01T00:00:00.000Z");
    const subsetB = article(`2026/10/subset-b-${T}`, `Synthetic subset B ${T}`, "2026-10-02T00:00:00.000Z");
    assert.equal((await collectWebListBackfill(subsetId, {
      force: true, fetchPage: syntheticPages({ 0: [subsetA, subsetB] }),
    })).status, "ok");
    const noNewIdentity = await collectWebListBackfill(subsetId, {
      force: true, fetchPage: syntheticPages({ 1: [subsetA] }),
    });
    assert.deepEqual([noNewIdentity.status, noNewIdentity.error], ["failed", "page_no_new_identity"]);
    const [subsetAfter] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${subsetId}`;
    assert.deepEqual([subsetAfter!.cursor.webListBackfill.nextPageIndex, subsetAfter!.cursor.webListBackfill.state,
      subsetAfter!.cursor.webListBackfill.stopReason], [1, "blocked", "page_no_new_identity"]);
    assert.equal((await stored(subsetId)).length, 2, "a page containing only identities from the prior page is not checkpointed");

    const firstPageEmptyId = `test-web-list-pagination-first-page-empty-${T}`;
    await insertSource(firstPageEmptyId);
    const outsideFirstPage = { ...article(`2026/10/outside-first-${T}`, `Synthetic outside first ${T}`, "2026-10-01T00:00:00.000Z"),
      url: `https://outside.example/${T}.htm` };
    const firstPageNoIdentity = await collectWebListBackfill(firstPageEmptyId, {
      force: true, fetchPage: syntheticPages({ 0: [outsideFirstPage] }),
    });
    assert.deepEqual([firstPageNoIdentity.status, firstPageNoIdentity.error], ["failed", "page_no_new_identity"]);
    const [firstEmptyCursor] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${firstPageEmptyId}`;
    assert.deepEqual([firstEmptyCursor!.cursor.webListBackfill.nextPageIndex, firstEmptyCursor!.cursor.webListBackfill.pagesCommitted,
      firstEmptyCursor!.cursor.webListBackfill.state], [0, 0, "blocked"]);
    assert.equal((await stored(firstPageEmptyId)).length, 0, "the first all-filtered page is review-blocked without initialization");

    const emptyIdentityId = `test-web-list-pagination-no-identity-${T}`;
    await insertSource(emptyIdentityId);
    const validIdentity = article(`2026/10/valid-${T}`, `Synthetic valid identity ${T}`, "2026-10-01T00:00:00.000Z");
    assert.equal((await collectWebListBackfill(emptyIdentityId, {
      force: true, fetchPage: syntheticPages({ 0: [validIdentity] }),
    })).status, "ok");
    const outsideListing = { ...validIdentity, url: `https://outside.example/${T}.htm` };
    const noAdmittedIdentity = await collectWebListBackfill(emptyIdentityId, {
      force: true, fetchPage: syntheticPages({ 1: [outsideListing] }),
    });
    assert.deepEqual([noAdmittedIdentity.status, noAdmittedIdentity.error], ["failed", "page_no_new_identity"]);

    const overlapId = `test-web-list-pagination-overlap-${T}`;
    await insertSource(overlapId);
    const overlapA = article(`2026/10/overlap-a-${T}`, `Synthetic overlap A ${T}`, "2026-10-01T00:00:00.000Z");
    const overlapB = article(`2026/10/overlap-b-${T}`, `Synthetic overlap B ${T}`, "2026-10-02T00:00:00.000Z");
    const overlapC = article(`2026/10/overlap-c-${T}`, `Synthetic overlap C ${T}`, "2026-10-03T00:00:00.000Z");
    assert.equal((await collectWebListBackfill(overlapId, {
      force: true, fetchPage: syntheticPages({ 0: [overlapA, overlapB] }),
    })).status, "ok");
    const partialOverlap = await collectWebListBackfill(overlapId, {
      force: true, fetchPage: syntheticPages({ 1: [overlapA, overlapC] }),
    });
    assert.deepEqual([partialOverlap.status, partialOverlap.created, partialOverlap.error], ["ok", 1, undefined]);
    assert.equal((await stored(overlapId)).length, 3, "partial overlap with at least one new identity advances normally");

    const pagerId = `test-web-list-pagination-pager-${T}`;
    await insertSource(pagerId);
    const actualArticle = article(`2026/10/real-pager-check-${T}`, `Synthetic actual article ${T}`, "2026-10-04T00:00:00.000Z");
    const currentListing = { ...actualArticle, url: BASE, title: `Synthetic current listing ${T}` };
    const nextListing = { ...actualArticle, url: webListPageUrl(BASE, 1), title: `Synthetic numbered listing ${T}` };
    const distantListing = { ...actualArticle, url: `${BASE}index_101.htm`, title: `Synthetic out-of-range listing ${T}` };
    const pagerPage = await collectWebListBackfill(pagerId, {
      force: true, fetchPage: syntheticPages({ 0: [currentListing, nextListing, distantListing, actualArticle] }),
    });
    assert.deepEqual([pagerPage.status, pagerPage.found, pagerPage.created], ["ok", 4, 1]);
    const pagerRows = await stored(pagerId);
    assert.deepEqual(pagerRows.map((row) => row.url), [actualArticle.url], "self and every numbered list-page URL are excluded in Phase A");
    const [pagerCursor] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${pagerId}`;
    assert.equal(pagerCursor!.cursor.webListBackfill.lastPageIdentityHashes.length, 1);

    const failureId = `test-web-list-pagination-fail-${T}`;
    await insertSource(failureId);
    const failureCalls: string[] = [];
    const failureReader = syntheticPages({ 0: [article("2026/10/first", `Synthetic checkpoint ${T}`, "2026-10-01T00:00:00.000Z")] }, failureCalls);
    assert.equal((await collectWebListBackfill(failureId, { force: true, fetchPage: failureReader })).status, "ok");
    const failed = await collectWebListBackfill(failureId, {
      force: true,
      fetchPage: syntheticPages({ 1: new Error("HTTP 503 synthetic failure") }, failureCalls),
    });
    assert.equal(failed.status, "failed");
    const [afterFailure] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${failureId}`;
    assert.deepEqual([afterFailure!.cursor.webListBackfill.nextPageIndex, afterFailure!.cursor.webListBackfill.state], [1, "active"], "the previous committed page remains resumable after a later page error");
    assert.equal((await stored(failureId)).length, 1);
    assert.equal(afterFailure!.cursor.initializedAt, undefined);

    const noDateId = `test-web-list-pagination-undated-${T}`;
    await insertSource(noDateId);
    const noDate = await collectWebListBackfill(noDateId, {
      force: true,
      fetchPage: syntheticPages({ 0: [article("2026/10/no-date", `Synthetic undated candidate ${T}`, null)] }),
    });
    assert.equal(noDate.status, "failed");
    assert.equal((await stored(noDateId)).length, 0, "missing date is review-blocked, never treated as an out-of-window boundary");
    const [undatedSource] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${noDateId}`;
    assert.deepEqual([undatedSource!.cursor.webListBackfill.nextPageIndex, undatedSource!.cursor.webListBackfill.state, undatedSource!.cursor.webListBackfill.stopReason], [0, "blocked", "undated_rows_require_review"]);
    const [undatedRun] = await sql<{ detail: Record<string, any> }[]>`SELECT detail FROM fetch_runs WHERE source_id = ${noDateId} ORDER BY id DESC LIMIT 1`;
    assert.equal(undatedRun!.detail.rowsUndated, 1);

    const removedId = `test-web-list-pagination-removed-${T}`;
    await insertSource(removedId);
    const removedCalls: string[] = [];
    const removedReader = syntheticPages({ 0: [article("2026/10/retained", `Synthetic retained candidate ${T}`, "2026-10-01T00:00:00.000Z")] }, removedCalls);
    assert.equal((await collectWebListBackfill(removedId, { force: true, fetchPage: removedReader })).status, "ok");
    const [savedConfig] = await sql<{ config: Record<string, any> }[]>`SELECT config FROM sources WHERE id = ${removedId}`;
    const changedConfig = { ...savedConfig!.config };
    delete changedConfig.pagination;
    await sql`UPDATE sources SET config = ${sql.json(changedConfig)} WHERE id = ${removedId}`;
    let removedReaderCalls = 0;
    const removedAgain = await collectWebListBackfill(removedId, { force: true, fetchPage: async () => { removedReaderCalls += 1; return []; } });
    assert.equal(removedAgain.status, "failed");
    assert.equal(removedReaderCalls, 0, "removing opt-in with an active generation never falls back to a legacy single-page read");
    const [removedAfter] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${removedId}`;
    assert.deepEqual([removedAfter!.cursor.webListBackfill.state, removedAfter!.cursor.webListBackfill.stopReason], ["config_changed", "config_changed"]);
    assert.equal((await stored(removedId)).length, 1, "already committed rows are preserved after config change");

    const racingId = `test-web-list-pagination-race-${T}`;
    await insertSource(racingId);
    let raceCalls = 0;
    const changedDuringFetch = await collectWebListBackfill(racingId, {
      force: true,
      fetchPage: async (_source, listUrl, runBudget) => {
        raceCalls += 1;
        runBudget.beforeDispatch({ url: new URL(listUrl), method: "GET", redirectHop: 0 });
        const [saved] = await sql<{ config: Record<string, any> }[]>`SELECT config FROM sources WHERE id = ${racingId}`;
        const changed = { ...saved!.config, pagination: { ...saved!.config.pagination, maxDispatches: 3 } };
        await sql`UPDATE sources SET config = ${sql.json(changed)} WHERE id = ${racingId}`;
        return [article("2026/10/not-committed", `Synthetic raced config ${T}`, "2026-10-01T00:00:00.000Z")];
      },
    });
    assert.equal(changedDuringFetch.status, "failed");
    assert.equal(raceCalls, 1);
    assert.equal((await stored(racingId)).length, 0, "config hash is checked inside the page transaction before any article write");
    const [raceAfter] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${racingId}`;
    assert.deepEqual([raceAfter!.cursor.webListBackfill.nextPageIndex, raceAfter!.cursor.webListBackfill.state], [0, "config_changed"]);

    const concurrentId = `test-web-list-pagination-lock-${T}`;
    await insertSource(concurrentId);
    let entered!: () => void;
    let release!: () => void;
    const hasEntered = new Promise<void>((resolve) => { entered = resolve; });
    const held = new Promise<void>((resolve) => { release = resolve; });
    let concurrentFetches = 0;
    const holdReader = async (_source: SourceRow, listUrl: string, runBudget: GuardedFetchRunBudget) => {
      concurrentFetches += 1;
      runBudget.beforeDispatch({ url: new URL(listUrl), method: "GET", redirectHop: 0 });
      entered();
      await held;
      return [article("2026/10/locked", `Synthetic lock candidate ${T}`, "2026-10-01T00:00:00.000Z")];
    };
    const ownerRun = collectWebListBackfill(concurrentId, { force: true, fetchPage: holdReader });
    await hasEntered;
    const competingRun = await collectWebListBackfill(concurrentId, { force: true, fetchPage: async () => { concurrentFetches += 1; return []; } });
    assert.deepEqual([competingRun.status, competingRun.error, concurrentFetches], ["skipped", "concurrent_run", 1]);
    release();
    assert.equal((await ownerRun).status, "ok");

    const atomicId = `test-web-list-pagination-atomic-${T}`;
    await insertSource(atomicId);
    const beforeJobs = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM pgboss.job WHERE name = 'events.group'`;
    const fn = `test_fail_page_checkpoint_${T}`;
    const trigger = `test_fail_page_checkpoint_trigger_${T}`;
    try {
      await sql.unsafe(`CREATE FUNCTION public.${fn}() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF OLD.id = '${atomicId}' AND NEW.cursor->'webListBackfill'->>'nextPageIndex' = '1' THEN
            RAISE EXCEPTION 'synthetic page checkpoint failure';
          END IF;
          RETURN NEW;
        END; $$`);
      await sql.unsafe(`CREATE TRIGGER ${trigger} BEFORE UPDATE OF cursor ON sources FOR EACH ROW EXECUTE FUNCTION public.${fn}()`);
      const attempted = await collectWebListBackfill(atomicId, {
        force: true,
        fetchPage: syntheticPages({ 0: [
          article("2026/10/atomic-a", `Synthetic atomic A ${T}`, "2026-10-01T00:00:00.000Z"),
          article("2026/10/atomic-b", `Synthetic atomic B ${T}`, "2026-10-02T00:00:00.000Z"),
        ] }),
      });
      assert.equal(attempted.status, "failed");
      assert.equal((await stored(atomicId)).length, 0, "a failed cursor write rolls back all page articles");
      const afterJobs = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM pgboss.job WHERE name = 'events.group'`;
      assert.equal(afterJobs[0]!.n, beforeJobs[0]!.n, "queue writes in the page transaction roll back with its articles");
      const [rolledBack] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${atomicId}`;
      assert.deepEqual([rolledBack!.cursor.webListBackfill.nextPageIndex, rolledBack!.cursor.webListBackfill.pagesCommitted], [0, 0]);
    } finally {
      await sql.unsafe(`DROP TRIGGER IF EXISTS ${trigger} ON sources`);
      await sql.unsafe(`DROP FUNCTION IF EXISTS public.${fn}()`);
    }
    const replayCalls: string[] = [];
    const replayed = await collectWebListBackfill(atomicId, {
      force: true,
      fetchPage: syntheticPages({ 0: [
        article("2026/10/atomic-a", `Synthetic atomic A ${T}`, "2026-10-01T00:00:00.000Z"),
        article("2026/10/atomic-b", `Synthetic atomic B ${T}`, "2026-10-02T00:00:00.000Z"),
      ] }, replayCalls),
    });
    assert.equal(replayed.status, "ok");
    assert.deepEqual(replayCalls, [BASE]);
    assert.equal((await stored(atomicId)).length, 2, "the rolled-back page safely replays from its original index");
  } finally {
    t.mock.timers.reset();
  }
});
