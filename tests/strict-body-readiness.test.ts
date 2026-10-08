// Source-scoped automatic selection requires a confirmed non-empty body. These tests exercise the
// routing and revision boundary with local PostgreSQL rows only; they never start a worker/provider.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { tag } from "./setup.ts";
import { closeDb, sql } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { isBodyReady, requiresBodyReadinessHold, requiresBodyReadyForAutomaticSelection } from "@aihot/backend/content/body-readiness";
import { analyzeArticle, loadAnalyzeInput } from "@aihot/backend/editorial/analyze";
import { groupArticle } from "@aihot/backend/events/group";
import { processArticle, queueProcessing, requeueFailed, sweepUnprocessed } from "@aihot/backend/jobs/content";
import { QUEUES, stopBoss } from "@aihot/backend/jobs/queue";
import { publishArticle } from "@aihot/backend/publication/publish";
import { unsupportedConfig } from "@aihot/backend/sources/config-keys";

const T = tag();
const STRICT = `test-strict-body-routing-${T}`;
const LEGACY = `test-legacy-body-routing-${T}`;
const BODY = `Synthetic confirmed body for readiness recovery ${T}. `.repeat(8);

before(async () => {
  await sql`INSERT INTO sources (id, name, kind, config, tier, participation_mode, first_party, site_fulltext, syndicate_fulltext, enabled, next_fetch_at)
            VALUES (${STRICT}, ${`Strict readiness ${T}`}, 'web_list', ${sql.json({
              detail: { bodySelector: "#article" }, _aihot: { requireBodyReadyForAutomaticSelection: true },
            })}, 'T1', 'editorial', true, false, false, false, '2100-01-01')`;
  await sql`INSERT INTO sources (id, name, kind, config, tier, participation_mode, first_party, site_fulltext, syndicate_fulltext, enabled, next_fetch_at)
            VALUES (${LEGACY}, ${`Legacy readiness ${T}`}, 'rss', ${sql.json({})}, 'T1', 'editorial', true, false, false, false, '2100-01-01')`;
});

after(async () => {
  await stopBoss();
  await closeDb();
});

async function create(sourceId: string, suffix: string, bodyStatus: "pending" | "unconfirmed" | "none" | "ok", bodyText: string | null = null) {
  return upsertMaterial({
    sourceId,
    url: `https://example.test/${T}/${suffix}`,
    title: `Synthetic report ${T} ${suffix}`,
    excerpt: `Synthetic title-only excerpt ${T}`,
    bodyText,
    bodyStatus,
    raw: null,
    via: "fetch",
    publishedAt: new Date(),
  });
}

