import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { extractSelectedBody, validateBodyPolicies, type SelectedBodyPolicy } from "../packages/backend/src/content/selected-body.ts";
import { extractFromUrl } from "../packages/backend/src/content/extract.ts";
import { extractConfiguredHtmlBody } from "../packages/backend/src/content/pdf-body.ts";
import { unsupportedConfig } from "../packages/backend/src/sources/config-keys.ts";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/fiscal-accounting-body");
const expected = {
  shortTable: { title: "从事证券服务业务会计师事务所注销备案名单", publishedAt: new Date("2026-09-04T00:00:00+08:00") },
  titleXlsx: { title: "2025年度会计师事务所从事证券服务业务有关信息", publishedAt: new Date("2026-09-20T00:00:00+08:00") },
  nestedParagraph: { title: "关于征求《财政部关于加快推进会计数智化工作的指导意见（征求意见稿）》意见的函", publishedAt: new Date("2026-09-22T00:00:00+08:00") },
  shortMultip: { title: "财政部工作提示", publishedAt: new Date("2026-10-01T09:00:00+08:00") },
  decorativeTable: { title: "财政部栏目导航", publishedAt: new Date("2026-10-01T09:00:00+08:00") },
};
const tableSelector = ".my_doccontent > .TRS_Editor:has(table)";
const proseSelector = ".my_doccontent > .TRS_Editor:has(p + p)";
const policies: SelectedBodyPolicy[] = [
  {
    selector: tableSelector,
    minTextChars: 1,
    table: {
      requiredHeaderCells: ["序号", "会计师事务所名称", "统一社会信用代码", "注销备案公告日期", "注销备案情形"],
      minCompleteDataRows: 1,
    },
  },
  { selector: proseSelector, minTextChars: 200 },
];
const pageUrl = "https://kjs.mof.gov.cn/gongzuotongzhi/fixture.html";

async function sourceHtml(name: string): Promise<string> {
  return readFile(join(fixtureDir, name), "utf8");
}

function extract(html: string, identity: { title: string; publishedAt: Date }, bodyPolicies = policies) {
  return extractSelectedBody(html, pageUrl, { bodyPolicies, publishedAtUtcOffset: "+08:00" }, identity);
}

test("the configured policy accepts the real 180-character table only with its exact header and complete row", async () => {
  const result = await extract(await sourceHtml("real-short-table.html"), expected.shortTable);
  assert.equal(result.reason, null);
  assert.equal(result.body?.text.length, 180);
  assert.match(result.body!.text, /序号 \| 会计师事务所名称 \| 统一社会信用代码 \| 注销备案公告日期 \| 注销备案情形/);
  assert.match(result.body!.text, /河南守正创新会计师事务所（普通合伙）/);
  assert.match(result.body!.text, /91410100MA485H2P23/);
});

test("the prose policy keeps the real 473-character notice and rejects a short multi-paragraph control", async () => {
  const prose = await extract(await sourceHtml("real-nested-paragraph.html"), expected.nestedParagraph);
  assert.equal(prose.reason, null);
  assert.equal(prose.body?.text.length, 473);
  const short = await extract(await sourceHtml("negative-short-multip.html"), expected.shortMultip);
  assert.equal(short.body, null);
  assert.equal(short.reason, "short_body_not_allowed");
});

test("the title-plus-XLSX page remains unconfirmed and the identity-matched decorative table is rejected", async () => {
  const titleOnly = await extract(await sourceHtml("real-title-xlsx.html"), expected.titleXlsx);
  assert.equal(titleOnly.body, null);
  assert.equal(titleOnly.reason, "selector_missing");
  const decorative = await extract(await sourceHtml("negative-decorative-table.html"), expected.decorativeTable);
  assert.equal(decorative.body, null);
  assert.equal(decorative.reason, "body_policy_table_invalid");
});

test("table validation rejects wrong and reordered headers, missing/empty cells, and empty rows", async () => {
  const original = await sourceHtml("real-short-table.html");
  const badHeader = original.replace("统一社会信用代码", "统一信用代码");
  const reorderedHeader = original.replace("会计师事务所名称", "POLICY_TEMP_HEADER").replace("统一社会信用代码", "会计师事务所名称").replace("POLICY_TEMP_HEADER", "统一社会信用代码");
  const missingCell = original.replace(/<tr>\s*<td[^>]*>&nbsp;1<\/td>[\s\S]*?<\/tr>/, "<tr><td>1</td><td>事务所</td><td>123</td><td>2026年9月4日</td></tr>");
  const emptyCell = original.replace("河南守正创新会计师事务所（普通合伙）", "&nbsp;");
  const emptyRow = original.replace("</tr>\n    </tbody>", "</tr><tr><td></td><td></td><td></td><td></td><td></td></tr>\n    </tbody>");
  for (const [label, html] of [["wrong header", badHeader], ["reordered header", reorderedHeader], ["missing cell", missingCell], ["empty cell", emptyCell], ["empty row", emptyRow]] as const) {
    const result = await extract(html, expected.shortTable);
    assert.equal(result.body, null, label);
    assert.equal(result.reason, "body_policy_table_invalid", label);
  }
});

