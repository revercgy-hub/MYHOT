import assert from "node:assert/strict";
import { test } from "node:test";
import type { GuardedFetchRunBudget } from "@aihot/backend/lib/http-fetch";
import { fetchWebListMetadata } from "@aihot/backend/sources/web-list";
import type { SourceRow } from "@aihot/backend/sources/types";

const listingUrl = "https://sc.mof.gov.cn/caizhengjiancha/";
const articleUrl = `${listingUrl}202610/t20261006_12345.htm`;

function source(detail: Record<string, unknown> = {}): SourceRow {
  return {
    id: "metadata-contract-fixture",
    kind: "web_list",
    config: {
      url: listingUrl,
      allowUrlPrefixes: [listingUrl],
      itemSelector: "ul li",
      linkSelector: "a",
      titleSelector: "a",
      publishedAtSelector: "time",
      publishedAtUtcOffset: "+08:00",
      _aihot: { initialBackfillRequirePublishedAt: true },
      pagination: {
        mode: "mof_index_v1",
        detailMode: "direct_html_metadata_v1",
        maxPagesPerRun: 2,
        maxDispatches: 12,
        maxPageIndex: 45,
      },
      detail: { maxFetches: 3, ...detail },
    },
  } as unknown as SourceRow;
}

function response(url: string, html: string, status = 200, contentType = "text/html; charset=utf-8") {
  const body = Buffer.from(html);
  return {
    status,
    url,
    headers: new Headers({ "content-type": contentType }),
    body,
    text: () => html,
  };
}

function transport(html: string, options: {
  status?: number;
  contentType?: string;
  finalUrl?: string;
  remainingMs?: number;
  activeError?: Error;
} = {}) {
  const admissions: string[] = [];
  const requests: Array<{ url: string; timeoutMs?: number; maxBytes?: number; maxRedirects?: number; route?: string }> = [];
  let activeChecks = 0;
  const runBudget: GuardedFetchRunBudget = {
    beforeDispatch({ url, method, redirectHop }) {
      admissions.push(`${method}:${redirectHop}:${url.pathname}`);
    },
    allowRedirect() { return true; },
  };
  const testFetcher = async (url: string, fetchOptions: Parameters<typeof import("@aihot/backend/lib/http-fetch").guardedFetch>[1] = {}) => {
    requests.push({ url, timeoutMs: fetchOptions.timeoutMs, maxBytes: fetchOptions.maxBytes, maxRedirects: fetchOptions.maxRedirects, route: fetchOptions.route });
    fetchOptions.runBudget?.beforeDispatch({ url: new URL(url), method: fetchOptions.method ?? "GET", redirectHop: 0 });
    return response(options.finalUrl ?? url, html, options.status ?? 200, options.contentType ?? "text/html; charset=utf-8");
  };
  return {
    admissions,
    requests,
    testFetcher,
    runBudget,
    remainingMs: () => options.remainingMs ?? 30_000,
    assertActive() {
      activeChecks++;
      if (options.activeError && activeChecks >= 3) throw options.activeError;
    },
    activeChecks: () => activeChecks,
  };
}

test("metadata-only transport extracts configured title/date and consumes shared budget", async () => {
  const fixture = transport([
    '<html><head><meta property="article:published_time" content="2020-01-01"></head>',
    '<body><h1 class="title">  财政部四川监管局：测试标题 </h1>',
    '<time class="published" datetime="2026-10-06 09:15">页面更新时间 2026-10-07</time></body></html>',
  ].join(""), { remainingMs: 6_500 });
  const result = await fetchWebListMetadata(articleUrl, source({
    titleSelector: "h1.title",
    publishedAtSelector: "time.published",
    publishedAtUtcOffset: "+08:00",
    bodySelector: "article",
  }), { title: true, date: true }, {
    runBudget: fixture.runBudget,
    remainingMs: fixture.remainingMs,
    assertActive: fixture.assertActive,
    testFetcher: fixture.testFetcher,
  });

  assert.equal(result.finalUrl, articleUrl);
  assert.deepEqual(result.title, { status: "found", value: "财政部四川监管局：测试标题", source: "configured_rule" });
  assert.deepEqual(result.date, { status: "found", value: "2026-10-06T01:15:00.000Z", source: "configured_rule" });
  assert.deepEqual(fixture.admissions, ["GET:0:/caizhengjiancha/202610/t20261006_12345.htm"]);
  assert.equal(fixture.requests.length, 1);
  assert.deepEqual(fixture.requests[0], {
    url: articleUrl,
    timeoutMs: 6_500,
    maxBytes: 6 * 1024 * 1024,
    maxRedirects: 5,
    route: "direct",
  });
  assert.ok(fixture.activeChecks() >= 3, "deadline is checked before request, after response, and after parsing");
  assert.deepEqual(Object.keys(result).sort(), ["date", "finalUrl", "title"]);
});

test("metadata-only mode never falls back to generic publication metadata", async () => {
  const fixture = transport('<html><head><meta property="article:published_time" content="2026-10-06"></head><body><h1>title</h1></body></html>');
  const result = await fetchWebListMetadata(articleUrl, source({ publishedAtSelector: "time.published" }),
    { title: false, date: true }, {
      runBudget: fixture.runBudget,
      remainingMs: fixture.remainingMs,
      assertActive: fixture.assertActive,
      testFetcher: fixture.testFetcher,
    });

  assert.deepEqual(result.date, { status: "missing", source: "configured_rule" });
  assert.deepEqual(result.title, { status: "not_requested" });
  assert.equal(fixture.admissions.length, 1);
});

