import { randomUUID } from "node:crypto";
import { sql, type Tx } from "../db.ts";
import { decideTimeline, identityKeyFor, upsertMaterial } from "../content/materials.ts";
import { queueProcessing } from "../jobs/content.ts";
import { sha256, stableJson } from "../lib/ids.ts";
import type { GuardedFetchRunBudget } from "../lib/http-fetch.ts";
import { allowed, fetchWebList } from "./web-list.ts";
import { FetchError, type Candidate, type SourceRow } from "./types.ts";

export interface MofIndexPaginationConfig {
  mode: "mof_index_v1";
  maxPagesPerRun: number;
  maxDispatches: number;
  maxPageIndex: number;
}

export type WebListBackfillState = "active" | "blocked" | "config_changed";

export interface WebListBackfillCursor {
  v: 1;
  generationId: string;
  configHash: string;
  anchorAt: string;
  cutoffAt: string;
  nextPageIndex: number;
  pagesCommitted: number;
  lastPageFingerprint: string | null;
  /** SHA-256 hashes of the immediately preceding page's identities (at most 60). */
  lastPageIdentityHashes?: string[] | null;
  state: WebListBackfillState;
  coverage: "unproven";
  stopReason: string | null;
  updatedAt: string;
}

export interface WebListBackfillRunDetail {
  v: 1;
  generationId: string;
  coverage: "unproven";
  partial: true;
  stopReason: string;
  nextPageIndex: number;
  pagesFetched: number;
  pagesCommitted: number;
  dispatchesUsed: number;
  maxDispatches: number;
  created: number;
  revised: number;
  rowsUndated: number;
  rowsOutsideWindow: number;
}

const PAGINATION_KEYS = ["mode", "maxPagesPerRun", "maxDispatches", "maxPageIndex"] as const;
const MAX_PAGES_PER_RUN = 2;
const MAX_DISPATCHES = 12;
const MAX_PAGE_INDEX = 100;
const DAY_MS = 86_400_000;
const BACKFILL_CURSOR_KEY = "webListBackfill";

export interface PaginatedWebListRunResult {
  sourceId: string;
  status: "ok" | "failed" | "skipped";
  found: number;
  created: number;
  revised: number;
  error?: string;
}

export interface PaginatedWebListRunOptions {
  force?: boolean;
  /** Test seam for synthetic page contents; the production collector always uses fetchWebList. */
  fetchPage?: (source: SourceRow, listUrl: string, runBudget: GuardedFetchRunBudget) => Promise<Candidate[]>;
  validateConfig?: (source: SourceRow) => string[];
}

export function usesWebListPagination(source: Pick<SourceRow, "kind" | "config" | "cursor">): boolean {
  return (source.kind === "web_list" && Object.hasOwn(source.config ?? {}, "pagination")) ||
    Object.hasOwn(source.cursor ?? {}, BACKFILL_CURSOR_KEY);
}
export const WEB_LIST_BACKFILL_DEADLINE_MS = 120_000;

/** The explicitly supported URL-numbering rule; page zero is always the configured directory URL. */
export function webListPageUrl(listUrl: string, pageIndex: number): string {
  if (!Number.isSafeInteger(pageIndex) || pageIndex < 0 || pageIndex > MAX_PAGE_INDEX) throw new Error("invalid web-list page index");
  if (pageIndex === 0) return listUrl;
  return new URL(`index_${pageIndex}.htm`, listUrl).toString();
}

/** Phase A never treats its own listing or a numbered sibling page as an article candidate. */
export function isWebListPaginationUrl(listUrl: string, candidateUrl: string): boolean {
  try {
    const base = new URL(listUrl);
    const candidate = new URL(candidateUrl);
    if (candidate.origin !== base.origin || !candidate.pathname.startsWith(base.pathname)) return false;
    if (candidate.pathname === base.pathname) return true;
    return /^index_\d+\.htm$/i.test(candidate.pathname.slice(base.pathname.length));
  } catch {
    return false;
  }
}

export function webListPageIndex(listUrl: string, candidate: string): number | null {
  const base = new URL(listUrl);
  const target = new URL(candidate);
  if (target.origin !== base.origin || target.search || target.hash || !target.pathname.startsWith(base.pathname)) return null;
  if (target.pathname === base.pathname) return 0;
  const name = target.pathname.slice(base.pathname.length);
  const match = /^index_([1-9]\d*)\.htm$/i.exec(name);
  if (!match) return null;
  const index = Number(match[1]);
  return Number.isSafeInteger(index) && index <= MAX_PAGE_INDEX ? index : null;
}

