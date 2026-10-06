import { randomUUID } from "node:crypto";
import { sql, type Tx } from "../db.ts";
import { decideTimeline, identityKeyFor, upsertMaterial } from "../content/materials.ts";
import { queueProcessing } from "../jobs/content.ts";
import { sha256, stableJson } from "../lib/ids.ts";
import { guardedFetch, type GuardedFetchRunBudget } from "../lib/http-fetch.ts";
import { allowed, fetchWebList, fetchWebListMetadata, type WebListMetadataNeed, type WebListMetadataResult } from "./web-list.ts";
import { FetchError, type Candidate, type SourceRow } from "./types.ts";

export interface MofIndexPaginationConfig {
  mode: "mof_index_v1";
  maxPagesPerRun: number;
  maxDispatches: number;
  maxPageIndex: number;
  detailMode?: "direct_html_metadata_v1";
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
  /** One bounded HTML metadata page that may resume over ordinary collector runs. */
  pendingPage?: PendingWebListPage;
  state: WebListBackfillState;
  coverage: "unproven";
  stopReason: string | null;
  updatedAt: string;
}

export type PendingMetadataFieldSource = "list" | "configured_rule";
export type PendingMetadataOutcome = "outside_window" | "noise" | "duplicate";

export interface PendingWebListCandidate {
  identityHash: string;
  url: string;
  listTitle: string;
  listPublishedAt: string | null;
  state: "pending" | "resolved" | "excluded";
  resolvedTitle?: string;
  resolvedPublishedAt?: string | null;
  titleSource?: PendingMetadataFieldSource;
  dateSource?: PendingMetadataFieldSource;
  outcome?: PendingMetadataOutcome;
}

export interface PendingWebListPage {
  pageIndex: number;
  snapshotAt: string;
  fingerprint: string;
  metadataHash: string;
  candidates: PendingWebListCandidate[];
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
  detailTargetsUsed?: number;
  pendingRows?: number;
  pagesCommittedThisRun?: number;
}

const PAGINATION_KEYS = ["mode", "maxPagesPerRun", "maxDispatches", "maxPageIndex", "detailMode"] as const;
const MAX_PAGES_PER_RUN = 2;
const MAX_DISPATCHES = 12;
const MAX_PAGE_INDEX = 100;
const DAY_MS = 86_400_000;
const BACKFILL_CURSOR_KEY = "webListBackfill";
export const WEB_LIST_PENDING_PAGE_MAX_BYTES = 256 * 1024;
export const WEB_LIST_PENDING_PAGE_MAX_ROWS = 60;
export const WEB_LIST_PENDING_URL_MAX_CHARS = 2048;
export const WEB_LIST_PENDING_TITLE_MAX_CHARS = 1000;

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
  /** Synthetic guarded transport seam; the metadata API still enforces target admission and budget dispatch. */
  testMetadataFetcher?: typeof guardedFetch;
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
  if (Object.hasOwn(p, "detailMode") && p.detailMode !== "direct_html_metadata_v1") return null;
  if (p.mode !== "mof_index_v1" || !isIntegerInRange(p.maxPagesPerRun, 1, MAX_PAGES_PER_RUN) ||
      !isIntegerInRange(p.maxDispatches, 1, MAX_DISPATCHES) || !isIntegerInRange(p.maxPageIndex, 1, MAX_PAGE_INDEX)) return null;
  return {
    mode: "mof_index_v1",
    maxPagesPerRun: p.maxPagesPerRun as number,
    maxDispatches: p.maxDispatches as number,
    maxPageIndex: p.maxPageIndex as number,
    ...(p.detailMode === "direct_html_metadata_v1" ? { detailMode: "direct_html_metadata_v1" as const } : {}),
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
  if (p.detailMode === undefined) {
    if (detail && detail.maxFetches !== undefined && detail.maxFetches !== 0) errors.push("pagination phase A requires detail.maxFetches to be absent or 0");
    if (detail?.publishedAtAuthoritative === true) errors.push("pagination phase A cannot use authoritative detail dates");
  } else if (p.detailMode === "direct_html_metadata_v1") {
    errors.push(...validateWebListMetadataConfig(kind, config));
  } else {
    errors.push("pagination.detailMode must be direct_html_metadata_v1");
  }
  return [...new Set(errors)];
}

/** Stage B's explicit opt-in contract. This is separate from legacy detail validation. */
export function validateWebListMetadataConfig(kind: SourceRow["kind"], config: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (kind !== "web_list") errors.push("metadata detail mode is only supported by web_list");
  const detail = config.detail;
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
    errors.push("metadata detail mode requires detail object");
    return errors;
  }
  const d = detail as Record<string, unknown>;
  if (!isIntegerInRange(d.maxFetches, 1, 10)) errors.push("detail.maxFetches must be an integer from 1 to 10");
  const titleRule = isNonEmptyRule(d.titleSelector) || isNonEmptyRule(d.titleRegex);
  const dateRule = isNonEmptyRule(d.publishedAtSelector) || isNonEmptyRule(d.publishedAtRegex);
  if (!titleRule && !dateRule) errors.push("metadata detail mode requires a configured title or publication-date rule");
  if (d.titleAuthoritative !== undefined && typeof d.titleAuthoritative !== "boolean") errors.push("detail.titleAuthoritative must be boolean");
  if (d.publishedAtAuthoritative !== undefined && typeof d.publishedAtAuthoritative !== "boolean") errors.push("detail.publishedAtAuthoritative must be boolean");
  if (d.upgradeDatePrecision !== undefined && typeof d.upgradeDatePrecision !== "boolean") errors.push("detail.upgradeDatePrecision must be boolean");
  if (d.titleAuthoritative === true && !titleRule) errors.push("detail.titleAuthoritative requires a title rule");
  if (d.publishedAtAuthoritative === true && !dateRule) errors.push("detail.publishedAtAuthoritative requires a publication-date rule");
  if (d.upgradeDatePrecision === true && !dateRule) errors.push("detail.upgradeDatePrecision requires a publication-date rule");
  for (const key of ["titleSelector", "publishedAtSelector"] as const) {
    if (d[key] !== undefined && (typeof d[key] !== "string" || !d[key].trim() || d[key].length > 500)) errors.push(`detail.${key} must be a non-empty selector of at most 500 characters`);
  }
  for (const key of ["titleRegex", "publishedAtRegex"] as const) {
    if (d[key] !== undefined) {
      if (typeof d[key] !== "string" || !d[key].trim() || d[key].length > 1000) errors.push(`detail.${key} must be a non-empty regex of at most 1000 characters`);
      else { try { new RegExp(d[key]); } catch { errors.push(`detail.${key} must be a valid regex`); } }
    }
  }
  for (const key of ["pdfDirect", "articleSelector", "attachmentSelector", "attachmentMode", "attachmentScopeSelector"] as const) {
    if (d[key] !== undefined) errors.push(`pagination.detailMode cannot use detail.${key}`);
  }
  if (d.bodySelector !== undefined && (typeof d.bodySelector !== "string" || !d.bodySelector.trim())) errors.push("detail.bodySelector");
  if (d.bodyPolicies !== undefined && (!Array.isArray(d.bodyPolicies) || d.pdfDirect === true)) errors.push("detail.bodyPolicies");
  if (d.publishedAtUtcOffset !== undefined && !isValidUtcOffset(d.publishedAtUtcOffset)) errors.push("detail.publishedAtUtcOffset must be a valid UTC offset");
  if (config.parseMode !== undefined && config.parseMode !== "html") errors.push("pagination.detailMode supports direct HTML only");
  if (config.adapter !== undefined || String(config.url ?? "").startsWith("https://r.jina.ai/")) errors.push("pagination.detailMode cannot use an adapter or Jina listing");
  return [...new Set(errors)];
}

