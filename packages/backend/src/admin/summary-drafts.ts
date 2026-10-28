// Private local-model summary drafts. Nothing is public until an administrator reviews a frozen
// draft and the exact source row still matches the one that produced it.
import { createHash } from "node:crypto";
import { link, lstat, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CATEGORY_KEYS } from "@aihot/contracts/taxonomy";
import { config } from "../config.ts";
import { sql } from "../db.ts";
import { sha256, stableJson } from "../lib/ids.ts";
import { publishArticleTx } from "../publication/publish.ts";

const ID = /^[a-f0-9]{64}$/u;
const FORMAT = "summary-draft.v1";
const PROVIDER_MODEL = z.string().trim().min(1).max(160);
const ROOT = path.join(config.dataDir, "summary-drafts");

export const SummaryDraftSchema = z.object({
  format: z.literal(FORMAT), draftId: z.string().regex(ID), runId: z.string().min(8).max(80),
  createdAt: z.string().datetime(),
  article: z.object({ articleId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/u), sourceId: z.string(), sourceName: z.string(),
    url: z.string().url(), title: z.string(), publishedAt: z.string().datetime().nullable(), revision: z.number().int().positive(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/u), bodyText: z.string().min(1), bodySha256: z.string().regex(/^[a-f0-9]{64}$/u),
    articleRowSha256: z.string().regex(/^[a-f0-9]{64}$/u), sourceRowSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  }).strict(),
  prompt: z.object({ model: z.literal("default"), providerModel: PROVIDER_MODEL, promptVersion: z.string().min(1),
    system: z.string(), user: z.string().min(1), systemSha256: z.string().regex(/^[a-f0-9]{64}$/u), userSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  }).strict(),
  databaseExpectations: z.object({ analysisCount: z.literal(0), overrideRowSha256: z.null(), publicationRowSha256: z.null(),
    sourceEnabled: z.literal(false), sourceSiteFulltext: z.literal(false), sourceSyndicateFulltext: z.literal(false),
  }).strict(),
  output: z.object({ titleZh: z.string().min(1).max(300), summaryZh: z.string().min(1).max(2000), selected: z.literal(false),
    score: z.null(), reason: z.null(), category: z.enum(CATEGORY_KEYS as unknown as [string, ...string[]]).nullable(), tags: z.array(z.string().max(60)).max(20),
  }).strict(),
  provider: z.object({ receiptId: z.number().int().positive(), service: z.literal("llm"), model: PROVIDER_MODEL,
    purpose: z.literal("summary-draft"), attempts: z.literal(1), status: z.literal("completed"),
  }).strict(),
}).strict().refine((draft) => draft.prompt.providerModel === draft.provider.model, {
  path: ["provider", "model"], message: "provider model must match the model recorded in the prompt provenance",
});
export type SummaryDraft = z.infer<typeof SummaryDraftSchema>;

export function stableDraftJson(value: unknown): string { return stableJson(value); }
export function summaryDraftId(input: { articleId: string; revision: number; bodySha256: string; promptVersion: string; userSha256: string; model: string }): string {
  return sha256(stableJson(input));
}

function fileFor(id: string) {
  if (!ID.test(id)) throw Object.assign(new Error("invalid draft id"), { statusCode: 404 });
  return path.join(ROOT, `${id}.json`);
}

export async function writeSummaryDraft(draft: SummaryDraft): Promise<{ draftSha256: string; path: string }> {
  const parsed = SummaryDraftSchema.parse(draft);
  const bytes = Buffer.from(`${stableJson(parsed)}\n`, "utf8");
  const directory = path.resolve(ROOT);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink() || (process.platform !== "win32" && (info.mode & 0o077) !== 0)) throw new Error("summary draft directory is unsafe");
  const target = fileFor(parsed.draftId);
  const temp = path.join(directory, `.${parsed.draftId}.${process.pid}.${createHash("sha256").update(bytes).digest("hex").slice(0, 12)}.tmp`);
  try {
    await writeFile(temp, bytes, { flag: "wx", mode: 0o600 });
    await link(temp, target); // atomic create-if-absent; never replace a previous draft
    return { draftSha256: sha256(bytes), path: target };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw Object.assign(new Error("draft already exists; refusing to repeat provider work"), { statusCode: 409 });
    throw error;
  } finally { await unlink(temp).catch(() => undefined); }
}

