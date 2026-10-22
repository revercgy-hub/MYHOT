import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { CATEGORIES, CATEGORY_TAGS, TOPIC_TAGS, ENTITY_TAGS } from "../industry/taxonomy.ts";
import { applyNativeSummaryImport, prepareNativeSummaryManifest, validateNativeSummaryQa,
  qaItemOutputSha, type NativeSummaryManifest, type NativeSummaryQa, type NativeSummaryPromptTools } from "../scripts/fiscal/nas-native-summary-import.ts";
import { publishArticleTx } from "../packages/backend/src/publication/publish.ts";
import * as writing from "../packages/backend/src/editorial/writing.ts";
import { promptVersion } from "../packages/backend/src/editorial/prompts.ts";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const taxonomy = { CATEGORIES, CATEGORY_TAGS, TOPIC_TAGS, ENTITY_TAGS };
const time = new Date("2026-10-22T00:00:00.000Z");
const promptTools: NativeSummaryPromptTools = { PREFILTER_SYSTEM: writing.PREFILTER_SYSTEM, prefilterUser: writing.prefilterUser,
  buildArticlePrompt: writing.buildArticlePrompt, translateInputOf: writing.translateInputOf, promptVersion };
const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value as object).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
};

function qaFor(manifest: NativeSummaryManifest, outcomes: Record<string, "PASS" | "BLOCK" | "UNKNOWN"> = {}): NativeSummaryQa {
  const items = manifest.rows.map((row) => {
    const label = outcomes[row.articleId] ?? "PASS";
    if (label !== "PASS") {
      const exclusionReason = label === "BLOCK" ? "正文明确为无关内部活动" : "正文内容不足以判断所属主题";
      const item = { articleId: row.articleId, inputBodySha256: row.bodyTextSha256,
        prefilterInputSha256: row.prompts.prefilterInputSha256, summaryInputSha256: null,
        prefilter: { label, reason: label === "BLOCK" ? "确认无业务相关事实" : "正文不足无法判断", outputSha256: "" },
        exclusionReason, outputSha256: "", selected: false as const, score: null, reason: null,
        relevance: label.toLowerCase() as "block" | "unknown", providerReceipt: null, providerPipelineExecuted: false as const };
      item.prefilter.outputSha256 = sha256(stableJson({ label: item.prefilter.label, reason: item.prefilter.reason }));
      item.outputSha256 = qaItemOutputSha(item);
      return item;
    }
    const item = { articleId: row.articleId, inputBodySha256: row.bodyTextSha256,
      prefilterInputSha256: row.prompts.prefilterInputSha256, summaryInputSha256: row.prompts.summaryInputSha256,
      prefilter: { label: "PASS" as const, reason: "正文包含预算业务事实", outputSha256: "" }, exclusionReason: null,
      titleZh: "财政部门发布预算执行工作进展", summaryZh: "财政部门公布预算执行工作的最新进展，明确后续管理安排。",
      category: "fiscal-policy", tags: ["政策发布", "预算管理"], selected: false as const, score: null,
      reason: null, relevance: "pass" as const, providerReceipt: null, providerPipelineExecuted: false as const,
      outputSha256: "" };
    item.prefilter.outputSha256 = sha256(stableJson({ label: item.prefilter.label, reason: item.prefilter.reason }));
    item.outputSha256 = qaItemOutputSha(item);
    return item;
  });
  return { schemaVersion: "fiscal.nas-native-summary-qa.v1", result: "PASS_NATIVE_SUMMARY_QA", independent: true,
    isGold: false, manifestSha256: sha256(JSON.stringify(manifest, null, 2) + "\n"), reviewer: "independent-qa-fixture", reviewedAt: time.toISOString(),
    native: { requestedModel: "local-model-fixture", sessionId: "native-session-fixture", generatedAt: time.toISOString(),
      executionKind: "native-offline-not-runtime-provider", providerReceipt: null, providerPipelineExecuted: false }, items };
}