function isNonEmptyRule(value: unknown): boolean { return typeof value === "string" && value.trim().length > 0; }

function isValidUtcOffset(value: unknown): boolean {
  if (typeof value !== "string" || !/^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(value)) return false;
  return value.slice(1, 3) !== "14" || value.endsWith(":00");
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

/** Hashes the immutable, ordered list metadata before any detail resolution is attached. */
export function webListMetadataSnapshotHash(candidates: Pick<PendingWebListCandidate, "identityHash" | "url" | "listTitle" | "listPublishedAt">[]): string {
  return sha256(stableJson(candidates.map(({ identityHash, url, listTitle, listPublishedAt }) => ({
    identityHash, url, listTitle, listPublishedAt,
  }))));
}

export function createPendingWebListPage(
  source: SourceRow,
  pageIndex: number,
  candidates: Candidate[],
  now = new Date(),
): PendingWebListPage {
  if (candidates.length === 0 || candidates.length > WEB_LIST_PENDING_PAGE_MAX_ROWS) throw new Error("pending page row count is outside the allowed range");
  const seen = new Map<string, string>();
  const rows: PendingWebListCandidate[] = candidates.map((candidate) => {
    const url = validateMetadataArticleUrl(candidate.url, source);
    const title = collapseCandidateTitle(candidate.title);
    const listPublishedAt = candidate.publishedAt ? validIso(candidate.publishedAt.toISOString()) : null;
    const identityHash = sha256(identityKeyFor({ ...candidate, url, sourceId: source.id, via: "fetch" }));
    const metadata = stableJson({ url, title, publishedAt: listPublishedAt });
    const previous = seen.get(identityHash);
    if (previous !== undefined && previous !== metadata) throw new Error("duplicate pending article identity has conflicting listing metadata");
    seen.set(identityHash, metadata);
    return previous === undefined
      ? { identityHash, url, listTitle: title, listPublishedAt, state: "pending" }
      : { identityHash, url, listTitle: title, listPublishedAt, state: "excluded", outcome: "duplicate" };
  });
  const page: PendingWebListPage = {
    pageIndex,
    snapshotAt: now.toISOString(),
    fingerprint: webListPageFingerprint(candidates, source.id),
    metadataHash: webListMetadataSnapshotHash(rows),
    candidates: rows,
  };
  assertPendingWebListPage(page, source);
  return page;
}

/** Strictly validates persisted JSON before a pending page can drive a detail request or page write. */
export function assertPendingWebListPage(
  value: unknown,
  source: SourceRow,
  expectedPageIndex?: number,
  enforceCurrentAdmission = true,
  fixedWindow?: { anchorAt: string; cutoffAt: string },
): asserts value is PendingWebListPage {
  const fail = (): never => { throw new Error("invalid pending metadata page requires review"); };
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  const page = value as Record<string, unknown>;
  if (Object.keys(page).some((key) => !["pageIndex", "snapshotAt", "fingerprint", "metadataHash", "candidates"].includes(key))) fail();
  if (!isIntegerInRange(page.pageIndex, 0, MAX_PAGE_INDEX) || (expectedPageIndex !== undefined && page.pageIndex !== expectedPageIndex) ||
      !isIsoString(page.snapshotAt) || !isSha256(page.fingerprint) || !isSha256(page.metadataHash) ||
      !Array.isArray(page.candidates) || page.candidates.length < 1 || page.candidates.length > WEB_LIST_PENDING_PAGE_MAX_ROWS) fail();
  const rows = page.candidates as unknown[];
  const seen = new Map<string, string>();
  const snapshot: Pick<PendingWebListCandidate, "identityHash" | "url" | "listTitle" | "listPublishedAt">[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail();
    const row = raw as Record<string, unknown>;
    const keys = ["identityHash", "url", "listTitle", "listPublishedAt", "state", "resolvedTitle", "resolvedPublishedAt", "titleSource", "dateSource", "outcome"];
    if (Object.keys(row).some((key) => !keys.includes(key))) fail();
    if (!isSha256(row.identityHash) || typeof row.url !== "string" || row.url.length > WEB_LIST_PENDING_URL_MAX_CHARS ||
        typeof row.listTitle !== "string" || row.listTitle.length > WEB_LIST_PENDING_TITLE_MAX_CHARS || !row.listTitle.trim() ||
        (row.listPublishedAt !== null && !isIsoString(row.listPublishedAt)) ||
        !["pending", "resolved", "excluded"].includes(String(row.state))) fail();
    const rowUrl = row.url as string;
    const listTitle = row.listTitle as string;
    let url = "";
    try { url = validateMetadataArticleUrl(rowUrl, source, enforceCurrentAdmission); } catch { fail(); }
    const identityHash = sha256(identityKeyFor({ url, title: listTitle, sourceId: source.id, via: "fetch" }));
    if (identityHash !== row.identityHash) fail();
    const metadata = stableJson({ url, title: listTitle, publishedAt: row.listPublishedAt });
    const previous = seen.get(identityHash);
    if (previous !== undefined && (previous !== metadata || row.state !== "excluded" || row.outcome !== "duplicate")) fail();
    if (row.outcome === "duplicate" && previous === undefined) fail();
    seen.set(identityHash, metadata);
    if (row.state === "pending") {
      if (hasAny(row, ["resolvedTitle", "resolvedPublishedAt", "titleSource", "dateSource", "outcome"])) fail();
    } else if (row.state === "resolved") {
      if (typeof row.resolvedTitle !== "string" || !row.resolvedTitle.trim() || row.resolvedTitle.length > WEB_LIST_PENDING_TITLE_MAX_CHARS ||
          !isIsoString(row.resolvedPublishedAt) ||
          !["list", "configured_rule"].includes(String(row.titleSource)) || !["list", "configured_rule"].includes(String(row.dateSource)) ||
          row.outcome !== undefined) fail();
      if (row.titleSource === "list" && row.resolvedTitle !== row.listTitle) fail();
      if (row.dateSource === "list" && row.resolvedPublishedAt !== row.listPublishedAt) fail();
      const detail = source.config.detail ?? {};
      if (row.dateSource === "configured_rule" && detail.publishedAtAuthoritative !== true && row.listPublishedAt !== null &&
          row.resolvedPublishedAt !== row.listPublishedAt) fail();
      if (fixedWindow && !isTrustedMetadataDateInWindow(row.resolvedPublishedAt as string, fixedWindow, "inside")) fail();
    } else {
      if (!["outside_window", "noise", "duplicate"].includes(String(row.outcome)) ||
          hasAny(row, ["resolvedTitle", "titleSource"]) ||
          (row.outcome === "outside_window" && (!isIsoString(row.resolvedPublishedAt) || row.dateSource !== "list" && row.dateSource !== "configured_rule")) ||
          (row.outcome !== "outside_window" && hasAny(row, ["resolvedPublishedAt", "dateSource"]))) fail();
      if (row.outcome === "outside_window" && row.dateSource === "list" && row.resolvedPublishedAt !== row.listPublishedAt) fail();
      const detail = source.config.detail ?? {};
      if (row.outcome === "outside_window" && row.dateSource === "configured_rule" && detail.publishedAtAuthoritative !== true &&
          row.listPublishedAt !== null && row.resolvedPublishedAt !== row.listPublishedAt) fail();
      if (fixedWindow && row.outcome === "outside_window" &&
          !isTrustedMetadataDateInWindow(row.resolvedPublishedAt as string, fixedWindow, "before")) fail();
    }
    snapshot.push({ identityHash, url, listTitle, listPublishedAt: row.listPublishedAt as string | null });
  }
  const candidates = rows as PendingWebListCandidate[];
  if (webListMetadataSnapshotHash(snapshot) !== page.metadataHash) fail();
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > WEB_LIST_PENDING_PAGE_MAX_BYTES) fail();
  // The page fingerprint is based on each parser identity; duplicate identities are represented once.
  const identityKeys = candidates.map((row) => identityKeyFor({ url: row.url, title: row.listTitle, sourceId: source.id, via: "fetch" }));
  if (sha256(stableJson(identityKeys.sort())) !== page.fingerprint) fail();
}

