import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createWebListPaginationBudget,
  readWebListPagination,
  validateWebListPagination,
  webListPageIndex,
  webListPageUrl,
  WEB_LIST_BACKFILL_DEADLINE_MS,
  type MofIndexPaginationConfig,
} from "@aihot/backend/sources/web-list-pagination";
import type { SourceRow } from "@aihot/backend/sources/types";

const baseUrl = "https://gx.mof.gov.cn/gzdt/caizhengjiancha/";
const basePagination: MofIndexPaginationConfig = {
  mode: "mof_index_v1",
  maxPagesPerRun: 2,
  maxDispatches: 4,
  maxPageIndex: 45,
};

function validConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    url: baseUrl,
    allowUrlPrefixes: [baseUrl],
    itemSelector: "li",
    linkSelector: "a[href]",
    titleSelector: "a",
    publishedAtSelector: "time",
    _aihot: { initialBackfillRequirePublishedAt: true, initialBackfillMonths: 3, initialBackfillLimit: 60 },
    pagination: { ...basePagination },
    ...overrides,
  };
}

function source(config = validConfig()): SourceRow {
  return { id: "pagination-policy-fixture", kind: "web_list", config } as unknown as SourceRow;
}

test("pagination config accepts only the exact mode and inclusive numeric bounds", () => {
  const config = validConfig();
  assert.deepEqual(validateWebListPagination("web_list", config), []);
  assert.deepEqual(readWebListPagination(config), basePagination);

  const validBoundaryValues = [
    { maxPagesPerRun: 1, maxDispatches: 1, maxPageIndex: 1 },
    { maxPagesPerRun: 2, maxDispatches: 12, maxPageIndex: 100 },
  ];
  for (const values of validBoundaryValues) {
    const boundary = validConfig({ pagination: { mode: "mof_index_v1", ...values } });
    assert.deepEqual(validateWebListPagination("web_list", boundary), []);
  }

  const invalidFields: Array<[string, unknown]> = [
    ["mode", "other"],
    ["maxPagesPerRun", 0], ["maxPagesPerRun", 3], ["maxPagesPerRun", 1.5], ["maxPagesPerRun", "2"], ["maxPagesPerRun", true],
    ["maxDispatches", 0], ["maxDispatches", 13], ["maxDispatches", 4.5], ["maxDispatches", "4"], ["maxDispatches", null],
    ["maxPageIndex", 0], ["maxPageIndex", 101], ["maxPageIndex", 2.25], ["maxPageIndex", "45"], ["maxPageIndex", false],
  ];
  for (const [field, value] of invalidFields) {
    const invalid = validConfig({ pagination: { ...basePagination, [field]: value } });
    assert(validateWebListPagination("web_list", invalid).some((error) => error.includes(`pagination.${field}`)), `${field}=${String(value)} should be rejected`);
    assert.equal(readWebListPagination(invalid), null, `${field}=${String(value)} must fail closed`);
  }

  const unknownKey = validConfig({ pagination: { ...basePagination, followNextLink: true } });
  assert(validateWebListPagination("web_list", unknownKey).some((error) => error.includes("pagination.followNextLink")));
  assert(validateWebListPagination("rss", validConfig()).some((error) => error.includes("only supported by web_list")));
});

test("pagination rejects incompatible URL, parser, date, and detail combinations", () => {
  const invalidConfigs: Array<[string, Record<string, unknown>]> = [
    ["non-HTTPS URL", validConfig({ url: baseUrl.replace("https:", "http:") })],
    ["broad URL allowlist", validConfig({ allowUrlPrefixes: [baseUrl, "https://gx.mof.gov.cn/"] })],
    ["non-HTML parse mode", validConfig({ parseMode: "markdown" })],
    ["adapter", validConfig({ adapter: "mimo_home" })],
    ["baseUrl", validConfig({ baseUrl })],
    ["URL rewrite", validConfig({ itemUrlPrefixRewrite: { from: baseUrl, to: baseUrl } })],
    ["fragment identity", validConfig({ preserveUrlFragment: true })],
    ["missing date selector", validConfig({ publishedAtSelector: undefined })],
    ["published date not required", validConfig({ _aihot: { initialBackfillRequirePublishedAt: false } })],
    ["detail fetching", validConfig({ detail: { maxFetches: 1 } })],
    ["authoritative detail date", validConfig({ detail: { maxFetches: 0, publishedAtAuthoritative: true } })],
  ];
  for (const [label, config] of invalidConfigs) {
    assert.notDeepEqual(validateWebListPagination("web_list", config), [], `${label} should be rejected`);
  }
});

