import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { config } from "../packages/backend/src/config.ts";
import { fetchGovcnJsonPage } from "../packages/backend/src/sources/json-list.ts";
import {
  createGovcnJsonPaginationBudget,
  govcnJsonPageUrl,
  isGovcnJsonResumeCursor,
  newGovcnJsonResumeCursor,
  readGovcnJsonPagination,
  validateGovcnJsonPagination,
} from "../packages/backend/src/sources/json-list-pagination.ts";
import { unsupportedConfig } from "../packages/backend/src/sources/config-keys.ts";
import type { SourceRow } from "../packages/backend/src/sources/types.ts";

const raw = readFileSync(new URL("./fixtures/govcn-detail-identity/policy-search-response.json", import.meta.url));
const registry = JSON.parse(readFileSync(new URL("../industry/sources.json", import.meta.url), "utf8"));
const baseSource = registry.sources.find((row: any) => row.id === "govcn-policy-library") as SourceRow;
const resumeSource = {
  ...baseSource,
  config: { ...baseSource.config, pagination: { mode: "govcn_query_resume_v1", maxPagesPerRun: 2, maxDispatches: 7 } },
} as SourceRow;
const exactBase = "https://sousuo.www.gov.cn/search-gov/data?q=&sort=score&sortType=1&searchfield=title&p=1&n=5&type=gwyzcwjk";
const page1 = govcnJsonPageUrl(exactBase, 1, true);
const page3 = govcnJsonPageUrl(exactBase, 3, true);
const backendRequire = createRequire(new URL("../packages/backend/src/lib/http-fetch.ts", import.meta.url));
const { getGlobalDispatcher, MockAgent, setGlobalDispatcher } = backendRequire("undici") as any;

async function withMockAgent<T>(run: (agent: any) => Promise<T>): Promise<T> {
  const agent = new MockAgent();
  agent.disableNetConnect();
  const prior = getGlobalDispatcher();
  const priorPrivate = config.allowPrivateNetworkFetch;
  try {
    config.allowPrivateNetworkFetch = true;
    setGlobalDispatcher(agent);
    return await run(agent);
  } finally {
    setGlobalDispatcher(prior);
    config.allowPrivateNetworkFetch = priorPrivate;
    await agent.close();
  }
}

function intercept(agent: any, urlText: string, payload: Buffer) {
  const url = new URL(urlText);
  agent.get(url.origin).intercept({ path: url.pathname + url.search, method: "GET" })
    .reply(200, payload, { headers: { "content-type": "application/json; charset=utf-8" } });
}

test("resume mode is explicit and keeps the stateless page limit unchanged", () => {
  assert.deepEqual(validateGovcnJsonPagination("json_list", resumeSource.config), []);
  assert.deepEqual(unsupportedConfig("json_list", resumeSource.config), []);
  assert.equal(readGovcnJsonPagination(resumeSource.config)?.mode, "govcn_query_resume_v1");
  assert.equal(govcnJsonPageUrl(exactBase, 2), govcnJsonPageUrl(exactBase, 2, false));
  assert.throws(() => govcnJsonPageUrl(exactBase, 3), /invalid GovCN/);
  assert.equal(govcnJsonPageUrl(exactBase, 200, true).includes("p=200"), true);
  assert.throws(() => govcnJsonPageUrl(exactBase, 201, true), /invalid GovCN/);
  for (const pagination of [
    { mode: "govcn_query_resume_v1", maxPagesPerRun: 1, maxDispatches: 7 },
    { mode: "govcn_query_resume_v1", maxPagesPerRun: 2, maxDispatches: 1 },
    { mode: "govcn_query_resume_v1", maxPagesPerRun: 2, maxDispatches: 13 },
    { mode: "govcn_query_resume_v1", maxPagesPerRun: 2, maxDispatches: 7, cursorKey: "other" },
  ]) assert.ok(validateGovcnJsonPagination("json_list", { ...resumeSource.config, pagination }).length > 0);
  assert.ok(validateGovcnJsonPagination("web_list", resumeSource.config).length > 0);
});

test("resume cursor binds an exact fixed 90-day generation and fails closed on drift", () => {
  const now = new Date("2026-10-09T02:00:00.000Z");
  const cursor = newGovcnJsonResumeCursor(resumeSource, now);
  assert.equal(isGovcnJsonResumeCursor(cursor, now), true);
  assert.equal(cursor.nextPage, 1);
  assert.equal(cursor.pagesCommitted, 0);
  assert.equal(Date.parse(cursor.anchorAt) - Date.parse(cursor.cutoffAt), 90 * 86_400_000);
  assert.equal(isGovcnJsonResumeCursor({ ...cursor, unknown: true }, now), false);
  assert.equal(isGovcnJsonResumeCursor({ ...cursor, generationId: "------------------------------------" }, now), false);
  assert.equal(isGovcnJsonResumeCursor({ ...cursor, nextPage: 2 }, now), false);
  assert.equal(isGovcnJsonResumeCursor({ ...cursor, cutoffAt: "2026-07-10T02:00:00.000Z" }, now), false);
  assert.equal(isGovcnJsonResumeCursor({ ...cursor, anchorAt: "2026-10-10T02:00:00.000Z" }, now), false);
  const committed = { ...cursor, pagesCommitted: 2, nextPage: 3, lastPageFingerprint: "a".repeat(64), lastPageIdentityHashes: ["b".repeat(64), "c".repeat(64)] };
  assert.equal(isGovcnJsonResumeCursor(committed, now), true);
  assert.equal(isGovcnJsonResumeCursor({ ...committed, lastPageIdentityHashes: ["c".repeat(64), "b".repeat(64)] }, now), false);
});

test("resume budget admits p1 plus exactly the persisted continuation target, including p3", async () => {
  await withMockAgent(async (agent) => {
    const payload = JSON.parse(raw.toString("utf8"));
    payload.paramsVO.p = 3;
    intercept(agent, page3, Buffer.from(JSON.stringify(payload), "utf8"));
    const pagination = readGovcnJsonPagination(resumeSource.config)!;
    const budget = createGovcnJsonPaginationBudget(resumeSource, pagination);
    try {
      budget.setListPages([1, 3]);
      budget.setPage(1);
      budget.runBudget.beforeDispatch({ url: new URL(page1), method: "GET", redirectHop: 0 });
      budget.pageFetched();
      budget.setPage(3);
      const result = await fetchGovcnJsonPage(resumeSource, 3, { runBudget: budget.runBudget, assertActive: budget.assertActive });
      budget.pageFetched();
      assert.equal(result.rawRowCount, 5);
      assert.equal(budget.dispatchesUsed(), 2);
      assert.equal(budget.pagesFetched(), 2);
      assert.equal(budget.summary().mode, "govcn_query_resume_v1");
      assert.equal(budget.summary().coverage, "unproven");
      assert.throws(() => budget.setPage(4), /admission rejected/);
    } finally { budget.dispose(); }
  });
});
