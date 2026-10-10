import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { renderP4QualityReview } from "../scripts/fiscal/p4-quality-review.ts";

const repo = path.resolve(import.meta.dirname, "..");
const report = {
  schema: "fiscal-p4-bounded-execution/v1",
  runHash: "c".repeat(64),
  rows: [{
    id: "synthetic-article-1", sourceId: "synthetic-source-1", revision: 2,
    contentHash: "a".repeat(64), result: "analyzed", analysisId: 42, receiptIds: [901, 902],
    selected: true, relevance: "pass",
  }],
};
const metadata = {
  schema: "fiscal-p4-quality-review-metadata/v1",
  articles: [{
    articleId: "synthetic-article-1", sourceId: "synthetic-source-1", revision: 2,
    contentHash: "a".repeat(64), analysisId: 42,
    article: { title: "Synthetic article", url: "https://example.invalid/story?id=1", publishedAt: "2026-01-02T03:04:05Z" },
    analysis: {
      titleZh: "合成标题", summaryZh: "合成摘要，供人工核验。", itemType: "BAD-SYNTHETIC-ITEM-TYPE",
      authorRole: "observer", category: "synthetic-category", tags: ["BAD-SYNTHETIC-TOPIC"], subjects: ["合成主体"],
      score: 68, scores: [66, 70], threshold: 75,
      factFrame: { title: "合成事实框架", subject: "部门甲", action: "发布", object: "通知", occurredAt: "2026-01-02" },
    },
  }],
};

