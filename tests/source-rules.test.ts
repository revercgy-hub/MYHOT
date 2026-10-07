// Every rule a source's config names is applied, and a name the collector does not implement fails the
// fetch. Configs that carried adapters and detail rules a collector does not implement used to fall
// back silently (junk titles, RSS entries outside the source's URL rules, dates from the wrong place).
import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import { after, before, mock, test } from "node:test";
import { config } from "@aihot/backend/config";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { extractArticleBody, readable } from "@aihot/backend/content/extract";
import { collectSource } from "@aihot/backend/sources/collect";
import { updateSource } from "@aihot/backend/admin/sources";
import { unsupportedConfig } from "@aihot/backend/sources/config-keys";

const T = tag();
const LONG = `${"A card label that swallowed the summary of the article it links to, ".repeat(2)}${T}`;
let jinaDetailReads = 0;
let jinaListingReads = 0;
const pageReads = new Map<string, number>();
const ARTICLE_BODY = "A complete article with enough material to preserve the same extraction result without downloading it twice. ".repeat(6);
const ACCOUNTING_POLICY_FIXTURE = readFileSync(new URL("./fixtures/fiscal-accounting-body/real-short-table.html", import.meta.url), "utf8");
const html = (head: string, body: string) => `<html><head>${head}</head><body>${body}</body></html>`;
const pages: Record<string, (base: string) => string> = {
  "/feed.xml": () =>
    `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>` +
    ["news/a", "business/b"].map((p) => `<item><title>Entry ${p} ${T}</title><link>https://example.org/rules-${T}/${p}</link><pubDate>${new Date().toUTCString()}</pubDate></item>`).join("") +
    `</channel></rss>`,
  "/list.html": () => html("", `<ul><li><a href="/p/a-${T}">Short clean title ${T}</a><time>2026-09-20</time></li><li><a href="/p/b-${T}">${LONG}</a></li></ul>`),
  [`/p/a-${T}`]: () =>
    html(`<meta name="description" content="Summary of A"><meta property="article:published_time" content="2026-01-01T00:00:00Z">`, `<h1>Detail heading A</h1><p class="byline"><time datetime="2026-09-21T08:00:00Z">Sep 21</time></p>`),
  [`/p/b-${T}`]: () => html(`<meta name="description" content="Summary of B"><meta property="article:published_time" content="2026-01-01T00:00:00Z">`, `<article><h1>Detail heading B ${T}</h1><p>${ARTICLE_BODY}</p></article>`),
  [`/selector-list-${T}`]: () => html("", `<ul><li><a href="${base}/selector-item-${T}">OMO announcement ${T}</a><time datetime="2026-09-29T00:00:00+08:00">Sep 29</time></li></ul>`),
  [`/selector-item-${T}`]: () => html(`<meta name="ArticleTitle" content="OMO announcement ${T}"><meta name="PubDate" content="2026-09-29">`,
    `<div id="notice"><p>Short but complete verified notice ${T}</p><table><tr><th>Term</th><th>Rate</th><th>Amount</th></tr><tr><td>7 days</td><td>1.40%</td><td>905 yuan</td></tr></table></div>`),
  [`/accounting-policy-list-${T}`]: () => html("", `<ul><li><a href="${base}/accounting-policy-item-${T}">从事证券服务业务会计师事务所注销备案名单</a><time datetime="2026-09-04T00:00:00+08:00">2026-09-04</time></li></ul>`),
  [`/accounting-policy-item-${T}`]: () => ACCOUNTING_POLICY_FIXTURE,
  [`/strict-window-list-${T}`]: () => html("", `<ul>
    <li><a href="${base}/strict-window/boundary-${T}">Boundary ${T}</a><time datetime="2026-07-06T12:00:00.000Z"></time></li>
    <li><a href="${base}/strict-window/one-ms-old-${T}">One millisecond old ${T}</a><time datetime="2026-07-06T11:59:59.999Z"></time></li>
    <li><a href="${base}/strict-window/future-${T}">Future ${T}</a><time datetime="2026-10-05T12:00:00.000Z"></time></li>
    <li><a href="${base}/strict-window/invalid-${T}">Invalid date ${T}</a><time datetime="not-a-date"></time></li>
  </ul>`),
  [`/strict-detail-list-${T}`]: () => html("", `<ul>
    <li><a href="${base}/strict-detail/supplement-${T}">Detail supplements date ${T}</a></li>
    <li><a href="${base}/strict-detail/no-date-${T}">Detail has no date ${T}</a></li>
    <li><a href="${base}/strict-detail/exhausted-${T}">Detail budget exhausted ${T}</a></li>
  </ul>`),
  [`/strict-detail/supplement-${T}`]: () => html("", `<p class="byline"><time datetime="2026-09-20T00:00:00.000Z"></time></p>`),
  [`/strict-detail/no-date-${T}`]: () => html("", `<p>Deliberately has no date.</p>`),
  [`/strict-authoritative-list-${T}`]: () => html("", `<ul>
    <li><a href="${base}/strict-authoritative/stale-list-${T}">Old listing date, fresh detail ${T}</a><time datetime="2026-06-01T00:00:00.000Z"></time></li>
    <li><a href="${base}/strict-authoritative/cleared-${T}">Authoritative detail clears listing date ${T}</a><time datetime="2026-09-20T00:00:00.000Z"></time></li>
  </ul>`),
  [`/strict-authoritative/stale-list-${T}`]: () => html("", `<h1>Fresh detail date ${T}</h1><p class="byline"><time datetime="2026-09-20T12:00:00.000Z"></time></p>`),
  [`/strict-authoritative/cleared-${T}`]: () => html("", `<h1>No authoritative date ${T}</h1><p>There is deliberately no time element.</p>`),
  [`/legacy-window-list-${T}`]: () => html("", `<ul>
    <li><a href="${base}/legacy/missing-${T}">Missing date legacy ${T}</a></li>
    <li><a href="${base}/legacy/future-${T}">Future date legacy ${T}</a><time datetime="2026-10-05T12:00:00.000Z"></time></li>
  </ul>`),
  [`/incremental-window-list-${T}`]: () => html("", `<ul><li><a href="${base}/incremental/missing-${T}">Incremental missing date ${T}</a></li></ul>`),
  [`/j/1-${T}`]: () => html(`<meta property="article:published_time" content="2026-09-27T01:00:00Z">`, "<p>one</p>"),
  [`/j/2-${T}`]: () => html(`<meta property="article:published_time" content="2026-09-27T02:00:00Z">`, "<p>two</p>"),
};
// Jina Reader: GET /<target URL> answers the rendering, with its header lines.
const jina = (base: string, target: string) => {
  const md = target.endsWith(`/jlist-${T}`)
    ? `[Short Jina title ${T}](${base}/j/1-${T})\n\n[${LONG}](${base}/j/2-${T})`
    : `# Heading from Jina ${T}\n\nThe article.`;
  if (target.endsWith(`/jlist-${T}`)) jinaListingReads += 1;
  else jinaDetailReads += 1;
  return `Title: Page\nURL Source: ${target}\nPublished Time: 2026-09-27T00:00:00Z\nMarkdown Content:\n${md}`;
};
const server = http.createServer((req, res) => {
  const path = req.url ?? "";
  pageReads.set(path, (pageReads.get(path) ?? 0) + 1);
  const body = path.startsWith("/http") ? jina(base, path.slice(1)) : Object.hasOwn(pages, path) ? pages[path]!(base) : null;
  res.writeHead(body === null ? 404 : 200, { "content-type": path.endsWith(".xml") ? "application/rss+xml" : "text/html; charset=utf-8" });
  res.end(body ?? "");
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
config.allowPrivateNetworkFetch = true;
process.env.JINA_BASE_URL = base;
process.env.JINA_API_KEY = "test-key";

const SOURCES = {
  unsupported: { kind: "rss", config: { feedUrl: `${base}/feed.xml`, adapter: "feed_cards" } },
  denied: { kind: "rss", config: { feedUrl: `${base}/feed.xml`, denyUrlPrefixes: [`https://example.org/rules-${T}/business/`] } },
  detail: {
    kind: "web_list",
    config: {
      url: `${base}/list.html`, parseMode: "html", itemSelector: "li", linkSelector: "a", titleSelector: "a", publishedAtSelector: "time",
      detail: { maxFetches: 10, titleSelector: "h1", summarySelector: 'meta[name="description"]', publishedAtAuthoritative: true, publishedAtSelector: ".byline time" },
    },
  },
  selector: {
    kind: "web_list",
    config: {
      url: `${base}/selector-list-${T}`, parseMode: "html", itemSelector: "li", linkSelector: "a", titleSelector: "a", publishedAtSelector: "time",
      allowUrlPrefixes: [`${base}/selector-item-${T}`],
      detail: { maxFetches: 10, bodySelector: "#notice", allowShortBody: true, publishedAtUtcOffset: "+08:00" },
    },
  },
  accountingPolicy: {
    kind: "web_list",
    config: {
      url: `${base}/accounting-policy-list-${T}`, parseMode: "html", itemSelector: "li", linkSelector: "a", titleSelector: "a", publishedAtSelector: "time",
      allowUrlPrefixes: [`${base}/accounting-policy-item-${T}`],
      detail: {
        maxFetches: 10, publishedAtUtcOffset: "+08:00",
        bodyPolicies: [
          { selector: ".my_doccontent > .TRS_Editor:has(table)", minTextChars: 1, table: { requiredHeaderCells: ["序号", "会计师事务所名称", "统一社会信用代码", "注销备案公告日期", "注销备案情形"], minCompleteDataRows: 1 } },
          { selector: ".my_doccontent > .TRS_Editor:has(p + p)", minTextChars: 200 },
        ],
      },
    },
  },
  strictWindow: {
    kind: "web_list",
    config: { url: `${base}/strict-window-list-${T}`, parseMode: "html", itemSelector: "li", linkSelector: "a", titleSelector: "a", publishedAtSelector: "time", _aihot: { initialBackfillMonths: 3, initialBackfillRequirePublishedAt: true } },
  },
  strictDetail: {
    kind: "web_list",
    config: { url: `${base}/strict-detail-list-${T}`, parseMode: "html", itemSelector: "li", linkSelector: "a", titleSelector: "a", allowUrlPrefixes: [`${base}/strict-detail/`], _aihot: { initialBackfillMonths: 3, initialBackfillRequirePublishedAt: true }, detail: { maxFetches: 2, publishedAtSelector: ".byline time" } },
  },
  strictAuthoritative: {
    kind: "web_list",
    config: { url: `${base}/strict-authoritative-list-${T}`, parseMode: "html", itemSelector: "li", linkSelector: "a", titleSelector: "a", publishedAtSelector: "time", allowUrlPrefixes: [`${base}/strict-authoritative/`], _aihot: { initialBackfillMonths: 3, initialBackfillRequirePublishedAt: true }, detail: { maxFetches: 2, publishedAtSelector: ".byline time", publishedAtAuthoritative: true } },
  },
  legacyWindow: {
    kind: "web_list",
    config: { url: `${base}/legacy-window-list-${T}`, parseMode: "html", itemSelector: "li", linkSelector: "a", titleSelector: "a", publishedAtSelector: "time", allowUrlPrefixes: [`${base}/legacy/`], _aihot: { initialBackfillMonths: 3, initialBackfillRequirePublishedAt: false } },
  },
  incrementalWindow: {
    kind: "web_list",
    config: { url: `${base}/incremental-window-list-${T}`, parseMode: "html", itemSelector: "li", linkSelector: "a", titleSelector: "a", allowUrlPrefixes: [`${base}/incremental/`], _aihot: { initialBackfillMonths: 3, initialBackfillRequirePublishedAt: true } },
  },
  jina: { kind: "web_list", config: { url: `https://r.jina.ai/${base}/jlist-${T}`, parseMode: "markdown", allowUrlPrefixes: [`${base}/j/`], detail: { maxFetches: 5, titleRegex: "^# (.+)$" } } },
};
const id = (name: keyof typeof SOURCES) => `test-rules-${name}-${T}`;
let savedJina: Array<{ per_minute: number; per_hour: number; per_day: number }> = [];
before(async () => {
  savedJina = await sql`SELECT per_minute, per_hour, per_day FROM budgets WHERE service = 'jina'`;
  await sql`UPDATE budgets SET per_minute = 1000, per_hour = 10000, per_day = 100000 WHERE service = 'jina'`;
  for (const [name, s] of Object.entries(SOURCES)) {
    const firstImport = ["strictWindow", "strictDetail", "strictAuthoritative", "legacyWindow"].includes(name);
    const sourceCursor = firstImport ? {} : { initializedAt: new Date().toISOString() };
    await sql`INSERT INTO sources (id, name, kind, config, tier, participation_mode, cursor, next_fetch_at)
              VALUES (${id(name as keyof typeof SOURCES)}, ${name}, ${s.kind}, ${sql.json(s.config)}, 'T1', 'editorial', ${sql.json(sourceCursor)}, '2100-01-01')`;
  }
});
after(async () => {
  for (const b of savedJina) await sql`UPDATE budgets SET per_minute = ${b.per_minute}, per_hour = ${b.per_hour}, per_day = ${b.per_day} WHERE service = 'jina'`;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await stopBoss();
  await closeDb();
});

const articles = (sourceId: string) =>
  sql<{ url: string; title: string; excerpt: string | null; published_at: Date | null; revision: number }[]>`
    SELECT url, title, excerpt, published_at, revision FROM articles WHERE source_id = ${sourceId} ORDER BY url`;

test("a config entry the collector does not implement fails the fetch instead of being ignored", async () => {
  const run = await collectSource(id("unsupported"), { force: true });
  assert.equal(run.status, "failed");
  assert.match(run.error ?? "", /unsupported config: adapter/);
  assert.equal((await articles(id("unsupported"))).length, 0, "nothing collected by a fallback parse");
  const [row] = await sql<{ updated_at: Date }[]>`SELECT updated_at FROM sources WHERE id = ${id("denied")}`;
  await assert.rejects(
    updateSource(id("denied"), { patch: { config: { ...SOURCES.denied.config, detail: { titleFoo: "h1" } } }, version: row!.updated_at.toISOString() }, "test"),
    /不支持的配置项：detail\.titleFoo/,
    "the admin refuses it before it is saved",
  );
});

test("feed entries outside the source's URL rules are skipped", async () => {
  assert.equal((await collectSource(id("denied"), { force: true })).status, "ok");
  assert.deepEqual((await articles(id("denied"))).map((a) => a.url), [`https://example.org/rules-${T}/news/a`]);
});

test("detail rules fill what the listing lacks, and a detail title survives the next listing", async () => {
  for (let run = 0; run < 2; run++) assert.equal((await collectSource(id("detail"), { force: true })).status, "ok");
  const [a, b] = await articles(id("detail"));
  assert.deepEqual([a!.title, a!.excerpt, a!.published_at?.toISOString(), a!.revision], [`Short clean title ${T}`, "Summary of A", "2026-09-21T08:00:00.000Z", 1],
    "a clean listing title stays; the byline, not the listing date or page metadata, dates it");
  assert.deepEqual([b!.title, b!.excerpt, b!.published_at, b!.revision], [`Detail heading B ${T}`, "Summary of B", null, 1],
    "a label that swallowed its summary takes the page's heading; without a byline there is no date; the listing does not revise it back");
});

test("an explicit body selector shares the verified short-body result between collection and extraction", async () => {
  const result = await collectSource(id("selector"), { force: true });
  assert.equal(result.status, "ok");
  const [row] = await sql<{ id: string; body_html: string | null; body_text: string | null; body_status: string; revision: number }[]>`
    SELECT id, body_html, body_text, body_status, revision FROM articles WHERE source_id = ${id("selector")}`;
  assert.equal(row?.body_status, "ok");
  assert.equal(row?.revision, 1);
  assert.match(row?.body_text ?? "", /Term \| Rate \| Amount/);
  assert.match(row?.body_text ?? "", /1\.40%/);
  assert.match(row?.body_html ?? "", /<table>/);
  assert.equal(pageReads.get(`/selector-item-${T}`), 1, "metadata collection uses the same selector contract; extraction does not redownload a confirmed body");
  assert.equal(await extractArticleBody(row!.id, false), "skipped");
});

test("a policy-only source passes the detail gate and the article-body job reuses the policy driver", async () => {
  const sourceId = id("accountingPolicy");
  const result = await collectSource(sourceId, { force: true });
  assert.equal(result.status, "ok");
  const [row] = await sql<{ id: string; body_text: string | null; body_status: string }[]>`
    SELECT id, body_text, body_status FROM articles WHERE source_id = ${sourceId}`;
  assert.equal(row?.body_status, "ok");
  assert.equal(row?.body_text?.length, 180);
  assert.match(row?.body_text ?? "", /河南守正创新会计师事务所（普通合伙）/);
  assert.equal(pageReads.get(`/accounting-policy-item-${T}`), 1, "policy-only config triggers a budgeted detail fetch");

  await sql`UPDATE articles SET body_html = NULL, body_text = NULL, body_status = 'pending' WHERE id = ${row!.id}`;
  assert.equal(await extractArticleBody(row!.id, false), "ok");
  assert.equal(pageReads.get(`/accounting-policy-item-${T}`), 2, "the body job reconstructs and applies the same source policy");
  const [after] = await sql<{ body_status: string; body_text: string | null }[]>`SELECT body_status, body_text FROM articles WHERE id = ${row!.id}`;
  assert.equal(after?.body_status, "ok");
  assert.equal(after?.body_text?.length, 180);
});

test("a Jina listing is read on every fetch, and buys a detail rendering only where a regex rule needs it", async () => {
  assert.equal((await collectSource(id("jina"), { force: true })).status, "ok");
  const rows = await articles(id("jina"));
  assert.deepEqual(rows.map((r) => [r.title, r.published_at?.toISOString()]), [
    [`Short Jina title ${T}`, "2026-09-27T01:00:00.000Z"],
    [`Heading from Jina ${T}`, "2026-09-27T02:00:00.000Z"],
  ], "the title regex reads Jina's text; dates come from the pages' own HTML");
  assert.equal(jinaDetailReads, 1, "one paid detail rendering: only the long title needed one");
  assert.equal((await collectSource(id("jina"), { force: true })).status, "ok");
  assert.deepEqual([jinaListingReads, jinaDetailReads], [2, 1], "every fetch reads the listing afresh; known articles buy no detail");
});

test("strict first-import window uses a fixed clock and admits the exact cutoff but not old or future dates", async () => {
  mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-04T12:00:00.000Z") });
  try {
    const result = await collectSource(id("strictWindow"), { force: true });
    assert.equal(result.status, "ok");
    const rows = await sql<{ url: string; published_at: Date | null; backfill: boolean }[]>`
      SELECT url, published_at, backfill FROM articles WHERE source_id = ${id("strictWindow")} ORDER BY url`;
    assert.deepEqual(rows.map((r) => [r.url.split("/").at(-1), r.published_at?.toISOString(), r.backfill]), [
      [`boundary-${T}`, "2026-07-06T12:00:00.000Z", true],
    ], "exactly 90 days is included; one millisecond older and any future date are not stored");
    assert.equal(result.found, 4, "found remains the raw listing count, independent of first-import filtering");
  } finally {
    mock.timers.reset();
  }
});

test("strict first import supplements a missing listing date, then fails closed at detail-budget exhaustion", async () => {
  mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-04T12:00:00.000Z") });
  try {
    const result = await collectSource(id("strictDetail"), { force: true });
    assert.equal(result.status, "ok");
    const rows = await sql<{ url: string; published_at: Date | null }[]>`
      SELECT url, published_at FROM articles WHERE source_id = ${id("strictDetail")} ORDER BY url`;
    assert.deepEqual(rows.map((r) => [r.url.split("/").at(-1), r.published_at?.toISOString()]), [
      [`supplement-${T}`, "2026-09-20T00:00:00.000Z"],
    ], "detail supplies a trusted in-window date; undated and budget-unfetched candidates are not stored");
    assert.equal(pageReads.get(`/strict-detail/supplement-${T}`), 1);
    assert.equal(pageReads.get(`/strict-detail/no-date-${T}`), 1, "the second allowed detail is consumed even when it contains no date");
    assert.equal(pageReads.has(`/strict-detail/exhausted-${T}`), false, "the third candidate cannot exceed maxFetches");
    assert.equal(result.created, 1, "final store contains only candidates that passed the post-detail date gate");
  } finally {
    mock.timers.reset();
  }
});

test("authoritative detail date replaces listing dates and an authoritative missing date clears them", async () => {
  mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-04T12:00:00.000Z") });
  try {
    const result = await collectSource(id("strictAuthoritative"), { force: true });
    assert.equal(result.status, "ok");
    const rows = await sql<{ url: string; published_at: Date | null }[]>`
      SELECT url, published_at FROM articles WHERE source_id = ${id("strictAuthoritative")} ORDER BY url`;
    assert.deepEqual(rows.map((r) => [r.url.split("/").at(-1), r.published_at?.toISOString()]), [
      [`stale-list-${T}`, "2026-09-20T12:00:00.000Z"],
    ], "the non-authoritative stale listing date reaches detail and is replaced; authoritative absence clears a fresh list date");
    assert.equal(pageReads.get(`/strict-authoritative/stale-list-${T}`), 1);
    assert.equal(pageReads.get(`/strict-authoritative/cleared-${T}`), 1);
    assert.equal(result.created, 1);
  } finally {
    mock.timers.reset();
  }
});

test("explicit false preserves legacy first-import handling; the strict rule applies only to the first import", async () => {
  mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-04T12:00:00.000Z") });
  try {
    assert.equal((await collectSource(id("legacyWindow"), { force: true })).status, "ok");
    const legacyRows = await sql<{ url: string; published_at: Date | null }[]>`
      SELECT url, published_at FROM articles WHERE source_id = ${id("legacyWindow")} ORDER BY url`;
    assert.deepEqual(legacyRows.map((r) => [r.url.split("/").at(-1), r.published_at?.toISOString() ?? null]), [
      [`future-${T}`, null], [`missing-${T}`, null],
    ], "legacy first-import behavior keeps undated and future candidates while timeline validation clears an untrusted future date");

    assert.equal((await collectSource(id("incrementalWindow"), { force: true })).status, "ok");
    const incrementalRows = await sql<{ published_at: Date | null }[]>`
      SELECT published_at FROM articles WHERE source_id = ${id("incrementalWindow")}`;
    assert.deepEqual(incrementalRows.map((r) => r.published_at), [null], "strict first-import behavior does not reject undated items after initialization");
  } finally {
    mock.timers.reset();
  }
});

test("initialBackfillRequirePublishedAt accepts only boolean values and the industry config remains disabled", async () => {
  assert.deepEqual(unsupportedConfig("web_list", { url: "https://example.org/", _aihot: { initialBackfillRequirePublishedAt: true } }), []);
  assert.deepEqual(unsupportedConfig("web_list", { url: "https://example.org/", _aihot: { initialBackfillRequirePublishedAt: false } }), []);
  for (const invalid of ["true", 1, null, {}]) {
    assert.ok(unsupportedConfig("web_list", { url: "https://example.org/", _aihot: { initialBackfillRequirePublishedAt: invalid } }).length > 0,
      `${JSON.stringify(invalid)} must not be coerced to a boolean`);
  }
  const sources = JSON.parse(readFileSync(new URL("../industry/sources.json", import.meta.url), "utf8")) as { sources: { id: string; enabled: boolean; interval_minutes: number; site_fulltext: boolean; syndicate_fulltext: boolean; config: { _aihot?: { initialBackfillMonths?: number; initialBackfillRequirePublishedAt?: boolean; requireBodyReadyForAutomaticSelection?: boolean } } }[] };
  assert.equal(sources.sources.length, 23);
  assert.deepEqual(sources.sources.filter((source) => source.config._aihot?.requireBodyReadyForAutomaticSelection).map((source) => source.id).sort(), [
    "mof-chongqing-supervision-dynamics",
    "mof-fujian-supervision-dynamics",
    "mof-guangxi-supervision-dynamics",
    "mof-hainan-supervision-dynamics",
    "mof-sichuan-supervision-dynamics",
  ]);
  for (const source of sources.sources) {
    assert.equal(source.interval_minutes, 1440);
    assert.deepEqual(source.config._aihot, {
      initialBackfillMonths: 3,
      initialBackfillRequirePublishedAt: true,
      ...(["mof-fujian-supervision-dynamics", "mof-guangxi-supervision-dynamics", "mof-hainan-supervision-dynamics", "mof-chongqing-supervision-dynamics", "mof-sichuan-supervision-dynamics"].includes(source.id) ? { requireBodyReadyForAutomaticSelection: true } : {}),
    });
    assert.equal(source.enabled, false);
    assert.equal(source.site_fulltext, false);
    assert.equal(source.syndicate_fulltext, false);
  }
});


test("detail HTML supplies the ordinary extracted body once, while short pages keep extraction pending", async () => {
  const rows = await sql<{ id: string; url: string; body_html: string | null; body_text: string | null; body_status: string }[]>`
    SELECT id, url, body_html, body_text, body_status FROM articles WHERE source_id = ${id("detail")} ORDER BY url`;
  const [short, full] = rows;
  assert.equal(short!.body_status, "pending", "an unconfirmed body retains the original extraction fallback");
  const expected = readable(pages[`/p/b-${T}`]!(base), `${base}/p/b-${T}`)!;
  assert.deepEqual([full!.body_html, full!.body_text, full!.body_status], [expected.html, expected.text, "ok"]);
  assert.equal(await extractArticleBody(full!.id, false), "skipped");
  assert.equal(pageReads.get(`/p/b-${T}`), 1, "known listings and extraction never download the same confirmed body again");
});
