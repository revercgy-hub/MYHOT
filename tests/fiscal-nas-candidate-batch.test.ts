import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";
import type { Candidate, SourceRow } from "../packages/backend/src/sources/types.ts";
import { unsupportedConfig } from "../packages/backend/src/sources/config-keys.ts";
import { assertApprovedCaptureReplayMetadata, assertDatabaseSourcesMatchCatalog, buildSourcePlan, classifyCandidates, createBudgetedDetailFetcher, DAILY_LATEST_PRESET, decodeCapturedBody, decodeCapturedResponse, detailConfigIsDirectHtml, findKnownIdentityKeys, isBatchDispatchInScope, isCandidateInFreshnessWindow, loadCandidateCatalog, resolveCandidateBatchScope, sameConfiguredDay, SUMMARY_DRAFT_SOURCE_IDS } from "../scripts/fiscal/nas-candidate-batch.ts";
import { fetchDetail, fromHtml } from "../packages/backend/src/sources/web-list.ts";

const catalogBytes = readFileSync(resolve("industry/sources.json"));
const catalog = JSON.parse(catalogBytes.toString("utf8")).sources as Array<Record<string, any>>;
const source = catalog.find((row) => row.id === "mof-budget-work")! as SourceRow;
const allowed = (url: string, row: SourceRow) => (row.config.allowUrlPrefixes as string[]).some((prefix) => url.startsWith(prefix));
const identityKeyFor = (material: Candidate & { sourceId: string; via: "fetch" }) => `id:${material.url}`;
const candidate = (url: string, title = "预算执行情况", daysAgo = 1): Candidate => ({
  url, title, publishedAt: new Date(Date.now() - daysAgo * 86_400_000), bodyText: null,
});

test("daily-latest preset binds 46 disabled sources and summary drafting stays on the original 20", () => {
  const catalogSha256 = DAILY_LATEST_PRESET.catalogSha256;
  assert.equal(createHash("sha256").update(catalogBytes).digest("hex"), catalogSha256);
  const resolved = resolveCandidateBatchScope({ preset: "daily-latest", sourceIds: ["mof-budget-work"],
    maxNewPerSource: 30, maxDetailsTotal: 0, recentDays: 90, catalogSha256 });
  assert.equal(resolved.preset, "daily-latest");
  assert.equal(resolved.sourceIds.length, 46);
  assert.equal(new Set(resolved.sourceIds).size, 46);
  assert.deepEqual(resolved.sourceIds.slice(0, SUMMARY_DRAFT_SOURCE_IDS.length), [...SUMMARY_DRAFT_SOURCE_IDS]);
  assert.equal(SUMMARY_DRAFT_SOURCE_IDS.length, 20);
  assert.equal(Object.isFrozen(SUMMARY_DRAFT_SOURCE_IDS), true);
  assert.equal(resolved.sourceIds.includes("mof-treasury-debt-data"), false);
  assert.equal(resolved.sourceIds.includes("pboc-open-market"), false);
  assert.equal(resolved.recentDays, 7);
  assert.equal(resolved.requirePublishedAt, true);
  assert.equal(resolved.maxNewPerSource, 10);
  assert.equal(resolved.maxDetailsTotal, 30);
  assert.equal(resolved.maxDispatches, 76);
  const plan = buildSourcePlan({ catalogSources: catalog, sourceIds: resolved.sourceIds,
    maxNewPerSource: resolved.maxNewPerSource, maxDetailsTotal: resolved.maxDetailsTotal, unsupportedConfig });
  assert.equal(plan.length, 46);
  assert.ok(plan.every((row) => row.maxNew === 10));
  assert.ok(plan.reduce((sum, row) => sum + row.maxDetails, 0) >= 30);
  assert.ok(plan.every((row) => catalog.find((s) => s.id === row.id)?.enabled === false));
  assert.ok(plan.every((row) => catalog.find((s) => s.id === row.id)?.site_fulltext === false));
  assert.ok(plan.every((row) => catalog.find((s) => s.id === row.id)?.syndicate_fulltext === false));
  assert.throws(() => resolveCandidateBatchScope({ preset: "daily-latest", sourceIds: [], maxNewPerSource: 10,
    maxDetailsTotal: 30, recentDays: 7, catalogSha256: "0".repeat(64) }), /catalog hash drift/u);
  assert.throws(() => resolveCandidateBatchScope({ preset: "daily-latest", sourceIds: [], maxNewPerSource: 10,
    maxDetailsTotal: 30, recentDays: 7, catalogSha256, explicitlyProvidedOptions: ["--source-ids"] }), /scope overrides/u);
  assert.throws(() => resolveCandidateBatchScope({ preset: "other", sourceIds: [], maxNewPerSource: 10,
    maxDetailsTotal: 30, recentDays: 7, catalogSha256 }), /unknown candidate batch preset/u);
});

