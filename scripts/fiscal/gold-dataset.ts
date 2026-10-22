#!/usr/bin/env node
/**
 * Validate the metadata-only preparation manifest for the finance gold set.
 * This command is intentionally offline and never runs selection or calibration.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Decision = "select" | "reject" | "either";
type Split = "development" | "holdout";
type VerificationStatus = "needs_review" | "user_confirmed" | "agent_verified";
type Issue = { code: string; path: string; message: string };
interface VerificationProvenance {
  reviewer: string;
  method: string;
  verifiedAt: string;
  evidenceSha256: string;
}

interface Candidate {
  caseId: string;
  eventGroupId: string;
  eventGroupStatus: VerificationStatus;
  eventGroupVerification?: VerificationProvenance;
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
  samplingContext: { benchmarkSplit: Split; samplingStratum: string; splitStatus: VerificationStatus; splitVerification?: VerificationProvenance };
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

function validateVerificationStatus(
  status: unknown,
  provenance: unknown,
  fieldPath: string,
  schemaIssue: (code: string, pathName: string, message: string) => void,
): boolean {
  if (status !== "needs_review" && status !== "user_confirmed" && status !== "agent_verified") {
    schemaIssue("verification_status", fieldPath, "must be needs_review, user_confirmed, or agent_verified");
    return false;
  }
  if (status !== "agent_verified") {
    if (provenance !== undefined && provenance !== null) {
      schemaIssue("unexpected_verification_provenance", `${fieldPath}Verification`, "provenance is only valid when status is agent_verified");
    }
    return true;
  }
  if (!isRecord(provenance)) {
    schemaIssue("verification_provenance", `${fieldPath}Verification`, "agent_verified requires reviewer, method, verifiedAt, and evidenceSha256 provenance");
    return false;
  }
  if (!nonempty(provenance.reviewer)) schemaIssue("verification_reviewer", `${fieldPath}Verification.reviewer`, "reviewer is required for agent verification");
  if (!nonempty(provenance.method)) schemaIssue("verification_method", `${fieldPath}Verification.method`, "method is required for agent verification");
  if (!nonempty(provenance.verifiedAt) || !Number.isFinite(Date.parse(provenance.verifiedAt))) {
    schemaIssue("verification_time", `${fieldPath}Verification.verifiedAt`, "verifiedAt must be a parseable timestamp");
  }
  if (typeof provenance.evidenceSha256 !== "string" || !SHA256.test(provenance.evidenceSha256)) {
    schemaIssue("verification_evidence_hash", `${fieldPath}Verification.evidenceSha256`, "evidenceSha256 must be a 64-character SHA-256 hex string");
  }
  return true;
}

interface SeedCheckInput {
  caseIds: unknown;
  fileSha256?: string | null;
}

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

function validateManifest(input: unknown, seedInput?: SeedCheckInput): {
  status: "SCHEMA_ERROR" | "DRAFT_INCOMPLETE" | "READY_FOR_EVALUATION";
  issues: Issue[];
  counts: Record<string, number>;
  seedCheck: { status: "not_run" | "checked"; caseCount: number; fileSha256: string | null };
} {
  const issues: Issue[] = [];
  let structuralError = false;
  const seedCheck = {
    status: seedInput === undefined ? "not_run" as const : "checked" as const,
    caseCount: Array.isArray(seedInput?.caseIds) ? seedInput.caseIds.length : 0,
    fileSha256: seedInput?.fileSha256 ?? null,
  };
  if (!isRecord(input)) {
    add(issues, "manifest_type", "$", "manifest must be a JSON object");
    return { status: "SCHEMA_ERROR", issues, counts: { candidates: 0, confirmed: 0, pending: 0 }, seedCheck };
  }
  if (input.schemaVersion !== "p5.gold-metadata-draft/v1") { structuralError = true; add(issues, "schema_version", "schemaVersion", "expected p5.gold-metadata-draft/v1"); }
  if (input.datasetStatus !== "DRAFT") { structuralError = true; add(issues, "dataset_status", "datasetStatus", "metadata preparation manifests must remain DRAFT"); }
  if (!Array.isArray(input.candidates) || input.candidates.length === 0) {
    add(issues, "candidates", "candidates", "must be a non-empty array");
    return { status: "SCHEMA_ERROR", issues, counts: { candidates: 0, confirmed: 0, pending: 0 }, seedCheck };
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
    validateVerificationStatus(c.eventGroupStatus, c.eventGroupVerification, `${p}.eventGroup`, schemaIssue);

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
      validateVerificationStatus(c.samplingContext.splitStatus, c.samplingContext.splitVerification, `${p}.samplingContext.split`, schemaIssue);
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

  const seedIds = new Set<string>();
  if (seedInput !== undefined) {
    if (!Array.isArray(seedInput.caseIds)) {
      schemaIssue("seed_case_ids_type", "seedCaseIds", "seed case ID file must contain a JSON array of strings");
    } else {
      for (let i = 0; i < seedInput.caseIds.length; i++) {
        const value: unknown = seedInput.caseIds[i];
        if (!nonempty(value)) {
          schemaIssue("seed_case_id", `seedCaseIds[${i}]`, "seed case IDs must be non-empty strings");
          continue;
        }
        if (seedIds.has(value)) {
          schemaIssue("duplicate_seed_case_id", `seedCaseIds[${i}]`, `seed case ID ${value} is duplicated`);
          continue;
        }
        seedIds.add(value);
      }
      for (const caseId of seedIds) {
        const index = input.candidates.findIndex((raw) => isRecord(raw) && raw.caseId === caseId);
        if (index < 0) {
          schemaIssue("unknown_seed_case_id", "seedCaseIds", `seed case ID ${caseId} is not present in the manifest`);
          continue;
        }
        const candidate = input.candidates[index] as Record<string, unknown>;
        const samplingContext = candidate.samplingContext;
        if (isRecord(samplingContext) && samplingContext.benchmarkSplit === "holdout") {
          schemaIssue("preference_seed_in_holdout", `candidates[${index}].samplingContext.benchmarkSplit`, `preference seed ${caseId} cannot be assigned to holdout`);
        }
      }
    }
  } else {
    add(issues, "seed_check_not_run", "seedCaseIds", "preference-seed isolation was not checked; provide an explicit seed case ID file (use [] when there are no seeds)");
  }

  for (const [group, splits] of groupSplits) if (splits.size > 1) schemaIssue("event_group_split_leak", "candidates", `eventGroupId ${group} appears in both development and holdout`);

  const incomplete = input.candidates.some((raw) => {
    if (!isRecord(raw)) return true;
    const c = raw as unknown as Partial<Candidate>;
    return c.humanAnnotation?.status !== "user_confirmed"
      || (c.eventGroupStatus !== "user_confirmed" && c.eventGroupStatus !== "agent_verified")
      || (c.samplingContext?.splitStatus !== "user_confirmed" && c.samplingContext?.splitStatus !== "agent_verified")
      || !c.material
      || (!nonempty(c.material.bodyZh) && !nonempty(c.material.bodyOriginal))
      || !c.evidence
      || c.evidence.bodyStatus !== "ok"
      || !nonempty(c.evidence.sourceArticleId)
      || !c.evidence.contentHash || !SHA256.test(c.evidence.contentHash)
      || !c.evidence.bodySha256 || !SHA256.test(c.evidence.bodySha256);
  });
  const status = structuralError ? "SCHEMA_ERROR" : incomplete || seedInput === undefined ? "DRAFT_INCOMPLETE" : "READY_FOR_EVALUATION";
  return { status, issues, counts: { candidates: input.candidates.length, confirmed, pending }, seedCheck };
}

function main(argv: string[]): number {
  if (argv[0] !== "validate" || !argv[1]) {
    console.error("Usage: node scripts/fiscal/gold-dataset.ts validate <manifest.json> --seed-case-ids <seed-case-ids.json>");
    return 2;
  }
  const seedOptionIndex = argv.indexOf("--seed-case-ids");
  if (seedOptionIndex < 0 || !argv[seedOptionIndex + 1] || argv[seedOptionIndex + 1].startsWith("--")) {
    console.log(JSON.stringify({ status: "SCHEMA_ERROR", issues: [{ code: "seed_file_required", path: "--seed-case-ids", message: "provide an explicit JSON file containing seed case IDs; use [] when there are no seeds" }], counts: { candidates: 0, confirmed: 0, pending: 0 }, seedCheck: { status: "not_run", caseCount: 0, fileSha256: null } }, null, 2));
    return 2;
  }
  let input: unknown;
  try { input = JSON.parse(readFileSync(path.resolve(argv[1]), "utf8")); }
  catch (error) {
    console.log(JSON.stringify({ status: "SCHEMA_ERROR", issues: [{ code: "json_parse", path: argv[1], message: String(error) }], counts: { candidates: 0, confirmed: 0, pending: 0 }, seedCheck: { status: "not_run", caseCount: 0, fileSha256: null } }));
    return 2;
  }
  let seedInput: SeedCheckInput;
  const seedPath = path.resolve(argv[seedOptionIndex + 1]);
  let seedBytes: Buffer;
  try { seedBytes = readFileSync(seedPath); }
  catch (error) {
    console.log(JSON.stringify({ status: "SCHEMA_ERROR", issues: [{ code: "seed_file_read", path: seedPath, message: String(error) }], counts: { candidates: 0, confirmed: 0, pending: 0 }, seedCheck: { status: "not_run", caseCount: 0, fileSha256: null } }, null, 2));
    return 2;
  }
  try {
    seedInput = { caseIds: JSON.parse(seedBytes.toString("utf8")), fileSha256: createHash("sha256").update(seedBytes).digest("hex") };
  } catch (error) {
    console.log(JSON.stringify({ status: "SCHEMA_ERROR", issues: [{ code: "seed_file_json", path: seedPath, message: String(error) }], counts: { candidates: 0, confirmed: 0, pending: 0 }, seedCheck: { status: "not_run", caseCount: 0, fileSha256: null } }, null, 2));
    return 2;
  }
  const result = validateManifest(input, seedInput);
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "SCHEMA_ERROR") return 2;
  if (result.status === "DRAFT_INCOMPLETE") return 3;
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(VALIDATOR_FILE)) process.exitCode = main(process.argv.slice(2));

export { validateManifest };
