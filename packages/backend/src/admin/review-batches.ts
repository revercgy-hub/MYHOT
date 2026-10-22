// Private human review queue for frozen Gold candidates. This module never writes publication,
// analysis, provider, or processing-queue tables.
import { createHash } from "node:crypto";
import { sql, type Tx } from "../db.ts";

export type ReviewDecision = "select" | "reject" | "either";
export type ReviewStatus = "needs_review" | "user_confirmed";
const SHA256 = /^[a-f0-9]{64}$/i;
const DECISIONS = new Set<ReviewDecision>(["select", "reject", "either"]);

export class ReviewBatchError extends Error {
  readonly statusCode: number;
  readonly code: string;
  constructor(message: string, statusCode: number, code = statusCode === 409 ? "conflict" : "invalid_request") {
    super(message);
    this.name = "ReviewBatchError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface ReviewImportCandidate {
  caseId: string;
  contentHash: string;
  bodySha256: string;
  sourceArticleId: string | null;
  sourceRevision: number | null;
  candidateMetadata: Record<string, unknown>;
  bodyZhSnapshot: string;
  bodyOriginalSnapshot: string;
  humanAnnotation: {
    status: ReviewStatus;
    decision: ReviewDecision | null;
    confirmedBy: string | null;
    confirmedAt: string | null;
  };
}

export interface ReviewBatchImport {
  batchHash: string;
  manifestSha256: string;
  schemaVersion: string;
  manifestMeta: Record<string, unknown>;
  candidates: ReviewImportCandidate[];
}

function fail(message: string, statusCode = 400): never {
  throw new ReviewBatchError(message, statusCode);
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function conflict(message: string): never {
  throw new ReviewBatchError(message, 409, "conflict");
}

function validateCandidate(candidate: ReviewImportCandidate): void {
  if (!candidate || typeof candidate.caseId !== "string" || !candidate.caseId.trim() || candidate.caseId.length > 200) fail("caseId is required and must be at most 200 characters");
  if (!SHA256.test(candidate.contentHash) || !SHA256.test(candidate.bodySha256)) fail(`invalid hashes for ${candidate.caseId}`);
  if (candidate.sourceArticleId !== null && (typeof candidate.sourceArticleId !== "string" || !candidate.sourceArticleId.trim())) fail(`invalid sourceArticleId for ${candidate.caseId}`);
  if (candidate.sourceRevision !== null && (!Number.isSafeInteger(candidate.sourceRevision) || candidate.sourceRevision < 1)) fail(`invalid sourceRevision for ${candidate.caseId}`);
  if ((candidate.sourceArticleId === null) !== (candidate.sourceRevision === null)) fail(`sourceArticleId and sourceRevision must both be set or both be null for ${candidate.caseId}`);
  if (!candidate.candidateMetadata || typeof candidate.candidateMetadata !== "object" || Array.isArray(candidate.candidateMetadata)) fail(`candidateMetadata is required for ${candidate.caseId}`);
  const evidence = (candidate.candidateMetadata.evidence ?? {}) as Record<string, unknown>;
  if (typeof evidence.contentHash !== "string" || evidence.contentHash.toLowerCase() !== candidate.contentHash.toLowerCase()) fail(`candidateMetadata contentHash does not match for ${candidate.caseId}`);
  if (typeof evidence.bodySha256 !== "string" || evidence.bodySha256.toLowerCase() !== candidate.bodySha256.toLowerCase()) fail(`candidateMetadata bodySha256 does not match for ${candidate.caseId}`);
  if (typeof candidate.bodyZhSnapshot !== "string" || typeof candidate.bodyOriginalSnapshot !== "string") fail(`body snapshots must be strings for ${candidate.caseId}`);
  if (!!candidate.bodyZhSnapshot === !!candidate.bodyOriginalSnapshot) fail(`exactly one body snapshot is required for ${candidate.caseId}`);
  const body = candidate.bodyZhSnapshot || candidate.bodyOriginalSnapshot;
  if (sha256(body) !== candidate.bodySha256.toLowerCase()) fail(`bodySha256 does not match frozen body for ${candidate.caseId}`);
  const annotation = candidate.humanAnnotation;
  if (!annotation || !["needs_review", "user_confirmed"].includes(annotation.status)) fail(`invalid humanAnnotation status for ${candidate.caseId}`);
  if (annotation.status === "needs_review") {
    if (annotation.decision !== null || annotation.confirmedBy !== null || annotation.confirmedAt !== null) fail(`pending annotation must be empty for ${candidate.caseId}`);
  } else if (!annotation.decision || !DECISIONS.has(annotation.decision) || !annotation.confirmedBy?.trim() || !annotation.confirmedAt || !Number.isFinite(Date.parse(annotation.confirmedAt))) {
    fail(`confirmed annotation is incomplete for ${candidate.caseId}`);
  }
}

function importPayload(input: ReviewBatchImport): unknown {
  return {
    manifestSha256: input.manifestSha256.toLowerCase(),
    schemaVersion: input.schemaVersion,
    manifestMeta: input.manifestMeta,
    candidates: [...input.candidates].sort((a, b) => a.caseId.localeCompare(b.caseId)),
  };
}

/** Import an immutable body-backed manifest. Safe to retry with the identical batch hash. */
export async function importReviewBatch(input: ReviewBatchImport, actor: string) {
  if (!input || !SHA256.test(input.batchHash) || !SHA256.test(input.manifestSha256)) fail("batchHash and manifestSha256 must be SHA-256 hex strings");
  if (!actor?.trim()) fail("actor is required");
  if (!input.schemaVersion?.trim() || !input.manifestMeta || typeof input.manifestMeta !== "object" || Array.isArray(input.manifestMeta)) fail("schemaVersion and manifestMeta are required");
  if (!Array.isArray(input.candidates) || input.candidates.length < 1 || input.candidates.length > 500) fail("candidate count must be between 1 and 500");
  const seen = new Set<string>();
  for (const candidate of input.candidates) {
    validateCandidate(candidate);
    if (seen.has(candidate.caseId)) fail(`duplicate caseId ${candidate.caseId}`);
    seen.add(candidate.caseId);
  }
  const seedIds = (input.manifestMeta as Record<string, unknown>).seedIds;
  if (!Array.isArray(seedIds) || seedIds.some((id) => typeof id !== "string" || !id.trim()) || new Set(seedIds).size !== seedIds.length) fail("manifestMeta.seedIds must be an explicit unique string array (use [] when there are no seeds)");
  const byCaseId = new Map(input.candidates.map((candidate) => [candidate.caseId, candidate]));
  for (const seedId of seedIds as string[]) {
    const candidate = byCaseId.get(seedId);
    if (!candidate) fail(`seed case ${seedId} is missing from the imported batch`);
    const sampling = candidate.candidateMetadata.samplingContext as Record<string, unknown> | undefined;
    if (candidate.humanAnnotation.status !== "user_confirmed" || sampling?.benchmarkSplit === "holdout") fail(`seed case ${seedId} must remain confirmed and outside holdout`);
  }
  const normalized = { ...input, batchHash: input.batchHash.toLowerCase(), manifestSha256: input.manifestSha256.toLowerCase() };
  const payloadSha256 = sha256(stable(importPayload(normalized)));
  if (normalized.batchHash !== payloadSha256) fail("batchHash must equal SHA-256 of the canonical import payload");

  return sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${normalized.batchHash}, 0))`;
    const [existing] = await tx<{ payload_sha256: string; manifest_sha256: string; candidate_count: number }[]>`
      SELECT payload_sha256, manifest_sha256, candidate_count FROM gold_review_batches WHERE batch_hash = ${normalized.batchHash} FOR UPDATE`;
    if (existing) {
      if (existing.payload_sha256 !== payloadSha256 || existing.manifest_sha256 !== normalized.manifestSha256 || existing.candidate_count !== normalized.candidates.length) {
        conflict("batchHash already exists with different frozen input");
      }
      return { batchHash: normalized.batchHash, importedCount: existing.candidate_count, alreadyImported: true };
    }

    await tx`INSERT INTO gold_review_batches (batch_hash, manifest_sha256, payload_sha256, schema_version, manifest_meta, candidate_count, imported_by)
      VALUES (${normalized.batchHash}, ${normalized.manifestSha256}, ${payloadSha256}, ${normalized.schemaVersion}, ${tx.json(normalized.manifestMeta as never)}, ${normalized.candidates.length}, ${actor})`;
    for (const candidate of normalized.candidates) {
      if (candidate.sourceArticleId !== null && candidate.sourceRevision !== null) {
        await ensureSourceSnapshot(tx, { source_article_id: candidate.sourceArticleId, source_revision: candidate.sourceRevision, content_hash: candidate.contentHash, case_id: candidate.caseId });
      }
      const metadata = structuredClone(candidate.candidateMetadata) as Record<string, unknown>;
      const material = metadata.material && typeof metadata.material === "object" ? metadata.material as Record<string, unknown> : null;
      if (material) {
        material.bodyZh = null;
        material.bodyOriginal = null;
      }
      delete metadata.humanAnnotation;
      await tx`INSERT INTO gold_review_cases
        (batch_hash, case_id, candidate_metadata, body_zh_snapshot, body_original_snapshot, content_hash, body_sha256, source_article_id, source_revision, human_status, decision, confirmed_by, confirmed_at)
        VALUES (${normalized.batchHash}, ${candidate.caseId}, ${tx.json(metadata as never)}, ${candidate.bodyZhSnapshot}, ${candidate.bodyOriginalSnapshot},
          ${candidate.contentHash.toLowerCase()}, ${candidate.bodySha256.toLowerCase()}, ${candidate.sourceArticleId}, ${candidate.sourceRevision},
          ${candidate.humanAnnotation.status}, ${candidate.humanAnnotation.decision}, ${candidate.humanAnnotation.confirmedBy}, ${candidate.humanAnnotation.confirmedAt})`;
    }
    await tx`INSERT INTO audit_log (actor, action, subject, before, after)
      VALUES (${actor}, 'gold_review.import', ${`gold-review:${normalized.batchHash}`}, NULL,
        ${tx.json({ batchHash: normalized.batchHash, manifestSha256: normalized.manifestSha256, candidates: normalized.candidates.length })})`;
    return { batchHash: normalized.batchHash, importedCount: normalized.candidates.length, alreadyImported: false };
  });
}

function integer(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) fail("pagination values must be non-negative integers");
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) fail("pagination value is out of range");
  return n;
}

function batchHashParam(value: string): string {
  if (!SHA256.test(value)) fail("invalid review batch id");
  return value.toLowerCase();
}

async function batchCounts(db: typeof sql | Tx, hash: string) {
  const [batch] = await db<{
    batch_hash: string; manifest_sha256: string; schema_version: string; candidate_count: number; imported_at: Date;
    pending_count: number; confirmed_count: number;
  }[]>`
    SELECT b.batch_hash, b.manifest_sha256, b.schema_version, b.candidate_count, b.imported_at,
      count(*) FILTER (WHERE c.human_status = 'needs_review')::int AS pending_count,
      count(*) FILTER (WHERE c.human_status = 'user_confirmed')::int AS confirmed_count
    FROM gold_review_batches b JOIN gold_review_cases c USING (batch_hash)
    WHERE b.batch_hash = ${hash}
    GROUP BY b.batch_hash`;
  return batch ?? null;
}

function batchDto(row: NonNullable<Awaited<ReturnType<typeof batchCounts>>>) {
  return {
    id: row.batch_hash,
    batchHash: row.batch_hash,
    manifestSha256: row.manifest_sha256,
    schemaVersion: row.schema_version,
    totalCount: row.candidate_count,
    pendingCount: row.pending_count,
    confirmedCount: row.confirmed_count,
    importedAt: row.imported_at.toISOString(),
  };
}

export async function listReviewBatches() {
  const rows = await sql<{ batch_hash: string; manifest_sha256: string; schema_version: string; candidate_count: number; imported_at: Date; pending_count: number; confirmed_count: number }[]>`
    SELECT b.batch_hash, b.manifest_sha256, b.schema_version, b.candidate_count, b.imported_at,
      count(*) FILTER (WHERE c.human_status = 'needs_review')::int AS pending_count,
      count(*) FILTER (WHERE c.human_status = 'user_confirmed')::int AS confirmed_count
    FROM gold_review_batches b JOIN gold_review_cases c USING (batch_hash)
    GROUP BY b.batch_hash ORDER BY b.imported_at DESC, b.batch_hash DESC LIMIT 100`;
  return { batches: rows.map(batchDto) };
}

export async function getReviewBatch(batchId: string, options: { status?: string; limit?: string; offset?: string } = {}) {
  const hash = batchHashParam(batchId);
  const status = options.status ?? "pending";
  if (status !== "pending" && status !== "confirmed" && status !== "all") fail("status must be pending, confirmed, or all");
  const limit = integer(options.limit, 25, 1, 25);
  const offset = integer(options.offset, 0, 0, 1_000_000);
  const batch = await batchCounts(sql, hash);
  if (!batch) return null;
  const filter = status === "all" ? null : status === "pending" ? "needs_review" : "user_confirmed";
  const [count] = await sql<{ total: number }[]>`SELECT count(*)::int AS total FROM gold_review_cases WHERE batch_hash = ${hash} AND (${filter}::text IS NULL OR human_status = ${filter})`;
  const rows = await sql<Record<string, unknown>[]>`
    SELECT case_id, content_hash, body_sha256, source_article_id, source_revision, candidate_metadata,
      body_zh_snapshot, body_original_snapshot, human_status, decision, confirmed_by, confirmed_at
    FROM gold_review_cases WHERE batch_hash = ${hash} AND (${filter}::text IS NULL OR human_status = ${filter})
    ORDER BY case_id LIMIT ${limit} OFFSET ${offset}`;
  return {
    batch: batchDto(batch),
    page: { status, limit, offset, total: count?.total ?? 0 },
    items: rows.map(neutralItem),
  };
}

function neutralItem(row: Record<string, unknown>) {
  const metadata = row.candidate_metadata as Record<string, unknown>;
  const material = (metadata.material ?? {}) as Record<string, unknown>;
  const evidence = (metadata.evidence ?? {}) as Record<string, unknown>;
  return {
    caseId: row.case_id,
    contentHash: row.content_hash,
    bodySha256: row.body_sha256,
    title: material.title ?? "",
    originalTitle: material.originalTitle ?? null,
    publishedAt: material.publishedAt ?? null,
    sourceName: material.sourceName ?? "",
    sourceId: evidence.sourceId ?? "",
    url: evidence.url ?? "",
    bodyStatus: evidence.bodyStatus ?? "",
    bodyZh: row.body_zh_snapshot || null,
    bodyOriginal: row.body_original_snapshot || null,
    humanAnnotation: {
      status: row.human_status,
      decision: row.decision,
      confirmedBy: row.confirmed_by,
      confirmedAt: row.confirmed_at instanceof Date ? row.confirmed_at.toISOString() : row.confirmed_at,
    },
  };
}

function requestInput(input: unknown): { batchHash: string; decision: ReviewDecision; items: { caseId: string; contentHash: string }[] } {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("request body must be an object");
  const record = input as Record<string, unknown>;
  if (typeof record.batchHash !== "string" || !SHA256.test(record.batchHash)) fail("batchHash must be a SHA-256 hex string");
  if (typeof record.decision !== "string" || !DECISIONS.has(record.decision as ReviewDecision)) fail("decision must be select, reject, or either");
  if (!Array.isArray(record.items) || record.items.length < 1 || record.items.length > 50) fail("items must contain between 1 and 50 checked candidates");
  const seen = new Set<string>();
  const items = record.items.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("each item must contain caseId and contentHash");
    const item = raw as Record<string, unknown>;
    if (typeof item.caseId !== "string" || !item.caseId.trim() || item.caseId.length > 200 || typeof item.contentHash !== "string" || !SHA256.test(item.contentHash)) fail("each item must contain a valid caseId and contentHash");
    if (seen.has(item.caseId)) fail(`duplicate caseId ${item.caseId}`);
    seen.add(item.caseId);
    return { caseId: item.caseId, contentHash: item.contentHash.toLowerCase() };
  });
  return { batchHash: record.batchHash.toLowerCase(), decision: record.decision as ReviewDecision, items };
}

async function ensureSourceSnapshot(tx: Tx, row: { source_article_id: string | null; source_revision: number | null; content_hash: string; case_id: string }) {
  if (!row.source_article_id || row.source_revision === null) return;
  const [article] = await tx<{ revision: number; content_hash: string | null }[]>`
    SELECT revision, content_hash FROM articles WHERE id = ${row.source_article_id} FOR SHARE`;
  if (!article || article.revision !== row.source_revision || article.content_hash?.toLowerCase() !== row.content_hash.toLowerCase()) {
    conflict(`candidate ${row.case_id} source revision changed; reload the batch`);
  }
}

export async function recordReviewDecisions(args: {
  batchId: string;
  input: unknown;
  requestId: string;
  actor: string;
}) {
  const batchId = batchHashParam(args.batchId);
  const parsed = requestInput(args.input);
  if (parsed.batchHash !== batchId) conflict("batchHash does not match route");
  if (!args.actor?.trim()) fail("actor is required");
  if (!/^[\w:.-]{1,128}$/.test(args.requestId)) fail("Idempotency-Key is required and must be at most 128 safe characters");
  const payloadSha256 = sha256(stable({ batchHash: parsed.batchHash, decision: parsed.decision, items: [...parsed.items].sort((a, b) => a.caseId.localeCompare(b.caseId)) }));

  return sql.begin(async (tx) => {
    const lockHash = sha256(stable([batchId, args.actor, args.requestId]));
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${lockHash}, 0))`;
    const [existing] = await tx<{ payload_sha256: string; response: Record<string, unknown> }[]>`
      SELECT payload_sha256, response FROM gold_review_idempotency
      WHERE batch_hash = ${batchId} AND actor = ${args.actor} AND request_id = ${args.requestId}`;
    if (existing) {
      if (existing.payload_sha256 !== payloadSha256) conflict("Idempotency-Key was already used for a different decision request");
      return { ...existing.response, replayed: true };
    }
    const [batch] = await tx`SELECT batch_hash FROM gold_review_batches WHERE batch_hash = ${batchId} FOR SHARE`;
    if (!batch) return null;
    const cases = await tx<{ case_id: string; content_hash: string; source_article_id: string | null; source_revision: number | null; human_status: string; decision: string | null; confirmed_by: string | null; confirmed_at: Date | null }[]>`
      SELECT case_id, content_hash, source_article_id, source_revision, human_status, decision, confirmed_by, confirmed_at
      FROM gold_review_cases WHERE batch_hash = ${batchId} AND case_id = ANY(${tx.array(parsed.items.map((item) => item.caseId), 25)})
      ORDER BY case_id FOR UPDATE`;
    if (cases.length !== parsed.items.length) conflict("one or more caseIds are not in this batch");
    const byId = new Map(cases.map((row) => [row.case_id, row]));
    for (const item of parsed.items) {
      const row = byId.get(item.caseId)!;
      if (row.content_hash.toLowerCase() !== item.contentHash) conflict(`candidate ${item.caseId} contentHash changed; reload the batch`);
      if (row.human_status !== "needs_review") conflict(`candidate ${item.caseId} is already confirmed; reload the batch`);
      await ensureSourceSnapshot(tx, row);
    }

