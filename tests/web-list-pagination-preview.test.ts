// Previewing a pagination-enabled source must remain an explicitly bounded page-0 read.
import "./setup.ts";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { after, before, test } from "node:test";
import { config } from "@aihot/backend/config";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { previewSource } from "@aihot/backend/admin/sources";
import { tag } from "./setup.ts";

// Use the same pinned Undici 8 instance as backend/http-fetch.ts, not the repository-root version.
const backendRequire = createRequire(new URL("../packages/backend/src/lib/http-fetch.ts", import.meta.url));
const { getGlobalDispatcher, MockAgent, setGlobalDispatcher } = backendRequire("undici");
const base = "https://gx.mof.gov.cn/gzdt/caizhengjiancha/";
const id = `web-list-preview-${tag()}`;
const agent = new MockAgent();
agent.disableNetConnect();
let priorDispatcher: unknown;
let priorPrivateNetwork: boolean;

function draft(pagination?: Record<string, unknown>, opts: { listingUrl?: string; detailFetches?: number } = {}) {
  return {
    id,
    kind: "web_list" as const,
    config: {
      url: opts.listingUrl ?? base,
      parseMode: "html",
      itemSelector: "li",
      linkSelector: "a[href]",
      titleSelector: "a",
      publishedAtSelector: "time",
      allowUrlPrefixes: [opts.listingUrl ?? base],
      ...(pagination ? { pagination } : {}),
      ...(pagination ? { _aihot: { initialBackfillRequirePublishedAt: true } } : {}),
      ...(opts.detailFetches === undefined ? {} : {
        detail: { maxFetches: opts.detailFetches, titleSelector: "h1" },
      }),
    },
  };
}

function pageWithCandidate(path = "202610/sample.htm") {
  return `<ul><li><a href="${path}">A sufficiently long fiscal supervision headline</a><time>2026-10-06</time></li></ul>`;
}

before(() => {
  priorDispatcher = getGlobalDispatcher();
  priorPrivateNetwork = config.allowPrivateNetworkFetch;
  config.allowPrivateNetworkFetch = true; // MockAgent is the only transport; no DNS or network is used.
  setGlobalDispatcher(agent);
});

after(async () => {
  setGlobalDispatcher(priorDispatcher);
  config.allowPrivateNetworkFetch = priorPrivateNetwork;
  await agent.close();
  await stopBoss();
  await closeDb();
});