test("daily-latest requires strict seven-day dates while legacy retains per-source backfill defaults", () => {
  const legacy = resolveCandidateBatchScope({ sourceIds: ["mof-budget-work"], maxNewPerSource: 30,
    maxDetailsTotal: 0, catalogSha256: "not-pinned-for-legacy" });
  assert.equal(legacy.preset, null);
  assert.equal(legacy.recentDays, null);
  const anchorMs = Date.parse("2026-10-27T12:00:00.000Z");
  const at7d = new Date(anchorMs - 7 * 86_400_000);
  assert.equal(isCandidateInFreshnessWindow({ publishedAt: at7d, anchorMs, recentDays: 7, requirePublishedAt: true }), true);
  assert.equal(isCandidateInFreshnessWindow({ publishedAt: new Date(at7d.getTime() - 1), anchorMs, recentDays: 7, requirePublishedAt: true }), false);
  assert.equal(isCandidateInFreshnessWindow({ publishedAt: new Date(anchorMs + 1), anchorMs, recentDays: 7, requirePublishedAt: true }), false);
  assert.equal(isCandidateInFreshnessWindow({ publishedAt: new Date(anchorMs + 60_000), anchorMs, recentDays: 7, requirePublishedAt: true }), false,
    "detail timestamp later on the same calendar day is still future-dated");
  assert.equal(isCandidateInFreshnessWindow({ publishedAt: null, anchorMs, recentDays: 7, requirePublishedAt: true }), false);
  assert.equal(isCandidateInFreshnessWindow({ publishedAt: null, anchorMs, recentDays: 7, requirePublishedAt: false }), true);
  assert.equal(isCandidateInFreshnessWindow({ publishedAt: "not-a-date", anchorMs, recentDays: 7, requirePublishedAt: false }), false);
  assert.throws(() => resolveCandidateBatchScope({ sourceIds: [], maxNewPerSource: 10,
    maxDetailsTotal: 0, recentDays: 0, catalogSha256: "legacy" }), /recent-days must be an integer/u);
});

