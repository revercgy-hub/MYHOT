#!/usr/bin/env node
/**
 * Validate the metadata-only preparation manifest for the finance gold set.
 * This command is intentionally offline and never runs selection or calibration.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Decision = "select" | "reject" | "either";
type Split = "development" | "holdout";
type Issue = { code: string; path: string; message: string };

interface Candidate {
  caseId: string;
  eventGroupId: string;
  eventGroupStatus: "needs_review" | "user_confirmed";
  material: {
    title: string;
    originalTitle: string | null;
    publishedAt: string | null;
    sourceName: string;
    bodyZh: string | null;
    bodyOriginal: string | null;
  };
  sourceFacts: {
    sourceKind: string;
    sourceTier?: string;
    firstParty?: boolean;
    language?: string | null;
  };
  samplingContext: { benchmarkSplit: Split; samplingStratum: string; splitStatus: "needs_review" | "user_confirmed" };
  evidence: {
    sourceArticleId: string | null;
    diagnosticId?: string | null;
    sourceId: string;
    url: string;
    sourceArtifact: string;
    contentHash: string | null;
    bodySha256: string | null;
    bodyReference: string | null;
    bodyStatus: string;
    bodyUnavailableReason?: string | null;
    observationSha256?: string | null;
  };
  proposal: { decision: Decision | null; proposedBy: string; rationale: string };
  humanAnnotation: {
    status: "needs_review" | "user_confirmed";
    decision: Decision | null;
    confirmedBy: string | null;
    confirmedAt: string | null;
  };
}

interface Manifest {
  schemaVersion: "p5.gold-metadata-draft/v1";
  datasetStatus: "DRAFT";
  formatNote: string;
  candidates: Candidate[];
}

const DECISIONS = new Set(["select", "reject", "either"]);
const SPLITS = new Set(["development", "holdout"]);
const SHA256 = /^[a-f0-9]{64}$/i;
const VALIDATOR_FILE = fileURLToPath(import.meta.url);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function add(issues: Issue[], code: string, pathName: string, message: string): void {
  issues.push({ code, path: pathName, message });
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validDecision(value: unknown): value is Decision {
  return typeof value === "string" && DECISIONS.has(value);
}

function validateManifest(input: unknown): { status: "SCHEMA_ERROR" | "DRAFT_INCOMPLETE" | "READY_FOR_EVALUATION"; issues: Issue[]; counts: Record<string, number> } {
  const issues: Issue[] = [];
  let structuralError = false;
  if (!isRecord(input)) {
    add(issues, "manifest_type", "$", "manifest must be a JSON object");
    return { status: "SCHEMA_ERROR", issues, counts: { candidates: 0, confirmed: 0, pending: 0 } };
  }
  if (input.schemaVersion !== "p5.gold-metadata-draft/v1") { structuralError = true; add(issues, "schema_version", "schemaVersion", "expected p5.gold-metadata-draft/v1"); }
  if (input.datasetStatus !== "DRAFT") { structuralError = true; add(issues, "dataset_status", "datasetStatus", "metadata preparation manifests must remain DRAFT"); }
  if (!Array.isArray(input.candidates) || input.candidates.length === 0) {
    add(issues, "candidates", "candidates", "must be a non-empty array");
    return { status: "SCHEMA_ERROR", issues, counts: { candidates: 0, confirmed: 0, pending: 0 } };
  }

  const seenCases = new Set<string>();
  const groupSplits = new Map<string, Set<string>>();
  let confirmed = 0;
  let pending = 0;
  const schemaIssue = (code: string, p: string, message: string) => {
    structuralError = true;
    add(issues, code, p, message);
  };

  input.candidates.forEach((raw, i) => {
    const p = `candidates[${i}]`;
    if (!isRecord(raw)) { schemaIssue("candidate_type", p, "candidate must be an object"); return; }
    const c = raw as unknown as Partial<Candidate>;
    if (!nonempty(c.caseId)) schemaIssue("case_id", `${p}.caseId`, "caseId is required");
    else if (seenCases.has(c.caseId)) schemaIssue("duplicate_case_id", `${p}.caseId`, "caseId must be unique");
    else seenCases.add(c.caseId);

    if (!nonempty(c.eventGroupId)) schemaIssue("event_group", `${p}.eventGroupId`, "eventGroupId is required to prevent train/holdout leakage");
    if (c.eventGroupStatus !== "needs_review" && c.eventGroupStatus !== "user_confirmed") schemaIssue("event_group_status", `${p}.eventGroupStatus`, "must be needs_review or user_confirmed");

    if (!isRecord(c.material)) schemaIssue("material", `${p}.material`, "material object is required");
    else {
      const m = c.material;
      if (!nonempty(m.title)) schemaIssue("title", `${p}.material.title`, "title is required");
      if (m.originalTitle !== null && typeof m.originalTitle !== "string") schemaIssue("original_title", `${p}.material.originalTitle`, "must be string or null");
      if (m.publishedAt !== null && (typeof m.publishedAt !== "string" || !Number.isFinite(Date.parse(m.publishedAt)))) schemaIssue("published_at", `${p}.material.publishedAt`, "must be an ISO-compatible date/time string or null");
      if (!nonempty(m.sourceName)) schemaIssue("source_name", `${p}.material.sourceName`, "sourceName is required");
      for (const k of ["bodyZh", "bodyOriginal"] as const) if (m[k] !== null && typeof m[k] !== "string") schemaIssue("body_type", `${p}.material.${k}`, "must be string or null");
      if (m.bodyZh && m.bodyOriginal) schemaIssue("body_duplicate", `${p}.material`, "store a single language body, not two copies");
    }

    if (!isRecord(c.sourceFacts) || !nonempty(c.sourceFacts.sourceKind)) schemaIssue("source_facts", `${p}.sourceFacts`, "sourceFacts.sourceKind is required");
    if (isRecord(c.sourceFacts) && c.sourceFacts.firstParty !== undefined && typeof c.sourceFacts.firstParty !== "boolean") schemaIssue("first_party", `${p}.sourceFacts.firstParty`, "must be boolean");

    if (!isRecord(c.samplingContext)) schemaIssue("sampling_context", `${p}.samplingContext`, "samplingContext is required");
    else {
      const split = c.samplingContext.benchmarkSplit;
      if (typeof split !== "string" || !SPLITS.has(split)) schemaIssue("benchmark_split", `${p}.samplingContext.benchmarkSplit`, "must be development or holdout");
      else if (nonempty(c.eventGroupId)) {
        const splits = groupSplits.get(c.eventGroupId) ?? new Set<string>();
        splits.add(split);
        groupSplits.set(c.eventGroupId, splits);
      }
      if (!nonempty(c.samplingContext.samplingStratum)) schemaIssue("sampling_stratum", `${p}.samplingContext.samplingStratum`, "samplingStratum is required");
      if (c.samplingContext.splitStatus !== "needs_review" && c.samplingContext.splitStatus !== "user_confirmed") schemaIssue("split_status", `${p}.samplingContext.splitStatus`, "must be needs_review or user_confirmed");
    }

    if (!isRecord(c.evidence)) schemaIssue("evidence", `${p}.evidence`, "evidence references are required");
    else {
      const e = c.evidence;
      if (!nonempty(e.sourceArticleId) && !nonempty(e.diagnosticId)) schemaIssue("evidence_identity", `${p}.evidence`, "a canonical sourceArticleId or explicitly named diagnosticId is required");
      for (const k of ["sourceId", "url", "sourceArtifact", "bodyStatus"] as const) if (!nonempty(e[k])) schemaIssue("evidence_field", `${p}.evidence.${k}`, `${k} is required`);
      if (nonempty(e.url)) {
        try { if (new URL(e.url).protocol !== "https:" && new URL(e.url).protocol !== "http:") throw new Error(); }
        catch { schemaIssue("evidence_url", `${p}.evidence.url`, "must be an absolute HTTP(S) URL"); }
      }
      for (const k of ["contentHash", "bodySha256", "observationSha256"] as const) {
        const value = e[k];
        if (value !== null && value !== undefined && (typeof value !== "string" || !SHA256.test(value))) schemaIssue("hash_format", `${p}.evidence.${k}`, "must be a 64-character SHA-256 hex string or null");
      }
      if (e.bodyReference !== null && typeof e.bodyReference !== "string") schemaIssue("body_reference", `${p}.evidence.bodyReference`, "must be a reference string or null");
    }

    if (!isRecord(c.proposal)) schemaIssue("proposal", `${p}.proposal`, "proposal object is required");
    else {
      if (c.proposal.decision !== null && !validDecision(c.proposal.decision)) schemaIssue("proposal_decision", `${p}.proposal.decision`, "must be select, reject, either, or null");
      if (!nonempty(c.proposal.proposedBy) || !nonempty(c.proposal.rationale)) schemaIssue("proposal_fields", `${p}.proposal`, "proposedBy and rationale are required; proposal is advisory only");
    }

    if (!isRecord(c.humanAnnotation)) schemaIssue("human_annotation", `${p}.humanAnnotation`, "humanAnnotation object is required");
    else {
      const a = c.humanAnnotation;
      if (a.status === "needs_review") {
        pending++;
        if (a.decision !== null || a.confirmedBy !== null || a.confirmedAt !== null) schemaIssue("unconfirmed_truth", `${p}.humanAnnotation`, "needs_review must not contain a decision or confirmation identity/time");
      } else if (a.status === "user_confirmed") {
        confirmed++;
        if (!validDecision(a.decision)) schemaIssue("confirmed_decision", `${p}.humanAnnotation.decision`, "user-confirmed decision must be select, reject, or either");
        if (!nonempty(a.confirmedBy) || !nonempty(a.confirmedAt) || !Number.isFinite(Date.parse(a.confirmedAt ?? ""))) schemaIssue("confirmation_fields", `${p}.humanAnnotation`, "confirmedBy and a valid confirmedAt are required");
      } else schemaIssue("annotation_status", `${p}.humanAnnotation.status`, "must be needs_review or user_confirmed");
    }
  });

  for (const [group, splits] of groupSplits) if (splits.size > 1) schemaIssue("event_group_split_leak", "candidates", `eventGroupId ${group} appears in both development and holdout`);

  const incomplete = input.candidates.some((raw) => {
    if (!isRecord(raw)) return true;
    const c = raw as unknown as Partial<Candidate>;
    return c.humanAnnotation?.status !== "user_confirmed"
      || c.eventGroupStatus !== "user_confirmed"
      || c.samplingContext?.splitStatus !== "user_confirmed"
      || !c.material
      || (!nonempty(c.material.bodyZh) && !nonempty(c.material.bodyOriginal))
      || !c.evidence
      || c.evidence.bodyStatus !== "ok"
      || !nonempty(c.evidence.sourceArticleId)
      || !c.evidence.contentHash || !SHA256.test(c.evidence.contentHash)
      || !c.evidence.bodySha256 || !SHA256.test(c.evidence.bodySha256);
  });
  const status = structuralError ? "SCHEMA_ERROR" : incomplete ? "DRAFT_INCOMPLETE" : "READY_FOR_EVALUATION";
  return { status, issues, counts: { candidates: input.candidates.length, confirmed, pending } };
}

function main(argv: string[]): number {
  if (argv[0] !== "validate" || !argv[1]) {
    console.error("Usage: node scripts/fiscal/gold-dataset.ts validate <manifest.json>");
    return 2;
  }
  let input: unknown;
  try { input = JSON.parse(readFileSync(path.resolve(argv[1]), "utf8")); }
  catch (error) {
    console.log(JSON.stringify({ status: "SCHEMA_ERROR", issues: [{ code: "json_parse", path: argv[1], message: String(error) }], counts: { candidates: 0, confirmed: 0, pending: 0 } }));
    return 2;
  }
  const result = validateManifest(input);
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "SCHEMA_ERROR") return 2;
  if (result.status === "DRAFT_INCOMPLETE") return 3;
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(VALIDATOR_FILE)) process.exitCode = main(process.argv.slice(2));

export { validateManifest };
