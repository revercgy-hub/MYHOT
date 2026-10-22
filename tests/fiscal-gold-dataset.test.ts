import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { validateManifest } from "../scripts/fiscal/gold-dataset.ts";

const repo = path.resolve(import.meta.dirname, "..");
const templatePath = path.join(repo, "docs/fiscal-finance/gold/metadata-template.json");
const template = JSON.parse(readFileSync(templatePath, "utf8")) as Record<string, any>;

test("real metadata template stays incomplete and never promotes proposals to human labels", () => {
  const result = validateManifest(template);
  assert.equal(result.status, "DRAFT_INCOMPLETE");
  assert.equal(result.counts.candidates, 8);
  assert.equal(result.counts.confirmed, 0);
  assert.equal(result.counts.pending, 8);
  assert.equal(template.candidates[0].proposal.decision, "select");
  assert.equal(template.candidates[0].humanAnnotation.decision, null);
});

test("missing required annotation metadata is a schema error", () => {
  const broken = structuredClone(template);
  delete broken.candidates[0].material.title;
  const result = validateManifest(broken);
  assert.equal(result.status, "SCHEMA_ERROR");
  assert.ok(result.issues.some((issue) => issue.code === "title"));
});

test("one event group cannot be split between development and holdout", () => {
  const leaked = structuredClone(template);
  leaked.candidates[1].eventGroupId = leaked.candidates[0].eventGroupId;
  leaked.candidates[1].samplingContext.benchmarkSplit = "holdout";
  const result = validateManifest(leaked);
  assert.equal(result.status, "SCHEMA_ERROR");
  assert.ok(result.issues.some((issue) => issue.code === "event_group_split_leak"));
});

test("fully confirmed synthetic row may pass readiness validation, without running evaluation", () => {
  const ready = structuredClone(template);
  ready.candidates = [structuredClone(ready.candidates[0])];
  const candidate = ready.candidates[0];
  candidate.material.bodyZh = "Synthetic test-only body; not a saved source article.";
  candidate.humanAnnotation = { status: "user_confirmed", decision: "select", confirmedBy: "reviewer-test", confirmedAt: "2026-10-03T00:00:00Z" };
  candidate.eventGroupStatus = "user_confirmed";
  candidate.samplingContext.splitStatus = "user_confirmed";
  const noSeeds = validateManifest(ready, { caseIds: [] });
  assert.equal(noSeeds.status, "READY_FOR_EVALUATION");
  assert.deepEqual(noSeeds.seedCheck, { status: "checked", caseCount: 0, fileSha256: null });
});

test("agent-verified event groups and deterministic splits need auditable provenance", () => {
  const ready = structuredClone(template);
  ready.candidates = [structuredClone(ready.candidates[0])];
  const candidate = ready.candidates[0];
  candidate.material.bodyZh = "Synthetic test-only body; not a saved source article.";
  candidate.humanAnnotation = { status: "user_confirmed", decision: "select", confirmedBy: "reviewer-test", confirmedAt: "2026-10-03T00:00:00Z" };
  const provenance = {
    reviewer: "luna-bulk-qa",
    method: "event-group-and-split-v1",
    verifiedAt: "2026-10-22T10:00:00Z",
    evidenceSha256: "a".repeat(64),
  };
  candidate.eventGroupStatus = "agent_verified";
  candidate.eventGroupVerification = provenance;
  candidate.samplingContext.splitStatus = "agent_verified";
  candidate.samplingContext.splitVerification = provenance;

  assert.equal(validateManifest(ready, { caseIds: [] }).status, "READY_FOR_EVALUATION");
  candidate.eventGroupVerification.evidenceSha256 = "not-a-hash";
  const invalid = validateManifest(ready, { caseIds: [] });
  assert.equal(invalid.status, "SCHEMA_ERROR");
  assert.ok(invalid.issues.some((issue) => issue.code === "verification_evidence_hash"));
});

test("agent provenance cannot be attached to needs-review or user-confirmed status", () => {
  const withPendingProvenance = structuredClone(template);
  withPendingProvenance.candidates[0].eventGroupVerification = {
    reviewer: "luna-bulk-qa",
    method: "event-group-v1",
    verifiedAt: "2026-10-22T10:00:00Z",
    evidenceSha256: "b".repeat(64),
  };
  const pending = validateManifest(withPendingProvenance);
  assert.equal(pending.status, "SCHEMA_ERROR");
  assert.ok(pending.issues.some((issue) => issue.code === "unexpected_verification_provenance"));

  const userConfirmed = structuredClone(template);
  userConfirmed.candidates[0].eventGroupStatus = "user_confirmed";
  userConfirmed.candidates[0].eventGroupVerification = {
    reviewer: "luna-bulk-qa",
    method: "event-group-v1",
    verifiedAt: "2026-10-22T10:00:00Z",
    evidenceSha256: "c".repeat(64),
  };
  const mixed = validateManifest(userConfirmed);
  assert.equal(mixed.status, "SCHEMA_ERROR");
  assert.ok(mixed.issues.some((issue) => issue.code === "unexpected_verification_provenance"));
});

