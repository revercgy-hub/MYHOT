import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";
import { config } from "../packages/backend/src/config.ts";
import { extractNfraJsonSelectedBody } from "../packages/backend/src/content/selected-body.ts";
import { fetchNfraJsonDetail, createNfraJsonRunBudget } from "../packages/backend/src/content/nfra-json-detail.ts";
import { extractFromUrl } from "../packages/backend/src/content/extract.ts";
import { fetchDetail } from "../packages/backend/src/sources/web-list.ts";
import { readAttachmentDiagnostic } from "../packages/backend/src/content/attachment-diagnostics.ts";
import { fetchJsonList, mapNfraCategoryItem, selectNfraCategoryRows } from "../packages/backend/src/sources/json-list.ts";
import { unsupportedConfig } from "../packages/backend/src/sources/config-keys.ts";

const listBytes = readFileSync(new URL("./fixtures/nfra-json-detail/list.json", import.meta.url));
const detailBytes = readFileSync(new URL("./fixtures/nfra-json-detail/detail.json", import.meta.url));
const listText = new TextDecoder("utf-8", { fatal: true }).decode(listBytes);
const detailText = new TextDecoder("utf-8", { fatal: true }).decode(detailBytes);
const list = JSON.parse(listText) as Record<string, unknown>;
const detail = JSON.parse(detailText) as { data: Record<string, unknown> };
const selection = { arrayPath: "data", categoryIdPath: "itemId", categoryId: 915, itemsPath: "docInfoVOList" };
const expected = {
  docId: 1273452,
  title: "金融监管总局 科技部等部门联合召开科技保险交流推进会 多方协同支持科技创新",
  publishedAt: new Date("2026-09-28T17:35:08+08:00"),
};
const source = {
  id: "nfra-regulatory-dynamics", kind: "json_list", config: {
    url: "https://www.nfra.gov.cn/cbircweb/DocInfo/SelectItemAndDocByItemPId?itemId=914&pageSize=6",
    categorySelection: selection,
    allowUrlPrefixes: ["https://www.nfra.gov.cn/cn/view/pages/ItemDetail.html?"],
    summaryIsBody: false,
    publishedAtUtcOffset: "+08:00",
    _aihot: { initialBackfillMonths: 3, initialBackfillRequirePublishedAt: true, requireBodyReadyForAutomaticSelection: true },
    detail: { mode: "nfra_json_v1", maxFetches: 6, publishedAtUtcOffset: "+08:00", bodySelector: ".Section0" },
  },
};
const articleUrl = "https://www.nfra.gov.cn/cn/view/pages/ItemDetail.html?docId=1273452&itemId=915";

const backendRequire = createRequire(new URL("../packages/backend/src/lib/http-fetch.ts", import.meta.url));
const { getGlobalDispatcher, MockAgent, setGlobalDispatcher } = backendRequire("undici") as any;