test("policy matching rejects overlap, duplicate containers, bad identity, and unsupported table layout", async () => {
  const table = await sourceHtml("real-short-table.html");
  const overlap = await extract(table, expected.shortTable, [...policies, { selector: ".my_doccontent > .TRS_Editor", minTextChars: 1 }]);
  assert.equal(overlap.body, null);
  assert.equal(overlap.reason, "body_policy_ambiguous");
  const duplicate = await extract(table.replace("</body>", `${table.match(/<div class="my_doccontent">[\s\S]*?<\/div><\/div>/)?.[0] ?? ""}</body>`), expected.shortTable);
  assert.equal(duplicate.body, null);
  assert.equal(duplicate.reason, "selector_not_unique");
  const wrongIdentity = await extract(table, { ...expected.shortTable, title: "其他页面" });
  assert.equal(wrongIdentity.body, null);
  assert.equal(wrongIdentity.reason, "identity_mismatch");
  const wrongDate = await extract(table, { ...expected.shortTable, publishedAt: new Date("2026-09-05T00:00:00+08:00") });
  assert.equal(wrongDate.body, null);
  assert.equal(wrongDate.reason, "identity_mismatch");
  const rowspan = table.replace("<table", "<table rowspan=\"2\"");
  const nestedTable = table.replace(/<table[\s\S]*?<\/table>/, "<table><tbody><tr><th>序号</th><th>会计师事务所名称</th><th>统一社会信用代码</th><th>注销备案公告日期</th><th>注销备案情形</th></tr><tr><td>1</td><td>事务所</td><td>123</td><td>2026年9月4日</td><td><table><tr><td>嵌套</td></tr></table></td></tr></tbody></table>");
  for (const [label, html] of [["rowspan", rowspan], ["nested table", nestedTable]] as const) {
    const result = await extract(html, expected.shortTable);
    assert.equal(result.body, null, label);
    assert.equal(result.reason, "body_policy_table_invalid", label);
  }
});

test("invalid policy shapes and incompatible or unsupported source kinds are refused", () => {
  assert.deepEqual(validateBodyPolicies(policies), []);
  for (const invalid of [
    [],
    [{ selector: "#x", minTextChars: 1.5 }],
    [{ selector: "#x", minTextChars: Number.POSITIVE_INFINITY }],
    [{ selector: "#x", minTextChars: 1, extra: true }],
    [{ selector: "#x", minTextChars: 1, table: { requiredHeaderCells: ["A", "A"], minCompleteDataRows: 1 } }],
    [{ selector: "#x", minTextChars: 1, table: { requiredHeaderCells: ["A"], minCompleteDataRows: 0 } }],
    Array.from({ length: 9 }, () => ({ selector: "#x", minTextChars: 1 })),
  ]) assert.notEqual(validateBodyPolicies(invalid).length, 0, JSON.stringify(invalid));

  assert.deepEqual(unsupportedConfig("web_list", { detail: { bodyPolicies: policies } }), []);
  assert(unsupportedConfig("web_list", { detail: { bodyPolicies: policies, bodySelector: "#old" } }).some((x) => x.includes("cannot be combined")));
  assert(unsupportedConfig("web_list", { detail: { bodyPolicies: [{ ...policies[0], table: { ...policies[0]!.table!, typo: true } }] } }).some((x) => x.includes("unsupported")));
  assert(unsupportedConfig("json_list", { url: "https://example.org/list.json", detail: { bodyPolicies: policies } }).some((x) => x.includes("only supported by web_list")));
  assert(unsupportedConfig("web_list", { detail: { bodyPolicies: policies, attachmentSelector: ".files", articleSelector: "article" } }).some((x) => x.includes("cannot be combined")));
});

test("the HTML envelope driver refuses policy plus legacy or PDF selector settings", async () => {
  const html = await sourceHtml("real-short-table.html");
  const result = await extractConfiguredHtmlBody(html, pageUrl, {
    bodyPolicies: policies,
    articleSelector: ".my_doccontent",
    attachmentSelector: ".files",
  }, expected.shortTable, []);
  assert.equal(result.body, null);
  assert.equal(result.reason, "body_policy_invalid");
});

test("sources without bodyPolicies keep the legacy selector and 200-character threshold", async () => {
  const html = await sourceHtml("real-short-table.html");
  const legacy = extractSelectedBody(html, pageUrl, { bodySelector: tableSelector, publishedAtUtcOffset: "+08:00" }, expected.shortTable);
  assert.equal(legacy.body, null);
  assert.equal(legacy.reason, "short_body_not_allowed");
  const explicitLegacyOptIn = extractSelectedBody(html, pageUrl, { bodySelector: tableSelector, allowShortBody: true, publishedAtUtcOffset: "+08:00" }, expected.shortTable);
  assert.equal(explicitLegacyOptIn.body?.text.length, 180);
});

test("an article-body extraction policy failure does not fall back to Readability or Jina", async () => {
  const html = await sourceHtml("negative-short-multip.html");
  let fetches = 0;
  let failure: string | null = null;
  const got = await extractFromUrl(pageUrl, {
    allowJina: true,
    subject: "policy-test",
    selectedBody: { config: { bodyPolicies: policies, publishedAtUtcOffset: "+08:00" }, expected: expected.shortMultip, allowUrlPrefixes: [] },
    onSelectedBodyFailure: (reason) => { failure = reason; },
    fetcher: async (url) => {
      fetches += 1;
      return { status: 200, url, headers: new Headers({ "content-type": "text/html" }), body: Buffer.from(html), text: () => html };
    },
  });
  assert.equal(got, null);
  assert.equal(failure, "short_body_not_allowed");
  assert.equal(fetches, 1);
});
