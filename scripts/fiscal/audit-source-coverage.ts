import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { guardedFetch } from "../../packages/backend/src/lib/http-fetch.ts";
import { config } from "../../packages/backend/src/config.ts";
import { assertRuntimeSafetyFlags } from "./nas-pending-body-batch.ts";
import { ResponseCapture, decodeCapturedResponse } from "./nas-candidate-batch.ts";
import { declaredMofPages, reviewSourceCoverage, type CoverageCapture, type CoverageSource } from "./source-coverage-evidence.ts";

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export interface SourceCoveragePlan {
  format: "fiscal.source-coverage-capture-plan/v1";
  sourceId: string; catalogSha256: string; totalPages: number; maxRequests: number;
  anchorAt: string; expiresAt: string; minIntervalMs: number;
}

/** Read-only, source-scoped archive observation. No DB, model, cursor or publication calls. */
export async function captureSourceCoverage(planFile: string, expectedPlanSha256: string, outDir: string) {
  assertRuntimeSafetyFlags(process.env);
  if (config.allowPrivateNetworkFetch !== false || config.modelCallsEnabled !== false) throw new Error("Read-only public-network runtime required");
  const planBytes = readFileSync(planFile), plan = JSON.parse(planBytes.toString()) as SourceCoveragePlan;
  const catalogBytes = readFileSync(path.resolve("industry/sources.json")), catalog = JSON.parse(catalogBytes.toString()).sources;
  const source = catalog.find((s: CoverageSource) => s.id === plan.sourceId) as CoverageSource | undefined;
  if (sha(planBytes) !== expectedPlanSha256 || plan.format !== "fiscal.source-coverage-capture-plan/v1" || sha(catalogBytes) !== plan.catalogSha256 ||
      !source || source.kind !== "web_list" || source.enabled !== false || source.site_fulltext !== false || source.syndicate_fulltext !== false ||
      source.config.pagination?.mode !== "mof_index_v1" || !Number.isInteger(plan.totalPages) || plan.totalPages < 1 || plan.totalPages > 20 ||
      plan.totalPages > source.config.pagination.maxPageIndex + 1 || plan.maxRequests !== plan.totalPages * 2 || plan.maxRequests > 40 ||
      !Number.isInteger(plan.minIntervalMs) || plan.minIntervalMs < 1100 || plan.minIntervalMs > 10000 ||
      !Number.isFinite(Date.parse(plan.anchorAt)) || !Number.isFinite(Date.parse(plan.expiresAt)) ||
      Date.parse(plan.expiresAt) <= Date.parse(plan.anchorAt) || Date.now() < Date.parse(plan.anchorAt) ||
      Date.now() > Date.parse(plan.expiresAt) || Date.parse(plan.expiresAt) - Date.parse(plan.anchorAt) > 15 * 60000) throw new Error("Exact bounded current coverage plan required");
  const targetDir = path.resolve(outDir);
  mkdirSync(targetDir, { mode: 0o700 });
  mkdirSync(path.join(targetDir, "responses"), { mode: 0o700 });
  writeFileSync(path.join(targetDir, "scope.json"), planBytes, { flag: "wx", mode: 0o600 });
  const operatorSha256 = sha(readFileSync(fileURLToPath(import.meta.url)));
  const capture = new ResponseCapture(path.join(targetDir, "responses")), observations: CoverageCapture[] = [];
  const dispatches: Array<{ url: string; pass: number; pageIndex: number; at: string }> = [];
  const signal = AbortSignal.timeout(30 * 60000);
  let lastDispatch = 0, expectedUrl = "", pass = 1, pageIndex = 0;
  const safeRaw = () => capture.rows.map(({ ordinal, method, url, status, contentType, contentEncoding, bytes, sha256, eof, truncated, file, error }) =>
    ({ ordinal, method, url, status, contentType, contentEncoding, bytes, sha256, eof, truncated, file, error }));
  try {
    for (pass = 1; pass <= 2; pass++) for (pageIndex = 0; pageIndex < plan.totalPages; pageIndex++) {
      expectedUrl = pageIndex === 0 ? source.config.url : new URL(`index_${pageIndex}.htm`, source.config.url).href;
      await sleep(Math.max(0, plan.minIntervalMs - (Date.now() - lastDispatch)), undefined, { signal });
      const offset = capture.rows.length;
      const response = await guardedFetch(expectedUrl, { route: "direct", timeoutMs: 20000, maxBytes: 1024 * 1024, maxRedirects: 0,
        runBudget: { signal, beforeDispatch: ({ url, method, redirectHop }) => {
          if (url.href !== expectedUrl || method !== "GET" || redirectHop !== 0 || dispatches.length >= plan.maxRequests ||
              (lastDispatch && Date.now() - lastDispatch < plan.minIntervalMs)) throw new Error("Coverage dispatch outside exact budget");
          lastDispatch = Date.now(); dispatches.push({ url: url.href, pass, pageIndex, at: new Date(lastDispatch).toISOString() });
        } } });
      const raw = capture.rows[offset];
      if (capture.rows.length !== offset + 1 || !raw?.file || raw.status !== 200 || !raw.eof || raw.truncated || !raw.sha256 || !raw.contentType) throw new Error("Complete single raw response required");
      const body = readFileSync(path.join(targetDir, raw.file));
      if (body.length !== raw.bytes || sha(body) !== raw.sha256 || response.status !== 200) throw new Error("Coverage response bytes mismatch");
      const declaration = declaredMofPages(decodeCapturedResponse(body, raw.contentType, raw.contentEncoding));
      if (declaration.totalPages !== plan.totalPages || declaration.currentPage !== pageIndex) throw new Error("Publisher pagination changed since planning");
      observations.push({ pass: pass as 1 | 2, pageIndex, url: expectedUrl, observedAt: dispatches.at(-1)!.at, status: raw.status,
        contentType: raw.contentType, contentEncoding: raw.contentEncoding ?? "identity", bytes: raw.bytes, sha256: raw.sha256, eof: raw.eof, truncated: raw.truncated, body });
      console.log(JSON.stringify({ sourceId: source.id, pass, pageIndex, requests: dispatches.length, maxRequests: plan.maxRequests }));
    }
    const review = reviewSourceCoverage({ source, anchorAt: plan.anchorAt, captures: observations });
    const report = { ...review, operatorSha256, planSha256: expectedPlanSha256, dispatches, raw: safeRaw(), providerCalls: 0, databaseWrites: 0 };
    writeFileSync(path.join(targetDir, "review.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ status: review.status, sourceId: source.id, observations: review.observations, recentArticles: review.recentArticles }));
    return report;
  } catch (error) {
    writeFileSync(path.join(targetDir, "failure.json"), JSON.stringify({ status: "PARTIAL_NO_RETRY", errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "unknown", dispatches, raw: safeRaw(), providerCalls: 0, databaseWrites: 0 }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    throw error;
  } finally { capture.close(); }
}