test("saved NFRA fixtures are exact raw UTF-8 evidence and category selection is ID based", () => {
  assert.equal(createHash("sha256").update(listBytes).digest("hex"), "a45ad64cf1313e75850616e77a2e1cf65036008e7b1e51e915c07c3d5c914600");
  assert.equal(createHash("sha256").update(detailBytes).digest("hex"), "b6e46388f904c8c8fead84cc66997b0a11dc4eca79e02fd03de1556fa7fc2af7");
  assert.equal((list as { rptCode: number }).rptCode, 200);
  const originalRows = selectNfraCategoryRows(list, selection);
  assert.equal(originalRows.length, 6);
  const shuffled = { ...list, data: [...(list.data as unknown[]).slice().reverse()] };
  assert.deepEqual(selectNfraCategoryRows(shuffled, selection), originalRows);
  assert.throws(() => selectNfraCategoryRows({ ...list, data: [] }, selection), /missing or ambiguous/);
  assert.throws(() => selectNfraCategoryRows({ ...list, data: [...(list.data as unknown[]), (list.data as unknown[]).find((row) => (row as { itemId: number }).itemId === 915)] }, selection), /missing or ambiguous/);
  assert.throws(() => selectNfraCategoryRows({ ...list, data: {} }, selection), /array/);
  assert.throws(() => selectNfraCategoryRows({ ...(list as object), rptCode: "200" }, selection), /invalid NFRA/);
  const row = (originalRows as Record<string, unknown>[]).find((item) => item.docId === expected.docId)!;
  const candidate = mapNfraCategoryItem(row);
  assert.equal(candidate?.url, articleUrl);
  assert.equal(candidate?.title, expected.title);
  assert.equal(candidate?.publishedAt?.toISOString(), expected.publishedAt.toISOString());
  assert.equal(candidate?.bodyStatus, "pending");
  assert.equal(candidate?.bodyText, null);
  assert.equal((candidate?.raw as { externalId: number }).externalId, expected.docId);
  assert.equal(readAttachmentDiagnostic(candidate?.raw)?.reason, undefined);
  assert.equal(readAttachmentDiagnostic({ ...(candidate?.raw as Record<string, unknown>), ...(candidate?.attachmentDiagnostic as unknown as Record<string, unknown>) }), null, "upstream candidate fields cannot forge the reserved marker");
  assert.equal(candidate?.attachmentDiagnostic?.reason, "attachments_unprocessed");
  for (const missing of [{ ...row, docFileUrl: undefined, pdfFileUrl: undefined }, { ...row, docFileUrl: 7, pdfFileUrl: null }]) {
    assert.equal(mapNfraCategoryItem(missing)?.attachmentDiagnostic?.reason, "attachments_unprocessed", "absent or malformed list fields remain unknown");
  }
  assert.equal(mapNfraCategoryItem({ ...row, isTitleLink: "1" }), null);
  assert.equal(mapNfraCategoryItem({ ...row, docId: "1273452" }), null);
  assert.deepEqual(unsupportedConfig("json_list", source.config), []);
  assert.ok(unsupportedConfig("json_list", { ...source.config, itemsPath: "data" }).length > 0);
  assert.ok(unsupportedConfig("json_list", { ...source.config, detail: { ...source.config.detail, titleRegex: "x" } }).length > 0);
});

test("fetchJsonList maps the exact saved NFRA fixture through a network-disabled official-origin interceptor", async () => {
  const agent = new MockAgent();
  agent.disableNetConnect();
  const priorDispatcher = getGlobalDispatcher();
  const priorPrivateNetwork = config.allowPrivateNetworkFetch;
  const listUrl = new URL(source.config.url);
  try {
    config.allowPrivateNetworkFetch = true;
    setGlobalDispatcher(agent);
    agent.get(listUrl.origin).intercept({ path: listUrl.pathname + listUrl.search, method: "GET" })
      .reply(200, listBytes, { headers: { "content-type": "application/json; charset=utf-8" } });
    const candidates = await fetchJsonList(source as never);
    assert.equal(candidates.length, 6);
    const candidate = candidates.find((entry) => (entry.raw as { externalId: number }).externalId === expected.docId)!;
    assert.equal(candidate.url, articleUrl);
    assert.equal(candidate.title, expected.title);
    assert.equal(candidate.publishedAt?.toISOString(), expected.publishedAt.toISOString());
    assert.equal(candidate.bodyStatus, "pending");
    assert.equal(candidate.bodyText, null);
    assert.equal(candidate.attachmentDiagnostic?.reason, "attachments_unprocessed");
  } finally {
    setGlobalDispatcher(priorDispatcher);
    config.allowPrivateNetworkFetch = priorPrivateNetwork;
    await agent.close();
  }
});

test("fetchJsonList rejects an NFRA list redirect without dispatching a second request", async () => {
  const agent = new MockAgent();
  agent.disableNetConnect();
  const priorDispatcher = getGlobalDispatcher();
  const priorPrivateNetwork = config.allowPrivateNetworkFetch;
  const listUrl = new URL(source.config.url);
  let requests = 0;
  try {
    config.allowPrivateNetworkFetch = true;
    setGlobalDispatcher(agent);
    agent.get(listUrl.origin).intercept({ path: listUrl.pathname + listUrl.search, method: "GET" })
      .reply(() => {
        requests++;
        return { statusCode: 302, headers: { location: "https://www.nfra.gov.cn/cbircweb/DocInfo/other" }, data: "" };
      });
    await assert.rejects(fetchJsonList(source as never), /HTTP 302/);
    assert.equal(requests, 1, "the configured zero-redirect policy prevents a second dispatch");
  } finally {
    setGlobalDispatcher(priorDispatcher);
    config.allowPrivateNetworkFetch = priorPrivateNetwork;
    await agent.close();
  }
});