    const now = new Date();
    const responseItems = [];
    for (const item of parsed.items) {
      const row = byId.get(item.caseId)!;
      const written = await tx`
        UPDATE gold_review_cases SET human_status = 'user_confirmed', decision = ${parsed.decision}, confirmed_by = ${args.actor}, confirmed_at = ${now}
        WHERE batch_hash = ${batchId} AND case_id = ${item.caseId} AND human_status = 'needs_review' AND content_hash = ${item.contentHash}
        RETURNING case_id, human_status, decision, confirmed_by, confirmed_at`;
      if (written.count !== 1) conflict(`candidate ${item.caseId} changed during confirmation`);
      const after = written[0]!;
      responseItems.push({ caseId: after.case_id, status: after.human_status, decision: after.decision, confirmedBy: after.confirmed_by, confirmedAt: (after.confirmed_at as Date).toISOString() });
      await tx`INSERT INTO audit_log (actor, action, subject, before, after, request_id)
        VALUES (${args.actor}, 'gold_review.decision', ${`gold-review:${batchId}:${item.caseId}`},
          ${tx.json({ status: "needs_review", decision: null, contentHash: item.contentHash })},
          ${tx.json({ status: "user_confirmed", decision: parsed.decision, contentHash: item.contentHash, confirmedAt: now.toISOString() })}, ${args.requestId})`;
    }
    const response = { batchId, batchHash: batchId, decision: parsed.decision, appliedCount: responseItems.length, replayed: false, items: responseItems };
    await tx`INSERT INTO gold_review_idempotency (batch_hash, actor, request_id, payload_sha256, response)
      VALUES (${batchId}, ${args.actor}, ${args.requestId}, ${payloadSha256}, ${tx.json(response)})`;
    return response;
  });
}

export async function exportReviewOverlay(batchId: string) {
  const hash = batchHashParam(batchId);
  const batch = await batchCounts(sql, hash);
  if (!batch) return null;
  const rows = await sql<{ case_id: string; content_hash: string; body_sha256: string; human_status: string; decision: string | null; confirmed_by: string | null; confirmed_at: Date | null }[]>`
    SELECT case_id, content_hash, body_sha256, human_status, decision, confirmed_by, confirmed_at
    FROM gold_review_cases WHERE batch_hash = ${hash} ORDER BY case_id`;
  return {
    format: "gold-review-annotation-overlay/v1",
    batchHash: hash,
    manifestSha256: batch.manifest_sha256,
    schemaVersion: batch.schema_version,
    items: rows.map((row) => ({
      caseId: row.case_id,
      contentHash: row.content_hash,
      bodySha256: row.body_sha256,
      status: row.human_status,
      decision: row.decision,
      confirmedBy: row.confirmed_by,
      confirmedAt: row.confirmed_at?.toISOString() ?? null,
    })),
  };
}
