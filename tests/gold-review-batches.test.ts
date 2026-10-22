import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { after, before, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { importReviewBatch } from "@aihot/backend/admin/review-batches";
import { sha256 } from "@aihot/backend/lib/ids";
import { SESSION_COOKIE } from "@aihot/backend/admin/auth";
import { buildApp } from "../apps/api/src/app.ts";
import { tag } from "./setup.ts";

const T = tag();
const app = await buildApp();
const userName = `gold-review-test-${T}`;
let actor = "";
const csrf = `csrf-${T}`;
const token = randomBytes(32).toString("base64url");
const email = `${userName}@example.invalid`;
const bodyText = `Frozen private body for review ${T}. `.repeat(8);
const contentHash = createHash("sha256").update(`content-${T}`).digest("hex");
const contentHashB = createHash("sha256").update(`content-b-${T}`).digest("hex");
const bodySha256 = createHash("sha256").update(bodyText).digest("hex");
const cases = [
  { caseId: `case-a-${T}`, contentHash, bodySha256, sourceArticleId: null, sourceRevision: null, candidateMetadata: { material: { title: "Neutral title", originalTitle: null, publishedAt: "2026-10-01T00:00:00.000Z", sourceName: "Fixture", bodyZh: null, bodyOriginal: null }, evidence: { sourceId: "fixture", url: "https://example.invalid/a", bodyStatus: "ok", contentHash, bodySha256 }, proposal: { decision: "reject", rationale: "must remain private" }, samplingContext: { benchmarkSplit: "holdout" } }, bodyZhSnapshot: bodyText, bodyOriginalSnapshot: "", humanAnnotation: { status: "needs_review" as const, decision: null, confirmedBy: null, confirmedAt: null } },
  { caseId: `case-b-${T}`, contentHash: contentHashB, bodySha256, sourceArticleId: null, sourceRevision: null, candidateMetadata: { material: { title: "Second title", originalTitle: null, publishedAt: null, sourceName: "Fixture", bodyZh: null, bodyOriginal: null }, evidence: { sourceId: "fixture", url: "https://example.invalid/b", bodyStatus: "ok", contentHash: contentHashB, bodySha256 }, proposal: { decision: "select", rationale: "hidden" } }, bodyZhSnapshot: bodyText, bodyOriginalSnapshot: "", humanAnnotation: { status: "needs_review" as const, decision: null, confirmedBy: null, confirmedAt: null } },
];

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => `${JSON.stringify(key)}:${stable(nested)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
function batchInputFor(batchCandidates: typeof cases, label: string) {
  const base = { manifestSha256: createHash("sha256").update(`manifest-${label}-${T}`).digest("hex"), schemaVersion: "p5.gold-metadata-draft/v1", manifestMeta: { seedIds: [] }, candidates: batchCandidates };
  const batchHash = createHash("sha256").update(stable({ ...base, manifestSha256: base.manifestSha256, candidates: [...batchCandidates].sort((a, b) => a.caseId.localeCompare(b.caseId)) })).digest("hex");
  return { ...base, batchHash };
}
const input = batchInputFor(cases, "two");
const bulkCases = Array.from({ length: 50 }, (_, index) => {
  const candidate = structuredClone(cases[0]!);
  const id = `bulk-${String(index).padStart(2, "0")}-${T}`;
  const hash = createHash("sha256").update(`bulk-content-${index}-${T}`).digest("hex");
  candidate.caseId = id;
  candidate.contentHash = hash;
  candidate.candidateMetadata.material.title = `Bulk fixture ${index}`;
  candidate.candidateMetadata.evidence.url = `https://example.invalid/bulk/${index}`;
  candidate.candidateMetadata.evidence.contentHash = hash;
  return candidate;
});
const bulkInput = batchInputFor(bulkCases, "fifty");
const cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}`;
const adminHeaders = { cookie, "x-csrf-token": csrf, "content-type": "application/json" };

before(async () => {
  await sql`INSERT INTO admin_users (email, display_name) VALUES (${email}, ${userName})`;
  const [user] = await sql<{ id: number }[]>`SELECT id FROM admin_users WHERE email = ${email}`;
  actor = `admin:${user!.id}`;
  await sql`INSERT INTO admin_sessions (id_hash, user_id, csrf_token, expires_at) VALUES (${sha256(token)}, ${user!.id}, ${csrf}, now() + interval '1 hour')`;
});

after(async () => {
  await sql`DELETE FROM gold_review_batches WHERE batch_hash = ${input.batchHash}`;
  await sql`DELETE FROM gold_review_batches WHERE batch_hash = ${bulkInput.batchHash}`;
  await sql`DELETE FROM audit_log WHERE actor = ${actor} OR subject LIKE ${`gold-review:${input.batchHash}%`}`;
  await sql`DELETE FROM admin_sessions WHERE id_hash = ${sha256(token)}`;
  await sql`DELETE FROM admin_users WHERE email = ${email}`;
  await app.close();
  await closeDb();
});

test("private review queue requires admin auth and CSRF for decisions", async () => {
  const noAuth = await app.inject({ method: "GET", url: `/api/admin/review-batches/${input.batchHash}` });
  assert.equal(noAuth.statusCode, 401);
  const noCsrf = await app.inject({ method: "POST", url: `/api/admin/review-batches/${input.batchHash}/decisions`, headers: { cookie }, payload: {} });
  assert.equal(noCsrf.statusCode, 403);
});

test("frozen batch import is idempotent and queue exposes only neutral fields", async () => {
  assert.deepEqual(await importReviewBatch(input, actor), { batchHash: input.batchHash, importedCount: 2, alreadyImported: false });
  assert.deepEqual(await importReviewBatch(input, actor), { batchHash: input.batchHash, importedCount: 2, alreadyImported: true });
  const response = await app.inject({ method: "GET", url: `/api/admin/review-batches/${input.batchHash}?status=pending&limit=25&offset=0`, headers: { cookie } });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.batch.pendingCount, 2);
  assert.equal(payload.page.total, 2);
  assert.equal(payload.items[0].bodyZh, bodyText);
  assert.equal(payload.items[0].humanAnnotation.status, "needs_review");
  assert.equal("proposal" in payload.items[0], false);
  assert.equal("samplingContext" in payload.items[0], false);
  assert.equal("candidateMetadata" in payload.items[0], false);
  const oversizedPage = await app.inject({ method: "GET", url: `/api/admin/review-batches/${input.batchHash}?limit=26`, headers: { cookie } });
  assert.equal(oversizedPage.statusCode, 400);
  const exported = await app.inject({ method: "GET", url: `/api/admin/review-batches/${input.batchHash}/export`, headers: { cookie } });
  assert.equal(exported.statusCode, 200);
  assert.match(exported.headers["content-disposition"] ?? "", /attachment; filename="gold-review-/);
  assert.equal(exported.json().format, "gold-review-annotation-overlay/v1");
  assert.equal("bodyZh" in exported.json().items[0], false);
  assert.equal("proposal" in exported.json().items[0], false);
});

test("unchecked candidates stay pending; selected decisions are atomic, auditable and idempotent", async () => {
  const beforeCounts = await sql`
    SELECT (SELECT count(*)::int FROM articles) AS articles,
      (SELECT count(*)::int FROM publications) AS publications,
      (SELECT count(*)::int FROM analyses) AS analyses,
      (SELECT count(*)::int FROM receipts) AS receipts,
      (SELECT count(*)::int FROM job_runs) AS job_runs`;
  const selected = cases[0]!;
  const decision = { batchHash: input.batchHash, decision: "either", items: [{ caseId: selected.caseId, contentHash: selected.contentHash }] };
  const result = await app.inject({ method: "POST", url: `/api/admin/review-batches/${input.batchHash}/decisions`, headers: { ...adminHeaders, "idempotency-key": `decision-${T}` }, payload: decision });
  assert.equal(result.statusCode, 200, result.body);
  assert.equal(result.json().appliedCount, 1);
  assert.equal(result.json().replayed, false);
  const replay = await app.inject({ method: "POST", url: `/api/admin/review-batches/${input.batchHash}/decisions`, headers: { ...adminHeaders, "idempotency-key": `decision-${T}` }, payload: decision });
  assert.equal(replay.statusCode, 200, replay.body);
  assert.equal(replay.json().replayed, true);
  const pending = await app.inject({ method: "GET", url: `/api/admin/review-batches/${input.batchHash}?status=pending`, headers: { cookie } });
  const confirmed = await app.inject({ method: "GET", url: `/api/admin/review-batches/${input.batchHash}?status=confirmed`, headers: { cookie } });
  assert.equal(pending.json().items.length, 1);
  assert.equal(pending.json().items[0].caseId, cases[1]!.caseId);
  assert.equal(confirmed.json().items.length, 1);
  assert.equal(confirmed.json().items[0].humanAnnotation.decision, "either");
  const audit = await sql`SELECT count(*)::int AS count FROM audit_log WHERE actor = ${actor} AND action = 'gold_review.decision'`;
  assert.equal(audit[0]!.count, 1);
  const afterCounts = await sql`
    SELECT (SELECT count(*)::int FROM articles) AS articles,
      (SELECT count(*)::int FROM publications) AS publications,
      (SELECT count(*)::int FROM analyses) AS analyses,
      (SELECT count(*)::int FROM receipts) AS receipts,
      (SELECT count(*)::int FROM job_runs) AS job_runs`;
  assert.deepEqual(afterCounts[0], beforeCounts[0]);
});

test("CAS, idempotency-key conflicts, and the 50-item cap fail closed", async () => {
  const atomicFailure = await app.inject({ method: "POST", url: `/api/admin/review-batches/${input.batchHash}/decisions`, headers: { ...adminHeaders, "idempotency-key": `atomic-${T}` }, payload: { batchHash: input.batchHash, decision: "reject", items: [
    { caseId: cases[1]!.caseId, contentHash: cases[1]!.contentHash },
    { caseId: cases[0]!.caseId, contentHash: cases[0]!.contentHash },
  ] } });
  assert.equal(atomicFailure.statusCode, 409);
  const stillPending = await app.inject({ method: "GET", url: `/api/admin/review-batches/${input.batchHash}?status=pending`, headers: { cookie } });
  assert.deepEqual(stillPending.json().items.map((item: { caseId: string }) => item.caseId), [cases[1]!.caseId]);
  const selected = cases[1]!;
  const stale = await app.inject({ method: "POST", url: `/api/admin/review-batches/${input.batchHash}/decisions`, headers: { ...adminHeaders, "idempotency-key": `stale-${T}` }, payload: { batchHash: input.batchHash, decision: "reject", items: [{ caseId: selected.caseId, contentHash: "0".repeat(64) }] } });
  assert.equal(stale.statusCode, 409);
  const request = { batchHash: input.batchHash, decision: "reject", items: [{ caseId: selected.caseId, contentHash: selected.contentHash }] };
  const first = await app.inject({ method: "POST", url: `/api/admin/review-batches/${input.batchHash}/decisions`, headers: { ...adminHeaders, "idempotency-key": `conflict-${T}` }, payload: request });
  assert.equal(first.statusCode, 200);
  const different = await app.inject({ method: "POST", url: `/api/admin/review-batches/${input.batchHash}/decisions`, headers: { ...adminHeaders, "idempotency-key": `conflict-${T}` }, payload: { ...request, decision: "select" } });
  assert.equal(different.statusCode, 409);
  const tooMany = await app.inject({ method: "POST", url: `/api/admin/review-batches/${input.batchHash}/decisions`, headers: { ...adminHeaders, "idempotency-key": `too-many-${T}` }, payload: { batchHash: input.batchHash, decision: "select", items: Array.from({ length: 51 }, (_, index) => ({ caseId: `x${index}`, contentHash: contentHash })) } });
  assert.equal(tooMany.statusCode, 400);
});

test("accepts exactly 50 explicit decisions in one request", async () => {
  await importReviewBatch(bulkInput, actor);
  const result = await app.inject({ method: "POST", url: `/api/admin/review-batches/${bulkInput.batchHash}/decisions`, headers: { ...adminHeaders, "idempotency-key": `fifty-${T}` }, payload: { batchHash: bulkInput.batchHash, decision: "select", items: bulkCases.map(({ caseId, contentHash }) => ({ caseId, contentHash })) } });
  assert.equal(result.statusCode, 200, result.body);
  assert.equal(result.json().appliedCount, 50);
  const counts = await sql`SELECT count(*) FILTER (WHERE human_status = 'user_confirmed')::int AS confirmed, count(*) FILTER (WHERE human_status = 'needs_review')::int AS pending FROM gold_review_cases WHERE batch_hash = ${bulkInput.batchHash}`;
  assert.deepEqual(counts[0], { confirmed: 50, pending: 0 });
});
