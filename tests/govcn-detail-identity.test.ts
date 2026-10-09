import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import * as cheerio from "cheerio";
import { config } from "@aihot/backend/config";
import { fetchJsonList } from "@aihot/backend/sources/json-list";
import { fetchDetail } from "@aihot/backend/sources/web-list";
import { extractSelectedBody, type BodyIdentity } from "@aihot/backend/content/selected-body";
import { extractHtmlEnvelopeWithPdf } from "@aihot/backend/content/pdf-body";
import { extractFromUrl } from "@aihot/backend/content/extract";
import { unsupportedConfig } from "@aihot/backend/sources/config-keys";
import type { GuardedResponse } from "@aihot/backend/lib/http-fetch";

const backendRequire = createRequire(new URL("../packages/backend/src/lib/http-fetch.ts", import.meta.url));
const { getGlobalDispatcher, MockAgent, setGlobalDispatcher } = backendRequire("undici") as any;
const queryUrl = "https://sousuo.www.gov.cn/search-gov/data?q=&sort=score&sortType=1&searchfield=title&p=1&n=5&type=gwyzcwjk";
const detailUrl = "https://www.gov.cn/zhengce/zhengceku/202609/content_7082302.htm";
const queryBytes = readFileSync(new URL("./fixtures/govcn-detail-identity/policy-search-response.json", import.meta.url));
const detailBytes = readFileSync(new URL("./fixtures/govcn-detail-identity/fiscal-policy-detail.html", import.meta.url));
const query = JSON.parse(queryBytes.toString("utf8")) as any;
const source = JSON.parse(readFileSync(new URL("../industry/sources.json", import.meta.url), "utf8")).sources.find((row: any) => row.id === "govcn-policy-library");
const identityOnlyConfig = { ...source.config };
delete identityOnlyConfig.pagination;
const candidateRow = query.searchVO.catMap.bumenfile.listVO.find((row: any) => row.url === detailUrl);
assert.ok(candidateRow);
const expectedTitle = candidateRow.title as string;
const expectedDate = new Date(Number(candidateRow.pubtime));
const html = detailBytes.toString("utf8");
const titleRegex = source.config.detail.titleRegex as string;
const publishedAtRegex = source.config.detail.publishedAtRegex as string;
const expected = { title: expectedTitle, publishedAt: expectedDate };
const readyHtml = html.replace("</head>", '<meta name="ArticleTitle" content="' + expectedTitle + '"><meta name="PubDate" content="2026-09-28"></head>');

const agent = new MockAgent();
agent.disableNetConnect();
let priorDispatcher: unknown;
let priorPrivateNetwork = false;

before(() => {
  priorDispatcher = getGlobalDispatcher();
  priorPrivateNetwork = config.allowPrivateNetworkFetch;
  config.allowPrivateNetworkFetch = true;
  setGlobalDispatcher(agent);
});

after(async () => {
  setGlobalDispatcher(priorDispatcher);
  config.allowPrivateNetworkFetch = priorPrivateNetwork;
  await agent.close();
});

function selected(config: Record<string, unknown>, page = html, expectedIdentity: BodyIdentity = expected) {
  return extractSelectedBody(page, detailUrl, config, expectedIdentity);
}

test("GovCN fixture mapping stays a 5-row summary-only JSON list", async () => {
  const url = new URL(queryUrl);
  agent.get(url.origin).intercept({ path: url.pathname + url.search, method: "GET" })
    .reply(200, queryBytes, { headers: { "content-type": "application/json; charset=utf-8" } });
  const candidates = await fetchJsonList(source);
  assert.equal(candidates.length, 5);
  const candidate = candidates.find((row) => row.url === detailUrl)!;
  assert.equal(candidate.title, expectedTitle);
  assert.equal(candidate.publishedAt?.getTime(), expectedDate.getTime());
  assert.equal(candidate.bodyStatus, "pending");
  assert.equal(candidate.bodyText, null);
  assert.ok(candidate.excerpt);
  assert.deepEqual(unsupportedConfig("json_list", source.config), []);
  assert.equal(source.enabled, false);
  assert.equal(source.site_fulltext, false);
  assert.equal(source.syndicate_fulltext, false);
});

