// Independently verify that a bounded GovCN run persists partial diagnostics and applies its
// 90-day window even when ordinary initializedAt state already exists. All HTTP is intercepted.
import "./setup.ts";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { config } from "@aihot/backend/config";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { collectSource } from "@aihot/backend/sources/collect";

const backendRequire = createRequire(new URL("../packages/backend/src/lib/http-fetch.ts", import.meta.url));
const { getGlobalDispatcher, MockAgent, setGlobalDispatcher } = backendRequire("undici") as any;
const listBytes = readFileSync(new URL("./fixtures/govcn-detail-identity/policy-search-response.json", import.meta.url));
const detailBytes = readFileSync(new URL("./fixtures/govcn-detail-identity/fiscal-policy-detail.html", import.meta.url));
const catalog = JSON.parse(readFileSync(new URL("../industry/sources.json", import.meta.url), "utf8")) as { sources: Array<Record<string, any>> };
const configured = catalog.sources.find((row) => row.id === "govcn-policy-library")!;
const ID = "govcn-policy-library";
const listBase = new URL(String(configured.config.url));
const listOne = new URL(listBase);
const listTwo = new URL(listBase);
listTwo.searchParams.set("p", "2");
const fixture = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(listBytes));
const pageOneRows = fixture.searchVO.catMap.bumenfile.listVO as Array<Record<string, any>>;
const oldOnlyUrl = "https://www.gov.cn/zhengce/zhengceku/202606/content_9999998.htm";
const syntheticPageTwo = () => {
  const page = structuredClone(fixture);
  const rows = page.searchVO.catMap.bumenfile.listVO as Array<Record<string, any>>;
  rows[4] = {
    ...rows[0],
    id: "synthetic-govcn-old-page-2-row",
    title: "合成测试第二页：超过90日窗口的旧条目",
    url: oldOnlyUrl,
    pubtime: Date.parse("2026-06-30T00:00:00.000Z"),
  };
  page.paramsVO.p = 2;
  return Buffer.from(JSON.stringify(page), "utf8");
};

const agent = new MockAgent();
agent.disableNetConnect();
let previousDispatcher: unknown;
let previousPrivateNetwork = false;
const requests: string[] = [];

function intercept(url: URL, body: Buffer) {
  agent.get(url.origin).intercept({ method: "GET", path: url.pathname + url.search }).reply(() => {
    requests.push(url.toString());
    return { statusCode: 200, data: body, responseOptions: { headers: { "content-type": url.hostname === "sousuo.www.gov.cn" ? "application/json; charset=utf-8" : "text/html; charset=utf-8" } } };
  });
}

before(async () => {
  previousDispatcher = getGlobalDispatcher();
  previousPrivateNetwork = config.allowPrivateNetworkFetch;
  assert.equal(previousPrivateNetwork, false, "the normal config default keeps private-network fetch disabled");
  config.allowPrivateNetworkFetch = true; // Test-only DNS bypass; MockAgent still denies all unregistered network.
  setGlobalDispatcher(agent);
  intercept(listOne, listBytes);
  intercept(listTwo, syntheticPageTwo());
  for (const row of pageOneRows) intercept(new URL(row.url), detailBytes);

  assert.equal(configured.enabled, false, "the production GovCN source remains disabled");
  assert.equal(configured.site_fulltext, false);
  assert.equal(configured.syndicate_fulltext, false);
  assert.equal((await sql<{ id: string }[]>`SELECT id FROM sources WHERE id = ${ID}`).length, 0,
    "fresh test database has no existing GovCN source");
  await sql`INSERT INTO sources (id, name, kind, config, tier, first_party, participation_mode, interval_minutes, enabled, cursor)
    VALUES (${ID}, ${configured.name}, 'json_list', ${sql.json(configured.config)}, 'T1', true, 'editorial', 1440, false,
      ${sql.json({ initializedAt: "2026-09-01T00:00:00.000Z" })})`;
});

after(async () => {
  config.allowPrivateNetworkFetch = previousPrivateNetwork;
  setGlobalDispatcher(previousDispatcher);
  await agent.close();
  await sql`DELETE FROM articles WHERE source_id = ${ID}`;
  await sql`DELETE FROM fetch_runs WHERE source_id = ${ID}`;
  await sql`DELETE FROM sources WHERE id = ${ID}`;
  await stopBoss();
  await closeDb();
});

test("GovCN collector stores partial diagnostics and still filters old page rows after initializedAt", async () => {
  assert.equal(process.env.COLLECT_ENABLED, "false");
  const result = await collectSource(ID, { force: true });
  assert.equal(result.status, "ok", result.error ?? `collector status ${result.status}`);
  assert.equal(result.found, 6, "both pages yielded six unique list identities before the fixed date window");
  assert.equal(result.created, 5, "the synthetic row older than 90 days is excluded despite initializedAt");
  assert.equal(requests.length, 7, "two pages plus five detail targets share the seven-dispatch cap");
  assert.equal(requests.filter((url) => url === listOne.toString()).length, 1);
  assert.equal(requests.filter((url) => url === listTwo.toString()).length, 1);
  assert.equal(requests.includes(oldOnlyUrl), false, "the old page-2 candidate is filtered before detail dispatch");
  assert.equal(configured.enabled, false, "the fixture source is never enabled");

  const [run] = await sql<{ status: string; found_count: number; new_count: number; detail: Record<string, unknown> | null }[]>`
    SELECT status, found_count, new_count, detail FROM fetch_runs WHERE source_id = ${ID} ORDER BY id DESC LIMIT 1`;
  assert.deepEqual([run!.status, run!.found_count, run!.new_count], ["ok", 6, 5]);
  assert.ok(run!.detail, "pagination diagnostics are persisted on the actual fetch_run row");
  assert.deepEqual([run!.detail!.mode, run!.detail!.pagesFetched, run!.detail!.uniqueCandidates], ["govcn_query_v1", 2, 6]);
  assert.deepEqual([run!.detail!.dispatchesUsed, run!.detail!.maxDispatches, run!.detail!.detailTargetsUsed, run!.detail!.maxDetailTargets], [7, 7, 5, 5]);
  assert.equal(run!.detail!.rowsOutsideWindow, 1);
  assert.ok(Number(run!.detail!.pendingDetails) > 0, "identity failures remain visible as pending body work");
  assert.deepEqual([run!.detail!.stopReason, run!.detail!.partial, run!.detail!.coverage], ["max_pages_per_run", true, "unproven"]);

  const articles = await sql<{ url: string; body_status: string; body_text: string | null }[]>`
    SELECT url, body_status, body_text FROM articles WHERE source_id = ${ID} ORDER BY url`;
  assert.equal(articles.length, 5);
  assert.equal(articles.some((row) => row.url === oldOnlyUrl), false);
  const [sourceAfter] = await sql<{ cursor: Record<string, unknown> }[]>`SELECT cursor FROM sources WHERE id = ${ID}`;
  assert.equal(sourceAfter!.cursor.initializedAt, "2026-09-01T00:00:00.000Z", "ordinary initialization state is preserved");
  assert.equal((await sql`SELECT count(*)::int AS n FROM analyses WHERE article_id IN (SELECT id FROM articles WHERE source_id = ${ID})`).at(0)?.n, 0);
  assert.equal((await sql`SELECT count(*)::int AS n FROM publications WHERE article_id IN (SELECT id FROM articles WHERE source_id = ${ID})`).at(0)?.n, 0);
  assert.equal((await sql`SELECT count(*)::int AS n FROM receipts WHERE subject IN (SELECT 'article:' || id FROM articles WHERE source_id = ${ID})`).at(0)?.n, 0);
});
