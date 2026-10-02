import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { extractSelectedBody } from "../packages/backend/src/content/selected-body.ts";

// S1 selector characterization only: the positive false-positive controls below are expected to
// produce a body and therefore block applying either CSS candidate to industry/sources.json.

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/fiscal-accounting-body");
const expected = {
  shortTable: {
    title: "从事证券服务业务会计师事务所注销备案名单",
    publishedAt: new Date("2026-09-04T00:00:00+08:00"),
  },
  titleXlsx: {
    title: "2025年度会计师事务所从事证券服务业务有关信息",
    publishedAt: new Date("2026-09-20T00:00:00+08:00"),
  },
  nestedParagraph: {
    title: "关于征求《财政部关于加快推进会计数智化工作的指导意见（征求意见稿）》意见的函",
    publishedAt: new Date("2026-09-22T00:00:00+08:00"),
  },
  shortMultip: {
    title: "财政部工作提示",
    publishedAt: new Date("2026-10-01T09:00:00+08:00"),
  },
  decorativeTable: {
    title: "财政部栏目导航",
    publishedAt: new Date("2026-10-01T09:00:00+08:00"),
  },
};

const unionSelector = ".my_doccontent > .TRS_Editor:has(table), .my_doccontent > .TRS_Editor:has(p + p)";
const conservativeSelector = ".my_doccontent > .TRS_Editor:has(table[border='1'] tr > td:nth-child(5)):not(:has(a)), .my_doccontent > .TRS_Editor:has(p + p + p + p)";

async function runFixture(
  filename: string,
  identity: { title: string; publishedAt: Date },
  bodySelector = unionSelector,
) {
  const html = await readFile(join(fixtureDir, filename), "utf8");
  return extractSelectedBody(html, "https://kjs.mof.gov.cn/gongzuotongzhi/fixture.html", {
    bodySelector,
    allowShortBody: true,
    publishedAtUtcOffset: "+08:00",
  }, identity);
}

test("the approved union retains the real short five-column table and its complete visible row", async () => {
  const result = await runFixture("real-short-table.html", expected.shortTable);
  assert.equal(result.reason, null);
  assert.equal(result.body?.text.length, 180);
  assert.match(result.body!.text, /序号 \| 会计师事务所名称 \| 统一社会信用代码 \| 注销备案公告日期 \| 注销备案情形/);
  assert.match(result.body!.text, /河南守正创新会计师事务所（普通合伙）/);
  assert.match(result.body!.text, /91410100MA485H2P23/);
  assert.match(result.body!.text, /自行申请注销从事证券服务业务备案/);
});

test("the approved union rejects the real title-only page with an XLSX attachment", async () => {
  const result = await runFixture("real-title-xlsx.html", expected.titleXlsx);
  assert.equal(result.body, null);
  assert.equal(result.reason, "selector_not_unique");
});

test("the approved union preserves the real nested, table-free 473-character notice", async () => {
  const result = await runFixture("real-nested-paragraph.html", expected.nestedParagraph);
  assert.equal(result.reason, null);
  assert.equal(result.body?.text.length, 473);
  assert.match(result.body!.text, /财政部关于加快推进会计数智化工作的指导意见/);
  assert.match(result.body!.text, /2026年10月20日前将意见反馈至财政部会计司/);
  assert.match(result.body!.text, /2026年9月17日/);
  assert.doesNotMatch(result.body!.html, /<table\b/i);
});

test("the approved union also accepts an unrelated short multi-paragraph page with valid identity", async () => {
  const result = await runFixture("negative-short-multip.html", expected.shortMultip);
  assert.equal(result.reason, null);
  assert(result.body);
  assert(result.body.text.length < 200);
});

test("the approved union also accepts a decorative five-column table with valid identity", async () => {
  const result = await runFixture("negative-decorative-table.html", expected.decorativeTable);
  assert.equal(result.reason, null);
  assert(result.body);
  assert(result.body.text.length < 200);
});

test("a narrower structural CSS candidate rejects the short prose control but still cannot reject a decorative table", async () => {
  const shortMultip = await runFixture("negative-short-multip.html", expected.shortMultip, conservativeSelector);
  assert.equal(shortMultip.body, null);
  const decorativeTable = await runFixture("negative-decorative-table.html", expected.decorativeTable, conservativeSelector);
  assert.equal(decorativeTable.reason, null);
  assert(decorativeTable.body);

  for (const [filename, identity, expectedLength] of [
    ["real-short-table.html", expected.shortTable, 180],
    ["real-title-xlsx.html", expected.titleXlsx, null],
    ["real-nested-paragraph.html", expected.nestedParagraph, 473],
  ] as const) {
    const real = await runFixture(filename, identity, conservativeSelector);
    if (expectedLength === null) assert.equal(real.body, null, filename);
    else assert.equal(real.body?.text.length, expectedLength, filename);
  }
});