test("NFRA detail identity is checked against original list title, date, ID, and strict UTF-8 JSON", async () => {
  assert.equal(detail.data.docId, expected.docId);
  assert.equal((detail.data.docClob as string).includes("charset=gb2312"), true, "inner HTML meta does not recode the UTF-8 JSON envelope");
  assert.equal((detail.data.docClob as string).includes("\uFFFD"), false);
  const checked = extractNfraJsonSelectedBody(detailText, articleUrl, { bodySelector: ".Section0", publishedAtUtcOffset: "+08:00" }, expected);
  assert.equal(checked.identityValid, true);
  assert.equal(checked.docId, expected.docId);
  assert.equal(checked.publishDate?.toISOString(), expected.publishedAt.toISOString());
  assert.equal(checked.selected?.body?.text.length! > 200, true, "the selected raw body is inspectable internally but is not source-ready");
  for (const mutation of [
    (root: any) => { root.data.docId = 1273453; },
    (root: any) => { root.data.docSubtitle = "different title"; },
    (root: any) => { root.data.publishDate = "2026-09-29 00:00:00"; },
    (root: any) => { root.data.publishDate = "2026-02-30 00:00:00"; },
    (root: any) => { delete root.data.docClob; },
  ]) {
    const altered = JSON.parse(detailText);
    mutation(altered);
    const result = extractNfraJsonSelectedBody(JSON.stringify(altered), articleUrl, { bodySelector: ".Section0", publishedAtUtcOffset: "+08:00" }, expected);
    assert.equal(result.identityValid && result.selected !== null, false);
  }
  assert.equal(extractNfraJsonSelectedBody("{\"rptCode\":200,\"data\":{}}", articleUrl, { bodySelector: ".Section0" }, expected).identityValid, false);
});

test("actual NFRA detail pair stays body-null and attachment-pending; target URL is fixed", async () => {
  let calls = 0;
  const fetcher = async (url: string, options: Record<string, unknown>) => {
    calls += 1;
    assert.equal(url, "https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1273452");
    assert.equal(options.method, "GET");
    assert.equal(options.maxRedirects, 0);
    assert.equal(options.maxBytes, 1024 * 1024);
    return { status: 200, url, headers: new Headers({ "content-type": "application/json; charset=utf-8" }), body: detailBytes } as never;
  };
  const result = await fetchNfraJsonDetail(articleUrl, source as never, { ...expected, listAttachmentPending: true }, { fetcher: fetcher as never });
  assert.equal(calls, 1);
  assert.equal(result.body, null);
  assert.equal(result.attachmentDiagnostic?.reason, "attachments_unprocessed");
  assert.deepEqual(result.attachmentDiagnostic?.attachments, []);
  assert.equal((detail.data.docFileUrl ?? null), null);
  assert.equal((detail.data.pdfFileUrl ?? null), null);
  assert.deepEqual(detail.data.attachmentInfoVOList, []);
  assert.throws(() => createNfraJsonRunBudget().runBudget.beforeDispatch({ url: new URL("https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1273452"), method: "GET", redirectHop: 0 }), /bounded dispatch rejected|detail dispatch budget exhausted/);
  const budget = createNfraJsonRunBudget();
  budget.runBudget.beforeDispatch({ url: new URL("https://www.nfra.gov.cn/cbircweb/DocInfo/SelectItemAndDocByItemPId?itemId=914&pageSize=6"), method: "GET", redirectHop: 0 });
  budget.runBudget.beforeDispatch({ url: new URL("https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1273452"), method: "GET", redirectHop: 0 });
  assert.throws(() => budget.runBudget.beforeDispatch({ url: new URL("https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1273452"), method: "GET", redirectHop: 0 }), /duplicate detail/);
  budget.dispose();
  let wrongUrlCalls = 0;
  const wrongUrl = await fetchNfraJsonDetail("https://www.nfra.gov.cn/cn/view/pages/ItemDetail.html?itemId=915&docId=1273452&extra=1", source as never, { ...expected, listAttachmentPending: true }, { fetcher: (async () => { wrongUrlCalls++; throw new Error("must not dispatch"); }) as never });
  assert.equal(wrongUrlCalls, 0);
  assert.equal(wrongUrl.body, null);
  assert.equal(wrongUrl.attachmentDiagnostic?.reason, "attachments_unprocessed");
});

