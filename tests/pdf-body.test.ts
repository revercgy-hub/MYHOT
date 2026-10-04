import assert from "node:assert/strict";
import { test } from "node:test";
import { composeHtmlAndPdfBody, extractDirectPdfBody, extractHtmlEnvelopeWithPdf, fetchAndParseOfficialPdf, urlMatchesAllowedPrefixes } from "@aihot/backend/content/pdf-body";
import type { GuardedResponse } from "@aihot/backend/lib/http-fetch";
import type { ExtractedBody } from "@aihot/backend/content/extract";
import type { PdfSourceBodyConfig } from "@aihot/backend/content/pdf-body";
import { extractFromUrl } from "@aihot/backend/content/extract";
import { fetchDetail } from "@aihot/backend/sources/web-list";

const articleUrl = "https://official.example/notice/2026/06/08/index.html";
const pdfUrl = "https://official.example/notice/2026/06/08/result.pdf";
const prefixes = ["https://official.example/notice/"];
const title = "财政金融示范区考核结果公示";
const expected = { title, publishedAt: new Date("2026-06-08T00:00:00+08:00") };
const htmlConfig: PdfSourceBodyConfig = {
  articleSelector: ".article-envelope",
  bodySelector: ".clean-body",
  attachmentSelector: ".file-area",
  attachmentMode: "required",
  publishedAtUtcOffset: "+08:00",
};

