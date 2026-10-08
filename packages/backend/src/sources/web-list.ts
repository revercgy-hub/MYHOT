// Web list pages: HTML with selectors, Markdown through Jina Reader, and Docusaurus changelogs.
import * as cheerio from "cheerio";
import { guardedFetch, type GuardedFetchRunBudget } from "../lib/http-fetch.ts";
import { collapseWhitespace, stripTags } from "../lib/text.ts";
import { readable, type ExtractedBody } from "../content/extract.ts";
import { extractConfiguredHtmlBody, extractDirectPdfBody, type PdfFetcher, type PdfSourceBodyConfig } from "../content/pdf-body.ts";
import { attachmentDiagnosticForFailure, type AttachmentDiagnostic } from "../content/attachment-diagnostics.ts";
import { sanitizeBody } from "../content/sanitize.ts";
import { jinaRead } from "../providers/jina.ts";
import { parseLooseDate } from "./date.ts";
import { identityKeyForUrl } from "../lib/url.ts";
import { FetchError, type Candidate, type SourceRow } from "./types.ts";
import { fetchNfraJsonDetail, nfraConfigIsSupported } from "../content/nfra-json-detail.ts";

const JINA_PREFIX = "https://r.jina.ai/";
export { parseLooseDate } from "./date.ts";

/** The datePublished of the page's structured data (JSON-LD, also inside @graph or embedded app state). */
export function jsonLdPublished($: cheerio.CheerioAPI, html: string): string | null {
  const find = (v: unknown, depth = 0): string | null => {
    if (depth > 6 || v === null || typeof v !== "object") return null;
    if (Array.isArray(v)) {
      for (const x of v) {
        const got = find(x, depth + 1);
        if (got) return got;
      }
      return null;
    }
    const o = v as Record<string, unknown>;
    if (typeof o.datePublished === "string" && o.datePublished) return o.datePublished;
    return find(o["@graph"], depth + 1);
  };
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const got = find(JSON.parse($(el).text()));
      if (got) return got;
    } catch {
      // a broken block: the pattern below may still find it
    }
  }
  return /"datePublished"\s*:\s*"([^"]+)"/.exec(html)?.[1] ?? null;
}

