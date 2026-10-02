import * as cheerio from "cheerio";
import { collapseWhitespace, escapeHtml, stripTags } from "../lib/text.ts";
import { parseLooseDate } from "../sources/date.ts";
import { sanitizeBody, trimTrailingChrome } from "./sanitize.ts";
import type { ExtractedBody } from "./extract.ts";

export interface SelectedBodyConfig {
  bodySelector?: string;
  allowShortBody?: boolean;
  bodyPolicies?: SelectedBodyPolicy[];
  publishedAtUtcOffset?: string;
}

export interface SelectedBodyPolicy {
  selector: string;
  minTextChars: number;
  table?: { requiredHeaderCells: string[]; minCompleteDataRows: number };
}

export interface SelectedArticleEnvelopeConfig extends SelectedBodyConfig {
  articleSelector: string;
  attachmentSelector: string;
  attachmentMode?: "required" | "optional";
}

export interface BodyIdentity {
  title: string;
  publishedAt: Date | null;
}

export interface SelectedBodyResult {
  body: ExtractedBody | null;
  reason: "selector_missing" | "selector_not_unique" | "body_policy_invalid" | "body_policy_ambiguous" | "body_policy_table_invalid" | "non_article_container" | "empty_body" | "short_body_not_allowed" | "identity_missing" | "identity_mismatch" | "attachments_unprocessed" | null;
  attachments: Array<{ url: string; title: string }>;
}

export interface SelectedArticleEnvelopeResult {
  body: ExtractedBody | null;
  attachment: { url: string; title: string } | null;
  reason: "article_missing" | "article_not_unique" | "body_missing" | "body_not_unique" | "attachment_region_not_unique" | "attachment_required" | "attachment_ambiguous" | "attachment_unsupported" | "attachment_unclassified" | "attachment_url_invalid" | SelectedBodyResult["reason"];
}

const BLOCKED_CONTAINERS = "nav,header,footer,aside,form,template,[role='navigation']";
const STRUCTURED_CONTENT = "p,table,ul,ol,pre,blockquote,figure";

function localDateKey(date: Date, offset: string): string | null {
  if (!Number.isFinite(date.getTime())) return null;
  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(offset);
  if (!match) return null;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) return null;
  const delta = (hours * 60 + minutes) * (match[1] === "+" ? 1 : -1);
  return new Date(date.getTime() + delta * 60_000).toISOString().slice(0, 10);
}

function identityFromHtml($: cheerio.CheerioAPI, offset: string): BodyIdentity | null {
  const title = collapseWhitespace(
    $("meta[name='ArticleTitle']").attr("content") ??
    $("meta[property='og:title']").attr("content") ??
    $("meta[property='article:title']").attr("content") ??
    $("title").first().text(),
  );
  const rawDate =
    $("meta[name='PubDate']").attr("content") ??
    $("meta[property='article:published_time']").attr("content") ??
    $("meta[name='pubdate']").attr("content") ??
    $("time[datetime]").first().attr("datetime") ??
    null;
  const publishedAt = parseLooseDate(rawDate, offset);
  return title && publishedAt ? { title, publishedAt } : null;
}

function pdfLinks($: cheerio.CheerioAPI, baseUrl: string): Array<{ url: string; title: string }> {
  const found: Array<{ url: string; title: string }> = [];
  $("a[href]").each((_, node) => {
    const anchor = $(node);
    const href = anchor.attr("href")?.trim();
    if (!href) return;
    try {
      const url = new URL(href, baseUrl);
      const type = (anchor.attr("type") ?? "").toLowerCase();
      if (!/\.pdf$/i.test(url.pathname) && type !== "application/pdf") return;
      if (!/^https?:$/.test(url.protocol)) return;
      found.push({ url: url.toString(), title: collapseWhitespace(anchor.text() || anchor.attr("title") || "") });
    } catch {
      // An invalid attachment reference cannot become a body or an actionable URL.
    }
  });
  return found;
}

