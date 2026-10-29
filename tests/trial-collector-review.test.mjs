import assert from "node:assert/strict";
import { test } from "node:test";
import { reviewTrialCollector } from "../scripts/fiscal/trial-collector-review.mjs";
function fixture() {
  return { schemaVersion: "nas-candidate-batch-result.v1", preset: "daily-latest", networkMode: "live", runId: "daily-latest-fixture",
    startedAt: "2026-10-29T04:00:00Z", completedAt: "2026-10-29T04:01:00Z", sourceIds: ["a", "b"],
    results: [{ sourceId: "a", status: "ok", created: 1, detailsAttempted: 1 }, { sourceId: "b", status: "failed", phase: "list", error: "timeout" }],
    totals: { sources: 2, ok: 1, failed: 1, newArticles: 1, detailsAttempted: 1 }, modelCalls: 0, providerCalls: 0,
    limits: { retries: 0, redirects: 0, maxDispatches: 3 }, networkDispatches: 3, requests: [{}, {}, {}], responseRaw: [{}, {}, {}] };
}
test("trial review distinguishes partial completion from all-source success", () => {
  const r = reviewTrialCollector(fixture());
  assert.equal(r.status, "PARTIAL_SOURCE_FAILURE"); assert.equal(r.failures[0].sourceId, "b"); assert.equal(r.gate5Passed, false);
  const all = fixture(); all.results[1] = { sourceId: "b", status: "ok", created: 0, detailsAttempted: 0 }; all.totals.ok = 2; all.totals.failed = 0;
  assert.equal(reviewTrialCollector(all).status, "ALL_SOURCES_SUCCEEDED");
});
test("trial review rejects incomplete, duplicate, inconsistent and out-of-budget runs", () => {
  const duplicate = fixture(); duplicate.results[1].sourceId = "a";
  assert.throws(() => reviewTrialCollector(duplicate), /scope mismatch/u);
  assert.throws(() => reviewTrialCollector({ ...fixture(), totals: {} }), /counters mismatch/u);
  assert.throws(() => reviewTrialCollector({ ...fixture(), providerCalls: 1 }), /limits/u);
  assert.throws(() => reviewTrialCollector({ ...fixture(), networkDispatches: 4 }), /dispatch/u);
  assert.throws(() => reviewTrialCollector({ ...fixture(), completedAt: null }), /interval/u);
});