/** Prefix rules ignore the scheme: a Jina listing of an http:// address links its posts over http. */
const overHttps = (url: string) => url.replace(/^http:\/\//i, "https://");

export function allowed(url: string, source: SourceRow): boolean {
  const allow: string[] = (source.config.allowUrlPrefixes ?? []).map(overHttps);
  const deny: string[] = (source.config.denyUrlPrefixes ?? []).map(overHttps);
  const target = overHttps(url);
  if (deny.some((p) => target.startsWith(p))) return false;
  return allow.length === 0 || allow.some((p) => target.startsWith(p));
}

/** A link back to the listing page itself (skip links, in-page anchors such as #paper, #blog). */
function listingItself(url: string, listing: string): boolean {
  const bare = (x: URL) => `${x.host}${x.pathname.replace(/\/$/, "")}`;
  return bare(new URL(url)) === bare(new URL(listing));
}

/**
 * Navigation a listing links to but that is no post: the listing itself, year archives, and taxonomy,
 * author and pagination pages.
 */
function navigationLink(url: string, listing: string): boolean {
  if (listingItself(url, listing)) return true;
  const u = new URL(url);
  return /\/(label|labels|tag|tags|category|categories|author|authors|page)(\/|$)/i.test(u.pathname) || /\/(19|20)\d{2}(\/\d{1,2})?\/?$/.test(u.pathname);
}

/** Absolute http(s) URL; a link to the listing's own https site keeps https. */
function absolute(href: string | undefined, base: string): string | null {
  if (!href) return null;
  try {
    const u = new URL(href, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const b = new URL(base);
    if (u.protocol === "http:" && b.protocol === "https:" && u.host === b.host) u.protocol = "https:";
    return u.toString();
  } catch {
    return null;
  }
}

export interface FetchWebListOptions {
  /** The exact page being fetched; also used to resolve relative links and reject page-self links. */
  listUrl?: string;
  /** One shared admission/deadline budget for the request and any manual redirect hops. */
  runBudget?: GuardedFetchRunBudget;
}

async function fetchListingText(source: SourceRow, options: FetchWebListOptions): Promise<{ text: string; viaJina: boolean; base: string; listingUrl: string }> {
  const configuredUrl = String(source.config.url ?? "");
  const url = options.listUrl ?? configuredUrl;
  if (!url) throw new FetchError("url missing");
  const overrideTransport = options.listUrl !== undefined || options.runBudget !== undefined;
  const directHtmlMode = source.config.adapter === undefined && (source.config.parseMode === undefined || source.config.parseMode === "html");
  if (overrideTransport && (configuredUrl.startsWith(JINA_PREFIX) || url.startsWith(JINA_PREFIX) || !directHtmlMode)) {
    throw new FetchError("listUrl/runBudget are supported only for direct HTML listings");
  }
  if (url.startsWith(JINA_PREFIX)) {
    const target = url.slice(JINA_PREFIX.length);
    const page = await jinaRead(target, { purpose: "source_listing", subject: `source:${source.id}`, cacheToleranceSeconds: source.config.cacheToleranceSeconds, perRead: true });
    return { text: page.markdown, viaJina: true, base: source.config.baseUrl ?? target, listingUrl: url };
  }
  const res = await guardedFetch(url, {
    headers: { accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8" },
    timeoutMs: 25_000,
    ...(options.runBudget ? { runBudget: options.runBudget } : {}),
  });
  if (res.status !== 200) throw new FetchError(`HTTP ${res.status}`, res.status);
  return { text: res.text(), viaJina: false, base: options.listUrl === undefined ? source.config.baseUrl ?? url : url, listingUrl: url };
}

export function fromMarkdown(md: string, base: string, source: SourceRow): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  const listing = String(source.config.url ?? base).replace(JINA_PREFIX, "");
  // Card links wrap an image and the text, [![alt](img) ##### Title …](url "Title"): images go first so the
  // link text is plain; a bare image link is then left without a title and skipped, as are nav-length labels.
  const text = md.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  // Listings whose teasers link other articles in their prose (Axios: "capping a [chaotic three weeks](…)")
  // take only links that begin their line, after heading, list, quote or emphasis marks and image links.
  const startsLine = (at: number) =>
    /^[\s>#*+_|-]*(?:\d+[.)]\s*)?[\s*_]*$/.test(text.slice(text.lastIndexOf("\n", at - 1) + 1, at).replace(/\[\]\([^)]*\)/g, ""));
  for (const m of text.matchAll(/\[([^\]]{6,1000})\]\((https?:\/\/[^)\s]+|\/[^)\s]*)(?:\s+"([^"]*)")?\)/g)) {
    const url = absolute(m[2], base);
    if (!url || seen.has(url) || !allowed(url, source) || navigationLink(url, listing)) continue;
    if (source.config.linksStartLine === true && !startsLine(m.index!)) continue;
    const label = collapseWhitespace(m[1]!.replace(/[*_`#]/g, ""));
    // A title attribute the card text already contains is the clean title, without dates and blurbs.
    const attr = collapseWhitespace(m[3] ?? "");
    const title = attr.length >= 6 && label.includes(attr) ? attr : label;
    if (title.length < 6) continue;
    seen.add(url);
    out.push({ url, title });
  }
  return out;
}

export function fromHtml(html: string, base: string, source: SourceRow, listingUrl = String(source.config.url ?? base)): Candidate[] {
  const c = source.config;
  const $ = cheerio.load(html);
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const listing = listingUrl.replace(JINA_PREFIX, "");
  // Sections of the listing page are posts only for sources that keep fragments as identity.
  const sectionsArePosts = c.preserveUrlFragment === true;
  const itemSel: string | undefined = c.itemSelector;
  const nodes = itemSel ? $(itemSel).toArray() : $("a[href]").toArray();
  for (const node of nodes) {
    const el = $(node);
    const linkEl = c.linkSelector ? (el.is(c.linkSelector) ? el : el.find(c.linkSelector).first()) : el.is("a") ? el : el.find("a[href]").first();
    const url = absolute(linkEl.attr("href"), base);
    if (!url || seen.has(url) || !allowed(url, source)) continue;
    if (!sectionsArePosts && listingItself(url, listing)) continue;
    const titleEl = c.titleSelector ? (el.is(c.titleSelector) ? el : el.find(c.titleSelector).first()) : linkEl;
    const configuredTitle = c.titleAttribute ? collapseWhitespace(titleEl.attr(c.titleAttribute) ?? "") : "";
    const title = configuredTitle || collapseWhitespace(titleEl.text() || linkEl.attr("title") || "");
    if (!title) continue;
    let publishedAt: Date | null = null;
    if (c.publishedAtSelector) {
      const dateEl = el.find(c.publishedAtSelector).first();
      publishedAt = parseLooseDate(dateEl.attr("datetime") ?? dateEl.attr("title") ?? dateEl.text(), c.publishedAtUtcOffset);
    }
    if (!publishedAt && c.publishedAtRegex) {
      const m = new RegExp(c.publishedAtRegex).exec($.html(el));
      publishedAt = parseLooseDate(m?.[1], c.publishedAtUtcOffset);
    }
    seen.add(url);
    out.push({ url, title, publishedAt });
  }
  return out;
}

/** A changelog heading that is only a date, bare or after a short label: "时间: 2026-09-10", "时间：2024-05-17". */
const DATE_HEADING = /^(?:[^\d:：]{1,12}[:：])?\s*(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/;

/** The day a date heading names, at midnight in the source's offset (Date.parse would read "时间: …" in the host's zone). */
function headingDate(title: string, utcOffset = "+08:00"): Date | null | undefined {
  const m = DATE_HEADING.exec(title);
  if (!m) return undefined;
  const t = Date.parse(`${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}T00:00:00${utcOffset}`);
  return Number.isFinite(t) ? new Date(t) : null;
}

function fromDocusaurusChangelog(html: string, base: string, source: SourceRow): Candidate[] {
  const $ = cheerio.load(html);
  const out: Candidate[] = [];
  // A date heading is no update itself: it dates the updates under it, up to the next h2.
  let sectionDate: Date | null = null;
  $("article h2[id], article h3[id], .markdown h2[id], .markdown h3[id]").each((_i, h) => {
    const head = $(h);
    const id = head.attr("id")!;
    const title = collapseWhitespace(head.text().replace(/​/g, "").replace(/#$/, ""));
    const date = headingDate(title, source.config.publishedAtUtcOffset);
    if (date !== undefined) {
      sectionDate = date;
      return;
    }
    if (head.is("h2")) sectionDate = null;
    const parts: string[] = [];
    let n = head.next();
    while (n.length && !n.is("h2, h3")) {
      parts.push($.html(n));
      n = n.next();
    }
    const bodyHtml = sanitizeBody(parts.join(""), base);
    const url = `${base.replace(/#.*$/, "")}#${id}`;
    if (!allowed(url.replace(/#.*$/, ""), source)) return;
    out.push({
      url,
      identityKey: `url:${url}`,
      title,
      publishedAt: parseLooseDate(title) ?? sectionDate ?? parseLooseDate(stripTags(bodyHtml).slice(0, 80)),
      bodyHtml,
      bodyText: stripTags(bodyHtml),
      bodyStatus: "ok",
    });
  });
  return out;
}

async function fetchScript(url: string): Promise<string> {
  const res = await guardedFetch(url, { timeoutMs: 25_000 });
  if (res.status !== 200) throw new FetchError(`HTTP ${res.status} for ${url}`, res.status);
  return res.text();
}

/** A double-quoted string literal in minified script. */
const SCRIPT_STRING = String.raw`"(?:[^"\\]|\\.)*"`;
function scriptString(literal: string): string {
  try {
    return JSON.parse(literal.replace(/\\x([0-9a-f]{2})/gi, "\\u00$1").replace(/\\'/g, "'"));
  } catch {
    return literal.slice(1, -1);
  }
}

/**
 * mimo.xiaomi.com (config.adapter "mimo_home"). The homepage's post rows navigate by script: its HTML has
 * their titles but no links, so the generic parse found only the menu (MiMo Desktop, 简体中文, #paper).
 * The rows are a prop of the homepage's own chunk, `sectionTitle:"Blog", … blogs:[{title:"…",
 * link:"/blog/…", desc:"…"}, …]`; the site's route table names the chunks of path "/" and the runtime's
 * chunk map their files, both in the scripts the homepage loads. A homepage that no longer looks like
 * this fails the fetch instead of falling back to the menu.
 */
async function fromMimoHome(html: string, base: string, source: SourceRow): Promise<Candidate[]> {
  let routeChunks: string[] = [];
  let chunkFile: ((id: string) => string | null) | null = null;
  // Entry scripts come last; the libraries loaded before them hold neither table.
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)].map((m) => absolute(m[1], base)).filter((u) => u !== null);
  for (const src of scripts.reverse()) {
    if (routeChunks.length && chunkFile) break;
    const js = await fetchScript(src);
    const route = /\{path:"\/",[^{}]*\}/.exec(js)?.[0];
    if (route) routeChunks = [...route.matchAll(/\.e\("([^"]+)"\)/g)].map((m) => m[1]!);
    const map = /"(static\/js\/async\/)"\+\w+\+"\."\+\(?\{([^}]*)\}\)?\[\w+\]\+"\.js"/.exec(js);
    const publicPath = /\b\w+\.p="([^"]*)"/.exec(js)?.[1];
    if (map && publicPath !== undefined) {
      const names = new Map([...map[2]!.matchAll(/"?(\w+)"?:"(\w+)"/g)].map((m) => [m[1]!, m[2]!]));
      const root = new URL(publicPath, src);
      chunkFile = (id) => (names.has(id) ? new URL(`${map[1]}${id}.${names.get(id)}.js`, root).toString() : null);
    }
  }
  if (!routeChunks.length || !chunkFile) throw new FetchError("mimo_home: no route table or chunk map in the homepage scripts");
  const listing = String(source.config.url ?? base);
  // The page's own chunk is the last one its route loads.
  for (const id of routeChunks.reverse()) {
    const file = chunkFile(id);
    if (!file) continue;
    const js = await fetchScript(file);
    const at = js.indexOf('sectionTitle:"Blog"');
    if (at < 0) continue;
    const next = js.indexOf("sectionTitle:", at + 1);
    const section = js.slice(at, next < 0 ? undefined : next);
    const out: Candidate[] = [];
    for (const [row] of section.matchAll(new RegExp(String.raw`\{(?:[^{}"]|${SCRIPT_STRING})*\}`, "g"))) {
      const field = (name: string) => {
        const m = new RegExp(String.raw`\b${name}:(${SCRIPT_STRING})`).exec(row);
        return m ? collapseWhitespace(scriptString(m[1]!)) : "";
      };
      const url = absolute(field("link"), base);
      const title = field("title");
      if (!url || !title || out.some((c) => c.url === url) || !allowed(url, source) || listingItself(url, listing)) continue;
      const desc = field("desc");
      out.push({ url, title, excerpt: desc && desc !== title ? desc : null });
    }
    return out;
  }
  throw new FetchError("mimo_home: no Blog list in the homepage's chunks");
}

export async function fetchWebList(source: SourceRow, options: FetchWebListOptions = {}): Promise<Candidate[]> {
  const { text, viaJina, base, listingUrl } = await fetchListingText(source, options);
  const mode = source.config.adapter === "mimo_home" ? "mimo_home" : source.config.parseMode ?? (viaJina ? "markdown" : "html");
  let out: Candidate[];
  if (mode === "mimo_home") out = await fromMimoHome(text, base, source);
  else if (mode === "markdown") out = fromMarkdown(text, base, source);
  else if (mode === "docusaurus_changelog") out = fromDocusaurusChangelog(text, base, source);
  else out = fromHtml(text, base, source, listingUrl);
  if (out.length === 0) throw new FetchError(`no items matched (${mode})`);
  return out;
}

export interface DetailNeed {
  date: boolean;
  title: boolean;
  summary: boolean;
  /** Reuse metadata HTML by default; an explicit source-verified bodySelector may request one detail fetch. */
  body?: boolean;
  /** Listing identity used to reject a mismatched explicit body container. */
  expectedTitle?: string;
  expectedPublishedAt?: Date | null;
  expectedExternalId?: number;
  listAttachmentPending?: boolean;
}

export interface WebListMetadataNeed {
  title: boolean;
  date: boolean;
}

export type WebListMetadataField<T> =
  | { status: "not_requested" }
  | { status: "found"; value: T; source: "configured_rule" }
  | { status: "missing"; source: "configured_rule" | "no_configured_rule" };

export interface WebListMetadataResult {
  /** The final URL validated by guardedFetch and the shared run budget. */
  finalUrl: string;
  title: WebListMetadataField<string>;
  /** ISO instant normalized by the configured publication-date rule and source UTC offset. */
  date: WebListMetadataField<string>;
}

export interface WebListMetadataOptions {
  /** Required: the same source-local budget used for listing requests and redirect admissions. */
  runBudget: GuardedFetchRunBudget;
  /** Remaining run deadline; used to clamp this request's timeout. */
  remainingMs(): number;
  /** Rechecks the same run deadline before the request and after parsing. */
  assertActive(): void;
  /** Synthetic transport seam for contract tests; production callers use guardedFetch. */
  testFetcher?: typeof guardedFetch;
}

function metadataTarget(url: string, source: SourceRow): URL {
  let target: URL;
  let listing: URL;
  try {
    target = new URL(url);
    listing = new URL(String(source.config.url ?? ""));
  } catch {
    throw new FetchError("metadata detail URL is invalid");
  }
  const listingPath = listing.pathname.endsWith("/") ? listing.pathname : `${listing.pathname}/`;
  if (target.protocol !== "https:" || listing.protocol !== "https:" || target.username || target.password ||
      listing.username || listing.password || (target.port && target.port !== "443") || target.origin !== listing.origin ||
      target.search || target.hash || !target.pathname.startsWith(listingPath) ||
      target.pathname === listing.pathname || target.pathname === listingPath ||
      /(?:^|\/)index(?:_\d+)?\.htm$/iu.test(target.pathname) ||
      !allowed(target.toString(), source) || !identityKeyForUrl(target.toString())) {
    throw new FetchError("metadata detail URL is outside the configured article directory");
  }
  return target;
}

function requestedRule(need: WebListMetadataNeed, source: SourceRow): boolean {
  const detail = source.config.detail ?? {};
  return (need.title && (typeof detail.titleSelector === "string" || typeof detail.titleRegex === "string")) ||
    (need.date && (typeof detail.publishedAtSelector === "string" || typeof detail.publishedAtRegex === "string"));
}

/**
 * Fetch only configured title/publication-date metadata from a direct HTML article page.
 * This deliberately does not call fetchDetail: its legacy mode can read generic metadata,
 * Jina, summaries, Readability, selected bodies, and attachments.
 */
export async function fetchWebListMetadata(
  url: string,
  source: SourceRow,
  need: WebListMetadataNeed,
  options: WebListMetadataOptions,
): Promise<WebListMetadataResult> {
  if (!need || typeof need !== "object" || Array.isArray(need) ||
      Object.keys(need).some((key) => key !== "title" && key !== "date") ||
      typeof need.title !== "boolean" || typeof need.date !== "boolean") {
    throw new FetchError("metadata detail need must contain only boolean title/date fields");
  }
  if (source.kind !== "web_list" || source.config.pagination?.detailMode !== "direct_html_metadata_v1") {
    throw new FetchError("metadata detail mode requires explicit direct_html_metadata_v1 opt-in");
  }
  if (!options || !options.runBudget || typeof options.runBudget.beforeDispatch !== "function" ||
      typeof options.remainingMs !== "function" || typeof options.assertActive !== "function") {
    throw new FetchError("metadata detail requires a shared run budget and deadline callbacks");
  }

  // Import at call time to avoid a static cycle: pagination uses this module's list parser.
  const { unsupportedConfig } = await import("./config-keys.ts");
  const configErrors = unsupportedConfig(source.kind, source.config);
  if (configErrors.length) throw new FetchError(`unsupported metadata detail config: ${configErrors.join(", ")}`);

  const detail = source.config.detail ?? {};
  const titleRule = typeof detail.titleSelector === "string" || typeof detail.titleRegex === "string";
  const dateRule = typeof detail.publishedAtSelector === "string" || typeof detail.publishedAtRegex === "string";
  if (!requestedRule(need, source)) {
    throw new FetchError("metadata detail need has no configured title/date rule");
  }
  for (const selector of [detail.titleSelector, detail.publishedAtSelector]) {
    if (typeof selector !== "string") continue;
    try { cheerio.load("")(selector); }
    catch { throw new FetchError("metadata detail config contains an invalid selector"); }
  }
  const target = metadataTarget(url, source);
  options.assertActive();
  const remaining = options.remainingMs();
  const timeoutMs = Math.floor(remaining);
  if (!Number.isFinite(remaining) || timeoutMs < 1) {
    options.assertActive();
    throw new FetchError("metadata detail run deadline exhausted");
  }
  const fetcher = options.testFetcher ?? guardedFetch;
  const response = await fetcher(target.toString(), {
    method: "GET",
    timeoutMs: Math.min(20_000, timeoutMs),
    maxBytes: 6 * 1024 * 1024,
    maxRedirects: 5,
    route: "direct",
    runBudget: options.runBudget,
    headers: { accept: "text/html,application/xhtml+xml" },
  });
  options.assertActive();
  if (response.status !== 200) throw new FetchError(`metadata detail HTTP ${response.status}`, response.status);
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^\s*text\/html(?:\s*;|\s*$)/iu.test(contentType)) {
    throw new FetchError("metadata detail response is not text/html");
  }

  const finalUrl = metadataTarget(response.url, source);
  if (identityKeyForUrl(finalUrl.toString()) !== identityKeyForUrl(target.toString())) {
    throw new FetchError("metadata detail redirect changed article identity");
  }
  const html = response.text();
  const $ = cheerio.load(html);
  const title: WebListMetadataField<string> = !need.title
    ? { status: "not_requested" }
    : !titleRule
      ? { status: "missing", source: "no_configured_rule" }
      : (() => {
        let value = "";
        if (detail.titleRegex) value = new RegExp(detail.titleRegex, "m").exec(html)?.[1] ?? "";
        else if (detail.titleSelector) value = $(detail.titleSelector).first().text();
        const normalized = collapseWhitespace(value);
        return normalized ? { status: "found", value: normalized, source: "configured_rule" } as const
          : { status: "missing", source: "configured_rule" } as const;
      })();
  const date: WebListMetadataField<string> = !need.date
    ? { status: "not_requested" }
    : !dateRule
      ? { status: "missing", source: "no_configured_rule" }
      : (() => {
        let parsed: Date | null = null;
        if (detail.publishedAtSelector) {
          const element = $(detail.publishedAtSelector).first();
          parsed = parseLooseDate(element.attr("datetime") ?? element.attr("title") ?? element.text(),
            detail.publishedAtUtcOffset ?? source.config.publishedAtUtcOffset);
        }
        if (!parsed && detail.publishedAtRegex) {
          parsed = parseLooseDate(new RegExp(detail.publishedAtRegex).exec(html)?.[1],
            detail.publishedAtUtcOffset ?? source.config.publishedAtUtcOffset);
        }
        return parsed ? { status: "found", value: parsed.toISOString(), source: "configured_rule" } as const
          : { status: "missing", source: "configured_rule" } as const;
      })();
  options.assertActive();
  return { finalUrl: finalUrl.toString(), title, date };
}

/**
 * What a listing's detail pages add (config.detail): the date, title and summary its rules find. Each
 * rule reads the rendering it was written for. For a listing read through Jina, regexes match Jina's
 * text ("Published Time: …", "# Heading"), so that paid rendering is bought only when such a rule is
 * needed; selectors and page metadata read the page's own HTML.
 */
export async function fetchDetail(url: string, source: SourceRow, need: DetailNeed, options: { fetcher?: PdfFetcher; runBudget?: GuardedFetchRunBudget; remainingMs?: () => number } = {}): Promise<{ publishedAt: Date | null; title: string | null; summary: string | null; body: ExtractedBody | null; attachmentDiagnostic?: AttachmentDiagnostic }> {
  const d = source.config.detail ?? {};
  if (d.mode === "nfra_json_v1") {
    if (!nfraConfigIsSupported(source) || !need.body || !Number.isSafeInteger(need.expectedExternalId) || !need.expectedTitle || !need.expectedPublishedAt) {
      throw new FetchError("NFRA detail requires expected listing identity and body need");
    }
    const result = await fetchNfraJsonDetail(url, source, {
      docId: need.expectedExternalId!, title: need.expectedTitle, publishedAt: need.expectedPublishedAt,
      listAttachmentPending: need.listAttachmentPending === true,
    }, { fetcher: options.fetcher as never, runBudget: options.runBudget, remainingMs: options.remainingMs });
    return { publishedAt: null, title: null, summary: null, body: result.body, ...(result.attachmentDiagnostic ? { attachmentDiagnostic: result.attachmentDiagnostic } : {}) };
  }
  const fetcher = options.fetcher ?? guardedFetch;
  const pdfConfigured = d.pdfDirect === true || typeof d.attachmentSelector === "string";
  const jinaListing = String(source.config.url ?? "").startsWith(JINA_PREFIX);
  const dateInJina = !pdfConfigured && need.date && jinaListing && !!d.publishedAtRegex;
  const titleInJina = !pdfConfigured && need.title && jinaListing && !!d.titleRegex;
  const jina = dateInJina || titleInJina ? (await jinaRead(url, { purpose: "source_detail", subject: `source:${source.id}` })).raw : null;
  let html: string | null = null;
  let body: ExtractedBody | null = null;
  let attachmentDiagnostic: AttachmentDiagnostic | null = null;
  if (need.body && d.pdfDirect === true) {
    const result = await extractDirectPdfBody(url, need.expectedTitle ?? "", source.config.allowUrlPrefixes ?? [], fetcher);
    body = result.body;
    if (!body && result.reason) attachmentDiagnostic = attachmentDiagnosticForFailure(d, {
      articleUrl: url, reason: result.reason, attachments: result.attachments ?? [],
    });
    if (!body && result.reason) console.warn(JSON.stringify({ level: "warn", msg: "source body selector declined", source: source.id, reason: result.reason }));
  }
  const hasSelectedBodyConfig = !!d.bodySelector || !!d.attachmentSelector || Array.isArray(d.bodyPolicies) || d.attachmentScopeSelector !== undefined;
  if (!d.pdfDirect && ((need.date && !dateInJina) || (need.title && !titleInJina) || need.summary || (need.body && hasSelectedBodyConfig))) {
    const res = await fetcher(url, { timeoutMs: 20_000, ...(need.body && hasSelectedBodyConfig ? { maxBytes: 6 * 1024 * 1024 } : {}) });
    if (res.status === 200) {
      html = res.text();
      if (need.body && /html/i.test(res.headers.get("content-type") ?? "")) {
        try {
          if (hasSelectedBodyConfig) {
            const bodyConfig: PdfSourceBodyConfig = {
              bodySelector: d.bodySelector,
              ...(!d.bodyPolicies ? { allowShortBody: d.allowShortBody === true } : {}),
              bodyPolicies: d.bodyPolicies,
              attachmentScopeSelector: d.attachmentScopeSelector,
              publishedAtUtcOffset: d.publishedAtUtcOffset ?? source.config.publishedAtUtcOffset,
              ...(Object.hasOwn(d, "titleRegex") ? { titleRegex: d.titleRegex } : {}),
              ...(Object.hasOwn(d, "publishedAtRegex") ? { publishedAtRegex: d.publishedAtRegex } : {}),
              articleSelector: d.articleSelector,
              attachmentSelector: d.attachmentSelector,
              attachmentMode: d.attachmentMode,
            };
            const selected = await extractConfiguredHtmlBody(html, res.url, bodyConfig,
              { title: need.expectedTitle ?? "", publishedAt: need.expectedPublishedAt ?? null }, source.config.allowUrlPrefixes ?? [], fetcher);
            body = selected.body;
            if (!body && selected.reason) attachmentDiagnostic = attachmentDiagnosticForFailure(d, {
              articleUrl: url, reason: selected.reason, attachments: selected.attachments ?? [],
            });
            if (!body && selected.reason) console.warn(JSON.stringify({ level: "warn", msg: "source body selector declined", source: source.id, reason: selected.reason }));
          } else body = readable(html, res.url);
        }
        catch {
          if (hasSelectedBodyConfig) console.warn(JSON.stringify({ level: "warn", msg: "source body selector declined", source: source.id, reason: "body_extraction_failed" }));
          /* A failed extraction must not discard the detail metadata. */
        }
      } else if (need.body && hasSelectedBodyConfig) {
        console.warn(JSON.stringify({ level: "warn", msg: "source body selector declined", source: source.id, reason: "article_not_html" }));
      }
    } else if (need.body && hasSelectedBodyConfig) {
      console.warn(JSON.stringify({ level: "warn", msg: "source body selector declined", source: source.id, reason: "article_http_status" }));
    }
  }
  const $ = html === null ? null : cheerio.load(html);

  let publishedAt: Date | null = null;
  const dateText = dateInJina ? jina : html;
  if (need.date && dateText !== null) {
    if ($ && !dateInJina && d.publishedAtSelector) {
      const el = $(d.publishedAtSelector).first();
      publishedAt = parseLooseDate(el.attr("datetime") ?? el.attr("title") ?? el.text(), d.publishedAtUtcOffset);
    }
    if (!publishedAt && d.publishedAtRegex) publishedAt = parseLooseDate(new RegExp(d.publishedAtRegex).exec(dateText)?.[1], d.publishedAtUtcOffset);
    // An authoritative rule is the only source of the date: when its byline is missing, no other
    // timestamp on the page (an update time, a related post) stands in for it.
    const authoritative = d.publishedAtAuthoritative === true && !!(d.publishedAtSelector || d.publishedAtRegex);
    if (!publishedAt && $ && !dateInJina && !authoritative) {
      const meta = $('meta[property="article:published_time"], meta[name="pubdate"], meta[itemprop="datePublished"]').attr("content");
      publishedAt = parseLooseDate(meta) ?? parseLooseDate(jsonLdPublished($, html!)) ?? parseLooseDate($("time[datetime]").first().attr("datetime"));
    }
  }

  let title: string | null = null;
  if (need.title) {
    const titleText = titleInJina ? jina : html;
    if (d.titleRegex && titleText !== null) title = collapseWhitespace(new RegExp(d.titleRegex, "m").exec(titleText)?.[1] ?? "") || null;
    else if (d.titleSelector && $) title = collapseWhitespace($(d.titleSelector).first().text()) || null;
  }

  let summary: string | null = null;
  if (need.summary && $) {
    const el = $(d.summarySelector).first();
    summary = collapseWhitespace(el.attr("content") ?? el.text()) || null;
  }
  return { publishedAt, title, summary, body, ...(attachmentDiagnostic ? { attachmentDiagnostic } : {}) };
}
