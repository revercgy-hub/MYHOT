// Verify the NFRA attachment hold across the real collector/material and delayed-extraction DB seams.
// Every network request is intercepted by a MockAgent; only saved official bytes and synthetic detail faults are used.
import "./setup.ts";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { config } from "@aihot/backend/config";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { collectSource } from "@aihot/backend/sources/collect";
import { extractArticleBody } from "@aihot/backend/content/extract";
import { createNfraJsonRunBudget } from "@aihot/backend/content/nfra-json-detail";
import { readAttachmentDiagnostic } from "@aihot/backend/content/attachment-diagnostics";

const backendRequire = createRequire(new URL("../packages/backend/src/lib/http-fetch.ts", import.meta.url));
const { getGlobalDispatcher, MockAgent, setGlobalDispatcher } = backendRequire("undici") as any;
const listBytes = readFileSync(new URL("./fixtures/nfra-json-detail/list.json", import.meta.url));
const detailBytes = readFileSync(new URL("./fixtures/nfra-json-detail/detail.json", import.meta.url));
const catalog = JSON.parse(readFileSync(new URL("../industry/sources.json", import.meta.url), "utf8")) as { sources: Array<Record<string, any>> };
const configured = catalog.sources.find((row) => row.id === "nfra-regulatory-dynamics")!;
const ID = "nfra-regulatory-dynamics";
const ARTICLE_URL = "https://www.nfra.gov.cn/cn/view/pages/ItemDetail.html?docId=1273452&itemId=915";
const LIST_URL = new URL(String(configured.config.url));
const fixtureList = JSON.parse(listBytes.toString("utf8")) as { data: Array<{ itemId: number; docInfoVOList: Array<{ docId: number }> }> };
const targetRows = fixtureList.data.find((row) => row.itemId === 915)!.docInfoVOList;

const agent = new MockAgent();
agent.disableNetConnect();
let previousDispatcher: unknown;
let previousPrivateNetwork = false;
let requests: string[] = [];

