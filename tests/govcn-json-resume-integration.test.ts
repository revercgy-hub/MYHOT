// Independent persistence QA for GovCN durable continuation. All HTTP is intercepted by MockAgent;
// pages beyond the saved p1 response are explicitly synthetic. No worker is started.
import "./setup.ts";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { config } from "@aihot/backend/config";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { collectSource } from "@aihot/backend/sources/collect";
import { GOVCN_JSON_RESUME_CURSOR_KEY } from "@aihot/backend/sources/json-list-pagination";

const backendRequire = createRequire(new URL("../packages/backend/src/lib/http-fetch.ts", import.meta.url));
const { getGlobalDispatcher, MockAgent, setGlobalDispatcher } = backendRequire("undici") as any;
const savedP1 = readFileSync(new URL("./fixtures/govcn-detail-identity/policy-search-response.json", import.meta.url));
const firstSavedURL = String(JSON.parse(savedP1.toString("utf8")).searchVO.catMap.bumenfile.listVO[0].url);
const catalog = JSON.parse(readFileSync(new URL("../industry/sources.json", import.meta.url), "utf8")) as { sources: Array<Record<string, any>> };
const configured = catalog.sources.find((row) => row.id === "govcn-policy-library")!;
const ID = "govcn-policy-library";
const sourceConfig = {
  ...configured.config,
  pagination: { mode: "govcn_query_resume_v1", maxPagesPerRun: 2, maxDispatches: 2 },
};
const listBase = new URL(String(configured.config.url));
const pageUrls = new Map<number, URL>();
for (let page = 1; page <= 4; page++) {
  const url = new URL(listBase);
  url.searchParams.set("p", String(page));
  pageUrls.set(page, url);
}
const pageBodies = new Map<number, Buffer>();
const requests: string[] = [];
const agent = new MockAgent();
agent.disableNetConnect();
let previousDispatcher: unknown;
let previousPrivateNetwork = false;
let beforeListReply: { page: number; run: () => Promise<void> } | null = null;

function pageFromFixture(page: number, label: string, daysAgo: number): Buffer {
  const payload = JSON.parse(savedP1.toString("utf8"));
  payload.paramsVO.p = page;
  const rows = payload.searchVO.catMap.bumenfile.listVO as Array<Record<string, unknown>>;
  const published = Date.now() - daysAgo * 86_400_000;
  for (let index = 0; index < rows.length; index++) {
    rows[index] = {
      ...rows[index],
      id: `synthetic-resume-${label}-${index}`,
      title: `合成GovCN续页持久化QA ${label} ${index}`,
      url: `https://www.gov.cn/zhengce/zhengceku/202610/content_resume_${label}_${index}.htm`,
      summary: `Synthetic page ${label} QA row ${index}`,
      pubtime: published - index * 60_000,
    };
  }
  return Buffer.from(JSON.stringify(payload), "utf8");
}

function withFreshPollRow(): Buffer {
  const payload = JSON.parse(savedP1.toString("utf8"));
  payload.paramsVO.p = 1;
  const rows = payload.searchVO.catMap.bumenfile.listVO as Array<Record<string, unknown>>;
  rows[0] = {
    ...rows[0],
    id: "synthetic-resume-current-window-only",
    title: "合成GovCN当前滑动窗口发现项",
    url: "https://www.gov.cn/zhengce/zhengceku/202610/content_resume_current_window_only.htm",
    summary: "Current polling-window-only row",
    pubtime: Date.now() - 86_400_000,
  };
  return Buffer.from(JSON.stringify(payload), "utf8");
}

function interceptPages() {
  for (let page = 1; page <= 4; page++) {
    const url = pageUrls.get(page)!;
    agent.get(url.origin).intercept({ method: "GET", path: url.pathname + url.search }).reply(async () => {
      requests.push(url.toString());
      if (beforeListReply?.page === page) {
        const hook = beforeListReply;
        beforeListReply = null;
        await hook.run();
      }
      return {
        statusCode: 200,
        data: pageBodies.get(page) ?? savedP1,
        responseOptions: { headers: { "content-type": "application/json; charset=utf-8" } },
      };
    }).persist();
  }
}