/** Config hash includes every field that can change what is fetched or admitted on a list page. */
export function webListPaginationConfigHash(source: SourceRow): string {
  const config = source.config;
  return sha256(stableJson({
    kind: source.kind,
    url: config.url,
    pagination: config.pagination,
    parseMode: config.parseMode ?? "html",
    itemSelector: config.itemSelector,
    linkSelector: config.linkSelector,
    titleSelector: config.titleSelector,
    titleAttribute: config.titleAttribute,
    publishedAtSelector: config.publishedAtSelector,
    publishedAtRegex: config.publishedAtRegex,
    publishedAtUtcOffset: config.publishedAtUtcOffset,
    preserveUrlFragment: config.preserveUrlFragment,
    allowUrlPrefixes: config.allowUrlPrefixes,
    denyUrlPrefixes: config.denyUrlPrefixes,
    ingestNoiseFilter: config.ingestNoiseFilter,
    itemUrlPrefixRewrite: config.itemUrlPrefixRewrite,
    sortByPublishedAt: config.sortByPublishedAt,
    detail: config.detail,
    backfill: {
      months: config._aihot?.initialBackfillMonths,
      limit: config._aihot?.initialBackfillLimit,
      requirePublishedAt: config._aihot?.initialBackfillRequirePublishedAt,
    },
  }));
}

export function readWebListPagination(config: Record<string, unknown>): MofIndexPaginationConfig | null {
  const value = config.pagination;
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (p.mode !== "mof_index_v1" || !isIntegerInRange(p.maxPagesPerRun, 1, MAX_PAGES_PER_RUN) ||
      !isIntegerInRange(p.maxDispatches, 1, MAX_DISPATCHES) || !isIntegerInRange(p.maxPageIndex, 1, MAX_PAGE_INDEX)) return null;
  return {
    mode: "mof_index_v1",
    maxPagesPerRun: p.maxPagesPerRun as number,
    maxDispatches: p.maxDispatches as number,
    maxPageIndex: p.maxPageIndex as number,
  };
}

export function validateWebListPagination(kind: SourceRow["kind"], config: Record<string, unknown>): string[] {
  if (!Object.hasOwn(config, "pagination")) return [];
  const errors: string[] = [];
  if (kind !== "web_list") errors.push("pagination is only supported by web_list");
  const value = config.pagination;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push("pagination must be an object");
    return errors;
  }
  const p = value as Record<string, unknown>;
  for (const key of Object.keys(p)) if (!(PAGINATION_KEYS as readonly string[]).includes(key)) errors.push(`pagination.${key}`);
  if (p.mode !== "mof_index_v1") errors.push("pagination.mode must be mof_index_v1");
  if (!isIntegerInRange(p.maxPagesPerRun, 1, MAX_PAGES_PER_RUN)) errors.push("pagination.maxPagesPerRun must be an integer from 1 to 2");
  if (!isIntegerInRange(p.maxDispatches, 1, MAX_DISPATCHES)) errors.push("pagination.maxDispatches must be an integer from 1 to 12");
  if (!isIntegerInRange(p.maxPageIndex, 1, MAX_PAGE_INDEX)) errors.push("pagination.maxPageIndex must be an integer from 1 to 100");

  try {
    const url = new URL(String(config.url ?? ""));
    if (url.protocol !== "https:" || !/^[a-z0-9-]+\.mof\.gov\.cn$/i.test(url.hostname) ||
        url.port || url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/")) {
      errors.push("pagination requires an HTTPS single-subdomain .mof.gov.cn directory URL without query, fragment, or credentials");
    }
    const prefixes = config.allowUrlPrefixes;
    const base = `${url.origin}${url.pathname}`;
    if (!Array.isArray(prefixes) || prefixes.length !== 1 || prefixes[0] !== base) errors.push("pagination requires allowUrlPrefixes to contain only the exact listing directory");
  } catch {
    errors.push("pagination requires a valid listing directory URL");
  }

  if (config.parseMode !== undefined && config.parseMode !== "html") errors.push("pagination supports HTML only");
  if (config.adapter !== undefined) errors.push("pagination cannot use an adapter");
  if (config.baseUrl !== undefined) errors.push("pagination cannot use baseUrl");
  if (config.itemUrlPrefixRewrite !== undefined) errors.push("pagination cannot use itemUrlPrefixRewrite");
  if (config.preserveUrlFragment === true) errors.push("pagination does not support fragment-based list identities");
  if (!config.itemSelector || !config.linkSelector || !config.titleSelector ||
      (!config.publishedAtSelector && !config.publishedAtRegex)) {
    errors.push("pagination requires item, link, title, and published-date selectors or regex");
  }
  const backfill = config._aihot as Record<string, unknown> | undefined;
  if (backfill?.initialBackfillRequirePublishedAt !== true) errors.push("pagination requires _aihot.initialBackfillRequirePublishedAt=true");
  if (backfill?.initialBackfillMonths !== undefined && !isPositiveFinite(backfill.initialBackfillMonths)) errors.push("pagination requires a finite positive _aihot.initialBackfillMonths");
  if (backfill?.initialBackfillLimit !== undefined && !isPositiveFiniteInteger(backfill.initialBackfillLimit)) errors.push("pagination requires a positive integer _aihot.initialBackfillLimit");
  const detail = config.detail as Record<string, unknown> | undefined;
  if (detail && detail.maxFetches !== undefined && detail.maxFetches !== 0) errors.push("pagination phase A requires detail.maxFetches to be absent or 0");
  if (detail?.publishedAtAuthoritative === true) errors.push("pagination phase A cannot use authoritative detail dates");
  return [...new Set(errors)];
}

