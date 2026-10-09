import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { MockAgent, fetch as undiciFetch } from "undici";
import { identityKeyFor } from "@aihot/backend/content/materials";
import { unsupportedConfig } from "@aihot/backend/sources/config-keys";
import { fromHtml } from "@aihot/backend/sources/web-list";
import { createWebListPaginationBudget, readWebListPagination, validateWebListPagination, webListPageIndex, webListPageUrl } from "@aihot/backend/sources/web-list-pagination";
import type { SourceRow } from "@aihot/backend/sources/types";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = new URL("./fixtures/zhejiang-pagination/", import.meta.url);
const BASE = "https://zj.mof.gov.cn/caizhengjiancha/";
const PAGE_1 = `${BASE}index_1.htm`;
const SOURCE_ID = "mof-zhejiang-supervision-dynamics";
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const displayDate = (value: Date | null | undefined) => value ? new Date(value.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10) : null;

async function loadCatalogSource() {
  const catalogue = JSON.parse(await readFile(path.join(ROOT, "industry/sources.json"), "utf8"));
  const entry = catalogue.sources.find((candidate: { id: string }) => candidate.id === SOURCE_ID);
  assert(entry, `missing ${SOURCE_ID}`);
  return entry;
}

async function fixtureBytes(name: string) {
  return readFile(new URL(name, FIXTURES));
}

test("Zhejiang source opts into the exact bounded metadata pagination config without changing its guards", async () => {
  const entry = await loadCatalogSource();
  const source = entry as SourceRow;
  assert.equal(entry.kind, "web_list");
  assert.deepEqual(readWebListPagination(source.config), {
    mode: "mof_index_v1",
    maxPagesPerRun: 2,
    maxDispatches: 12,
    maxPageIndex: 15,
    detailMode: "direct_html_metadata_v1",
  });
  assert.deepEqual(validateWebListPagination("web_list", source.config), []);
  assert.deepEqual(unsupportedConfig("web_list", source.config), []);

  assert.equal(entry.enabled, false);
  assert.equal(entry.site_fulltext, false);
  assert.equal(entry.syndicate_fulltext, false);
  assert.equal(source.config._aihot.initialBackfillMonths, 3);
  assert.equal(source.config._aihot.initialBackfillRequirePublishedAt, true);
  assert.equal(source.config._aihot.requireBodyReadyForAutomaticSelection, true);
  assert.deepEqual(source.config.allowUrlPrefixes, [BASE]);
  assert.equal(source.config.itemSelector, "div.mainboxerji > div.zzright > div.listBox > ul.liBox > li");
  assert.equal(source.config.linkSelector, "a[href]");
  assert.equal(source.config.titleSelector, "a");
  assert.equal(source.config.titleAttribute, "title");
  assert.equal(source.config.publishedAtSelector, "span");
  assert.deepEqual(source.config.detail, {
    maxFetches: 10,
    titleSelector: "h2.title_con",
    publishedAtRegex: "<meta\\s+name=\"PubDate\"\\s+content=\"([^\"]+)",
    publishedAtUtcOffset: "+08:00",
    bodySelector: ".my_doccontent",
  });
  for (const key of ["publishedAtAuthoritative", "titleAuthoritative", "upgradeDatePrecision"]) {
    assert.equal(Object.hasOwn(source.config.detail, key), false, `${key} remains unset`);
  }
});

test("Zhejiang pagination schema keeps its fixed page identity and inclusive safety cap", async () => {
  const { config } = await loadCatalogSource();
  const pagination = readWebListPagination(config)!;
  assert.equal(webListPageUrl(BASE, 0), BASE);
  assert.equal(webListPageUrl(BASE, 1), PAGE_1);
  assert.equal(webListPageUrl(BASE, 15), `${BASE}index_15.htm`);
  assert.equal(webListPageIndex(BASE, PAGE_1), 1);
  assert.equal(pagination.maxPageIndex, 15, "inclusive zero-based cap permits indices 0 through 15; it is not a terminal-page claim");

  const phaseAOnly = structuredClone(config) as Record<string, any>;
  delete phaseAOnly.pagination.detailMode;
  assert(validateWebListPagination("web_list", phaseAOnly).some((error) => error.includes("detail.maxFetches")),
    "the existing detail.maxFetches=10 cannot be silently carried into Phase A");
  for (const maxPageIndex of [0, 101, "15", 15.5]) {
    const invalid = { ...config, pagination: { ...config.pagination, maxPageIndex } };
    assert.notDeepEqual(validateWebListPagination("web_list", invalid), [], `maxPageIndex=${String(maxPageIndex)} is rejected`);
  }
});

