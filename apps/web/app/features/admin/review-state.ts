export interface ReviewCandidate {
  caseId: string;
  contentHash: string | null;
  humanAnnotation: { status: "needs_review" | "user_confirmed"; decision: "select" | "reject" | "either" | null };
}

export function isReviewPending(item: ReviewCandidate): boolean {
  return item.humanAnnotation.status === "needs_review" && item.humanAnnotation.decision === null;
}

export function toggleReviewSelection(selected: string[], item: ReviewCandidate, checked: boolean): string[] {
  if (!isReviewPending(item)) return selected;
  const next = new Set(selected);
  if (checked) {
    if (next.size >= 50 && !next.has(item.caseId)) return selected;
    next.add(item.caseId);
  } else {
    next.delete(item.caseId);
  }
  return [...next];
}

export function togglePageSelection(selected: string[], pageItems: ReviewCandidate[], checked: boolean): string[] {
  const next = new Set(selected);
  for (const item of pageItems) {
    if (!isReviewPending(item)) continue;
    if (checked && next.size < 50) next.add(item.caseId);
    if (!checked) next.delete(item.caseId);
  }
  return [...next];
}

export function selectedReviewInputs<T extends ReviewCandidate>(items: T[], selected: string[]): Array<{ caseId: string; contentHash: string | null }> {
  const ids = new Set(selected);
  return items.filter((item) => ids.has(item.caseId) && isReviewPending(item)).map(({ caseId, contentHash }) => ({ caseId, contentHash }));
}
