// Exercise the disabled bureau configs through the real database collector and body extractor.
// The saved list/detail HTML is served only by this test's loopback fixture server.
import "./setup.ts";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { after, before, mock, test } from "node:test";
import { tag } from "./setup.ts";

process.env.COLLECT_ENABLED = "false";
process.env.MODEL_CALLS_ENABLED = "false";
process.env.JINA_BODY_FALLBACK = "false";
process.env.FEISHU_CONTENT_PUSH_ENABLED = "false";
process.env.FEISHU_SELECTED_PUSH_ENABLED = "false";
process.env.FEISHU_INTERNAL_ENABLED = "false";
process.env.INDEXNOW_SUBMIT_ENABLED = "false";
process.env.AIHOT_CREDENTIALS_DIR = "/nonexistent-test-credentials";

const [{ config }, { closeDb, sql }, { stopBoss, QUEUES }, { collectSource }, { extractArticleBody }, { fromHtml }] = await Promise.all([
  import("@aihot/backend/config"),
  import("@aihot/backend/db"),
  import("@aihot/backend/jobs/queue"),
  import("@aihot/backend/sources/collect"),
  import("@aihot/backend/content/extract"),
  import("@aihot/backend/sources/web-list"),
]);

const SUFFIX = tag();
const BUREAUS = [
  { key: "fujian", id: "mof-fujian-supervision-dynamics" },
  { key: "beijing", id: "mof-beijing-supervision-dynamics" },
  { key: "shanghai", id: "mof-shanghai-supervision-dynamics" },
] as const;
type BureauKey = (typeof BUREAUS)[number]["key"];
type Fixture = { sourceId: string; basePath: string; listingPath: string; detailPath: string; listHtml: string; detailHtml: string; config: Record<string, any>; candidates: Array<{ url: string; title: string }> };
const fixtures = new Map<BureauKey, Fixture>();
const detailReads = new Map<BureauKey, number>();
let server: http.Server;
let base = "";
let previousPrivateNetwork: boolean;
let beijingDetailHtml = "";
let forceBeijingBodyIdentityFailure = false;

function localize(html: string, origin: string, prefix: string): string {
  return html.replaceAll(origin, prefix).replaceAll(origin.replace(/^https:/, "http:"), prefix);
}

server = http.createServer((req, res) => {
  const requested = new URL(req.url ?? "/", base);
  for (const [key, fixture] of fixtures) {
    if (requested.pathname === fixture.listingPath) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(fixture.listHtml);
      return;
    }
    if (requested.pathname.startsWith(`${fixture.basePath}/`)) {
      detailReads.set(key, (detailReads.get(key) ?? 0) + 1);
      if (requested.pathname !== fixture.detailPath) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("synthetic budget candidate has no saved detail");
        return;
      }
      const detail = key === "beijing" && forceBeijingBodyIdentityFailure
        ? beijingDetailHtml
          .replace(/(<h2\b[^>]*class="[^"]*title_con[^"]*"[^>]*>)[\s\S]*?(<\/h2>)/i, "$1Synthetic conflicting detail identity$2")
          .replace(/(<meta\s+name="ArticleTitle"\s+content=")[^"]+/i, "$1Synthetic conflicting detail identity")
        : fixture.detailHtml;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(detail);
      return;
    }
  }
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("fixture miss");
});

const restorePrivateNetwork = () => { config.allowPrivateNetworkFetch = previousPrivateNetwork; };