test("verbatim adjacent-page fixtures reparse with the configured selectors, preserve PDF, and retain date evidence", async () => {
  const { config } = await loadCatalogSource();
  const manifest = JSON.parse(await readFile(new URL("manifest.json", FIXTURES), "utf8"));
  assert.equal(manifest.fixtureBytesCopiedVerbatim, true);
  const [page0Bytes, page1Bytes] = await Promise.all([fixtureBytes("page-0.html"), fixtureBytes("page-1.html")]);
  const byIndex = new Map(manifest.captureHistory.map((item: any) => [item.pageIndex, item]));
  for (const [pageIndex, bytes] of [[0, page0Bytes], [1, page1Bytes]] as const) {
    const record = byIndex.get(pageIndex)! as any;
    assert.equal(bytes.length, record.bytes);
    assert.equal(hash(bytes), record.sha256);
  }

  const page0 = fromHtml(page0Bytes.toString("utf8"), BASE, { id: SOURCE_ID, kind: "web_list", config } as SourceRow, BASE);
  const page1 = fromHtml(page1Bytes.toString("utf8"), PAGE_1, { id: SOURCE_ID, kind: "web_list", config } as SourceRow, PAGE_1);
  assert.equal(page0.length, 10);
  assert.equal(page1.length, 10);
  const page0Ids = new Set(page0.map((candidate) => identityKeyFor({ url: candidate.url, title: candidate.title, sourceId: SOURCE_ID, via: "fetch" })));
  const page1Ids = new Set(page1.map((candidate) => identityKeyFor({ url: candidate.url, title: candidate.title, sourceId: SOURCE_ID, via: "fetch" })));
  assert.equal([...page1Ids].filter((identity) => page0Ids.has(identity)).length, 0);

  const page0Dates = page0.map((candidate) => displayDate(candidate.publishedAt)).filter((value): value is string => !!value).sort();
  const page1Dates = page1.map((candidate) => displayDate(candidate.publishedAt)).filter((value): value is string => !!value).sort();
  assert.deepEqual([page0Dates[0], page0Dates.at(-1)], ["2026-08-17", "2026-09-30"]);
  assert.deepEqual([page1Dates[0], page1Dates.at(-1)], ["2026-06-16", "2026-08-11"]);
  assert.equal(page0Dates.filter((date) => page1Dates.includes(date)).length, 0);
  assert.equal(page0Dates[0], "2026-08-17");
  assert.equal(page1Dates.at(-1), "2026-08-11");

  const page0Pdfs = page0.filter((candidate) => new URL(candidate.url).pathname.toLowerCase().endsWith(".pdf"));
  assert.equal(page0Pdfs.length, 1);
  assert.equal(page0Pdfs[0]?.url, `${BASE}202608/P020260817402979611996.pdf`);
  assert.equal(page1.filter((candidate) => new URL(candidate.url).pathname.toLowerCase().endsWith(".pdf")).length, 0);

  const mismatches = page1.filter((candidate) => {
    const match = /\/t(\d{8})_/.exec(new URL(candidate.url).pathname);
    if (!match) return false;
    const pathDate = `${match[1]!.slice(0, 4)}-${match[1]!.slice(4, 6)}-${match[1]!.slice(6, 8)}`;
    return displayDate(candidate.publishedAt) !== pathDate;
  });
  assert.equal(mismatches.length, 5);
  assert.equal(manifest.adjacentPageComparison.exactIdentityOverlapCount, 0);
  assert.equal(manifest.adjacentPageComparison.displayBoundaryGapDays, 6);
  assert.match(manifest.interpretation, /does not assert source admission or complete 90-day coverage/u);
});

test("production pagination budget shares twelve dispatches across two pages and ten optional detail targets", async () => {
  const entry = await loadCatalogSource();
  const source = { id: entry.id, kind: entry.kind, config: entry.config, cursor: null } as SourceRow;
  const pagination = readWebListPagination(source.config)!;
  const budget = createWebListPaginationBudget(source, pagination);
  try {
    budget.setCurrentPage(0);
    budget.runBudget.beforeDispatch({ url: new URL(BASE), method: "GET", redirectHop: 0 });
    budget.markPageCommitted(0);
    budget.setCurrentPage(1);
    budget.runBudget.beforeDispatch({ url: new URL(PAGE_1), method: "GET", redirectHop: 0 });
    budget.markPageCommitted(1);

    for (let index = 0; index < 10; index++) {
      const target = `${BASE}202610/t20261009_zj_${index}.htm`;
      const identity = identityKeyFor({ url: target, title: "", sourceId: SOURCE_ID, via: "fetch" });
      budget.setCurrentDetailTarget(target, identity);
      budget.runBudget.beforeDispatch({ url: new URL(target), method: "GET", redirectHop: 0 });
      budget.clearCurrentDetailTarget();
    }
    assert.equal(budget.dispatchesUsed(), 12);
    assert.equal(budget.detailTargetsUsed(), 10);

    const eleventh = `${BASE}202610/t20261009_zj_10.htm`;
    const identity = identityKeyFor({ url: eleventh, title: "", sourceId: SOURCE_ID, via: "fetch" });
    assert.throws(() => budget.setCurrentDetailTarget(eleventh, identity), /identity or budget rejected/u);
    assert.equal(budget.dispatchesUsed(), 12);
    assert.equal(budget.detailTargetsUsed(), 10);
  } finally {
    budget.dispose();
  }
});

test("MockAgent denyNetConnect rejects an unmocked official endpoint without a real connection", async () => {
  const agent = new MockAgent();
  agent.disableNetConnect();
  try {
    await assert.rejects(undiciFetch(PAGE_1, { dispatcher: agent, method: "GET", redirect: "manual" }), (error: any) => {
      const chain: string[] = [];
      for (let cause = error; cause && chain.length < 4; cause = cause.cause) {
        chain.push(`${cause.name ?? ""} ${cause.code ?? ""} ${cause.message ?? ""}`);
      }
      return chain.some((value) => /MockNotMatched|UND_MOCK_ERR_MOCK_NOT_MATCHED|mock|net connect/i.test(value));
    });
    assert.deepEqual(agent.pendingInterceptors(), []);
  } finally {
    await agent.close();
  }
});