test("strict-body opt-in is exact boolean and body readiness requires nonblank confirmed text", async () => {
  const registry = JSON.parse(readFileSync(new URL("../industry/sources.json", import.meta.url), "utf8")) as { sources: Array<{ id: string; config?: Record<string, unknown> }> };
  const sources = registry.sources;
  assert.equal(sources.length, 46, "the verified-source catalogue size remains explicit");
  const accounting = sources.find((source) => source.id === "mof-accounting-notices");
  assert.equal((accounting?.config?._aihot as Record<string, unknown> | undefined)?.requireBodyReadyForAutomaticSelection, true,
    "the accounting source is the exact central-source exception");
  for (const id of ["fujian-finance-notices", "mof-budget-work", "mof-finance-notices"]) {
    const source = sources.find((entry) => entry.id === id);
    assert.equal((source?.config?._aihot as Record<string, unknown> | undefined)?.requireBodyReadyForAutomaticSelection, true,
      `${id} is an exact central-source exception`);
  }
  const fujian = sources.find((source) => source.id === "mof-fujian-supervision-dynamics");
  assert.equal((fujian?.config?._aihot as Record<string, unknown> | undefined)?.requireBodyReadyForAutomaticSelection, true);
  assert.deepEqual(sources.filter((source) => ((source.config?._aihot as Record<string, unknown> | undefined)?.requireBodyReadyForAutomaticSelection) === true)
    .map((source) => source.id).sort(), [
      "fujian-finance-notices",
      "mof-accounting-notices",
      "mof-anhui-supervision-dynamics",
      "mof-beijing-supervision-dynamics",
      "mof-budget-work",
      "mof-chongqing-supervision-dynamics",
      "mof-dalian-supervision-dynamics",
      "mof-finance-notices",
      "mof-fujian-supervision-dynamics",
      "mof-gansu-supervision-dynamics",
      "mof-guangdong-supervision-dynamics",
      "mof-guangxi-supervision-dynamics",
      "mof-guizhou-supervision-dynamics",
      "mof-hainan-supervision-dynamics",
      "mof-hebei-supervision-dynamics",
      "mof-heilongjiang-supervision-dynamics",
      "mof-henan-supervision-dynamics",
      "mof-hubei-supervision-dynamics",
      "mof-hunan-supervision-dynamics",
      "mof-inner-mongolia-supervision-dynamics",
      "mof-jiangsu-supervision-dynamics",
      "mof-jiangxi-supervision-dynamics",
      "mof-jilin-supervision-dynamics",
      "mof-liaoning-supervision-dynamics",
      "mof-ningbo-supervision-dynamics",
      "mof-ningxia-supervision-dynamics",
      "mof-qingdao-supervision-dynamics",
      "mof-qinghai-supervision-dynamics",
      "mof-shaanxi-supervision-dynamics",
      "mof-shandong-supervision-dynamics",
      "mof-shanghai-supervision-dynamics",
      "mof-shanxi-supervision-dynamics",
      "mof-shenzhen-supervision-dynamics",
      "mof-sichuan-supervision-dynamics",
      "mof-tianjin-supervision-dynamics",
      "mof-xiamen-supervision-dynamics",
      "mof-xinjiang-supervision-dynamics",
      "mof-yunnan-supervision-dynamics",
      "mof-zhejiang-supervision-dynamics",
    ], "the opt-in remains limited to thirty-five reviewed supervision sources plus four exact non-regional exceptions");

  assert.equal(requiresBodyReadyForAutomaticSelection({}), false);
  assert.equal(requiresBodyReadyForAutomaticSelection({ _aihot: { requireBodyReadyForAutomaticSelection: false } }), false);
  assert.equal(requiresBodyReadyForAutomaticSelection({ _aihot: { requireBodyReadyForAutomaticSelection: "true" } }), false);
  assert.deepEqual(unsupportedConfig("web_list", { _aihot: { requireBodyReadyForAutomaticSelection: true } }), []);
  assert.ok(unsupportedConfig("web_list", { _aihot: { requireBodyReadyForAutomaticSelection: "true" } }).some((error) => /must be boolean/.test(error)));

  assert.equal(isBodyReady("ok", "confirmed synthetic article body"), true);
  for (const [status, body] of [["pending", "body"], ["unconfirmed", "body"], ["none", "body"], ["ok", " \t\n\u00a0\u3000 "]] as const) {
    assert.equal(isBodyReady(status, body), false);
    assert.equal(requiresBodyReadinessHold({ _aihot: { requireBodyReadyForAutomaticSelection: true } }, status, body), true);
  }
  assert.equal(requiresBodyReadinessHold({ _aihot: { requireBodyReadyForAutomaticSelection: false } }, "unconfirmed", null), false);
});

