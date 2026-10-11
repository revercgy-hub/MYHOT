import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { identityKeyFor } from "@aihot/backend/content/materials";
import { unsupportedConfig } from "@aihot/backend/sources/config-keys";
import { fromHtml } from "@aihot/backend/sources/web-list";
import { readWebListPagination, validateWebListPagination, webListPageUrl } from "@aihot/backend/sources/web-list-pagination";
import type { SourceRow } from "@aihot/backend/sources/types";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = new URL("./fixtures/fujian-pagination/", import.meta.url);
const BASE = "https://fj.mof.gov.cn/gzdt/caizhengjiancha/";
const PAGE_1 = `${BASE}index_1.htm`;
const SOURCE_ID = "mof-fujian-supervision-dynamics";
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const displayDate = (value: Date | null | undefined) => value
  ? new Date(value.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
  : null;
const suspectedEditorialTerms = /(党支部|党日|学习教育|专题党课|廉政提醒|青年活动|培训|安全教育|文化|代表委员)/u;

async function loadCatalogSource() {
  const catalogue = JSON.parse(await readFile(path.join(ROOT, "industry/sources.json"), "utf8"));
  const entry = catalogue.sources.find((candidate: { id: string }) => candidate.id === SOURCE_ID);
  assert(entry, `missing ${SOURCE_ID}`);
  return entry;
}

async function fixtureBytes(name: string) {
  return readFile(new URL(name, FIXTURES));
}

test("Fujian opts into bounded two-page metadata pagination without changing source guards", async () => {
  const entry = await loadCatalogSource();
  const source = entry as SourceRow;
  assert.equal(entry.kind, "web_list");
  assert.deepEqual(readWebListPagination(source.config), {
    mode: "mof_index_v1",
    maxPagesPerRun: 2,
    maxDispatches: 12,
    maxPageIndex: 3,
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
  assert.equal(source.config.detail.maxFetches, 10);
  assert.equal(source.config.detail.publishedAtRegex, "<meta\\s+name=\"PubDate\"\\s+content=\"([^\"]+)");
  assert.equal(source.config.detail.publishedAtUtcOffset, "+08:00");
  assert.equal(source.config.detail.bodySelector, ".my_doccontent");
  for (const key of ["publishedAtAuthoritative", "titleAuthoritative", "upgradeDatePrecision"]) {
    assert.equal(Object.hasOwn(source.config.detail, key), false, `${key} remains unset`);
  }
});

test("minimal current-page fixture follows the saved pager rule to the exact page-1 URL", async () => {
  const entry = await loadCatalogSource();
  const source = entry as SourceRow;
  const manifest = JSON.parse(await readFile(new URL("manifest.json", FIXTURES), "utf8"));
  const [page0Bytes, page1Bytes] = await Promise.all([fixtureBytes("page-0.html"), fixtureBytes("page-1.html")]);

  assert.equal(manifest.fixtureBytesCopiedVerbatim.page0, false);
  assert.equal(manifest.fixtureBytesCopiedVerbatim.page1, false);
  for (const [pageIndex, bytes] of [[0, page0Bytes], [1, page1Bytes]] as const) {
    const record = manifest.captureHistory.find((item: { pageIndex: number }) => item.pageIndex === pageIndex);
    assert(record, `missing page ${pageIndex} capture record`);
    assert.equal(bytes.length, record.fixtureBytes);
    assert.equal(hash(bytes), record.fixtureSha256);
  }

  const page0Html = page0Bytes.toString("utf8");
  assert.match(page0Html, /var currentPage = 0;/u);
  assert.match(page0Html, /var nextPage = currentPage\+1;/u);
  assert.match(page0Html, /var countPage = 50;/u);
  assert.match(page0Html, /index"\s*\+\s*"_"\s*\+\s*nextPage/u);
  const page0Index = Number(page0Html.match(/\bcurrentPage\s*=\s*(\d+)/u)?.[1]);
  const nextPage = page0Index + 1;
  assert.equal(webListPageUrl(BASE, page0Index), BASE);
  assert.equal(webListPageUrl(BASE, nextPage), PAGE_1);
  assert.equal(webListPageUrl(BASE, nextPage), manifest.captureHistory[1].url);

  const page0 = fromHtml(page0Html, BASE, source, BASE);
  const page1 = fromHtml(page1Bytes.toString("utf8"), PAGE_1, source, PAGE_1);
  assert.equal(page0.length, 10);
  assert.equal(page1.length, 10);

  const page0Ids = page0.map((candidate) => identityKeyFor({ url: candidate.url, title: candidate.title, sourceId: SOURCE_ID, via: "fetch" }));
  const page1Ids = page1.map((candidate) => identityKeyFor({ url: candidate.url, title: candidate.title, sourceId: SOURCE_ID, via: "fetch" }));
  assert.equal(new Set(page0Ids).size, 10, "current page has no duplicate identities");
  assert.equal(new Set(page1Ids).size, 10, "saved page 1 has no duplicate identities");
  assert.equal(page1Ids.filter((identity) => new Set(page0Ids).has(identity)).length, 0, "adjacent pages have no identity overlap");

  const page0Dates = page0.map((candidate) => displayDate(candidate.publishedAt));
  const page1Dates = page1.map((candidate) => displayDate(candidate.publishedAt));
  assert.deepEqual([page0Dates.slice().sort()[0], page0Dates.slice().sort().at(-1)], ["2026-08-10", "2026-09-23"]);
  assert.deepEqual([page1Dates.slice().sort()[0], page1Dates.slice().sort().at(-1)], ["2026-06-17", "2026-08-12"]);
  assert.equal(page0Dates.filter((date) => date === null).length, 0);
  assert.equal(page1Dates.filter((date) => date === null).length, 0);
  assert.equal(page0Dates.filter((date) => date! < "2026-07-09").length, 0);
  assert.equal(page1Dates.filter((date) => date! >= "2026-07-09").length, 8);
  assert.equal(page1Dates.filter((date) => date! < "2026-07-09").length, 2);

  const pathDateMismatches = (items: typeof page0) => items.filter((candidate) => {
    const match = /\/t(\d{8})_/u.exec(new URL(candidate.url).pathname);
    if (!match) return false;
    const date = `${match[1]!.slice(0, 4)}-${match[1]!.slice(4, 6)}-${match[1]!.slice(6, 8)}`;
    return displayDate(candidate.publishedAt) !== date;
  });
  assert.equal(pathDateMismatches(page0).length, 4);
  assert.equal(pathDateMismatches(page1).length, 3);

  const editorialCandidates = [...page0, ...page1].filter((candidate) => suspectedEditorialTerms.test(candidate.title));
  assert.equal(editorialCandidates.length, 5);
  assert.equal(page0.length + page1.length, 20, "potentially internal/editorial titles remain visible to review, not parser-filtered as noise");
  assert.equal(manifest.observationBoundary.coverage, "unproven");
  assert.deepEqual(manifest.observationBoundary.pageCapInclusiveIndexes, [0, 3]);
  assert.equal(manifest.observationBoundary.htmlDeclaredCountPage, 50);
  assert.equal(readWebListPagination(source.config)?.maxPagesPerRun, 2);
  assert.equal(readWebListPagination(source.config)?.maxPageIndex, 3, "inclusive page index cap is not a terminal-page or 90-day coverage claim");
});
