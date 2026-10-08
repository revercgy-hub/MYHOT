import { createAttachmentDiagnostic, type AttachmentDiagnostic } from "./attachment-diagnostics.ts";
import { extractNfraJsonSelectedBody } from "./selected-body.ts";
import { guardedFetch, type GuardedFetchOptions, type GuardedFetchRunBudget, type GuardedResponse } from "../lib/http-fetch.ts";
import type { ExtractedBody } from "./extract.ts";
import { FetchError, type SourceRow } from "../sources/types.ts";

const NFRA_ORIGIN = "https://www.nfra.gov.cn";
const LIST_PATH = "/cbircweb/DocInfo/SelectItemAndDocByItemPId";
const DETAIL_PATH = "/cbircweb/DocInfo/SelectByDocId";
const ARTICLE_PATH = "/cn/view/pages/ItemDetail.html";

function canonicalDocId(articleUrl: string): number {
  let url: URL;
  try { url = new URL(articleUrl); } catch { throw new FetchError("NFRA article URL is invalid"); }
  const keys = [...url.searchParams.keys()];
  const docIds = url.searchParams.getAll("docId");
  const itemIds = url.searchParams.getAll("itemId");
  if (url.origin !== NFRA_ORIGIN || url.pathname !== ARTICLE_PATH || url.username || url.password || url.hash ||
    (url.port && url.port !== "443") || keys.length !== 2 || new Set(keys).size !== 2 || docIds.length !== 1 || itemIds.length !== 1 || itemIds[0] !== "915" || !/^\d+$/.test(docIds[0]!)) {
    throw new FetchError("NFRA article URL does not match the approved canonical template");
  }
  const id = Number(docIds[0]);
  if (!Number.isSafeInteger(id) || id <= 0) throw new FetchError("NFRA article ID is invalid");
  return id;
}

export function createNfraJsonRunBudget(options: { delayedDocId?: number } = {}): { runBudget: GuardedFetchRunBudget; assertActive(): void; remainingMs(): number; dispose(): void } {
  const limit = options.delayedDocId === undefined ? 120_000 : 20_000;
  const deadline = Date.now() + limit;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("NFRA source run deadline exceeded")), limit);
  timer.unref?.();
  let dispatches = 0;
  let listCount = 0;
  let detailCount = 0;
  const detailIds = new Set<string>();
  const assertActive = () => {
    if (Date.now() >= deadline && !controller.signal.aborted) controller.abort(new Error("NFRA source run deadline exceeded"));
    controller.signal.throwIfAborted();
  };
  const runBudget: GuardedFetchRunBudget = {
    signal: controller.signal,
    beforeDispatch({ url, method, redirectHop }) {
      assertActive();
      if (dispatches >= (options.delayedDocId === undefined ? 7 : 1) || method !== "GET" || redirectHop !== 0 || url.origin !== NFRA_ORIGIN || url.username || url.password || url.hash || (url.port && url.port !== "443")) {
        throw new Error("NFRA bounded dispatch rejected");
      }
      if (options.delayedDocId !== undefined) {
        if (url.pathname !== DETAIL_PATH || url.search !== `?docId=${options.delayedDocId}` || dispatches !== 0) throw new Error("NFRA delayed detail dispatch rejected");
        detailIds.add(String(options.delayedDocId));
        detailCount += 1;
      } else if (url.pathname === LIST_PATH && url.search === "?itemId=914&pageSize=6") {
        if (listCount !== 0 || dispatches !== 0) throw new Error("NFRA list dispatch already used");
        listCount += 1;
      } else if (url.pathname === DETAIL_PATH && [...url.searchParams.keys()].length === 1 && url.searchParams.getAll("docId").length === 1 && /^\d+$/.test(url.searchParams.get("docId") ?? "")) {
        if (listCount !== 1 || detailCount >= 6) throw new Error("NFRA detail dispatch budget exhausted");
        const id = url.searchParams.get("docId")!;
        if (detailIds.has(id)) throw new Error("NFRA duplicate detail dispatch rejected");
        detailIds.add(id);
        detailCount += 1;
      } else throw new Error("NFRA dispatch URL rejected");
      dispatches += 1;
    },
    allowRedirect: () => false,
  };
  return { runBudget, assertActive, remainingMs: () => Math.max(0, deadline - Date.now()), dispose: () => clearTimeout(timer) };
}

export interface NfraDetailExpected {
  docId: number;
  title: string;
  publishedAt: Date;
  listAttachmentPending: boolean;
}

export interface NfraDetailResult {
  body: ExtractedBody | null;
  attachmentDiagnostic: AttachmentDiagnostic | null;
  reason: string | null;
}

type NfraFetcher = (input: string, opts?: GuardedFetchOptions) => Promise<GuardedResponse>;