function textKeepingTableCells(html: string): string {
  const $ = cheerio.load(html, null, false);
  $("table").each((_, table) => {
    const rows = $(table).find("tr").toArray().map((row) =>
      $(row).find("th,td").toArray().map((cell) => collapseWhitespace($(cell).text())).join(" | "),
    ).filter((row) => row.replace(/[|\s]/g, "").length > 0);
    $(table).replaceWith(`<div>${escapeHtml(rows.join("\n"))}</div>`);
  });
  return stripTags($.root().html() ?? "")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function imagesFromHtml(html: string): ExtractedBody["images"] {
  const $ = cheerio.load(html, null, false);
  return $("img[src]").toArray().slice(0, 12).map((node) => {
    const image = $(node);
    const width = Number(image.attr("width"));
    const height = Number(image.attr("height"));
    return {
      kind: "image" as const,
      url: image.attr("src")!,
      width: Number.isFinite(width) && width > 0 ? width : null,
      height: Number.isFinite(height) && height > 0 ? height : null,
    };
  });
}

const MAX_BODY_POLICIES = 8;
const MAX_POLICY_TEXT_CHARS = 1_000_000;
const MAX_POLICY_ROWS = 1_000;
const MAX_POLICY_HEADER_CELLS = 50;

/** Shared shape checks keep direct helper use and source-config validation fail-closed. */
export function validateBodyPolicies(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_BODY_POLICIES) return ["bodyPolicies must contain 1 to 8 policies"];
  const errors: string[] = [];
  value.forEach((raw, index) => {
    const prefix = `bodyPolicies[${index}]`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) { errors.push(`${prefix} must be an object`); return; }
    const policy = raw as Record<string, unknown>;
    for (const key of Object.keys(policy)) if (!(["selector", "minTextChars", "table"] as const).includes(key as never)) errors.push(`${prefix}.${key} is unsupported`);
    if (typeof policy.selector !== "string" || !policy.selector.trim() || policy.selector.length > 500) errors.push(`${prefix}.selector must be a non-empty string of at most 500 characters`);
    if (!Number.isSafeInteger(policy.minTextChars) || Number(policy.minTextChars) < 1 || Number(policy.minTextChars) > MAX_POLICY_TEXT_CHARS) errors.push(`${prefix}.minTextChars must be an integer from 1 to ${MAX_POLICY_TEXT_CHARS}`);
    if (policy.table !== undefined) {
      if (!policy.table || typeof policy.table !== "object" || Array.isArray(policy.table)) { errors.push(`${prefix}.table must be an object`); return; }
      const table = policy.table as Record<string, unknown>;
      for (const key of Object.keys(table)) if (!(["requiredHeaderCells", "minCompleteDataRows"] as const).includes(key as never)) errors.push(`${prefix}.table.${key} is unsupported`);
      if (!Array.isArray(table.requiredHeaderCells) || table.requiredHeaderCells.length < 1 || table.requiredHeaderCells.length > MAX_POLICY_HEADER_CELLS ||
        table.requiredHeaderCells.some((cell) => typeof cell !== "string" || !collapseWhitespace(cell) || cell.length > 200)) {
        errors.push(`${prefix}.table.requiredHeaderCells must contain 1 to ${MAX_POLICY_HEADER_CELLS} non-empty strings`);
      } else {
        const normalized = table.requiredHeaderCells.map((cell) => collapseWhitespace(cell as string));
        if (new Set(normalized).size !== normalized.length) errors.push(`${prefix}.table.requiredHeaderCells must be unique`);
      }
      if (!Number.isSafeInteger(table.minCompleteDataRows) || Number(table.minCompleteDataRows) < 1 || Number(table.minCompleteDataRows) > MAX_POLICY_ROWS) errors.push(`${prefix}.table.minCompleteDataRows must be an integer from 1 to ${MAX_POLICY_ROWS}`);
    }
  });
  return errors;
}

function policyTableIsComplete(html: string, policy: SelectedBodyPolicy): boolean {
  if (!policy.table) return true;
  const $ = cheerio.load(html, null, false);
  const tables = $("table");
  if (tables.length !== 1 || tables.find("table").length > 0) return false;
  const table = tables.first();
  if (table.is("[rowspan], [colspan]") || table.find("[rowspan], [colspan]").length > 0) return false;
  const rows = table.find("tr").toArray();
  const required = policy.table.requiredHeaderCells.map(collapseWhitespace);
  const headerIndexes = rows.flatMap((row, index) => {
    const cells = $(row).children("th,td").toArray().map((cell) => collapseWhitespace($(cell).text()));
    return cells.length === required.length && cells.every((cell, i) => cell === required[i]) ? [index] : [];
  });
  if (headerIndexes.length !== 1) return false;
  const headerIndex = headerIndexes[0]!;
  let completeRows = 0;
  for (const row of rows.slice(headerIndex + 1)) {
    const cells = $(row).children("th,td").toArray().map((cell) => collapseWhitespace($(cell).text()));
    if (cells.length !== required.length || cells.some((cell) => !cell)) return false;
    completeRows += 1;
  }
  return completeRows >= policy.table.minCompleteDataRows;
}