test("NFRA prefetch and delayed extraction share the JSON driver and never fall back to generic HTML", async () => {
  let calls = 0;
  const fetcher = async (url: string) => {
    calls++;
    return { status: 200, url, headers: new Headers({ "content-type": "application/json" }), body: detailBytes } as never;
  };
  const need = { body: true, date: false, title: false, summary: false, expectedTitle: expected.title, expectedPublishedAt: expected.publishedAt, expectedExternalId: expected.docId, listAttachmentPending: true };
  const prefetched = await fetchDetail(articleUrl, source as never, need, { fetcher: fetcher as never });
  assert.equal(prefetched.body, null);
  assert.equal(prefetched.attachmentDiagnostic?.reason, "attachments_unprocessed");
  assert.equal(calls, 1);
  const delayed = await extractFromUrl(articleUrl, {
    allowJina: true, subject: "fixture-only",
    selectedBody: {
      config: { bodySelector: ".Section0", publishedAtUtcOffset: "+08:00" },
      expected, allowUrlPrefixes: source.config.allowUrlPrefixes,
      nfra: { docId: expected.docId, listAttachmentPending: true, source: source as never },
    },
    fetcher: fetcher as never,
  });
  assert.equal(delayed, null);
  assert.equal(calls, 2);
});

test("NFRA detail failures remain pending and never invoke fallback", async () => {
  const responses = [
    { status: 503, body: detailBytes, type: "application/json" },
    { status: 200, body: detailBytes, type: "text/html" },
    { status: 200, body: Buffer.from([0xff, 0xfe]), type: "application/json" },
    { status: 200, body: Buffer.from("{bad json}"), type: "application/json" },
    { status: 200, body: Buffer.from(JSON.stringify({ rptCode: 500, data: detail.data })), type: "application/json" },
  ];
  for (const response of responses) {
    let dispatches = 0;
    const result = await fetchNfraJsonDetail(articleUrl, source as never, { ...expected, listAttachmentPending: true }, {
      fetcher: (async (url: string) => {
        dispatches++;
        return { status: response.status, url, headers: new Headers({ "content-type": response.type }), body: response.body } as never;
      }) as never,
    });
    assert.equal(dispatches, 1);
    assert.equal(result.body, null);
    assert.equal(result.attachmentDiagnostic?.reason, "attachments_unprocessed");
  }
  let reads = 0;
  const noFallback = await extractFromUrl(articleUrl, {
    allowJina: true, subject: "fixture-only",
    selectedBody: { config: { bodySelector: ".Section0" }, expected, allowUrlPrefixes: [], nfra: { docId: expected.docId, listAttachmentPending: true, source: source as never } },
    fetcher: (async () => { reads++; throw new Error("fixture transport failure"); }) as never,
  });
  assert.equal(noFallback, null);
  assert.equal(reads, 1);
});

