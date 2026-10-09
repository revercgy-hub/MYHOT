// Collection run for one source: fetch listing → filter → store material → enqueue processing.
// A failed fetch never advances the success cursor; the source's health reflects consecutive failures.
import { sql, type Tx } from "../db.ts";
import { decideTimeline, identityKeyFor, upsertMaterial } from "../content/materials.ts";
import { sha256, stableJson } from "../lib/ids.ts";
import { enqueue, QUEUES } from "../jobs/queue.ts";
import { queueProcessing } from "../jobs/content.ts";
import { BudgetExceededError } from "../providers/receipts.ts";
import { fetchRss } from "./rss.ts";
import { allowed, fetchDetail, fetchWebList, type DetailNeed } from "./web-list.ts";
import { unsupportedConfig } from "./config-keys.ts";
import { collectWebListBackfill, usesWebListPagination } from "./web-list-pagination.ts";
import { fetchGovcnJsonPage, fetchJsonList } from "./json-list.ts";
import { createGovcnJsonPaginationBudget, govcnCandidateInWindow, govcnJsonResumeConfigHash, isGovcnJsonPaginationSource, isGovcnJsonResumeCursor, isGovcnJsonResumeSource, newGovcnJsonResumeCursor, readGovcnJsonPagination, readGovcnJsonPages, GOVCN_JSON_RESUME_CURSOR_KEY, GOVCN_JSON_RESUME_MAX_PAGE, type GovcnJsonPaginationBudget, type GovcnJsonResumeCursor } from "./json-list-pagination.ts";
import { fetchXSearch, planXShards, readXSearch, shardHandle, shardQuery, SHARDABLE_SQL, tweetToCandidate, type XBacklog, type XRead } from "./x.ts";
import { FetchError, type Candidate, type SourceRow } from "./types.ts";
import { createNfraJsonRunBudget, nfraConfigIsSupported } from "../content/nfra-json-detail.ts";

export interface CollectResult {
  sourceId: string;
  status: "ok" | "failed" | "skipped";
  found: number;
  created: number;
  revised: number;
  error?: string;
}

const MAX_ITEMS_PER_RUN = 60;
const GOVCN_RESUME_DAY_MS = 86_400_000;

export function noiseFiltered(c: Candidate, source: SourceRow): boolean {
  const f = source.config.ingestNoiseFilter;
  const cats: string[] = c.categories ?? [];
  if (source.config.denyCategories?.some((d: string) => cats.includes(d))) return true;
  if (source.config.allowCategories?.length && !source.config.allowCategories.some((a: string) => cats.includes(a))) return true;
  if (!f) return false;
  // Case-insensitive: the exemption "agent" keeps "Agent" (words in the lists are lower case).
  const has = (text: string, words: string[] | undefined) => (words ?? []).some((k) => text.includes(k.toLowerCase()));
  const title = c.title.toLowerCase();
  const hay = `${title}\n${(c.excerpt ?? "").toLowerCase()}`;
  if (has(hay, f.keepIfMatches)) return false;
  return has(title, f.dropMarkersTitleOnly) || has(hay, f.dropMarkers);
}

function rewriteUrl(c: Candidate, source: SourceRow): Candidate {
  const rw = source.config.itemUrlPrefixRewrite;
  if (rw?.from && rw?.to && c.url.startsWith(rw.from)) return { ...c, url: rw.to + c.url.slice(rw.from.length) };
  return c;
}

async function loadSource(id: string): Promise<SourceRow | null> {
  const [s] = await sql<SourceRow[]>`
    SELECT id, name, kind, config, tier, participation_mode, first_party, interval_minutes, enabled, cursor, fail_count
    FROM sources WHERE id = ${id}`;
  return s ?? null;
}

/** Titles of the articles already stored under these URLs. */
async function storedTitles(urls: string[]): Promise<Map<string, string>> {
  if (urls.length === 0) return new Map();
  const rows = await sql<{ url: string; title: string }[]>`SELECT url, title FROM articles WHERE url IN ${sql(urls)}`;
  return new Map(rows.map((r) => [r.url, r.title]));
}

const DAY_MS = 86_400_000;
/** A listing title that is no headline: a label that swallowed its summary, or a call to action. */
const needsTitle = (title: string) => title.length > 100 || /^(read more|learn more|continue reading|more|阅读全文|阅读更多|查看详情|了解更多)$/i.test(title.trim());

async function store(sourceId: string, candidates: Candidate[], backfill: string | null): Promise<{ created: number; revised: number }> {
  let created = 0;
  let revised = 0;
  const seen = new Set<string>();
  for (const c of candidates) {
    const material = { ...c, sourceId, via: "fetch" as const, backfill };
    // A listing that names one article twice (a featured card and its list entry, a feed repeating an
    // item) stores its first entry only; the later ones would otherwise revise it on every fetch.
    const key = identityKeyFor(material);
    if (seen.has(key)) continue;
    seen.add(key);
    const res = await upsertMaterial(material);
    if (res.created) created += 1;
    if (res.revised) revised += 1;
    // Extraction first when the source wants full text and none came with the listing, else analysis.
    if (res.created || res.revised) await queueProcessing(res.articleId);
  }
  return { created, revised };
}

type GovcnResumeWorkItem = { candidate: Candidate; backfill: "first-import" | null };
type GovcnResumeTxCounts = { created: number; revised: number };

function govcnResumeWindow(candidate: Candidate, anchorAt: Date, cutoffAt: Date): { candidate: Candidate | null; undated: number; outside: number } {
  const claimed = candidate.publishedAt instanceof Date ? candidate.publishedAt : null;
  const trusted = decideTimeline(claimed, anchorAt, "first-import").publishedAt;
  if (!trusted) return { candidate: null, undated: 1, outside: 0 };
  if (trusted.getTime() < cutoffAt.getTime() || trusted.getTime() > anchorAt.getTime()) return { candidate: null, undated: 0, outside: 1 };
  return { candidate: { ...candidate, publishedAt: trusted }, undated: 0, outside: 0 };
}

function govcnMappedPageIdentities(sourceId: string, candidates: Candidate[]): { fingerprint: string; hashes: string[] } {
  const identities = [...new Set(candidates.map((candidate) => identityKeyFor({ ...candidate, sourceId, via: "fetch" })))].sort();
  return { fingerprint: sha256(stableJson(identities)), hashes: identities.map((identity) => sha256(identity)).sort() };
}

function govcnResumeCursorMatches(value: unknown, expected: GovcnJsonResumeCursor): boolean {
  return isGovcnJsonResumeCursor(value) && stableJson(value) === stableJson(expected);
}

function govcnResumeRunDetail(input: {
  cursor: GovcnJsonResumeCursor | null;
  pollAnchorAt: Date;
  pollCutoffAt: Date;
  continuationTarget: number;
  pagesFetched: number;
  pagesCommittedThisRun: number;
  dispatchesUsed: number;
  maxDispatches: number;
  detailTargetsUsed: number;
  maxDetailTargets: number;
  pendingDetails: number;
  rowsUndated: number;
  rowsOutsideWindow: number;
  found: number;
  created: number;
  revised: number;
  stopReason: string;
  replayRefetched: boolean;
}): Record<string, unknown> {
  return {
    mode: "govcn_query_resume_v1",
    generationId: input.cursor?.generationId ?? null,
    anchorAt: input.cursor?.anchorAt ?? null,
    cutoffAt: input.cursor?.cutoffAt ?? null,
    pollAnchorAt: input.pollAnchorAt.toISOString(),
    pollCutoffAt: new Date(input.pollCutoffAt).toISOString(),
    continuationTarget: input.continuationTarget,
    pagesFetched: input.pagesFetched,
    pagesCommitted: input.cursor?.pagesCommitted ?? 0,
    pagesCommittedThisRun: input.pagesCommittedThisRun,
    nextPageCommitted: input.cursor?.nextPage ?? 1,
    dispatchesUsed: input.dispatchesUsed,
    maxDispatches: input.maxDispatches,
    detailTargetsUsed: input.detailTargetsUsed,
    maxDetailTargets: input.maxDetailTargets,
    pendingDetails: input.pendingDetails,
    rowsUndated: input.rowsUndated,
    rowsOutsideWindow: input.rowsOutsideWindow,
    found: input.found,
    created: input.created,
    revised: input.revised,
    replayRefetched: input.replayRefetched,
    snapshotConsistency: "unproven",
    stopReason: input.stopReason,
    partial: true,
    coverage: "unproven",
  };
}