function hasUnsupportedTableLayout(html: string): boolean {
  const $ = cheerio.load(html, null, false);
  const tables = $("table");
  return tables.length > 1 || tables.is("[rowspan], [colspan]") || tables.find("[rowspan], [colspan]").length > 0;
}

/** Strict opt-in body extraction for a source-verified, unique article container. */
export function extractSelectedBody(
  html: string,
  url: string,
  config: SelectedBodyConfig,
  expected: BodyIdentity,
  options: { pdfAttachmentsPrevalidated?: boolean } = {},
): SelectedBodyResult {
  const policies = config.bodyPolicies;
  const policyMode = policies !== undefined;
  if (policyMode && (config.bodySelector !== undefined || config.allowShortBody !== undefined || validateBodyPolicies(policies).length > 0)) {
    return { body: null, reason: "body_policy_invalid", attachments: [] };
  }
  const selector = config.bodySelector?.trim();
  if (!policyMode && !selector) return { body: null, reason: "selector_missing", attachments: [] };
  const $ = cheerio.load(html, null, false);
  let selected: cheerio.Cheerio<any>;
  let activePolicy: SelectedBodyPolicy | undefined;
  if (policyMode) {
    const matched: Array<{ policy: SelectedBodyPolicy; container: cheerio.Cheerio<any> }> = [];
    try {
      for (const policy of policies!) {
        const matches = $(policy.selector);
        if (matches.length > 1) return { body: null, reason: "selector_not_unique", attachments: pdfLinks($, url) };
        if (matches.length === 1) matched.push({ policy, container: matches.first() });
      }
    } catch {
      return { body: null, reason: "body_policy_invalid", attachments: pdfLinks($, url) };
    }
    if (matched.length === 0) return { body: null, reason: "selector_missing", attachments: pdfLinks($, url) };
    if (matched.length !== 1) return { body: null, reason: "body_policy_ambiguous", attachments: pdfLinks($, url) };
    activePolicy = matched[0]!.policy;
    selected = matched[0]!.container;
  } else {
    let matches: cheerio.Cheerio<any>;
    try { matches = $(selector!); }
    catch { return { body: null, reason: "selector_missing", attachments: [] }; }
    if (matches.length !== 1) return { body: null, reason: "selector_not_unique", attachments: pdfLinks($, url) };
    selected = matches.first();
  }
  if (selected.is(BLOCKED_CONTAINERS) || selected.find(BLOCKED_CONTAINERS).length > 0 || selected.find(STRUCTURED_CONTENT).length === 0) {
    return { body: null, reason: "non_article_container", attachments: pdfLinks($, url) };
  }
  const rawHtml = selected.html() ?? "";
  const textOutsideLinks = collapseWhitespace(selected.clone().find("a").remove().end().text());
  const rawText = collapseWhitespace(selected.text());
  if (!rawText || !textOutsideLinks) return { body: null, reason: "empty_body", attachments: pdfLinks($, url) };

  const attachments = options.pdfAttachmentsPrevalidated ? [] : pdfLinks($, url);
  if (!options.pdfAttachmentsPrevalidated && attachments.length > 0) return { body: null, reason: "attachments_unprocessed", attachments };
  if (activePolicy?.table && hasUnsupportedTableLayout(rawHtml)) return { body: null, reason: "body_policy_table_invalid", attachments };
  const pageIdentity = identityFromHtml($, config.publishedAtUtcOffset ?? "+08:00");
  if (!pageIdentity?.publishedAt || !expected.title.trim() || !expected.publishedAt) {
    return { body: null, reason: "identity_missing", attachments };
  }
  const expectedTitle = collapseWhitespace(expected.title);
  const pageDate = localDateKey(pageIdentity.publishedAt, config.publishedAtUtcOffset ?? "+08:00");
  const expectedDate = localDateKey(expected.publishedAt, config.publishedAtUtcOffset ?? "+08:00");
  if (pageIdentity.title !== expectedTitle || !pageDate || pageDate !== expectedDate) {
    return { body: null, reason: "identity_mismatch", attachments };
  }

  const clean = trimTrailingChrome(sanitizeBody(rawHtml, url));
  const text = textKeepingTableCells(clean);
  if (!text) return { body: null, reason: "empty_body", attachments };
  if (activePolicy?.table && !policyTableIsComplete(clean, activePolicy)) return { body: null, reason: "body_policy_table_invalid", attachments };
  if (activePolicy ? text.length < activePolicy.minTextChars : text.length < 200 && config.allowShortBody !== true) {
    return { body: null, reason: "short_body_not_allowed", attachments };
  }
  return { body: { html: clean, text, images: imagesFromHtml(clean), via: "selector" }, reason: null, attachments };
}