test("seed holdout assignments fail while development seed assignments remain valid", () => {
  const ready = structuredClone(template);
  ready.candidates = [structuredClone(ready.candidates[0])];
  const candidate = ready.candidates[0];
  candidate.material.bodyZh = "Synthetic test-only body; not a saved source article.";
  candidate.humanAnnotation = { status: "user_confirmed", decision: "select", confirmedBy: "reviewer-test", confirmedAt: "2026-10-03T00:00:00Z" };
  candidate.eventGroupStatus = "user_confirmed";
  candidate.samplingContext.splitStatus = "user_confirmed";
  const development = validateManifest(ready, { caseIds: [candidate.caseId] });
  assert.equal(development.status, "READY_FOR_EVALUATION");
  assert.equal(development.seedCheck.caseCount, 1);

  candidate.samplingContext.benchmarkSplit = "holdout";
  const holdout = validateManifest(ready, { caseIds: [candidate.caseId] });
  assert.equal(holdout.status, "SCHEMA_ERROR");
  assert.ok(holdout.issues.some((issue) => issue.code === "preference_seed_in_holdout"));
});

test("seed isolation is reported as not run for compatible API calls without seed input", () => {
  const ready = structuredClone(template);
  ready.candidates = [structuredClone(ready.candidates[0])];
  const candidate = ready.candidates[0];
  candidate.material.bodyZh = "Synthetic test-only body; not a saved source article.";
  candidate.humanAnnotation = { status: "user_confirmed", decision: "select", confirmedBy: "reviewer-test", confirmedAt: "2026-10-03T00:00:00Z" };
  candidate.eventGroupStatus = "user_confirmed";
  candidate.samplingContext.splitStatus = "user_confirmed";
  const result = validateManifest(ready);
  assert.equal(result.status, "DRAFT_INCOMPLETE");
  assert.equal(result.seedCheck.status, "not_run");
  assert.ok(result.issues.some((issue) => issue.code === "seed_check_not_run"));
});

test("seed IDs reject unknown and duplicate values", () => {
  const unknown = validateManifest(template, { caseIds: ["not-in-manifest"] });
  assert.equal(unknown.status, "SCHEMA_ERROR");
  assert.ok(unknown.issues.some((issue) => issue.code === "unknown_seed_case_id"));

  const empty = validateManifest(template, { caseIds: ["  "] });
  assert.equal(empty.status, "SCHEMA_ERROR");
  assert.ok(empty.issues.some((issue) => issue.code === "seed_case_id"));

  const known = template.candidates[0].caseId as string;
  const duplicate = validateManifest(template, { caseIds: [known, known] });
  assert.equal(duplicate.status, "SCHEMA_ERROR");
  assert.ok(duplicate.issues.some((issue) => issue.code === "duplicate_seed_case_id"));
});

test("unconfirmed extraction or missing body hash cannot become evaluation-ready", () => {
  const incomplete = structuredClone(template);
  incomplete.candidates = [structuredClone(incomplete.candidates[0])];
  const candidate = incomplete.candidates[0];
  candidate.material.bodyZh = "Synthetic test-only body; not a saved source article.";
  candidate.humanAnnotation = { status: "user_confirmed", decision: "select", confirmedBy: "reviewer-test", confirmedAt: "2026-10-03T00:00:00Z" };
  candidate.eventGroupStatus = "user_confirmed";
  candidate.samplingContext.splitStatus = "user_confirmed";
  candidate.evidence.bodyStatus = "unconfirmed";
  candidate.evidence.bodySha256 = null;
  assert.equal(validateManifest(incomplete).status, "DRAFT_INCOMPLETE");
});

test("CLI distinguishes draft incompleteness (3) from malformed schema (2)", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "fiscal-gold-validator-"));
  try {
    const draftFile = path.join(dir, "draft.json");
    const badFile = path.join(dir, "bad.json");
    const seedFile = path.join(dir, "seed-case-ids.json");
    writeFileSync(draftFile, JSON.stringify(template));
    writeFileSync(badFile, JSON.stringify({ ...template, candidates: [{ ...template.candidates[0], caseId: "" }] }));
    writeFileSync(seedFile, "[]\n");
    const cli = path.join(repo, "scripts/fiscal/gold-dataset.ts");
    const missingSeedFile = spawnSync(process.execPath, [cli, "validate", draftFile], { cwd: repo, encoding: "utf8" });
    const draft = spawnSync(process.execPath, [cli, "validate", draftFile, "--seed-case-ids", seedFile], { cwd: repo, encoding: "utf8" });
    const bad = spawnSync(process.execPath, [cli, "validate", badFile, "--seed-case-ids", seedFile], { cwd: repo, encoding: "utf8" });
    assert.equal(missingSeedFile.status, 2, missingSeedFile.stderr);
    assert.equal(JSON.parse(missingSeedFile.stdout).issues[0].code, "seed_file_required");
    assert.equal(draft.status, 3, draft.stderr);
    assert.equal(JSON.parse(draft.stdout).status, "DRAFT_INCOMPLETE");
    const seedCheck = JSON.parse(draft.stdout).seedCheck;
    assert.equal(seedCheck.status, "checked");
    assert.equal(seedCheck.caseCount, 0);
    assert.match(seedCheck.fileSha256, /^[a-f0-9]{64}$/);
    assert.equal(bad.status, 2, bad.stderr);
    assert.equal(JSON.parse(bad.stdout).status, "SCHEMA_ERROR");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