test("requested field without a matching configured rule is explicit and does not suppress another requested rule", async () => {
  const fixture = transport('<html><body><time class="published" datetime="2026-10-06"></time></body></html>');
  const result = await fetchWebListMetadata(articleUrl, source({ publishedAtSelector: "time.published" }),
    { title: true, date: true }, {
      runBudget: fixture.runBudget,
      remainingMs: fixture.remainingMs,
      assertActive: fixture.assertActive,
      testFetcher: fixture.testFetcher,
    });

  assert.deepEqual(result.title, { status: "missing", source: "no_configured_rule" });
  assert.deepEqual(result.date, { status: "found", value: "2026-10-05T16:00:00.000Z", source: "configured_rule" });
  assert.equal(fixture.admissions.length, 1);
});

test("timeout is capped at twenty seconds even when the shared deadline has more time", async () => {
  const fixture = transport("<html><body><h1>bounded</h1></body></html>", { remainingMs: 90_000 });
  await fetchWebListMetadata(articleUrl, source({ titleSelector: "h1" }), { title: true, date: false }, {
    runBudget: fixture.runBudget,
    remainingMs: fixture.remainingMs,
    assertActive: fixture.assertActive,
    testFetcher: fixture.testFetcher,
  });
  assert.equal(fixture.requests[0]?.timeoutMs, 20_000);
});

test("no configured requested field fails before dispatch instead of yielding a resolution", async () => {
  const fixture = transport("<html></html>");
  await assert.rejects(fetchWebListMetadata(articleUrl, source({ publishedAtSelector: "time" }),
    { title: false, date: false }, {
      runBudget: fixture.runBudget,
      remainingMs: fixture.remainingMs,
      assertActive: fixture.assertActive,
      testFetcher: fixture.testFetcher,
    }), /no configured title\/date rule/);
  assert.equal(fixture.admissions.length, 0);
});

test("invalid metadata mode config and unknown needs fail before dispatch", async () => {
  const fixture = transport("<html><body><h1>no network</h1></body></html>");
  await assert.rejects(fetchWebListMetadata(articleUrl, source({
    titleSelector: "h1",
    pdfDirect: true,
  }), { title: true, date: false }, {
    runBudget: fixture.runBudget,
    remainingMs: fixture.remainingMs,
    assertActive: fixture.assertActive,
    testFetcher: fixture.testFetcher,
  }), /unsupported metadata detail config/);
  await assert.rejects(fetchWebListMetadata(articleUrl, source({ titleSelector: "h1" }), {
    title: true,
    date: false,
    body: true,
  } as never, {
    runBudget: fixture.runBudget,
    remainingMs: fixture.remainingMs,
    assertActive: fixture.assertActive,
    testFetcher: fixture.testFetcher,
  }), /need must contain only boolean title\/date/);
  assert.equal(fixture.admissions.length, 0);
});

test("non-200 and non-text/html responses fail closed", async () => {
  for (const options of [{ status: 304 }, { contentType: "application/xhtml+xml" }]) {
    const fixture = transport("<html><body><h1>ignored</h1></body></html>", options);
    await assert.rejects(fetchWebListMetadata(articleUrl, source({ titleSelector: "h1" }), { title: true, date: false }, {
      runBudget: fixture.runBudget,
      remainingMs: fixture.remainingMs,
      assertActive: fixture.assertActive,
      testFetcher: fixture.testFetcher,
    }), options.status ? /HTTP 304/ : /not text\/html/);
    assert.equal(fixture.admissions.length, 1);
  }
});

test("redirect final URL must remain the same article identity", async () => {
  const fixture = transport("<html><body><h1>ignored</h1></body></html>", {
    finalUrl: `${listingUrl}202610/t20261007_other.htm`,
  });
  await assert.rejects(fetchWebListMetadata(articleUrl, source({ titleSelector: "h1" }), { title: true, date: false }, {
    runBudget: fixture.runBudget,
    remainingMs: fixture.remainingMs,
    assertActive: fixture.assertActive,
    testFetcher: fixture.testFetcher,
  }), /redirect changed article identity/);
  assert.equal(fixture.admissions.length, 1);
});

test("article target outside the exact source directory is rejected before dispatch", async () => {
  const fixture = transport("<html><body><h1>never requested</h1></body></html>");
  await assert.rejects(fetchWebListMetadata("https://sc.mof.gov.cn/other/202610/t1.htm", source({ titleSelector: "h1" }),
    { title: true, date: false }, {
      runBudget: fixture.runBudget,
      remainingMs: fixture.remainingMs,
      assertActive: fixture.assertActive,
      testFetcher: fixture.testFetcher,
    }), /outside the configured article directory/);
  assert.equal(fixture.admissions.length, 0);
});

test("an exhausted run deadline prevents dispatch and a post-parse expiry rejects the result", async () => {
  for (const remainingMs of [0, 0.5]) {
    const exhausted = transport("<html><body><h1>never requested</h1></body></html>", { remainingMs });
    await assert.rejects(fetchWebListMetadata(articleUrl, source({ titleSelector: "h1" }), { title: true, date: false }, {
      runBudget: exhausted.runBudget,
      remainingMs: exhausted.remainingMs,
      assertActive: exhausted.assertActive,
      testFetcher: exhausted.testFetcher,
    }), /deadline exhausted/);
    assert.equal(exhausted.admissions.length, 0);
  }

  const expired = transport("<html><body><h1>parsed</h1></body></html>", { activeError: new Error("fixture_deadline") });
  await assert.rejects(fetchWebListMetadata(articleUrl, source({ titleSelector: "h1" }), { title: true, date: false }, {
    runBudget: expired.runBudget,
    remainingMs: expired.remainingMs,
    assertActive: expired.assertActive,
    testFetcher: expired.testFetcher,
  }), /fixture_deadline/);
  assert.equal(expired.admissions.length, 1);
});