function pdfFixture(rows: string[]): Buffer {
  const pageId = 3, contentId = 4, fontId = 5;
  const stream = ["BT", "/F1 12 Tf", "50 760 Td", ...rows.flatMap((row, rowNo) => [rowNo === 0 ? `(${row}) Tj` : `0 -18 Td (${row}) Tj`]), "ET"].join("\n");
  const streamBytes = Buffer.from(stream, "ascii");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    `<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "ascii")];
  const offsets: number[] = [0];
  let pos = chunks[0]!.length;
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pos);
    const chunk = Buffer.from(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`, "ascii");
    chunks.push(chunk); pos += chunk.length;
  }
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((x) => `${String(x).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "ascii"));
  return Buffer.concat(chunks);
}

function response(url: string, body: Buffer, status = 200, contentType = "application/pdf"): GuardedResponse {
  const headers = new Headers({ "content-type": contentType });
  return { url, status, headers, body, text: () => body.toString("utf8") };
}

function pageHtml(notice = "公示说明。", files = '<li><a href="./result.pdf">考核结果表.pdf</a></li>') {
  return `<html><head><meta name="ArticleTitle" content="${title}"><meta name="PubDate" content="2026-06-08"></head><body>
    <a href="https://official.example/other/unrelated.pdf">其他栏目附件</a>
    <div class="article-envelope"><div class="clean-body"><p>${notice}</p></div><div class="file-area"><ul>${files}</ul></div></div>
  </body></html>`;
}

const notice: ExtractedBody = { html: "<p>HTML通知短正文</p>", text: "HTML通知短正文", images: [], via: "selector" };

test("official PDF URLs are HTTPS and match an origin plus path prefix", () => {
  assert.equal(urlMatchesAllowedPrefixes(pdfUrl, prefixes), true);
  assert.equal(urlMatchesAllowedPrefixes("http://official.example/notice/file.pdf", prefixes), false);
  assert.equal(urlMatchesAllowedPrefixes("https://official.example.evil.test/notice/file.pdf", prefixes), false);
  assert.equal(urlMatchesAllowedPrefixes("https://official.example/notices/file.pdf", prefixes), false);
  assert.equal(urlMatchesAllowedPrefixes("https://user@official.example/notice/file.pdf", prefixes), false);
});

test("PDF request is bounded, forbids redirects, and requires status, MIME, and magic", async () => {
  const bytes = pdfFixture(["TIER  X=1", "FUJIAN  X=2"]);
  let call: { url: string; timeoutMs?: number; maxBytes?: number; maxRedirects?: number; accept?: string } | null = null;
  const good = await fetchAndParseOfficialPdf(pdfUrl, prefixes, async (url, opts) => {
    call = { url, timeoutMs: opts.timeoutMs, maxBytes: opts.maxBytes, maxRedirects: opts.maxRedirects, accept: opts.headers?.accept };
    return response(url, bytes);
  });
  assert.equal(good.ok, true);
  assert.deepEqual(call, { url: pdfUrl, timeoutMs: 20_000, maxBytes: 6 * 1024 * 1024, maxRedirects: 0, accept: "application/pdf" });

  const redirected = await fetchAndParseOfficialPdf(pdfUrl, prefixes, async (url) => response(url, bytes, 302));
  assert.deepEqual(redirected, { ok: false, reason: "pdf_redirected" });
  const wrongStatus = await fetchAndParseOfficialPdf(pdfUrl, prefixes, async (url) => response(url, bytes, 404));
  assert.deepEqual(wrongStatus, { ok: false, reason: "pdf_http_status" });
  const wrongMime = await fetchAndParseOfficialPdf(pdfUrl, prefixes, async (url) => response(url, bytes, 200, "text/html"));
  assert.deepEqual(wrongMime, { ok: false, reason: "pdf_mime_rejected" });
  const wrongMagic = await fetchAndParseOfficialPdf(pdfUrl, prefixes, async (url) => response(url, Buffer.from("not a pdf")));
  assert.deepEqual(wrongMagic, { ok: false, reason: "invalid_pdf" });
  const tooLarge = await fetchAndParseOfficialPdf(pdfUrl, prefixes, async (url) => response(url, Buffer.concat([bytes, Buffer.alloc(6 * 1024 * 1024)])));
  assert.deepEqual(tooLarge, { ok: false, reason: "pdf_too_large" });
  const redirectedUrl = await fetchAndParseOfficialPdf(pdfUrl, prefixes, async () => response("https://official.example/notice/other.pdf", bytes));
  assert.deepEqual(redirectedUrl, { ok: false, reason: "pdf_redirected" });
  const escapedHost = await fetchAndParseOfficialPdf(pdfUrl, prefixes, async () => response("https://evil.example/file.pdf", bytes));
  assert.deepEqual(escapedHost, { ok: false, reason: "pdf_url_rejected" });
  let requested = false;
  const outside = await fetchAndParseOfficialPdf("https://other.example/result.pdf", prefixes, async () => { requested = true; return response(pdfUrl, bytes); });
  assert.deepEqual(outside, { ok: false, reason: "pdf_url_rejected" });
  assert.equal(requested, false);
});

test("PDF attachment failure cannot fall back to the short HTML intro; valid output retains source segments and coordinates", async () => {
  const invalid = await extractHtmlEnvelopeWithPdf(pageHtml(), articleUrl, htmlConfig, expected, prefixes,
    async (url) => response(url, pdfFixture(["row"]), 200, "text/html"));
  assert.deepEqual(invalid, {
    body: null, reason: "pdf_mime_rejected",
    attachments: [{ url: pdfUrl, title: "考核结果表.pdf" }],
  });

  const completed = await extractHtmlEnvelopeWithPdf(pageHtml(), articleUrl, htmlConfig, expected, prefixes,
    async (url) => response(url, pdfFixture(["TIER TABLE", "EAST  FUJIAN", "CITY  XIAMEN"]))) as { body: ExtractedBody | null; reason: string | null };
  assert.equal(completed.reason, null);
  assert.match(completed.body!.text, /HTML 通知正文/);
  assert.match(completed.body!.text, /考核结果表\.pdf/);
  assert.match(completed.body!.text, /https:\/\/official\.example\/notice\/2026\/06\/08\/result\.pdf/);
  assert.match(completed.body!.text, /page=1 y=/);
  assert.match(completed.body!.text, /x=50/);
  assert.match(completed.body!.text, /FUJIAN/);
  assert.match(completed.body!.html, /<pre>/);
  assert.match(completed.body!.html, /href="https:\/\/official\.example\/notice\/2026\/06\/08\/result\.pdf"/);
  assert.doesNotMatch(completed.body!.html, /<script/i);
});

test("optional no-file source uses the 200-character HTML rule and never calls the PDF fetcher", async () => {
  const noFiles = pageHtml("完整通知正文。".repeat(60), "");
  let fetched = false;
  const result = await extractHtmlEnvelopeWithPdf(noFiles, articleUrl, { ...htmlConfig, attachmentMode: "optional" }, expected, prefixes,
    async () => { fetched = true; throw new Error("not expected"); });
  assert.equal(result.reason, null);
  assert.match(result.body!.text, /完整通知正文/);
  assert.equal(fetched, false);
  const short = await extractHtmlEnvelopeWithPdf(pageHtml("intro", ""), articleUrl, { ...htmlConfig, attachmentMode: "optional" }, expected, prefixes,
    async () => { throw new Error("no attachment"); });
  assert.equal(short.body, null);
  assert.equal(short.reason, "short_body_not_allowed");
});

test("direct PDF requires explicit caller opt-in and can compose complete layout", async () => {
  const result = await extractDirectPdfBody(pdfUrl, title, prefixes, async (url) => response(url, pdfFixture(["EAST | T3", "FUJIAN | T2"])));
  assert.equal(result.reason, null);
  assert.match(result.body!.text, new RegExp(title));
  assert.match(result.body!.text, /page=1 y=/);
});

test("detail prefetch and extraction use the same PDF driver and never store the HTML intro on attachment failure", async () => {
  const config = { ...htmlConfig, allowShortBody: false };
  const source = { id: "mof-finance-test", config: { allowUrlPrefixes: prefixes, detail: config } } as never;
  const pdfBytes = pdfFixture(["TIER TABLE", "EAST  FUJIAN"]);
  const makeFetcher = (mime = "application/pdf") => {
    const requested: Array<{ url: string; options: Record<string, unknown> }> = [];
    const fetcher = async (url: string, options: Record<string, unknown>) => {
      requested.push({ url, options });
      return url === articleUrl ? response(url, Buffer.from(pageHtml()), 200, "text/html") : response(url, pdfBytes, 200, mime);
    };
    return { fetcher, requested };
  };

  const prefetch = makeFetcher();
  const detail = await fetchDetail(articleUrl, source, {
    date: false, title: false, summary: false, body: true, expectedTitle: title, expectedPublishedAt: expected.publishedAt,
  }, { fetcher: prefetch.fetcher as never });
  assert.match(detail.body!.text, /HTML 通知正文/);
  assert.match(detail.body!.text, /FUJIAN/);
  assert.equal(prefetch.requested.length, 2);

  const extraction = makeFetcher();
  const failures: string[] = [];
  const extracted = await extractFromUrl(articleUrl, {
    allowJina: true,
    subject: "article:test",
    selectedBody: { config, expected, allowUrlPrefixes: prefixes },
    onSelectedBodyFailure: (reason) => failures.push(reason),
    fetcher: extraction.fetcher as never,
  });
  assert.match(extracted!.text, /FUJIAN/);
  assert.deepEqual(failures, []);
  assert.equal(extraction.requested.length, 2);

  const rejected = makeFetcher("text/html");
  const rejectionReasons: string[] = [];
  const noFallback = await extractFromUrl(articleUrl, {
    allowJina: true,
    subject: "article:test",
    selectedBody: { config, expected, allowUrlPrefixes: prefixes },
    onSelectedBodyFailure: (reason) => rejectionReasons.push(reason),
    fetcher: rejected.fetcher as never,
  });
  assert.equal(noFallback, null);
  assert.deepEqual(rejectionReasons, ["pdf_mime_rejected"]);
  assert.equal(rejected.requested.length, 2, "failure does not fetch Jina or keep the intro as a complete body");
});

test("manual composition refuses missing or partial layout", () => {
  const malformed = { ok: true, pageCount: 2, text: "all text", layout: [{ page: 1, lines: [] }] } as const;
  const fetched = { ok: true, url: pdfUrl, bytes: pdfFixture(["row"]), parsed: malformed } as unknown as Parameters<typeof composeHtmlAndPdfBody>[1];
  assert.equal(composeHtmlAndPdfBody(notice, fetched, "attachment.pdf"), null);
});

test("layout composition preserves coordinate-separated wrapped table text without synthetic joining", () => {
  const parsed = {
    ok: true,
    pageCount: 1,
    text: "青岛市、宁波市、厦门\n市",
    layout: [{ page: 1, lines: [
      { y: 375.65, spans: [{ x: 257.4, text: "青岛市、宁波市、厦门" }] },
      { y: 357.41, spans: [{ x: 257.4, text: "市" }] },
    ] }],
  } as const;
  const fetched = { ok: true, url: pdfUrl, bytes: pdfFixture(["wrapped row"]), parsed } as unknown as Parameters<typeof composeHtmlAndPdfBody>[1];
  const composed = composeHtmlAndPdfBody(notice, fetched, "table.pdf");
  assert.ok(composed);
  assert.match(composed.text, /page=1 y=375\.65.*x=257\.4.*厦门/);
  assert.match(composed.text, /page=1 y=357\.41.*x=257\.4.*市/);
});
