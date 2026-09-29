import * as cheerio from "cheerio";
import { collapseWhitespace, escapeHtml, stripTags } from "../lib/text.ts";
import { parseLooseDate } from "../sources/date.ts";
import { sanitizeBody, trimTrailingChrome } from "./sanitize.ts";
import type { ExtractedBody } from "./extract.ts";

export interface SelectedBodyConfig {
  bodySelector?: string;
  allowShortBody?: boolean;
  publishedAtUtcOffset?: string;
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
  reason: "selector_missing" | "selector_not_unique" | "non_article_container" | "empty_body" | "short_body_not_allowed" | "identity_missing" | "identity_mismatch" | "attachments_unprocessed" | null;
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

/** Strict opt-in body extraction for a source-verified, unique article container. */
export function extractSelectedBody(
  html: string,
  url: string,
  config: SelectedBodyConfig,
  expected: BodyIdentity,
  options: { pdfAttachmentsPrevalidated?: boolean } = {},
): SelectedBodyResult {
  const selector = config.bodySelector?.trim();
  if (!selector) return { body: null, reason: "selector_missing", attachments: [] };
  const $ = cheerio.load(html, null, false);
  let matches: cheerio.Cheerio<any>;
  try {
    matches = $(selector);
  } catch {
    return { body: null, reason: "selector_missing", attachments: [] };
  }
  if (matches.length !== 1) return { body: null, reason: "selector_not_unique", attachments: pdfLinks($, url) };
  const selected = matches.first();
  if (selected.is(BLOCKED_CONTAINERS) || selected.find(BLOCKED_CONTAINERS).length > 0 || selected.find(STRUCTURED_CONTENT).length === 0) {
    return { body: null, reason: "non_article_container", attachments: pdfLinks($, url) };
  }
  const rawHtml = selected.html() ?? "";
  const textOutsideLinks = collapseWhitespace(selected.clone().find("a").remove().end().text());
  const rawText = collapseWhitespace(selected.text());
  if (!rawText || !textOutsideLinks) return { body: null, reason: "empty_body", attachments: pdfLinks($, url) };

  const attachments = options.pdfAttachmentsPrevalidated ? [] : pdfLinks($, url);
  if (!options.pdfAttachmentsPrevalidated && attachments.length > 0) return { body: null, reason: "attachments_unprocessed", attachments };
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
  if (text.length < 200 && config.allowShortBody !== true) {
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