test("renders a metadata-only manual P4 review sheet without prefilled judgments", () => {
  const output = renderP4QualityReview(report, metadata);
  assert.match(output, /^# P4 人工质量审查表/);
  assert.match(output, /BAD-SYNTHETIC-ITEM-TYPE/);
  assert.match(output, /BAD-SYNTHETIC-TOPIC/);
  assert.match(output, /合成摘要，供人工核验/);
  assert.match(output, /两次评分（原样）：66 \/ 70/);
  assert.match(output, /已记录分数：68；已记录阈值：75/);
  assert.match(output, /Fact frame（模型结构输出）/);
  assert.match(output, /系统聚簇：未运行/);
  assert.match(output, /□准确　□部分有误　□有误　□无法判断/);
  assert.doesNotMatch(output, /quality passed|质量通过|Gold 标签已确认|聚类准确率/i);
  assert.doesNotMatch(output, /☑|■/);
  assert.doesNotMatch(output, /901|902/);
});

test("rejects missing, duplicate, or mismatched article-analysis identities", () => {
  assert.throws(() => renderP4QualityReview(report, { ...metadata, articles: [] }), /same article rows/);
  assert.throws(() => renderP4QualityReview({ ...report, rows: [...report.rows, report.rows[0]] }, metadata), /duplicate articleId/);
  assert.throws(() => renderP4QualityReview(report, { ...metadata, articles: [...metadata.articles, metadata.articles[0]] }), /duplicate articleId/);
  const drifted = structuredClone(metadata);
  drifted.articles[0]!.analysisId += 1;
  assert.throws(() => renderP4QualityReview(report, drifted), /identity drift/);
  const wrongSource = structuredClone(metadata);
  wrongSource.articles[0]!.sourceId = "other-source";
  assert.throws(() => renderP4QualityReview(report, wrongSource), /identity drift/);
  const wrongRevision = structuredClone(metadata);
  wrongRevision.articles[0]!.revision += 1;
  assert.throws(() => renderP4QualityReview(report, wrongRevision), /identity drift/);
  const wrongHash = structuredClone(metadata);
  wrongHash.articles[0]!.contentHash = "b".repeat(64);
  assert.throws(() => renderP4QualityReview(report, wrongHash), /identity drift/);
  const untrustedIdReport = structuredClone(report);
  untrustedIdReport.rows[0]!.id = "SECRET-IDENTITY-MARKER";
  assert.throws((() => renderP4QualityReview(untrustedIdReport, metadata)), (error: Error) => {
    assert.match(error.message, /missing a report article/);
    assert.doesNotMatch(error.message, /SECRET-IDENTITY-MARKER/);
    return true;
  });
});

test("ignores forbidden body, receipt-response, and secret fields and safely renders untrusted metadata", () => {
  const unsafeReport = structuredClone(report) as Record<string, any>;
  unsafeReport.rows[0].rawReceipt = "FORBIDDEN_RAW_RECEIPT_MARKER";
  unsafeReport.rows[0].receiptResponse = "FORBIDDEN_RECEIPT_RESPONSE_MARKER";
  const unsafeMetadata = structuredClone(metadata) as Record<string, any>;
  unsafeMetadata.articles[0].article.bodyText = "FORBIDDEN_FULL_BODY_MARKER";
  unsafeMetadata.articles[0].article.bodyRef = "FORBIDDEN_BODY_REFERENCE_MARKER";
  unsafeMetadata.articles[0].article.apiKey = "FORBIDDEN_SECRET_MARKER";
  unsafeMetadata.articles[0].analysis.rawReceipt = "FORBIDDEN_ANALYSIS_RECEIPT_MARKER";
  unsafeMetadata.articles[0].article.title = "[synthetic](javascript:alert(1)) | title";
  unsafeMetadata.articles[0].article.url = "https://user:password@example.invalid/story?api_key=FORBIDDEN_URL_SECRET_MARKER";
  const output = renderP4QualityReview(unsafeReport, unsafeMetadata);
  for (const marker of [
    "FORBIDDEN_RAW_RECEIPT_MARKER", "FORBIDDEN_RECEIPT_RESPONSE_MARKER", "FORBIDDEN_FULL_BODY_MARKER",
    "FORBIDDEN_BODY_REFERENCE_MARKER", "FORBIDDEN_SECRET_MARKER", "FORBIDDEN_ANALYSIS_RECEIPT_MARKER", "FORBIDDEN_URL_SECRET_MARKER",
  ]) assert.doesNotMatch(output, new RegExp(marker));
  assert.ok(output.includes("\\[synthetic\\]\\(javascript:alert\\(1\\)\\) \\| title"));
  assert.match(output, /链接不接受：仅允许无凭据的 HTTP\(S\)/);
});

test("marks unavailable scores explicitly and bounds long model copy", () => {
  const noScores = structuredClone(metadata) as Record<string, any>;
  delete noScores.articles[0]!.analysis.scores;
  delete noScores.articles[0]!.analysis.threshold;
  noScores.articles[0]!.analysis.summaryZh = "合成".repeat(1400);
  const output = renderP4QualityReview(report, noScores);
  assert.match(output, /两次评分（原样）：未提供/);
  assert.match(output, /已记录阈值：未提供/);
  assert.match(output, /原字段超过 1200 字符，已截断/);
  assert.ok(output.length < 6000);
});

test("CLI writes exclusively with wx and refuses to overwrite an existing review", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "fiscal-p4-quality-review-"));
  try {
    const reportPath = path.join(dir, "report.json");
    const invalidReportPath = path.join(dir, "invalid-report.json");
    const metadataPath = path.join(dir, "metadata.json");
    const outputPath = path.join(dir, "review.md");
    writeFileSync(reportPath, JSON.stringify(report));
    writeFileSync(metadataPath, JSON.stringify(metadata));
    writeFileSync(invalidReportPath, '{"api_key":"SECRET-PARSE-MARKER"');
    const cli = path.join(repo, "scripts/fiscal/p4-quality-review.ts");
    const invalid = spawnSync(process.execPath, [cli, invalidReportPath, metadataPath], { cwd: repo, encoding: "utf8" });
    assert.equal(invalid.status, 2);
    assert.match(invalid.stderr, /execution report JSON is invalid/);
    assert.doesNotMatch(invalid.stderr, /SECRET-PARSE-MARKER/);
    const created = spawnSync(process.execPath, [cli, reportPath, metadataPath, "--out", outputPath], { cwd: repo, encoding: "utf8" });
    assert.equal(created.status, 0, created.stderr);
    assert.match(readFileSync(outputPath, "utf8"), /^# P4 人工质量审查表/);
    writeFileSync(outputPath, "keep existing review");
    const refused = spawnSync(process.execPath, [cli, reportPath, metadataPath, "--out", outputPath], { cwd: repo, encoding: "utf8" });
    assert.equal(refused.status, 2);
    assert.equal(readFileSync(outputPath, "utf8"), "keep existing review");
  } finally {
    const resolvedDir = path.resolve(dir);
    assert.equal(path.dirname(resolvedDir), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolvedDir).startsWith("fiscal-p4-quality-review-"));
    rmSync(resolvedDir, { recursive: true, force: true });
  }
});
