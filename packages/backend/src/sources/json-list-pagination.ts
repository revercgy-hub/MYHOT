import type { GuardedFetchRunBudget } from "../lib/http-fetch.ts";
import { decideTimeline, identityKeyFor } from "../content/materials.ts";
import { fetchGovcnJsonPage, type JsonListPageResult } from "./json-list.ts";
import type { Candidate, SourceRow } from "./types.ts";

export const GOVCN_JSON_PAGE_SIZE = 5;
export const GOVCN_JSON_PAGINATION_DEADLINE_MS = 120_000;
const GOVCN_SOURCE_ID = "govcn-policy-library";
const GOVCN_LIST_URL = "https://sousuo.www.gov.cn/search-gov/data?q=&sort=score&sortType=1&searchfield=title&p=1&n=5&type=gwyzcwjk";
const GOVCN_CANONICAL_PREFIX = "https://www.gov.cn/zhengce/zhengceku/";
const GOVCN_TITLE_REGEX = "<title>(.*?)_国务院部门文件_中国政府网</title>";
const GOVCN_DATE_REGEX = "name=\"firstpublishedtime\" content=\"(\\d{4}-\\d{2}-\\d{2})-\\d{2}:\\d{2}:\\d{2}\"";

export interface GovcnJsonPaginationConfig {
  mode: "govcn_query_v1";
  maxPagesPerRun: number;
  maxDispatches: number;
}

export function hasGovcnJsonPagination(config: Record<string, any>): boolean {
  return Object.hasOwn(config, "pagination");
}

export function readGovcnJsonPagination(config: Record<string, any>): GovcnJsonPaginationConfig | null {
  const value = config.pagination;
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== 3 || value.mode !== "govcn_query_v1" ||
      !Number.isSafeInteger(value.maxPagesPerRun) || value.maxPagesPerRun < 1 || value.maxPagesPerRun > 2 ||
      !Number.isSafeInteger(value.maxDispatches) || value.maxDispatches < 1 || value.maxDispatches > 12) return null;
  return { mode: "govcn_query_v1", maxPagesPerRun: value.maxPagesPerRun, maxDispatches: value.maxDispatches };
}

export function validateGovcnJsonPagination(kind: SourceRow["kind"], config: Record<string, any>): string[] {
  if (!hasGovcnJsonPagination(config)) return [];
  const errors: string[] = [];
  const pagination = readGovcnJsonPagination(config);
  if (kind !== "json_list") errors.push("GovCN query pagination is only supported by json_list");
  if (!pagination) errors.push("pagination must be the exact govcn_query_v1 mode with maxPagesPerRun 1..2 and maxDispatches 1..12");
  const detail = config.detail;
  const detailKeys = ["maxFetches", "titleRegex", "publishedAtRegex", "publishedAtUtcOffset", "bodySelector"];
  const backfill = config._aihot;
  const topLevel = ["url", "itemsPath", "titlePaths", "summaryPaths", "summaryIsBody", "publishedAtPath", "publishedAtUnit", "publishedAtUtcOffset", "externalIdPath", "urlTemplate", "allowUrlPrefixes", "detail", "_aihot", "pagination"];
  if (config.url !== GOVCN_LIST_URL || (config.method !== undefined && config.method !== "GET") || config.headers !== undefined || config.bodyJson !== undefined ||
      config.mode !== undefined || config.jsonKey !== undefined || config.windowVar !== undefined || config.categorySelection !== undefined ||
      config.itemsObjectValues !== undefined || config.urlTemplateFallback !== undefined || config.rawDropKeys !== undefined ||
      Object.keys(config).some((key) => !topLevel.includes(key))) {
    errors.push("GovCN query pagination requires the exact saved direct-GET source configuration");
  }
  if (config.itemsPath !== "searchVO.catMap.bumenfile.listVO" || JSON.stringify(config.titlePaths) !== JSON.stringify(["title"]) ||
      JSON.stringify(config.summaryPaths) !== JSON.stringify(["summary"]) || config.summaryIsBody !== false ||
      config.publishedAtPath !== "pubtime" || config.publishedAtUnit !== "epoch_ms" || config.publishedAtUtcOffset !== "+08:00" ||
      config.externalIdPath !== "id" || config.urlTemplate !== "{raw:url}" ||
      !Array.isArray(config.allowUrlPrefixes) || config.allowUrlPrefixes.length !== 1 || config.allowUrlPrefixes[0] !== GOVCN_CANONICAL_PREFIX) {
    errors.push("GovCN query pagination requires the exact bumenfile list mapping and summary-only URL/date fields");
  }
  if (!detail || typeof detail !== "object" || Array.isArray(detail) || Object.keys(detail).some((key) => !detailKeys.includes(key)) ||
      !Number.isSafeInteger(detail.maxFetches) || detail.maxFetches < 1 || detail.maxFetches > 5 ||
      detail.titleRegex !== GOVCN_TITLE_REGEX || detail.publishedAtRegex !== GOVCN_DATE_REGEX ||
      detail.publishedAtUtcOffset !== "+08:00" || detail.bodySelector !== "#UCAP-CONTENT .trs_editor_view") {
    errors.push("GovCN query pagination requires the exact capped existing detail identity/body rules");
  }
  if (!backfill || typeof backfill !== "object" || Array.isArray(backfill) ||
      Object.keys(backfill).some((key) => !["initialBackfillMonths", "initialBackfillRequirePublishedAt", "requireBodyReadyForAutomaticSelection"].includes(key)) ||
      backfill.initialBackfillMonths !== 3 || backfill.initialBackfillRequirePublishedAt !== true || backfill.requireBodyReadyForAutomaticSelection !== true) {
    errors.push("GovCN query pagination requires the exact three-month, published-date, strict-body policy");
  }
  return errors;
}