function isTrustedMetadataDateInWindow(
  value: string,
  window: { anchorAt: string; cutoffAt: string },
  relation: "inside" | "before",
): boolean {
  if (!isIsoString(window.anchorAt) || !isIsoString(window.cutoffAt)) return false;
  const claimed = new Date(value);
  const anchor = new Date(window.anchorAt);
  const cutoff = Date.parse(window.cutoffAt);
  if (!Number.isFinite(claimed.getTime()) || !Number.isFinite(anchor.getTime()) || !Number.isFinite(cutoff)) return false;
  const trusted = decideTimeline(claimed, anchor, "first-import").publishedAt;
  if (!trusted || trusted.toISOString() !== claimed.toISOString()) return false;
  return relation === "inside" ? trusted.getTime() >= cutoff : trusted.getTime() < cutoff;
}

function collapseCandidateTitle(value: string): string {
  const title = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!title || title.length > WEB_LIST_PENDING_TITLE_MAX_CHARS) throw new Error("pending metadata title is invalid or too long");
  return title;
}

function validateMetadataArticleUrl(value: string, source: SourceRow, enforceCurrentAdmission = true): string {
  if (typeof value !== "string" || value.length > WEB_LIST_PENDING_URL_MAX_CHARS) throw new Error("pending metadata URL is invalid or too long");
  let target: URL;
  let base: URL;
  try { target = new URL(value); base = new URL(String(source.config.url)); } catch { throw new Error("pending metadata URL is invalid"); }
  if (target.protocol !== "https:" || target.username || target.password || target.port || target.search || target.hash ||
      enforceCurrentAdmission && (target.origin !== base.origin || !allowed(target.toString(), source) ||
        isWebListPaginationUrl(String(source.config.url), target.toString()) || webListPageIndex(String(source.config.url), target.toString()) !== null)) {
    throw new Error("pending metadata URL is outside the direct article allow-list");
  }
  return target.toString();
}

function validIso(value: string): string { if (!isIsoString(value)) throw new Error("invalid metadata timestamp"); return value; }
function isIsoString(value: unknown): value is string { return typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value; }
function isSha256(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{64}$/.test(value); }
function hasAny(value: Record<string, unknown>, keys: string[]): boolean { return keys.some((key) => Object.hasOwn(value, key)); }

