// The config keys each kind of source implements. Anything else is refused: a key a collector does not
// know would otherwise fall back silently to the generic parse (menus and sentence fragments as
// articles, dates never found).
import type { SourceRow } from "./types.ts";
import { validateBodyPolicies } from "../content/selected-body.ts";

// Rules applied in collect.ts to every kind read through collectSource.
const COLLECTED = ["_aihot", "allowUrlPrefixes", "denyUrlPrefixes", "ingestNoiseFilter", "itemUrlPrefixRewrite", "sortByPublishedAt", "detail", "fetchPublicContent"];

const KEYS: Record<SourceRow["kind"], string[]> = {
  rss: [...COLLECTED, "feedUrl", "summaryIsBody", "preserveUrlFragment", "allowCategories", "denyCategories"],
  web_list: [
    ...COLLECTED, "url", "baseUrl", "parseMode", "adapter", "cacheToleranceSeconds", "linksStartLine", "preserveUrlFragment",
    "itemSelector", "linkSelector", "titleSelector", "titleAttribute", "publishedAtSelector", "publishedAtRegex", "publishedAtUtcOffset",
  ],
  json_list: [
    ...COLLECTED, "url", "mode", "method", "headers", "bodyJson", "jsonKey", "windowVar", "itemsPath", "itemsObjectValues",
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
    "maxFetches", "publishedAtSelector", "publishedAtRegex", "publishedAtUtcOffset", "publishedAtAuthoritative", "upgradeDatePrecision",
    "titleSelector", "titleRegex", "titleAuthoritative", "summarySelector", "articleSelector", "bodySelector", "allowShortBody", "bodyPolicies", "attachmentScopeSelector",
    "attachmentSelector", "attachmentMode", "pdfDirect",
  ],
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
