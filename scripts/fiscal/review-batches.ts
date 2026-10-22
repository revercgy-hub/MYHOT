#!/usr/bin/env node
/** Freeze body-backed Gold review candidates and move them only into private review tables. */
import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateManifest } from "./gold-dataset.ts";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_FILE), "../..");
const DEFAULT_SOURCE_MANIFEST = path.join(ROOT, "docs/fiscal-finance/gold/candidates-2026-10-18.json");
const DEFAULT_PROPOSAL = path.join(ROOT, ".data/fiscal-qa/p5-gold-150-20261021/candidates-150-proposal-draft.json");
const DEFAULT_SEEDS = path.join(ROOT, ".data/fiscal-qa/p5-seed-leakage-20261021/seed-case-ids.json");
const BODY_DIRS = [
  path.join(ROOT, ".data/fiscal-qa/gold-candidates-20261018/body-text"),
  path.join(ROOT, ".data/fiscal-qa/p5-gold-150-20261021/body-text"),
];
const SHA256 = /^[a-f0-9]{64}$/i;
const SAFE_CASE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/;

type Annotation = { status: "needs_review" | "user_confirmed"; decision: "select" | "reject" | "either" | null; confirmedBy: string | null; confirmedAt: string | null };
type Candidate = Record<string, any>;
export interface FrozenReviewCandidate {
  caseId: string;
  contentHash: string;
  bodySha256: string;
  sourceArticleId: string | null;
  sourceRevision: number | null;
  candidateMetadata: Record<string, unknown>;
  bodyZhSnapshot: string;
  bodyOriginalSnapshot: string;
  humanAnnotation: Annotation;
}
export interface FrozenReviewBatch {
  batchHash: string;
  manifestSha256: string;
  schemaVersion: string;
  manifestMeta: Record<string, unknown>;
  candidates: FrozenReviewCandidate[];
}

