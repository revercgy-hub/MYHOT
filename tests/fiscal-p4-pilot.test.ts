import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertTestDatabaseName, budgetSnapshot, buildProviderPlan, evaluatePilotRecords, freezeManifest, parseArticleIds,
  type PilotArticleRow, type PilotBudget, type PilotJobRow, type PilotReceiptIssue,
} from "../scripts/fiscal/p4-pilot.ts";

const hash = "a".repeat(64);
function row(overrides: Partial<PilotArticleRow> = {}): PilotArticleRow {
  return {
    id: "article-1", title: "财政部政策通知", url: "https://example.gov.cn/article/1", revision: 2, content_hash: hash,
    revision_content_hash: hash, body_status: "ok", body_chars: 420, source_id: "mof-test", source_name: "财政部测试源",
    source_enabled: false, source_kind: "web_list", source_tier: "T1", participation_mode: "editorial", processing_state: "analyzed",
    processing_queued_at: null, processing_retry_at: null, processing_attempts: 0,
    latest_analysis_revision: 1, latest_analysis_origin: "model", latest_analysis_prompt_version: "old", latest_analysis_model: "glm-5.3-flash",
    ...overrides,
  };
}

test("P4 audit accepts only explicit bounded IDs and only *_test database URLs", () => {
  assert.deepEqual(parseArticleIds(" article-1, second_2 "), ["article-1", "second_2"]);
  for (const value of ["", "a,,b", "x".repeat(81), "a,a", Array.from({ length: 51 }, (_, i) => `a${i}`).join(",")]) {
    assert.throws(() => parseArticleIds(value));
  }
  assert.equal(assertTestDatabaseName("postgres://127.0.0.1:5432/fiscalhot_p4_test"), "fiscalhot_p4_test");
  assert.equal(assertTestDatabaseName("postgresql://localhost:5432/fiscalhot_p4_test"), "fiscalhot_p4_test");
  assert.equal(assertTestDatabaseName("postgres://[::1]:5432/fiscalhot_p4_test"), "fiscalhot_p4_test");
  for (const value of [
    "postgres://127.0.0.1:5432/fiscalhot", "postgres://127.0.0.1:5432/fiscalhot_ci", "not-a-url",
    "postgres://db.example.org:5432/fiscalhot_p4_test", "postgres:///fiscalhot_p4_test", "https://127.0.0.1/fiscalhot_p4_test",
  ]) {
    assert.throws(() => assertTestDatabaseName(value));
  }
});

test("record audit requires exact body, hash/revision, editorial source, and no pending job or receipt", () => {
  const base = row();
  const ids = [base.id, "missing", "bad-body", "bad-hash", "bad-revision", "jobbed", "receipt", "retry", "non-editorial"];
  const rows = [
    base,
    row({ id: "bad-body", body_status: "unconfirmed" }),
    row({ id: "bad-hash", content_hash: null }),
    row({ id: "bad-revision", revision_content_hash: "b".repeat(64) }),
    row({ id: "jobbed" }),
    row({ id: "receipt" }),
    row({ id: "retry", processing_attempts: 1 }),
    row({ id: "non-editorial", participation_mode: "hot_signal" }),
  ];
  const jobs: PilotJobRow[] = [{ article_id: "jobbed", name: "content.analyze", state: "active" }];
  const issues: PilotReceiptIssue[] = [{ subject: "article:receipt@2", status: "unknown" }];
  const records = evaluatePilotRecords(ids, rows, jobs, issues, false);
  assert.deepEqual(records.map((item) => item.accepted), [true, false, false, false, false, false, false, false, false]);
  assert.deepEqual(records[1]!.rejectionReasons, ["article_id_not_found"]);
  assert.ok(records[2]!.rejectionReasons.includes("body_unconfirmed"));
  assert.ok(records[3]!.rejectionReasons.includes("content_hash_missing_or_invalid"));
  assert.ok(records[4]!.rejectionReasons.includes("revision_hash_mismatch"));
  assert.ok(records[5]!.rejectionReasons.includes("article_has_active_or_retry_job"));
  assert.ok(records[6]!.rejectionReasons.includes("article_has_unknown_receipt"));
  assert.ok(records[7]!.rejectionReasons.includes("article_has_legacy_retry_or_failed_state"));
  assert.ok(records[8]!.rejectionReasons.includes("source_not_editorial"));
  assert.equal(JSON.stringify(records).includes("正文内容"), false, "records do not contain body text");
});

