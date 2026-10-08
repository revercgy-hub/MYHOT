// The config keys each kind of source implements. Anything else is refused: a key a collector does not
// know would otherwise fall back silently to the generic parse (menus and sentence fragments as
// articles, dates never found).
import type { SourceRow } from "./types.ts";
import { validateBodyPolicies, validateSelectedBodyIdentityRegexes } from "../content/selected-body.ts";
import { validateWebListPagination } from "./web-list-pagination.ts";

// Rules applied in collect.ts to every kind read through collectSource.
const COLLECTED = ["_aihot", "allowUrlPrefixes", "denyUrlPrefixes", "ingestNoiseFilter", "itemUrlPrefixRewrite", "sortByPublishedAt", "detail", "fetchPublicContent"];

const KEYS: Record<SourceRow["kind"], string[]> = {
  rss: [...COLLECTED, "feedUrl", "summaryIsBody", "preserveUrlFragment", "allowCategories", "denyCategories"],
  web_list: [
    ...COLLECTED, "url", "baseUrl", "parseMode", "adapter", "cacheToleranceSeconds", "linksStartLine", "preserveUrlFragment",
    "itemSelector", "linkSelector", "titleSelector", "titleAttribute", "publishedAtSelector", "publishedAtRegex", "publishedAtUtcOffset",
    "pagination",
  ],
  json_list: [
    ...COLLECTED, "url", "mode", "method", "headers", "bodyJson", "jsonKey", "windowVar", "itemsPath", "itemsObjectValues", "categorySelection",
    "titlePaths", "summaryPaths", "summaryIsBody", "authorPaths", "publishedAtPath", "publishedAtUnit", "publishedAtUtcOffset", "externalIdPath",
    "urlTemplate", "urlTemplateFallback", "rawDropKeys", "requireBoolean", "minNumeric",
  ],
  // X accounts are mostly read in shards, which apply only these.
  x_search: ["_aihot", "ingestNoiseFilter", "itemUrlPrefixRewrite", "query", "searchType"],
  mp_account: ["wxid", "ghid", "nickname"],
  external: [],
};

// Objects with fixed keys (headers and bodyJson are request data, free-form).
const NESTED: Record<string, string[]> = {
  _aihot: ["initialBackfillLimit", "initialBackfillMonths", "initialBackfillRequirePublishedAt", "requireBodyReadyForAutomaticSelection"],
  ingestNoiseFilter: ["dropMarkers", "dropMarkersTitleOnly", "keepIfMatches"],
  itemUrlPrefixRewrite: ["from", "to"],
  requireBoolean: ["path", "equals"],
  minNumeric: ["path", "min"],
  detail: [
    "mode", "maxFetches", "publishedAtSelector", "publishedAtRegex", "publishedAtUtcOffset", "publishedAtAuthoritative", "upgradeDatePrecision",
    "titleSelector", "titleRegex", "titleAuthoritative", "summarySelector", "articleSelector", "bodySelector", "allowShortBody", "bodyPolicies", "attachmentScopeSelector",
    "attachmentSelector", "attachmentMode", "pdfDirect",
  ],
  pagination: ["mode", "maxPagesPerRun", "maxDispatches", "maxPageIndex", "detailMode"],
  categorySelection: ["arrayPath", "categoryIdPath", "categoryId", "itemsPath"],
};

const VALUES: Record<string, string[]> = {
  adapter: ["mimo_home"],
  parseMode: ["html", "markdown", "docusaurus_changelog"],
};