test("native summary QA binds body/output hashes and rejects selected or provider execution claims", () => {
  const manifest: NativeSummaryManifest = { schemaVersion: "fiscal.nas-native-summary-manifest.v1", database: "fiscalhot_fake_test",
    preparedAt: time.toISOString(), promptVersions: { prefilter: "prefilter@hash", summarize: "summarize@hash" },
    selection: { maxArticles: 30, ids: ["native-fixture-1"] }, rows: [{ articleId: "native-fixture-1",
      sourceId: "src", url: "https://example.test/a", title: "原始标题", publishedAt: null, revision: 1, contentHash: "hash",
      bodyText: "这是可用于独立摘要的正文。", bodyTextSha256: sha256("这是可用于独立摘要的正文。"), articleRowText: "{}",
      articleRowSha256: sha256("{}"), sourceRowText: "{}", sourceRowSha256: sha256("{}"), overrideRowText: null,
      overrideRowSha256: null, publicationRowText: null, publicationRowSha256: null, analysisCount: 0,
      nativeInput: { title: "原始标题", date: null, source: { name: "src", kind: "web_list", tier: "T1", firstParty: true, ownerEntityId: null },
        url: "https://example.test/a", body: "这是可用于独立摘要的正文。", bodySha256: sha256("这是可用于独立摘要的正文。"), sha256: "0".repeat(64) },
      prompts: { prefilterSystem: "prefilter", prefilterUser: "prefilter input", summarySystem: "", summaryUser: "summary input",
        prefilterUserSha256: sha256("prefilter input"), summaryUserSha256: sha256("summary input"),
        prefilterInputSha256: sha256("prefilter\u0000prefilter input"), summaryInputSha256: sha256("summary input") } }] };
  const qa = qaFor(manifest);
  validateNativeSummaryQa(manifest, qa.manifestSha256, qa, taxonomy);
  for (const mutate of [
    (copy: NativeSummaryQa) => { copy.items[0]!.selected = true as never; },
    (copy: NativeSummaryQa) => { copy.items[0]!.inputBodySha256 = "0".repeat(64); },
    (copy: NativeSummaryQa) => { copy.native.providerPipelineExecuted = true as never; },
    (copy: NativeSummaryQa) => { copy.items[0]!.category = "not-a-category"; },
  ]) {
    const invalid = structuredClone(qa); mutate(invalid);
    assert.throws(() => validateNativeSummaryQa(manifest, qa.manifestSha256, invalid, taxonomy));
  }
});

