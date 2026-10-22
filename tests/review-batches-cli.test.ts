import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { buildFrozenReviewBatch, resolveBodyCacheFile } from "../scripts/fiscal/review-batches.ts";

function sha256(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

function candidate(index: number, confirmed: boolean) {
  const caseId = `case-${String(index).padStart(3, "0")}`;
  const body = `frozen body ${index}`;
  return {
    caseId,
    eventGroupId: "unassigned-needs-human-review",
    eventGroupStatus: "needs_review",
    material: { title: `Candidate ${index}`, originalTitle: null, publishedAt: "2026-10-01T00:00:00.000Z", sourceName: "Fixture", bodyZh: null, bodyOriginal: null },
    sourceFacts: { sourceKind: "web_list", sourceTier: "T1", firstParty: true, language: "zh" },
    samplingContext: { benchmarkSplit: "development", samplingStratum: "fixture", splitStatus: "needs_review" },
    evidence: { sourceArticleId: `article-${index}`, diagnosticId: null, sourceId: "fixture", url: `https://example.invalid/${index}`, sourceArtifact: "fixture", contentHash: sha256(`content-${index}`), bodySha256: sha256(body), bodyReference: `fixture:article-${index}/body_text@revision=2`, bodyStatus: "ok" },
    proposal: { decision: null, proposedBy: "Luna High", rationale: "not a truth label" },
    humanAnnotation: confirmed
      ? { status: "user_confirmed", decision: "reject", confirmedBy: "user-in-this-chat", confirmedAt: "2026-10-18T03:52:49Z" }
      : { status: "needs_review", decision: null, confirmedBy: null, confirmedAt: null },
    body,
  };
}

function fixture() {
  const original = Array.from({ length: 100 }, (_, i) => candidate(i, i < 20));
  const proposal = [...original, ...Array.from({ length: 50 }, (_, i) => candidate(100 + i, false))];
  const seeds = original.slice(0, 15).map((item) => item.caseId);
  const sourceManifest = { schemaVersion: "p5.gold-metadata-draft/v1", datasetStatus: "DRAFT", formatNote: "fixture", candidates: original.map(({ body: _body, ...item }) => structuredClone(item)) };
  const proposalManifest = { ...sourceManifest, candidates: proposal.map(({ body: _body, ...item }) => item) };
  const sourceBytes = Buffer.from(JSON.stringify(sourceManifest));
  const proposalBytes = Buffer.from(JSON.stringify(proposalManifest));
  const seedBytes = Buffer.from(JSON.stringify(seeds));
  const bodies = new Map(proposal.map((item) => [item.caseId, Buffer.from(item.body)]));
  return { sourceManifest, sourceBytes, proposalManifest, proposalBytes, seeds, seedBytes, bodies };
}

function build(f = fixture()) {
  return buildFrozenReviewBatch({
    sourceManifest: f.sourceManifest,
    sourceManifestBytes: f.sourceBytes,
    proposal: f.proposalManifest,
    proposalBytes: f.proposalBytes,
    seedIds: f.seeds,
    seedBytes: f.seedBytes,
    loadBody: (caseId) => f.bodies.get(caseId) ?? Buffer.from("missing"),
  });
}

test("review freeze binds all 150 body snapshots and preserves existing annotations", () => {
  const first = build();
  const second = build();
  assert.equal(first.candidates.length, 150);
  assert.equal(first.candidates.filter((item) => item.humanAnnotation.status === "user_confirmed").length, 20);
  assert.equal(first.candidates.filter((item) => item.humanAnnotation.status === "needs_review").length, 130);
  assert.equal(first.manifestMeta.seedIds instanceof Array, true);
  assert.equal((first.manifestMeta.seedIds as string[]).length, 15);
  assert.equal(first.candidates[0]!.sourceArticleId, null);
  assert.equal(first.candidates[0]!.sourceRevision, null);
  assert.equal((first.candidates[0]!.candidateMetadata.evidence as Record<string, unknown>).sourceArticleId, "article-0");
  assert.equal((first.candidates[0]!.candidateMetadata.evidence as Record<string, unknown>).bodyReference, "fixture:article-0/body_text@revision=2");
  assert.equal(first.candidates.every((item) => sha256(item.bodyZhSnapshot) === item.bodySha256), true);
  assert.equal(first.batchHash, second.batchHash);
  const { batchHash, ...payload } = first;
  assert.equal(batchHash, sha256(stable({ ...payload, candidates: [...first.candidates].sort((a, b) => a.caseId.localeCompare(b.caseId)) })));
});

test("freeze rejects edits to the tracked 100, missing body hash, and non-pending additions", () => {
  const changedTracked = fixture();
  changedTracked.proposalManifest.candidates[0]!.material.title = "changed";
  assert.throws(() => build(changedTracked), /changed tracked candidate/);

  const missingBody = fixture();
  missingBody.bodies.set("case-000", Buffer.from("wrong body"));
  assert.throws(() => build(missingBody), /body hash mismatch/);

  const confirmedAddition = fixture();
  confirmedAddition.proposalManifest.candidates[100]!.humanAnnotation = { status: "user_confirmed", decision: "select", confirmedBy: "user", confirmedAt: "2026-10-18T03:52:49Z" };
  assert.throws(() => build(confirmedAddition), /unassigned candidates/);

  const confirmedGroup = fixture();
  confirmedGroup.proposalManifest.candidates[100]!.eventGroupStatus = "user_confirmed";
  assert.throws(() => build(confirmedGroup), /unassigned candidates/);

  const confirmedSplit = fixture();
  confirmedSplit.proposalManifest.candidates[100]!.samplingContext.splitStatus = "user_confirmed";
  assert.throws(() => build(confirmedSplit), /unassigned candidates/);

  const escapedId = fixture();
  escapedId.proposalManifest.candidates[100]!.caseId = "../outside";
  assert.throws(() => build(escapedId), /safe single-segment/);
});

test("body cache lookup rejects a symlink whose target escapes the frozen cache", () => {
  const trustedRoot = path.resolve(".data/fiscal-qa");
  const temp = mkdtempSync(path.join(trustedRoot, "review-body-cache-"));
  const cache = path.join(temp, "cache");
  const outside = path.join(temp, "outside.txt");
  mkdirSync(cache);
  writeFileSync(outside, "outside frozen body");
  try {
    try { symlinkSync(outside, path.join(cache, "case-safe.txt")); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM" || (error as NodeJS.ErrnoException).code === "EACCES") {
        assert.throws(() => resolveBodyCacheFile("../outside", [cache]), /unsafe caseId/);
        return;
      }
      throw error;
    }
    assert.throws(() => resolveBodyCacheFile("case-safe", [cache]), /symlink escaped/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("body cache lookup rejects a cache directory symlink outside trusted .data", () => {
  const trustedRoot = path.resolve(".data/fiscal-qa");
  const temp = mkdtempSync(path.join(trustedRoot, "review-body-dir-"));
  const outside = mkdtempSync(path.join(os.tmpdir(), "review-body-dir-outside-"));
  mkdirSync(outside, { recursive: true });
  writeFileSync(path.join(outside, "case-safe.txt"), "outside cache root");
  try {
    const cacheLink = path.join(temp, "linked-cache");
    try { symlinkSync(outside, cacheLink, "junction"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM" || (error as NodeJS.ErrnoException).code === "EACCES") {
        assert.throws(() => resolveBodyCacheFile("../case-safe", [cacheLink]), /unsafe caseId/);
        return;
      }
      throw error;
    }
    assert.throws(() => resolveBodyCacheFile("case-safe", [cacheLink]), /directory escaped trusted \.data/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