test("MOF page URLs are canonical and page identity rejects aliases and cross-directory targets", () => {
  assert.equal(webListPageUrl(baseUrl, 0), baseUrl);
  assert.equal(webListPageUrl(baseUrl, 1), `${baseUrl}index_1.htm`);
  assert.equal(webListPageUrl(baseUrl, 45), `${baseUrl}index_45.htm`);
  assert.equal(webListPageIndex(baseUrl, baseUrl), 0);
  assert.equal(webListPageIndex(baseUrl, `${baseUrl}index_1.htm`), 1);
  assert.equal(webListPageIndex(baseUrl, `${baseUrl}index_45.htm`), 45);
  assert.equal(webListPageIndex(baseUrl, `${baseUrl}index_0.htm`), null);
  assert.equal(webListPageIndex(baseUrl, `${baseUrl}index_01.htm`), null, "noncanonical zero-padded aliases are not page identities");
  assert.equal(webListPageIndex(baseUrl, `${baseUrl}news/index_1.htm`), null);
  assert.equal(webListPageIndex(baseUrl, "https://bj.mof.gov.cn/gzdt/index_1.htm"), null);
  assert.equal(webListPageIndex(baseUrl, `${baseUrl}index_1.htm?x=1`), null);
  assert.equal(webListPageIndex(baseUrl, `${baseUrl}index_1.htm#fragment`), null);
  assert.throws(() => webListPageUrl(baseUrl, -1), /page index|integer|invalid|range/iu);
  assert.throws(() => webListPageUrl(baseUrl, 1.5), /page index|integer|invalid|range/iu);
});

test("one run budget shares its cap and redirect identity across page changes", () => {
  const budget = createWebListPaginationBudget(source(validConfig({ pagination: { ...basePagination, maxDispatches: 2 } })), {
    ...basePagination,
    maxDispatches: 2,
  });
  try {
    budget.setCurrentPage(0);
    budget.runBudget.beforeDispatch({ url: new URL(baseUrl), method: "GET", redirectHop: 0 });
    assert.equal(budget.dispatchesUsed(), 1);
    assert.equal(budget.runBudget.allowRedirect?.({ from: new URL(baseUrl), to: new URL(`${baseUrl}index_1.htm`), redirectHop: 1 }), false,
      "page 0 cannot redirect into page 1");
    assert.equal(budget.runBudget.allowRedirect?.({ from: new URL(baseUrl), to: new URL(baseUrl), redirectHop: 1 }), false,
      "a redirect back to a URL already dispatched in this run is refused before the next dispatch");
    budget.markPageCommitted(0);
    assert.equal(budget.runBudget.allowRedirect?.({ from: new URL(baseUrl), to: new URL(baseUrl), redirectHop: 1 }), false,
      "a committed page cannot be fetched again through a redirect");

    budget.setCurrentPage(1);
    assert.throws(
      () => budget.runBudget.beforeDispatch({ url: new URL(`${baseUrl}index_2.htm`), method: "GET", redirectHop: 0 }),
      /current page/iu,
    );
    assert.equal(budget.dispatchesUsed(), 1, "rejected page identity consumes no dispatch");
    budget.runBudget.beforeDispatch({ url: new URL(`${baseUrl}index_1.htm`), method: "GET", redirectHop: 0 });
    assert.equal(budget.dispatchesUsed(), 2, "page 1 consumes the same run's remaining dispatch");
    assert.equal(budget.runBudget.allowRedirect?.({ from: new URL(`${baseUrl}index_1.htm`), to: new URL(`${baseUrl}index_2.htm`), redirectHop: 1 }), false,
      "page 1 cannot redirect into page 2");
    budget.markPageCommitted(1);
    assert.equal(budget.runBudget.allowRedirect?.({ from: new URL(`${baseUrl}index_1.htm`), to: new URL(`${baseUrl}index_1.htm`), redirectHop: 1 }), false);

    budget.setCurrentPage(2);
    assert.throws(
      () => budget.runBudget.beforeDispatch({ url: new URL(`${baseUrl}index_2.htm`), method: "GET", redirectHop: 0 }),
      /budget exhausted/iu,
    );
    assert.equal(budget.dispatchesUsed(), 2, "changing pages does not reset the run dispatch cap");
  } finally {
    budget.dispose();
  }
});

test("one fake-clock 120-second deadline survives page changes and aborts the shared signal", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
  const budget = createWebListPaginationBudget(source(), basePagination);
  try {
    const sharedSignal = budget.runBudget.signal;
    assert.equal(budget.remainingMs(), WEB_LIST_BACKFILL_DEADLINE_MS);
    t.mock.timers.tick(30_000);
    budget.setCurrentPage(1);
    assert.equal(budget.remainingMs(), 90_000, "switching to another page must not restart the deadline");
    assert.equal(budget.runBudget.signal, sharedSignal, "every page uses the same run cancellation signal");

    t.mock.timers.tick(90_000);
    assert.throws(() => budget.assertActive(), /web-list run deadline exceeded/iu);
    assert.equal(budget.runBudget.signal?.aborted, true);
  } finally {
    budget.dispose();
    t.mock.timers.reset();
  }
});
