import assert from "node:assert/strict";
import test from "node:test";
import { isReviewPending, selectedReviewInputs, togglePageSelection, toggleReviewSelection, type ReviewCandidate } from "../app/features/admin/review-state.ts";

const pending: ReviewCandidate = { caseId: "p1", contentHash: "hash1", humanAnnotation: { status: "needs_review", decision: null } };
const confirmed: ReviewCandidate = { caseId: "old1", contentHash: "hash0", humanAnnotation: { status: "user_confirmed", decision: "select" } };

test("confirmed Gold rows stay read-only and cannot enter a decision payload", () => {
  assert.equal(isReviewPending(confirmed), false);
  assert.deepEqual(toggleReviewSelection(["old1"], confirmed, true), ["old1"]);
  assert.deepEqual(selectedReviewInputs([pending, confirmed], ["p1", "old1"]), [{ caseId: "p1", contentHash: "hash1" }]);
});

test("only explicitly checked pending rows are submitted; unchecked rows remain pending", () => {
  assert.deepEqual(selectedReviewInputs([pending, { ...pending, caseId: "p2", contentHash: "hash2" }], ["p2"]), [{ caseId: "p2", contentHash: "hash2" }]);
  assert.deepEqual(toggleReviewSelection([], pending, false), []);
});

test("page selection touches only pending rows and never exceeds the API limit", () => {
  const page = [pending, confirmed, { ...pending, caseId: "p2", contentHash: "hash2" }];
  assert.deepEqual(togglePageSelection([], page, true), ["p1", "p2"]);
  const full = Array.from({ length: 50 }, (_, i) => `old-${i}`);
  assert.deepEqual(toggleReviewSelection(full, pending, true), full);
});
