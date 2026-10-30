import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildEvidenceDimensionPrompt, validateEvidenceDimensionScore } from "../packages/backend/src/editorial/dimension-score-evidence.ts";
import { dimensionAttentionScore, readScoreWeights } from "../packages/backend/src/editorial/dimension-score.ts";

const quote = "逐项核验贷款合同、利息支付凭证和历年申报档案";
const value = { evidenceQuotes: [quote], itemType: "local_practice", dimensions: { sig: 4, nov: 5, cred: 8, reson: 9, act: 7 } };
const prompt = readFileSync("industry/prompts/selection-score-dimensions-candidate.md", "utf8");

test("development evidence quotes must come from the supplied full body and cannot alter weighted scoring", () => {
  const result = validateEvidenceDimensionScore(value, `[p1 x1=0 y1=1 x2=2 y2=3]\n${quote}，防范重复申报。`);
  assert.deepEqual(result.score, { itemType: value.itemType, dimensions: value.dimensions });
  assert.equal(dimensionAttentionScore(result.score, readScoreWeights(prompt)), 66);
  assert.throws(() => validateEvidenceDimensionScore(value, "开展一般内部学习，并无上述业务事实。"), /verbatim body spans/u);
  assert.throws(() => validateEvidenceDimensionScore({ ...value, evidenceQuotes: [quote, quote] }, quote), /unique verbatim/u);
  assert.throws(() => validateEvidenceDimensionScore({ ...value, attentionScore: 100 }, quote));
  assert.throws(() => validateEvidenceDimensionScore({ ...value, evidenceQuotes: [] }, quote));
  assert.equal(validateEvidenceDimensionScore(value, "逐项核验贷款 合同、利息支付凭证和历年申报 档案").evidenceQuotes.length, 1);
  assert.throws(() => validateEvidenceDimensionScore(value, "逐项核验贷款合同、利息支付凭证和本年申报档案"), /verbatim body spans/u);
  const quotes = Array.from({ length: 8 }, (_, i) => `第${i + 1}项逐笔核对贷款合同及利息支付凭证`);
  assert.equal(validateEvidenceDimensionScore({ ...value, evidenceQuotes: quotes }, quotes.join("；")).evidenceQuotes.length, 8);
  assert.throws(() => validateEvidenceDimensionScore({ ...value, evidenceQuotes: [...quotes, "第九项逐笔核对贷款合同及利息支付凭证"] }, quotes.join("；")));
});

test("evidence candidate changes its output contract while preserving the entire original rubric and weights", () => {
  const candidate = buildEvidenceDimensionPrompt(prompt);
  assert.deepEqual(readScoreWeights(candidate), readScoreWeights(prompt));
  assert.ok(candidate.includes(prompt.slice(prompt.indexOf("## 读者当前重点"), prompt.indexOf("只返回一个JSON对象"))));
  assert.ok(candidate.includes("不自动抬高任何轴值"));
  assert.equal(candidate.includes("必须且只能包含itemType和dimensions。"), false);
  assert.throws(() => buildEvidenceDimensionPrompt(prompt.replace("必须且只能包含itemType和dimensions。", "changed")), /Unsupported/u);
});