before(async () => {
  previousPrivateNetwork = config.allowPrivateNetworkFetch;
  config.allowPrivateNetworkFetch = true;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  const { sources } = JSON.parse(await readFile(new URL("../industry/sources.json", import.meta.url), "utf8")) as { sources: Array<Record<string, any>> };
  for (const bureau of BUREAUS) {
    const configured = sources.find((source) => source.id === bureau.id);
    assert.ok(configured, `industry/sources.json contains ${bureau.id}`);
    assert.equal(configured!.enabled, false, `${bureau.id} remains disabled`);
    assert.equal(configured!.kind, "web_list");
    const rawList = await readFile(new URL(`./fixtures/regional-bureaus/${bureau.key}-list.html`, import.meta.url), "utf8");
    const rawDetail = await readFile(new URL(`./fixtures/regional-bureaus/${bureau.key}-detail.html`, import.meta.url), "utf8");
    const origin = new URL(configured!.config.url).origin;
    const localPrefix = `${base}/${bureau.key}`;
    let listHtml = localize(rawList, origin, localPrefix);
    // The saved observation has one representative row. Add test-only rows in that observed DOM
    // shape for the two non-authoritative sources, so the first run proves the maxFetches ceiling.
    if (bureau.key !== "beijing") {
      const sampleRow = /<li\b[^>]*>[\s\S]*?<\/li>/i.exec(listHtml)?.[0];
      assert.ok(sampleRow, `${bureau.id} fixture contains a representative list row`);
      const titleMatch = /title="([^"]+)"/.exec(sampleRow!);
      assert.ok(titleMatch, `${bureau.id} fixture row has a title attribute`);
      const syntheticRows = Array.from({ length: 11 }, (_value, index) => {
        const title = `${titleMatch![1]} (synthetic budget row ${index + 1})`;
        return sampleRow!
          .replace(/href="[^"]+"/, `href="./synthetic-budget-${index + 1}.htm"`)
          .replaceAll(titleMatch![1]!, title);
      }).join("\n");
      listHtml = listHtml.replace("</ul>", `${syntheticRows}</ul>`);
    }
    const detailHtml = localize(rawDetail, origin, localPrefix);
    const sourceConfig = structuredClone(configured!.config);
    sourceConfig.url = `${localPrefix}/listing.html`;
    sourceConfig.allowUrlPrefixes = [`${localPrefix}/`];
    const candidates = fromHtml(listHtml, sourceConfig.url, { id: bureau.id, name: configured!.name, kind: configured!.kind, config: sourceConfig } as never);
    assert.ok(candidates.length > 0, `${bureau.id} fixture list produces candidates`);
    const listUrl = new URL(sourceConfig.url);
    const detailUrl = new URL(candidates[0]!.url);
    const fixture: Fixture = {
      sourceId: `${bureau.id}-${SUFFIX}`,
      basePath: `/${bureau.key}`,
      listingPath: listUrl.pathname,
      detailPath: detailUrl.pathname,
      listHtml,
      detailHtml,
      config: sourceConfig,
      candidates,
    };
    fixtures.set(bureau.key, fixture);
    detailReads.set(bureau.key, 0);
    await sql`INSERT INTO sources (id, name, kind, config, tier, first_party, participation_mode, interval_minutes, enabled, cursor, next_fetch_at)
      VALUES (${fixture.sourceId}, ${configured!.name}, 'web_list', ${sql.json(sourceConfig)}, 'T1', true, 'editorial', 1440, false, '{}'::jsonb, '2100-01-01')`;
  }
  beijingDetailHtml = fixtures.get("beijing")!.detailHtml;
});

after(async () => {
  restorePrivateNetwork();
  if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const fixture of fixtures.values()) {
    await sql`DELETE FROM articles WHERE source_id = ${fixture.sourceId}`;
    await sql`DELETE FROM sources WHERE id = ${fixture.sourceId}`;
  }
  await stopBoss();
  await closeDb();
});