export function govcnJsonPageUrl(configuredUrl: string, page: number): string {
  if (configuredUrl !== GOVCN_LIST_URL || !Number.isSafeInteger(page) || page < 1 || page > 2) throw new Error("invalid GovCN JSON page identity");
  const url = new URL(configuredUrl);
  const pageValues = url.searchParams.getAll("p");
  if (pageValues.length !== 1 || pageValues[0] !== "1") throw new Error("invalid GovCN JSON page query");
  url.searchParams.set("p", String(page));
  return url.toString();
}

export interface GovcnJsonPaginationSummary {
  mode: "govcn_query_v1";
  anchorAt: string;
  cutoffAt: string;
  pagesFetched: number;
  uniqueCandidates: number;
  dispatchesUsed: number;
  maxDispatches: number;
  detailTargetsUsed: number;
  maxDetailTargets: number;
  rowsUndated: number;
  rowsOutsideWindow: number;
  pendingDetails: number;
  stopReason: string;
  partial: true;
  coverage: "unproven";
}

export function createGovcnJsonPaginationBudget(source: SourceRow, pagination: GovcnJsonPaginationConfig) {
  const controller = new AbortController();
  const startedAt = Date.now();
  const deadlineAt = startedAt + GOVCN_JSON_PAGINATION_DEADLINE_MS;
  const timer = setTimeout(() => controller.abort(new Error("GovCN JSON run deadline exceeded")), GOVCN_JSON_PAGINATION_DEADLINE_MS);
  timer.unref?.();
  const signal = controller.signal;
  const dispatched = new Set<string>();
  const detailAttempts = new Set<string>();
  let dispatches = 0;
  let detailTargets = 0;
  let page: number | null = null;
  let detailTarget: string | null = null;
  let pagesFetched = 0;
  let uniqueCandidates = 0;
  let rowsUndated = 0;
  let rowsOutsideWindow = 0;
  let pendingDetails = 0;
  let stopReason = "max_pages_per_run";
  const anchor = new Date(startedAt);
  const cutoff = new Date(startedAt - 90 * 86_400_000);

  const assertActive = () => {
    if (Date.now() >= deadlineAt && !signal.aborted) controller.abort(new Error("GovCN JSON run deadline exceeded"));
    signal.throwIfAborted();
  };
  const runBudget: GuardedFetchRunBudget = {
    signal,
    beforeDispatch({ url, method, redirectHop }) {
      assertActive();
      if (method !== "GET" || redirectHop !== 0) throw new Error("GovCN JSON dispatch rejected");
      if (dispatches >= pagination.maxDispatches) throw new Error(`GovCN JSON dispatch budget exhausted (${pagination.maxDispatches})`);
      const requestUrl = url.toString();
      let admitted = false;
      if (detailTarget) {
        admitted = requestUrl === detailTarget;
      } else if (page !== null) {
        admitted = requestUrl === govcnJsonPageUrl(String(source.config.url), page);
      }
      if (!admitted || dispatched.has(requestUrl)) throw new Error("GovCN JSON dispatch target rejected");
      dispatches++;
      dispatched.add(requestUrl);
    },
    allowRedirect() { return false; },
  };

  return {
    runBudget,
    anchorAt: anchor,
    cutoffAt: cutoff,
    assertActive,
    remainingMs: () => Math.max(0, deadlineAt - Date.now()),
    dispatchesUsed: () => dispatches,
    pagesFetched: () => pagesFetched,
    detailTargetsUsed: () => detailTargets,
    canDispatch: () => dispatches < pagination.maxDispatches && Date.now() < deadlineAt,
    setPage(nextPage: number) {
      assertActive();
      if (!Number.isSafeInteger(nextPage) || nextPage < 1 || nextPage > pagination.maxPagesPerRun || detailTarget !== null) throw new Error("GovCN JSON page admission rejected");
      page = nextPage;
    },
    pageFetched() { pagesFetched++; },
    setUniqueCandidates(value: number) { uniqueCandidates = value; },
    addRowsUndated(value: number) { rowsUndated += value; },
    addRowsOutsideWindow(value: number) { rowsOutsideWindow += value; },
    admitDetail(url: string): boolean {
      assertActive();
      let target: URL;
      try { target = new URL(url); } catch { return false; }
      if (target.protocol !== "https:" || target.hostname !== "www.gov.cn" || target.port || target.username || target.password || target.hash || target.search ||
          !target.pathname.startsWith("/zhengce/zhengceku/") || !url.startsWith(GOVCN_CANONICAL_PREFIX) || detailTargets >= Number(source.config.detail.maxFetches) ||
          dispatches >= pagination.maxDispatches || detailAttempts.has(url)) return false;
      detailAttempts.add(url);
      detailTargets++;
      detailTarget = url;
      page = null;
      return true;
    },
    clearDetail() { detailTarget = null; },
    setPendingDetails(value: number) { pendingDetails = value; },
    setStopReason(value: string) { stopReason = value; },
    summary(): GovcnJsonPaginationSummary {
      return {
        mode: "govcn_query_v1", anchorAt: anchor.toISOString(), cutoffAt: cutoff.toISOString(), pagesFetched,
        uniqueCandidates, dispatchesUsed: dispatches, maxDispatches: pagination.maxDispatches,
        detailTargetsUsed: detailTargets, maxDetailTargets: Number(source.config.detail.maxFetches),
        rowsUndated, rowsOutsideWindow, pendingDetails, stopReason, partial: true, coverage: "unproven",
      };
    },
    dispose() { clearTimeout(timer); },
  };
}