test("explicit regex identity passes the saved pair and absent rules keep legacy identity behavior", () => {
  const baseline = selected({ bodySelector: "#UCAP-CONTENT .trs_editor_view" });
  assert.equal(baseline.body, null);
  assert.equal(baseline.reason, "identity_missing");

  const exact = selected({ bodySelector: "#UCAP-CONTENT .trs_editor_view", titleRegex, publishedAtRegex, publishedAtUtcOffset: "+08:00" });
  assert.ok(exact.body);
  assert.ok(exact.body!.text.length >= 200);
  assert.equal(exact.body!.via, "selector");

  const titleOnly = selected({ bodySelector: "#UCAP-CONTENT .trs_editor_view", titleRegex }, readyHtml);
  assert.ok(titleOnly.body, "date continues to use the existing PubDate metadata chain");
  const dateOnly = selected({ bodySelector: "#UCAP-CONTENT .trs_editor_view", publishedAtRegex, publishedAtUtcOffset: "+08:00" }, readyHtml);
  assert.ok(dateOnly.body, "title continues to use the existing ArticleTitle metadata chain");
});

test("configured regex failures are closed and cannot fall back to matching default metadata", () => {
  const bodySelector = "#UCAP-CONTENT .trs_editor_view";
  const defaulted = readyHtml;
  const invalidRules: Record<string, unknown>[] = [
    { titleRegex: "" },
    { titleRegex: "[" },
    { titleRegex: "x".repeat(1_001) },
    { titleRegex: "<title>()_国务院部门文件_中国政府网</title>" }, // empty capture
    { titleRegex: "NOT_PRESENT(.*)" },
    { publishedAtRegex: "" },
    { publishedAtRegex: "(" },
    { publishedAtRegex: "x".repeat(1_001) },
    { publishedAtRegex: "name=\"firstpublishedtime\" content=\"(not-a-date)" },
    { publishedAtRegex: "MISSING(.*)" },
    { titleRegex: null },
  ];
  for (const rules of invalidRules) {
    const result = selected({ bodySelector, ...rules }, defaulted);
    assert.equal(result.body, null, JSON.stringify(rules));
    assert.ok(result.reason === "identity_missing" || result.reason === "identity_mismatch", JSON.stringify(rules));
  }
  for (const rules of [
    { titleRegex: "" }, { titleRegex: "[" }, { titleRegex: "x".repeat(1_001) }, { titleRegex: null },
    { publishedAtRegex: "" }, { publishedAtRegex: "(" }, { publishedAtRegex: "x".repeat(1_001) },
  ]) {
    assert.ok(unsupportedConfig("json_list", { ...identityOnlyConfig, detail: { ...source.config.detail, ...rules } }).length > 0,
      `source config rejects ${JSON.stringify(rules)}`);
  }
  for (const noCapture of [
    { titleRegex: "<title>.*?</title>" },
    { publishedAtRegex: "name=\"firstpublishedtime\" content=\"\\d{4}-\\d{2}-\\d{2}-\\d{2}:\\d{2}:\\d{2}\"" },
  ]) {
    assert.equal(selected({ bodySelector, ...noCapture }, defaulted).body, null, "a valid expression without group 1 fails closed");
    assert.deepEqual(unsupportedConfig("json_list", { ...identityOnlyConfig, detail: { ...source.config.detail, ...noCapture } }), [],
      "source-config validation checks syntax/length; missing capture is caught at runtime");
  }
  assert.equal(selected({ bodySelector, titleRegex, publishedAtRegex }, html, { ...expected, title: `${expectedTitle}错` }).body, null);
  assert.equal(selected({ bodySelector, titleRegex, publishedAtRegex }, html, { ...expected, publishedAt: new Date("2026-09-25T00:00:00+08:00") }).body, null);
  assert.equal(selected({ bodySelector, titleRegex, publishedAtRegex }, html, { ...expected, publishedAt: null } as BodyIdentity).body, null);
});