/** The config entries a source of this kind would ignore or cannot run, e.g. ["adapter=site_cards", "detail.titleFoo"]. */
export function unsupportedConfig(kind: SourceRow["kind"], config: Record<string, unknown>): string[] {
  const allowed = new Set(KEYS[kind] ?? []);
  const out: string[] = [];
  for (const [key, value] of Object.entries(config ?? {})) {
    if (!allowed.has(key)) out.push(key);
    else if (VALUES[key] && !VALUES[key]!.includes(String(value))) out.push(`${key}=${String(value)}`);
    else if (key === "_aihot" && (!value || typeof value !== "object" || Array.isArray(value))) out.push("_aihot must be an object");
    else if (NESTED[key] && value && typeof value === "object") {
      const nested = value as Record<string, unknown>;
      for (const sub of Object.keys(nested)) if (!NESTED[key]!.includes(sub)) out.push(`${key}.${sub}`);
      if (key === "_aihot" && nested.initialBackfillRequirePublishedAt !== undefined && typeof nested.initialBackfillRequirePublishedAt !== "boolean") {
        out.push("_aihot.initialBackfillRequirePublishedAt must be boolean");
      }
      if (key === "_aihot" && nested.requireBodyReadyForAutomaticSelection !== undefined && typeof nested.requireBodyReadyForAutomaticSelection !== "boolean") {
        out.push("_aihot.requireBodyReadyForAutomaticSelection must be boolean");
      }
      if (key === "detail") {
        if (nested.mode !== undefined && nested.mode !== "nfra_json_v1") out.push("detail.mode");
        if (nested.bodySelector !== undefined || nested.bodyPolicies !== undefined) {
          for (const error of validateSelectedBodyIdentityRegexes(nested)) out.push(`detail.${error}`);
        }
        if (nested.bodyPolicies !== undefined) {
          for (const error of validateBodyPolicies(nested.bodyPolicies)) out.push(`detail.${error}`);
          if (kind !== "web_list") out.push("detail.bodyPolicies is only supported by web_list");
          for (const legacy of ["bodySelector", "allowShortBody", "articleSelector", "attachmentSelector", "attachmentMode", "pdfDirect"] as const) {
            if (nested[legacy] !== undefined) out.push(`detail.bodyPolicies cannot be combined with detail.${legacy}`);
          }
        }
        if (nested.bodySelector !== undefined && (typeof nested.bodySelector !== "string" || !nested.bodySelector.trim())) out.push("detail.bodySelector");
        if (nested.attachmentScopeSelector !== undefined) {
          if (typeof nested.attachmentScopeSelector !== "string" || !nested.attachmentScopeSelector.trim() || nested.attachmentScopeSelector.trim().length > 500) {
            out.push("detail.attachmentScopeSelector must be a non-empty string of at most 500 characters");
          }
          if (kind !== "web_list") out.push("detail.attachmentScopeSelector is only supported by web_list");
          if (nested.bodySelector === undefined && nested.bodyPolicies === undefined) out.push("detail.attachmentScopeSelector requires detail.bodySelector or detail.bodyPolicies");
          for (const field of ["articleSelector", "attachmentSelector", "attachmentMode", "pdfDirect"] as const) {
            if (nested[field] !== undefined) out.push(`detail.attachmentScopeSelector cannot be combined with detail.${field}`);
          }
        }
        if (nested.allowShortBody !== undefined && typeof nested.allowShortBody !== "boolean") out.push("detail.allowShortBody");
        if (nested.allowShortBody === true && !nested.bodySelector) out.push("detail.allowShortBody requires detail.bodySelector");
        for (const field of ["articleSelector", "attachmentSelector"] as const) {
          if (nested[field] !== undefined && (typeof nested[field] !== "string" || !nested[field].trim())) out.push(`detail.${field}`);
        }
        if (nested.attachmentMode !== undefined && !["required", "optional"].includes(String(nested.attachmentMode))) out.push("detail.attachmentMode");
        if (nested.pdfDirect !== undefined && typeof nested.pdfDirect !== "boolean") out.push("detail.pdfDirect");
        if (nested.attachmentSelector && (!nested.articleSelector || !nested.bodySelector)) out.push("detail.attachmentSelector requires detail.articleSelector and detail.bodySelector");
        if (nested.articleSelector && (!nested.bodySelector || !nested.attachmentSelector)) out.push("detail.articleSelector requires detail.bodySelector and detail.attachmentSelector");
        if (nested.attachmentMode !== undefined && !nested.attachmentSelector) out.push("detail.attachmentMode requires detail.attachmentSelector");
        if (nested.pdfDirect === true && (nested.articleSelector || nested.bodySelector || nested.attachmentSelector || nested.attachmentMode)) out.push("detail.pdfDirect cannot be combined with HTML selectors");
        if (nested.pdfDirect === true || nested.attachmentSelector) {
          if (kind !== "web_list") out.push("PDF body config is only supported by web_list");
          const prefixes = config.allowUrlPrefixes;
          const validPrefixes = Array.isArray(prefixes) && prefixes.length > 0 && prefixes.every((prefix) => {
            if (typeof prefix !== "string") return false;
            try {
              const parsed = new URL(prefix);
              return parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.search && !parsed.hash;
            } catch { return false; }
          });
          if (!validPrefixes) out.push("PDF opt-in requires HTTPS allowUrlPrefixes");
        }
      }
    }
  }
  if ((config.detail as Record<string, unknown> | undefined)?.mode === "nfra_json_v1") {
    const detail = config.detail as Record<string, unknown>;
    const selection = config.categorySelection as Record<string, unknown> | undefined;
    const exactUrl = "https://www.nfra.gov.cn/cbircweb/DocInfo/SelectItemAndDocByItemPId?itemId=914&pageSize=6";
    if (kind !== "json_list") out.push("detail.mode=nfra_json_v1 is only supported by json_list");
    if (config.url !== exactUrl || (config.method !== undefined && config.method !== "GET") || config.bodyJson !== undefined || config.headers !== undefined || config.mode !== undefined || config.jsonKey !== undefined || config.windowVar !== undefined || config.itemsPath !== undefined || config.itemsObjectValues !== undefined) {
      out.push("NFRA detail mode requires the observed direct GET list URL without other JSON modes");
    }
    if (!selection || Object.keys(selection).length !== 4 || selection.arrayPath !== "data" || selection.categoryIdPath !== "itemId" || selection.categoryId !== 915 || selection.itemsPath !== "docInfoVOList") {
      out.push("NFRA detail mode requires the exact categorySelection for itemId 915");
    }
    const allowedDetail = new Set(["mode", "maxFetches", "publishedAtUtcOffset", "bodySelector"]);
    for (const field of Object.keys(detail)) if (!allowedDetail.has(field)) out.push(`NFRA detail mode does not support detail.${field}`);
    if (detail.maxFetches !== 6) out.push("NFRA detail mode requires detail.maxFetches=6");
    if (detail.publishedAtUtcOffset !== "+08:00") out.push("NFRA detail mode requires detail.publishedAtUtcOffset=+08:00");
    if (typeof detail.bodySelector !== "string" || !detail.bodySelector.trim()) out.push("NFRA detail mode requires a non-empty detail.bodySelector");
    if (config.summaryIsBody !== false) out.push("NFRA summary must remain excerpt-only");
    const topLevel = new Set(["url", "categorySelection", "summaryIsBody", "publishedAtUtcOffset", "allowUrlPrefixes", "detail", "_aihot"]);
    for (const field of Object.keys(config)) if (!topLevel.has(field)) out.push(`NFRA detail mode does not support ${field}`);
    if (config.publishedAtUtcOffset !== "+08:00") out.push("NFRA list requires publishedAtUtcOffset=+08:00");
    if (!Array.isArray(config.allowUrlPrefixes) || config.allowUrlPrefixes.length !== 1 || config.allowUrlPrefixes[0] !== "https://www.nfra.gov.cn/cn/view/pages/ItemDetail.html?") out.push("NFRA canonical article URL prefix must be exact");
    const policy = config._aihot as Record<string, unknown> | undefined;
    if (policy?.initialBackfillMonths !== 3 || policy.initialBackfillRequirePublishedAt !== true || policy.requireBodyReadyForAutomaticSelection !== true ||
      Object.keys(policy ?? {}).some((field) => !["initialBackfillMonths", "initialBackfillRequirePublishedAt", "requireBodyReadyForAutomaticSelection"].includes(field))) {
      out.push("NFRA requires the exact 3-month published-date and body-readiness policy");
    }
  } else if (config.categorySelection !== undefined) {
    out.push("categorySelection requires detail.mode=nfra_json_v1");
  }
  out.push(...validateWebListPagination(kind, config ?? {}));
  return out;
}

export class UnsupportedConfig extends Error {
  readonly statusCode = 400;
}

/** Refuses a config with entries its kind does not implement (admin create, edit and preview). */
export function assertSupportedConfig(kind: SourceRow["kind"], config: Record<string, unknown>): void {
  const bad = unsupportedConfig(kind, config);
  if (bad.length) throw new UnsupportedConfig(`不支持的配置项：${bad.join("、")}`);
}
