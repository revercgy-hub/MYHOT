import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { createP4QualityReviewResultsTemplate, validateP4QualityReviewResults } from "../scripts/fiscal/p4-quality-review-results.ts";

const repo = path.resolve(import.meta.dirname, "..");
const report = {
  schema: "fiscal-p4-bounded-execution/v1", runHash: "b".repeat(64),
  rows: [{ id: "synthetic-article-1", sourceId: "synthetic-source-1", revision: 2, contentHash: "a".repeat(64), result: "analyzed", analysisId: 42, receiptIds: [901], selected: true, relevance: "pass" }],
};
const metadata = {
  schema: "fiscal-p4-quality-review-metadata/v1",
  articles: [{ articleId: "synthetic-article-1", sourceId: "synthetic-source-1", revision: 2, contentHash: "a".repeat(64), analysisId: 42,
    article: { title: "Synthetic", url: "https://example.invalid", publishedAt: "2026-10-10T00:00:00Z", bodyText: "FORBIDDEN_BODY_MARKER", apiKey: "FORBIDDEN_SECRET_MARKER" },
    analysis: { summaryZh: "synthetic summary", rawReceipt: "FORBIDDEN_RECEIPT_MARKER" } }],
};

function completeResults() {
  const value = createP4QualityReviewResultsTemplate(report, metadata) as any;
  value.reviews[0].reviewer = "Synthetic reviewer";
  value.reviews[0].reviewedAt = "2026-10-10T10:00:00+08:00";
  value.reviews[0].dimensions = {
    facts: { judgment: "partially_wrong", reason: "合成理由：主体名称缺少限定词。" },
    contentType: { judgment: "accurate", reason: null },
    taxonomy: { judgment: "wrong", reason: "合成理由：主题分类不符。" },
    scoring: { judgment: "too_high", reason: "合成理由：评分高于人工判断。" },
  };
  return value;
}

test("creates a blank identity-bound template and keeps validation incomplete without issues", () => {
  const template = createP4QualityReviewResultsTemplate(report, metadata) as any;
  assert.equal(template.runHash, report.runHash);
  assert.deepEqual(template.reviews[0].dimensions.facts, { judgment: null, reason: null });
  assert.equal(template.reviews[0].reviewer, null);
  assert.equal(template.reviews[0].reviewedAt, null);
  const ledger = validateP4QualityReviewResults(report, metadata, template) as any;
  assert.equal(ledger.status, "DRAFT_INCOMPLETE");
  assert.equal(ledger.pendingReviewCount, 1);
  assert.deepEqual(ledger.qualityIssues, []);
  assert.equal(ledger.systemClustering, "NOT_RUN");
  assert.equal(Object.hasOwn(ledger, "metrics"), false);
});

test("keeps valid partial human entries in an incomplete draft while withholding issues", () => {
  const draft = createP4QualityReviewResultsTemplate(report, metadata) as any;
  draft.reviews[0].reviewer = "Synthetic reviewer";
  draft.reviews[0].dimensions.facts = { judgment: "wrong", reason: "合成部分填写理由" };
  const ledger = validateP4QualityReviewResults(report, metadata, draft) as any;
  assert.equal(ledger.status, "DRAFT_INCOMPLETE");
  assert.equal(ledger.pendingReviewCount, 1);
  assert.deepEqual(ledger.qualityIssues, []);
  assert.equal(ledger.reviews[0].reviewer, "Synthetic reviewer");
  assert.deepEqual(ledger.reviews[0].dimensions.facts, { judgment: "wrong", reason: "合成部分填写理由" });
  assert.equal(/FORBIDDEN/.test(JSON.stringify(ledger)), false);
});

test("emits structured quality issues only for a complete synthetic human review", () => {
  const ledger = validateP4QualityReviewResults(report, metadata, completeResults()) as any;
  assert.equal(ledger.status, "REVIEW_COMPLETE");
  assert.equal(ledger.pendingReviewCount, 0);
  assert.deepEqual(ledger.qualityIssues.map((issue: any) => [issue.dimension, issue.judgment]), [
    ["facts", "partially_wrong"], ["taxonomy", "wrong"], ["scoring", "too_high"],
  ]);
  assert.equal(ledger.qualityIssues[0].analysisId, 42);
  assert.equal(ledger.qualityIssues[0].runHash, report.runHash);
  assert.equal(ledger.systemClustering, "NOT_RUN");
  assert.equal(Object.hasOwn(ledger, "goldDecision"), false);
  assert.equal(Object.hasOwn(ledger, "threshold"), false);
});

test("REVIEW_COMPLETE preserves accurate and unable-to-judge decisions for audit without implying a pass", () => {
  const results = completeResults() as any;
  results.reviews[0].dimensions = {
    facts: { judgment: "accurate", reason: null },
    contentType: { judgment: "unable_to_judge", reason: "合成：正文不足以判断。" },
    taxonomy: { judgment: "accurate", reason: null },
    scoring: { judgment: "unable_to_judge", reason: "合成：信息不足以评估分数。" },
  };
  const ledger = validateP4QualityReviewResults(report, metadata, results) as any;
  assert.equal(ledger.status, "REVIEW_COMPLETE");
  assert.deepEqual(ledger.qualityIssues, []);
  assert.equal(ledger.reviews[0].reviewer, "Synthetic reviewer");
  assert.equal(ledger.reviews[0].reviewedAt, "2026-10-10T10:00:00+08:00");
  assert.deepEqual(ledger.reviews[0].dimensions, results.reviews[0].dimensions);
  assert.equal(Object.hasOwn(ledger, "qualityPassed"), false);
});

