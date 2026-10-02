import { escapeHtml } from "../lib/text.ts";
import { guardedFetch, type GuardedFetchOptions, type GuardedResponse } from "../lib/http-fetch.ts";
import { parsePdfText, type PdfTextResult } from "./pdf-text.ts";
import { extractSelectedArticleEnvelope, extractSelectedBody, type BodyIdentity, type SelectedArticleEnvelopeConfig, type SelectedBodyConfig } from "./selected-body.ts";
import { sanitizeBody } from "./sanitize.ts";
import type { ExtractedBody } from "./extract.ts";

export type PdfFetchFailure = "pdf_url_rejected" | "pdf_fetch_failed" | "pdf_http_status" | "pdf_redirected" | "pdf_mime_rejected" | "invalid_pdf" | "pdf_too_large" | Extract<PdfTextResult, { ok: false }>["reason"];
export type FetchedPdf = { ok: true; url: string; bytes: Buffer; parsed: Extract<PdfTextResult, { ok: true }> } | { ok: false; reason: PdfFetchFailure };
export type PdfFetcher = (url: string, options: GuardedFetchOptions) => Promise<GuardedResponse>;

const MAX_PDF_BYTES = 6 * 1024 * 1024;
const MAX_LAYOUT_CHARS = 120_000;

export interface PdfSourceBodyConfig extends SelectedBodyConfig {
  articleSelector?: string;
  attachmentSelector?: string;
  attachmentMode?: "required" | "optional";
  pdfDirect?: boolean;
}

export type ConfiguredBodyResult = PdfBodyResult;

/** Match configured HTTPS URL prefixes by origin and path, never by a raw hostname substring. */
export function urlMatchesAllowedPrefixes(value: string, prefixes: string[]): boolean {
  let target: URL;
  try {
    target = new URL(value);
    if (target.protocol !== "https:" || target.username || target.password) return false;
  } catch {
    return false;
  }
  return prefixes.some((prefix) => {
    try {
      const allowed = new URL(prefix);
      if (allowed.protocol !== "https:" || allowed.username || allowed.password || allowed.search || allowed.hash) return false;
      if (target.origin !== allowed.origin) return false;
      const path = allowed.pathname;
      return target.pathname === path || target.pathname.startsWith(path.endsWith("/") ? path : `${path}/`);
    } catch {
      return false;
    }
  });
}

function parserFailure(reason: string): PdfFetchFailure {
  const allowed: PdfFetchFailure[] = ["pdf_too_large", "invalid_pdf", "pdf_page_limit", "pdf_text_limit", "pdf_no_text", "pdf_page_no_text", "pdf_output_limit", "pdf_encrypted", "pdf_parse_failed", "pdf_timeout", "pdf_worker_failed"];
  return allowed.includes(reason as PdfFetchFailure) ? reason as PdfFetchFailure : "pdf_parse_failed";
}

/** Fetch and parse one explicitly selected official PDF. The injected fetcher exists for offline tests. */
export async function fetchAndParseOfficialPdf(url: string, allowUrlPrefixes: string[], fetcher: PdfFetcher = guardedFetch): Promise<FetchedPdf> {
  if (!urlMatchesAllowedPrefixes(url, allowUrlPrefixes)) return { ok: false, reason: "pdf_url_rejected" };
  let response: GuardedResponse;
  try {
    response = await fetcher(url, {
      timeoutMs: 20_000,
      maxBytes: MAX_PDF_BYTES,
      maxRedirects: 0,
      headers: { accept: "application/pdf" },
    });
  } catch {
    return { ok: false, reason: "pdf_fetch_failed" };
  }
  if (response.status >= 300 && response.status < 400) return { ok: false, reason: "pdf_redirected" };
  if (response.status !== 200) return { ok: false, reason: "pdf_http_status" };
  if (!urlMatchesAllowedPrefixes(response.url, allowUrlPrefixes)) return { ok: false, reason: "pdf_url_rejected" };
  try {
    if (new URL(response.url).href !== new URL(url).href) return { ok: false, reason: "pdf_redirected" };
  } catch {
    return { ok: false, reason: "pdf_url_rejected" };
  }
  if (!/^application\/pdf(?:\s*;|\s*$)/i.test(response.headers.get("content-type") ?? "")) return { ok: false, reason: "pdf_mime_rejected" };
  if (response.body.byteLength > MAX_PDF_BYTES) return { ok: false, reason: "pdf_too_large" };
  if (response.body.byteLength < 5 || response.body.subarray(0, 5).toString("ascii") !== "%PDF-") return { ok: false, reason: "invalid_pdf" };
  const parsed = await parsePdfText(response.body);
  if (!parsed.ok) return { ok: false, reason: parserFailure(parsed.reason) };
  return { ok: true, url: response.url, bytes: response.body, parsed };
}