function sha256(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function readJson(file: string): { value: any; bytes: Buffer } {
  const bytes = readFileSync(file);
  return { value: JSON.parse(bytes.toString("utf8")), bytes };
}

export function resolveBodyCacheFile(caseId: string, bodyDirs: string[] = BODY_DIRS): string {
  if (!SAFE_CASE_ID.test(caseId)) throw new Error(`unsafe caseId for body-cache path: ${caseId}`);
  const filename = `${caseId}.txt`;
  const repoRoot = realpathSync(ROOT);
  const dataRoot = realpathSync(path.join(ROOT, ".data"));
  const dataRelative = path.relative(repoRoot, dataRoot);
  if (!dataRelative || dataRelative === ".." || dataRelative.startsWith(`..${path.sep}`) || path.isAbsolute(dataRelative)) {
    throw new Error("trusted .data root resolves outside the repository");
  }
  for (const dir of bodyDirs) {
    try {
      const resolvedDir = realpathSync(dir);
      const directoryRelative = path.relative(dataRoot, resolvedDir);
      if (!directoryRelative || directoryRelative === ".." || directoryRelative.startsWith(`..${path.sep}`) || path.isAbsolute(directoryRelative)) {
        throw new Error(`body cache directory escaped trusted .data root for ${caseId}`);
      }
      const candidate = path.resolve(resolvedDir, filename);
      if (!candidate.startsWith(`${resolvedDir}${path.sep}`)) throw new Error(`body cache path escaped its allowed directory for ${caseId}`);
      const actual = realpathSync(candidate);
      if (!actual.startsWith(`${resolvedDir}${path.sep}`)) throw new Error(`body cache symlink escaped its allowed directory for ${caseId}`);
      return actual;
    } catch (error) {
      if (error instanceof Error && (error.message.includes("escaped its allowed directory") || error.message.includes("escaped trusted .data"))) throw error;
      // Search the other frozen body cache when the file is absent here.
    }
  }
  throw new Error(`body cache is missing for ${caseId}`);
}

function bodyFile(caseId: string): string {
  return resolveBodyCacheFile(caseId);
}

export function buildFrozenReviewBatch(args: {
  sourceManifest: unknown;
  sourceManifestBytes: Buffer;
  proposal: unknown;
  proposalBytes: Buffer;
  seedIds: unknown;
  seedBytes: Buffer;
  loadBody: (caseId: string) => Buffer;
}): FrozenReviewBatch {
  const source = args.sourceManifest as { candidates?: Candidate[] };
  const proposal = args.proposal as { schemaVersion?: string; candidates?: Candidate[] };
  if (!Array.isArray(source?.candidates) || source.candidates.length !== 100) throw new Error("tracked source manifest must contain exactly 100 candidates");
  if (!Array.isArray(proposal?.candidates) || proposal.candidates.length !== 150) throw new Error("150-candidate proposal must contain exactly 150 candidates");
  const validation = validateManifest(proposal, { caseIds: args.seedIds, fileSha256: sha256(args.seedBytes) });
  if (validation.status === "SCHEMA_ERROR") throw new Error(`150-candidate proposal failed Gold validator: ${validation.issues.slice(0, 5).map((issue) => issue.code).join(",")}`);

  const oldById = new Map(source.candidates.map((candidate) => [candidate.caseId, candidate]));
  const proposalById = new Map(proposal.candidates.map((candidate) => [candidate.caseId, candidate]));
  if ([...proposalById.keys()].some((caseId) => typeof caseId !== "string" || !SAFE_CASE_ID.test(caseId))) throw new Error("candidate caseId must be a safe single-segment filename identity");
  if (oldById.size !== 100 || proposalById.size !== 150) throw new Error("candidate caseIds must be unique in both manifests");
  for (const [caseId, oldCandidate] of oldById) {
    const current = proposalById.get(caseId);
    if (!current || stable(current) !== stable(oldCandidate)) throw new Error(`proposal changed tracked candidate ${caseId}`);
  }
  const additions = proposal.candidates.filter((candidate) => !oldById.has(candidate.caseId));
  if (additions.length !== 50 || additions.some((candidate) => candidate.humanAnnotation?.status !== "needs_review" || candidate.humanAnnotation?.decision !== null
    || candidate.eventGroupId !== "unassigned-needs-human-review" || candidate.eventGroupStatus !== "needs_review"
    || candidate.samplingContext?.splitStatus !== "needs_review")) {
    throw new Error("the proposal must add exactly 50 unassigned candidates with pending human, event-group, and split status");
  }

  const seedIds = args.seedIds;
  if (!Array.isArray(seedIds) || seedIds.length !== 15 || new Set(seedIds).size !== 15 || seedIds.some((id) => !proposalById.has(id))) {
    throw new Error("expected the exact 15 unique protected seed ids, all present in the proposal");
  }
  if (seedIds.some((id) => proposalById.get(id)?.humanAnnotation?.status !== "user_confirmed")) throw new Error("every protected seed must retain its confirmed annotation");
  const confirmedOriginal = source.candidates.filter((candidate) => candidate.humanAnnotation?.status === "user_confirmed");
  if (confirmedOriginal.length !== 20) throw new Error("tracked manifest must retain exactly 20 confirmed annotations");

  const candidates: FrozenReviewCandidate[] = proposal.candidates.map((candidate) => {
    if (candidate.evidence?.bodyStatus !== "ok" || candidate.sourceFacts?.language !== "zh") throw new Error(`candidate ${candidate.caseId} is not a confirmed body-backed zh record`);
    const body = args.loadBody(candidate.caseId);
    const actualBodyHash = sha256(body);
    if (!SHA256.test(candidate.evidence?.bodySha256 ?? "") || actualBodyHash !== candidate.evidence.bodySha256.toLowerCase()) throw new Error(`body hash mismatch for ${candidate.caseId}`);
    const metadata = structuredClone(candidate) as Record<string, unknown>;
    return {
      caseId: candidate.caseId,
      contentHash: String(candidate.evidence.contentHash ?? "").toLowerCase(),
      bodySha256: actualBodyHash,
      // This batch is imported into an empty NAS staging DB. Keep the local source identity
      // as private provenance in candidateMetadata; do not claim a NAS article CAS binding.
      sourceArticleId: null,
      sourceRevision: null,
      candidateMetadata: metadata,
      bodyZhSnapshot: body.toString("utf8"),
      bodyOriginalSnapshot: "",
      humanAnnotation: structuredClone(candidate.humanAnnotation) as Annotation,
    };
  }).sort((a, b) => a.caseId.localeCompare(b.caseId));
  if (candidates.some((candidate) => !SHA256.test(candidate.contentHash))) throw new Error("all candidates must have a contentHash");

  const cacheIndex = candidates.map(({ caseId, bodySha256 }) => ({ caseId, bodySha256 }));
  const manifestMeta = {
    origin: "local-private-p5-review-freeze",
    candidateCount: candidates.length,
    sourceManifestSha256: sha256(args.sourceManifestBytes),
    proposalManifestSha256: sha256(args.proposalBytes),
    cacheIndexSha256: sha256(stable(cacheIndex)),
    seedIds: [...seedIds].sort(),
    seedIdsSha256: sha256(args.seedBytes),
    provenance: { mainCatalog: 139, pagination: 4, regionalBatch: 6, coreBatch: 1 },
    sourceArticlePoolCountsAreMetadataOnly: true,
  };
  const payload = {
    manifestSha256: sha256(args.proposalBytes),
    schemaVersion: proposal.schemaVersion ?? "p5.gold-metadata-draft/v1",
    manifestMeta,
    candidates,
  };
  return { ...payload, batchHash: sha256(stable({ ...payload, candidates: [...candidates].sort((a, b) => a.caseId.localeCompare(b.caseId)) })) };
}

function buildDefaultBatch(): FrozenReviewBatch {
  const source = readJson(DEFAULT_SOURCE_MANIFEST);
  const proposal = readJson(DEFAULT_PROPOSAL);
  const seeds = readJson(DEFAULT_SEEDS);
  return buildFrozenReviewBatch({
    sourceManifest: source.value,
    sourceManifestBytes: source.bytes,
    proposal: proposal.value,
    proposalBytes: proposal.bytes,
    seedIds: seeds.value,
    seedBytes: seeds.bytes,
    loadBody: (caseId) => readFileSync(bodyFile(caseId)),
  });
}

function writeNewJson(outPath: string, value: unknown): void {
  const absolute = path.resolve(outPath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  const fd = openSync(absolute, "wx", 0o600);
  try { writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
  finally { closeSync(fd); }
}

function setSafeFlags(): void {
  for (const name of ["COLLECT_ENABLED", "MODEL_CALLS_ENABLED", "OCR_RUN_ENABLED", "FEISHU_INTERNAL_ENABLED", "FEISHU_CONTENT_PUSH_ENABLED", "INDEXNOW_SUBMIT_ENABLED", "JINA_BODY_FALLBACK", "EMBEDDINGS_ENABLED", "ALLOW_PRIVATE_NETWORK_FETCH"]) process.env[name] = "false";
}

function ensureIgnoredDataPath(outPath: string): string {
  const absolute = path.resolve(outPath);
  const dataRoot = path.resolve(ROOT, ".data") + path.sep;
  if (!absolute.startsWith(dataRoot)) throw new Error("frozen body payloads must stay under the ignored repository .data directory");
  return absolute;
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function main(argv: string[]): number | Promise<number> {
  const command = argv[0];
  if (command === "plan" || command === "freeze") {
    try {
      const batch = buildDefaultBatch();
      if (command === "freeze") {
        const out = ensureIgnoredDataPath(option(argv, "--out") ?? path.join(ROOT, ".data/fiscal-qa/review-batches-20261022/payload-150.json"));
        writeNewJson(out, batch);
      }
      const confirmed = batch.candidates.filter((candidate) => candidate.humanAnnotation.status === "user_confirmed").length;
      console.log(JSON.stringify({ result: "PASS", command, candidateCount: batch.candidates.length, confirmedCount: confirmed, needsReviewCount: batch.candidates.length - confirmed, protectedSeedCount: (batch.manifestMeta.seedIds as string[]).length, batchHash: batch.batchHash, manifestSha256: batch.manifestSha256, output: command === "freeze" ? path.resolve(option(argv, "--out") ?? path.join(ROOT, ".data/fiscal-qa/review-batches-20261022/payload-150.json")) : null, writesDatabase: false }, null, 2));
      return 0;
    } catch (error) { console.error(String(error)); return 1; }
  }
  if (command !== "import" && command !== "export") {
    console.error("Usage: node scripts/fiscal/review-batches.ts plan | freeze [--out file] | import --input frozen.json --expected-database fiscalhot_staging --commit | export --batch-hash <sha256> --out overlay.json");
    return 2;
  }
  setSafeFlags();
  return runDatabaseCommand(command, argv);
}

async function runDatabaseCommand(command: "import" | "export", argv: string[]): Promise<number> {
  try {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be explicitly set; no default database is allowed");
    const expectedDatabase = option(argv, "--expected-database");
    if (!expectedDatabase) throw new Error("--expected-database is required");
    if (command === "import" && !argv.includes("--commit")) throw new Error("import requires explicit --commit");
    const inputPath = option(argv, "--input");
    const outPath = option(argv, "--out");
    const frozen = command === "import" ? JSON.parse(readFileSync(inputPath ?? "", "utf8")) as FrozenReviewBatch : null;
    const batchHash = command === "export" ? option(argv, "--batch-hash") : frozen?.batchHash;
    if (!batchHash || !SHA256.test(batchHash)) throw new Error("a valid batch hash is required");
    if (!outPath && command === "export") throw new Error("export requires --out");

    const { sql } = await import("@aihot/backend/db");
    const [databaseRows, sourceRows, tableRows] = await Promise.all([
      sql<{ current_database: string }[]>`SELECT current_database()`,
      sql<{ total: number; enabled: number; site_fulltext: number; syndicate_fulltext: number }[]>`SELECT count(*)::int AS total, count(*) FILTER (WHERE enabled)::int AS enabled, count(*) FILTER (WHERE site_fulltext)::int AS site_fulltext, count(*) FILTER (WHERE syndicate_fulltext)::int AS syndicate_fulltext FROM sources`,
      sql<{ present: boolean }[]>`SELECT to_regclass('public.gold_review_batches') IS NOT NULL AS present`,
    ]);
    const database = databaseRows[0]?.current_database;
    const sourceState = sourceRows[0];
    const tableState = tableRows[0];
    if (database !== expectedDatabase) throw new Error(`database identity mismatch (connected database is ${database})`);
    const state = sourceState!;
    if (state.total !== 48 || state.enabled !== 0 || state.site_fulltext !== 0 || state.syndicate_fulltext !== 0) throw new Error("source safety state is not the expected 48 disabled sources");
    if (!tableState?.present) throw new Error("gold_review_batches is absent; apply reviewed migration 0039 before import/export");

    if (command === "import") {
      const { importReviewBatch } = await import("@aihot/backend/admin/review-batches");
      const result = await importReviewBatch(frozen as FrozenReviewBatch, "script:review-batches-import");
      console.log(JSON.stringify({ result: "PASS", command, database, ...result, sourceState: state, otherWrites: 0 }, null, 2));
    } else {
      const { exportReviewOverlay } = await import("@aihot/backend/admin/review-batches");
      const overlay = await exportReviewOverlay(batchHash);
      if (!overlay) throw new Error("review batch was not found");
      writeNewJson(outPath!, overlay);
      console.log(JSON.stringify({ result: "PASS", command, database, batchHash, itemCount: overlay.items.length, output: path.resolve(outPath!), includesBodies: false, databaseWrites: 0 }, null, 2));
    }
    const { closeDb } = await import("@aihot/backend/db");
    await closeDb();
    return 0;
  } catch (error) {
    console.error(String(error));
    try { const { closeDb } = await import("@aihot/backend/db"); await closeDb(); } catch { /* connection may not have initialized */ }
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_FILE)) process.exitCode = await main(process.argv.slice(2));