test("strict unconfirmed rows cannot enter auto analysis or retry queues, while pending and legacy routes remain intact", async () => {
  const held = await create(STRICT, "unconfirmed", "unconfirmed");
  const pending = await create(STRICT, "pending", "pending");
  const whitespaceOnly = await create(STRICT, "whitespace-only", "ok", " \t\n\u00a0\u3000 ");
  const legacy = await create(LEGACY, "legacy", "unconfirmed");

  assert.equal(await queueProcessing(whitespaceOnly.articleId), null, "an ok status with JS-trim-empty content remains held");
  assert.deepEqual(await processArticle(whitespaceOnly.articleId), { state: "waiting-body" });
  await publishArticle(whitespaceOnly.articleId);
  const [whitespacePublication] = await sql<{ body_mode: string; selected: boolean }[]>`
    SELECT body_mode, selected FROM publications WHERE article_id = ${whitespaceOnly.articleId}`;
  assert.deepEqual(whitespacePublication, { body_mode: "summary", selected: false }, "the SQL publication gate matches JS trim semantics");

  await sql`UPDATE articles SET created_at = now() - interval '10 minutes', processing_state = 'new', processing_queued_at = NULL,
                       processing_retry_at = NULL, processing_error = NULL WHERE id = ${held.articleId}`;
  await sql`INSERT INTO analyses (article_id, input_revision, origin, relevance, category, title_zh, summary_zh, reason_zh, score, selected)
            VALUES (${held.articleId}, 1, 'rule', 'pass', 'fiscal-policy', '合成标题', '合成摘要', '旧自动理由', 88, true)`;

  const input = await loadAnalyzeInput(held.articleId);
  assert.equal(input?.bodyReadinessPending, true);
  const beforeCounts = await sql<{ analyses: number; receipts: number }[]>`
    SELECT (SELECT count(*)::int FROM analyses WHERE article_id = ${held.articleId}) AS analyses,
           (SELECT count(*)::int FROM receipts) AS receipts`;
  const result = await analyzeArticle(held.articleId);
  assert.equal(result?.skippedReason, "body_not_ready");
  assert.equal(result?.analysisId, null);
  assert.deepEqual(await groupArticle(held.articleId), { verdict: "skipped", reason: "body_not_ready" },
    "a strict unconfirmed article cannot reach automatic event grouping");
  assert.deepEqual(await processArticle(held.articleId, { attemptTag: `retry-${T}` }), { state: "waiting-body" });
  assert.equal(await queueProcessing(held.articleId, { step: "analyze", attemptTag: `retry-${T}` }), null,
    "unconfirmed strict material is not sent to analyze or repeatedly extracted");

  const afterCounts = await sql<{ analyses: number; receipts: number }[]>`
    SELECT (SELECT count(*)::int FROM analyses WHERE article_id = ${held.articleId}) AS analyses,
           (SELECT count(*)::int FROM receipts) AS receipts`;
  assert.deepEqual(afterCounts[0], beforeCounts[0], "the hold creates neither a model analysis nor a provider receipt");
  assert.equal((await sql`SELECT 1 FROM pgboss.job WHERE data->>'articleId' = ${held.articleId}`).length, 0);

  // Even an explicit analyze step/attempt tag cannot bypass the pending body's one extraction route.
  await processArticle(pending.articleId, { attemptTag: `pending-${T}` });
  await queueProcessing(pending.articleId, { step: "analyze", attemptTag: `pending-explicit-${T}` });
  const pendingJobs = await sql<{ name: string }[]>`SELECT name FROM pgboss.job WHERE data->>'articleId' = ${pending.articleId}`;
  assert.ok(pendingJobs.length >= 1);
  assert.ok(pendingJobs.every((job) => job.name === QUEUES.extractBody), "pending strict rows route only to extraction");

  const legacyJob = await queueProcessing(legacy.articleId);
  assert.ok(legacyJob, "absent opt-in keeps the legacy automatic route");
  const legacyJobs = await sql<{ name: string }[]>`SELECT name FROM pgboss.job WHERE data->>'articleId' = ${legacy.articleId}`;
  assert.ok(legacyJobs.some((job) => job.name === QUEUES.analyze));

  const swept = await sweepUnprocessed();
  assert.equal(swept.enqueued, 0, "the already queued pending item and held unconfirmed item need no safety-net enqueue");
  assert.equal((await sql`SELECT 1 FROM pgboss.job WHERE data->>'articleId' = ${held.articleId}`).length, 0,
    "the sweeper leaves strict unconfirmed material alone");

  await sql`UPDATE articles SET processing_state = 'failed', discovered_at = now(), processing_error = 'synthetic readiness failure'
            WHERE id = ${held.articleId}`;
  const requeued = await requeueFailed(null);
  assert.equal(requeued.requeued, 0, "failed-job recovery excludes strict nonpending body holds");
  const [heldState] = await sql<{ processing_state: string }[]>`SELECT processing_state FROM articles WHERE id = ${held.articleId}`;
  assert.equal(heldState?.processing_state, "failed");
});

test("a synthetic confirmed body advances the revision and releases routing without reviving stale analysis", async () => {
  const item = await create(STRICT, "recovery", "pending");
  await sql`INSERT INTO analyses (article_id, input_revision, origin, relevance, category, title_zh, summary_zh, reason_zh, score, selected)
            VALUES (${item.articleId}, 1, 'rule', 'pass', 'fiscal-policy', '合成标题', '旧合成摘要', '旧自动理由', 91, true)`;

  const recovered = await upsertMaterial({
    sourceId: STRICT,
    url: `https://example.test/${T}/recovery`,
    title: `Synthetic report ${T} recovery`,
    excerpt: `Synthetic title-only excerpt ${T}`,
    bodyText: BODY,
    bodyStatus: "ok",
    via: "fetch",
    publishedAt: new Date(),
  });
  assert.equal(recovered.articleId, item.articleId);
  assert.equal(recovered.revised, true);
  const [current] = await sql<{ revision: number; body_status: string; body_text: string; selected: boolean | null }[]>`
    SELECT a.revision, a.body_status, a.body_text, an.selected FROM articles a
    LEFT JOIN analyses an ON an.article_id = a.id AND an.input_revision = a.revision WHERE a.id = ${item.articleId}`;
  assert.equal(current?.revision, 2);
  assert.equal(current?.body_status, "ok");
  assert.equal(current?.body_text, BODY);
  assert.equal(current?.selected, null, "revision-1 selection is stale and cannot select revision 2");
  assert.ok(await queueProcessing(item.articleId), "confirmed body returns to ordinary analysis routing");
  const jobs = await sql<{ name: string }[]>`SELECT name FROM pgboss.job WHERE data->>'articleId' = ${item.articleId}`;
  assert.ok(jobs.some((job) => job.name === QUEUES.analyze));
  assert.ok(!jobs.some((job) => job.name === QUEUES.extractBody));
});