export async function fetchNfraJsonDetail(
  articleUrl: string,
  source: SourceRow,
  expected: NfraDetailExpected,
  options: { fetcher?: NfraFetcher; runBudget?: GuardedFetchRunBudget; remainingMs?: () => number } = {},
): Promise<NfraDetailResult> {
  try {
    const docId = canonicalDocId(articleUrl);
    if (docId !== expected.docId || !Number.isSafeInteger(expected.docId) || !expected.title.trim() || !Number.isFinite(expected.publishedAt.getTime())) {
      throw new FetchError("NFRA article identity expectation is invalid");
    }
    const url = `${NFRA_ORIGIN}${DETAIL_PATH}?docId=${docId}`;
    const timeoutMs = Math.min(20_000, Math.max(1, options.remainingMs?.() ?? 20_000));
    const fetcher = options.fetcher ?? guardedFetch;
    const response = await fetcher(url, {
      method: "GET", timeoutMs, maxBytes: 1024 * 1024, maxRedirects: 0,
      headers: { accept: "application/json" }, ...(options.runBudget ? { runBudget: options.runBudget } : {}),
    });
    if (response.status !== 200 || response.url !== url) throw new FetchError("NFRA detail HTTP status or URL mismatch", response.status);
    if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) throw new FetchError("NFRA detail response is not JSON");
    let jsonText: string;
    try { jsonText = new TextDecoder("utf-8", { fatal: true }).decode(response.body); }
    catch { throw new FetchError("NFRA detail is not valid UTF-8"); }
    options.runBudget?.signal?.throwIfAborted();
    const checked = extractNfraJsonSelectedBody(jsonText, articleUrl, {
      bodySelector: String(source.config.detail?.bodySelector ?? ""),
      publishedAtUtcOffset: "+08:00",
    }, { docId, title: expected.title, publishedAt: expected.publishedAt });
    options.runBudget?.signal?.throwIfAborted();
    if (!checked.identityValid) throw new FetchError("NFRA detail identity mismatch");
    const diagnostic = createAttachmentDiagnostic({ reason: "attachments_unprocessed", articleUrl, attachments: [] });
    // Even an empty JSON attachment list cannot rebut the non-empty list-side DOC/PDF fields.
    // Keep the selector result private; this source is not body-ready until attachment semantics are known.
    return { body: null, attachmentDiagnostic: diagnostic, reason: "attachments_unprocessed" };
  } catch (error) {
    return { body: null, attachmentDiagnostic: createAttachmentDiagnostic({ reason: "attachments_unprocessed", articleUrl, attachments: [] }), reason: error instanceof Error ? error.message : "NFRA detail declined" };
  }
}

export function nfraConfigIsSupported(source: SourceRow): boolean {
  const c = source.config;
  const d = c.detail;
  const selection = c.categorySelection;
  return source.id === "nfra-regulatory-dynamics" && source.kind === "json_list" && c.url === `${NFRA_ORIGIN}${LIST_PATH}?itemId=914&pageSize=6` && d?.mode === "nfra_json_v1" &&
    d.maxFetches === 6 && d.publishedAtUtcOffset === "+08:00" && typeof d.bodySelector === "string" && !!d.bodySelector.trim() &&
    Object.keys(d).every((key) => ["mode", "maxFetches", "publishedAtUtcOffset", "bodySelector"].includes(key)) &&
    selection?.arrayPath === "data" && selection?.categoryIdPath === "itemId" && selection?.categoryId === 915 && selection?.itemsPath === "docInfoVOList" &&
    Object.keys(selection).length === 4 && (c.method === undefined || c.method === "GET") && c.headers === undefined && c.bodyJson === undefined &&
    c.mode === undefined && c.jsonKey === undefined && c.windowVar === undefined && c.itemsPath === undefined && c.itemsObjectValues === undefined &&
    Array.isArray(c.allowUrlPrefixes) && c.allowUrlPrefixes.length === 1 && c.allowUrlPrefixes[0] === `${NFRA_ORIGIN}${ARTICLE_PATH}?` &&
    c.summaryIsBody === false && c.publishedAtUtcOffset === "+08:00" && c._aihot?.initialBackfillMonths === 3 &&
    c._aihot?.initialBackfillRequirePublishedAt === true && c._aihot?.requireBodyReadyForAutomaticSelection === true &&
    Object.keys(c._aihot ?? {}).every((key) => ["initialBackfillMonths", "initialBackfillRequirePublishedAt", "requireBodyReadyForAutomaticSelection"].includes(key)) &&
    Object.keys(c).every((key) => ["url", "categorySelection", "summaryIsBody", "publishedAtUtcOffset", "allowUrlPrefixes", "detail", "_aihot"].includes(key));
}