function renderLayout(layout: Extract<PdfTextResult, { ok: true }>["layout"]): string | null {
  const lines: string[] = [];
  let size = 0;
  for (const page of layout) {
    if (!Number.isInteger(page.page) || page.page < 1 || !Array.isArray(page.lines) || page.lines.length === 0) return null;
    for (const line of page.lines) {
      if (!Number.isFinite(line.y)) return null;
      const spans = line.spans.map((span) => {
        if (!Number.isFinite(span.x) || typeof span.text !== "string") return null;
        return `[x=${Number(span.x.toFixed(2))}] ${span.text}`;
      });
      if (spans.some((span) => span === null)) return null;
      lines.push(`[page=${page.page} y=${Number(line.y.toFixed(2))}] ${spans.join("  ")}`);
      size += lines[lines.length - 1]!.length + 1;
      if (size > MAX_LAYOUT_CHARS) return null;
    }
  }
  return lines.length ? lines.join("\n") : null;
}

/** Compose distinct source segments; PDF layout stays explicit rather than pretending to rebuild HTML tables. */
export function composeHtmlAndPdfBody(notice: ExtractedBody, pdf: Extract<FetchedPdf, { ok: true }>, attachmentTitle: string): ExtractedBody | null {
  return composePdfSegments(notice, pdf, attachmentTitle);
}

function composePdfSegments(notice: ExtractedBody | null, pdf: Extract<FetchedPdf, { ok: true }>, title: string): ExtractedBody | null {
  const layout = renderLayout(pdf.parsed.layout);
  if (!layout || !title.trim() || !hasCompletePdfLayout(pdf.parsed)) return null;
  const safeTitle = title.trim();
  const safeUrl = pdf.url;
  const html = sanitizeBody(
    `${notice ? `<h3>HTML 通知正文</h3>${notice.html}` : ""}<h3>PDF 原文：${escapeHtml(safeTitle)}</h3>` +
    `<p><a href="${escapeHtml(safeUrl)}" title="${escapeHtml(safeTitle)}">查看官方 PDF 原文</a></p><pre>${escapeHtml(layout)}</pre>`,
    safeUrl,
  );
  const text = `${notice ? `【HTML 通知正文】\n${notice.text}\n\n` : ""}【PDF 原文：${safeTitle}】\n官方原文：${safeUrl}\n${layout}`;
  if (!html || !text.trim() || text.length > MAX_LAYOUT_CHARS + (notice?.text.length ?? 0) + 2048) return null;
  return { html, text, images: notice?.images ?? [], via: "selector" };
}

export interface PdfBodyResult { body: ExtractedBody | null; reason: string | null }