test("disabled source is reviewable by explicit ID while a live worker blocks sweep-eligible new records", () => {
  const disabled = row({ source_enabled: false });
  const accepted = evaluatePilotRecords([disabled.id], [disabled], [], [], false)[0]!;
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.source.enabled, false);

  const fresh = row({ processing_state: "new" });
  const withWorker = evaluatePilotRecords([fresh.id], [fresh], [], [], true)[0]!;
  assert.equal(withWorker.accepted, false);
  assert.ok(withWorker.rejectionReasons.includes("active_worker_may_sweep_new_article"));
});

test("provider plan follows analyze branches and does not include grouping or publication calls", () => {
  const t1 = evaluatePilotRecords(["article-1"], [row()], [], [], false);
  const plan = buildProviderPlan(t1, []);
  assert.deepEqual(plan.map(({ stage, maxCallsPerArticle }) => [stage, maxCallsPerArticle]), [
    ["prefilter", 1], ["score", 2], ["structure", 1], ["understand", 1], ["summarize", 1],
  ]);
  assert.equal(plan.reduce((sum, item) => sum + item.maxCallsPerArticle, 0), 6, "includes one understand refusal fallback to summarize");
  assert.equal(plan.some((item) => ["group", "digest", "report"].includes(item.stage)), false);

  const excludedTier = row({ source_tier: "EXCLUDE_MP" });
  const noSelectionScore = buildProviderPlan(evaluatePilotRecords([excludedTier.id], [excludedTier], [], [], false), []);
  assert.deepEqual(noSelectionScore.map((item) => item.stage), ["prefilter", "structure", "summarize"]);
  assert.equal(noSelectionScore.reduce((sum, item) => sum + item.maxCallsPerArticle, 0), 3);
});

test("budget view is a non-reserving capacity snapshot with no asserted money estimate", () => {
  const plan = buildProviderPlan(evaluatePilotRecords(["article-1"], [row()], [], [], false), []);
  const service = plan[0]!.provider;
  const budgets: PilotBudget[] = [{ service, per_minute: 100, per_hour: 200, per_day: 300 }];
  const fits = budgetSnapshot(plan, 1, budgets, [{ service, minute: 1, hour: 2, day: 3 }]);
  assert.equal(fits[0]!.capacitySnapshot, "fits_current_snapshot_only");
  assert.equal(fits[0]!.amountEstimate, null);
  const exceeds = budgetSnapshot(plan, 100, budgets, [{ service, minute: 90, hour: 190, day: 290 }]);
  assert.equal(exceeds[0]!.capacitySnapshot, "exceeds_current_snapshot");
  const noBudget = budgetSnapshot(plan, 1, [], []);
  assert.equal(noBudget[0]!.capacitySnapshot, "unlimited_by_current_config");
});

test("manifest hash freezes metadata deterministically without adding body material", () => {
  const one = freezeManifest({ ids: ["article-1"], revision: 2, contentHash: hash, bodyStatus: "ok" });
  const same = freezeManifest({ bodyStatus: "ok", contentHash: hash, revision: 2, ids: ["article-1"] });
  const changed = freezeManifest({ ids: ["article-1"], revision: 3, contentHash: hash, bodyStatus: "ok" });
  assert.equal(one.manifestHash, same.manifestHash);
  assert.notEqual(one.manifestHash, changed.manifestHash);
  assert.equal(JSON.stringify(one).includes("正文"), false);
});