async function withGovcnResumeTransaction<T>(
  reserved: Awaited<ReturnType<typeof sql.reserve>>,
  budget: GovcnJsonPaginationBudget,
  run: (tx: Tx) => Promise<T>,
): Promise<T> {
  await reserved`BEGIN`;
  try {
    budget.assertActive();
    const tx = reserved as unknown as Tx;
    const remaining = Math.max(1, Math.floor(budget.remainingMs()));
    await tx`SELECT set_config('statement_timeout', ${`${remaining}ms`}, true)`;
    const result = await run(tx);
    budget.assertActive();
    const commitRemaining = Math.max(1, Math.floor(budget.remainingMs()));
    await tx`SELECT set_config('statement_timeout', ${`${commitRemaining}ms`}, true)`;
    budget.assertActive();
    await reserved`COMMIT`;
    return result;
  } catch (error) {
    try { await reserved`ROLLBACK`; } catch { /* connection release is the final rollback guard */ }
    throw error;
  }
}

async function govcnSourceUnderLock(db: Awaited<ReturnType<typeof sql.reserve>>, sourceId: string): Promise<SourceRow | null> {
  const [row] = await db<SourceRow[]>`SELECT id, name, kind, config, tier, participation_mode, first_party, interval_minutes,
      enabled, cursor, fail_count FROM sources WHERE id = ${sourceId}`;
  return row ?? null;
}

async function saveGovcnResumeMaterials(
  tx: Tx,
  sourceId: string,
  rows: GovcnResumeWorkItem[],
): Promise<GovcnResumeTxCounts> {
  let created = 0;
  let revised = 0;
  const seen = new Set<string>();
  for (const { candidate, backfill } of rows) {
    const material = { ...candidate, sourceId, via: "fetch" as const, backfill };
    const key = identityKeyFor(material);
    if (seen.has(key)) continue;
    seen.add(key);
    const saved = await upsertMaterial(material, tx);
    if (saved.created) created += 1;
    if (saved.revised) revised += 1;
    if (saved.created || saved.revised) await queueProcessing(saved.articleId, { db: tx });
  }
  return { created, revised };
}

class GovcnResumeConfigChangedError extends Error {}
class GovcnResumeCursorChangedError extends Error {}
class GovcnResumePageBlockedError extends Error {
  readonly reason: string;
  constructor(reason: string, message: string) { super(message); this.reason = reason; }
}

