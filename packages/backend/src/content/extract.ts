// Article body extraction: readable text from the article page, or "unconfirmed" — never a wrong body.
// Jina Reader is the budgeted fallback for pages that only render in a browser.
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { sql } from "../db.ts";
import { guardedFetch } from "../lib/http-fetch.ts";
import { collapseWhitespace, stripTags } from "../lib/text.ts";
import { jinaRead } from "../providers/jina.ts";
import { BudgetExceededError } from "../providers/receipts.ts";
import { getArticle } from "../providers/socialdata.ts";
import { onlyXArticleLink, xArticleText } from "../sources/x.ts";
import { sanitizeBody, trimTrailingChrome } from "./sanitize.ts";
import type { BodyIdentity } from "./selected-body.ts";
import { extractConfiguredHtmlBody, extractDirectPdfBody, type PdfFetcher, type PdfSourceBodyConfig } from "./pdf-body.ts";
import { contentHash } from "./materials.ts";

export interface ExtractedBody {
  html: string;
  text: string;
  images: Array<{ kind: "image"; url: string; width: number | null; height: number | null }>;
  via: "readability" | "jina" | "selector";
}

const MIN_BODY_CHARS = 200;

export function readable(html: string, url: string): ExtractedBody | null {
  const { document } = parseHTML(html);
  try {
    const base = document.createElement("base");
    base.setAttribute("href", url);
    document.head?.appendChild(base);
  } catch {
    // no head
  }
  const article = new Readability(document as unknown as ConstructorParameters<typeof Readability>[0], { charThreshold: MIN_BODY_CHARS, keepClasses: false }).parse();
  if (!article?.content) return null;
  const clean = trimTrailingChrome(sanitizeBody(article.content, url));
  const text = stripTags(clean);
  if (text.length < MIN_BODY_CHARS) return null;
  const images: ExtractedBody["images"] = [];
  for (const m of clean.matchAll(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/gi)) {
    const w = /\bwidth="(\d+)"/.exec(m[0]);
    const h = /\bheight="(\d+)"/.exec(m[0]);
    images.push({ kind: "image", url: m[1]!.replace(/&amp;/g, "&"), width: w ? Number(w[1]) : null, height: h ? Number(h[1]) : null });
    if (images.length >= 12) break;
  }
  return { html: clean, text, images, via: "readability" };
}

function markdownToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    esc(s)
      .replace(/!\[([^\]]*)\]\((https?:[^)\s]+)\)/g, '<img src="$2" alt="$1">')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  const blocks = md.split(/\n{2,}/);
  return blocks
    .map((b) => {
      const t = b.trim();
      if (!t) return "";
      if (/^```/.test(t)) return `<pre><code>${esc(t.replace(/^```\w*\n?|```$/g, ""))}</code></pre>`;
      const h = /^(#{1,4})\s+(.+)$/.exec(t);
      if (h) return `<h${Math.min(h[1]!.length + 1, 4)}>${inline(h[2]!)}</h${Math.min(h[1]!.length + 1, 4)}>`;
      if (/^[-*]\s/.test(t)) return `<ul>${t.split("\n").map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
      if (/^>\s?/.test(t)) return `<blockquote><p>${inline(t.replace(/^>\s?/gm, ""))}</p></blockquote>`;
      return `<p>${inline(t).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

export async function extractFromUrl(url: string, opts: { allowJina: boolean; subject: string; selectedBody?: { config: PdfSourceBodyConfig; expected: BodyIdentity; allowUrlPrefixes: string[] }; onSelectedBodyFailure?: (reason: string) => void; fetcher?: PdfFetcher }): Promise<ExtractedBody | null> {
  const fetcher = opts.fetcher ?? guardedFetch;
  if (opts.selectedBody?.config.pdfDirect === true) {
    const result = await extractDirectPdfBody(url, opts.selectedBody.expected.title, opts.selectedBody.allowUrlPrefixes, fetcher);
    if (!result.body) opts.onSelectedBodyFailure?.(result.reason ?? "pdf_body_unconfirmed");
    return result.body;
  }
  try {
    const res = await fetcher(url, { timeoutMs: 20_000, maxBytes: 6 * 1024 * 1024 });
    const type = res.headers.get("content-type") ?? "";
    if (res.status === 200 && /html/.test(type)) {
      if (opts.selectedBody) {
        // One configured body driver is shared with detail prefetch. A failed attachment never
        // downgrades to the HTML notice and never falls through to Readability or Jina.
        const result = await extractConfiguredHtmlBody(res.text(), res.url, opts.selectedBody.config, opts.selectedBody.expected,
          opts.selectedBody.allowUrlPrefixes, fetcher);
        if (!result.body && result.reason) opts.onSelectedBodyFailure?.(result.reason);
        return result.body;
      }
      const got = readable(res.text(), res.url);
      if (got) return got;
    }
    if (opts.selectedBody) {
      opts.onSelectedBodyFailure?.(res.status === 200 ? "article_not_html" : "article_http_status");
      return null;
    }
  } catch {
    if (opts.selectedBody) {
      opts.onSelectedBodyFailure?.("article_fetch_failed");
      return null;
    }
    // fall through to Jina
  }
  if (opts.selectedBody || !opts.allowJina) return null;
  try {
    const page = await jinaRead(url, { purpose: "body_fallback", subject: opts.subject });
    const html = trimTrailingChrome(sanitizeBody(markdownToHtml(page.markdown), url));
    const text = stripTags(html);
    if (text.length < MIN_BODY_CHARS) return null;
    return { html, text, images: [], via: "jina" };
  } catch (error) {
    if (error instanceof BudgetExceededError) return null;
    throw error;
  }
}

/** Pages extraction can fetch: ordinary web pages (X posts and WeChat articles arrive whole or not at all). */
export function pageFetchable(url: string, sourceKind: string): boolean {
  if (sourceKind === "x_search" || sourceKind === "mp_account") return false;
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) && !/(^|\.)(x\.com|twitter\.com|mp\.weixin\.qq\.com)$/i.test(u.hostname);
  } catch {
    return false;
  }
}

/** Fetches and stores the body of one article. Unconfirmed bodies are recorded as such. */
export async function extractArticleBody(articleId: string, allowJina = process.env.JINA_BODY_FALLBACK !== "false"): Promise<"ok" | "unconfirmed" | "skipped"> {
  const [a] = await sql<{ id: string; source_id: string; url: string; title: string; published_at: Date | null; body_status: string; revision: number; x_post: { tweetId?: string } | null; source_config: Record<string, any> }[]>`
    SELECT a.id, a.source_id, a.url, a.title, a.published_at, a.body_status, a.revision, a.x_post, s.config AS source_config
    FROM articles a JOIN sources s ON s.id = a.source_id WHERE a.id = ${articleId}`;
  if (!a || a.body_status === "ok") return "skipped";
  if (a.x_post?.tweetId) return extractXArticle(a.id, a.x_post.tweetId);
  const detail = a.source_config.detail ?? {};
  const bodySelector = typeof detail.bodySelector === "string" ? detail.bodySelector : undefined;
  const bodyPolicies = Array.isArray(detail.bodyPolicies) ? detail.bodyPolicies : undefined;
  const pdfBodyConfigured = detail.pdfDirect === true || typeof detail.attachmentSelector === "string";
  const selectedBody = bodySelector || bodyPolicies || pdfBodyConfigured
    ? { config: {
        bodySelector,
        ...(!bodyPolicies ? { allowShortBody: detail.allowShortBody === true } : {}),
        bodyPolicies,
        publishedAtUtcOffset: detail.publishedAtUtcOffset ?? a.source_config.publishedAtUtcOffset,
        articleSelector: detail.articleSelector,
        attachmentSelector: detail.attachmentSelector,
        attachmentMode: detail.attachmentMode,
        ...(!bodyPolicies ? { pdfDirect: detail.pdfDirect === true } : {}),
      }, expected: { title: a.title, publishedAt: a.published_at }, allowUrlPrefixes: a.source_config.allowUrlPrefixes ?? [] }
    : undefined;
  let selectedFailure: string | null = null;
  const got = await extractFromUrl(a.url, {
    allowJina: selectedBody ? false : allowJina,
    subject: `article:${a.id}`,
    ...(selectedBody ? { selectedBody, onSelectedBodyFailure: (reason: string) => { selectedFailure = reason; } } : {}),
  });
  if (selectedFailure) console.warn(JSON.stringify({ level: "warn", msg: "source body selector declined", article: a.id, source: a.source_id, reason: selectedFailure }));
  if (!got) {
    await sql`UPDATE articles SET body_status = 'unconfirmed', updated_at = now() WHERE id = ${articleId} AND body_status <> 'ok'`;
    return "unconfirmed";
  }
  // The body is new content: a new revision, so an analysis of the body-less input counts as stale.
  await sql.begin(async (tx) => {
    const [row] = await tx<{ title: string; excerpt: string | null }[]>`SELECT title, excerpt FROM articles WHERE id = ${articleId} FOR UPDATE`;
    if (!row) return;
    const hash = contentHash({ title: row.title, bodyText: got.text, excerpt: row.excerpt });
    const [r] = await tx<{ revision: number }[]>`
      UPDATE articles SET body_html = ${got.html}, body_text = ${got.text}, body_status = 'ok',
        media = CASE WHEN jsonb_array_length(media) = 0 THEN ${tx.json(got.images as never)}::jsonb ELSE media END,
        revision = revision + 1, content_hash = ${hash}, processing_state = 'new', updated_at = now()
      WHERE id = ${articleId} RETURNING revision`;
    await tx`INSERT INTO article_revisions (article_id, revision, content_hash, title, body_text)
             VALUES (${articleId}, ${r!.revision}, ${hash}, ${row.title}, ${got.text})`;
  });
  return "ok";
}

/**
 * The X Article a post published (SocialData, paid, by the post's own id). The article joins the
 * post's body as a new revision; a post that is only the article's link takes the article's title.
 * No article (the link points at someone else's, or X has none) leaves the post "unconfirmed", and
 * the judging steps are told the article was not fetched.
 */
async function extractXArticle(articleId: string, tweetId: string): Promise<"ok" | "unconfirmed"> {
  const found = await getArticle(tweetId, { purpose: "x_article", subject: `article:${articleId}` });
  const got = found ? xArticleText(found) : null;
  if (!got) {
    await sql`UPDATE articles SET body_status = 'unconfirmed', updated_at = now() WHERE id = ${articleId} AND body_status <> 'ok'`;
    return "unconfirmed";
  }
  await sql.begin(async (tx) => {
    const [row] = await tx<{ title: string; excerpt: string | null; body_text: string | null; x_post: { text?: string } | null }[]>`
      SELECT title, excerpt, body_text, x_post FROM articles WHERE id = ${articleId} FOR UPDATE`;
    if (!row) return;
    const title = got.title && onlyXArticleLink(row.x_post?.text) ? got.title : row.title;
    const bodyText = [row.body_text ?? "", got.title ? `# ${got.title}` : "", got.text].filter(Boolean).join("\n\n");
    const hash = contentHash({ title, bodyText, excerpt: row.excerpt });
    const [r] = await tx<{ revision: number }[]>`
      UPDATE articles SET title = ${title}, body_text = ${bodyText}, x_article = ${tx.json(got as never)}, body_status = 'ok',
        revision = revision + 1, content_hash = ${hash}, processing_state = 'new', updated_at = now()
      WHERE id = ${articleId} RETURNING revision`;
    await tx`INSERT INTO article_revisions (article_id, revision, content_hash, title, body_text)
             VALUES (${articleId}, ${r!.revision}, ${hash}, ${title}, ${bodyText})`;
  });
  return "ok";
}

export { collapseWhitespace };