async function resetSource(cursor: Record<string, unknown> = {}) {
  await sql`DELETE FROM pgboss.job WHERE data->>'articleId' IN (SELECT id FROM articles WHERE source_id = ${ID})`;
  await sql`DELETE FROM articles WHERE source_id = ${ID}`;
  await sql`DELETE FROM fetch_runs WHERE source_id = ${ID}`;
  await sql`UPDATE sources SET config = ${sql.json(sourceConfig)}, tier = 'T1', first_party = true,
      participation_mode = 'isolated', enabled = false, cursor = ${sql.json(cursor as never)}, fail_count = 0,
      last_error = NULL, health = 'ok' WHERE id = ${ID}`;
}

async function storedRows() {
  return sql<{ url: string; title: string; backfill: boolean; backfill_reason: string | null; body_status: string; body_text: string | null; published_at_claim: Date | null }[]>`
    SELECT url, title, backfill, backfill_reason, body_status, body_text, published_at_claim FROM articles WHERE source_id = ${ID} ORDER BY url`;
}

async function readCursor() {
  const [row] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${ID}`;
  return row!.cursor[GOVCN_JSON_RESUME_CURSOR_KEY];
}

async function writeCursor(value: Record<string, unknown>) {
  const [row] = await sql<{ cursor: Record<string, unknown> }[]>`SELECT cursor FROM sources WHERE id = ${ID}`;
  await sql`UPDATE sources SET cursor = ${sql.json({ ...(row!.cursor ?? {}), [GOVCN_JSON_RESUME_CURSOR_KEY]: value } as never)} WHERE id = ${ID}`;
}

async function createTrigger(name: string, body: string) {
  await sql.unsafe(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $trigger$ BEGIN ${body} END $trigger$`);
}