/**
 * Select a single article envelope, its clean-body child and (optionally) its download region.
 * Only anchors inside the configured region count; unrelated page links are never scanned.
 */
export function extractSelectedArticleEnvelope(
  html: string,
  url: string,
  config: SelectedArticleEnvelopeConfig,
  expected: BodyIdentity,
): SelectedArticleEnvelopeResult {
  if (config.bodyPolicies !== undefined) return { body: null, attachment: null, reason: "body_policy_invalid" };
  const $ = cheerio.load(html, null, false);
  let articles: cheerio.Cheerio<any>;
  try { articles = $(config.articleSelector); } catch { return { body: null, attachment: null, reason: "article_missing" }; }
  if (!articles.length) return { body: null, attachment: null, reason: "article_missing" };
  if (articles.length !== 1) return { body: null, attachment: null, reason: "article_not_unique" };
  const article = articles.first();
  let bodies: cheerio.Cheerio<any>;
  let regions: cheerio.Cheerio<any>;
  try {
    bodies = article.find(config.bodySelector ?? "");
    regions = article.find(config.attachmentSelector);
  } catch { return { body: null, attachment: null, reason: "body_missing" }; }
  if (!bodies.length) return { body: null, attachment: null, reason: "body_missing" };
  if (bodies.length !== 1) return { body: null, attachment: null, reason: "body_not_unique" };
  if (regions.length > 1) return { body: null, attachment: null, reason: "attachment_region_not_unique" };

  let attachment: { url: string; title: string } | null = null;
  const selectedAnchors = new Set<object>();
  if (regions.length === 1) {
    const anchors = regions.first().find("a[href]").toArray();
    if (anchors.length > 1) return { body: null, attachment: null, reason: "attachment_ambiguous" };
    if (anchors.length === 1) {
      selectedAnchors.add(anchors[0]!);
      const anchor = $(anchors[0]!);
      const href = anchor.attr("href")?.trim();
      const type = (anchor.attr("type") ?? "").toLowerCase();
      try {
        if (!href) return { body: null, attachment: null, reason: "attachment_url_invalid" };
        const candidate = new URL(href, url);
        if (candidate.protocol !== "https:") return { body: null, attachment: null, reason: "attachment_url_invalid" };
        if (!/\.pdf$/i.test(candidate.pathname) && type !== "application/pdf") return { body: null, attachment: null, reason: "attachment_unsupported" };
        attachment = { url: candidate.toString(), title: collapseWhitespace(anchor.text() || anchor.attr("title") || "") };
      } catch { return { body: null, attachment: null, reason: "attachment_url_invalid" }; }
    }
  }
  const fileLink = /\.(?:pdf|rar|7z|zip|xls?x?|docx?|pptx?)(?:$|[?#])/i;
  for (const node of article.find("a[href]").toArray()) {
    const anchor = $(node);
    const href = anchor.attr("href") ?? "";
    const type = (anchor.attr("type") ?? "").toLowerCase();
    let isFile = type === "application/pdf";
    try { isFile ||= fileLink.test(new URL(href, url).pathname); } catch { /* invalid href is not a trusted download */ }
    if (isFile && !selectedAnchors.has(node)) return { body: null, attachment: null, reason: "attachment_unclassified" };
  }
  if (!attachment && (config.attachmentMode ?? "required") === "required") return { body: null, attachment: null, reason: "attachment_required" };

  // A short notice is only provisional when a PDF is present. It can reach storage only after the
  // companion PDF has passed the complete bounded parser; the zero-attachment branch uses 200 chars.
  const bodyResult = extractSelectedBody(html, url, {
    bodySelector: config.bodySelector,
    allowShortBody: attachment ? true : false,
    publishedAtUtcOffset: config.publishedAtUtcOffset,
  }, expected, { pdfAttachmentsPrevalidated: true });
  if (!bodyResult.body) return { body: null, attachment, reason: bodyResult.reason ?? "empty_body" };
  if (!attachment && bodyResult.body.text.length < 200) return { body: null, attachment: null, reason: "short_body_not_allowed" };
  return { body: bodyResult.body, attachment, reason: null };
}
