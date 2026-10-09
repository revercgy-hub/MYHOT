import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { config } from "../packages/backend/src/config.ts";
import { fetchDetail } from "../packages/backend/src/sources/web-list.ts";
import { fetchGovcnJsonPage } from "../packages/backend/src/sources/json-list.ts";
import {
  createGovcnJsonPaginationBudget,
  govcnCandidateInWindow,
  govcnJsonPageUrl,
  readGovcnJsonPages,
  readGovcnJsonPagination,
  validateGovcnJsonPagination,
} from "../packages/backend/src/sources/json-list-pagination.ts";
import { unsupportedConfig } from "../packages/backend/src/sources/config-keys.ts";
import type { Candidate, SourceRow } from "../packages/backend/src/sources/types.ts";

const fixtureBytes = readFileSync(new URL("./fixtures/govcn-detail-identity/policy-search-response.json", import.meta.url));
const detailBytes = readFileSync(new URL("./fixtures/govcn-detail-identity/fiscal-policy-detail.html", import.meta.url));
const fixture = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(fixtureBytes));
const registry = JSON.parse(readFileSync(new URL("../industry/sources.json", import.meta.url), "utf8"));
const source = registry.sources.find((row: any) => row.id === "govcn-policy-library") as SourceRow;
const exactBase = "https://sousuo.www.gov.cn/search-gov/data?q=&sort=score&sortType=1&searchfield=title&p=1&n=5&type=gwyzcwjk";
const pageOne = govcnJsonPageUrl(exactBase, 1);
const pageTwo = govcnJsonPageUrl(exactBase, 2);
const backendRequire = createRequire(new URL("../packages/backend/src/lib/http-fetch.ts", import.meta.url));
const { getGlobalDispatcher, MockAgent, setGlobalDispatcher } = backendRequire("undici") as any;

function syntheticPage2() {
  const copy = structuredClone(fixture);
  const rows = copy.searchVO.catMap.bumenfile.listVO as Record<string, unknown>[];
  rows[4] = {
    ...rows[0],
    id: "synthetic-govcn-page-2-only",
    title: "合成测试第二页财政政策样本",
    url: "https://www.gov.cn/zhengce/zhengceku/209901/content_9999999.htm",
    pubtime: 1790777520000,
  };
  copy.paramsVO.p = 2;
  return Buffer.from(JSON.stringify(copy), "utf8");
}

async function withMockAgent<T>(run: (agent: any) => Promise<T>): Promise<T> {
  const agent = new MockAgent();
  agent.disableNetConnect();
  const priorDispatcher = getGlobalDispatcher();
  const priorPrivate = config.allowPrivateNetworkFetch;
  try {
    config.allowPrivateNetworkFetch = true;
    setGlobalDispatcher(agent);
    return await run(agent);
  } finally {
    setGlobalDispatcher(priorDispatcher);
    config.allowPrivateNetworkFetch = priorPrivate;
    await agent.close();
  }
}

function intercept(agent: any, urlText: string, reply: unknown, status = 200, contentType = "application/json; charset=utf-8") {
  const url = new URL(urlText);
  agent.get(url.origin).intercept({ path: url.pathname + url.search, method: "GET" })
    .reply(status, reply, { headers: { "content-type": contentType } });
}