test("regional bureaus collect within budget and Beijing preserves authoritative identity across extraction", async () => {
  assert.equal(config.modelCallsEnabled, false);
  assert.equal(process.env.COLLECT_ENABLED, "false");
  assert.equal(process.env.INDEXNOW_SUBMIT_ENABLED, "false");

  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(" ")); };
  mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-05T12:00:00.000Z") });
  try {
    for (const { key, id } of BUREAUS) {
      const fixture = fixtures.get(key)!;
      const result = await collectSource(fixture.sourceId, { force: true });
      assert.equal(result.status, "ok", `${id} collector succeeds against local fixtures`);
      assert.equal(result.found, fixture.candidates.length);
      const budget = Number(fixture.config.detail?.maxFetches ?? 0);
      assert.ok((detailReads.get(key) ?? 0) <= budget, `${id} uses no more than its first-run detail budget`);
      assert.ok((detailReads.get(key) ?? 0) > 0, `${id} exercises its detail rules`);
      if (key !== "beijing") assert.equal(detailReads.get(key), budget, `${id} stops exactly at maxFetches when more candidates remain`);
      const afterFirst = detailReads.get(key);
      const repeated = await collectSource(fixture.sourceId, { force: true });
      assert.equal(repeated.status, "ok");
      assert.deepEqual([repeated.created, repeated.revised], [0, 0], `${id} repeat does not rewrite stored authoritative metadata`);
      assert.equal(detailReads.get(key), afterFirst, `${id} does not fetch details again for known listing items`);
    }

    const beijing = fixtures.get("beijing")!;
    const beijingCandidate = beijing.candidates[0]!;
    const [initial] = await sql<{ id: string; title: string; published_at: Date | null; body_status: string; revision: number; body_text: string | null }[]>`
      SELECT id, title, published_at, body_status, revision, body_text FROM articles WHERE source_id = ${beijing.sourceId} AND url = ${beijingCandidate.url}`;
    assert.ok(initial, "Beijing detail item survived the strict first-run date window");
    const headline = /<h2\b[^>]*class="[^"]*title_con[^"]*"[^>]*>([\s\S]*?)<\/h2>/i.exec(beijing.detailHtml)?.[1]?.replace(/<[^>]*>/g, "").trim();
    const pubDate = /<meta\s+name="PubDate"\s+content="([^"]+)/i.exec(beijing.detailHtml)?.[1];
    assert.ok(headline, "Beijing detail fixture has authoritative title metadata");
    assert.ok(pubDate, "Beijing detail fixture has authoritative date metadata");
    assert.equal(initial.title, headline);
    assert.ok(initial.published_at);
    assert.equal(initial.published_at!.toISOString(), new Date(`${pubDate!.replace(" ", "T")}+08:00`).toISOString());
    assert.deepEqual([initial.body_status, initial.revision, initial.body_text], ["pending", 1, null], "first-stage identity failure leaves body safely pending");
    assert.ok(warnings.some((line) => line.includes('"reason":"identity_missing"')), "the first detail body rejection is identity_missing");

    const [queued] = await sql<{ state: string; name: string; data: { articleId: string } }[]>`
      SELECT state, name, data FROM pgboss.job WHERE name = ${QUEUES.extractBody} AND data->>'articleId' = ${initial.id} ORDER BY created_on DESC LIMIT 1`;
    assert.ok(queued, "queueProcessing routed the pending web_list article to extract-body");
    assert.equal(queued!.state, "created", "the test records queue routing without starting a worker");

    forceBeijingBodyIdentityFailure = true;
    assert.equal(await extractArticleBody(initial.id, false), "unconfirmed", "a later identity failure stays unconfirmed");
    const [failed] = await sql<{ title: string; published_at: Date | null; body_status: string; revision: number; body_text: string | null }[]>`
      SELECT title, published_at, body_status, revision, body_text FROM articles WHERE id = ${initial.id}`;
    assert.deepEqual([failed!.title, failed!.published_at!.toISOString(), failed!.body_status, failed!.revision, failed!.body_text],
      [initial.title, initial.published_at!.toISOString(), "unconfirmed", 1, null], "failed extraction preserves authoritative metadata and cannot fabricate a body revision");

    forceBeijingBodyIdentityFailure = false;
    assert.equal(await extractArticleBody(initial.id, false), "ok", "explicit second-stage extraction uses persisted authoritative identity");
    const [complete] = await sql<{ title: string; published_at: Date | null; body_status: string; revision: number; body_text: string | null }[]>`
      SELECT title, published_at, body_status, revision, body_text FROM articles WHERE id = ${initial.id}`;
    assert.deepEqual([complete!.title, complete!.published_at!.toISOString(), complete!.body_status, complete!.revision],
      [initial.title, initial.published_at!.toISOString(), "ok", 2]);
    assert.ok(complete!.body_text && complete!.body_text.length >= 200);
    assert.equal((await sql`SELECT count(*)::int AS n FROM article_revisions WHERE article_id = ${initial.id}`).at(0)?.n, 2);
    assert.equal((await sql`SELECT count(*)::int AS n FROM analyses WHERE article_id = ${initial.id}`).at(0)?.n, 0);
    assert.equal((await sql`SELECT count(*)::int AS n FROM receipts WHERE subject = ${`article:${initial.id}`}`).at(0)?.n, 0);
    assert.equal((await sql`SELECT count(*)::int AS n FROM publications WHERE article_id = ${initial.id} AND selected = true`).at(0)?.n, 0);

    for (const { key } of BUREAUS) {
      const fixture = fixtures.get(key)!;
      assert.ok((detailReads.get(key) ?? 0) <= Number(fixture.config.detail?.maxFetches ?? 0), `${key} stayed within its detail budget after the repeated run`);
    }
  } finally {
    mock.timers.reset();
    console.warn = originalWarn;
  }
});
