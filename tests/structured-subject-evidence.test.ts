import assert from "node:assert/strict";
import { test } from "node:test";
import { filterSupportedSubjects } from "@aihot/backend/editorial/writing";

test("provincial treasury evidence does not support a model-invented Xiamen central-bank subject", () => {
  const input = { title: "福建省省级国库现金管理招标结果", text: "福建省财政厅、中国人民银行福建省分行公布本期招标结果。", sourceKind: "web_list" };
  assert.deepEqual(filterSupportedSubjects(input, ["fujian-finance", "pboc", "pboc-xiamen", "pboc", "unknown"]), ["fujian-finance", "pboc"]);
});

test("explicit local branch evidence and verified publisher identity remain usable", () => {
  assert.deepEqual(filterSupportedSubjects({ title: "支付服务进展", text: "人民银行厦门市分行介绍工作安排。", sourceKind: "web_list" }, ["pboc", "pboc-xiamen"]), ["pboc", "pboc-xiamen"]);
  assert.deepEqual(filterSupportedSubjects({ title: "征求意见", text: "现征求意见。", documentUrl: "https://kjs.mof.gov.cn/gongzuotongzhi/item.htm", sourceKind: "web_list" }, ["mof-accounting", "pboc-xiamen"]), ["mof-accounting"]);
});

test("a suggested subject list cannot supply its own identity evidence", () => {
  assert.deepEqual(filterSupportedSubjects({ title: "工作交流", text: "介绍项目进展。", sourceKind: "rss" }, ["mof", "pboc-xiamen"]), []);
});