test("native summary importer projects first imports atomically and rejects stale row/source/override/safety state", async (t) => {
  const databaseUrl = process.env.NAS_NATIVE_SUMMARY_TEST_DATABASE_URL;
  if (!databaseUrl) return t.skip("requires a dedicated loopback fiscalhot_nas_native_summary_import_test database");
  const url = new URL(databaseUrl);
  const database = decodeURIComponent(url.pathname.slice(1));
  assert.equal(database, "fiscalhot_nas_native_summary_import_test", "only the dedicated disposable test DB is allowed");
  assert.ok(["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname));
  const sql = postgres(databaseUrl, { max: 1, idle_timeout: 5 });
  const prefix = `native_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const sourceIds = Array.from({ length: 48 }, (_, index) => `${prefix}_s${index}`);
  const articleIds = ["happy", "revision", "body", "source", "override", "fulltext", "batchfirst", "batchstale", "mixedpass", "mixedblock", "mixedunknown", "syndicatefulltext"].map((suffix) => `${prefix}_${suffix}`);
  const body = "财政部门发布预算管理信息，介绍预算执行进展和后续工作安排。";
  const contentHash = sha256(body);
  try {
    const existing = await sql`SELECT count(*)::int AS count FROM sources`;
    assert.equal(existing[0]?.count, 0, "dedicated DB must be migrated and have no source fixtures");
    await sql.begin(async (tx) => {
      for (const id of sourceIds) await tx`INSERT INTO sources (id,name,kind,config,tier,participation_mode,first_party,
          interval_minutes,site_fulltext,syndicate_fulltext,enabled,next_fetch_at)
        VALUES (${id},${`测试信源 ${id}`},'web_list','{}','T1','editorial',true,1440,false,false,false,'infinity')`;
      for (const [index, id] of articleIds.entries()) {
        const sourceId = sourceIds[index]!;
        await tx`INSERT INTO articles (id,source_id,identity_key,url,title,language,published_at,discovered_at,timeline_at,
          revision,content_hash,body_text,body_status) VALUES (${id},${sourceId},${`url:https://example.test/${id}`},
          ${`https://example.test/${id}`},${`原始财政标题 ${id}`},'zh',${time.toISOString()},${time.toISOString()},${time.toISOString()},1,${contentHash},${body},'ok')`;
        await tx`INSERT INTO article_revisions (article_id,revision,content_hash,title,body_text)
          VALUES (${id},1,${contentHash},${`原始财政标题 ${id}`},${body})`;
      }
    });

    const prepare = (id: string) => sql.begin((tx) => prepareNativeSummaryManifest(tx, [id], time, promptTools));
    const apply = async (manifest: NativeSummaryManifest, qa = qaFor(manifest)) => {
      const manifestSha = sha256(JSON.stringify(manifest, null, 2) + "\n");
      const qaSha = sha256(JSON.stringify(qa, null, 2) + "\n");
      return applyNativeSummaryImport(sql, manifest, qa, manifestSha, qaSha, taxonomy, publishArticleTx, time);
    };

    const happy = await prepare(articleIds[0]!);
    assert.equal((await apply(happy)).imported, 1);
    const projection = await sql`SELECT eligible,selected,title,summary,reason,category,tags,score,body_mode,syndicate,indexable
      FROM publications WHERE article_id=${articleIds[0]}`;
    assert.equal(projection.length, 1);
    assert.equal(projection[0]?.eligible, true);
    assert.equal(projection[0]?.selected, false);
    assert.equal(projection[0]?.title, "财政部门发布预算执行工作进展");
    assert.equal(projection[0]?.score, null);
    assert.equal(projection[0]?.reason, null);
    assert.equal(projection[0]?.body_mode, "summary");
    assert.equal(projection[0]?.syndicate, false);
    assert.equal(projection[0]?.indexable, false);
    const projectionSideEffects = await sql`SELECT
      (SELECT count(*)::int FROM pool_search WHERE article_id=${articleIds[0]}) AS pool_rows,
      (SELECT count(*)::int FROM selected_state WHERE article_id=${articleIds[0]}) AS selected_state_rows,
      (SELECT count(*)::int FROM selected_ledger WHERE article_id=${articleIds[0]}) AS selected_ledger_rows,
      (SELECT count(*)::int FROM analyses WHERE article_id=${articleIds[0]}) AS analyses,
      (SELECT count(*)::int FROM receipts WHERE subject=${articleIds[0]}) AS receipts,
      (SELECT count(*)::int FROM job_runs) AS job_runs,
      to_regclass('pgboss.job') IS NOT NULL AS has_pgboss`;
    assert.equal(projectionSideEffects[0]?.pool_rows, 1);
    assert.equal(projectionSideEffects[0]?.selected_state_rows, 0);
    assert.equal(projectionSideEffects[0]?.selected_ledger_rows, 0);
    assert.equal(projectionSideEffects[0]?.analyses, 0);
    assert.equal(projectionSideEffects[0]?.receipts, 0);
    assert.equal(projectionSideEffects[0]?.job_runs, 0);
    assert.equal(projectionSideEffects[0]?.has_pgboss, false);
    const audit = await sql`SELECT count(*)::int AS count FROM audit_log WHERE subject=${`content:${articleIds[0]}`} AND action='content.override'`;
    assert.equal(audit[0]?.count, 1);
    const sidecar = await sql`SELECT raw->'nativeSummaryImport' AS provenance FROM articles WHERE id=${articleIds[0]}`;
    assert.equal(sidecar[0]?.provenance.executionKind, "native-offline-not-runtime-provider");
    assert.equal(sidecar[0]?.provenance.providerPipelineExecuted, false);
    assert.equal(sidecar[0]?.provenance.providerReceipt, null);
    assert.equal(sidecar[0]?.provenance.isGold, false);

    const cases = [
      { id: articleIds[1]!, change: async (id: string) => { await sql`UPDATE articles SET revision=revision+1 WHERE id=${id}`; } },
      { id: articleIds[2]!, change: async (id: string) => { await sql`UPDATE articles SET body_text=body_text || '修订' WHERE id=${id}`; } },
      { id: articleIds[3]!, change: async () => { await sql`UPDATE sources SET name=name || '修订' WHERE id=${sourceIds[3]}`; } },
      { id: articleIds[4]!, change: async (id: string) => { await sql`INSERT INTO editorial_overrides(article_id,fields) VALUES (${id},'{}')`; } },
      { id: articleIds[5]!, change: async () => { await sql`UPDATE sources SET site_fulltext=true WHERE id=${sourceIds[5]}`; } },
      { id: articleIds[11]!, change: async () => { await sql`UPDATE sources SET syndicate_fulltext=true WHERE id=${sourceIds[11]}`; } },
    ];
    for (const item of cases) {
      const frozen = await prepare(item.id); await item.change(item.id);
      await assert.rejects(apply(frozen));
      const unchanged = await sql`SELECT count(*)::int AS count FROM editorial_overrides WHERE article_id=${item.id}`;
      const unpublished = await sql`SELECT count(*)::int AS count FROM publications WHERE article_id=${item.id}`;
      if (item.id !== articleIds[4]!) assert.equal(unchanged[0]?.count, 0, `override rolled back for ${item.id}`);
      assert.equal(unpublished[0]?.count, 0, `publication rolled back for ${item.id}`);
      if (item.id === articleIds[5]!) await sql`UPDATE sources SET site_fulltext=false WHERE id=${sourceIds[5]}`;
      if (item.id === articleIds[11]!) await sql`UPDATE sources SET syndicate_fulltext=false WHERE id=${sourceIds[11]}`;
    }
    await sql`UPDATE articles SET body_status='pending' WHERE id=${articleIds[6]}`;
    await assert.rejects(prepare(articleIds[6]!), /body-ready/u);
    await sql`UPDATE articles SET body_status='ok' WHERE id=${articleIds[6]}`;
    await sql`UPDATE sources SET name=${`测试信源 ${sourceIds[3]}`} WHERE id=${sourceIds[3]}`;
    const batch = await sql.begin((tx) => prepareNativeSummaryManifest(tx, [articleIds[6]!, articleIds[7]!], time, promptTools));
    await sql`UPDATE articles SET revision=revision+1 WHERE id=${articleIds[7]}`;
    await assert.rejects(apply(batch), /exact CAS failed/u);
    const batchState = await sql`SELECT count(*)::int AS overrides,
      (SELECT count(*)::int FROM publications WHERE article_id=ANY(${sql.array([articleIds[6]!, articleIds[7]!], 1009)})) AS publications
      FROM editorial_overrides WHERE article_id=ANY(${sql.array([articleIds[6]!, articleIds[7]!], 1009)})`;
    assert.equal(batchState[0]?.overrides, 0, "first row override must roll back when the second row is stale");
    assert.equal(batchState[0]?.publications, 0, "first row publication must roll back when the second row is stale");
    const mixed = await sql.begin((tx) => prepareNativeSummaryManifest(tx, [articleIds[8]!, articleIds[9]!, articleIds[10]!], time, promptTools));
    const mixedResult = await apply(mixed, qaFor(mixed, { [articleIds[9]!]: "BLOCK", [articleIds[10]!]: "UNKNOWN" }));
    assert.equal(mixedResult.imported, 1);
    assert.deepEqual(mixedResult.articleIds, [articleIds[8]!]);
    assert.deepEqual(mixedResult.excluded, [
      { articleId: articleIds[9]!, prefilterLabel: "BLOCK", reason: "正文明确为无关内部活动" },
      { articleId: articleIds[10]!, prefilterLabel: "UNKNOWN", reason: "正文内容不足以判断所属主题" },
    ]);
    assert.equal((await sql`SELECT count(*)::int AS count FROM publications WHERE article_id=${articleIds[9]}`)[0]?.count, 0);
    assert.equal((await sql`SELECT count(*)::int AS count FROM editorial_overrides WHERE article_id=${articleIds[9]}`)[0]?.count, 0);
    assert.equal((await sql`SELECT count(*)::int AS count FROM publications WHERE article_id=${articleIds[10]}`)[0]?.count, 0);
    assert.equal((await sql`SELECT count(*)::int AS count FROM editorial_overrides WHERE article_id=${articleIds[10]}`)[0]?.count, 0);
    await sql`UPDATE sources SET site_fulltext=true WHERE id=${sourceIds[0]}`;
    await assert.rejects(sql.begin((tx) => prepareNativeSummaryManifest(tx, [articleIds[6]!], time, promptTools)), /full-text flags off/u);
  } finally {
    await sql`DELETE FROM articles WHERE id=ANY(${sql.array(articleIds, 1009)})`;
    await sql`DELETE FROM audit_log WHERE subject LIKE ${`content:${prefix}%`}`;
    await sql`DELETE FROM sources WHERE id=ANY(${sql.array(sourceIds, 1009)})`;
    await sql.end();
  }
});