export function newWebListBackfillCursor(source: SourceRow, now = new Date()): WebListBackfillCursor {
  const months = Number(source.config._aihot?.initialBackfillMonths ?? 12);
  const anchorAt = now.toISOString();
  return {
    v: 1,
    generationId: randomUUID(),
    configHash: webListPaginationConfigHash(source),
    anchorAt,
    cutoffAt: new Date(now.getTime() - months * 30 * DAY_MS).toISOString(),
    nextPageIndex: 0,
    pagesCommitted: 0,
    lastPageFingerprint: null,
    lastPageIdentityHashes: null,
    state: "active",
    coverage: "unproven",
    stopReason: null,
    updatedAt: anchorAt,
  };
}

export function webListPageFingerprint(candidates: Candidate[], sourceId?: string): string {
  const identities = candidates.map((candidate) => sourceId
    ? identityKeyFor({ ...candidate, sourceId, via: "fetch" })
    : candidate.url);
  return sha256(stableJson(identities.sort()));
}

/** A source-run budget shared by every page request and redirect hop in that run. */
export function createWebListPaginationBudget(
  source: SourceRow,
  pagination: MofIndexPaginationConfig,
): {
  runBudget: GuardedFetchRunBudget;
  dispatchesUsed(): number;
  setCurrentPage(pageIndex: number): void;
  markPageCommitted(pageIndex: number): void;
  assertActive(): void;
  remainingMs(): number;
  dispose(): void;
} {
  const base = new URL(String(source.config.url));
  const controller = new AbortController();
  const deadlineAt = Date.now() + WEB_LIST_BACKFILL_DEADLINE_MS;
  const timer = setTimeout(() => controller.abort(new Error("web-list run deadline exceeded")), WEB_LIST_BACKFILL_DEADLINE_MS);
  timer.unref?.();
  const signal = controller.signal;
  const committed = new Set<number>();
  const dispatchedUrls = new Set<string>();
  let dispatches = 0;
  let currentPageIndex: number | null = null;
  const assertActive = () => {
    if (Date.now() >= deadlineAt && !signal.aborted) controller.abort(new Error("web-list run deadline exceeded"));
    signal.throwIfAborted();
  };
  const runBudget: GuardedFetchRunBudget = {
    signal,
    beforeDispatch({ url, redirectHop }) {
      assertActive();
      if (dispatches >= pagination.maxDispatches) throw new Error(`web-list dispatch budget exhausted (${pagination.maxDispatches})`);
      const dispatchUrl = url.toString();
      if (dispatchedUrls.has(dispatchUrl)) throw new Error("web-list dispatch URL already visited");
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || url.search || url.hash) {
        throw new Error("web-list dispatch outside configured listing directory");
      }
      if (redirectHop === 0 && (currentPageIndex === null || webListPageIndex(String(source.config.url), url.toString()) !== currentPageIndex)) {
        throw new Error("web-list dispatch does not match the current page");
      }
      dispatches += 1;
      dispatchedUrls.add(dispatchUrl);
    },
    allowRedirect({ to }) {
      assertActive();
      if (to.origin !== base.origin || !to.pathname.startsWith(base.pathname) || to.search || to.hash) return false;
      const redirectedPage = webListPageIndex(String(source.config.url), to.toString());
      return currentPageIndex !== null && redirectedPage === currentPageIndex && !committed.has(redirectedPage) && !dispatchedUrls.has(to.toString());
    },
  };
  return {
    runBudget,
    dispatchesUsed: () => dispatches,
    setCurrentPage(pageIndex) {
      if (!Number.isSafeInteger(pageIndex) || pageIndex < 0) throw new Error("invalid current page index");
      currentPageIndex = pageIndex;
    },
    markPageCommitted(pageIndex) {
      committed.add(pageIndex);
    },
    assertActive,
    remainingMs: () => Math.max(0, deadlineAt - Date.now()),
    dispose() { clearTimeout(timer); },
  };
}