test("GovCN pagination config is explicit, bounded, and rejected on NFRA or HTML sources", () => {
  assert.deepEqual(validateGovcnJsonPagination("json_list", source.config), []);
  assert.deepEqual(unsupportedConfig("json_list", source.config), []);
  assert.equal(readGovcnJsonPagination(source.config)?.maxPagesPerRun, 2);
  assert.equal(govcnJsonPageUrl(exactBase, 1), pageOne);
  assert.equal(govcnJsonPageUrl(exactBase, 2), "https://sousuo.www.gov.cn/search-gov/data?q=&sort=score&sortType=1&searchfield=title&p=2&n=5&type=gwyzcwjk");
  for (const pagination of [
    { mode: "mof_index_v1", maxPagesPerRun: 2, maxDispatches: 7 },
    { mode: "govcn_query_v1", maxPagesPerRun: 3, maxDispatches: 7 },
    { mode: "govcn_query_v1", maxPagesPerRun: 2, maxDispatches: 13 },
    { mode: "govcn_query_v1", maxPagesPerRun: 2, maxDispatches: 7, maxPageIndex: 4 },
  ]) assert.notDeepEqual(validateGovcnJsonPagination("json_list", { ...source.config, pagination }).length, 0);
  assert.notDeepEqual(validateGovcnJsonPagination("web_list", { ...source.config, pagination: source.config.pagination }).length, 0);
  const nfra = registry.sources.find((row: any) => row.id === "nfra-regulatory-dynamics");
  assert.ok(unsupportedConfig("json_list", { ...nfra.config, pagination: source.config.pagination }).length > 0);
  assert.throws(() => govcnJsonPageUrl("https://sousuo.www.gov.cn/search-gov/data?q=other&p=1&n=5", 2));
  assert.throws(() => govcnJsonPageUrl(exactBase, 3));
});

test("two bounded list reads preserve the fixed query, cap each raw page, and dedupe page overlap", async () => {
  await withMockAgent(async (agent) => {
    intercept(agent, pageOne, fixtureBytes);
    intercept(agent, pageTwo, syntheticPage2());
    const pagination = readGovcnJsonPagination(source.config)!;
    const budget = createGovcnJsonPaginationBudget(source, pagination);
    try {
      const candidates = await readGovcnJsonPages(source, pagination, budget);
      assert.equal(candidates.length, 6, "the repeated four rows are one material identity each");
      assert.equal(budget.dispatchesUsed(), 2);
      assert.equal(budget.pagesFetched(), 2);
      const summary = budget.summary();
      assert.equal(summary.partial, true);
      assert.equal(summary.coverage, "unproven");
      assert.equal(summary.stopReason, "max_pages_per_run");
      assert.equal(summary.uniqueCandidates, 6);
    } finally { budget.dispose(); }
  });
});

test("short and empty pages do not claim completeness, and a reordered duplicate page stops", async () => {
  await withMockAgent(async (agent) => {
    const shortPage = structuredClone(fixture);
    shortPage.searchVO.catMap.bumenfile.listVO = shortPage.searchVO.catMap.bumenfile.listVO.slice(0, 2);
    const reorderedPage = structuredClone(shortPage);
    reorderedPage.paramsVO.p = 2;
    reorderedPage.searchVO.catMap.bumenfile.listVO.reverse();
    intercept(agent, pageOne, Buffer.from(JSON.stringify(shortPage)), 200, "application/json");
    intercept(agent, pageTwo, Buffer.from(JSON.stringify(reorderedPage)), 200, "application/json");
    const pagination = readGovcnJsonPagination(source.config)!;
    const budget = createGovcnJsonPaginationBudget(source, pagination);
    try {
      const candidates = await readGovcnJsonPages(source, pagination, budget);
      assert.equal(candidates.length, 2);
      assert.equal(budget.pagesFetched(), 2, "a short first page still reads the next configured page");
      assert.equal(budget.summary().stopReason, "duplicate_page");
      assert.equal(budget.summary().partial, true);
    } finally { budget.dispose(); }
  });

  await withMockAgent(async (agent) => {
    const empty = structuredClone(fixture);
    empty.searchVO.catMap.bumenfile.listVO = [];
    intercept(agent, pageOne, Buffer.from(JSON.stringify(empty)), 200, "application/json");
    const pagination = readGovcnJsonPagination(source.config)!;
    const budget = createGovcnJsonPaginationBudget(source, pagination);
    try {
      assert.deepEqual(await readGovcnJsonPages(source, pagination, budget), []);
      assert.equal(budget.pagesFetched(), 1);
      assert.equal(budget.summary().stopReason, "empty_page");
      assert.equal(budget.summary().partial, true);
    } finally { budget.dispose(); }
  });
});

