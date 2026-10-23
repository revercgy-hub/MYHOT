import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ITEM_TYPES } from "../industry/taxonomy.ts";
import { SELECTION } from "../industry/selection.ts";

const prefilter = readFileSync("industry/prompts/prefilter.md", "utf8");
const score = readFileSync("industry/prompts/selection-score.md", "utf8");

test("major national livelihood policy can enter scoring without broadening ordinary health or local-event noise", () => {
  assert.match(prefilter, /国家层级发布、内容具有实质重要性的重大民生政策[，,]即使材料没有明确财政金融安排[，,]也可通过预筛进入后续注意力评分/u);
  assert.match(prefilter, /普通健康科普或仅涉及地方活动的材料不能仅凭民生、健康或政策字样通过/u);
  assert.match(prefilter, /与财政金融工作无实质关系的科技及社会新闻（符合上文所述国家层级重大民生政策条件的除外）/u);
  assert.match(score, /国家层级具有实质重要性的重大民生政策可以纳入本栏目候选[，,]即使没有明确财政金融安排/u);
  assert.match(score, /普通健康科普、一般知识介绍和仅涉及地方活动的材料不因此升为重大政策或高分/u);
  assert.match(score, /国家层级或官方发布身份本身不加分/u);
  assert.match(score, /其与重大民生政策实施和公共管理工作的实际关联评估/u);
  assert.match(score, /其制度或公共影响仍由`sig`体现[，,]不在`reson`重复计入/u);
});

test("routine and zero-operation OMO notices stay in all dynamics while importance remains fact-based", () => {
  assert.match(prefilter, /央行公开市场操作（OMO）日常公告也属于货币金融材料[，,]包括常规零操作公告/u);
  assert.match(prefilter, /是否值得精选留给后续按事实评分[，,]不在预筛阶段因操作为零而拦截/u);
  assert.match(score, /央行公开市场操作（OMO）日常公告[，,]包括常规零操作公告[，,]按金融材料正常进入“全部动态”/u);
  assert.match(score, /常规、重复或零操作且没有重要操作变化、政策信号或新增影响时[，,]不因央行身份或公告金额自动抬高/u);
  assert.match(score, /只有正文支持的重要操作或政策变化才优先评价其新增影响/u);
  assert.match(score, /通常`sig ≤ 2`、`nov ≤ 1`、`act ≤ 2`/u);
});

test("policy alignment preserves the existing item types, scoring weights and selection thresholds", () => {
  assert.equal(ITEM_TYPES.length, 8);
  assert.deepEqual(ITEM_TYPES, ["policy_release", "regulatory_rule", "fiscal_data", "financial_data",
    "debt_event", "regulatory_action", "local_practice", "research_analysis"]);
  assert.deepEqual(SELECTION.thresholds, { T1: 60, T1_5: 65, T2: 76 });
  const expectedWeightRows = [
    "| policy_release | 3 | 2 | 2 | 2 | 1 |",
    "| regulatory_rule | 3 | 2 | 2 | 2 | 1 |",
    "| fiscal_data | 2 | 2 | 2 | 3 | 1 |",
    "| financial_data | 2 | 2 | 2 | 3 | 1 |",
    "| debt_event | 3 | 2 | 2 | 2 | 1 |",
    "| regulatory_action | 3 | 2 | 2 | 2 | 1 |",
    "| local_practice | 2 | 2 | 2 | 2 | 2 |",
    "| research_analysis | 1 | 3 | 2 | 2 | 2 |",
  ];
  for (const row of expectedWeightRows) assert.ok(score.includes(row), `expected unchanged scoring row: ${row}`);
  assert.match(score, /不要改权重/u);
});