test("rejects changed, duplicate, missing, or extra review identities", () => {
  const complete = completeResults();
  const wrong = structuredClone(complete); wrong.reviews[0].analysisId += 1;
  assert.throws(() => validateP4QualityReviewResults(report, metadata, wrong), /identity does not match/);
  const duplicate = structuredClone(complete); duplicate.reviews.push(duplicate.reviews[0]);
  assert.throws(() => validateP4QualityReviewResults(report, metadata, duplicate), /duplicate articleId/);
  const missing = structuredClone(complete); missing.reviews = [];
  assert.throws(() => validateP4QualityReviewResults(report, metadata, missing), /same article rows/);
  const extra = structuredClone(complete); extra.reviews[0].articleId = "unrelated";
  assert.throws(() => validateP4QualityReviewResults(report, metadata, extra), /absent from the execution report/);
  const mismatchedRun = structuredClone(complete); mismatchedRun.runHash = "c".repeat(64);
  assert.throws(() => validateP4QualityReviewResults(report, metadata, mismatchedRun), /runHash does not match/);
});

test("rejects invalid judgments, missing issue reasons, and timestamps without an explicit timezone", () => {
  const badJudgment = completeResults(); badJudgment.reviews[0].dimensions.facts.judgment = "maybe";
  assert.throws(() => validateP4QualityReviewResults(report, metadata, badJudgment), /judgment is invalid/);
  const noReason = completeResults(); noReason.reviews[0].dimensions.taxonomy.reason = null;
  assert.throws(() => validateP4QualityReviewResults(report, metadata, noReason), /reason is required/);
  const noTimezone = completeResults(); noTimezone.reviews[0].reviewedAt = "2026-10-10T10:00:00";
  assert.throws(() => validateP4QualityReviewResults(report, metadata, noTimezone), /explicit timezone/);
  const nonexistentDay = completeResults(); nonexistentDay.reviews[0].reviewedAt = "2026-02-30T10:00:00Z";
  assert.throws(() => validateP4QualityReviewResults(report, metadata, nonexistentDay), /valid ISO timestamp/);
  const nonLeapDay = completeResults(); nonLeapDay.reviews[0].reviewedAt = "2026-02-29T10:00:00Z";
  assert.throws(() => validateP4QualityReviewResults(report, metadata, nonLeapDay), /valid ISO timestamp/);
  const invalidOffset = completeResults(); invalidOffset.reviews[0].reviewedAt = "2026-10-10T10:00:00+14:01";
  assert.throws(() => validateP4QualityReviewResults(report, metadata, invalidOffset), /valid ISO timestamp/);
  const leapDay = completeResults(); leapDay.reviews[0].reviewedAt = "2024-02-29T10:00:00Z";
  assert.equal((validateP4QualityReviewResults(report, metadata, leapDay) as any).status, "REVIEW_COMPLETE");
});

test("outputs only whitelisted review fields and excludes unknown/body/receipt/secret data", () => {
  const input = completeResults() as any;
  input.apiKey = "FORBIDDEN_TOP_SECRET";
  input.reviews[0].unexpected = "FORBIDDEN_UNKNOWN_MARKER";
  input.reviews[0].dimensions.facts.extra = "FORBIDDEN_DIMENSION_MARKER";
  const serialized = JSON.stringify(validateP4QualityReviewResults(report, metadata, input));
  for (const marker of ["FORBIDDEN_TOP_SECRET", "FORBIDDEN_UNKNOWN_MARKER", "FORBIDDEN_DIMENSION_MARKER", "FORBIDDEN_BODY_MARKER", "FORBIDDEN_SECRET_MARKER", "FORBIDDEN_RECEIPT_MARKER", "901"]) {
    assert.doesNotMatch(serialized, new RegExp(marker));
  }
  assert.match(serialized, /Synthetic reviewer/);
  assert.match(serialized, /合成理由/);
});

test("CLI writes with wx and refuses to overwrite an existing ledger", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "fiscal-p4-review-results-"));
  try {
    const reportPath = path.join(dir, "report.json");
    const metadataPath = path.join(dir, "metadata.json");
    const resultsPath = path.join(dir, "results.json");
    const outputPath = path.join(dir, "ledger.json");
    writeFileSync(reportPath, JSON.stringify(report));
    writeFileSync(metadataPath, JSON.stringify(metadata));
    writeFileSync(resultsPath, JSON.stringify(completeResults()));
    const cli = path.join(repo, "scripts/fiscal/p4-quality-review-results.ts");
    const created = spawnSync(process.execPath, [cli, "validate", reportPath, metadataPath, resultsPath, "--out", outputPath], { cwd: repo, encoding: "utf8" });
    assert.equal(created.status, 0, created.stderr);
    assert.equal(JSON.parse(readFileSync(outputPath, "utf8")).status, "REVIEW_COMPLETE");
    writeFileSync(outputPath, "keep existing ledger");
    const refused = spawnSync(process.execPath, [cli, "validate", reportPath, metadataPath, resultsPath, "--out", outputPath], { cwd: repo, encoding: "utf8" });
    assert.equal(refused.status, 2);
    assert.equal(readFileSync(outputPath, "utf8"), "keep existing ledger");
  } finally {
    const resolvedDir = path.resolve(dir);
    assert.equal(path.dirname(resolvedDir), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolvedDir).startsWith("fiscal-p4-review-results-"));
    rmSync(resolvedDir, { recursive: true, force: true });
  }
});