test("GovCN page failures reject malformed responses, non-JSON, bad UTF-8, redirects and excess raw rows", async () => {
  const tooManyRows = structuredClone(fixture);
  tooManyRows.searchVO.catMap.bumenfile.listVO.push(tooManyRows.searchVO.catMap.bumenfile.listVO[0]);
  const cases = [
    { body: fixtureBytes, status: 503, type: "application/json", error: /HTTP 503/ },
    { body: fixtureBytes, status: 200, type: "text/html", error: /not JSON/ },
    { body: Buffer.from([0xff, 0xfe]), status: 200, type: "application/json", error: /UTF-8/ },
    { body: Buffer.from("{}"), status: 200, type: "application/json", error: /invalid GovCN/ },
    { body: Buffer.from(JSON.stringify({ ...fixture, code: 500 })), status: 200, type: "application/json", error: /invalid GovCN/ },
    { body: Buffer.from(JSON.stringify(tooManyRows)), status: 200, type: "application/json", error: /five-row cap/ },
  ];
  for (const item of cases) {
    await withMockAgent(async (agent) => {
      intercept(agent, pageOne, item.body, item.status, item.type);
      await assert.rejects(fetchGovcnJsonPage(source, 1), item.error);
    });
  }
  await withMockAgent(async (agent) => {
    const requests = { value: 0 };
    const url = new URL(pageOne);
    agent.get(url.origin).intercept({ path: url.pathname + url.search, method: "GET" }).reply(() => {
      requests.value++;
      return { statusCode: 302, headers: { location: pageTwo }, data: "" };
    });
    await assert.rejects(fetchGovcnJsonPage(source, 1), /HTTP 302/);
    assert.equal(requests.value, 1, "the zero-redirect setting rejects before another dispatch");
  });
});

test("one run budget admits only exact page/detail targets and enforces caps before dispatch", () => {
  const pagination = { mode: "govcn_query_v1" as const, maxPagesPerRun: 2, maxDispatches: 7 };
  const budget = createGovcnJsonPaginationBudget(source, pagination);
  try {
    budget.setPage(1);
    budget.runBudget.beforeDispatch({ url: new URL(pageOne), method: "GET", redirectHop: 0 });
    assert.equal(budget.admitDetail("https://www.gov.cn/zhengce/zhengceku/202609/content_7082302.htm"), true);
    budget.runBudget.beforeDispatch({ url: new URL("https://www.gov.cn/zhengce/zhengceku/202609/content_7082302.htm"), method: "GET", redirectHop: 0 });
    assert.equal(budget.dispatchesUsed(), 2);
    assert.equal(budget.detailTargetsUsed(), 1);
    budget.clearDetail();
    assert.equal(budget.admitDetail("https://example.com/other"), false);
    assert.equal(budget.admitDetail("https://www.gov.cn/zhengce/zhengceku/202609/content_7082302.htm?x=1"), false);
    budget.clearDetail();
    for (let i = 0; i < 4; i++) assert.equal(budget.admitDetail(`https://www.gov.cn/zhengce/zhengceku/202609/content_${7000000 + i}.htm`), true);
    assert.equal(budget.admitDetail("https://www.gov.cn/zhengce/zhengceku/202609/content_7000005.htm"), false, "detail target cap applies across the whole run");
    assert.equal(budget.detailTargetsUsed(), 5);
    budget.clearDetail();
    assert.throws(() => budget.runBudget.beforeDispatch({ url: new URL("https://sousuo.www.gov.cn/search-gov/data?q=&sort=score&sortType=1&searchfield=title&p=3&n=5&type=gwyzcwjk"), method: "GET", redirectHop: 0 }));
    assert.throws(() => budget.runBudget.beforeDispatch({ url: new URL(pageOne), method: "GET", redirectHop: 1 }));
    assert.equal(budget.summary().coverage, "unproven");
  } finally { budget.dispose(); }
});

