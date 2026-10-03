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
  assert.equal(validateManifest(ready).status, "READY_FOR_EVALUATION");
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
    writeFileSync(draftFile, JSON.stringify(template));
    writeFileSync(badFile, JSON.stringify({ ...template, candidates: [{ ...template.candidates[0], caseId: "" }] }));
    const cli = path.join(repo, "scripts/fiscal/gold-dataset.ts");
    const draft = spawnSync(process.execPath, [cli, "validate", draftFile], { cwd: repo, encoding: "utf8" });
    const bad = spawnSync(process.execPath, [cli, "validate", badFile], { cwd: repo, encoding: "utf8" });
    assert.equal(draft.status, 3, draft.stderr);
    assert.equal(JSON.parse(draft.stdout).status, "DRAFT_INCOMPLETE");
    assert.equal(bad.status, 2, bad.stderr);
    assert.equal(JSON.parse(bad.stdout).status, "SCHEMA_ERROR");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