export type GovcnJsonPaginationBudget = ReturnType<typeof createGovcnJsonPaginationBudget>;

export async function readGovcnJsonPages(source: SourceRow, pagination: GovcnJsonPaginationConfig, budget: GovcnJsonPaginationBudget): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  const unique = new Map<string, Candidate>();
  let previousFingerprint: string | null = null;
  for (let page = 1; page <= pagination.maxPagesPerRun; page++) {
    budget.assertActive();
    if (!budget.canDispatch()) {
      budget.setStopReason("max_dispatches");
      break;
    }
    budget.setPage(page);
    const result: JsonListPageResult = await fetchGovcnJsonPage(source, page, {
      runBudget: budget.runBudget,
      timeoutMs: Math.min(25_000, budget.remainingMs()),
      assertActive: budget.assertActive,
    });
    budget.pageFetched();
    budget.addRowsUndated(result.rowsUndated);
    if (result.rawRowCount === 0) {
      budget.setStopReason("empty_page");
      break;
    }
    const identities = result.candidates.map((candidate) => identityKeyFor({ ...candidate, sourceId: source.id, via: "fetch" })).sort();
    const fingerprint = JSON.stringify(identities);
    if (previousFingerprint !== null && fingerprint === previousFingerprint) {
      budget.setStopReason("duplicate_page");
      break;
    }
    const previousCount = unique.size;
    for (const candidate of result.candidates) {
      const identity = identityKeyFor({ ...candidate, sourceId: source.id, via: "fetch" });
      if (!unique.has(identity)) unique.set(identity, candidate);
    }
    if (page > 1 && unique.size === previousCount) {
      budget.setStopReason("no_new_identities");
      break;
    }
    previousFingerprint = fingerprint;
  }
  candidates.push(...unique.values());
  budget.setUniqueCandidates(candidates.length);
  return candidates;
}

export function isGovcnJsonPaginationSource(source: Pick<SourceRow, "id" | "kind" | "config">): boolean {
  return source.id === GOVCN_SOURCE_ID && source.kind === "json_list" && hasGovcnJsonPagination(source.config);
}

export function govcnCandidateInWindow(candidate: Candidate, budget: GovcnJsonPaginationBudget): boolean {
  const date = candidate.publishedAt;
  if (!date || !Number.isFinite(date.getTime())) return false;
  const trusted = decideTimeline(date, budget.anchorAt, "first-import").publishedAt;
  if (!trusted || trusted.getTime() < budget.cutoffAt.getTime() || trusted.getTime() > budget.anchorAt.getTime()) {
    budget.addRowsOutsideWindow(1);
    return false;
  }
  return true;
}