test("detail reads use the shared dispatch budget, remaining deadline and zero redirects", async () => {
  const row = fixture.searchVO.catMap.bumenfile.listVO.find((item: any) => item.url === "https://www.gov.cn/zhengce/zhengceku/202609/content_7082302.htm");
  const url = row.url as string;
  const pagination = readGovcnJsonPagination(source.config)!;
  const budget = createGovcnJsonPaginationBudget(source, pagination);
  try {
    budget.setPage(1);
    budget.runBudget.beforeDispatch({ url: new URL(pageOne), method: "GET", redirectHop: 0 });
    assert.equal(budget.admitDetail(url), true);
    const capture: { optionsSeen?: Record<string, unknown> } = {};
    const result = await fetchDetail(url, source, {
      date: false, title: false, summary: false, body: true,
      expectedTitle: row.title, expectedPublishedAt: new Date(Number(row.pubtime)),
    }, {
      runBudget: budget.runBudget,
      remainingMs: budget.remainingMs,
      fetcher: (async (requestedUrl: string, options: Record<string, any>) => {
        capture.optionsSeen = options;
        options.runBudget.beforeDispatch({ url: new URL(requestedUrl), method: "GET", redirectHop: 0 });
        return { status: 200, url: requestedUrl, headers: new Headers({ "content-type": "text/html; charset=utf-8" }), body: detailBytes, text: () => detailBytes.toString("utf8") } as never;
      }) as never,
    });
    assert.ok(result.body);
    assert.equal(capture.optionsSeen?.maxRedirects, 0);
    assert.equal(capture.optionsSeen?.runBudget, budget.runBudget);
    assert.ok(Number(capture.optionsSeen?.timeoutMs) <= 20_000);
    assert.equal(budget.dispatchesUsed(), 2, "page and detail use one shared dispatch counter");
  } finally { budget.dispose(); }
});

test("deadline rejects before dispatch and every run applies its fixed date window regardless of cursor", () => {
  const pagination = readGovcnJsonPagination(source.config)!;
  const sourceWithCursor = { ...source, cursor: { initializedAt: "2026-10-01T00:00:00.000Z" } };
  const budget = createGovcnJsonPaginationBudget(sourceWithCursor, pagination);
  const originalNow = Date.now;
  const start = Date.now();
  try {
    budget.setPage(1);
    const within = new Date(budget.cutoffAt.getTime() + 60_000);
    const old = new Date(budget.cutoffAt.getTime() - 60_000);
    const future = new Date(budget.anchorAt.getTime() + 2 * 60 * 60_000);
    const candidate = (publishedAt: Date | null): Candidate => ({ url: "https://www.gov.cn/zhengce/zhengceku/test.htm", title: "Fixture", author: null, publishedAt, excerpt: "summary", bodyText: null, bodyStatus: "pending", raw: { externalId: "fixture" } });
    assert.equal(govcnCandidateInWindow(candidate(within), budget), true);
    assert.equal(govcnCandidateInWindow(candidate(old), budget), false);
    assert.equal(govcnCandidateInWindow(candidate(future), budget), false);
    assert.equal(govcnCandidateInWindow(candidate(null), budget), false);
    assert.equal(budget.summary().rowsOutsideWindow, 2);

    Date.now = () => start + 120_001;
    assert.throws(() => budget.assertActive(), /deadline/);
    assert.throws(() => budget.runBudget.beforeDispatch({ url: new URL(pageOne), method: "GET", redirectHop: 0 }));
    assert.equal(budget.dispatchesUsed(), 0, "deadline expiry rejects before a request dispatch");
  } finally {
    Date.now = originalNow;
    budget.dispose();
  }
});