async function readSummaryDraft(id: string): Promise<{ draft: SummaryDraft; draftSha256: string }> {
  await mkdir(ROOT, { recursive: true, mode: 0o700 });
  const directory = await lstat(ROOT);
  if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error("summary draft directory is unsafe");
  const file = fileFor(id);
  const stat = await lstat(file).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink() || (process.platform !== "win32" && (stat.mode & 0o077) !== 0) ||
      (process.platform !== "win32" && (directory.mode & 0o077) !== 0)) throw Object.assign(new Error("summary draft not found or private permissions are unsafe"), { statusCode: 404 });
  const bytes = await readFile(file);
  const draft = SummaryDraftSchema.parse(JSON.parse(bytes.toString("utf8")));
  if (draft.draftId !== id || summaryDraftId({ articleId: draft.article.articleId, revision: draft.article.revision,
      bodySha256: draft.article.bodySha256, promptVersion: draft.prompt.promptVersion, userSha256: draft.prompt.userSha256,
      model: draft.provider.model }) !== id) throw new Error("draft filename/content identity differs");
  return { draft, draftSha256: sha256(bytes) };
}

async function latestReviewState(id: string) {
  const [row] = await sql<{ action: string; after: Record<string, unknown> | null; actor: string; created_at: Date }[]>`
    SELECT action, after, actor, created_at FROM audit_log WHERE subject=${`summary-draft:${id}`} AND action IN ('summary_draft.approved','summary_draft.rejected')
    ORDER BY created_at DESC, id DESC LIMIT 1`;
  return row ? { status: row.action === "summary_draft.approved" ? "approved" as const : "rejected" as const,
    reviewer: row.actor, reviewedAt: row.created_at.toISOString(), after: row.after } : { status: "pending" as const, reviewer: null, reviewedAt: null, after: null };
}

export async function listSummaryDrafts(input: { status?: string; limit?: string | number; offset?: string | number } = {}) {
  const status = input.status ?? "pending";
  if (!(["pending", "approved", "rejected", "all"] as string[]).includes(status)) throw Object.assign(new Error("invalid summary draft status"), { statusCode: 400 });
  const limit = Math.min(25, Math.max(1, Number(input.limit) || 25));
  const offset = Math.max(0, Number(input.offset) || 0);
  await mkdir(ROOT, { recursive: true, mode: 0o700 });
  const names = (await readdir(ROOT)).filter((name) => ID.test(name.replace(/\.json$/u, "")) && name.endsWith(".json")).sort();
  const rows = [];
  for (const name of names) {
    const id = name.slice(0, -5);
    try {
      const { draft, draftSha256 } = await readSummaryDraft(id);
      const review = await latestReviewState(id);
      if (status !== "all" && status !== review.status) continue;
      rows.push({ draftId: id, draftSha256, createdAt: draft.createdAt, status: review.status, reviewer: review.reviewer,
        reviewedAt: review.reviewedAt, sourceName: draft.article.sourceName, title: draft.article.title, publishedAt: draft.article.publishedAt,
        url: draft.article.url, bodyText: draft.article.bodyText, bodySha256: draft.article.bodySha256, model: draft.provider.model, promptVersion: draft.prompt.promptVersion,
        summaryZh: draft.output.summaryZh, titleZh: draft.output.titleZh, category: draft.output.category, tags: draft.output.tags,
        receiptIds: [draft.provider.receiptId] });
    } catch { /* malformed or half-written private artifacts never enter the review queue */ }
  }
  return { total: rows.length, limit, offset, items: rows.slice(offset, offset + limit) };
}

export async function getSummaryDraft(id: string) {
  const { draft, draftSha256 } = await readSummaryDraft(id);
  const review = await latestReviewState(id);
  return { ...draft, draftSha256, status: review.status, reviewer: review.reviewer, reviewedAt: review.reviewedAt };
}

const ReviewInput = z.object({ items: z.array(z.object({ draftId: z.string().regex(ID), decision: z.enum(["approve", "reject"]), expectedDraftSha256: z.string().regex(ID) }).strict()).min(1).max(25) }).strict();

