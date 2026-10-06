import assert from "node:assert/strict";
import http from "node:http";
import { after, test } from "node:test";
import { config } from "@aihot/backend/config";
import { guardedFetch, type GuardedFetchRunBudget } from "@aihot/backend/lib/http-fetch";
import { createWebListPaginationBudget, type MofIndexPaginationConfig } from "@aihot/backend/sources/web-list-pagination";
import { fetchWebList } from "@aihot/backend/sources/web-list";
import type { SourceRow } from "@aihot/backend/sources/types";

const hits = new Map<string, number>();
const server = http.createServer((req, res) => {
  const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
  hits.set(path, (hits.get(path) ?? 0) + 1);
  if (path === "/redirect" || path === "/deny-redirect") {
    res.writeHead(302, { location: "/redirect-target" }).end();
  } else if (path === "/list/loop/") {
    res.writeHead(302, { location: "/list/loop/" }).end();
  } else if (path === "/list/page-2/index_1.htm") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end([
      "<html><body>",
      '<a href="/list/page-2/index_1.htm#current">当前列表页自身</a>',
      '<a href="./news/20261006_1.htm" title="分页页中的测试文章">分页页中的测试文章</a>',
      "</body></html>",
    ].join(""));
  } else if (path === "/legacy/page-0/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end([
      "<html><body>",
      '<a href="/legacy/page-0/#current">当前列表页自身</a>',
      '<a href="./legacy-story.htm" title="默认配置中的测试文章">默认配置中的测试文章</a>',
      "</body></html>",
    ].join(""));
  } else {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end("local fixture only");
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const site = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
config.allowPrivateNetworkFetch = true;
after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

const resetHits = () => hits.clear();
const fixtureSource = (url: string): SourceRow => ({
  id: "pagination-transport-fixture",
  kind: "web_list",
  config: { url, allowUrlPrefixes: [`${site}/`] },
}) as unknown as SourceRow;

test("shared run budget admits before each actual dispatch and includes redirects", async () => {
  resetHits();
  const admitted: string[] = [];
  let used = 0;
  const runBudget: GuardedFetchRunBudget = {
    beforeDispatch({ url, redirectHop }) {
      admitted.push(`${redirectHop}:${url.pathname}`);
      if (used >= 1) throw new Error("fixture_dispatch_budget_exhausted");
      used++;
    },
  };

  await assert.rejects(guardedFetch(`${site}/redirect`, { route: "direct", runBudget }), /fixture_dispatch_budget_exhausted/);
  assert.deepEqual(admitted, ["0:/redirect", "1:/redirect-target"]);
  assert.equal(hits.get("/redirect"), 1);
  assert.equal(hits.get("/redirect-target") ?? 0, 0);
});

test("run budget redirect policy receives checked target and can reject it before dispatch", async () => {
  resetHits();
  const calls: string[] = [];
  const runBudget: GuardedFetchRunBudget = {
    beforeDispatch({ url, redirectHop }) { calls.push(`dispatch:${redirectHop}:${url.pathname}`); },
    allowRedirect({ from, to, redirectHop }) {
      calls.push(`redirect:${redirectHop}:${from.pathname}->${to.pathname}`);
      return false;
    },
  };

  await assert.rejects(guardedFetch(`${site}/deny-redirect`, { route: "direct", runBudget }), /Redirect target rejected by run budget/);
  assert.deepEqual(calls, [
    "dispatch:0:/deny-redirect",
    "redirect:1:/deny-redirect->/redirect-target",
  ]);
  assert.equal(hits.get("/deny-redirect"), 1);
  assert.equal(hits.get("/redirect-target") ?? 0, 0);
});

test("pagination run budget rejects a redirect back to an already dispatched list URL", async () => {
  resetHits();
  const pagination: MofIndexPaginationConfig = {
    mode: "mof_index_v1",
    maxPagesPerRun: 2,
    maxDispatches: 4,
    maxPageIndex: 45,
  };
  const listUrl = `${site}/list/loop/`;
  const budget = createWebListPaginationBudget(fixtureSource(listUrl), pagination);
  try {
    budget.setCurrentPage(0);
    await assert.rejects(
      guardedFetch(listUrl, { route: "direct", runBudget: budget.runBudget }),
      /Redirect target rejected by run budget|already dispatched|revisited|already visited|duplicate/iu,
    );
    assert.equal(hits.get("/list/loop/"), 1, "the repeated redirect URL is refused before a second server hit");
    assert.equal(budget.dispatchesUsed(), 1, "a refused revisit does not consume another dispatch admission");
  } finally {
    budget.dispose();
  }
});

test("an already-aborted shared run signal prevents dispatch", async () => {
  resetHits();
  const controller = new AbortController();
  controller.abort(new Error("fixture_run_deadline"));
  let admissions = 0;
  const runBudget: GuardedFetchRunBudget = {
    signal: controller.signal,
    beforeDispatch() { admissions++; },
  };

  await assert.rejects(guardedFetch(`${site}/no-dispatch`, { route: "direct", runBudget }), /fixture_run_deadline/);
  assert.equal(admissions, 0);
  assert.equal(hits.get("/no-dispatch") ?? 0, 0);
});

test("fetchWebList uses the injected page URL as both relative base and listing identity", async () => {
  resetHits();
  const admitted: string[] = [];
  const runBudget: GuardedFetchRunBudget = {
    beforeDispatch({ url, method, redirectHop }) { admitted.push(`${method}:${redirectHop}:${url.pathname}`); },
  };
  const source = fixtureSource(`${site}/legacy/page-0/`);
  const page2 = `${site}/list/page-2/index_1.htm`;

  const candidates = await fetchWebList(source, { listUrl: page2, runBudget });

  assert.deepEqual(admitted, ["GET:0:/list/page-2/index_1.htm"]);
  assert.equal(hits.get("/list/page-2/index_1.htm"), 1);
  assert.deepEqual(candidates.map(({ url, title }) => ({ url, title })), [{
    url: `${site}/list/page-2/news/20261006_1.htm`,
    title: "分页页中的测试文章",
  }]);
  assert.equal(source.config.url, `${site}/legacy/page-0/`);
});

test("fetchWebList without options preserves the configured single-page request", async () => {
  resetHits();
  const page0 = `${site}/legacy/page-0/`;
  const candidates = await fetchWebList(fixtureSource(page0));

  assert.equal(hits.get("/legacy/page-0/"), 1);
  assert.equal(hits.get("/list/page-2/index_1.htm") ?? 0, 0);
  assert.deepEqual(candidates.map(({ url, title }) => ({ url, title })), [{
    url: `${site}/legacy/page-0/legacy-story.htm`,
    title: "默认配置中的测试文章",
  }]);
});