test("NFRA selection core declines missing, duplicate, empty, and navigation-only body containers", () => {
  const mutate = (fn: (root: any) => void) => { const root = JSON.parse(detailText); fn(root); return JSON.stringify(root); };
  const invalidBodies = [
    mutate((root) => { root.data.docClob = "<div class='other'><p>not selected</p></div>"; }),
    mutate((root) => { root.data.docClob = `<div class="Section0"><p>${"A sufficiently long article body. ".repeat(12)}</p></div><div class="Section0"><p>duplicate</p></div>`; }),
    mutate((root) => { root.data.docClob = "<div class='Section0'></div>"; }),
    mutate((root) => { root.data.docClob = `<div class="Section0"><nav><ul><li>${"navigation ".repeat(40)}</li></ul></nav></div>`; }),
  ];
  for (const raw of invalidBodies) {
    const result = extractNfraJsonSelectedBody(raw, articleUrl, { bodySelector: ".Section0", publishedAtUtcOffset: "+08:00" }, expected);
    assert.equal(result.identityValid, true);
    assert.equal(result.selected?.body, null);
  }
  const scripted = mutate((root) => { root.data.docClob = `<div class="Section0"><script>PRIVATE_SCRIPT_SENTINEL</script><p>${"An operational fiscal policy paragraph. ".repeat(12)}</p></div>`; });
  const sanitized = extractNfraJsonSelectedBody(scripted, articleUrl, { bodySelector: ".Section0", publishedAtUtcOffset: "+08:00" }, expected);
  assert.equal(sanitized.selected?.body?.text.includes("PRIVATE_SCRIPT_SENTINEL"), false);
  const short = mutate((root) => { root.data.docClob = "<div class='Section0'><p>short notice</p></div>"; });
  assert.equal(extractNfraJsonSelectedBody(short, articleUrl, { bodySelector: ".Section0", publishedAtUtcOffset: "+08:00" }, expected).selected?.reason, "short_body_not_allowed");
  for (const [fields, evidence] of [
    [{ docFileUrl: "/a.doc", pdfFileUrl: "/a.pdf", attachmentInfoVOList: [], docImageInfoVOList: [] }, true],
    [{ docFileUrl: null, pdfFileUrl: null, attachmentInfoVOList: [], docImageInfoVOList: [] }, false],
    [{ docFileUrl: 12, pdfFileUrl: {}, attachmentInfoVOList: null, docImageInfoVOList: "bad" }, true],
  ]) {
    const raw = JSON.stringify({ rptCode: 200, data: { ...detail.data, ...(fields as object) } });
    const result = extractNfraJsonSelectedBody(raw, articleUrl, { bodySelector: ".Section0", publishedAtUtcOffset: "+08:00" }, expected);
    assert.equal(result.identityValid, true);
    assert.equal(result.hasAttachmentEvidence, evidence);
  }
});

test("NFRA bounded budget admits one list plus six unique detail IDs and rejects overrun, redirects, and other targets", () => {
  const budget = createNfraJsonRunBudget();
  budget.runBudget.beforeDispatch({ url: new URL("https://www.nfra.gov.cn/cbircweb/DocInfo/SelectItemAndDocByItemPId?itemId=914&pageSize=6"), method: "GET", redirectHop: 0 });
  for (let id = 1; id <= 6; id++) budget.runBudget.beforeDispatch({ url: new URL(`https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=${id}`), method: "GET", redirectHop: 0 });
  assert.throws(() => budget.runBudget.beforeDispatch({ url: new URL("https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=7"), method: "GET", redirectHop: 0 }), /budget exhausted|bounded dispatch rejected/);
  assert.throws(() => budget.runBudget.beforeDispatch({ url: new URL("https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=8"), method: "POST", redirectHop: 0 }), /bounded dispatch rejected/);
  assert.throws(() => budget.runBudget.beforeDispatch({ url: new URL("https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=8"), method: "GET", redirectHop: 1 }), /bounded dispatch rejected/);
  assert.throws(() => budget.runBudget.beforeDispatch({ url: new URL("https://evil.example/cbircweb/DocInfo/SelectByDocId?docId=8"), method: "GET", redirectHop: 0 }), /bounded dispatch rejected/);
  budget.dispose();
  const duplicateBudget = createNfraJsonRunBudget();
  duplicateBudget.runBudget.beforeDispatch({ url: new URL("https://www.nfra.gov.cn/cbircweb/DocInfo/SelectItemAndDocByItemPId?itemId=914&pageSize=6"), method: "GET", redirectHop: 0 });
  duplicateBudget.runBudget.beforeDispatch({ url: new URL("https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1"), method: "GET", redirectHop: 0 });
  assert.throws(() => duplicateBudget.runBudget.beforeDispatch({ url: new URL("https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1"), method: "GET", redirectHop: 0 }), /duplicate/);
  duplicateBudget.dispose();
});