test("daily-latest catalog override and image catalog require the new pinned raw hash", () => {
  const directory = mkdtempSync(join(tmpdir(), "nas-catalog-"));
  const appCatalogPath = join(directory, "image-sources.json");
  const overridePath = join(directory, "approved-sources.json");
  const originalAppRoot = process.env.AIHOT_APP_ROOT;
  try {
    delete process.env.AIHOT_APP_ROOT;
    writeFileSync(appCatalogPath, catalogBytes);
    writeFileSync(overridePath, catalogBytes);
    const loaded = loadCandidateCatalog({ appRootPath: appCatalogPath, overridePath, preset: "daily-latest" });
    assert.equal(loaded.mode, "explicit-operator-override");
    assert.equal(loaded.inputSha256, DAILY_LATEST_PRESET.catalogSha256);
    assert.equal(loaded.appRootSha256, "27af3250bbc472ed20019983093b43336cc1967b9ae3193e6b202da4df27ad3f");
    writeFileSync(overridePath, "{\"sources\":[]}\n");
    assert.throws(() => loadCandidateCatalog({ appRootPath: appCatalogPath, overridePath, preset: "daily-latest" }),
      /catalog hash drift/u);
    assert.throws(() => loadCandidateCatalog({ appRootPath: appCatalogPath, overridePath: join(directory, "missing.json"), preset: "daily-latest" }),
      /operator catalog is unavailable/u);
    assert.throws(() => loadCandidateCatalog({ appRootPath: appCatalogPath, overridePath, preset: "not-daily" }),
      /only with daily-latest/u);
    assert.throws(() => loadCandidateCatalog({ appRootPath: appCatalogPath, overridePath: "relative.json", preset: "daily-latest" }),
      /must be absolute/u);
    writeFileSync(overridePath, catalogBytes);
    writeFileSync(appCatalogPath, "{\"sources\":[]}\n");
    process.env.AIHOT_APP_ROOT = "/app";
    assert.throws(() => loadCandidateCatalog({ appRootPath: appCatalogPath, overridePath, preset: "daily-latest" }),
      /application image catalog drift/u);
  } finally {
    if (originalAppRoot === undefined) delete process.env.AIHOT_APP_ROOT;
    else process.env.AIHOT_APP_ROOT = originalAppRoot;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("database row drift in approved source config or safety flags aborts", () => {
  const ids = [...DAILY_LATEST_PRESET.sourceIds];
  const sources = ids.map((id) => catalog.find((row) => row.id === id)!);
  const databaseSources = sources.map((row) => ({ id: row.id, kind: row.kind, name: row.name, config: row.config,
    enabled: row.enabled, site_fulltext: row.site_fulltext, syndicate_fulltext: row.syndicate_fulltext }));
  assert.doesNotThrow(() => assertDatabaseSourcesMatchCatalog({ sourceIds: ids, databaseSources, catalogSources: sources }));
  assert.throws(() => assertDatabaseSourcesMatchCatalog({ sourceIds: ids,
    databaseSources: databaseSources.map((row, index) => index === 0 ? { ...row, config: { ...row.config, url: "https://drift.invalid/" } } : row),
    catalogSources: sources }), /source config or safety flags differ/u);
  assert.throws(() => assertDatabaseSourcesMatchCatalog({ sourceIds: ids,
    databaseSources: databaseSources.map((row, index) => index === 0 ? { ...row, enabled: true } : row),
    catalogSources: sources }), /source config or safety flags differ/u);
  assert.throws(() => assertDatabaseSourcesMatchCatalog({ sourceIds: ids, databaseSources: databaseSources.slice(1), catalogSources: sources }),
    /source rows are missing/u);
});

test("NAS plan admits only configured disabled direct public summary-only lists", () => {
  const plan = buildSourcePlan({ catalogSources: catalog, sourceIds: ["mof-budget-work"], maxNewPerSource: 30,
    maxDetailsTotal: 150, unsupportedConfig: () => [] });
  assert.equal(plan.length, 1);
  assert.equal(plan[0]?.url, "https://yss.mof.gov.cn/gongzuodongtai/");
  assert.equal(plan[0]?.maxDetails, 0);
  assert.equal(plan[0]?.configuredDetailMaxFetches, 0);
  assert.equal(plan[0]?.effectiveDirectHtmlDetailCap, 0);
  assert.throws(() => buildSourcePlan({ catalogSources: catalog, sourceIds: ["missing"], maxNewPerSource: 30,
    maxDetailsTotal: 0, unsupportedConfig: () => [] }), /configured disabled summary-only list/);
  assert.throws(() => buildSourcePlan({ catalogSources: [{ ...catalog[0], enabled: true }], sourceIds: ["mof-budget-work"],
    maxNewPerSource: 30, maxDetailsTotal: 0, unsupportedConfig: () => [] }), /configured disabled summary-only list/);
});

test("fixed 48-source catalog is compatible with list-only plans and a total detail ceiling", () => {
  const plans = buildSourcePlan({ catalogSources: catalog, sourceIds: catalog.map((row) => String(row.id)),
    maxNewPerSource: 30, maxDetailsTotal: 150, unsupportedConfig });
  assert.equal(plans.length, 48);
  assert.equal(plans.filter((row) => row.kind === "web_list").length, 45);
  assert.equal(plans.filter((row) => row.kind === "json_list").length, 3);
  assert.ok(plans.reduce((sum, row) => sum + row.configuredDetailMaxFetches, 0) >= 150);
  assert.ok(plans.every((row) => row.maxDetails === row.effectiveDirectHtmlDetailCap));
  const pboc = plans.find((row) => row.id === "pboc-open-market");
  assert.equal(pboc?.configuredDetailMaxFetches, 3);
  assert.equal(pboc?.effectiveDirectHtmlDetailCap, 3);
  assert.equal(pboc?.maxDetails, 3);
  const directDetailSource = { ...source, config: { ...source.config,
    detail: { maxFetches: 4, bodySelector: "article", titleRegex: "<h1>(.*?)</h1>", publishedAtRegex: "time" } } } as SourceRow;
  const directPlan = buildSourcePlan({ catalogSources: [directDetailSource], sourceIds: [directDetailSource.id],
    maxNewPerSource: 30, maxDetailsTotal: 150, unsupportedConfig: () => [] });
  assert.equal(directPlan[0]?.configuredDetailMaxFetches, 4);
  assert.equal(directPlan[0]?.effectiveDirectHtmlDetailCap, 4);
  assert.equal(directPlan[0]?.maxDetails, 4);
});

test("configured list endpoints may be outside article prefixes only at the exact configured GET URL", () => {
  const ids = ["xiamen-csrc-regulatory-work", "govcn-policy-library", "mof-regional-supervision-dynamics", "nfra-regulatory-dynamics"];
  for (const id of ids) {
    const row = catalog.find((item) => item.id === id)! as SourceRow;
    const expectedUrl = new URL(String(row.config.url)).href;
    assert.equal(allowed(expectedUrl, row), false, `${id} fixture should expose list/article-prefix separation`);
    assert.equal(isBatchDispatchInScope({ source: row, url: new URL(expectedUrl), expectedUrl, method: "GET", redirectHop: 0, type: "list", allowed }), true);
    assert.equal(isBatchDispatchInScope({ source: row, url: new URL(`${expectedUrl}x`), expectedUrl, method: "GET", redirectHop: 0, type: "list", allowed }), false);
    assert.equal(isBatchDispatchInScope({ source: row, url: new URL(expectedUrl), expectedUrl, method: "POST", redirectHop: 0, type: "list", allowed }), false);
    assert.equal(isBatchDispatchInScope({ source: row, url: new URL(expectedUrl), expectedUrl, method: "GET", redirectHop: 1, type: "list", allowed }), false);
  }
  const detailUrl = "https://www.gov.cn/zhengce/zhengceku/2026-01/01/content_1.htm";
  const govcn = catalog.find((item) => item.id === "govcn-policy-library")! as SourceRow;
  assert.equal(isBatchDispatchInScope({ source: govcn, url: new URL(govcn.config.url), expectedUrl: govcn.config.url, method: "GET", redirectHop: 0, type: "detail", allowed }), false);
  assert.equal(isBatchDispatchInScope({ source: govcn, url: new URL(detailUrl), expectedUrl: detailUrl, method: "GET", redirectHop: 0, type: "detail", allowed }), true);
});

test("ordinary fetchDetail HTML dispatch uses the run budget and rejects redirect hops", async () => {
  const html = "<html><h1>预算执行情况通知</h1><time>2026-10-21</time><article><p>这是经过来源规则选择的正文内容，包含足够长的测试文本。</p></article></html>";
  const counts = { article: 0, redirect: 0 };
  const server = createServer((req, res) => {
    if (req.url === "/redirect") { counts.redirect++; res.writeHead(302, { location: "/article" }).end(); return; }
    if (req.url === "/article") { counts.article++; res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html); return; }
    res.writeHead(404).end();
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  try {
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const detailUrl = `${base}/article`;
  const detailSource = { ...source, config: { ...source.config, url: detailUrl, allowUrlPrefixes: [`${base}/`], detail: {
    bodySelector: "article", titleRegex: "<h1>(.*?)</h1>", publishedAtRegex: "<time>(.*?)</time>",
    allowShortBody: true,
  } } } as SourceRow;
  const admitted: Array<{ url: string; method: string; redirectHop: number }> = [];
  let effective: Record<string, unknown> | undefined;
  const fetchImpl = async (url: string, options: Record<string, any> = {}) => {
    effective = options;
    let target = url;
    for (let hop = 0; ; hop++) {
      options.runBudget.beforeDispatch({ url: new URL(target), method: options.method ?? "GET", redirectHop: hop });
      const response = await fetch(target, { method: options.method ?? "GET", redirect: "manual", signal: AbortSignal.timeout(options.timeoutMs) });
      if (response.status >= 300 && response.status < 400 && response.headers.has("location")) {
        if (hop >= options.maxRedirects) throw new Error("Too many redirects for local detail fixture");
        if (options.runBudget.allowRedirect && !options.runBudget.allowRedirect({ from: new URL(target), to: new URL(response.headers.get("location")!, target), redirectHop: hop + 1 })) throw new Error("Redirect target rejected");
        target = new URL(response.headers.get("location")!, target).href;
        continue;
      }
      const body = Buffer.from(await response.arrayBuffer());
      return { status: response.status, url: target, headers: response.headers, body, text: () => body.toString("utf8") };
    }
  };
  const runBudget = { beforeDispatch(input: { url: URL; method: string; redirectHop: number }) {
    admitted.push({ url: input.url.href, method: input.method, redirectHop: input.redirectHop });
    if (input.method !== "GET" || input.redirectHop !== 0 || input.url.href !== detailUrl) throw new Error("scope rejected");
  }, allowRedirect: () => false };
  const fetcher = createBudgetedDetailFetcher(runBudget, fetchImpl as never);
  const result = await fetchDetail(detailUrl, detailSource, { date: true, title: true, summary: false, body: true,
    expectedTitle: "预算执行情况通知", expectedPublishedAt: new Date("2026-10-21T00:00:00+08:00") }, { fetcher });
  assert.equal(result.title, "预算执行情况通知");
  assert.equal(admitted.length, 1);
  assert.equal(admitted[0]?.url, detailUrl);
  assert.equal(effective?.maxRedirects, 0);
  assert.equal(effective?.timeoutMs, 20_000);
  assert.equal(effective?.maxBytes, 6 * 1024 * 1024);
  assert.equal(effective?.runBudget, runBudget);
  const redirectUrl = `${base}/redirect`;
  const redirectBudget = { beforeDispatch(input: { url: URL; method: string; redirectHop: number }) {
    if (input.method !== "GET" || input.redirectHop !== 0 || input.url.href !== redirectUrl) throw new Error("scope rejected");
  }, allowRedirect: () => false };
  await assert.rejects(fetchDetail(redirectUrl, detailSource, { date: true, title: true, summary: false, body: true,
    expectedTitle: "预算执行情况通知", expectedPublishedAt: new Date("2026-10-21T00:00:00+08:00") },
  { fetcher: createBudgetedDetailFetcher(redirectBudget, fetchImpl as never) }), /Too many redirects/);
  assert.deepEqual(counts, { article: 1, redirect: 1 });
  } finally {
    await new Promise<void>((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
  }
});

test("candidate classification deduplicates and excludes known, disallowed, undated/out-of-window rows before cap", () => {
  const rows = [candidate("https://yss.mof.gov.cn/gongzuodongtai/a.html"),
    candidate("https://yss.mof.gov.cn/gongzuodongtai/a.html"),
    candidate("https://yss.mof.gov.cn/gongzuodongtai/known.html"),
    candidate("https://example.org/outside.html"),
    candidate("https://yss.mof.gov.cn/gongzuodongtai/old.html", "较早预算执行通知", 120)];
  const result = classifyCandidates({ candidates: rows, source, knownIdentities: new Set(["id:https://yss.mof.gov.cn/gongzuodongtai/known.html"]),
    identityKeyFor, allowed, maxNew: 1, inWindow: (row) => !!row.publishedAt && row.publishedAt.getTime() >= Date.now() - 90 * 86_400_000 });
  assert.deepEqual(result.eligible.map((row) => row.identityKey), ["id:https://yss.mof.gov.cn/gongzuodongtai/a.html"]);
  assert.equal(result.known, 1);
  assert.equal(result.duplicate, 1);
  assert.equal(result.held, 2);
  assert.equal(result.capped, false);
});

test("candidate cap reports a partial source instead of expanding storage", () => {
  const rows = ["a", "b", "c"].map((id) => candidate(`https://yss.mof.gov.cn/gongzuodongtai/${id}.html`));
  const result = classifyCandidates({ candidates: rows, source, knownIdentities: new Set(), identityKeyFor, allowed,
    maxNew: 2, inWindow: () => true });
  assert.equal(result.eligible.length, 2);
  assert.equal(result.capped, true);
});

test("detail reads require configured simple HTML body, title and date checks without attachment/PDF mode", () => {
  const eligible = { ...source, config: { ...source.config, detail: { maxFetches: 4, bodySelector: "article", titleRegex: "<h1>(.*?)</h1>", publishedAtRegex: "time" } } } as SourceRow;
  assert.equal(detailConfigIsDirectHtml(eligible), true);
  assert.equal(detailConfigIsDirectHtml({ ...eligible, config: { ...eligible.config, detail: { ...eligible.config.detail, pdfDirect: true } } } as SourceRow), false);
  assert.equal(detailConfigIsDirectHtml({ ...eligible, config: { ...eligible.config, detail: { ...eligible.config.detail, attachmentSelector: "a.pdf" } } } as SourceRow), false);
  assert.equal(detailConfigIsDirectHtml({ ...eligible, config: { ...eligible.config, detail: { maxFetches: 4, bodySelector: "article" } } } as SourceRow), false);
});

test("configured-day comparison uses the explicit source timezone offset", () => {
  assert.equal(sameConfiguredDay(new Date("2026-10-21T16:30:00Z"), new Date("2026-10-21T23:50:00Z"), "+08:00"), true);
  assert.equal(sameConfiguredDay(new Date("2026-10-21T15:30:00Z"), new Date("2026-10-21T16:30:00Z"), "+08:00"), false);
  assert.equal(sameConfiguredDay(new Date("2026-10-21T00:00:00Z"), new Date("2026-10-21T01:00:00Z"), "bad"), false);
});

test("captured responses use their declared charset for decoded evidence", () => {
  assert.equal(decodeCapturedBody(Buffer.from("<p>预算</p>", "utf8"), "text/html; charset=utf-8"), "<p>预算</p>");
  assert.equal(decodeCapturedBody(Buffer.from("{\"title\":\"预算\"}", "utf8"), "application/json"), "{\"title\":\"预算\"}");
});

test("gzip replay preserves raw bytes and decodes the configured MOF list before parsing", () => {
  const entries = Array.from({ length: 10 }, (_, i) => `<li><a href="202603/t20260326_${i}.htm">预算工作动态通知第${i}项</a><span>2026-03-26</span></li>`).join("");
  const html = `<html><head><title>工作动态</title></head><body><ul class="liBox">${entries}</ul></body></html>`;
  const raw = gzipSync(Buffer.from(html, "utf8"));
  const rawHash = createHash("sha256").update(raw).digest("hex");
  const decoded = decodeCapturedResponse(raw, "text/html", "gzip");
  assert.equal(createHash("sha256").update(raw).digest("hex"), rawHash);
  assert.equal(decoded, html);
  assert.equal(fromHtml(decoded, String(source.config.url), source, String(source.config.url)).length, 10);
  assert.throws(() => decodeCapturedResponse(raw, "text/html", "unknown-encoding"), /unsupported captured content encoding/);
});

test("known identity lookup binds a typed SQL array on disposable PostgreSQL", async (t) => {
  const databaseUrl = process.env.NAS_CANDIDATE_TEST_DATABASE_URL;
  if (!databaseUrl) return t.skip("requires an explicit disposable NAS candidate *_test database URL");
  const { default: postgres } = await import("postgres");
  const sql = postgres(databaseUrl);
  try {
    const known = "url:https://yss.mof.gov.cn/gongzuodongtai/nas-candidate-integration-fixture.html";
    assert.deepEqual(await findKnownIdentityKeys(sql, []), new Set());
    assert.deepEqual(await findKnownIdentityKeys(sql, [known]), new Set([known]));
    assert.deepEqual(await findKnownIdentityKeys(sql, [known, "url:https://example.invalid/not-present"]), new Set([known]));
  } finally {
    await sql.end();
  }
});

test("capture replay binds only the approved preserved MOF response and rejects altered provenance", () => {
  const sourceId = "mof-budget-work";
  const expectedUrl = "https://yss.mof.gov.cn/gongzuodongtai/";
  const currentSourceRowSha256 = "53bcac2e73484afd7550884d931f5dce789630f4a07abd635fb1927caedf9654";
  const scope = { database: "fiscalhot_staging", runId: "nas-mof-budget-pilot-20261022",
    operatorSha256: "9f7822b4d7de81e882eb86a9d059333d9660d82aea703021708603e0f2e838c8",
    fixedAppSha: "21ca4d400bda9071f1e0b8761d404d1fc5b001e5", sourceIds: [sourceId],
    sources: [{ url: expectedUrl, sourceRowSha256: currentSourceRowSha256 }] };
  const result = { database: "fiscalhot_staging", runId: scope.runId, operatorSha256: scope.operatorSha256,
    totals: { newArticles: 0, detailsAttempted: 0, failed: 1 }, results: [{ status: "failed", phase: "list" }],
    requests: [{ ordinal: 1, type: "list", sourceId, expectedUrl }],
    responseRaw: [{ method: "GET", url: expectedUrl, status: 200, eof: true, redirectLocation: null, truncated: false,
      bytes: 4328, contentType: "text/html", contentEncoding: "gzip",
      sha256: "9ddd111bfa9dbc9edde1954f2e2af75d5e57dbeb6ab95642aab52482bf0a0ada",
      decodedTextSha256: "84e4a8da1fee6a44ffc058a33c17c048a26e3147f33004d7417664d8b7991339", file: "responses/response-001.body" }] };
  const input = { scope, result, database: "fiscalhot_staging", directoryRunId: scope.runId, sourceId, expectedUrl, currentSourceRowSha256 };
  assert.equal(assertApprovedCaptureReplayMetadata(input).raw.sha256, result.responseRaw[0]!.sha256);
  assert.throws(() => assertApprovedCaptureReplayMetadata({ ...input, directoryRunId: "another-run" }), /approved prior MOF response/);
  assert.throws(() => assertApprovedCaptureReplayMetadata({ ...input, result: { ...result, responseRaw: [{ ...result.responseRaw[0], sha256: "0".repeat(64) }] } }), /approved prior MOF response/);
});