before(async () => {
  previousDispatcher = getGlobalDispatcher();
  previousPrivateNetwork = config.allowPrivateNetworkFetch;
  assert.equal(previousPrivateNetwork, false, "private-network access is disabled before the MockAgent-only transport switch");
  // Test-only bypass of DNS validation lets Undici's deny-by-default MockAgent intercept the official HTTPS origin.
  // The environment may omit ALLOW_PRIVATE_NETWORK_FETCH; its configured default is false and MockAgent has no network fallback.
  config.allowPrivateNetworkFetch = true;
  setGlobalDispatcher(agent);
  requests = [];
  const origin = LIST_URL.origin;
  agent.get(origin).intercept({ method: "GET", path: LIST_URL.pathname + LIST_URL.search }).reply(() => {
    requests.push(LIST_URL.pathname + LIST_URL.search);
    return { statusCode: 200, data: listBytes, responseOptions: { headers: { "content-type": "application/json; charset=utf-8" } } };
  });
  for (const row of targetRows) {
    const path = `/cbircweb/DocInfo/SelectByDocId?docId=${row.docId}`;
    const payload = row.docId === 1273452
      ? detailBytes
      : Buffer.from(JSON.stringify({ rptCode: 200, data: { ...JSON.parse(detailBytes.toString("utf8")).data, docId: row.docId + 99_000 } }));
    agent.get(origin).intercept({ method: "GET", path }).reply(() => {
      requests.push(path);
      return { statusCode: 200, data: payload, responseOptions: { headers: { "content-type": "application/json; charset=utf-8" } } };
    });
  }
  // Delayed extraction must call the same exact detail endpoint a second time.
  const targetPath = "/cbircweb/DocInfo/SelectByDocId?docId=1273452";
  agent.get(origin).intercept({ method: "GET", path: targetPath }).reply(() => {
    requests.push(targetPath);
    return { statusCode: 200, data: detailBytes, responseOptions: { headers: { "content-type": "application/json; charset=utf-8" } } };
  });
  assert.equal(configured.enabled, false, "the production source remains disabled");
  const exists = await sql<{ id: string }[]>`SELECT id FROM sources WHERE id = ${ID}`;
  assert.equal(exists.length, 0, "fresh test database has no pre-existing NFRA source");
  await sql`INSERT INTO sources (id, name, kind, config, tier, first_party, participation_mode, interval_minutes, enabled, cursor)
    VALUES (${ID}, ${configured.name}, 'json_list', ${sql.json(configured.config)}, 'T1', true, 'editorial', 1440, false, '{}'::jsonb)`;
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

test("NFRA collector persists list attachment pending and delayed extraction cannot clear it or store a body", async () => {
  assert.equal(process.env.COLLECT_ENABLED, "false");
  // npm test enables this flag only to let unrelated fake-provider tests use local stubs.
  // This collector/extractor path has no provider branch; zero analyses/receipts below prove none ran.
  const result = await collectSource(ID, { force: true });
  assert.equal(result.status, "ok");
  assert.equal(result.found, 6);
  assert.equal(result.created, 6);
  assert.equal(requests.length, 7, "one saved list plus six unique detail dispatches, with no attachment requests");
  assert.equal(requests.filter((path) => path === LIST_URL.pathname + LIST_URL.search).length, 1);

  const [article] = await sql<{ id: string; url: string; body_status: string; body_html: string | null; body_text: string | null; revision: number; raw: unknown }[]>`
    SELECT id, url, body_status, body_html, body_text, revision, raw FROM articles WHERE source_id = ${ID} AND url = ${ARTICLE_URL}`;
  assert.ok(article, "saved actual list/detail target is stored");
  assert.deepEqual([article!.body_status, article!.body_html, article!.body_text, article!.revision], ["unconfirmed", null, null, 1]);
  assert.equal(readAttachmentDiagnostic(article!.raw)?.reason, "attachments_unprocessed", "list-side DOC/PDF evidence is persisted as a trusted pending marker");
  assert.equal((await sql`SELECT count(*)::int AS n FROM pgboss.job WHERE data->>'articleId' = ${article!.id}`).at(0)?.n, 0,
    "the attachment hold does not start a worker or enqueue analysis/extraction");

  assert.equal(await extractArticleBody(article!.id, true), "unconfirmed");
  assert.equal(requests.length, 8, "delayed body extraction dispatches only the shared JSON detail request");
  assert.deepEqual(requests.at(-1), "/cbircweb/DocInfo/SelectByDocId?docId=1273452");
  const [after] = await sql<{ body_status: string; body_html: string | null; body_text: string | null; revision: number; raw: unknown }[]>`
    SELECT body_status, body_html, body_text, revision, raw FROM articles WHERE id = ${article!.id}`;
  assert.deepEqual([after!.body_status, after!.body_html, after!.body_text, after!.revision], ["unconfirmed", null, null, 1]);
  assert.equal(readAttachmentDiagnostic(after!.raw)?.reason, "attachments_unprocessed", "detail null/empty attachments do not clear the list marker");
  assert.equal((await sql`SELECT count(*)::int AS n FROM article_revisions WHERE article_id = ${article!.id}`).at(0)?.n, 1);
  assert.equal((await sql`SELECT count(*)::int AS n FROM analyses WHERE article_id = ${article!.id}`).at(0)?.n, 0);
  assert.equal((await sql`SELECT count(*)::int AS n FROM receipts WHERE subject = ${`article:${article!.id}`}`).at(0)?.n, 0);
  assert.equal((await sql`SELECT count(*)::int AS n FROM publications WHERE article_id = ${article!.id} AND selected = true`).at(0)?.n, 0);
  assert.equal(configured.enabled, false, "verification did not enable the industry source");
});

test("NFRA delayed deadline aborts before a detail dispatch after the operation expires", () => {
  const budget = createNfraJsonRunBudget({ delayedDocId: 1273452 });
  const originalNow = Date.now;
  try {
    Date.now = () => originalNow() + 20_001;
    assert.throws(() => budget.assertActive(), /NFRA source run deadline exceeded/);
    assert.equal(budget.runBudget.signal?.aborted, true);
    assert.throws(() => budget.runBudget.beforeDispatch({
      url: new URL("https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1273452"),
      method: "GET", redirectHop: 0,
    }), /NFRA source run deadline exceeded/);
  } finally {
    Date.now = originalNow;
    budget.dispose();
  }
});