async function collectGovcnJsonResume(sourceId: string, opts: { force?: boolean }): Promise<CollectResult> {
  const reserved = await sql.reserve();
  const lockKey = `govcn-json-resume:${sourceId}`;
  let locked = false;
  let runId: number | null = null;
  let source: SourceRow | null = null;
  let cursor: GovcnJsonResumeCursor | null = null;
  let pagination: ReturnType<typeof readGovcnJsonPagination> = null;
  let budget: GovcnJsonPaginationBudget | null = null;
  let found = 0;
  let created = 0;
  let revised = 0;
  let pagesFetched = 0;
  let pagesCommittedThisRun = 0;
  let detailTargetsUsed = 0;
  let pendingDetails = 0;
  let rowsUndated = 0;
  let rowsOutsideWindow = 0;
  let stopReason = "starting";
  let continuationTarget = 1;
  let blockedFreshnessOnly = false;
  let replayRefetched = false;
  let pollWork: GovcnResumeWorkItem[] = [];
  let pollRawRows = 0;
  let pollCommitted = false;
  const runAt = new Date();
  const pollCutoff = new Date(runAt.getTime() - GOVCN_RESUME_DAY_MS * 90);

  const runDetail = () => govcnResumeRunDetail({
    cursor, pollAnchorAt: runAt, pollCutoffAt: pollCutoff, continuationTarget, pagesFetched, pagesCommittedThisRun,
    dispatchesUsed: budget?.dispatchesUsed() ?? 0, maxDispatches: pagination?.maxDispatches ?? 0,
    detailTargetsUsed, maxDetailTargets: Number(source?.config.detail?.maxFetches ?? 0), pendingDetails, rowsUndated, rowsOutsideWindow, found, created, revised, stopReason, replayRefetched,
  });
  const finishRun = async (status: "ok" | "failed", error: string | null = null) => {
    if (runId === null) return;
    const detail = runDetail();
    await reserved`UPDATE fetch_runs SET status = ${status}, finished_at = now(), found_count = ${found}, new_count = ${created},
      error = ${error}, detail = ${sql.json(detail as never)} WHERE id = ${runId}`;
  };
  const failHealth = async (error: unknown) => {
    const message = String(error instanceof Error ? error.message : error).slice(0, 1000);
    await reserved`UPDATE sources SET last_fetch_at = now(), fail_count = fail_count + 1, last_error = ${message},
      health = CASE WHEN fail_count + 1 >= 5 THEN 'failing' ELSE 'degraded' END,
      next_fetch_at = now() + make_interval(mins => LEAST(interval_minutes * (fail_count + 2), 360)), updated_at = now() WHERE id = ${sourceId}`;
    await finishRun("failed", message);
  };
  const updateBlocked = async (state: "blocked" | "config_changed", reason: string) => {
    if (!source || !cursor || !budget) return;
    let changedCursor: GovcnJsonResumeCursor | null = null;
    await withGovcnResumeTransaction(reserved, budget, async (tx) => {
      const [row] = await tx<Array<Pick<SourceRow, "config" | "kind" | "cursor">>>`
        SELECT config, kind, cursor FROM sources WHERE id = ${sourceId} FOR UPDATE`;
      if (!row) throw new GovcnResumeCursorChangedError("GovCN source disappeared before cursor hold");
      const persisted = row.cursor?.[GOVCN_JSON_RESUME_CURSOR_KEY];
      if (!govcnResumeCursorMatches(persisted, cursor!)) throw new GovcnResumeCursorChangedError("GovCN resume cursor changed before cursor hold");
      const changed: GovcnJsonResumeCursor = { ...persisted, state, stopReason: reason, updatedAt: new Date().toISOString() };
      changedCursor = changed;
      const merged = { ...(row.cursor ?? {}), [GOVCN_JSON_RESUME_CURSOR_KEY]: changed };
      await tx`UPDATE sources SET cursor = ${tx.json(merged as never)}, updated_at = now() WHERE id = ${sourceId}`;
      const detail = govcnResumeRunDetail({
        cursor: changed, pollAnchorAt: runAt, pollCutoffAt: pollCutoff, continuationTarget, pagesFetched, pagesCommittedThisRun,
        dispatchesUsed: budget!.dispatchesUsed(), maxDispatches: pagination!.maxDispatches,
        detailTargetsUsed, maxDetailTargets: Number(source!.config.detail.maxFetches), pendingDetails, rowsUndated, rowsOutsideWindow, found, created, revised, stopReason: reason, replayRefetched,
      });
      await tx`UPDATE fetch_runs SET found_count = ${found}, new_count = ${created}, detail = ${tx.json(detail as never)} WHERE id = ${runId}`;
    });
    if (changedCursor) cursor = changedCursor;
    stopReason = reason;
  };
  const assertCurrent = async (expectedNextPage: number, allowBlocked = false) => {
    if (!source || !cursor || !budget) throw new GovcnResumeCursorChangedError("GovCN resume state is unavailable");
    const [latest] = await withGovcnResumeTransaction(reserved, budget, (tx) => tx<SourceRow[]>`
      SELECT id, name, kind, config, tier, participation_mode, first_party, interval_minutes, enabled, cursor, fail_count
      FROM sources WHERE id = ${sourceId}`);
    if (!latest || govcnJsonResumeConfigHash(latest) !== cursor.configHash) throw new GovcnResumeConfigChangedError("GovCN source config changed before dispatch");
    const persisted = latest.cursor?.[GOVCN_JSON_RESUME_CURSOR_KEY];
    if (!govcnResumeCursorMatches(persisted, cursor) || cursor.nextPage !== expectedNextPage ||
        persisted.state !== "active" && !(allowBlocked && persisted.state === "blocked")) {
      throw new GovcnResumeCursorChangedError("GovCN resume cursor changed before dispatch");
    }
  };
  const selectWindow = (candidates: Candidate[], anchor: Date, cutoff: Date, backfill: "first-import" | null): GovcnResumeWorkItem[] => {
    const output: GovcnResumeWorkItem[] = [];
    const seen = new Set<string>();
    for (const original of candidates) {
      const identity = identityKeyFor({ ...original, sourceId, via: "fetch" });
      if (seen.has(identity)) continue;
      seen.add(identity);
      if (!allowed(original.url, source!) || noiseFiltered(original, source!)) continue;
      const rewritten = rewriteUrl(original, source!);
      const result = govcnResumeWindow(rewritten, anchor, cutoff);
      rowsUndated += result.undated;
      rowsOutsideWindow += result.outside;
      if (result.candidate) output.push({ candidate: result.candidate, backfill });
    }
    return output;
  };
  const enrichDetails = async (rows: GovcnResumeWorkItem[], forceUrls: ReadonlySet<string> = new Set()) => {
    if (!source || !budget) return;
    const urls = [...new Set(rows.map(({ candidate }) => candidate.url))];
    const knownRows = urls.length ? await withGovcnResumeTransaction(reserved, budget, (tx) =>
      tx<{ url: string; title: string }[]>`SELECT url, title FROM articles WHERE url IN ${tx(urls)}`) : [];
    const known = new Map(knownRows.map((row) => [row.url, row.title]));
    const maxDetails = Number(source.config.detail?.maxFetches ?? 0);
    for (const { candidate } of rows) {
      budget.assertActive();
      const storedTitle = known.get(candidate.url);
      if (storedTitle !== undefined) candidate.title = storedTitle;
      if (storedTitle !== undefined && !forceUrls.has(candidate.url)) {
        continue;
      }
      if (detailTargetsUsed >= maxDetails) continue;
      const detail = source.config.detail;
      if (!detail) continue;
      const need: DetailNeed = {
        date: !candidate.publishedAt,
        title: !!(detail.titleSelector || detail.titleRegex) && (detail.titleAuthoritative === true || needsTitle(candidate.title)),
        summary: !!detail.summarySelector && !candidate.excerpt,
        body: source.participation_mode === "editorial" && !candidate.bodyText && (!candidate.bodyStatus || candidate.bodyStatus === "pending"),
        expectedTitle: candidate.title,
        expectedPublishedAt: candidate.publishedAt ?? null,
      };
      if (!need.date && !need.title && !need.summary && !(need.body && (detail.bodySelector || Array.isArray(detail.bodyPolicies)))) continue;
      if (!budget.admitDetail(candidate.url)) {
        budget.setStopReason(budget.detailTargetsUsed() >= maxDetails ? "max_detail_targets" : "max_dispatches");
        continue;
      }
      detailTargetsUsed++;
      await assertCurrent(continuationTarget, blockedFreshnessOnly);
      const got = await fetchDetail(candidate.url, source, need, { runBudget: budget.runBudget, remainingMs: budget.remainingMs });
      budget.assertActive();
      if (got.title) candidate.title = got.title;
      if (got.summary) candidate.excerpt = got.summary;
      if (got.body) {
        candidate.bodyHtml = got.body.html;
        candidate.bodyText = got.body.text;
        candidate.bodyStatus = "ok";
        if (detail.bodySelector || detail.bodyPolicies || detail.attachmentScopeSelector !== undefined || detail.attachmentSelector || detail.pdfDirect === true) {
          candidate.clearAttachmentDiagnostic = true;
        }
        if (!candidate.media?.length) candidate.media = got.body.images;
      }
      if (got.attachmentDiagnostic) candidate.attachmentDiagnostic = got.attachmentDiagnostic;
    }
    pendingDetails = rows.filter(({ candidate }) => candidate.bodyStatus !== "ok" || !candidate.bodyText?.trim()).length;
    budget.setPendingDetails(pendingDetails);
  };
  const commitFreshPoll = async (rows: GovcnResumeWorkItem[], rawRows: number) => {
    if (!source || !cursor || !budget || runId === null) throw new GovcnResumeCursorChangedError("GovCN run disappeared before freshness commit");
    const counts = await withGovcnResumeTransaction(reserved, budget, async (tx) => {
      const [row] = await tx<Array<{ config: Record<string, unknown>; kind: SourceRow["kind"]; tier: SourceRow["tier"]; participation_mode: SourceRow["participation_mode"]; first_party: boolean; cursor: Record<string, unknown> | null }>>`
        SELECT config, kind, tier, participation_mode, first_party, cursor FROM sources WHERE id = ${sourceId} FOR UPDATE`;
      if (!row) throw new GovcnResumeCursorChangedError("GovCN source disappeared before freshness commit");
      const latest = { ...source!, config: row.config, kind: row.kind, tier: row.tier, participation_mode: row.participation_mode, first_party: row.first_party };
      if (govcnJsonResumeConfigHash(latest) !== cursor!.configHash) throw new GovcnResumeConfigChangedError("GovCN source config changed before freshness commit");
      const persisted = row.cursor?.[GOVCN_JSON_RESUME_CURSOR_KEY];
      if (!govcnResumeCursorMatches(persisted, cursor!)) {
        throw new GovcnResumeCursorChangedError("GovCN resume cursor changed before freshness commit");
      }
      const persistedCursor = persisted as GovcnJsonResumeCursor;
      if (persistedCursor.nextPage !== cursor!.nextPage || persistedCursor.state !== "active" && persistedCursor.state !== "blocked") {
        throw new GovcnResumeCursorChangedError("GovCN resume cursor changed before freshness commit");
      }
      const stored = await saveGovcnResumeMaterials(tx, sourceId, rows.map((item) => ({ ...item, backfill: null })));
      const now = new Date().toISOString();
      const sourceCursor = { ...(row.cursor ?? {}), initializedAt: (row.cursor as Record<string, unknown> | null)?.initializedAt ?? now, lastOkAt: now };
      const detail = govcnResumeRunDetail({
        cursor, pollAnchorAt: runAt, pollCutoffAt: pollCutoff, continuationTarget, pagesFetched, pagesCommittedThisRun,
        dispatchesUsed: budget!.dispatchesUsed(), maxDispatches: pagination!.maxDispatches,
        detailTargetsUsed, maxDetailTargets: Number(source!.config.detail.maxFetches), pendingDetails, rowsUndated, rowsOutsideWindow, found: found + rawRows,
        created: created + stored.created, revised: revised + stored.revised, stopReason, replayRefetched,
      });
      await tx`UPDATE sources SET last_fetch_at = now(), last_ok_at = now(), fail_count = 0, last_error = NULL, health = 'ok',
        cursor = ${tx.json(sourceCursor as never)}, updated_at = now(), next_fetch_at = now() + make_interval(mins => interval_minutes) WHERE id = ${sourceId}`;
      await tx`UPDATE fetch_runs SET found_count = found_count + ${rawRows}, new_count = new_count + ${stored.created},
        detail = ${tx.json(detail as never)} WHERE id = ${runId}`;
      return stored;
    });
    found += rawRows;
    created += counts.created;
    revised += counts.revised;
    pollCommitted = true;
  };
  const commitHistoryPage = async (rows: GovcnResumeWorkItem[], rawRows: number, fingerprint: string, hashes: string[]) => {
    if (!source || !cursor || !budget || runId === null) throw new GovcnResumeCursorChangedError("GovCN run disappeared before history commit");
    const result = await withGovcnResumeTransaction(reserved, budget, async (tx) => {
      const [row] = await tx<Array<{ config: Record<string, unknown>; kind: SourceRow["kind"]; tier: SourceRow["tier"]; participation_mode: SourceRow["participation_mode"]; first_party: boolean; cursor: Record<string, unknown> | null }>>`
        SELECT config, kind, tier, participation_mode, first_party, cursor FROM sources WHERE id = ${sourceId} FOR UPDATE`;
      if (!row) throw new GovcnResumeCursorChangedError("GovCN source disappeared before history commit");
      const latest = { ...source!, config: row.config, kind: row.kind, tier: row.tier, participation_mode: row.participation_mode, first_party: row.first_party };
      if (govcnJsonResumeConfigHash(latest) !== cursor!.configHash) throw new GovcnResumeConfigChangedError("GovCN source config changed before history commit");
      const persisted = row.cursor?.[GOVCN_JSON_RESUME_CURSOR_KEY];
      if (!govcnResumeCursorMatches(persisted, cursor!)) {
        throw new GovcnResumeCursorChangedError("GovCN resume cursor changed before history commit");
      }
      const persistedCursor = persisted as GovcnJsonResumeCursor;
      if (persistedCursor.nextPage !== continuationTarget || persistedCursor.state !== "active") throw new GovcnResumeCursorChangedError("GovCN resume cursor changed before history commit");
      const stored = await saveGovcnResumeMaterials(tx, sourceId, rows);
      const now = new Date().toISOString();
      const nextPage = continuationTarget + 1;
      const pageCap = continuationTarget >= GOVCN_JSON_RESUME_MAX_PAGE;
      const updated: GovcnJsonResumeCursor = {
        ...persistedCursor,
        nextPage,
        pagesCommitted: continuationTarget,
        lastPageFingerprint: fingerprint,
        lastPageIdentityHashes: hashes,
        state: pageCap ? "blocked" : "active",
        stopReason: pageCap ? "page_cap" : null,
        updatedAt: now,
      };
      const sourceCursor = {
        ...(row.cursor ?? {}),
        initializedAt: (row.cursor as Record<string, unknown> | null)?.initializedAt ?? now,
        lastOkAt: now,
        [GOVCN_JSON_RESUME_CURSOR_KEY]: updated,
      };
      const detail = govcnResumeRunDetail({
        cursor: updated, pollAnchorAt: runAt, pollCutoffAt: pollCutoff, continuationTarget, pagesFetched,
        pagesCommittedThisRun: pagesCommittedThisRun + 1, dispatchesUsed: budget!.dispatchesUsed(), maxDispatches: pagination!.maxDispatches,
        detailTargetsUsed, maxDetailTargets: Number(source!.config.detail.maxFetches), pendingDetails, rowsUndated, rowsOutsideWindow, found: found + rawRows,
        created: created + stored.created, revised: revised + stored.revised,
        stopReason: pageCap ? "page_cap" : "max_pages_per_run", replayRefetched,
      });
      await tx`UPDATE sources SET last_fetch_at = now(), last_ok_at = now(), fail_count = 0, last_error = NULL, health = 'ok',
        cursor = ${tx.json(sourceCursor as never)}, updated_at = now(), next_fetch_at = now() + make_interval(mins => interval_minutes) WHERE id = ${sourceId}`;
      await tx`UPDATE fetch_runs SET found_count = found_count + ${rawRows}, new_count = new_count + ${stored.created},
        detail = ${tx.json(detail as never)} WHERE id = ${runId}`;
      return { stored, updated };
    });
    cursor = result.updated;
    stopReason = continuationTarget >= GOVCN_JSON_RESUME_MAX_PAGE ? "page_cap" : "max_pages_per_run";
    found += rawRows;
    created += result.stored.created;
    revised += result.stored.revised;
    pagesCommittedThisRun++;
  };
  const failPageCheck = async (reason: string, message: string): Promise<never> => {
    stopReason = reason;
    await updateBlocked("blocked", reason);
    throw new GovcnResumePageBlockedError(reason, message);
  };

  try {
    const [lock] = await reserved<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(hashtext(${lockKey})) AS locked`;
    locked = !!lock?.locked;
    if (!locked) return { sourceId, status: "skipped", found: 0, created: 0, revised: 0, error: "concurrent_run" };
    source = await govcnSourceUnderLock(reserved, sourceId);
    if (!source) return { sourceId, status: "skipped", found: 0, created: 0, revised: 0, error: "missing" };
    if (!source.enabled && !opts.force) return { sourceId, status: "skipped", found: 0, created: 0, revised: 0, error: "paused" };
    const errors = unsupportedConfig(source.kind, source.config);
    pagination = readGovcnJsonPagination(source.config);
    const hasResumeCursor = Object.hasOwn(source.cursor ?? {}, GOVCN_JSON_RESUME_CURSOR_KEY);
    const resumeConfigValid = isGovcnJsonResumeSource(source) && pagination?.mode === "govcn_query_resume_v1" && errors.length === 0;
    if (!resumeConfigValid && !hasResumeCursor) {
      return { sourceId, status: "failed", found: 0, created: 0, revised: 0, error: `unsupported GovCN resume config: ${errors.join(",")}` };
    }
    // Once a durable generation exists, changing/removing the opt-in mode must not fall through
    // to the stateless collector and bypass its checkpoint. A temporary bounded budget is only
    // used to time-limit the config_changed transaction; no request is admitted on this path.
    pagination ??= { mode: "govcn_query_resume_v1", maxPagesPerRun: 2, maxDispatches: 7 };
    budget = createGovcnJsonPaginationBudget(source, pagination);
    const [run] = await reserved<{ id: number }[]>`INSERT INTO fetch_runs (source_id) VALUES (${sourceId}) RETURNING id`;
    runId = run!.id;
    continuationTarget = 1;

    const storedCursor = source.cursor?.[GOVCN_JSON_RESUME_CURSOR_KEY] as unknown;
    if (!resumeConfigValid) {
      if (!isGovcnJsonResumeCursor(storedCursor, runAt)) throw new Error("invalid GovCN resume cursor after source config change; explicit review required");
      cursor = storedCursor;
      await updateBlocked("config_changed", "config_changed");
      stopReason = "config_changed";
      await finishRun("failed", "GovCN resume config changed; explicit review required");
      return { sourceId, status: "failed", found, created, revised, error: "config_changed" };
    }
    if (storedCursor === undefined) {
      const initial = newGovcnJsonResumeCursor(source, runAt);
      await withGovcnResumeTransaction(reserved, budget, async (tx) => {
      const [row] = await tx<Array<{ config: Record<string, unknown>; kind: SourceRow["kind"]; tier: SourceRow["tier"]; participation_mode: SourceRow["participation_mode"]; first_party: boolean; cursor: Record<string, unknown> | null }>>`
        SELECT config, kind, tier, participation_mode, first_party, cursor FROM sources WHERE id = ${sourceId} FOR UPDATE`;
        if (!row) throw new GovcnResumeCursorChangedError("GovCN source disappeared during generation initialization");
        const latest = { ...source!, config: row.config, kind: row.kind, tier: row.tier, participation_mode: row.participation_mode, first_party: row.first_party };
        if (govcnJsonResumeConfigHash(latest) !== initial.configHash || Object.hasOwn(row.cursor ?? {}, GOVCN_JSON_RESUME_CURSOR_KEY)) {
          throw new GovcnResumeConfigChangedError("GovCN source config or cursor changed during generation initialization");
        }
        const merged = { ...(row.cursor ?? {}), [GOVCN_JSON_RESUME_CURSOR_KEY]: initial };
        await tx`UPDATE sources SET cursor = ${tx.json(merged as never)}, updated_at = now() WHERE id = ${sourceId}`;
      });
      const [reloaded] = await withGovcnResumeTransaction(reserved, budget, (tx) => tx<SourceRow[]>`
        SELECT id, name, kind, config, tier, participation_mode, first_party, interval_minutes, enabled, cursor, fail_count
        FROM sources WHERE id = ${sourceId}`);
      source = reloaded ?? null;
      cursor = initial;
    } else {
      if (!isGovcnJsonResumeCursor(storedCursor, runAt)) throw new Error("invalid GovCN resume cursor; explicit review required");
      cursor = storedCursor;
      if (cursor.configHash !== govcnJsonResumeConfigHash(source)) {
        await updateBlocked("config_changed", "config_changed");
        throw new GovcnResumeConfigChangedError("GovCN resume config changed; explicit review required");
      }
      blockedFreshnessOnly = cursor.state === "blocked" && ["empty_page", "repeated_page", "no_new_identity", "page_cap"].includes(cursor.stopReason ?? "");
      if (cursor.state !== "active" && !blockedFreshnessOnly) throw new Error(`GovCN resume generation is ${cursor.state}; explicit review required`);
    }
    if (!cursor) throw new GovcnResumeCursorChangedError("GovCN resume cursor initialization failed");
    continuationTarget = cursor.nextPage;
    if (cursor.nextPage > GOVCN_JSON_RESUME_MAX_PAGE && !blockedFreshnessOnly) {
      await updateBlocked("blocked", "page_cap");
      stopReason = "page_cap";
      await finishRun("failed", "GovCN history page cap reached; explicit review required");
      return { sourceId, status: "failed", found, created, revised, error: "page_cap" };
    }
    budget.setListPages(blockedFreshnessOnly ? [1] : continuationTarget === 1 ? [1, 2] : [1, continuationTarget]);
    replayRefetched = cursor.pagesCommitted > 0;
    stopReason = "max_pages_per_run";

    await assertCurrent(continuationTarget, blockedFreshnessOnly);
    budget.setPage(1);
    const pollResult = await fetchGovcnJsonPage(source!, 1, {
      runBudget: budget.runBudget, timeoutMs: Math.min(25_000, budget.remainingMs()), assertActive: budget.assertActive,
    });
    budget.pageFetched();
    pagesFetched++;
    pollRawRows = pollResult.rawRowCount;
    const currentRows = selectWindow(pollResult.candidates, budget.anchorAt, budget.cutoffAt, null);
    pollWork = currentRows;
    found += 0;

    if (blockedFreshnessOnly) {
      await enrichDetails(currentRows);
      stopReason = cursor.stopReason ?? "blocked";
      await commitFreshPoll(currentRows, pollRawRows);
      await finishRun("ok");
      return { sourceId, status: "ok", found, created, revised };
    }

    const historyAnchor = new Date(cursor.anchorAt);
    const historyCutoff = new Date(cursor.cutoffAt);
    if (continuationTarget === 1) {
      // Commit the first observation before requesting p2. Items in both windows are one
      // material and carry the generation's first-import semantics.
      const firstPageIdentity = govcnMappedPageIdentities(sourceId, pollResult.candidates);
      if (pollResult.rawRowCount === 0 || firstPageIdentity.hashes.length === 0) return await failPageCheck("empty_page", "GovCN first history page was empty");
      const pageOneHistoryRows = selectWindow(pollResult.candidates, historyAnchor, historyCutoff, "first-import");
      const combinedByIdentity = new Map<string, GovcnResumeWorkItem>();
      for (const item of currentRows) combinedByIdentity.set(identityKeyFor({ ...item.candidate, sourceId, via: "fetch" }), item);
      for (const item of pageOneHistoryRows) {
        const key = identityKeyFor({ ...item.candidate, sourceId, via: "fetch" });
        const existing = combinedByIdentity.get(key);
        if (existing) existing.backfill = "first-import";
        else combinedByIdentity.set(key, item);
      }
      const firstPageRows = [...combinedByIdentity.values()];
      const firstPageUrls = [...new Set(firstPageRows.map(({ candidate }) => candidate.url))];
      const preexisting = firstPageUrls.length ? await withGovcnResumeTransaction(reserved, budget, (tx) =>
        tx<{ url: string }[]>`SELECT url FROM articles WHERE url IN ${tx(firstPageUrls)}`) : [];
      const firstRunDetailUrls = new Set(firstPageRows.filter(({ candidate }) => !preexisting.some((row) => row.url === candidate.url))
        .map(({ candidate }) => candidate.url));
      pendingDetails = firstPageRows.filter(({ candidate }) => candidate.bodyStatus !== "ok" || !candidate.bodyText?.trim()).length;
      budget.setPendingDetails(pendingDetails);
      await commitHistoryPage(firstPageRows, pollRawRows, firstPageIdentity.fingerprint, firstPageIdentity.hashes);
      pollCommitted = true;

      // The p1 commit advances the durable cursor to p2. Dispatch p2 before spending the
      // remaining time on details so detail latency cannot starve history continuation.
      continuationTarget = cursor!.nextPage;
      await assertCurrent(continuationTarget);
      budget.setPage(continuationTarget);
      const secondPage = await fetchGovcnJsonPage(source!, continuationTarget, {
        runBudget: budget.runBudget, timeoutMs: Math.min(25_000, budget.remainingMs()), assertActive: budget.assertActive,
      });
      budget.pageFetched();
      pagesFetched++;
      const pageIdentity = govcnMappedPageIdentities(sourceId, secondPage.candidates);
      if (secondPage.rawRowCount === 0 || pageIdentity.hashes.length === 0) return await failPageCheck("empty_page", "GovCN continuation page was empty");
      if (cursor!.lastPageFingerprint === pageIdentity.fingerprint) return await failPageCheck("repeated_page", "GovCN continuation repeated the prior page identity fingerprint");
      const prior = new Set(cursor!.lastPageIdentityHashes ?? []);
      if (prior.size > 0 && !pageIdentity.hashes.some((hash) => !prior.has(hash))) {
        return await failPageCheck("no_new_identity", "GovCN continuation page has no identity beyond the prior committed page");
      }
      const pageTwoHistoryRows = selectWindow(secondPage.candidates, historyAnchor, historyCutoff, "first-import");
      const currentKeys = new Set(firstPageRows.map(({ candidate }) => identityKeyFor({ ...candidate, sourceId, via: "fetch" })));
      const historyUniqueRows = pageTwoHistoryRows.filter(({ candidate }) => !currentKeys.has(identityKeyFor({ ...candidate, sourceId, via: "fetch" })));
      const pageTwoRows = [...firstPageRows, ...historyUniqueRows];
      await enrichDetails(pageTwoRows, firstRunDetailUrls);
      // Any p1 detail enrichment is re-upserted atomically with p2, while the p1 material and
      // checkpoint remain safe if p2 itself fails.
      await commitHistoryPage(pageTwoRows, secondPage.rawRowCount, pageIdentity.fingerprint, pageIdentity.hashes);
    } else {
      await assertCurrent(continuationTarget);
      budget.setPage(continuationTarget);
      const historyResult = await fetchGovcnJsonPage(source!, continuationTarget, {
        runBudget: budget.runBudget, timeoutMs: Math.min(25_000, budget.remainingMs()), assertActive: budget.assertActive,
      });
      budget.pageFetched();
      pagesFetched++;
      const pageIdentity = govcnMappedPageIdentities(sourceId, historyResult.candidates);
      if (historyResult.rawRowCount === 0 || pageIdentity.hashes.length === 0) return await failPageCheck("empty_page", "GovCN continuation page was empty");
      if (cursor.lastPageFingerprint === pageIdentity.fingerprint) return await failPageCheck("repeated_page", "GovCN continuation repeated the prior page identity fingerprint");
      const prior = new Set(cursor.lastPageIdentityHashes ?? []);
      if (prior.size > 0 && !pageIdentity.hashes.some((hash) => !prior.has(hash))) {
        return await failPageCheck("no_new_identity", "GovCN continuation page has no identity beyond the prior committed page");
      }
      const historyRows = selectWindow(historyResult.candidates, historyAnchor, historyCutoff, "first-import");
      const currentKeys = new Set(currentRows.map(({ candidate }) => identityKeyFor({ ...candidate, sourceId, via: "fetch" })));
      const historyUniqueRows = historyRows.filter(({ candidate }) => !currentKeys.has(identityKeyFor({ ...candidate, sourceId, via: "fetch" })));
      const combined = [...currentRows, ...historyUniqueRows];
      await enrichDetails(combined);
      // Current-window discoveries remain committed even if a later history page cannot advance.
      await commitFreshPoll(currentRows, pollRawRows);
      await commitHistoryPage(historyUniqueRows, historyResult.rawRowCount, pageIdentity.fingerprint, pageIdentity.hashes);
    }
    if (cursor.nextPage > GOVCN_JSON_RESUME_MAX_PAGE || cursor.state === "blocked") stopReason = "page_cap";
    else stopReason = "max_pages_per_run";
    await finishRun("ok");
    return { sourceId, status: "ok", found, created, revised };
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).slice(0, 1000);
    stopReason = error instanceof GovcnResumePageBlockedError ? error.reason : error instanceof GovcnResumeConfigChangedError ? "config_changed" : error instanceof GovcnResumeCursorChangedError ? "cursor_changed" :
      error instanceof Error && /deadline|timeout|aborted/i.test(error.message) ? "timeout" : "run_failed";
    if (error instanceof GovcnResumeConfigChangedError && cursor) {
      try { await updateBlocked("config_changed", "config_changed"); } catch { /* retain original run error */ }
    }
    // If p1 was fetched but its continuation failed, preserve rolling-window discoveries without
    // changing the generation cursor. They remain pending for the ordinary extraction path.
    if (cursor && budget && continuationTarget > 1 && !pollCommitted && pollWork.length) {
      try { await commitFreshPoll(pollWork, pollRawRows); } catch { /* no cursor advancement; next run replays safely */ }
    }
    if (runId !== null) await failHealth(error);
    return { sourceId, status: runId === null ? "skipped" : "failed", found, created, revised, error: message };
  } finally {
    budget?.dispose();
    if (locked) {
      try { await reserved`SELECT pg_advisory_unlock(hashtext(${lockKey}))`; } catch { /* release also drops session lock */ }
    }
    reserved.release();
  }
}

export async function collectSource(sourceId: string, opts: { force?: boolean } = {}): Promise<CollectResult> {
  const source = await loadSource(sourceId);
  if (!source) return { sourceId, status: "skipped", found: 0, created: 0, revised: 0, error: "missing" };
  if (!source.enabled && !opts.force) return { sourceId, status: "skipped", found: 0, created: 0, revised: 0, error: "paused" };
  if (isGovcnJsonResumeSource(source) || Object.hasOwn(source.cursor ?? {}, GOVCN_JSON_RESUME_CURSOR_KEY)) {
    return collectGovcnJsonResume(sourceId, opts);
  }
  if (usesWebListPagination(source)) {
    return collectWebListBackfill(sourceId, {
      force: opts.force,
      validateConfig: (current) => unsupportedConfig(current.kind, current.config),
    });
  }
  if (source.kind === "mp_account" || source.kind === "external") {
    // WeChat accounts are reconciled by the mp job; external sources only receive reports.
    return { sourceId, status: "skipped", found: 0, created: 0, revised: 0 };
  }

  const [run] = await sql<{ id: number }[]>`INSERT INTO fetch_runs (source_id) VALUES (${sourceId}) RETURNING id`;
  const firstImport = !source.cursor?.initializedAt;
  let created = 0;
  let revised = 0;
  let found = 0;
  let nfraBudget: ReturnType<typeof createNfraJsonRunBudget> | null = null;
  let govcnBudget: GovcnJsonPaginationBudget | null = null;
  let govcnRunDetail: Record<string, unknown> | null = null;
  try {
    // A config entry this kind does not implement fails the run, visibly, instead of being ignored.
    const unsupported = unsupportedConfig(source.kind, source.config);
    if (unsupported.length) throw new FetchError(`unsupported config: ${unsupported.join(", ")}`);
    if (source.config.detail?.mode === "nfra_json_v1") {
      if (!nfraConfigIsSupported(source)) throw new FetchError("unsupported NFRA detail mode");
      nfraBudget = createNfraJsonRunBudget();
    }
    if (isGovcnJsonPaginationSource(source)) {
      const pagination = readGovcnJsonPagination(source.config);
      if (!pagination || unsupportedConfig(source.kind, source.config).length) throw new FetchError("unsupported GovCN JSON pagination mode");
      govcnBudget = createGovcnJsonPaginationBudget(source, pagination);
    }
    let candidates: Candidate[];
    let nextCursor: Record<string, unknown> = { ...(source.cursor ?? {}) };
    let detail: Record<string, unknown> | null = null;
    if (source.kind === "rss") {
      const rss = await fetchRss(source, opts);
      candidates = rss.candidates;
      // The first import has a smaller backfill cap than later runs: allow the next run to read
      // the ordinary window before accepting 304s. Persist validators only after store succeeds.
      if (!firstImport) nextCursor.rss = rss.validator;
      else delete nextCursor.rss;
      if (rss.notModified) detail = { notModified: true, httpStatus: 304 };
    }
    else if (source.kind === "web_list") candidates = await fetchWebList(source);
    else if (source.kind === "json_list" && govcnBudget) {
      const pagination = readGovcnJsonPagination(source.config);
      if (!pagination) throw new FetchError("unsupported GovCN JSON pagination mode");
      candidates = await readGovcnJsonPages(source, pagination, govcnBudget);
      govcnRunDetail = { ...govcnBudget.summary() };
    }
    else if (source.kind === "json_list") candidates = await fetchJsonList(source, nfraBudget ? { runBudget: nfraBudget.runBudget, timeoutMs: Math.min(25_000, nfraBudget.remainingMs()), assertActive: nfraBudget.assertActive } : {});
    else {
      const x = await fetchXSearch(source);
      candidates = x.candidates;
      if (x.lastId) nextCursor.lastTweetId = x.lastId;
      // A search longer than one run keeps its position for the next runs (shown in the admin).
      if (x.backlog.length) nextCursor.xBacklog = x.backlog;
      else delete nextCursor.xBacklog;
      detail = { pages: x.pages, truncated: x.truncated, backlog: x.backlog.length, backlogPages: x.backlogPages, dropped: x.dropped };
    }
    found = candidates.length;
    candidates = candidates.filter((c) => allowed(c.url, source)).map((c) => rewriteUrl(c, source)).filter((c) => !noiseFiltered(c, source));
    if (source.config.sortByPublishedAt) candidates.sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));

    // First import of a new source: bounded, and archived by source time (never "today", never pushed).
    const backfillLimit = Number(source.config._aihot?.initialBackfillLimit ?? 30);
    const backfillMonths = Number(source.config._aihot?.initialBackfillMonths ?? 12);
    const initialBackfillRequirePublishedAt = source.config._aihot?.initialBackfillRequirePublishedAt === true;
    const runAt = govcnBudget?.anchorAt ?? new Date();
    const backfillCutoff = govcnBudget?.cutoffAt.getTime() ?? runAt.getTime() - backfillMonths * 30 * 86400000;
    if (govcnBudget) {
      candidates = candidates.filter((c) => govcnCandidateInWindow(c, govcnBudget!));
    } else if (firstImport) {
      if (initialBackfillRequirePublishedAt) {
        // Keep missing/untrustworthy dates in this bounded candidate window so existing detail
        // budget can resolve them. The final gate below is after detail and timeline validation.
        const detailCanReplacePublishedAt = source.config.detail?.publishedAtAuthoritative === true;
        candidates = candidates.filter((c) => {
          if (detailCanReplacePublishedAt) return true;
          if (!c.publishedAt || !Number.isFinite(c.publishedAt.getTime())) return true;
          const trusted = decideTimeline(c.publishedAt, runAt, "first-import").publishedAt;
          return !trusted || trusted.getTime() >= backfillCutoff;
        }).slice(0, backfillLimit);
      } else {
        candidates = candidates.filter((c) => !c.publishedAt || c.publishedAt.getTime() >= backfillCutoff).slice(0, backfillLimit);
      }
    } else if (source.kind !== "x_search") {
      // X keeps every post it read: its watermark already covers them, so a cut here would lose them.
      candidates = candidates.slice(0, MAX_ITEMS_PER_RUN);
    }

    // Detail pages only for material we have not seen (bounded per run), and only for what the listing lacks.
    const d = source.config.detail;
    const known = await storedTitles(candidates.map((c) => c.url));
    const detailBudget = Number(d?.maxFetches ?? 0);
    let detailUsed = 0;
    for (const c of candidates) {
      nfraBudget?.assertActive();
      govcnBudget?.assertActive();
      // Listing dates the source marks unreliable are dropped; the detail page's rule decides.
      if (d?.publishedAtAuthoritative === true) c.publishedAt = null;
      const stored = known.get(c.url);
      if (stored !== undefined) {
        // The title came from the detail page: the listing's own rendering must not revise it back.
        if (d?.titleSelector || d?.titleRegex) c.title = stored;
        continue;
      }
      if (!d || detailUsed >= detailBudget) continue;
      const need: DetailNeed = {
        date: !c.publishedAt || d.upgradeDatePrecision === true,
        title: !!(d.titleSelector || d.titleRegex) && (d.titleAuthoritative === true || needsTitle(c.title)),
        summary: !!d.summarySelector && !c.excerpt,
        body: source.participation_mode === "editorial" && !c.bodyText && (!c.bodyStatus || c.bodyStatus === "pending"),
        expectedTitle: c.title,
        expectedPublishedAt: c.publishedAt ?? null,
        ...(nfraConfigIsSupported(source) ? { expectedExternalId: Number((c.raw as Record<string, unknown> | null)?.externalId), listAttachmentPending: !!c.attachmentDiagnostic } : {}),
      };
      if (!need.date && !need.title && !need.summary && !(need.body && (d.bodySelector || Array.isArray(d.bodyPolicies)))) continue;
      if (govcnBudget && !govcnBudget.admitDetail(c.url)) {
        govcnBudget.setStopReason(govcnBudget.detailTargetsUsed() >= detailBudget ? "max_detail_targets" : "max_dispatches");
        break;
      }
      detailUsed += 1;
      try {
        const got = await fetchDetail(c.url, source, need, govcnBudget
          ? { runBudget: govcnBudget.runBudget, remainingMs: govcnBudget.remainingMs }
          : nfraBudget ? { runBudget: nfraBudget.runBudget, remainingMs: nfraBudget.remainingMs } : {});
        nfraBudget?.assertActive();
        govcnBudget?.assertActive();
        if (got.title) c.title = got.title;
        if (got.summary) c.excerpt = got.summary;
        // The same Readability path as extraction, using bytes already fetched for the detail rules.
        // A confirmed body enters through normal material revisions and skips the redundant fetch job.
        if (got.body) {
          c.bodyHtml = got.body.html;
          c.bodyText = got.body.text;
          c.bodyStatus = "ok";
          if (d?.bodySelector || d?.bodyPolicies || d?.attachmentScopeSelector !== undefined || d?.attachmentSelector || d?.pdfDirect === true) {
            c.clearAttachmentDiagnostic = true;
          }
          if (!c.media?.length) c.media = got.body.images;
        }
        if (got.attachmentDiagnostic) c.attachmentDiagnostic = got.attachmentDiagnostic;
        // A date-only listing value gives way to the detail page's time on the same day.
        if (!govcnBudget && got.publishedAt && (!c.publishedAt || Math.abs(got.publishedAt.getTime() - c.publishedAt.getTime()) < DAY_MS)) c.publishedAt = got.publishedAt;
      } catch (error) {
        if (govcnBudget) {
          govcnBudget.setStopReason(error instanceof Error && /deadline|timeout|aborted/i.test(error.message) ? "timeout" : "detail_failure");
          throw error;
        }
        // detail is best effort for legacy sources
      } finally {
        govcnBudget?.clearDetail();
      }
    }

    if (govcnBudget) {
      govcnBudget.setPendingDetails(candidates.filter((c) => c.bodyStatus !== "ok" || !c.bodyText?.trim()).length);
      govcnRunDetail = { ...govcnBudget.summary() };
    }

    if (firstImport && initialBackfillRequirePublishedAt) {
      // A detail rule may have supplied or replaced the listing date, so only this final, trusted
      // source date can decide whether the candidate enters the first-import window.
      candidates = candidates.filter((c) => {
        const trusted = decideTimeline(c.publishedAt, runAt, "first-import").publishedAt;
        return !!trusted && trusted.getTime() >= backfillCutoff;
      });
    }

    ({ created, revised } = await store(sourceId, candidates, firstImport ? "first-import" : null));

    if (firstImport) nextCursor.initializedAt = new Date().toISOString();
    nextCursor.lastOkAt = new Date().toISOString();
    await sql`
      UPDATE sources SET last_fetch_at = now(), last_ok_at = now(), fail_count = 0, last_error = NULL,
        health = 'ok', cursor = ${sql.json(nextCursor as never)}, updated_at = now(),
        next_fetch_at = now() + make_interval(mins => interval_minutes)
      WHERE id = ${sourceId}`;
    await sql`UPDATE fetch_runs SET status = 'ok', finished_at = now(), found_count = ${found}, new_count = ${created},
                detail = ${govcnRunDetail ? sql.json(govcnRunDetail as never) : detail ? sql.json(detail as never) : null} WHERE id = ${run!.id}`;
    return { sourceId, status: "ok", found, created, revised };
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).slice(0, 1000);
    if (govcnBudget) {
      if (govcnBudget.summary().stopReason === "max_pages_per_run") {
        govcnBudget.setStopReason(error instanceof Error && /deadline|timeout|aborted/i.test(error.message) ? "timeout" : "run_failed");
      }
      govcnRunDetail = { ...govcnBudget.summary() };
    }
    const budget = error instanceof BudgetExceededError;
    await sql`
      UPDATE sources SET last_fetch_at = now(),
        fail_count = CASE WHEN ${budget} THEN fail_count ELSE fail_count + 1 END,
        last_error = ${message},
        health = CASE WHEN ${budget} THEN health WHEN fail_count + 1 >= 5 THEN 'failing' ELSE 'degraded' END,
        next_fetch_at = now() + make_interval(mins => CASE WHEN ${budget} THEN 15 ELSE LEAST(interval_minutes * (fail_count + 2), 360) END),
        updated_at = now()
      WHERE id = ${sourceId}`;
    await sql`UPDATE fetch_runs SET status = 'failed', finished_at = now(), found_count = ${found}, new_count = ${created}, error = ${message},
      detail = ${govcnRunDetail ? sql.json(govcnRunDetail as never) : null} WHERE id = ${run!.id}`;
    return { sourceId, status: "failed", found, created, revised, error: message };
  } finally {
    nfraBudget?.dispose();
    govcnBudget?.dispose();
  }
}

/** X ids begin with their millisecond timestamp (since 2010-11-04): the smallest id of a post made at `ms`. */
const xIdAt = (ms: number) => (BigInt(Math.max(0, ms - 1288834974657)) << 22n);

/**
 * Where an account's posts are known to be read up to. A quiet account's newest post can be months
 * old, but its last successful check read everything up to then; bounding a shard's search by the
 * post alone would re-read months of the other accounts' posts. Ten minutes before the check allows
 * for posts that reach the search late.
 */
function coveredTo(m: SourceRow): bigint {
  const own = BigInt(m.cursor!.lastTweetId);
  const checked = Date.parse(String(m.cursor?.lastOkAt ?? ""));
  if (!Number.isFinite(checked)) return own;
  const byTime = xIdAt(checked - 10 * 60_000);
  return byTime > own ? byTime : own;
}

/** Minutes between reads of a shard: editorial accounts every half hour, hot-signal accounts hourly. */
const X_SHARD_MINUTES: Record<string, number> = { editorial: 30, hot_signal: 60 };
const shardMinutes = (mode: string) => X_SHARD_MINUTES[mode] ?? 60;

/**
 * One search for a shard of X accounts (planXShards). Each post goes to the source whose handle wrote
 * it, and every account keeps its own fetch run, health and cursor. The oldest watermark bounds the
 * search, so no account misses a post (the others only see posts they already have again); afterwards
 * every account is covered up to the newest post the search saw, and the stretches still unread are
 * kept in each account's cursor, so they survive a change of shards.
 */
export async function collectXShard(key: string, sourceIds: string[]): Promise<{ key: string; status: "ok" | "failed" | "skipped"; accounts: number; found: number; created: number; error?: string }> {
  const members = (
    await sql<SourceRow[]>`
      SELECT id, name, kind, config, tier, participation_mode, first_party, interval_minutes, enabled, cursor, fail_count
      FROM sources WHERE id IN ${sql(sourceIds)} ORDER BY id`
  ).filter((m) => m.enabled && shardHandle(m));
  if (members.length === 0) return { key, status: "skipped", accounts: 0, found: 0, created: 0 };
  const minutes = shardMinutes(members[0]!.participation_mode);
  const runs = new Map<string, number>();
  for (const m of members) runs.set(m.id, (await sql<{ id: number }[]>`INSERT INTO fetch_runs (source_id) VALUES (${m.id}) RETURNING id`)[0]!.id);

  const since = members.map(coveredTo).reduce((a, b) => (b < a ? b : a));
  const backlog: XBacklog[] = [];
  const stretches = new Set<string>();
  for (const m of members) {
    for (const b of (Array.isArray(m.cursor?.xBacklog) ? m.cursor.xBacklog : []) as XBacklog[]) {
      if (!stretches.has(`${b.query} ${b.next}`)) backlog.push(b);
      stretches.add(`${b.query} ${b.next}`);
    }
  }
  let read: XRead;
  try {
    read = await readXSearch(shardQuery(members.map((m) => shardHandle(m)!)), { lastId: String(since), backlog, subject: `x-shard:${key}` });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).slice(0, 1000);
    const budget = error instanceof BudgetExceededError;
    for (const m of members) {
      await sql`
        UPDATE sources SET last_fetch_at = now(),
          fail_count = CASE WHEN ${budget} THEN fail_count ELSE fail_count + 1 END,
          last_error = ${message},
          health = CASE WHEN ${budget} THEN health WHEN fail_count + 1 >= 5 THEN 'failing' ELSE 'degraded' END,
          next_fetch_at = now() + make_interval(mins => CASE WHEN ${budget} THEN 15 ELSE LEAST(${minutes} * (fail_count + 2), 360) END),
          updated_at = now()
        WHERE id = ${m.id}`;
      await sql`UPDATE fetch_runs SET status = 'failed', finished_at = now(), error = ${message}, detail = ${sql.json({ shard: key, accounts: members.length })} WHERE id = ${runs.get(m.id)!}`;
    }
    return { key, status: "failed", accounts: members.length, found: 0, created: 0, error: message };
  }

  const detail = { shard: key, accounts: members.length, pages: read.pages, truncated: read.truncated, backlog: read.backlog.length, backlogPages: read.backlogPages, dropped: read.dropped };
  let found = 0;
  let created = 0;
  for (const m of members) {
    const handle = shardHandle(m)!.toLowerCase();
    const mine = read.tweets.filter((t) => t.user.screen_name.toLowerCase() === handle);
    const stored = await store(m.id, mine.map(tweetToCandidate).map((c) => rewriteUrl(c, m)).filter((c) => !noiseFiltered(c, m)), null);
    found += mine.length;
    created += stored.created;
    const own = String(m.cursor!.lastTweetId);
    const cursor: Record<string, unknown> = { ...m.cursor, lastTweetId: read.lastId && BigInt(read.lastId) > BigInt(own) ? read.lastId : own, lastOkAt: new Date().toISOString() };
    if (read.backlog.length) cursor.xBacklog = read.backlog;
    else delete cursor.xBacklog;
    await sql`
      UPDATE sources SET last_fetch_at = now(), last_ok_at = now(), fail_count = 0, last_error = NULL,
        health = 'ok', cursor = ${sql.json(cursor as never)}, interval_minutes = ${minutes}, updated_at = now(),
        next_fetch_at = now() + make_interval(mins => ${minutes})
      WHERE id = ${m.id}`;
    await sql`UPDATE fetch_runs SET status = 'ok', finished_at = now(), found_count = ${mine.length}, new_count = ${stored.created},
                detail = ${sql.json(detail as never)} WHERE id = ${runs.get(m.id)!}`;
  }
  return { key, status: "ok", accounts: members.length, found, created };
}

/** X accounts read by shard: a plain query and a watermark (the first fetch of an account is its own). */
const sharded = () => sql`kind = 'x_search' AND config->>'query' ~* ${SHARDABLE_SQL} AND coalesce(config->>'searchType', 'Latest') = 'Latest' AND cursor->>'lastTweetId' IS NOT NULL`;

/** Every minute: a shard is read when any of its accounts is due, all of them at once. */
async function scheduleXShards(): Promise<number> {
  const rows = await sql<Array<Pick<SourceRow, "id" | "kind" | "config" | "cursor" | "participation_mode"> & { due: boolean }>>`
    SELECT id, kind, config, cursor, participation_mode, (next_fetch_at IS NULL OR next_fetch_at <= now()) AS due
    FROM sources WHERE enabled AND ${sharded()}`;
  const due = new Set(rows.filter((r) => r.due).map((r) => r.id));
  let enqueued = 0;
  for (const shard of planXShards(rows)) {
    if (!shard.sourceIds.some((id) => due.has(id))) continue;
    await enqueue(QUEUES.fetchXShard, { key: shard.key, sourceIds: shard.sourceIds }, { singletonKey: shard.key });
    await sql`UPDATE sources SET next_fetch_at = now() + interval '10 minutes' WHERE id IN ${sql(shard.sourceIds)}`;
    enqueued += 1;
  }
  return enqueued;
}

/** Every minute: enqueue due sources (enabled, not WeChat/external), oldest due first; X accounts by shard. */
export async function scheduleDueSources(limit = Number(process.env.FETCH_SCHEDULE_BATCH || 40)): Promise<{ enqueued: number; shards: number }> {
  const kinds: string[] = (process.env.COLLECT_KINDS || "rss,web_list,json_list,x_search").split(",");
  // Listings fetched through Jina Reader are paid; development can leave them out.
  const skipJina = process.env.COLLECT_SKIP_JINA === "true";
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM sources
    WHERE enabled AND kind IN ${sql(kinds)} AND (next_fetch_at IS NULL OR next_fetch_at <= now()) AND NOT (${sharded()})
      ${skipJina ? sql`AND config::text NOT LIKE '%r.jina.ai%'` : sql``}
    ORDER BY next_fetch_at NULLS FIRST LIMIT ${limit}`;
  for (const r of rows) {
    await enqueue(QUEUES.fetchSource, { sourceId: r.id }, { singletonKey: r.id });
    await sql`UPDATE sources SET next_fetch_at = now() + interval '10 minutes' WHERE id = ${r.id}`;
  }
  const shards = kinds.includes("x_search") ? await scheduleXShards() : 0;
  return { enqueued: rows.length, shards };
}

/**
 * Daily: adapt each source's interval to its recent output (active 15 min … quiet 120 min).
 * hot_signal sources are allowed to be slower.
 */
export async function adaptIntervals(): Promise<{ updated: number }> {
  const rows = await sql<Array<Pick<SourceRow, "id" | "participation_mode" | "kind" | "config" | "cursor"> & { paid_listing: boolean; per_day: number }>>`
    SELECT s.id, s.participation_mode, s.kind, s.config, s.cursor, coalesce(s.config->>'url', '') LIKE 'https://r.jina.ai/%' AS paid_listing,
      (SELECT count(*) FROM articles a WHERE a.source_id = s.id AND a.discovered_at > now() - interval '7 days' AND NOT a.backfill) / 7.0 AS per_day
    FROM sources s WHERE s.enabled AND s.kind IN ('rss', 'web_list', 'json_list', 'x_search')`;
  let updated = 0;
  for (const r of rows) {
    const perDay = Number(r.per_day);
    // Editorial sites and feeds are looked at hourly at least (they cost nothing);
    // editorial X and listings read through Jina stop at two hours (paid per call, within their budgets);
    // hot signals may wait longer.
    const max = r.participation_mode === "hot_signal" ? 180 : r.kind === "x_search" || r.paid_listing ? 120 : 60;
    // Listings read through Jina are not looked at more than hourly: busy ones would outrun its daily budget.
    const min = r.paid_listing ? 60 : 15;
    // X accounts read by shard follow the shard's pace, whatever their own volume.
    const target = shardHandle(r) ? shardMinutes(r.participation_mode) : perDay <= 0.15 ? max : Math.round(Math.min(max, Math.max(min, (24 * 60) / (perDay * 3))));
    const res = await sql`UPDATE sources SET interval_minutes = ${target} WHERE id = ${r.id} AND interval_minutes <> ${target}`;
    updated += res.count;
  }
  return { updated };
}
