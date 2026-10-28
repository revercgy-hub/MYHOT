import assert from "node:assert/strict";
import test from "node:test";
import { isSummaryDraftPending, selectedSummaryDraftInputs, toggleAllSummaryDrafts, toggleSummaryDraftSelection, type SummaryDraftCandidate } from "../app/features/admin/summary-draft-state.ts";

const pending: SummaryDraftCandidate = { draftId: "draft-1", draftSha256: "a".repeat(64), status: "pending" };
const approved: SummaryDraftCandidate = { draftId: "draft-2", draftSha256: "b".repeat(64), status: "approved" };
const invalidHash: SummaryDraftCandidate = { draftId: "draft-3", draftSha256: "bad", status: "pending" };

test("only pending drafts with a frozen SHA can be selected and reviewed", () => {
  assert.equal(isSummaryDraftPending(pending), true);
  assert.equal(isSummaryDraftPending(approved), false);
  assert.equal(isSummaryDraftPending(invalidHash), false);
  assert.deepEqual(toggleSummaryDraftSelection([], approved, true), []);
  assert.deepEqual(toggleSummaryDraftSelection([], invalidHash, true), []);
});

test("only checked pending drafts enter a decision payload with the expected draft SHA", () => {
  assert.deepEqual(selectedSummaryDraftInputs([pending, approved], ["draft-1", "draft-2"], "approve"), [
    { draftId: "draft-1", decision: "approve", expectedDraftSha256: "a".repeat(64) },
  ]);
});

test("select all is page-local and submissions stay within the API limit", () => {
  const page = [pending, approved, { ...pending, draftId: "draft-4", draftSha256: "c".repeat(64) }];
  assert.deepEqual(toggleAllSummaryDrafts([], page, true), ["draft-1", "draft-4"]);
  const full = Array.from({ length: 25 }, (_, i) => `old-${i}`);
  assert.deepEqual(toggleSummaryDraftSelection(full, pending, true), full);
});