export async function reviewSummaryDrafts(args: { input: unknown; requestId: string; actor: string }) {
  const validation = ReviewInput.safeParse(args.input);
  if (!validation.success) throw Object.assign(new Error("invalid summary review payload"), { statusCode: 400 });
  const parsed = validation.data;
  if (new Set(parsed.items.map((item) => item.draftId)).size !== parsed.items.length) throw Object.assign(new Error("duplicate draft IDs"), { statusCode: 400 });
  if (!/^[\w:.-]{1,128}$/u.test(args.requestId)) throw Object.assign(new Error("Idempotency-Key is required"), { statusCode: 400 });
  if (!args.actor.trim()) throw Object.assign(new Error("admin actor is required"), { statusCode: 400 });
  const payloadSha = sha256(stableJson({ items: [...parsed.items].sort((a, b) => a.draftId.localeCompare(b.draftId)) }));
  const lockKey = sha256(stableJson([args.actor, args.requestId]));
  const results: Array<{ draftId: string; status: string; decision?: string; error?: string; replayed?: boolean }> = [];
  for (const item of parsed.items) {
    try {
      const itemResult = await sql.begin(async (tx) => {
        await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;
        await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`summary-draft-request:${lockKey}`},0))`;
        const requestSubject = `summary-draft-request:${args.requestId}:${item.draftId}`;
        const [sameRequest] = await tx<{ after: Record<string, any> }[]>`SELECT after FROM audit_log WHERE actor=${args.actor} AND request_id=${args.requestId} AND action='summary_draft.review_item_request' ORDER BY id DESC LIMIT 1`;
        if (sameRequest && sameRequest.after?.payloadSha256 !== payloadSha) throw Object.assign(new Error("Idempotency-Key reused for different review items"), { statusCode: 409 });
        const [priorRequest] = await tx<{ after: Record<string, any> }[]>`SELECT after FROM audit_log WHERE actor=${args.actor} AND request_id=${args.requestId} AND action='summary_draft.review_item_request' AND subject=${requestSubject} ORDER BY id DESC LIMIT 1`;
        if (priorRequest) {
          const prior = priorRequest.after;
          if (prior?.payloadSha256 !== payloadSha) throw Object.assign(new Error("Idempotency-Key reused for different review items"), { statusCode: 409 });
          return { ...prior.response, replayed: true };
        }
        const recordResult = async (response: { draftId: string; status: string; decision?: string; error?: string }) => {
          await tx`INSERT INTO audit_log (actor,action,subject,after,request_id) VALUES (${args.actor},'summary_draft.review_item_request',${requestSubject},
            ${tx.json({ payloadSha256: payloadSha, response } as never)},${args.requestId})`;
          return response;
        };
        let draft: SummaryDraft;
        let draftSha256: string;
        try {
          const read = await readSummaryDraft(item.draftId);
          draft = read.draft; draftSha256 = read.draftSha256;
        } catch { return recordResult({ draftId: item.draftId, status: "failed", error: "draft unavailable" }); }
        if (draftSha256 !== item.expectedDraftSha256) return recordResult({ draftId: item.draftId, status: "failed", error: "draft changed; reload" });
        await tx`SELECT pg_advisory_xact_lock(hashtextextended(${"summary-draft:" + item.draftId},0))`;
      const [receipt] = await tx<{ id: number; service: string; model: string; purpose: string; subject: string; status: string; attempts: number; request: Record<string, unknown> }[]>`
        SELECT id, service, model, purpose, subject, status, attempts, request FROM receipts WHERE id=${draft.provider.receiptId} FOR SHARE`;
      const receiptAttemptRows = await tx<{ status: string; attempt: number }[]>`SELECT status,attempt FROM receipt_attempts WHERE receipt_id=${draft.provider.receiptId} ORDER BY attempt`;
      const safeRequest = receipt?.request ?? {};
      if (!receipt || receipt.service !== "llm" || receipt.model !== draft.provider.model || receipt.purpose !== "summary-draft" ||
          receipt.subject !== draft.draftId || receipt.status !== "completed" || receipt.attempts !== 1 || receiptAttemptRows.length !== 1 ||
          receiptAttemptRows[0]?.status !== "received" || safeRequest.promptVersion !== draft.prompt.promptVersion ||
          safeRequest.systemHash !== draft.prompt.systemSha256 || safeRequest.userHash !== draft.prompt.userSha256) {
        return recordResult({ draftId: item.draftId, status: "failed", error: "provider receipt evidence mismatch" });
      }
      const [prior] = await tx<{ action: string }[]>`SELECT action FROM audit_log WHERE subject=${`summary-draft:${item.draftId}`} AND action IN ('summary_draft.approved','summary_draft.rejected') ORDER BY created_at DESC,id DESC LIMIT 1`;
      if (prior) return recordResult({ draftId: item.draftId, status: "already_reviewed" });
      let before: unknown = null;
      if (item.decision === "approve") {
        const [current] = await tx<{ article_row_text: string; source_row_text: string; article: any; source: any; analysis_count: number; override_row_text: string | null; publication_row_text: string | null }[]>`
          SELECT to_jsonb(a)::text AS article_row_text,to_jsonb(s)::text AS source_row_text,to_jsonb(a) AS article,to_jsonb(s) AS source,
            (SELECT count(*)::int FROM analyses an WHERE an.article_id=a.id) AS analysis_count,
            (SELECT to_jsonb(o)::text FROM editorial_overrides o WHERE o.article_id=a.id) AS override_row_text,
            (SELECT to_jsonb(p)::text FROM publications p WHERE p.article_id=a.id) AS publication_row_text
          FROM articles a JOIN sources s ON s.id=a.source_id WHERE a.id=${draft.article.articleId} FOR UPDATE OF a,s`;
        if (!current || sha256(current.article_row_text) !== draft.article.articleRowSha256 || sha256(current.source_row_text) !== draft.article.sourceRowSha256 ||
            current.article.revision !== draft.article.revision || current.article.body_status !== "ok" || current.article.body_text !== draft.article.bodyText ||
            sha256(current.article.body_text) !== draft.article.bodySha256 || current.source.enabled !== false || current.source.site_fulltext !== false ||
            current.source.syndicate_fulltext !== draft.databaseExpectations.sourceSyndicateFulltext ||
            current.source.enabled !== draft.databaseExpectations.sourceEnabled || current.source.site_fulltext !== draft.databaseExpectations.sourceSiteFulltext ||
            current.analysis_count !== draft.databaseExpectations.analysisCount || current.override_row_text !== draft.databaseExpectations.overrideRowSha256 ||
            current.publication_row_text !== draft.databaseExpectations.publicationRowSha256 ||
            current.source.participation_mode !== "editorial" || current.source.first_party !== true) {
          return recordResult({ draftId: item.draftId, status: "failed", error: "article/source changed; reload" });
        }
        before = { revision: current.article.revision, bodySha256: draft.article.bodySha256, publication: null, override: null };
        const fields = { title: draft.output.titleZh, summary: draft.output.summaryZh, relevance: "pass", category: draft.output.category,
          tags: draft.output.tags, selected: false, score: null, reason: null };
        await tx`INSERT INTO editorial_overrides (article_id,fields,visibility,reason,version,updated_by)
          VALUES (${draft.article.articleId},${tx.json(fields)},'public',${"approved local summary draft " + draft.draftId},1,${args.actor})`;
        const published = await publishArticleTx(tx, draft.article.articleId, { now: new Date() });
        if (!published || published.visibility !== "public" || published.selected !== false) throw new Error("canonical summary-draft publication invariant failed");
        const [projection] = await tx<{ visibility: string; body_mode: string; eligible: boolean; selected: boolean; score: number | null; reason: string | null; indexable: boolean; syndicate: boolean }[]>`
          SELECT visibility,body_mode,eligible,selected,score,reason,indexable,syndicate FROM publications WHERE article_id=${draft.article.articleId}`;
        if (!projection || projection.visibility !== "public" || projection.body_mode !== "summary" || !projection.eligible || projection.selected !== false || projection.score !== null ||
            projection.reason !== null || projection.indexable !== false || projection.syndicate !== false) {
          throw new Error("summary-draft public summary projection invariant failed");
        }
      }
      const action = item.decision === "approve" ? "summary_draft.approved" : "summary_draft.rejected";
      await tx`INSERT INTO audit_log (actor,action,subject,reason,before,after,request_id)
        VALUES (${args.actor},${action},${`summary-draft:${item.draftId}`},${"manual summary draft review"},
          ${before === null ? null : tx.json(before as never)},${tx.json({ draftId: item.draftId, draftSha256, decision: item.decision,
            receiptId: draft.provider.receiptId, selected: false, visibility: item.decision === "approve" ? "public" : null,
            bodyMode: item.decision === "approve" ? "summary" : null,
            payloadSha256: payloadSha, requestId: args.requestId })},${args.requestId})`;
        return recordResult({ draftId: item.draftId, status: item.decision === "approve" ? "approved" : "rejected", decision: item.decision });
      });
      results.push(itemResult);
    } catch (error) {
      const reason = (error as { statusCode?: number }).statusCode === 409 ? "conflict; reload and inspect the draft" : "review failed";
      const failed = { draftId: item.draftId, status: "failed", error: reason };
      if ((error as { statusCode?: number }).statusCode !== 409) {
        await sql.begin(async (tx) => {
          await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`summary-draft-request:${lockKey}`},0))`;
          const requestSubject = `summary-draft-request:${args.requestId}:${item.draftId}`;
          const [prior] = await tx`SELECT id FROM audit_log WHERE actor=${args.actor} AND request_id=${args.requestId} AND action='summary_draft.review_item_request' AND subject=${requestSubject} LIMIT 1`;
          if (!prior) await tx`INSERT INTO audit_log (actor,action,subject,after,request_id) VALUES (${args.actor},'summary_draft.review_item_request',${requestSubject},
            ${tx.json({ payloadSha256: payloadSha, response: failed } as never)},${args.requestId})`;
        });
      }
      results.push(failed);
    }
  }
  return { appliedCount: results.filter((item) => ["approved", "rejected"].includes(item.status)).length,
    failedCount: results.filter((item) => ["failed", "already_reviewed"].includes(item.status)).length, replayed: results.every((item) => item.replayed === true), items: results };
}
