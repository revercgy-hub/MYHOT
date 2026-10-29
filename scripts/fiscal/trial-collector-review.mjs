import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** A completed process can contain failed sources; report them explicitly. */
export function reviewTrialCollector(result) {
  if (result.schemaVersion !== "nas-candidate-batch-result.v1" || result.preset !== "daily-latest" || result.networkMode !== "live") throw Error("live daily-latest result required");
  if (!Array.isArray(result.results) || !Array.isArray(result.sourceIds) || result.results.length !== result.sourceIds.length || !result.results.length) throw Error("complete source accounting required");
  if (!Number.isFinite(Date.parse(result.startedAt)) || !Number.isFinite(Date.parse(result.completedAt)) || Date.parse(result.completedAt) < Date.parse(result.startedAt)) throw Error("valid completed interval required");
  const sourceIds = new Set(result.sourceIds), seen = new Set();
  if (sourceIds.size !== result.sourceIds.length) throw Error("duplicate source scope");
  let ok = 0, failed = 0, created = 0, details = 0;
  const failures = [];
  for (const source of result.results) {
    if (!sourceIds.has(source.sourceId) || seen.has(source.sourceId)) throw Error("source result scope mismatch");
    seen.add(source.sourceId);
    if (source.status === "ok") ok++;
    else if (source.status === "failed") { failed++; failures.push({ sourceId: source.sourceId, phase: source.phase, error: source.error }); }
    else throw Error("unknown source outcome");
    if (source.status === "ok") {
      if (!Number.isInteger(source.created) || source.created < 0 || !Number.isInteger(source.detailsAttempted) || source.detailsAttempted < 0) throw Error("invalid source counters");
      created += source.created; details += source.detailsAttempted;
    }
  }
  const computed = { sources: seen.size, ok, failed, newArticles: created, detailsAttempted: details };
  for (const key of Object.keys(computed)) if (computed[key] !== result.totals?.[key]) throw Error("aggregate counters mismatch");
  if (result.modelCalls !== 0 || result.providerCalls !== 0 || result.limits?.retries !== 0 || result.limits?.redirects !== 0) throw Error("trial side-effect limits violated");
  if (!Number.isInteger(result.networkDispatches) || result.networkDispatches < 0 || result.networkDispatches > result.limits?.maxDispatches || result.requests?.length !== result.networkDispatches || result.responseRaw?.length !== result.networkDispatches) throw Error("dispatch accounting mismatch");
  return { format: "fiscal.trial-collector-review/v1", runId: result.runId, startedAt: result.startedAt, completedAt: result.completedAt,
    status: failed ? "PARTIAL_SOURCE_FAILURE" : "ALL_SOURCES_SUCCEEDED", totals: computed, failures,
    networkDispatches: result.networkDispatches, providerCalls: 0,
    gate5Passed: false, limitations: ["One run does not prove stable operation", "Raw response hashes and database writes require separate verification", "Manual recovery cannot replace a scheduled run"] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw Error("usage: node scripts/fiscal/trial-collector-review.mjs result.json review.json");
  const bytes = readFileSync(input);
  const report = { ...reviewTrialCollector(JSON.parse(bytes)), inputSha256: createHash("sha256").update(bytes).digest("hex") };
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify(report));
}
