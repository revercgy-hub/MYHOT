import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import type { Candidate, SourceRow } from "../packages/backend/src/sources/types.ts";
import { unsupportedConfig } from "../packages/backend/src/sources/config-keys.ts";
import { assertApprovedCaptureReplayMetadata, buildSourcePlan, classifyCandidates, decodeCapturedBody, decodeCapturedResponse, detailConfigIsDirectHtml, findKnownIdentityKeys, sameConfiguredDay } from "../scripts/fiscal/nas-candidate-batch.ts";
import { fromHtml } from "../packages/backend/src/sources/web-list.ts";

const catalog = JSON.parse(readFileSync(resolve("industry/sources.json"), "utf8")).sources as Array<Record<string, any>>;
const source = catalog.find((row) => row.id === "mof-budget-work")! as SourceRow;
const allowed = (url: string, row: SourceRow) => (row.config.allowUrlPrefixes as string[]).some((prefix) => url.startsWith(prefix));
const identityKeyFor = (material: Candidate & { sourceId: string; via: "fetch" }) => `id:${material.url}`;
const candidate = (url: string, title = "预算执行情况", daysAgo = 1): Candidate => ({
  url, title, publishedAt: new Date(Date.now() - daysAgo * 86_400_000), bodyText: null,
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
  assert.equal(pboc?.effectiveDirectHtmlDetailCap, 0);
  const directDetailSource = { ...source, config: { ...source.config,
    detail: { maxFetches: 4, bodySelector: "article", titleRegex: "<h1>(.*?)</h1>", publishedAtRegex: "time" } } } as SourceRow;
  const directPlan = buildSourcePlan({ catalogSources: [directDetailSource], sourceIds: [directDetailSource.id],
    maxNewPerSource: 30, maxDetailsTotal: 150, unsupportedConfig: () => [] });
  assert.equal(directPlan[0]?.configuredDetailMaxFetches, 4);
  assert.equal(directPlan[0]?.effectiveDirectHtmlDetailCap, 4);
  assert.equal(directPlan[0]?.maxDetails, 4);
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
