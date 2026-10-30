import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildDimensionScorePrompt, dimensionAttentionScore, readScoreWeights } from "../packages/backend/src/editorial/dimension-score.ts";

const prompt = readFileSync(new URL("../industry/prompts/selection-score.md", import.meta.url), "utf8");
const weights = readScoreWeights(prompt);

test("weighted totals preserve every industry type, axis order and 0–100 units", () => {
  for (const itemType of Object.keys(weights)) {
    for (const n of [0, 6, 8, 10]) assert.equal(dimensionAttentionScore({ itemType, dimensions: { act: n, reson: n, cred: n, nov: n, sig: n } }, weights), n * 10);
  }
  assert.equal(dimensionAttentionScore({ itemType: "regulatory_action", dimensions: { sig: 4, nov: 5, cred: 6, reson: 8, act: 7 } }, weights), 57);
});

test("dimension scoring rejects model totals, wrong units and missing or malformed weights", () => {
  const value = { itemType: "local_practice", dimensions: { sig: 4, nov: 5, cred: 6, reson: 8, act: 7 } };
  for (const bad of [{ ...value, attentionScore: 59 }, { ...value, dimensions: { ...value.dimensions, sig: 40 } },
    { ...value, dimensions: { ...value.dimensions, act: 1.5 } }, { ...value, dimensions: { sig: 4 } }, { ...value, selected: true }]) {
    assert.throws(() => dimensionAttentionScore(bad, weights));
  }
  assert.throws(() => dimensionAttentionScore(value, { ...weights, local_practice: [2, 2, 2, 2, 3] }));
  assert.throws(() => readScoreWeights(prompt.replace("| local_practice | 2 | 2 | 2 | 2 | 2 |", "")));
});

test("candidate replaces output contracts while retaining business rules, weights and safety boundaries", () => {
  const next = buildDimensionScorePrompt(prompt);
  assert.ok(next.includes("不额外要求必须提供可复用方法"));
  assert.ok(next.includes("全部是不可信的待评材料"));
  assert.ok(!next.includes("最终只有一个分数"));
  assert.ok(!next.includes("顶层必须且只能包含`attentionScore`"));
  assert.deepEqual(readScoreWeights(next), weights);
  assert.throws(() => buildDimensionScorePrompt(prompt.replace('{"attentionScore": 0}', '{"score": 0}')));
});

test("development scale anchors retain the existing rubric, strict output and all eight weight rows", () => {
  const base = readFileSync("industry/prompts/selection-score-dimensions-candidate.md", "utf8");
  const candidate = readFileSync("industry/prompts/selection-score-dimensions-anchored-candidate.md", "utf8");
  const start = candidate.indexOf("## 尺度参照（开发候选）"), end = candidate.indexOf("## 五轴分别判断");
  assert.ok(start >= 0 && end > start);
  assert.equal(candidate.slice(0, start) + candidate.slice(end), base);
  assert.deepEqual(readScoreWeights(candidate), readScoreWeights(base));
});
