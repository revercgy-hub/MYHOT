import assert from "node:assert/strict";
import { test } from "node:test";
import { calibrationReview } from "../scripts/fiscal/calibration-review.mjs";

function fixture() {
  return { format: "fiscal.native-selection.evaluation/v1", split: "development", n: 2, errors: 0,
    tp: 1, fp: 1, fn: 0, tn: 0, cases: [
      { caseId: "positive", gold: "select", decision: "select", relevance: "pass", score: 70 },
      { caseId: "negative", gold: "reject", decision: "select", relevance: "pass", score: 60 },
    ], sweepStatus: "development-only", sweep: [{ threshold: 70, tp: 1, fp: 0, fn: 0, tn: 1 }] };
}
test("calibration review recomputes errors and threshold counts without approving a threshold", () => {
  const r = calibrationReview(fixture());
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].caseId, "negative");
  assert.equal(r.humanSignoff, null);
  assert.equal(r.decision, "REVIEW_REQUIRED_NO_THRESHOLD_CHANGE");
});
test("calibration review rejects holdout, duplicate cases and inconsistent confusion/sweep inputs", () => {
  assert.throws(() => calibrationReview({ ...fixture(), split: "holdout" }), /holdout/u);
  const duplicate = fixture(); duplicate.cases[1].caseId = "positive";
  assert.throws(() => calibrationReview(duplicate), /unique/u);
  assert.throws(() => calibrationReview({ ...fixture(), fp: 0 }), /confusion/u);
  const bad = fixture(); bad.sweep[0].tp = 0;
  assert.throws(() => calibrationReview(bad), /sweep mismatch/u);
});
