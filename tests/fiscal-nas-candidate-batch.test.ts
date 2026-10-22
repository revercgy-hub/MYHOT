import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Candidate, SourceRow } from "../packages/backend/src/sources/types.ts";
import { unsupportedConfig } from "../packages/backend/src/sources/config-keys.ts";
import { buildSourcePlan, classifyCandidates, decodeCapturedBody, detailConfigIsDirectHtml, sameConfiguredDay } from "../scripts/fiscal/nas-candidate-batch.ts";

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
  assert.ok(plans.reduce((sum, row) => sum + row.maxDetails, 0) >= 150);
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