test("pagination preview fetches exactly page zero and returns explicit unproven metadata", async () => {
  const page0Path = new URL(base).pathname;
  const pool = agent.get(new URL(base).origin);
  let dispatched = 0;
  pool.intercept({ path: page0Path, method: "GET" }).reply(() => {
    dispatched += 1;
    return { statusCode: 200, data: pageWithCandidate(), responseOptions: { headers: { "content-type": "text/html; charset=utf-8" } } };
  });
  const beforeRows = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM sources WHERE id = ${id}`;

  const result = await previewSource(draft({ mode: "mof_index_v1", maxPagesPerRun: 2, maxDispatches: 4, maxPageIndex: 45 }, { detailFetches: 0 }));

  assert.equal(result.previewMode, "single_page");
  assert.equal(result.paginationExecuted, false);
  assert.equal(result.coverage, "unproven");
  assert.equal(result.count, 1);
  assert.equal(result.items[0]?.url, new URL("202610/sample.htm", base).toString());
  assert.equal((await sql`SELECT id FROM sources WHERE id = ${id}`).length, 0);
  assert.equal((await sql`SELECT id FROM fetch_runs WHERE source_id = ${id}`).length, 0);
  assert.equal(beforeRows[0]?.count, 0);
  assert.equal(dispatched, 1, "only the configured page-0 request was dispatched; no detail or page-1 fetch occurred");
});

test("pagination preview filters dated numbered-page links and query/hash aliases", async () => {
  const previewBase = "https://hb.mof.gov.cn/gzdt/caizhengjiancha/";
  const pool = agent.get(new URL(previewBase).origin);
  let dispatched = 0;
  pool.intercept({ path: new URL(previewBase).pathname, method: "GET" }).reply(() => {
    dispatched += 1;
    return {
      statusCode: 200,
      data: `<ul><li><a href="index_1.htm?x=1#anchor">2026年08月30日历史新闻列表</a><time>2026-08-30</time></li><li><a href="202610/article.htm">财政监管工作取得新进展</a><time>2026-10-06</time></li></ul>`,
      responseOptions: { headers: { "content-type": "text/html; charset=utf-8" } },
    };
  });

  const result = await previewSource(draft(
    { mode: "mof_index_v1", maxPagesPerRun: 2, maxDispatches: 4, maxPageIndex: 45 },
    { listingUrl: previewBase },
  ));

  assert.equal(result.count, 1);
  assert.equal(result.items[0]?.url, new URL("202610/article.htm", previewBase).toString());
  assert.equal(dispatched, 1, "the page-0 preview does not dispatch the numbered page link");
});

test("pagination preview rejects when parsing finishes after the run deadline", async () => {
  const deadlineBase = "https://js.mof.gov.cn/gzdt/caizhengjiancha/";
  const page0Path = new URL(deadlineBase).pathname;
  const pool = agent.get(new URL(deadlineBase).origin);
  pool.intercept({ path: page0Path, method: "GET" }).reply(() => ({
    statusCode: 200,
    data: pageWithCandidate(),
    responseOptions: { headers: { "content-type": "text/html; charset=utf-8" } },
  }));

  const originalNow = Date.now;
  let calls = 0;
  Date.now = () => ++calls < 3 ? originalNow() : originalNow() + 121_000;
  try {
    await assert.rejects(
      previewSource(draft({ mode: "mof_index_v1", maxPagesPerRun: 2, maxDispatches: 4, maxPageIndex: 45 }, { listingUrl: deadlineBase })),
      /web-list run deadline exceeded/iu,
    );
  } finally {
    Date.now = originalNow;
  }
});

test("pagination preview refuses a redirect that changes the current page identity", async () => {
  const pool = agent.get(new URL(base).origin);
  let dispatched = 0;
  pool.intercept({ path: new URL(base).pathname, method: "GET" }).reply(() => {
    dispatched += 1;
    return { statusCode: 302, responseOptions: { headers: { location: `${new URL(base).pathname}index_1.htm` } }, data: "" };
  });

  await assert.rejects(
    previewSource(draft({ mode: "mof_index_v1", maxPagesPerRun: 2, maxDispatches: 4, maxPageIndex: 45 })),
    /redirect target rejected|outside configured listing directory|budget/iu,
  );
  assert.equal(dispatched, 1, "the page-changing redirect is refused before a second request");
});

test("pagination preview refuses a redirect back to page zero before a second dispatch", async () => {
  const capBase = "https://cq.mof.gov.cn/gzdt/caizhengjiancha/";
  const pool = agent.get(new URL(capBase).origin);
  let dispatched = 0;
  const page0Path = new URL(capBase).pathname;
  pool.intercept({ path: page0Path, method: "GET" }).reply(() => {
    dispatched += 1;
    return { statusCode: 302, responseOptions: { headers: { location: page0Path } }, data: "" };
  });

  await assert.rejects(
    previewSource(draft({ mode: "mof_index_v1", maxPagesPerRun: 2, maxDispatches: 1, maxPageIndex: 45 }, { listingUrl: capBase })),
    /redirect target rejected by run budget/iu,
  );
  assert.equal(dispatched, 1, "a redirect back to the already-dispatched page zero is rejected before a second request");
});

test("invalid pagination config is rejected before any preview request", async () => {
  const pool = agent.get(new URL(base).origin);
  let dispatched = 0;
  pool.intercept({ path: new URL(base).pathname, method: "GET" }).reply(() => {
    dispatched += 1;
    return { statusCode: 200, data: pageWithCandidate() };
  });
  await assert.rejects(
    previewSource(draft({ mode: "mof_index_v1", maxPagesPerRun: 2, maxDispatches: 13, maxPageIndex: 45 })),
    /maxDispatches|pagination/iu,
  );
  assert.equal(dispatched, 0, "invalid caps fail before transport");
});

test("legacy web-list preview keeps its existing response fields and one-page behavior", async () => {
  const legacyPath = "/legacy-preview/";
  const pool = agent.get("https://legacy.example.test");
  let dispatched = 0;
  pool.intercept({ path: legacyPath, method: "GET" }).reply(() => {
    dispatched += 1;
    return { statusCode: 200, data: pageWithCandidate(), responseOptions: { headers: { "content-type": "text/html; charset=utf-8" } } };
  });
  const result = await previewSource(draft(undefined, { listingUrl: `https://legacy.example.test${legacyPath}`, detailFetches: 10 }));

  assert.deepEqual(Object.keys(result).sort(), ["count", "items", "ms"]);
  assert.equal(result.count, 1);
  assert.equal(dispatched, 1, "legacy preview remains a single listing read and does not fetch details");
});