/** Shared strict HTML-envelope path for detail prefetch and the article-body job. */
export async function extractHtmlEnvelopeWithPdf(
  html: string,
  url: string,
  config: PdfSourceBodyConfig,
  expected: BodyIdentity,
  allowUrlPrefixes: string[],
  fetcher: PdfFetcher = guardedFetch,
): Promise<PdfBodyResult> {
  if (!urlMatchesAllowedPrefixes(url, allowUrlPrefixes)) return { body: null, reason: "article_url_rejected" };
  if (!config.articleSelector || !config.attachmentSelector || !config.bodySelector) return { body: null, reason: "attachment_config_invalid" };
  const envelopeConfig: SelectedArticleEnvelopeConfig = {
    articleSelector: config.articleSelector,
    bodySelector: config.bodySelector,
    attachmentSelector: config.attachmentSelector,
    attachmentMode: config.attachmentMode,
    allowShortBody: config.allowShortBody,
    publishedAtUtcOffset: config.publishedAtUtcOffset,
  };
  const selected = extractSelectedArticleEnvelope(html, url, envelopeConfig, expected);
  if (!selected.body) return { body: null, reason: selected.reason ?? "body_unconfirmed" };
  if (!selected.attachment) {
    if (config.attachmentMode !== "optional") return { body: null, reason: "attachment_required" };
    // extractSelectedArticleEnvelope enforces the existing 200-character threshold in this branch;
    // allowShortBody is intentionally not carried into the no-attachment case.
    return { body: selected.body, reason: null };
  }
  const pdf = await fetchAndParseOfficialPdf(selected.attachment.url, allowUrlPrefixes, fetcher);
  if (!pdf.ok) return { body: null, reason: pdf.reason };
  const body = composeHtmlAndPdfBody(selected.body, pdf, selected.attachment.title);
  return body ? { body, reason: null } : { body: null, reason: "pdf_layout_invalid" };
}

/** Shared entry for an already fetched detail HTML response. Unconfigured sources retain selector semantics. */
export async function extractConfiguredHtmlBody(
  html: string,
  url: string,
  config: PdfSourceBodyConfig | SelectedBodyConfig,
  expected: BodyIdentity,
  allowUrlPrefixes: string[],
  fetcher: PdfFetcher = guardedFetch,
): Promise<PdfBodyResult> {
  if ("bodyPolicies" in config && config.bodyPolicies !== undefined &&
    (config.bodySelector !== undefined || config.allowShortBody !== undefined ||
      ("articleSelector" in config && config.articleSelector !== undefined) ||
      ("attachmentSelector" in config && config.attachmentSelector !== undefined) ||
      ("attachmentMode" in config && config.attachmentMode !== undefined) ||
      ("pdfDirect" in config && config.pdfDirect !== undefined))) {
    return { body: null, reason: "body_policy_invalid" };
  }
  if ("attachmentSelector" in config && typeof config.attachmentSelector === "string") {
    return extractHtmlEnvelopeWithPdf(html, url, config as PdfSourceBodyConfig, expected, allowUrlPrefixes, fetcher);
  }
  const result = extractSelectedBody(html, url, config, expected);
  return { body: result.body, reason: result.reason };
}

/** Shared direct-PDF opt-in path; never used unless detail.pdfDirect is explicitly true. */
export async function extractDirectPdfBody(
  url: string,
  title: string,
  allowUrlPrefixes: string[],
  fetcher: PdfFetcher = guardedFetch,
): Promise<PdfBodyResult> {
  const pdf = await fetchAndParseOfficialPdf(url, allowUrlPrefixes, fetcher);
  if (!pdf.ok) return { body: null, reason: pdf.reason };
  const body = composePdfSegments(null, pdf, title);
  return body ? { body, reason: null } : { body: null, reason: "pdf_layout_invalid" };
}

/** Validate one parser result before it can be persisted as a complete body. */
export function hasCompletePdfLayout(parsed: Extract<PdfTextResult, { ok: true }>): boolean {
  return Number.isInteger(parsed.pageCount) && parsed.pageCount >= 1 && parsed.pageCount <= 40 &&
    parsed.layout.length === parsed.pageCount && parsed.layout.every((page, index) => page.page === index + 1) && !!renderLayout(parsed.layout);
}