/** A source-run budget shared by every page request and redirect hop in that run. */
export function createWebListPaginationBudget(
  source: SourceRow,
  pagination: MofIndexPaginationConfig,
): {
  runBudget: GuardedFetchRunBudget;
  dispatchesUsed(): number;
  setCurrentPage(pageIndex: number): void;
  setCurrentDetailTarget(url: string, identity: string): void;
  clearCurrentDetailTarget(): void;
  detailTargetsUsed(): number;
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
  const attemptedDetailIdentities = new Set<string>();
  let dispatches = 0;
  let currentPageIndex: number | null = null;
  let currentDetailTarget: { url: string; identity: string } | null = null;
  let detailCount = 0;
  const detailCap = Number(source.config.detail?.maxFetches ?? 0);
  const assertMetadataArticle = (value: string): string => validateMetadataArticleUrl(value, source);
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
      if (currentDetailTarget) {
        assertMetadataArticle(dispatchUrl);
        const dispatchIdentity = identityKeyFor({ url: dispatchUrl, title: "", sourceId: source.id, via: "fetch" });
        if (dispatchIdentity !== currentDetailTarget.identity) throw new Error("web-list detail dispatch changed article identity");
        if (redirectHop === 0) {
          if (dispatchUrl !== currentDetailTarget.url) throw new Error("web-list detail dispatch does not match its admitted target");
          if (attemptedDetailIdentities.has(currentDetailTarget.identity)) throw new Error("web-list detail identity already attempted");
          if (detailCount >= detailCap) throw new Error(`web-list detail target budget exhausted (${detailCap})`);
          attemptedDetailIdentities.add(currentDetailTarget.identity);
          detailCount += 1;
        }
      } else {
        if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || url.search || url.hash) {
          throw new Error("web-list dispatch outside configured listing directory");
        }
        if (redirectHop === 0 && (currentPageIndex === null || webListPageIndex(String(source.config.url), url.toString()) !== currentPageIndex)) {
          throw new Error("web-list dispatch does not match the current page");
        }
      }
      dispatches += 1;
      dispatchedUrls.add(dispatchUrl);
    },
    allowRedirect({ to }) {
      assertActive();
      if (currentDetailTarget) {
        try {
          const checkedUrl = assertMetadataArticle(to.toString());
          const identity = identityKeyFor({ url: checkedUrl, title: "", sourceId: source.id, via: "fetch" });
          return identity === currentDetailTarget.identity && !dispatchedUrls.has(checkedUrl);
        } catch { return false; }
      }
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
      currentDetailTarget = null;
      currentPageIndex = pageIndex;
    },
    setCurrentDetailTarget(url, identity) {
      assertActive();
      if (pagination.detailMode !== "direct_html_metadata_v1" || typeof identity !== "string" || identity.length > 2048 || detailCap < 1 || detailCap > 10) {
        throw new Error("metadata detail target is not enabled");
      }
      const admitted = assertMetadataArticle(url);
      const actualIdentity = identityKeyFor({ url: admitted, title: "", sourceId: source.id, via: "fetch" });
      if (actualIdentity !== identity || attemptedDetailIdentities.has(identity) || detailCount >= detailCap) {
        throw new Error("metadata detail target identity or budget rejected");
      }
      currentDetailTarget = { url: admitted, identity };
      currentPageIndex = null;
    },
    clearCurrentDetailTarget() { currentDetailTarget = null; },
    detailTargetsUsed: () => detailCount,
    markPageCommitted(pageIndex) {
      committed.add(pageIndex);
    },
    assertActive,
    remainingMs: () => Math.max(0, deadlineAt - Date.now()),
    dispose() { clearTimeout(timer); },
  };
}

/** Routes explicit metadata generations through their continuation path and keeps legacy Phase A unchanged. */
export async function collectWebListBackfill(sourceId: string, options: PaginatedWebListRunOptions = {}): Promise<PaginatedWebListRunResult> {
  const [initial] = await sql<SourceRow[]>`SELECT id, name, kind, config, tier, participation_mode, first_party, interval_minutes,
      enabled, cursor, fail_count FROM sources WHERE id = ${sourceId}`;
  const backfill = initial?.cursor?.[BACKFILL_CURSOR_KEY] as Record<string, unknown> | undefined;
  const metadataRoute = initial?.config?.pagination?.detailMode === "direct_html_metadata_v1" ||
    !!backfill && Object.hasOwn(backfill, "pendingPage");
  return collectWebListBackfillCore(sourceId, options, metadataRoute);
}