test("body threshold, selected container and attachment rejection remain unchanged", () => {
  const bodySelector = "#UCAP-CONTENT .trs_editor_view";
  const rules = { bodySelector, titleRegex, publishedAtRegex, publishedAtUtcOffset: "+08:00" };
  assert.equal(selected({ ...rules, bodySelector: ".does-not-exist" }).body, null);
  const shortHtml = '<html><head><title>x</title><meta name="PubDate" content="2026-09-28"></head><body><article><div class="body"><p>短文本。</p></div></article></body></html>';
  const shortRules = { bodySelector: ".body", titleRegex: "<title>(x)</title>", publishedAtRegex: 'name="PubDate" content="(\\d{4}-\\d{2}-\\d{2})', publishedAtUtcOffset: "+08:00" };
  assert.equal(selected(shortRules, shortHtml).body, null);
  const attachedPage = cheerio.load(html, null, false);
  attachedPage("#UCAP-CONTENT .trs_editor_view").append('<p><a href="/files/notice.pdf">PDF</a></p>');
  const attached = attachedPage.html() ?? "";
  assert.equal(selected(rules, attached).reason, "attachments_unprocessed");
});

test("fetchDetail passes the explicit identity rules while retaining the listing identity", async () => {
  let requested: { url: string; timeoutMs?: number; maxBytes?: number } | null = null;
  const responseBytes = Buffer.from(html, "utf8");
  const fetcher = async (url: string, options: any): Promise<GuardedResponse> => {
    requested = { url, timeoutMs: options.timeoutMs, maxBytes: options.maxBytes };
    const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
    return { url, status: 200, headers, body: responseBytes, text: () => responseBytes.toString("utf8") };
  };
  const result = await fetchDetail(detailUrl, source, {
    title: true, date: true, summary: false, body: true, expectedTitle, expectedPublishedAt: expectedDate,
  }, { fetcher });
  assert.ok(result.body);
  assert.equal(result.title, expectedTitle);
  assert.equal(result.publishedAt && new Date(result.publishedAt.getTime() + 8 * 60 * 60_000).toISOString().slice(0, 10),
    new Date(expectedDate.getTime() + 8 * 60 * 60_000).toISOString().slice(0, 10),
    "detail metadata may parse to local midnight but must retain the same source-local day as the original list epoch");
  assert.deepEqual(requested, { url: detailUrl, timeoutMs: 20_000, maxBytes: 6 * 1024 * 1024 });
});

test("delayed extraction and envelope preserve the explicit rules without dispatching an attachment", async () => {
  const responseBytes = Buffer.from(html, "utf8");
  const fetcher = async (url: string): Promise<GuardedResponse> => ({
    url, status: 200, headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
    body: responseBytes, text: () => responseBytes.toString("utf8"),
  });
  const bodyConfig = { bodySelector: "#UCAP-CONTENT .trs_editor_view", titleRegex, publishedAtRegex, publishedAtUtcOffset: "+08:00" };
  const failures: string[] = [];
  const delayed = await extractFromUrl(detailUrl, {
    allowJina: false, subject: "offline-govcn-test", selectedBody: { config: bodyConfig, expected, allowUrlPrefixes: source.config.allowUrlPrefixes },
    onSelectedBodyFailure: (reason) => failures.push(reason), fetcher,
  });
  assert.ok(delayed);
  assert.deepEqual(failures, []);

  let attachmentFetches = 0;
  const envelope = await extractHtmlEnvelopeWithPdf(html, detailUrl, {
    articleSelector: "#UCAP-CONTENT", attachmentSelector: ".no-attachments-on-this-page",
    attachmentMode: "optional", ...bodyConfig,
    titleRegex: "MISMATCH(.*)",
  }, expected, source.config.allowUrlPrefixes, async () => {
    attachmentFetches += 1;
    throw new Error("identity failure must not fetch an attachment");
  });
  assert.equal(envelope.body, null);
  assert.equal(envelope.reason, "identity_missing");
  assert.equal(attachmentFetches, 0);
});
