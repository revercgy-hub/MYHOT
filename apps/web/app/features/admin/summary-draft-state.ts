export interface SummaryDraftCandidate {
  draftId: string;
  draftSha256: string;
  status: "pending" | "approved" | "rejected";
}

const SHA256 = /^[a-f0-9]{64}$/i;

export function isSummaryDraftPending(item: SummaryDraftCandidate): boolean {
  return item.status === "pending" && SHA256.test(item.draftSha256);
}

export function toggleSummaryDraftSelection(
  selected: string[],
  item: SummaryDraftCandidate,
  checked: boolean,
): string[] {
  if (!isSummaryDraftPending(item)) return selected;
  const next = new Set(selected);
  if (checked) {
    if (next.size >= 25 && !next.has(item.draftId)) return selected;
    next.add(item.draftId);
  } else {
    next.delete(item.draftId);
  }
  return [...next];
}

export function toggleAllSummaryDrafts(
  selected: string[],
  pageItems: SummaryDraftCandidate[],
  checked: boolean,
): string[] {
  const next = new Set(selected);
  for (const item of pageItems) {
    if (!isSummaryDraftPending(item)) continue;
    if (checked && next.size < 25) next.add(item.draftId);
    if (!checked) next.delete(item.draftId);
  }
  return [...next];
}

export function selectedSummaryDraftInputs(
  items: SummaryDraftCandidate[],
  selected: string[],
  decision: "approve" | "reject",
): Array<{ draftId: string; decision: "approve" | "reject"; expectedDraftSha256: string }> {
  const ids = new Set(selected);
  return items
    .filter((item) => ids.has(item.draftId) && isSummaryDraftPending(item))
    .map((item) => ({ draftId: item.draftId, decision, expectedDraftSha256: item.draftSha256 }));
}
