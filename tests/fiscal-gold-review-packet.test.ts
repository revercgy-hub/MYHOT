import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { renderReviewPacket } from "../scripts/fiscal/gold-review-packet.ts";

const repo = path.resolve(import.meta.dirname, "..");
const templatePath = path.join(repo, "docs/fiscal-finance/gold/metadata-template.json");
const template = JSON.parse(readFileSync(templatePath, "utf8")) as Record<string, any>;

test("packet includes review identity and body hold metadata without copying body text", () => {
  const packet = renderReviewPacket(template);
  assert.match(packet, /https:\/\/yss\.mof\.gov\.cn\/gongzuodongtai/);
  assert.match(packet, /财政部预算司·工作动态/);
  assert.match(packet, /2026-03-26T00:00:00\+08:00/);
  assert.match(packet, /h7rei2mhmazonk5k4gzc8v0sg/);
  assert.match(packet, /状态为 `ok`；正文未复制到本packet/);
  assert.match(packet, /attachments\\_unprocessed/);
  assert.match(packet, /诊断身份：mof-accounting-jul15-projection-diagnostic/);
  assert.match(packet, /原清单含工具建议，但本packet不展示建议内容/);
  assert.doesNotMatch(packet, /bodyReference|fiscalhot_core_batch_test\.articles/);
  assert.doesNotMatch(packet, /bodyZh|bodyOriginal/);
});

test("Gold decision and review confirmations remain blank", () => {
  const packet = renderReviewPacket(template);
  assert.match(packet, /Gold decision（人工填写）：\*\* \[ \] select　\[ \] reject　\[ \] either/);
  assert.match(packet, /标注理由（人工填写）/);
  assert.match(packet, /标注人 \/ 确认人（人工填写）：\*\* _+/);
  assert.match(packet, /确认时间（人工填写）：\*\* _+/);
  assert.match(packet, /事件组确认（人工填写）/);
  assert.match(packet, /development　\[ \] holdout/);
  const changedProposal = structuredClone(template);
  changedProposal.candidates[0].proposal = {
    decision: "reject",
    proposedBy: "SECRET_PROPOSER_MARKER",
    rationale: "SECRET_RATIONALE_MARKER",
  };
  assert.equal(renderReviewPacket(changedProposal), packet);
  assert.doesNotMatch(packet, /Luna High|SECRET_PROPOSER_MARKER|SECRET_RATIONALE_MARKER/);
  assert.doesNotMatch(packet, /proposedBy/);
  assert.doesNotMatch(packet, /humanAnnotation.*user_confirmed/);
});

test("renderer accepts a structurally valid incomplete draft but rejects validator schema errors", () => {
  const packet = renderReviewPacket(template);
  assert.match(packet, /validator：DRAFT_INCOMPLETE/);
  assert.throws(() => renderReviewPacket({ ...template, datasetStatus: "GOLD" }), /existing Gold metadata validator/);
  assert.throws(() => renderReviewPacket({ ...template, candidates: [{ caseId: "malformed" }] }), /existing Gold metadata validator/);
});

test("CLI writes the packet to stdout with all Gold fields blank", () => {
  const cli = path.join(repo, "scripts/fiscal/gold-review-packet.ts");
  const result = spawnSync(process.execPath, [cli, templatePath], { cwd: repo, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^# P5 Gold 人工审阅 packet/);
  assert.match(result.stdout, /fiscal-accounting-consultation-attachment-failure-20260715/);
  assert.match(result.stdout, /原清单含工具建议，但本packet不展示建议内容/);
  assert.doesNotMatch(result.stdout, /Luna High|提案不代表用户确认/);
});

test("CLI --out creates exclusively and refuses to overwrite an existing packet", () => {
  const cli = path.join(repo, "scripts/fiscal/gold-review-packet.ts");
  const dir = mkdtempSync(path.join(os.tmpdir(), "fiscal-gold-packet-"));
  try {
    const output = path.join(dir, "review.md");
    const created = spawnSync(process.execPath, [cli, templatePath, "--out", output], { cwd: repo, encoding: "utf8" });
    assert.equal(created.status, 0, created.stderr);
    assert.match(readFileSync(output, "utf8"), /^# P5 Gold 人工审阅 packet/);
    const original = "keep this packet";
    writeFileSync(output, original);
    const refused = spawnSync(process.execPath, [cli, templatePath, "--out", output], { cwd: repo, encoding: "utf8" });
    assert.equal(refused.status, 2);
    assert.equal(readFileSync(output, "utf8"), original);
  } finally {
    const resolvedDir = path.resolve(dir);
    assert.equal(path.dirname(resolvedDir), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolvedDir).startsWith("fiscal-gold-packet-"));
    rmSync(resolvedDir, { recursive: true, force: true });
  }
});

test("unsafe URL schemes and markup-like titles cannot become active Markdown", () => {
  const altered = structuredClone(template);
  altered.candidates[0].material.title = "[click](javascript:alert(1))";
  altered.candidates[0].evidence.url = "https://reviewer:secret@example.gov/article";
  const packet = renderReviewPacket(altered);
  assert.match(packet, /\\\[click\\\]\\\(javascript:alert\\\(1\\\)\\\)/);
  assert.match(packet, /URL不接受：仅允许无凭据的HTTP\(S\)链接/);
  altered.candidates[0].evidence.url = "javascript:alert(1)";
  assert.throws(() => renderReviewPacket(altered), /existing Gold metadata validator/);
});