/** Shared advisory-lock/reserved-connection lifecycle for Phase A and explicit metadata continuations. */
async function collectWebListBackfillCore(sourceId: string, options: PaginatedWebListRunOptions = {}, metadataRoute = false): Promise<PaginatedWebListRunResult> {
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
  let detailTargetsUsed = 0;
  let pendingRows = 0;
  let pagesCommittedThisRun = 0;
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
    ...(pagination?.detailMode === "direct_html_metadata_v1" ? {
      detailTargetsUsed,
      pendingRows,
      pagesCommittedThisRun,
    } : {}),
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
      if (!cursor || !isWebListBackfillCursor(cursor, runSource)) {
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
      if (!isCursorWindowConsistent(cursor, runSource)) {
        stopReason = "invalid_anchor";
        await updateCursorStop("blocked", stopReason);
        await writeRun("failed", "pagination cursor date window does not match the frozen backfill months");
        return result("failed", stopReason);
      }
      if (cursor.pendingPage) {
        try { assertPendingWebListPage(cursor.pendingPage, runSource, cursor.nextPageIndex, true, { anchorAt: cursor.anchorAt, cutoffAt: cursor.cutoffAt }); }
        catch {
          stopReason = "invalid_pending_page";
          await updateCursorStop("blocked", stopReason);
          await writeRun("failed", "pending metadata page is invalid and requires review");
          return result("failed", stopReason);
        }
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
      const next = await withReservedTransaction(reserved, async (tx) => {
        await setTransactionDeadline(tx, budget);
        const [row] = await tx<{ config: Record<string, unknown>; kind: SourceRow["kind"]; cursor: Record<string, unknown> | null }[]>`
          SELECT config, kind, cursor FROM sources WHERE id = ${sourceId} FOR UPDATE`;
        if (!row || webListPaginationConfigHash({ ...runSource!, config: row.config, kind: row.kind }) !== cursor!.configHash ||
            row.cursor?.initializedAt || Object.hasOwn(row.cursor ?? {}, BACKFILL_CURSOR_KEY)) {
          throw new PaginationConfigChangedError("source config/cursor changed before generation initialization");
        }
        const lockedMerge = { ...(row.cursor ?? {}), [BACKFILL_CURSOR_KEY]: cursor };
        await tx`UPDATE sources SET cursor = ${tx.json(lockedMerge as never)}, updated_at = now() WHERE id = ${sourceId}`;
        return lockedMerge;
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

    if (metadataRoute || pagination.detailMode === "direct_html_metadata_v1") {
      if (pagination.detailMode !== "direct_html_metadata_v1") {
        stopReason = "config_changed";
        await updateCursorStop("config_changed", stopReason);
        await writeRun("failed", "metadata continuation lost its explicit detailMode opt-in");
        return result("failed", stopReason);
      }
      const pageReader = options.fetchPage ?? ((source: SourceRow, listUrl: string, runBudget: GuardedFetchRunBudget) => fetchWebList(source, { listUrl, runBudget }));
      let pagesProcessed = 0;
      const sameExpectedPage = (left: WebListBackfillCursor, right: WebListBackfillCursor) =>
        left.generationId === right.generationId && left.configHash === right.configHash && left.nextPageIndex === right.nextPageIndex &&
        (left.pendingPage?.metadataHash ?? null) === (right.pendingPage?.metadataHash ?? null);
      const savePending = async (expected: WebListBackfillCursor, expectedPendingHash: string | null, pending: PendingWebListPage) =>
        withReservedTransaction(reserved, async (tx) => {
          await setTransactionDeadline(tx, budget);
          const [row] = await tx<{ config: Record<string, unknown>; kind: SourceRow["kind"]; cursor: Record<string, unknown> | null }[]>`
            SELECT config, kind, cursor FROM sources WHERE id = ${sourceId} FOR UPDATE`;
          if (!row) throw new PaginationConfigChangedError("source missing during metadata checkpoint");
          if (webListPaginationConfigHash({ ...runSource!, config: row.config, kind: row.kind }) !== expected.configHash) {
            const persisted = row.cursor?.[BACKFILL_CURSOR_KEY] as WebListBackfillCursor | undefined;
            if (persisted?.generationId === expected.generationId) {
              const changed = { ...persisted, state: "config_changed" as const, stopReason: "config_changed", updatedAt: new Date().toISOString() };
              await tx`UPDATE sources SET cursor = ${tx.json({ ...(row.cursor ?? {}), [BACKFILL_CURSOR_KEY]: changed } as never)}, updated_at = now() WHERE id = ${sourceId}`;
            }
            throw new PaginationConfigChangedError("metadata config changed before checkpoint");
          }
          const persisted = row.cursor?.[BACKFILL_CURSOR_KEY] as WebListBackfillCursor | undefined;
          if (!persisted || !sameExpectedPage(persisted, expected) || persisted.state !== "active" ||
              (persisted.pendingPage?.metadataHash ?? null) !== expectedPendingHash) throw new Error("metadata cursor changed before checkpoint");
          const nextCursor = { ...persisted, pendingPage: pending, updatedAt: new Date().toISOString() };
          await tx`UPDATE sources SET cursor = ${tx.json({ ...(row.cursor ?? {}), [BACKFILL_CURSOR_KEY]: nextCursor } as never)}, updated_at = now() WHERE id = ${sourceId}`;
          return nextCursor;
        }, budget);
      const saveResolvedRow = async (expected: WebListBackfillCursor, page: PendingWebListPage, rowIndex: number, resolved: PendingWebListCandidate) =>
        withReservedTransaction(reserved, async (tx) => {
          await setTransactionDeadline(tx, budget);
          const [row] = await tx<{ config: Record<string, unknown>; kind: SourceRow["kind"]; cursor: Record<string, unknown> | null }[]>`
            SELECT config, kind, cursor FROM sources WHERE id = ${sourceId} FOR UPDATE`;
          if (!row || webListPaginationConfigHash({ ...runSource!, config: row.config, kind: row.kind }) !== expected.configHash) {
            throw new PaginationConfigChangedError("metadata config changed before row checkpoint");
          }
          const persisted = row.cursor?.[BACKFILL_CURSOR_KEY] as WebListBackfillCursor | undefined;
          const currentPage = persisted?.pendingPage;
          if (!persisted || persisted.state !== "active" || persisted.generationId !== expected.generationId ||
              persisted.nextPageIndex !== expected.nextPageIndex || currentPage?.metadataHash !== page.metadataHash ||
              currentPage.candidates[rowIndex]?.state !== "pending" || currentPage.candidates[rowIndex]?.identityHash !== resolved.identityHash) {
            throw new Error("metadata row cursor changed before checkpoint");
          }
          const nextPage = structuredClone(currentPage);
          nextPage.candidates[rowIndex] = resolved;
          assertPendingWebListPage(nextPage, { ...runSource!, config: row.config, kind: row.kind }, expected.nextPageIndex, true,
            { anchorAt: expected.anchorAt, cutoffAt: expected.cutoffAt });
          const nextCursor = { ...persisted, pendingPage: nextPage, updatedAt: new Date().toISOString() };
          await tx`UPDATE sources SET cursor = ${tx.json({ ...(row.cursor ?? {}), [BACKFILL_CURSOR_KEY]: nextCursor } as never)}, updated_at = now() WHERE id = ${sourceId}`;
          return nextCursor;
        }, budget);
      const commitPage = async (expected: WebListBackfillCursor, page: PendingWebListPage) =>
        withReservedTransaction(reserved, async (tx) => {
          await setTransactionDeadline(tx, budget);
          const [row] = await tx<{ config: Record<string, unknown>; kind: SourceRow["kind"]; cursor: Record<string, unknown> | null }[]>`
            SELECT config, kind, cursor FROM sources WHERE id = ${sourceId} FOR UPDATE`;
          if (!row) throw new PaginationConfigChangedError("source missing during metadata page commit");
          const currentSource = { ...runSource!, config: row.config, kind: row.kind };
          if (webListPaginationConfigHash(currentSource) !== expected.configHash) throw new PaginationConfigChangedError("metadata config changed before page commit");
          const persisted = row.cursor?.[BACKFILL_CURSOR_KEY] as WebListBackfillCursor | undefined;
          if (!persisted || persisted.state !== "active" || persisted.generationId !== expected.generationId ||
              persisted.nextPageIndex !== page.pageIndex || persisted.pendingPage?.metadataHash !== page.metadataHash) {
            throw new Error("metadata page cursor changed before commit");
          }
          if (!isCursorWindowConsistent(persisted, currentSource)) throw new MetadataReviewError("invalid_anchor");
          assertPendingWebListPage(persisted.pendingPage, currentSource, page.pageIndex, true,
            { anchorAt: persisted.anchorAt, cutoffAt: persisted.cutoffAt });
          if (persisted.pendingPage.candidates.some((candidate) => candidate.state === "pending")) throw new Error("metadata page still has unresolved rows");
          const candidates: Candidate[] = persisted.pendingPage.candidates.filter((candidate) => candidate.state === "resolved").map((candidate) => ({
            url: candidate.url, title: candidate.resolvedTitle!,
            publishedAt: candidate.resolvedPublishedAt ? new Date(candidate.resolvedPublishedAt) : null,
            discoveredAt: new Date(persisted.pendingPage!.snapshotAt),
          }));
          for (const candidate of candidates) {
            const claimed = candidate.publishedAt;
            const trusted = decideTimeline(claimed, anchorAt, "first-import").publishedAt;
            if (!claimed || !trusted || trusted.toISOString() !== claimed.toISOString() || trusted.getTime() < windowCutoff) {
              throw new MetadataReviewError("resolved_metadata_requires_review");
            }
          }
          const keys = candidates.map((candidate) => identityKeyFor({ ...candidate, sourceId, via: "fetch" }));
          const existing = keys.length ? await tx<{ identity_key: string; source_id: string; title: string; published_at: Date | null; published_at_claim: Date | null }[]>`
            SELECT identity_key, source_id, title, published_at, published_at_claim FROM articles WHERE identity_key IN ${tx(keys)} FOR UPDATE` : [];
          const byIdentity = new Map(existing.map((article) => [article.identity_key, article]));
          const detailConfig = (currentSource.config.detail ?? {}) as Record<string, unknown>;
          let pageCreated = 0;
          let pageRevised = 0;
          for (const candidate of candidates) {
            budget!.assertActive();
            const identity = identityKeyFor({ ...candidate, sourceId, via: "fetch" });
            const stored = byIdentity.get(identity);
            let material = { ...candidate, sourceId, via: "fetch" as const, backfill: "first-import", discoveredAt: new Date(page.snapshotAt) };
            if (stored?.source_id === sourceId) {
              const storedPublished = stored.published_at?.toISOString() ?? null;
              const storedClaim = stored.published_at_claim?.toISOString() ?? null;
              const wantedDate = material.publishedAt?.toISOString() ?? null;
              if (storedPublished !== storedClaim) throw new MetadataReviewError("stored_metadata_requires_review");
              if (detailConfig.titleAuthoritative === true && stored.title !== material.title) throw new MetadataReviewError("stored_metadata_requires_review");
              if (detailConfig.publishedAtAuthoritative === true && (storedPublished === null || storedClaim !== wantedDate)) {
                throw new MetadataReviewError("stored_metadata_requires_review");
              }
              // Stored source-owned metadata has no sufficient historical provenance; preserve it on replay.
              material = { ...material, title: stored.title, publishedAt: stored.published_at_claim };
            }
            const saved = await upsertMaterial(material, tx);
            if (saved.created) pageCreated += 1;
            if (saved.revised) pageRevised += 1;
            if (saved.created || saved.revised) await queueProcessing(saved.articleId, { db: tx });
          }
          budget!.assertActive();
          const nextCursor: WebListBackfillCursor = {
            ...persisted,
            nextPageIndex: page.pageIndex + 1,
            pagesCommitted: persisted.pagesCommitted + 1,
            lastPageFingerprint: page.fingerprint,
            lastPageIdentityHashes: webListPageIdentityHashes(persisted.pendingPage.candidates.map((item) => ({
              url: item.url, title: item.listTitle, publishedAt: item.listPublishedAt ? new Date(item.listPublishedAt) : null,
            })), sourceId),
            state: "active", coverage: "unproven", stopReason: null, updatedAt: new Date().toISOString(),
          };
          delete nextCursor.pendingPage;
          const runDetail = { ...makeRunDetail(), nextPageIndex: nextCursor.nextPageIndex,
            pagesCommitted: nextCursor.pagesCommitted, pagesCommittedThisRun: pagesCommittedThisRun + 1,
            pendingRows: 0, created: created + pageCreated, revised: revised + pageRevised, stopReason: "page_checkpointed" };
          await tx`UPDATE sources SET cursor = ${tx.json({ ...(row.cursor ?? {}), [BACKFILL_CURSOR_KEY]: nextCursor } as never)}, updated_at = now() WHERE id = ${sourceId}`;
          await tx`UPDATE fetch_runs SET new_count = new_count + ${pageCreated},
            detail = ${tx.json(runDetail as never)} WHERE id = ${runId}`;
          budget!.assertActive();
          return { cursor: nextCursor, created: pageCreated, revised: pageRevised };
        }, budget);

      try {
        while (pagesProcessed < pagination.maxPagesPerRun) {
          budget.assertActive();
          if (!cursor || cursor.state !== "active") break;
          if (cursor.nextPageIndex > pagination.maxPageIndex) {
            stopReason = "max_page_index";
            await updateCursorStop("blocked", stopReason);
            await writeRun("failed", "pagination reached maxPageIndex without a completeness proof");
            return result("failed", stopReason);
          }
          let pending = cursor.pendingPage;
          if (!pending) {
            if (budget.dispatchesUsed() >= pagination.maxDispatches) { stopReason = "max_dispatches_per_run"; break; }
            runSource = await loadPaginatedSource(reserved, sourceId);
            if (!runSource || webListPaginationConfigHash(runSource) !== cursor.configHash) throw new PaginationConfigChangedError("metadata config changed before list request");
            const pageIndex = cursor.nextPageIndex;
            const listUrl = webListPageUrl(String(runSource.config.url), pageIndex);
            budget.setCurrentPage(pageIndex);
            const pageCandidates = await pageReader(runSource, listUrl, budget.runBudget);
            pagesFetched += 1;
            found += pageCandidates.length;
            budget.assertActive();
            const limit = Math.min(Number(runSource.config._aihot?.initialBackfillLimit ?? 30), WEB_LIST_PENDING_PAGE_MAX_ROWS);
            if (!pageCandidates.length || pageCandidates.length > limit) {
              stopReason = pageCandidates.length ? "page_item_limit_exceeded" : "empty_page";
              await updateCursorStop("blocked", stopReason);
              await writeRun("failed", "metadata listing page is empty or exceeds its bounded row limit");
              return result("failed", stopReason);
            }
            const fingerprint = webListPageFingerprint(pageCandidates, sourceId);
            if (cursor.lastPageFingerprint === fingerprint) {
              stopReason = "repeated_page";
              await updateCursorStop("blocked", stopReason);
              await writeRun("failed", "pagination returned the same page identity sequence twice");
              return result("failed", stopReason);
            }
            const identityHashes = webListPageIdentityHashes(pageCandidates, sourceId);
            const previous = new Set(cursor.lastPageIdentityHashes ?? []);
            if (!identityHashes.length || previous.size > 0 && !identityHashes.some((hash) => !previous.has(hash))) {
              stopReason = "page_no_new_identity";
              await updateCursorStop("blocked", stopReason);
              await writeRun("failed", "metadata page contains no identities beyond the previous committed page");
              return result("failed", stopReason);
            }
            pending = createPendingWebListPage(runSource, pageIndex, pageCandidates, new Date());
            cursor = await savePending(cursor, null, pending);
            pendingRows = pending.candidates.filter((candidate) => candidate.state === "pending").length;
          }
          pagesProcessed += 1;
          for (let i = 0; i < pending.candidates.length; i++) {
            budget.assertActive();
            const item = pending.candidates[i]!;
            if (item.state !== "pending") continue;
            const listCandidate: Candidate = { url: item.url, title: item.listTitle,
              publishedAt: item.listPublishedAt ? new Date(item.listPublishedAt) : null };
            let resolved: PendingWebListCandidate;
            if (sourceNoiseFiltered(listCandidate, runSource!)) {
              resolved = { ...item, state: "excluded", outcome: "noise" };
            } else {
              const detail = runSource!.config.detail ?? {};
              const authoritativeDate = detail.publishedAtAuthoritative === true;
              const trustedListDate = !authoritativeDate && item.listPublishedAt
                ? decideTimeline(new Date(item.listPublishedAt), anchorAt, "first-import").publishedAt
                : null;
              if (!authoritativeDate && item.listPublishedAt && !trustedListDate) throw new MetadataReviewError("untrusted_date_requires_review");
              if (trustedListDate && trustedListDate.getTime() < windowCutoff && detail.upgradeDatePrecision !== true) {
                resolved = { ...item, state: "excluded", outcome: "outside_window", resolvedPublishedAt: trustedListDate.toISOString(), dateSource: "list" };
              } else {
                const needsDate = authoritativeDate || !trustedListDate || detail.upgradeDatePrecision === true;
                const needsTitle = detail.titleAuthoritative === true || needsTitleForMetadata(item.listTitle);
                if (needsDate && !metadataRuleConfigured(detail, "date")) throw new MetadataReviewError("required_date_rule_missing");
                if (needsTitle && !metadataRuleConfigured(detail, "title")) throw new MetadataReviewError("required_title_rule_missing");
                let fetched: WebListMetadataResult | null = null;
                if (needsDate || needsTitle) {
                  if (budget.dispatchesUsed() >= pagination.maxDispatches) { stopReason = "max_dispatches_per_run"; break; }
                  if (budget.detailTargetsUsed() >= Number(detail.maxFetches)) { stopReason = "max_detail_targets_per_run"; break; }
                  runSource = await loadPaginatedSource(reserved, sourceId);
                  if (!runSource || webListPaginationConfigHash(runSource) !== cursor!.configHash) throw new PaginationConfigChangedError("metadata config changed before detail request");
                  const articleIdentity = identityKeyFor({ url: item.url, title: item.listTitle, sourceId, via: "fetch" });
                  budget.setCurrentDetailTarget(item.url, articleIdentity);
                  try {
                    const need: WebListMetadataNeed = { title: needsTitle, date: needsDate };
                    const beforeDispatch = budget.dispatchesUsed();
                    fetched = await fetchWebListMetadata(item.url, runSource, need, {
                      runBudget: budget.runBudget, remainingMs: budget.remainingMs, assertActive: budget.assertActive,
                      ...(options.testMetadataFetcher ? { testFetcher: options.testMetadataFetcher } : {}),
                    });
                    if (budget.dispatchesUsed() <= beforeDispatch) throw new Error("metadata transport did not consume the shared dispatch budget");
                    if (identityKeyFor({ url: fetched.finalUrl, title: "", sourceId, via: "fetch" }) !== identityKeyFor({ url: item.url, title: "", sourceId, via: "fetch" })) {
                      throw new MetadataReviewError("detail_identity_changed");
                    }
                  } finally { budget.clearCurrentDetailTarget(); }
                  detailTargetsUsed = budget.detailTargetsUsed();
                }
                let title = item.listTitle;
                let titleSource: PendingMetadataFieldSource = "list";
                if (needsTitle) {
                  if (fetched?.title.status !== "found") throw new MetadataReviewError("required_title_missing");
                  title = fetched.title.value;
                  titleSource = "configured_rule";
                }
                let publishedAt = trustedListDate;
                let dateSource: PendingMetadataFieldSource = "list";
                if (needsDate) {
                  if (fetched?.date.status !== "found") throw new MetadataReviewError("required_date_missing");
                  const detailDate = fetched.date.value;
                  if (!authoritativeDate && trustedListDate && detailDate !== trustedListDate.toISOString()) throw new MetadataReviewError("date_conflict_require_review");
                  publishedAt = new Date(detailDate);
                  dateSource = "configured_rule";
                }
                if (!publishedAt) throw new MetadataReviewError("required_date_missing");
                const trusted = decideTimeline(publishedAt, anchorAt, "first-import").publishedAt;
                if (!trusted) throw new MetadataReviewError("untrusted_date_requires_review");
                if (trusted.getTime() < windowCutoff) {
                  resolved = { ...item, state: "excluded", outcome: "outside_window", resolvedPublishedAt: trusted.toISOString(), dateSource };
                } else {
                  if (!title.trim() || title.length > WEB_LIST_PENDING_TITLE_MAX_CHARS) throw new MetadataReviewError("required_title_invalid");
                  resolved = { ...item, state: "resolved", resolvedTitle: title, resolvedPublishedAt: trusted.toISOString(), titleSource, dateSource };
                }
              }
            }
            cursor = await saveResolvedRow(cursor!, pending, i, resolved);
            pending = cursor.pendingPage!;
            pendingRows = pending.candidates.filter((candidate) => candidate.state === "pending").length;
          }
          if (stopReason === "max_dispatches_per_run" || stopReason === "max_detail_targets_per_run") break;
          pending = cursor.pendingPage!;
          if (pending.candidates.some((candidate) => candidate.state === "pending")) throw new MetadataReviewError("pending_row_state_invalid");
          const committed = await commitPage(cursor!, pending);
          cursor = committed.cursor;
          created += committed.created;
          revised += committed.revised;
          pagesCommittedThisRun += 1;
          pendingRows = 0;
          budget.markPageCommitted(pending.pageIndex);
          runSource = { ...runSource!, cursor: { ...(runSource!.cursor ?? {}), [BACKFILL_CURSOR_KEY]: cursor } };
          stopReason = "max_pages_per_run";
        }
        budget.assertActive();
        if (stopReason === "starting") stopReason = "max_pages_per_run";
        await updateCursorStop("active", stopReason);
        await reserved`UPDATE sources SET last_fetch_at = now(), last_ok_at = now(), fail_count = 0, last_error = NULL,
          health = 'ok', updated_at = now(), next_fetch_at = now() + make_interval(mins => interval_minutes) WHERE id = ${sourceId}`;
        await writeRun("ok");
        return result("ok");
      } catch (error) {
        if (error instanceof MetadataReviewError) {
          stopReason = error.reason;
          await updateCursorStop("blocked", stopReason);
        } else if (error instanceof PaginationConfigChangedError) {
          stopReason = "config_changed";
          await updateCursorStop("config_changed", stopReason);
        } else stopReason = "metadata_run_failed";
        await failSourceRun(reserved, sourceId, error, runId!, found, created, makeRunDetail());
        return result("failed", errorMessage(error));
      }
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

function isWebListBackfillCursor(value: WebListBackfillCursor, source: SourceRow): boolean {
  if (!value || typeof value !== "object" || Object.keys(value).some((key) => ![
    "v", "generationId", "configHash", "anchorAt", "cutoffAt", "nextPageIndex", "pagesCommitted",
    "lastPageFingerprint", "lastPageIdentityHashes", "pendingPage", "state", "coverage", "stopReason", "updatedAt",
  ].includes(key))) return false;
  const valid = value.v === 1 && typeof value.generationId === "string" && /^[0-9a-f-]{36}$/i.test(value.generationId) && isSha256(value.configHash) &&
    isIsoString(value.anchorAt) && isIsoString(value.cutoffAt) && Number.isSafeInteger(value.nextPageIndex) && value.nextPageIndex >= 0 && value.nextPageIndex <= MAX_PAGE_INDEX + 1 &&
    Number.isSafeInteger(value.pagesCommitted) && value.pagesCommitted === value.nextPageIndex && value.pagesCommitted <= MAX_PAGE_INDEX + 1 &&
    (value.nextPageIndex === 0
      ? value.lastPageFingerprint === null && (value.lastPageIdentityHashes === undefined || value.lastPageIdentityHashes === null)
      : isSha256(value.lastPageFingerprint) && Array.isArray(value.lastPageIdentityHashes) && value.lastPageIdentityHashes.length > 0 &&
        value.lastPageIdentityHashes.length <= 60 && value.lastPageIdentityHashes.every(isSha256) &&
        new Set(value.lastPageIdentityHashes).size === value.lastPageIdentityHashes.length &&
        value.lastPageIdentityHashes.every((hash, index, all) => index === 0 || all[index - 1]! < hash)) &&
    (value.state === "active" || value.state === "blocked" || value.state === "config_changed") && value.coverage === "unproven" &&
    (value.stopReason === null || typeof value.stopReason === "string" && value.stopReason.length <= 100) && isIsoString(value.updatedAt);
  if (!valid) return false;
  if (Object.hasOwn(value, "pendingPage")) {
    try { assertPendingWebListPage(value.pendingPage, source, value.nextPageIndex, false); } catch { return false; }
  }
  return true;
}

function isCursorWindowConsistent(cursor: WebListBackfillCursor, source: SourceRow): boolean {
  const months = Number(source.config._aihot?.initialBackfillMonths ?? 12);
  const anchor = Date.parse(cursor.anchorAt);
  const cutoff = Date.parse(cursor.cutoffAt);
  return Number.isFinite(months) && months > 0 && Number.isFinite(anchor) && Number.isFinite(cutoff) &&
    new Date(anchor - months * 30 * DAY_MS).toISOString() === new Date(cutoff).toISOString();
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
class MetadataReviewError extends Error {
  readonly reason: string;
  constructor(reason: string) { super(reason); this.reason = reason; }
}

function needsTitleForMetadata(title: string): boolean {
  const value = title.trim();
  return value.length > 100 || /^(read more|learn more|continue reading|more|阅读全文|阅读更多|查看详情|了解更多)$/i.test(value);
}

function metadataRuleConfigured(detail: Record<string, unknown>, field: "title" | "date"): boolean {
  return field === "title"
    ? typeof detail.titleSelector === "string" && !!detail.titleSelector.trim() || typeof detail.titleRegex === "string" && !!detail.titleRegex.trim()
    : typeof detail.publishedAtSelector === "string" && !!detail.publishedAtSelector.trim() || typeof detail.publishedAtRegex === "string" && !!detail.publishedAtRegex.trim();
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isPositiveFiniteInteger(value: unknown): value is number {
  return isPositiveFinite(value) && Number.isSafeInteger(value);
}
