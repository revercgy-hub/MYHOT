// JSON sources: plain JSON APIs, JSON embedded in HTML (script tags, window variables).
import { credential } from "../config.ts";
import { guardedFetch } from "../lib/http-fetch.ts";
import { collapseWhitespace, stripTags } from "../lib/text.ts";
import { parseLooseDate } from "./date.ts";
import { FetchError, type Candidate, type SourceRow } from "./types.ts";
import { createAttachmentDiagnostic } from "../content/attachment-diagnostics.ts";

export interface JsonListFetchOptions {
  runBudget?: import("../lib/http-fetch.ts").GuardedFetchRunBudget;
  timeoutMs?: number;
  assertActive?: () => void;
}

export interface JsonListPageResult {
  candidates: Candidate[];
  rawRowCount: number;
  rowsUndated: number;
}

export function getPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur) && /^\d+$/.test(seg)) cur = cur[Number(seg)];
    else if (typeof cur === "object") cur = (cur as Record<string, unknown>)[seg];
    else return undefined;
  }
  return cur;
}

function firstString(obj: unknown, paths: string[] | undefined): string | null {
  for (const p of paths ?? []) {
    const v = getPath(obj, p);
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

/** "{path}" → encoded value, "{raw:path}" → raw value. Returns null when a referenced value is missing. */
export function renderTemplate(template: string, item: unknown): string | null {
  let missing = false;
  const out = template.replace(/\{(raw:)?([^}]+)\}/g, (_m, raw: string | undefined, path: string) => {
    const v = getPath(item, path);
    if (v === undefined || v === null || v === "") {
      missing = true;
      return "";
    }
    return raw ? String(v) : encodeURIComponent(String(v)).replace(/%2F/g, "/");
  });
  return missing ? null : out;
}

export function selectNfraCategoryRows(data: unknown, selection: { arrayPath: string; categoryIdPath: string; categoryId: number; itemsPath: string }): unknown[] {
  if (!data || typeof data !== "object" || Array.isArray(data) || (data as Record<string, unknown>).rptCode !== 200 ||
    !Number.isSafeInteger(selection.categoryId) || selection.categoryId <= 0) throw new FetchError("invalid NFRA category response");
  const categories = getPath(data, selection.arrayPath);
  if (!Array.isArray(categories)) throw new FetchError("NFRA category path did not resolve to an array");
  const matches = categories.filter((category) => {
    const id = getPath(category, selection.categoryIdPath);
    return typeof id === "number" && id === selection.categoryId;
  });
  if (matches.length !== 1) throw new FetchError("NFRA category selection was missing or ambiguous");
  const rows = getPath(matches[0], selection.itemsPath);
  if (!Array.isArray(rows)) throw new FetchError("NFRA category rows did not resolve to an array");
  return rows;
}

export function mapNfraCategoryItem(item: unknown, categoryId = 915): Candidate | null {
  const id = getPath(item, "docId");
  if (categoryId !== 915 || typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 || getPath(item, "isTitleLink") !== "0") return null;
  const title = firstString(item, ["docSubtitle", "docTitle"]);
  const publishedAt = toDate(getPath(item, "publishDate"), undefined, "+08:00");
  if (!title || !publishedAt) return null;
  const url = `https://www.nfra.gov.cn/cn/view/pages/ItemDetail.html?docId=${id}&itemId=${categoryId}`;
  const summary = firstString(item, ["docSummary"]);
  const candidate: Candidate = {
    url, title: collapseWhitespace(stripTags(title)), author: null, publishedAt,
    excerpt: summary ? collapseWhitespace(stripTags(summary)).slice(0, 2000) : null,
    bodyText: null, bodyStatus: "pending", raw: { externalId: id },
  };
  // Missing or empty list-side attachment fields are also unknown, never proof of absence.
  candidate.attachmentDiagnostic = createAttachmentDiagnostic({ reason: "attachments_unprocessed", articleUrl: url, attachments: [] }) ?? undefined;
  return candidate;
}

function toDate(v: unknown, unit: string | undefined, utcOffset?: string): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (unit === "epoch_ms") return new Date(Number(v));
  if (unit === "epoch_s") return new Date(Number(v) * 1000);
  // 20260922: a calendar day at UTC midnight (some list APIs give dates as yyyymmdd).
  if (unit === "yyyymmdd") {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(v).trim());
    const d = m ? new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`) : null;
    return d && Number.isFinite(d.getTime()) && d.toISOString().startsWith(`${m![1]}-${m![2]}-${m![3]}`) ? d : null;
  }
  if (!unit && utcOffset && typeof v === "string") return parseLooseDate(v, utcOffset);
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? new Date(t) : null;
}

function findKey(obj: unknown, key: string, depth = 0): unknown {
  if (depth > 12 || obj === null || typeof obj !== "object") return undefined;
  if (!Array.isArray(obj) && key in (obj as Record<string, unknown>)) {
    const v = (obj as Record<string, unknown>)[key];
    if (Array.isArray(v)) return v;
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    const found = findKey(v, key, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

function embeddedJson(html: string, source: SourceRow): unknown {
  const mode = source.config.mode;
  if (mode === "html_window_var") {
    const name = String(source.config.windowVar);
    const re = new RegExp(`(?:window\\.)?${name.replace(/[$]/g, "\\$")}\\s*=\\s*`);
    const m = re.exec(html);
    if (!m) throw new FetchError(`window.${name} not found`);
    const start = m.index + m[0].length;
    // Balanced-brace scan to find the object literal's end.
    let depth = 0, inStr: string | null = null, esc = false;
    for (let i = start; i < html.length; i++) {
      const ch = html[i]!;
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === '"' || ch === "'") inStr = ch;
      else if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) return JSON.parse(html.slice(start, i + 1));
      }
    }
    throw new FetchError(`window.${name} not terminated`);
  }
  // html_json_key: scan JSON script blocks (e.g. __NEXT_DATA__) for the key.
  const key = String(source.config.jsonKey);
  for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const body = m[1]!.trim();
    // Flight payloads carry the key escaped inside a string (\"items\").
    if (!body.includes(`"${key}"`) && !body.includes(`\\"${key}\\"`)) continue;
    const candidates = [body, body.replace(/^[^{[]*/, "").replace(/;?\s*$/, "")];
    for (const c of candidates) {
      try {
        const parsed = JSON.parse(c);
        const found = findKey(parsed, key);
        if (found) return { [key]: found };
      } catch {
        // Next.js flight payloads: self.__next_f.push([1,"..."])
      }
    }
    const flight = /"((?:[^"\\]|\\.)*)"\]\)\s*$/.exec(body);
    if (flight) {
      try {
        const decoded = JSON.parse(`"${flight[1]}"`) as string;
        const idx = decoded.indexOf(`"${key}"`);
        if (idx >= 0) {
          const objStart = decoded.lastIndexOf("{", idx);
          const parsed = JSON.parse(decoded.slice(objStart, decoded.indexOf("]", idx) + 1) + "}");
          const found = findKey(parsed, key);
          if (found) return { [key]: found };
        }
      } catch {
        // keep scanning
      }
    }
  }
  throw new FetchError(`embedded key ${key} not found`);
}

const GOVCN_LIST_URL = "https://sousuo.www.gov.cn/search-gov/data?q=&sort=score&sortType=1&searchfield=title&p=1&n=5&type=gwyzcwjk";

function govcnPageUrl(source: SourceRow, page: number): string {
  const p = source.config.pagination;
  const c = source.config;
  const detail = c.detail;
  const resume = p?.mode === "govcn_query_resume_v1" && p.maxPagesPerRun === 2 && Number.isSafeInteger(p.maxDispatches) && p.maxDispatches >= 2 && p.maxDispatches <= 12;
  const stateless = p?.mode === "govcn_query_v1" && Number.isSafeInteger(p.maxPagesPerRun) && p.maxPagesPerRun >= 1 && p.maxPagesPerRun <= 2 &&
    Number.isSafeInteger(p.maxDispatches) && p.maxDispatches >= 1 && p.maxDispatches <= 12;
  const maxPage = resume ? 200 : stateless ? p.maxPagesPerRun : 0;
  const configKeys = ["url", "itemsPath", "titlePaths", "summaryPaths", "summaryIsBody", "publishedAtPath", "publishedAtUnit", "publishedAtUtcOffset", "externalIdPath", "urlTemplate", "allowUrlPrefixes", "detail", "_aihot", "pagination"];
  if (source.id !== "govcn-policy-library" || source.kind !== "json_list" || page < 1 || page > maxPage || !Number.isSafeInteger(page) ||
      source.config.url !== GOVCN_LIST_URL || !(resume || stateless) || Object.keys(p).length !== 3 ||
      Object.keys(c).some((key) => !configKeys.includes(key)) ||
      c.itemsPath !== "searchVO.catMap.bumenfile.listVO" || JSON.stringify(c.titlePaths) !== JSON.stringify(["title"]) ||
      JSON.stringify(c.summaryPaths) !== JSON.stringify(["summary"]) || c.summaryIsBody !== false || c.publishedAtPath !== "pubtime" ||
      c.publishedAtUnit !== "epoch_ms" || c.publishedAtUtcOffset !== "+08:00" || c.externalIdPath !== "id" || c.urlTemplate !== "{raw:url}" ||
      !Array.isArray(c.allowUrlPrefixes) || c.allowUrlPrefixes.length !== 1 || c.allowUrlPrefixes[0] !== "https://www.gov.cn/zhengce/zhengceku/" ||
      !detail || typeof detail !== "object" || Array.isArray(detail) || Object.keys(detail).some((key) => !["maxFetches", "titleRegex", "publishedAtRegex", "publishedAtUtcOffset", "bodySelector"].includes(key)) ||
      !Number.isSafeInteger(detail.maxFetches) || detail.maxFetches < 1 || detail.maxFetches > 5 ||
      detail.titleRegex !== "<title>(.*?)_国务院部门文件_中国政府网</title>" ||
      detail.publishedAtRegex !== "name=\"firstpublishedtime\" content=\"(\\d{4}-\\d{2}-\\d{2})-\\d{2}:\\d{2}:\\d{2}\"" ||
      detail.publishedAtUtcOffset !== "+08:00" || detail.bodySelector !== "#UCAP-CONTENT .trs_editor_view" ||
      c._aihot?.initialBackfillMonths !== 3 || c._aihot?.initialBackfillRequirePublishedAt !== true || c._aihot?.requireBodyReadyForAutomaticSelection !== true ||
      Object.keys(c._aihot ?? {}).some((key) => !["initialBackfillMonths", "initialBackfillRequirePublishedAt", "requireBodyReadyForAutomaticSelection"].includes(key))) {
    throw new FetchError("unsupported GovCN JSON pagination entry");
  }
  const url = new URL(GOVCN_LIST_URL);
  if (url.searchParams.getAll("p").length !== 1 || url.searchParams.get("p") !== "1") throw new FetchError("invalid GovCN JSON page query");
  url.searchParams.set("p", String(page));
  return url.toString();
}

export async function fetchGovcnJsonPage(source: SourceRow, page: number, options: JsonListFetchOptions = {}): Promise<JsonListPageResult> {
  return fetchJsonListPageInternal(source, options, govcnPageUrl(source, page));
}

export async function fetchJsonList(source: SourceRow, options: JsonListFetchOptions = {}): Promise<Candidate[]> {
  if (Object.hasOwn(source.config ?? {}, "pagination")) {
    const pagination = source.config.pagination;
    if (!pagination || typeof pagination !== "object" || Array.isArray(pagination) ||
        !((pagination.mode === "govcn_query_v1" && Number.isSafeInteger(pagination.maxPagesPerRun) && pagination.maxPagesPerRun >= 1 && pagination.maxPagesPerRun <= 2 &&
            Number.isSafeInteger(pagination.maxDispatches) && pagination.maxDispatches >= 1 && pagination.maxDispatches <= 12) ||
          (pagination.mode === "govcn_query_resume_v1" && pagination.maxPagesPerRun === 2 && Number.isSafeInteger(pagination.maxDispatches) && pagination.maxDispatches >= 2 && pagination.maxDispatches <= 12))) {
      throw new FetchError("unsupported JSON pagination mode");
    }
    return (await fetchGovcnJsonPage(source, 1, options)).candidates;
  }
  return (await fetchJsonListPageInternal(source, options)).candidates;
}

async function fetchJsonListPageInternal(source: SourceRow, options: JsonListFetchOptions = {}, govcnRequestedUrl?: string): Promise<JsonListPageResult> {
  const c = source.config;
  const url = govcnRequestedUrl ?? String(c.url ?? "");
  if (c.detail?.mode === "nfra_json_v1") {
    const exactUrl = "https://www.nfra.gov.cn/cbircweb/DocInfo/SelectItemAndDocByItemPId?itemId=914&pageSize=6";
    const detailKeys = Object.keys(c.detail).every((key) => ["mode", "maxFetches", "publishedAtUtcOffset", "bodySelector"].includes(key));
    const sourceKeys = Object.keys(c).every((key) => ["url", "categorySelection", "summaryIsBody", "publishedAtUtcOffset", "allowUrlPrefixes", "detail", "_aihot"].includes(key));
    if (url !== exactUrl || (c.method !== undefined && c.method !== "GET") || c.headers !== undefined || c.bodyJson !== undefined ||
      c.mode !== undefined || c.jsonKey !== undefined || c.windowVar !== undefined || c.itemsPath !== undefined || c.itemsObjectValues !== undefined ||
      c.categorySelection?.arrayPath !== "data" || c.categorySelection?.categoryIdPath !== "itemId" || c.categorySelection?.categoryId !== 915 || c.categorySelection?.itemsPath !== "docInfoVOList" || Object.keys(c.categorySelection ?? {}).length !== 4 ||
      !detailKeys || c.detail.maxFetches !== 6 || c.detail.publishedAtUtcOffset !== "+08:00" || typeof c.detail.bodySelector !== "string" || !c.detail.bodySelector.trim() ||
      c.summaryIsBody !== false || c.publishedAtUtcOffset !== "+08:00" || !Array.isArray(c.allowUrlPrefixes) || c.allowUrlPrefixes.length !== 1 || c.allowUrlPrefixes[0] !== "https://www.nfra.gov.cn/cn/view/pages/ItemDetail.html?" ||
      c._aihot?.initialBackfillMonths !== 3 || c._aihot?.initialBackfillRequirePublishedAt !== true || c._aihot?.requireBodyReadyForAutomaticSelection !== true || !sourceKeys) {
      throw new FetchError("unsupported NFRA list configuration");
    }
  }
  const headers: Record<string, string> = { accept: "application/json, text/html;q=0.9", ...(c.headers ?? {}) };
  if (/^https:\/\/api\.github\.com\//.test(url)) {
    const token = credential("collectors", "GITHUB_TOKEN");
    if (token) headers.authorization = `Bearer ${token}`;
  }
  const res = await guardedFetch(url, {
    method: c.method ?? "GET",
    headers: c.bodyJson ? { ...headers, "content-type": "application/json" } : headers,
    body: c.bodyJson ? JSON.stringify(c.bodyJson) : undefined,
    timeoutMs: options.timeoutMs ?? 25_000,
    ...(options.runBudget ? { runBudget: options.runBudget } : {}),
    ...(source.config.detail?.mode === "nfra_json_v1" || govcnRequestedUrl ? { maxBytes: 6 * 1024 * 1024, maxRedirects: 0 } : {}),
  });
  if (res.status !== 200) throw new FetchError(`HTTP ${res.status}`, res.status);
  if (c.detail?.mode === "nfra_json_v1" && res.url !== url) throw new FetchError("NFRA list response changed URL identity");
  if (govcnRequestedUrl && res.url !== url) throw new FetchError("GovCN JSON list response changed URL identity");
  let data: unknown;
  if (c.detail?.mode === "nfra_json_v1" || govcnRequestedUrl) {
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(res.body); }
    catch { throw new FetchError(govcnRequestedUrl ? "GovCN list is not valid UTF-8" : "NFRA list is not valid UTF-8"); }
    if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(res.headers.get("content-type") ?? "")) throw new FetchError(govcnRequestedUrl ? "GovCN list response is not JSON" : "NFRA list response is not JSON");
    try { data = JSON.parse(text); }
    catch { throw new FetchError(govcnRequestedUrl ? "GovCN list response is not JSON" : "NFRA list response is not JSON"); }
  } else if (c.mode === "html_json_key" || c.mode === "html_window_var") data = embeddedJson(res.text(), source);
  else {
    try {
      data = JSON.parse(res.text());
    } catch {
      throw new FetchError("response is not JSON");
    }
  }
  options.assertActive?.();
  let items: unknown;
  let nfraCategoryId: number | null = null;
  if (govcnRequestedUrl) {
    if (!data || typeof data !== "object" || Array.isArray(data) || (data as Record<string, unknown>).code !== 200) throw new FetchError("invalid GovCN query response");
    if (c.itemsPath !== "searchVO.catMap.bumenfile.listVO") throw new FetchError("unsupported GovCN JSON list path");
    items = getPath(data, c.itemsPath);
  } else if (c.categorySelection) {
    const selection = c.categorySelection;
    if (c.detail?.mode !== "nfra_json_v1") {
      throw new FetchError("invalid NFRA category response");
    }
    nfraCategoryId = selection.categoryId;
    items = selectNfraCategoryRows(data, selection);
  } else items = c.itemsPath ? getPath(data, c.itemsPath) : c.jsonKey ? getPath(data, c.jsonKey) : data;
  if (c.itemsObjectValues && items && typeof items === "object" && !Array.isArray(items)) items = Object.values(items);
  if (!Array.isArray(items)) throw new FetchError("items path did not resolve to an array");
  if (govcnRequestedUrl && items.length > 5) throw new FetchError("GovCN page exceeds the fixed five-row cap");

  const out: Candidate[] = [];
  const rowsUndated = govcnRequestedUrl ? items.filter((item) => {
    const date = toDate(getPath(item, "pubtime"), "epoch_ms", "+08:00");
    return !date || !Number.isFinite(date.getTime());
  }).length : 0;
  const seenNfraIds = new Set<number>();
  for (const item of items) {
    options.assertActive?.();
    if (nfraCategoryId !== null) {
      const id = getPath(item, "docId");
      if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 || seenNfraIds.has(id)) continue;
      seenNfraIds.add(id);
      const candidate = mapNfraCategoryItem(item, nfraCategoryId);
      if (candidate) out.push(candidate);
      continue;
    }
    if (c.requireBoolean && getPath(item, c.requireBoolean.path) !== c.requireBoolean.equals) continue;
    if (c.minNumeric && !(Number(getPath(item, c.minNumeric.path)) >= Number(c.minNumeric.min))) continue;
    const title = nfraCategoryId !== null
      ? firstString(item, ["docSubtitle", "docTitle"])
      : firstString(item, c.titlePaths);
    const url = nfraCategoryId !== null
      ? `https://www.nfra.gov.cn/cn/view/pages/ItemDetail.html?docId=${getPath(item, "docId")}&itemId=${nfraCategoryId}`
      : (c.urlTemplate && renderTemplate(c.urlTemplate, item)) || (c.urlTemplateFallback && renderTemplate(c.urlTemplateFallback, item));
    if (!title || !url) continue;
    const externalId = c.externalIdPath ? getPath(item, c.externalIdPath) : null;
    const summary = firstString(item, nfraCategoryId !== null ? ["docSummary"] : c.summaryPaths);
    const publishedAt = toDate(nfraCategoryId !== null ? getPath(item, "publishDate") : getPath(item, c.publishedAtPath), c.publishedAtUnit, nfraCategoryId !== null ? "+08:00" : c.publishedAtUtcOffset);
    if (nfraCategoryId !== null && (!publishedAt || !Number.isFinite(publishedAt.getTime()))) continue;
    const raw = item && typeof item === "object" ? { ...(item as Record<string, unknown>) } : { value: item };
    for (const k of c.rawDropKeys ?? []) delete (raw as Record<string, unknown>)[k];
    const summaryIsBody = c.summaryIsBody === true && !!summary;
    const candidate: Candidate = {
      url,
      title: collapseWhitespace(stripTags(title)),
      author: firstString(item, c.authorPaths),
      publishedAt,
      excerpt: summary ? collapseWhitespace(stripTags(summary)).slice(0, 2000) : null,
      bodyText: summaryIsBody ? stripTags(summary!) : null,
      bodyStatus: summaryIsBody ? "ok" : "pending",
      raw: { externalId: nfraCategoryId !== null ? getPath(item, "docId") : externalId ?? null },
    };
    if (nfraCategoryId !== null && (getPath(item, "docFileUrl") || getPath(item, "pdfFileUrl"))) {
      candidate.attachmentDiagnostic = createAttachmentDiagnostic({ reason: "attachments_unprocessed", articleUrl: url, attachments: [] }) ?? undefined;
    }
    out.push(candidate);
  }
  if (items.length > 0 && out.length === 0 && !c.requireBoolean && !c.minNumeric) throw new FetchError("no items mapped (check title/url paths)");
  return { candidates: out, rawRowCount: items.length, rowsUndated };
}