async function dropTrigger(name: string, table: string) {
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${name}_trigger ON ${table}`);
  await sql.unsafe(`DROP FUNCTION IF EXISTS ${name}()`);
}

before(async () => {
  assert.equal(process.env.COLLECT_ENABLED, "false", "collector global valve stays disabled; the test invokes only the explicit collector function");
  assert.equal(config.allowPrivateNetworkFetch, false, "private network access starts disabled");
  assert.equal(configured.enabled, false, "the industry source remains disabled");
  assert.equal(configured.site_fulltext, false);
  assert.equal(configured.syndicate_fulltext, false);
  previousDispatcher = getGlobalDispatcher();
  previousPrivateNetwork = config.allowPrivateNetworkFetch;
  config.allowPrivateNetworkFetch = true; // Test-only DNS bypass; MockAgent remains deny-by-default.
  setGlobalDispatcher(agent);
  interceptPages();
  const exists = await sql<{ id: string }[]>`SELECT id FROM sources WHERE id = ${ID}`;
  assert.equal(exists.length, 0, "the fresh test database has no pre-existing GovCN source");
  await sql`INSERT INTO sources (id, name, kind, config, tier, first_party, participation_mode, interval_minutes, enabled, cursor)
    VALUES (${ID}, ${configured.name}, 'json_list', ${sql.json(sourceConfig)}, 'T1', true, 'isolated', 1440, false, '{}'::jsonb)`;
  pageBodies.set(1, savedP1);
  pageBodies.set(2, pageFromFixture(2, "page2", 10));
  pageBodies.set(3, pageFromFixture(3, "page3", 12));
  pageBodies.set(4, pageFromFixture(4, "page4", 50));
});

after(async () => {
  for (const name of ["qa_gov_resume_queue_failure", "qa_gov_resume_article_failure", "qa_gov_resume_cursor_failure", "qa_gov_resume_commit_failure"]) {
    await dropTrigger(name, name === "qa_gov_resume_queue_failure" ? "pgboss.job" : name === "qa_gov_resume_article_failure" ? "articles" : name === "qa_gov_resume_cursor_failure" ? "sources" : "fetch_runs").catch(() => {});
  }
  config.allowPrivateNetworkFetch = previousPrivateNetwork;
  setGlobalDispatcher(previousDispatcher);
  await agent.close();
  await sql`DELETE FROM pgboss.job WHERE data->>'articleId' IN (SELECT id FROM articles WHERE source_id = ${ID})`;
  await sql`DELETE FROM articles WHERE source_id = ${ID}`;
  await sql`DELETE FROM fetch_runs WHERE source_id = ${ID}`;
  await sql`DELETE FROM sources WHERE id = ${ID}`;
  await stopBoss();
  await closeDb();
});

test("GovCN resume persists p1/p2, replays a failed p4 transaction atomically, and separates rolling freshness from its frozen history window", async () => {
  // First generation run must commit p1 and p2, even though p1 is also the ordinary freshness poll.
  let result = await collectSource(ID, { force: true });
  assert.equal(result.status, "ok", result.error ?? "initial GovCN resume run failed");
  assert.deepEqual(requests.slice(0, 2), [pageUrls.get(1)!.toString(), pageUrls.get(2)!.toString()]);
  let cursor = await readCursor();
  assert.deepEqual([cursor.pagesCommitted, cursor.nextPage, cursor.state, cursor.coverage], [2, 3, "active", "unproven"]);
  assert.ok(Date.parse(cursor.anchorAt) <= Date.now());
  const firstRows = await storedRows();
  assert.equal(firstRows.length, 10, "p1 and synthetic p2 identities are both persisted");
  assert.ok(firstRows.some((row) => row.url === firstSavedURL && row.backfill && row.backfill_reason === "first-import"),
    "p1's shared poll/history identity is stored once with first-import reason");
  assert.ok(firstRows.some((row) => row.url.includes("content_resume_page2_0.htm") && row.backfill && row.backfill_reason === "first-import"),
    "p2 history rows retain first-import reason");
  const firstRun = await sql<{ detail: Record<string, any> }[]>`SELECT detail FROM fetch_runs WHERE source_id = ${ID} ORDER BY id LIMIT 1`;
  assert.deepEqual([firstRun[0]!.detail.dispatchesUsed, firstRun[0]!.detail.maxDispatches, firstRun[0]!.detail.pagesFetched,
    firstRun[0]!.detail.detailTargetsUsed, firstRun[0]!.detail.coverage, firstRun[0]!.detail.partial], [2, 2, 2, 0, "unproven", true],
    "the two-dispatch DB case spends both requests on p1+p2 and remains partial");
  assert.ok(firstRows.some((row) => row.url.includes("content_resume_page2_0.htm") && row.backfill), "history rows retain first-import semantics");
  assert.equal((await sql`SELECT count(*)::int AS n FROM analyses a JOIN articles x ON x.id = a.article_id WHERE x.source_id = ${ID}`).at(0)?.n, 0,
    "no analysis/provider work ran for this source's articles");
  assert.equal((await sql`SELECT count(*)::int AS n FROM receipts WHERE subject IN (SELECT 'article:' || id FROM articles WHERE source_id = ${ID})`).at(0)?.n, 0,
    "no paid receipt was created for this source's articles");
  assert.equal((await sql`SELECT count(*)::int AS n FROM publications WHERE article_id IN (SELECT id FROM articles WHERE source_id = ${ID})`).at(0)?.n, 0,
    "unprocessed source observations did not publish");

  const generationId = cursor.generationId as string;
  const originalAnchor = cursor.anchorAt as string;
  // A valid same-nextPage cursor mutation made after the source snapshot must fail the full CAS.
  const beforeRace = structuredClone(cursor);
  beforeListReply = { page: 1, run: async () => {
    await writeCursor({ ...beforeRace, lastPageFingerprint: "f".repeat(64), updatedAt: new Date().toISOString() });
  } };
  const beforeRaceRequests = requests.length;
  result = await collectSource(ID, { force: true });
  assert.equal(result.status, "failed", "cursor drift with an unchanged page number fails closed");
  assert.equal(requests.length, beforeRaceRequests + 1, "the race is detected after p1 and before p3 dispatch");
  assert.equal(requests.at(-1), pageUrls.get(1)!.toString());
  assert.deepEqual([(await readCursor()).pagesCommitted, (await readCursor()).nextPage], [2, 3]);
  await writeCursor(beforeRace);

  result = await collectSource(ID, { force: true });
  assert.equal(result.status, "ok", result.error ?? "p3 continuation failed");
  assert.deepEqual(requests.slice(3, 5), [pageUrls.get(1)!.toString(), pageUrls.get(3)!.toString()], "the next run polls p1 and fetches its persisted target p3");
  cursor = await readCursor();
  assert.deepEqual([cursor.pagesCommitted, cursor.nextPage, cursor.generationId, cursor.anchorAt], [3, 4, generationId, originalAnchor]);
  assert.equal((await storedRows()).length, 15, "five p3 identities are committed exactly once");

  // Simulate a generation created a month earlier without sleeping. Its original 90-day bounds stay frozen.
  const agedAnchor = new Date(Date.parse(originalAnchor) - 30 * 86_400_000);
  cursor = {
    ...cursor,
    anchorAt: agedAnchor.toISOString(),
    cutoffAt: new Date(agedAnchor.getTime() - 90 * 86_400_000).toISOString(),
    updatedAt: agedAnchor.toISOString(),
  };
  await writeCursor(cursor);
  pageBodies.set(1, withFreshPollRow());

  const currentOnlyURL = "https://www.gov.cn/zhengce/zhengceku/202610/content_resume_current_window_only.htm";
  const beforeP4Rows = await storedRows();
  result = await collectSource(ID, { force: true });
  assert.equal(result.status, "ok", result.error ?? "p4 continuation failed");
  assert.deepEqual(requests.slice(5, 7), [pageUrls.get(1)!.toString(), pageUrls.get(4)!.toString()]);
  cursor = await readCursor();
  assert.deepEqual([cursor.pagesCommitted, cursor.nextPage, cursor.generationId, cursor.anchorAt, cursor.cutoffAt], [4, 5, generationId, agedAnchor.toISOString(), new Date(agedAnchor.getTime() - 90 * 86_400_000).toISOString()]);
  let rows = await storedRows();
  const currentOnly = rows.find((row) => row.url === currentOnlyURL);
  assert.ok(currentOnly, `the current-window-only row is stored; nearby rows=${JSON.stringify(rows.filter((row) => row.url.includes("current_window")))}`);
  assert.deepEqual([currentOnly!.backfill, currentOnly!.backfill_reason], [false, null],
    `one-day-old poll-only news must remain current discovery rather than first-import or stale-on-discovery: ${JSON.stringify(currentOnly)}`);
  assert.ok(currentOnly!.published_at_claim && currentOnly!.published_at_claim.getTime() > agedAnchor.getTime(), "the current-only row is genuinely newer than the frozen history anchor");
  const historyOnly = rows.find((row) => row.url.includes("content_resume_page4_0.htm"));
  assert.ok(historyOnly && historyOnly.backfill && historyOnly.backfill_reason === "first-import", "p4 rows use the fixed history window and first-import semantics");
  assert.ok(historyOnly!.published_at_claim && historyOnly!.published_at_claim.getTime() < agedAnchor.getTime() && historyOnly!.published_at_claim.getTime() >= Date.parse(cursor.cutoffAt),
    "the p4 row qualifies in the frozen 90-day window but is older than the current generation anchor");
  assert.equal(rows.length, beforeP4Rows.length + 6, "one freshness-only row and five p4 history rows are stored");
  assert.ok((await sql`SELECT count(*)::int AS n FROM pgboss.job WHERE data->>'articleId' IN (SELECT id FROM articles WHERE source_id = ${ID})`).at(0)?.n > 0,
    "queue rows are persisted; no worker is started");

  // A same-nextPage cursor mutation must fail its full checkpoint CAS before the target list request.
  const unchangedPage4RequestCount = requests.filter((url) => url === pageUrls.get(4)!.toString()).length;
  const savedBeforeDrift = await readCursor();
  const drifted = { ...savedBeforeDrift, lastPageFingerprint: "f".repeat(64) };
  beforeListReply = { page: 1, run: async () => {
    await writeCursor({ ...drifted, lastPageFingerprint: "e".repeat(64), updatedAt: new Date().toISOString() });
  } };
  const p5Before = requests.length;
  result = await collectSource(ID, { force: true });
  assert.equal(result.status, "failed", "same-page cursor drift fails closed");
  assert.equal(requests.length, p5Before + 1, "only the rolling p1 poll is fetched before full-cursor CAS rejects p5");
  assert.equal(requests.filter((url) => url === pageUrls.get(4)!.toString()).length, unchangedPage4RequestCount);
  await writeCursor(savedBeforeDrift);

  // Restore the p4 continuation point in a fresh test generation and exercise row/queue/cursor/COMMIT rollback.
  await resetSource();
  pageBodies.set(1, savedP1);
  requests.length = 0;
  result = await collectSource(ID, { force: true });
  assert.equal(result.status, "ok", result.error ?? "fresh rollback-test generation failed");
  cursor = await readCursor();
  assert.equal(cursor.pagesCommitted, 2);
  result = await collectSource(ID, { force: true });
  assert.equal(result.status, "ok", result.error ?? "rollback-test p3 continuation failed");
  cursor = await readCursor();
  assert.deepEqual([cursor.pagesCommitted, cursor.nextPage], [3, 4]);
  // Establish p4 through real commits; subsequent failures must replay this same target.
  const beforeRollbackRows = (await storedRows()).length;
  pageBodies.set(1, savedP1);
  pageBodies.set(4, pageFromFixture(4, "rollback", 50));

  // First ensure a failed material write rolls back the current page and leaves p4 replayable.
  const articleFailure = "qa_gov_resume_article_failure";
  await createTrigger(articleFailure, `IF TG_OP = 'INSERT' AND NEW.source_id = '${ID}' AND NEW.url LIKE '%content_resume_rollback_3.htm' THEN RAISE EXCEPTION 'synthetic GovCN page material failure'; END IF; RETURN NEW;`);
  await sql.unsafe(`CREATE TRIGGER ${articleFailure}_trigger BEFORE INSERT ON articles FOR EACH ROW EXECUTE FUNCTION ${articleFailure}()`);
  const attemptStart = requests.length;
  result = await collectSource(ID, { force: true });
  assert.equal(result.status, "failed");
  assert.deepEqual(requests.slice(attemptStart), [pageUrls.get(1)!.toString(), pageUrls.get(4)!.toString()]);
  cursor = await readCursor();
  assert.deepEqual([cursor.pagesCommitted, cursor.nextPage], [3, 4]);
  assert.equal((await storedRows()).length, beforeRollbackRows, "mid-page material failure rolls back every p4 article");
  await dropTrigger(articleFailure, "articles");

  // Queue failures share the same page transaction as material and cursor writes.
  const queueFailure = "qa_gov_resume_queue_failure";
  await createTrigger(queueFailure, `IF EXISTS (SELECT 1 FROM articles WHERE id = NEW.data->>'articleId' AND source_id = '${ID}' AND url LIKE '%content_resume_rollback_%') THEN RAISE EXCEPTION 'synthetic GovCN queue failure'; END IF; RETURN NEW;`);
  await sql.unsafe(`CREATE TRIGGER ${queueFailure}_trigger BEFORE INSERT ON pgboss.job FOR EACH ROW EXECUTE FUNCTION ${queueFailure}()`);
  result = await collectSource(ID, { force: true });
  assert.equal(result.status, "failed");
  assert.equal((await storedRows()).length, beforeRollbackRows, "queue insertion failure rolls back page articles and revisions");
  cursor = await readCursor();
  assert.deepEqual([cursor.pagesCommitted, cursor.nextPage], [3, 4]);
  await dropTrigger(queueFailure, "pgboss.job");

  // A cursor checkpoint failure must undo the page's material and queue rows.
  const cursorFailure = "qa_gov_resume_cursor_failure";
  await createTrigger(cursorFailure, `IF NEW.id = '${ID}' AND NEW.cursor->'${GOVCN_JSON_RESUME_CURSOR_KEY}'->>'pagesCommitted' = '4' THEN RAISE EXCEPTION 'synthetic GovCN cursor checkpoint failure'; END IF; RETURN NEW;`);
  await sql.unsafe(`CREATE TRIGGER ${cursorFailure}_trigger BEFORE UPDATE OF cursor ON sources FOR EACH ROW EXECUTE FUNCTION ${cursorFailure}()`);
  result = await collectSource(ID, { force: true });
  assert.equal(result.status, "failed");
  assert.equal((await storedRows()).length, beforeRollbackRows, "cursor failure rolls back all p4 material and queue writes");
  cursor = await readCursor();
  assert.deepEqual([cursor.pagesCommitted, cursor.nextPage], [3, 4]);
  await dropTrigger(cursorFailure, "sources");

  // A deferred fetch_run constraint fails at COMMIT after page SQL has succeeded.
  const commitFailure = "qa_gov_resume_commit_failure";
  await createTrigger(commitFailure, `IF NEW.source_id = '${ID}' AND NEW.detail->>'pagesCommitted' = '4' THEN RAISE EXCEPTION 'synthetic GovCN deferred commit failure'; END IF; RETURN NEW;`);
  await sql.unsafe(`CREATE CONSTRAINT TRIGGER ${commitFailure}_trigger AFTER UPDATE ON fetch_runs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${commitFailure}()`);
  result = await collectSource(ID, { force: true });
  assert.equal(result.status, "failed");
  assert.equal((await storedRows()).length, beforeRollbackRows, "deferred COMMIT failure rolls back page materials and queued jobs");
  cursor = await readCursor();
  assert.deepEqual([cursor.pagesCommitted, cursor.nextPage], [3, 4]);
  await dropTrigger(commitFailure, "fetch_runs");

  // Identical p4 replay now succeeds exactly once; prior committed pages survive every failure.
  result = await collectSource(ID, { force: true });
  assert.equal(result.status, "ok", result.error ?? "p4 replay failed");
  cursor = await readCursor();
  assert.deepEqual([cursor.pagesCommitted, cursor.nextPage], [4, 5]);
  assert.equal((await storedRows()).length, beforeRollbackRows + 5);
  assert.equal((await sql`SELECT count(*)::int AS n FROM fetch_runs WHERE source_id = ${ID} AND status = 'failed'`).at(0)?.n, 4,
    "failed page attempts remain visible in fetch_runs while later replay succeeds");
  assert.equal((await sql`SELECT count(*)::int AS n FROM analyses a JOIN articles x ON x.id = a.article_id WHERE x.source_id = ${ID}`).at(0)?.n, 0);
  assert.equal((await sql`SELECT count(*)::int AS n FROM receipts WHERE subject IN (SELECT 'article:' || id FROM articles WHERE source_id = ${ID})`).at(0)?.n, 0);
  assert.ok((await sql`SELECT count(*)::int AS n FROM publications WHERE article_id IN (SELECT id FROM articles WHERE source_id = ${ID})`).at(0)?.n === 0);

  // Every semantic-hash input is rechecked in the page transaction after a concurrent source edit.
  const metadataDrifts: Array<{ field: "tier" | "participation_mode" | "first_party"; value: string; label: string }> = [
    { field: "tier", value: "'T2'", label: "tier" },
    { field: "participation_mode", value: "'editorial'", label: "participation" },
    { field: "first_party", value: "false", label: "first-party" },
  ];
  for (const drift of metadataDrifts) {
    await resetSource();
    pageBodies.set(1, savedP1);
    pageBodies.set(3, pageFromFixture(3, `${drift.label}-drift`, 12));
    requests.length = 0;
    result = await collectSource(ID, { force: true });
    assert.equal(result.status, "ok", result.error ?? `${drift.label} drift generation initialization failed`);
    const beforeDriftRows = (await storedRows()).length;
    beforeListReply = { page: 3, run: async () => {
      await sql.unsafe(`UPDATE sources SET ${drift.field} = ${drift.value} WHERE id = '${ID}'`);
    } };
    result = await collectSource(ID, { force: true });
    assert.equal(result.status, "failed", `${drift.label} drift after list dispatch fails closed`);
    cursor = await readCursor();
    assert.equal(cursor.pagesCommitted, 2, `${drift.label} drift cannot advance the history cursor`);
    assert.equal((await storedRows()).length, beforeDriftRows, `${drift.label} drift rolls back uncommitted p3 materials`);
    assert.deepEqual(requests.slice(-2), [pageUrls.get(1)!.toString(), pageUrls.get(3)!.toString()]);
  }

  // Config/mode drift after a durable cursor is a hold and cannot dispatch even p1.
  await resetSource();
  pageBodies.set(1, savedP1);
  requests.length = 0;
  result = await collectSource(ID, { force: true });
  assert.equal(result.status, "ok", result.error ?? "mode-drift generation initialization failed");
  await sql`UPDATE sources SET config = ${sql.json({ ...sourceConfig, pagination: { mode: "govcn_query_v1", maxPagesPerRun: 2, maxDispatches: 7 } })} WHERE id = ${ID}`;
  const beforeModeDrift = requests.length;
  result = await collectSource(ID, { force: true });
  assert.equal(result.status, "failed");
  assert.equal(requests.length, beforeModeDrift, "removing the explicit resume mode causes zero further HTTP requests");
  cursor = await readCursor();
  assert.deepEqual([cursor.state, cursor.stopReason, cursor.pagesCommitted], ["config_changed", "config_changed", 2]);
  assert.equal(configured.enabled, false, "the catalog source stays disabled");
});