/** Runs one resumable, explicitly opted-in list backfill under a session advisory lock. */
export async function collectWebListBackfill(sourceId: string, options: PaginatedWebListRunOptions = {}): Promise<PaginatedWebListRunResult> {
  const reserved = await sql.reserve();
  const lockKey = `web-list-backfill:${sourceId}`;
  let locked = false;
  let runId: number | null = null;
  let runSource: SourceRow | null = null;
  let cursor: WebListBackfillCursor | null = null;
  let pagination: MofIndexPaginationConfig | null = null;
  let budget: ReturnType<typeof createWebListPaginationBudget> | null = null;
  let found = 0;
  let created = 0;
  let revised = 0;
  let pagesFetched = 0;
  let rowsUndated = 0;
  let rowsOutsideWindow = 0;
  let stopReason = "starting";

  const result = (status: PaginatedWebListRunResult["status"], error?: string): PaginatedWebListRunResult => ({
    sourceId, status, found, created, revised, ...(error ? { error } : {}),
  });
  const makeRunDetail = (): WebListBackfillRunDetail => ({
    v: 1,
    generationId: cursor?.generationId ?? "uninitialized",
    coverage: "unproven",
    partial: true,
    stopReason,
    nextPageIndex: cursor?.nextPageIndex ?? 0,
    pagesFetched,
    pagesCommitted: cursor?.pagesCommitted ?? 0,
    dispatchesUsed: budget?.dispatchesUsed() ?? 0,
    maxDispatches: pagination?.maxDispatches ?? 0,
    created,
    revised,
    rowsUndated,
    rowsOutsideWindow,
  });
  const writeRun = async (status: "running" | "ok" | "failed" | "skipped", error: string | null = null) => {
    if (runId === null) return;
    const detail = makeRunDetail();
    await reserved`UPDATE fetch_runs SET status = ${status}, finished_at = CASE WHEN ${status} = 'running' THEN NULL ELSE now() END,
      found_count = ${found}, new_count = ${created}, error = ${error}, detail = ${sql.json(detail as never)} WHERE id = ${runId}`;
  };
  const updateCursorStop = async (state: WebListBackfillState, reason: string) => {
    if (!runSource || !cursor) return;
    await withReservedTransaction(reserved, async (tx) => {
      await setTransactionDeadline(tx, budget);
      const [row] = await tx<{ cursor: Record<string, unknown> | null; config: Record<string, unknown>; kind: SourceRow["kind"] }[]>`
        SELECT cursor, config, kind FROM sources WHERE id = ${sourceId} FOR UPDATE`;
      const persisted = row?.cursor?.[BACKFILL_CURSOR_KEY] as WebListBackfillCursor | undefined;
      if (!row || !cursor || !persisted || persisted.generationId !== cursor.generationId) return;
      const currentHash = webListPaginationConfigHash({ ...runSource!, config: row.config, kind: row.kind });
      if (state !== "config_changed" && currentHash !== cursor.configHash) return;
      cursor = { ...persisted, state, stopReason: reason, updatedAt: new Date().toISOString() };
      await tx`UPDATE sources SET cursor = ${tx.json({ ...(row.cursor ?? {}), [BACKFILL_CURSOR_KEY]: cursor } as never)}, updated_at = now() WHERE id = ${sourceId}`;
    }, budget);
  };

  try {
    const [lock] = await reserved<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(hashtext(${lockKey})) AS locked`;
    locked = !!lock?.locked;
    if (!locked) {
      const [row] = await reserved<{ id: number }[]>`INSERT INTO fetch_runs (source_id, status, finished_at, error, detail)
        SELECT id, 'skipped', now(), 'pagination source already has an active collector', ${sql.json({ pagination: { v: 1, coverage: "unproven", partial: true, stopReason: "concurrent_run" } })}
        FROM sources WHERE id = ${sourceId} RETURNING id`;
      runId = row?.id ?? null;
      return result("skipped", "concurrent_run");
    }

    runSource = await loadPaginatedSource(reserved, sourceId);
    if (!runSource) return result("skipped", "missing");
    const hasExistingGeneration = Object.hasOwn(runSource.cursor ?? {}, BACKFILL_CURSOR_KEY);
    if (!hasExistingGeneration && (runSource.kind !== "web_list" || !Object.hasOwn(runSource.config ?? {}, "pagination"))) {
      return result("skipped", "pagination_not_configured");
    }
    if (!runSource.enabled && !options.force) return result("skipped", "paused");
    const [run] = await reserved<{ id: number }[]>`INSERT INTO fetch_runs (source_id) VALUES (${sourceId}) RETURNING id`;
    runId = run!.id;

    const configHash = webListPaginationConfigHash(runSource);
    const hasSavedCursor = Object.hasOwn(runSource.cursor ?? {}, BACKFILL_CURSOR_KEY);
    const previousCursor = runSource.cursor?.[BACKFILL_CURSOR_KEY] as WebListBackfillCursor | undefined;
    if (hasSavedCursor) {
      cursor = previousCursor ?? null;
      if (!cursor || !isWebListBackfillCursor(cursor)) {
        stopReason = "invalid_cursor";
        await writeRun("failed", "invalid pagination cursor requires review");
        return result("failed", "invalid pagination cursor requires review");
      }
      if (cursor.configHash !== configHash) {
        stopReason = "config_changed";
        await updateCursorStop("config_changed", stopReason);
        await writeRun("failed", "pagination config changed; explicit review required");
        return result("failed", "config_changed");
      }
      if (cursor.state !== "active") {
        stopReason = cursor.stopReason ?? cursor.state;
        await writeRun("failed", `pagination generation is ${cursor.state}; explicit review required`);
        return result("failed", stopReason);
      }
    } else {
      const configErrors = options.validateConfig?.(runSource) ?? validateWebListPagination(runSource.kind, runSource.config);
      pagination = readWebListPagination(runSource.config);
      if (configErrors.length || !pagination) {
        const reason = `unsupported config: ${configErrors.join(", ") || "pagination"}`;
        stopReason = "invalid_config";
        await writeRun("failed", reason);
        return result("failed", reason);
      }
      budget = createWebListPaginationBudget(runSource, pagination);
      if (runSource.cursor?.initializedAt) {
        stopReason = "initialized_source_requires_review";
        await writeRun("failed", "pagination opt-in on an initialized source requires explicit review");
        return result("failed", stopReason);
      }
      cursor = newWebListBackfillCursor(runSource);
      const next = { ...(runSource.cursor ?? {}), [BACKFILL_CURSOR_KEY]: cursor };
      await withReservedTransaction(reserved, async (tx) => {
        await setTransactionDeadline(tx, budget);
        const [row] = await tx<{ config: Record<string, unknown>; kind: SourceRow["kind"]; cursor: Record<string, unknown> | null }[]>`
          SELECT config, kind, cursor FROM sources WHERE id = ${sourceId} FOR UPDATE`;
        if (!row || webListPaginationConfigHash({ ...runSource!, config: row.config, kind: row.kind }) !== cursor!.configHash || row.cursor?.initializedAt) {
          throw new PaginationConfigChangedError("source config/cursor changed before generation initialization");
        }
        await tx`UPDATE sources SET cursor = ${tx.json(next as never)}, updated_at = now() WHERE id = ${sourceId}`;
      }, budget);
      runSource = { ...runSource, cursor: next };
    }

    const configErrors = options.validateConfig?.(runSource) ?? validateWebListPagination(runSource.kind, runSource.config);
    pagination = readWebListPagination(runSource.config);
    if (configErrors.length || !pagination) {
      stopReason = "config_changed";
      await updateCursorStop("config_changed", stopReason);
      await writeRun("failed", `unsupported config: ${configErrors.join(", ") || "pagination"}`);
      return result("failed", stopReason);
    }

    budget ??= createWebListPaginationBudget(runSource, pagination);
    await writeRun("running");
    const windowCutoff = Date.parse(cursor.cutoffAt);
    const anchorAt = new Date(cursor.anchorAt);
    if (!Number.isFinite(windowCutoff) || !Number.isFinite(anchorAt.getTime())) {
      stopReason = "invalid_anchor";
      await updateCursorStop("blocked", stopReason);
      await writeRun("failed", "pagination cursor has invalid fixed date window");
      return result("failed", stopReason);
    }

    const pageReader = options.fetchPage ?? ((source, listUrl, runBudget) => fetchWebList(source, { listUrl, runBudget }));
    while (pagesFetched < pagination.maxPagesPerRun) {
      budget.assertActive();
      if (!cursor || cursor.state !== "active") break;
      if (budget.dispatchesUsed() >= pagination.maxDispatches) {
        stopReason = "max_dispatches_per_run";
        break;
      }
      if (cursor.nextPageIndex > pagination.maxPageIndex) {
        stopReason = "max_page_index";
        await updateCursorStop("blocked", stopReason);
        await writeRun("failed", "pagination reached maxPageIndex without a completeness proof");
        return result("failed", stopReason);
      }

      // Recheck semantic configuration immediately before each network page.
      runSource = await loadPaginatedSource(reserved, sourceId);
      if (!runSource || runSource.kind !== "web_list" || webListPaginationConfigHash(runSource) !== cursor.configHash) {
        stopReason = "config_changed";
        await updateCursorStop("config_changed", stopReason);
        await writeRun("failed", "pagination config changed before page request");
        return result("failed", stopReason);
      }
      const pageIndex = cursor.nextPageIndex;
      const listUrl = webListPageUrl(String(runSource.config.url), pageIndex);
      budget.setCurrentPage(pageIndex);
      let pageCandidates: Candidate[];
      try {
        pageCandidates = await pageReader(runSource, listUrl, budget.runBudget);
      } catch (error) {
        const message = errorMessage(error);
        const blocked = /no items matched|HTTP 404|outside configured listing directory|does not match the current page|redirect/i.test(message);
        stopReason = blocked ? "page_unavailable_or_invalid" : "page_fetch_failed";
        if (blocked) await updateCursorStop("blocked", stopReason);
        await failSourceRun(reserved, sourceId, error, runId!, found, created, makeRunDetail());
        return result("failed", message);
      }
      pagesFetched += 1;
      found += pageCandidates.length;
      budget.assertActive();

      const itemLimit = Math.min(Number(runSource.config._aihot?.initialBackfillLimit ?? 30), 60);
      if (pageCandidates.length === 0 || pageCandidates.length > itemLimit) {
        stopReason = pageCandidates.length === 0 ? "empty_page" : "page_item_limit_exceeded";
        await updateCursorStop("blocked", stopReason);
        await writeRun("failed", pageCandidates.length === 0 ? "pagination page returned no candidates" : `pagination page exceeds item cap ${itemLimit}`);
        return result("failed", stopReason);
      }

      const filtered: Candidate[] = [];
      const seenIdentity = new Set<string>();
      for (const candidate of pageCandidates) {
        if (isWebListPaginationUrl(String(runSource!.config.url), candidate.url)) continue;
        if (!allowed(candidate.url, runSource!) || sourceNoiseFiltered(candidate, runSource!)) continue;
        const key = identityKeyFor({ ...candidate, sourceId, via: "fetch" });
        if (seenIdentity.has(key)) continue;
        seenIdentity.add(key);
        filtered.push(candidate);
      }
      const pageFingerprint = webListPageFingerprint(filtered, sourceId);
      if (cursor.lastPageFingerprint === pageFingerprint) {
        stopReason = "repeated_page";
        await updateCursorStop("blocked", stopReason);
        await writeRun("failed", "pagination returned the same page identity sequence twice");
        return result("failed", stopReason);
      }
      const pageIdentityHashes = webListPageIdentityHashes(filtered, sourceId);
      const previousIdentityHashes = new Set(cursor.lastPageIdentityHashes ?? []);
      if (pageIdentityHashes.length === 0 || (previousIdentityHashes.size > 0 &&
          !pageIdentityHashes.some((identityHash) => !previousIdentityHashes.has(identityHash)))) {
        stopReason = "page_no_new_identity";
        await updateCursorStop("blocked", stopReason);
        await writeRun("failed", "pagination page contains no identities beyond the previous committed page");
        return result("failed", stopReason);
      }

      const eligible: Candidate[] = [];
      let pageUndated = 0;
      let pageOutside = 0;
      for (const candidate of filtered) {
        const claimed = candidate.publishedAt instanceof Date ? candidate.publishedAt : null;
        const trusted = decideTimeline(claimed, anchorAt, "first-import").publishedAt;
        if (!trusted) {
          pageUndated += 1;
          continue;
        }
        if (trusted.getTime() < windowCutoff) {
          pageOutside += 1;
          continue;
        }
        eligible.push({ ...candidate, publishedAt: trusted });
      }
      rowsUndated += pageUndated;
      rowsOutsideWindow += pageOutside;
      if (pageUndated > 0) {
        stopReason = "undated_rows_require_review";
        await updateCursorStop("blocked", stopReason);
        await writeRun("failed", `${pageUndated} candidate(s) have missing or untrusted publication dates`);
        return result("failed", stopReason);
      }
      budget.assertActive();

      const commitResult = await commitPaginationPage(reserved, sourceId, runId!, runSource, cursor, pageIndex,
        pageCandidates.length, eligible, pageFingerprint, pageIdentityHashes, budget, makeRunDetail);
      if (commitResult.kind === "config_changed") {
        cursor = commitResult.cursor;
        stopReason = "config_changed";
        await writeRun("failed", "pagination config changed before page checkpoint");
        return result("failed", stopReason);
      }
      if (commitResult.kind === "cursor_changed") {
        stopReason = "cursor_changed";
        await writeRun("failed", "pagination cursor changed before page checkpoint");
        return result("failed", stopReason);
      }
      cursor = commitResult.cursor;
      created += commitResult.created;
      revised += commitResult.revised;
      budget.markPageCommitted(pageIndex);
      runSource = { ...runSource, cursor: { ...(runSource.cursor ?? {}), [BACKFILL_CURSOR_KEY]: cursor } };
      budget.assertActive();

      if (pageIndex >= pagination.maxPageIndex) {
        stopReason = "max_page_index";
        await updateCursorStop("blocked", stopReason);
        await writeRun("failed", "pagination reached maxPageIndex without a completeness proof");
        return result("failed", stopReason);
      }
      stopReason = "max_pages_per_run";
    }

    budget.assertActive();
    if (stopReason === "starting") stopReason = "max_pages_per_run";
    if (cursor) await updateCursorStop("active", stopReason);
    await reserved`UPDATE sources SET last_fetch_at = now(), last_ok_at = now(), fail_count = 0, last_error = NULL,
      health = 'ok', updated_at = now(), next_fetch_at = now() + make_interval(mins => interval_minutes) WHERE id = ${sourceId}`;
    await writeRun("ok");
    return result("ok");
  } catch (error) {
    const message = errorMessage(error).slice(0, 1000);
    stopReason = error instanceof PaginationConfigChangedError ? "config_changed" : "run_failed";
    if (error instanceof PaginationConfigChangedError && cursor) await updateCursorStop("config_changed", stopReason);
    if (runId !== null) await failSourceRun(reserved, sourceId, error, runId, found, created, makeRunDetail());
    return result(runId === null ? "skipped" : "failed", message);
  } finally {
    budget?.dispose();
    if (locked) {
      try { await reserved`SELECT pg_advisory_unlock(hashtext(${lockKey}))`; } catch { /* releasing the connection also releases its session lock */ }
    }
    reserved.release();
  }
}

async function loadPaginatedSource(db: Awaited<ReturnType<typeof sql.reserve>>, sourceId: string): Promise<SourceRow | null> {
  const [source] = await db<SourceRow[]>`SELECT id, name, kind, config, tier, participation_mode, first_party, interval_minutes,
      enabled, cursor, fail_count FROM sources WHERE id = ${sourceId}`;
  return source ?? null;
}

async function commitPaginationPage(
  reserved: Awaited<ReturnType<typeof sql.reserve>>,
  sourceId: string,
  runId: number,
  source: SourceRow,
  expectedCursor: WebListBackfillCursor,
  pageIndex: number,
  pageFound: number,
  candidates: Candidate[],
  fingerprint: string,
  pageIdentityHashes: string[],
  budget: NonNullable<ReturnType<typeof createWebListPaginationBudget>>,
  detail: () => WebListBackfillRunDetail,
): Promise<{ kind: "committed"; cursor: WebListBackfillCursor; created: number; revised: number } | { kind: "config_changed"; cursor: WebListBackfillCursor } | { kind: "cursor_changed" }> {
  return withReservedTransaction(reserved, async (tx) => {
    await setTransactionDeadline(tx, budget);
    const [row] = await tx<{ config: Record<string, unknown>; kind: SourceRow["kind"]; cursor: Record<string, unknown> | null }[]>`
      SELECT config, kind, cursor FROM sources WHERE id = ${sourceId} FOR UPDATE`;
    if (!row) return { kind: "cursor_changed" } as const;
    const currentSource = { ...source, config: row.config, kind: row.kind };
    const currentCursor = row.cursor?.[BACKFILL_CURSOR_KEY] as WebListBackfillCursor | undefined;
    if (webListPaginationConfigHash(currentSource) !== expectedCursor.configHash) {
      const changed = { ...expectedCursor, state: "config_changed" as const, stopReason: "config_changed", updatedAt: new Date().toISOString() };
      await tx`UPDATE sources SET cursor = ${tx.json({ ...(row.cursor ?? {}), [BACKFILL_CURSOR_KEY]: changed } as never)}, updated_at = now() WHERE id = ${sourceId}`;
      return { kind: "config_changed", cursor: changed } as const;
    }
    if (!currentCursor || currentCursor.generationId !== expectedCursor.generationId || currentCursor.nextPageIndex !== pageIndex || currentCursor.state !== "active") {
      return { kind: "cursor_changed" } as const;
    }
    let created = 0;
    let revised = 0;
    for (const candidate of candidates) {
      budget.assertActive();
      const material = { ...candidate, sourceId, via: "fetch" as const, backfill: "first-import" };
      const saved = await upsertMaterial(material, tx);
      if (saved.created) created += 1;
      if (saved.revised) revised += 1;
      if (saved.created || saved.revised) await queueProcessing(saved.articleId, { db: tx });
    }
    budget.assertActive();
    const nextCursor: WebListBackfillCursor = {
      ...expectedCursor,
      nextPageIndex: pageIndex + 1,
      pagesCommitted: expectedCursor.pagesCommitted + 1,
      lastPageFingerprint: fingerprint,
      lastPageIdentityHashes: pageIdentityHashes,
      state: "active",
      coverage: "unproven",
      stopReason: null,
      updatedAt: new Date().toISOString(),
    };
    const current = detail();
    const detailNow = { ...current, nextPageIndex: nextCursor.nextPageIndex, pagesCommitted: nextCursor.pagesCommitted,
      created: current.created + created, revised: current.revised + revised, stopReason: "page_checkpointed" };
    await tx`UPDATE sources SET cursor = ${tx.json({ ...(row.cursor ?? {}), [BACKFILL_CURSOR_KEY]: nextCursor } as never)}, updated_at = now() WHERE id = ${sourceId}`;
    await tx`UPDATE fetch_runs SET found_count = found_count + ${pageFound}, new_count = new_count + ${created},
      detail = ${tx.json(detailNow as never)} WHERE id = ${runId}`;
    budget.assertActive();
    return { kind: "committed", cursor: nextCursor, created, revised } as const;
  }, budget);
}

async function setTransactionDeadline(tx: Tx, budget: ReturnType<typeof createWebListPaginationBudget> | null): Promise<void> {
  if (!budget) return;
  budget.assertActive();
  const remaining = Math.max(1, Math.floor(budget.remainingMs()));
  await tx`SELECT set_config('statement_timeout', ${`${remaining}ms`}, true)`;
}

/** postgres.js 3.4.9 reserves a callable connection but does not implement `begin()` on it. */
async function withReservedTransaction<T>(
  reserved: Awaited<ReturnType<typeof sql.reserve>>,
  run: (tx: Tx) => Promise<T>,
  budget: ReturnType<typeof createWebListPaginationBudget> | null = null,
): Promise<T> {
  await reserved`BEGIN`;
  try {
    const result = await run(reserved as unknown as Tx);
    await setTransactionDeadline(reserved as unknown as Tx, budget);
    budget?.assertActive();
    await reserved`COMMIT`;
    return result;
  } catch (error) {
    try { await reserved`ROLLBACK`; } catch { /* the connection will be released after rollback failure */ }
    throw error;
  }
}

async function failSourceRun(
  db: Awaited<ReturnType<typeof sql.reserve>>,
  sourceId: string,
  error: unknown,
  runId: number,
  found: number,
  created: number,
  detail: WebListBackfillRunDetail,
): Promise<void> {
  const message = errorMessage(error).slice(0, 1000);
  await db`UPDATE sources SET last_fetch_at = now(), fail_count = fail_count + 1, last_error = ${message},
    health = CASE WHEN fail_count + 1 >= 5 THEN 'failing' ELSE 'degraded' END,
    next_fetch_at = now() + make_interval(mins => LEAST(interval_minutes * (fail_count + 2), 360)), updated_at = now() WHERE id = ${sourceId}`;
  await db`UPDATE fetch_runs SET status = 'failed', finished_at = now(), found_count = ${found}, new_count = ${created},
    error = ${message}, detail = ${sql.json(detail as never)} WHERE id = ${runId}`;
}

function isWebListBackfillCursor(value: WebListBackfillCursor): boolean {
  return !!value && value.v === 1 && typeof value.generationId === "string" && typeof value.configHash === "string" &&
    typeof value.anchorAt === "string" && typeof value.cutoffAt === "string" && Number.isSafeInteger(value.nextPageIndex) &&
    Number.isSafeInteger(value.pagesCommitted) && (value.state === "active" || value.state === "blocked" || value.state === "config_changed") &&
    value.coverage === "unproven" && (value.lastPageIdentityHashes === undefined || value.lastPageIdentityHashes === null ||
      (Array.isArray(value.lastPageIdentityHashes) && value.lastPageIdentityHashes.length <= 60 &&
        value.lastPageIdentityHashes.every((hash) => /^[0-9a-f]{64}$/.test(hash))));
}

function webListPageIdentityHashes(candidates: Candidate[], sourceId: string): string[] {
  const hashes = candidates.map((candidate) => sha256(identityKeyFor({ ...candidate, sourceId, via: "fetch" })));
  return [...new Set(hashes)].sort();
}

function sourceNoiseFiltered(candidate: Candidate, source: SourceRow): boolean {
  const filter = source.config.ingestNoiseFilter;
  if (!filter) return false;
  const has = (text: string, words: string[] | undefined) => (words ?? []).some((word) => text.includes(word.toLowerCase()));
  const title = candidate.title.toLowerCase();
  const hay = `${title}\n${(candidate.excerpt ?? "").toLowerCase()}`;
  if (has(hay, filter.keepIfMatches)) return false;
  return has(title, filter.dropMarkersTitleOnly) || has(hay, filter.dropMarkers);
}

function errorMessage(error: unknown): string {
  return String(error instanceof Error ? error.message : error);
}

class PaginationConfigChangedError extends Error {}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isPositiveFiniteInteger(value: unknown): value is number {
  return isPositiveFinite(value) && Number.isSafeInteger(value);
}
