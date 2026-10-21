import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { requiresBodyReadinessHold } from "@aihot/backend/content/body-readiness";
import { extractSelectedArticleEnvelope, extractSelectedBody, textKeepingTableCells } from "@aihot/backend/content/selected-body";
import { extractConfiguredHtmlBody } from "@aihot/backend/content/pdf-body";
import type { GuardedResponse } from "@aihot/backend/lib/http-fetch";
import { unsupportedConfig } from "@aihot/backend/sources/config-keys";

const URL = "https://www.pbc.gov.cn/notice.html";
const title = "公开市场业务交易公告 [2026]第191号";
const expectedDate = new Date("2026-09-29T00:00:00+08:00");
const omo = (articleTitle = title, date = "2026-09-29") => `<html><head>
  <meta name="ArticleTitle" content="${articleTitle}"><meta name="PubDate" content="${date}">
  </head><body><div id="zoom"><p>${title}</p>
  <table><tr><th>期限</th><th>利率</th><th>操作量</th></tr>
  <tr><td>7天</td><td>1.40%</td><td>905亿元</td></tr><tr><td>隔夜</td><td></td><td>6985亿元</td></tr></table></div></body></html>`;

const config = { bodySelector: "#zoom", allowShortBody: true };
const expected = { title, publishedAt: expectedDate };

function pdfFixture(lines: string[]): Buffer {
  const stream = ["BT", "/F1 12 Tf", "50 760 Td", ...lines.flatMap((line, index) => [
    index === 0 ? `(${line}) Tj` : `0 -18 Td (${line}) Tj`,
  ]), "ET"].join("\n");
  const streamBytes = Buffer.from(stream, "ascii");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const chunks = [Buffer.from("%PDF-1.4\n", "ascii")];
  const offsets = [0];
  let position = chunks[0]!.length;
  for (let index = 0; index < objects.length; index++) {
    offsets.push(position);
    const chunk = Buffer.from(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`, "ascii");
    chunks.push(chunk);
    position += chunk.length;
  }
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${position}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "ascii"));
  return Buffer.concat(chunks);
}

function pdfResponse(url: string, body: Buffer): GuardedResponse {
  const headers = new Headers({ "content-type": "application/pdf" });
  return { url, status: 200, headers, body, text: () => body.toString("utf8") };
}

test("verified short structured bodies preserve table columns, empty cells, and units", () => {
  const result = extractSelectedBody(omo(), URL, config, expected);
  assert.equal(result.reason, null);
  assert.equal(result.body?.via, "selector");
  assert.match(result.body!.text, /期限 \| 利率 \| 操作量/);
  assert.match(result.body!.text, /隔夜 \| \| 6985亿元/);
  assert.match(result.body!.text, /7天 \| 1\.40% \| 905亿元/);
  assert.match(result.body!.html, /<table>/);
});

test("selected body text joins inline nodes, decodes entities once, and preserves block and table-row separators", () => {
  const body = `<p>天津<span>监管局</span>征收 <span>1.</span><b>66</b>亿元，彩票公益金1.<span>5</span>亿元，业务费0.<em>1</em>亿元，罚没收入0.06亿元，增长5.<span>25</span>%。</p>` +
    `<p>实体 A &amp; B &amp;lt; C。</p><script>PRIVATE_SCRIPT_SENTINEL</script>` +
    `<table><tr><th>期限</th><th>利率</th><th>操作量</th></tr><tr><td>7天</td><td>1.<span>40</span>%</td><td>905亿元</td></tr><tr><td>隔夜</td><td></td><td>6985亿元</td></tr></table>`;
  const page = `<html><head><meta name="ArticleTitle" content="${title}"><meta name="PubDate" content="2026-09-29"></head><body><div id="zoom">${body}</div></body></html>`;
  const result = extractSelectedBody(page, URL, config, expected);

  assert.equal(result.reason, null);
  assert.equal(result.body!.text,
    "天津监管局征收 1.66亿元，彩票公益金1.5亿元，业务费0.1亿元，罚没收入0.06亿元，增长5.25%。\n\n" +
    "实体 A & B &lt; C。\n\n" +
    "期限 | 利率 | 操作量\n7天 | 1.40% | 905亿元\n隔夜 | | 6985亿元");
  assert.doesNotMatch(result.body!.text, /PRIVATE_SCRIPT_SENTINEL|1\. 66|5\. 25/);
  assert.equal(textKeepingTableCells(result.body!.html), result.body!.text,
    "the pure converter accepts sanitized body HTML directly and agrees with the selected-body result");
});

test("pure selected-body text projection joins saved inline numbers without rechecking identity or sanitizing", () => {
  const sanitizedHtml = `<p>金额1.<span>66</span>亿元，费率5.<b>25</b>%。</p><p>实体 A &amp; B &amp;lt; C。</p>` +
    `<table><tr><th>项目</th><th>金额</th></tr><tr><td>财政</td><td>0.<span>06</span>亿元</td></tr></table>`;
  assert.equal(textKeepingTableCells(sanitizedHtml),
    "金额1.66亿元，费率5.25%。\n\n实体 A & B &lt; C。\n\n项目 | 金额\n财政 | 0.06亿元");
});

test("inline markup and block separators do not inflate the established body length floors", () => {
  const inlineText = Array.from({ length: 195 }, () => "<span>财</span>").join("");
  const page = (body: string) => `<html><head><meta name="ArticleTitle" content="${title}"><meta name="PubDate" content="2026-09-29"></head><body><div id="zoom">${body}</div></body></html>`;
  assert.equal(extractSelectedBody(page(`<p>${inlineText}</p>`), URL, { bodySelector: "#zoom" }, expected).reason, "short_body_not_allowed");

  const belowBoundary = extractSelectedBody(page(`<p>${"财".repeat(66)}</p><p>${"财".repeat(66)}</p><p>${"财".repeat(65)}</p>`), URL, { bodySelector: "#zoom" }, expected);
  assert.equal(belowBoundary.reason, "short_body_not_allowed", "197 visible characters plus two raw double-newline separators must measure 199, not 201");
  const atBoundary = extractSelectedBody(page(`<p>${"财".repeat(66)}</p><p>${"财".repeat(66)}</p><p>${"财".repeat(66)}</p>`), URL, { bodySelector: "#zoom" }, expected);
  assert.equal(atBoundary.reason, null, "198 visible characters plus two normalized block separators meet the existing 200-char floor");
  assert.equal(atBoundary.body!.text.length, 202, "the returned body keeps paragraph breaks even though the gate normalizes them");

  const source = (JSON.parse(readFileSync(new globalThis.URL("../industry/sources.json", import.meta.url), "utf8")) as {
    sources: Array<{ id: string; config: Record<string, any> }>;
  }).sources.find((row) => row.id === "mof-shaanxi-supervision-dynamics");
  assert.ok(source);
  const shortBlock = `<div>${Array.from({ length: 39 }, () => "<span>财</span>").join("")}</div>`;
  const pageWithBlocks = (blocks: string) => `<html><head><meta name="ArticleTitle" content="财政部陕西监管局开展财政监督工作"><meta name="PubDate" content="2026-10-12"></head><body><div class="my_doccontent"><div class="TRS_Editor">${blocks}</div></div></body></html>`;
  const blockResult = extractSelectedBody(pageWithBlocks(shortBlock.repeat(3)), URL, {
    bodyPolicies: source.config.detail.bodyPolicies,
    publishedAtUtcOffset: "+08:00",
  }, { title: "财政部陕西监管局开展财政监督工作", publishedAt: new Date("2026-10-12T00:00:00+08:00") });
  assert.equal(blockResult.reason, "body_policy_div_blocks_invalid");
});

test("selector extraction fails closed on title/date identity mismatch or missing identity", () => {
  assert.equal(extractSelectedBody(omo("公开市场业务交易公告 [2026]第190号"), URL, config, expected).reason, "identity_mismatch");
  assert.equal(extractSelectedBody(omo(), URL, config, { title, publishedAt: new Date("2026-09-28T00:00:00+08:00") }).reason, "identity_mismatch");
  assert.equal(extractSelectedBody(omo(title, "2026-09-28"), URL, config, expected).reason, "identity_mismatch");
  assert.equal(extractSelectedBody(omo(), URL, config, { title, publishedAt: null }).reason, "identity_missing");

  const ambiguous = omo().replace("<div id=\"zoom\">", "<div id=\"zoom\" class=\"dup\">")
    .replace("</div></body>", "<div class=\"dup\"><p>second article</p></div></div></body>");
  assert.equal(extractSelectedBody(ambiguous, URL, { bodySelector: ".dup", allowShortBody: true }, expected).reason, "selector_not_unique");
});

test("saved Shaanxi regional page uses its exact title element while preserving the publication-day check", () => {
  const source = (JSON.parse(readFileSync(new globalThis.URL("../industry/sources.json", import.meta.url), "utf8")) as {
    sources: Array<{ id: string; config: Record<string, any> }>;
  }).sources.find((row) => row.id === "mof-regional-supervision-dynamics");
  assert.ok(source);
  const detail = source.config.detail;
  assert.equal(detail.titleRegex, "<title>\\s*([^<]+)</title>");
  const html = readFileSync(new globalThis.URL("./fixtures/regional-bureaus/mof-regional-saved-detail.html", import.meta.url), "utf8");
  const articleUrl = "http://sx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260922_3997949.htm";
  const articleTitle = "财政部陕西监管局：落实六字工作方针持续提升财政运行分析评估“三化”水平";
  const articleDate = new Date("2026-09-29T16:00:00.000Z");
  assert.match(html, /name="ArticleTitle" content="[^"]*<br>/);
  const result = extractSelectedBody(html, articleUrl, detail, { title: articleTitle, publishedAt: articleDate });
  assert.equal(result.reason, null);
  assert.ok(result.body!.text.length >= 1_500);
  assert.match(result.body!.text, /陕西省107个县区/);

  const { titleRegex: _titleRegex, ...legacy } = detail;
  assert.equal(extractSelectedBody(html, articleUrl, legacy, { title: articleTitle, publishedAt: articleDate }).reason, "identity_mismatch");
  assert.equal(extractSelectedBody(html, articleUrl, detail, { title: articleTitle, publishedAt: new Date("2026-09-28T16:00:00.000Z") }).reason, "identity_mismatch");
});

test("authoritative title selector reads Shenzhen rendered heading and fails closed on ambiguity", () => {
  const source = (JSON.parse(readFileSync(new globalThis.URL("../industry/sources.json", import.meta.url), "utf8")) as {
    sources: Array<{ id: string; config: Record<string, any> }>;
  }).sources.find((row) => row.id === "mof-shenzhen-supervision-dynamics");
  assert.ok(source);
  const detail = source.config.detail;
  assert.equal(detail.titleAuthoritative, true);
  assert.equal(detail.titleSelector, "h2.title_con");
  const html = readFileSync(new globalThis.URL("./fixtures/regional-bureaus/shenzhen-saved-detail.html", import.meta.url), "utf8");
  const articleUrl = "https://sz.mof.gov.cn/caizhengjiancha/202609/t20260920_3997808.htm";
  const articleTitle = "深圳监管局：凝聚共识真抓实干 深入贯彻落实财政科学管理试点座谈会精神";
  const articleDate = new Date("2026-09-19T16:00:00.000Z");
  assert.match(html, /name="ArticleTitle" content="[^"]*<br>/);

  const result = extractSelectedBody(html, articleUrl, detail, { title: articleTitle, publishedAt: articleDate });
  assert.equal(result.reason, null);
  assert.ok(result.body!.text.length > 1_500);
  assert.match(result.body!.text, /深圳监管局第一时间组织召开专题会议/);

  const { titleSelector: _titleSelector, ...legacy } = detail;
  assert.equal(extractSelectedBody(html, articleUrl, legacy, { title: articleTitle, publishedAt: articleDate }).reason, "identity_mismatch");
  assert.equal(extractSelectedBody(html, articleUrl, { ...detail, titleRegex: "<title>(wrong)</title>" }, { title: articleTitle, publishedAt: articleDate }).reason, null,
    "an explicitly configured title selector takes precedence over a regex");
  assert.equal(extractSelectedBody(html, articleUrl, { ...detail, titleSelector: ".missing-title" }, { title: articleTitle, publishedAt: articleDate }).reason, "identity_missing");
  assert.equal(extractSelectedBody(html, articleUrl, { ...detail, titleSelector: "h2.title_con, title" }, { title: articleTitle, publishedAt: articleDate }).reason, "identity_missing");
  const emptyTitle = html.replace(/<h2 class="title_con"[^>]*>[\s\S]*?<\/h2>/, '<h2 class="title_con"></h2>');
  assert.equal(extractSelectedBody(emptyTitle, articleUrl, detail, { title: articleTitle, publishedAt: articleDate }).reason, "identity_missing");
  assert.equal(extractSelectedBody(html, articleUrl, detail, { title: articleTitle, publishedAt: new Date("2026-09-18T16:00:00.000Z") }).reason, "identity_mismatch");
});

test("selector extraction rejects navigation, blank or linked-only containers, and unprocessed PDF attachments", () => {
  const navOnly = `<meta name="ArticleTitle" content="${title}"><meta name="PubDate" content="2026-09-29"><div id="zoom"><nav><p>菜单</p></nav></div>`;
  assert.equal(extractSelectedBody(navOnly, URL, config, expected).reason, "non_article_container");

  const linkedOnly = `<meta name="ArticleTitle" content="${title}"><meta name="PubDate" content="2026-09-29"><div id="zoom"><p><a href="/other">站内导航</a></p></div>`;
  assert.equal(extractSelectedBody(linkedOnly, URL, config, expected).reason, "empty_body");
  const blank = `<meta name="ArticleTitle" content="${title}"><meta name="PubDate" content="2026-09-29"><div id="zoom"><p> \t </p><table><tr><td> </td><td></td></tr></table></div>`;
  assert.equal(extractSelectedBody(blank, URL, config, expected).reason, "empty_body");

  const withAttachment = omo().replace("</body>", '<a href="/files/notice.pdf">附件：交易公告</a></body>');
  const attached = extractSelectedBody(withAttachment, URL, config, expected);
  assert.equal(attached.reason, "attachments_unprocessed");
  assert.equal(attached.attachments.length, 1);
  assert.equal(extractSelectedBody(omo(), URL, { bodySelector: "#zoom" }, expected).reason, "short_body_not_allowed");
});

test("short-body opt-in is explicit and requires a body selector", () => {
  assert.deepEqual(unsupportedConfig("web_list", { detail: { allowShortBody: true } }), ["detail.allowShortBody requires detail.bodySelector"]);
  assert.deepEqual(unsupportedConfig("web_list", { detail: { bodySelector: "#zoom", allowShortBody: true } }), []);
});

test("Shaanxi div-block policy is explicit, identity-bound, and rejects weak or linked containers", () => {
  const source = (JSON.parse(readFileSync(new globalThis.URL("../industry/sources.json", import.meta.url), "utf8")) as {
    sources: Array<{ id: string; kind: string; enabled: boolean; site_fulltext: boolean; syndicate_fulltext: boolean; config: Record<string, any> }>;
  }).sources.find((row) => row.id === "mof-shaanxi-supervision-dynamics");
  assert.ok(source);
  assert.equal(source.enabled, false);
  assert.equal(source.site_fulltext, false);
  assert.equal(source.syndicate_fulltext, false);
  assert.deepEqual(unsupportedConfig("web_list", source.config), []);
  assert.deepEqual(source.config.detail.bodyPolicies, [
    { selector: ".my_doccontent .TRS_Editor", minTextChars: 1500, divTextBlocks: true },
  ]);
  assert.equal(source.config.detail.titleRegex, "<title>\\s*([^<]+)</title>");

  const shaanxiTitle = "财政部陕西监管局开展财政监督工作";
  const shaanxiExpected = { title: shaanxiTitle, publishedAt: new Date("2026-10-12T00:00:00+08:00") };
  const policy = source.config.detail.bodyPolicies;
  const paragraph = "围绕预算执行、财政资金使用和项目绩效情况开展核查，梳理发现问题并跟踪推动整改落实。".repeat(12);
  const shortHeading = "部门工作动态".repeat(5);
  const blocks = [paragraph, shortHeading, paragraph, shortHeading, paragraph, shortHeading, paragraph]
    .map((text) => `<div>${text}</div>`).join("");
  const page = (body: string) => `<html><head><meta name="ArticleTitle" content="${shaanxiTitle}"><meta name="PubDate" content="2026-10-12"></head><body><div class="my_doccontent"><div class="TRS_Editor">${body}</div></div></body></html>`;
  const result = extractSelectedBody(page(blocks), URL, { bodyPolicies: policy, publishedAtUtcOffset: "+08:00" }, shaanxiExpected);
  assert.equal(result.reason, null);
  assert.ok(result.body!.text.length >= 1500);

  // A div-only page still fails the legacy selector path; only the explicit structure policy opts in.
  assert.equal(extractSelectedBody(page(blocks), URL, { bodySelector: ".TRS_Editor" }, shaanxiExpected).reason, "non_article_container");
  assert.equal(extractSelectedBody(omo(), URL, { bodySelector: "body", allowShortBody: true }, expected).reason, "selector_not_unique");
  assert.equal(extractSelectedBody(page(blocks.replace(/<div>(.*?)<\/div>/, "<div><div>$1</div></div>")), URL,
    { bodyPolicies: policy, publishedAtUtcOffset: "+08:00" }, shaanxiExpected).reason, "body_policy_div_blocks_invalid");
  const twoEffectiveBlocks = [paragraph, shortHeading, paragraph, shortHeading, shortHeading, shortHeading, shortHeading]
    .map((text) => `<div>${text}</div>`).join("");
  assert.equal(extractSelectedBody(page(twoEffectiveBlocks), URL,
    { bodyPolicies: policy, publishedAtUtcOffset: "+08:00" }, shaanxiExpected).reason, "body_policy_div_blocks_invalid");
  assert.equal(extractSelectedBody(page(blocks.replace(paragraph, `<a href="/navigation">${paragraph}</a>`)), URL,
    { bodyPolicies: policy, publishedAtUtcOffset: "+08:00" }, shaanxiExpected).reason, "body_policy_div_blocks_invalid");
  assert.equal(extractSelectedBody(page(blocks.replace("<div>", "<div><nav>栏目</nav>")), URL,
    { bodyPolicies: policy, publishedAtUtcOffset: "+08:00" }, shaanxiExpected).reason, "non_article_container");
  const navAncestor = page(blocks).replace('<div class="TRS_Editor">', '<nav><div class="TRS_Editor">')
    .replace("</div></div></body>", "</div></nav></div></body>");
  assert.equal(extractSelectedBody(navAncestor, URL, { bodyPolicies: policy, publishedAtUtcOffset: "+08:00" }, shaanxiExpected).reason, "non_article_container");
  assert.equal(extractSelectedBody(page(blocks), URL, { bodyPolicies: policy, publishedAtUtcOffset: "+08:00" },
    { ...shaanxiExpected, title: "其他文章标题" }).reason, "identity_mismatch");

  const attachment = extractSelectedBody(page(blocks).replace("</body>", '<a href="/files/report.pdf">附件</a></body>'), URL,
    { bodyPolicies: policy, publishedAtUtcOffset: "+08:00" }, shaanxiExpected);
  assert.equal(attachment.reason, "attachments_unprocessed");
  assert.equal(attachment.attachments.length, 1);
  assert.equal(extractSelectedBody(page(blocks).replace("</body>", '<a href="/files/report.pdf">附件</a></body>'), URL,
    { bodyPolicies: policy, publishedAtUtcOffset: "+08:00" }, shaanxiExpected, { pdfAttachmentsPrevalidated: true }).reason, "attachments_unprocessed");

  assert(unsupportedConfig("web_list", { detail: { bodyPolicies: [{ ...policy[0], divTextBlocks: false }] } }).some((error) => error.includes("divTextBlocks must be true")));
  assert(unsupportedConfig("web_list", { detail: { bodyPolicies: [{ ...policy[0], minTextChars: 1499 }] } }).some((error) => error.includes("at least 1500")));
  assert(unsupportedConfig("web_list", { detail: { bodyPolicies: [{ ...policy[0], table: { requiredHeaderCells: ["标题"], minCompleteDataRows: 1 } }] } }).some((error) => error.includes("cannot be combined")));
  assert(unsupportedConfig("web_list", { detail: { bodyPolicies: [{ ...policy[0], unexpected: true }] } }).some((error) => error.includes("unsupported")));
});

const financeTitle = "关于公布普惠金融示范区名单的通知";
const financeHtml = (notice = "简短公示说明。", files = '<a href="./result.pdf">考核结果表.pdf</a>', outside = "") => `<html><head>
<meta name="ArticleTitle" content="${financeTitle}"><meta name="PubDate" content="2026-06-08"></head><body>
${outside}<div class="box_content"><div class="my_doccontent"><p>${notice}</p></div><div class="gu-download"><ul>${files}</ul></div></div></body></html>`;
const envelopeConfig = { articleSelector: ".box_content", bodySelector: ".my_doccontent", attachmentSelector: ".gu-download", attachmentMode: "required" as const, publishedAtUtcOffset: "+08:00" };
const financeExpected = { title: financeTitle, publishedAt: new Date("2026-06-08T00:00:00+08:00") };

test("article envelope honors the explicit authoritative rendered-title selector", () => {
  const renderedTitle = "深圳监管局：凝聚共识真抓实干 深入贯彻落实财政科学管理试点座谈会精神";
  const html = `<html><head><meta name="ArticleTitle" content="深圳监管局：凝聚共识真抓实干 深入贯彻落实<br>财政科学管理试点座谈会精神"><meta name="PubDate" content="2026-09-20"></head><body>
    <article class="selected-article"><h2 class="authoritative-title">深圳监管局：凝聚共识真抓实干 深入贯彻落实<br>财政科学管理试点座谈会精神</h2>
    <div class="notice-body"><p>${"围绕财政监管工作制定举措，持续推动责任落实和政策执行。".repeat(8)}</p></div><div class="files"></div></article></body></html>`;
  const config = {
    articleSelector: ".selected-article", bodySelector: ".notice-body", attachmentSelector: ".files", attachmentMode: "optional" as const,
    titleSelector: ".authoritative-title", titleRegex: "<title>(wrong)</title>", publishedAtUtcOffset: "+08:00",
  };
  const expected = { title: renderedTitle, publishedAt: new Date("2026-09-19T16:00:00.000Z") };
  assert.equal(extractSelectedArticleEnvelope(html, URL, config, expected).reason, null);
  assert.equal(extractSelectedArticleEnvelope(html, URL, config, { ...expected, title: "其他标题" }).reason, "identity_mismatch");
  assert.equal(extractSelectedArticleEnvelope(html.replace("</article>", '<h2 class="authoritative-title">重复</h2></article>'), URL, config, expected).reason, "identity_missing");
  assert.equal(extractSelectedArticleEnvelope(html, URL, { ...config, titleSelector: ".absent" }, expected).reason, "identity_missing");
});

test("article envelope finds exactly one selected PDF sibling, ignoring unrelated page attachments", () => {
  const got = extractSelectedArticleEnvelope(financeHtml("公示说明。", '<li><a href="./result.pdf">结果表.pdf</a></li>', '<a href="/nav.pdf">导航PDF</a>'), URL, envelopeConfig, financeExpected);
  assert.equal(got.reason, null);
  assert.equal(got.attachment?.url, "https://www.pbc.gov.cn/result.pdf");
  assert.equal(got.attachment?.title, "结果表.pdf");
  assert.match(got.body!.text, /公示说明/);
  assert.equal(extractSelectedArticleEnvelope(financeHtml().replace("content=\"关于公布普惠金融示范区名单的通知\"", "content=\"错题\""), URL, envelopeConfig, financeExpected).reason, "identity_mismatch");
});

test("required and optional attachment contracts fail closed on zero, multiple, unsupported, or short zero-file pages", () => {
  assert.equal(extractSelectedArticleEnvelope(financeHtml("公示说明。", ""), URL, envelopeConfig, financeExpected).reason, "attachment_required");
  assert.equal(extractSelectedArticleEnvelope(financeHtml("公示说明。", '<li><a href="a.pdf">A</a><a href="b.pdf">B</a></li>'), URL, envelopeConfig, financeExpected).reason, "attachment_ambiguous");
  assert.equal(extractSelectedArticleEnvelope(financeHtml("公示说明。", '<li><a href="result.rar">压缩包</a></li>'), URL, envelopeConfig, financeExpected).reason, "attachment_unsupported");
  const optional = { ...envelopeConfig, attachmentMode: "optional" as const };
  assert.equal(extractSelectedArticleEnvelope(financeHtml("公示说明。", ""), URL, optional, financeExpected).reason, "short_body_not_allowed");
  assert.equal(extractSelectedArticleEnvelope(financeHtml("完整通知正文。".repeat(40), ""), URL, optional, financeExpected).reason, null);
  assert.equal(extractSelectedArticleEnvelope(financeHtml("公示说明。", '<a href="http://evil.test/file.pdf">外链</a>'), URL, optional, financeExpected).reason, "attachment_url_invalid");
});

test("article envelope selectors must be unique and scoped to the article", () => {
  const outside = financeHtml().replace("</body>", '<div class="box_content"><div class="my_doccontent"><p>duplicate</p></div><div class="gu-download"></div></div></body>');
  assert.equal(extractSelectedArticleEnvelope(outside, URL, envelopeConfig, financeExpected).reason, "article_not_unique");
  assert.equal(extractSelectedArticleEnvelope(financeHtml().replace("class=\"gu-download\"", "class=\"elsewhere\""), URL, envelopeConfig, financeExpected).reason, "attachment_unclassified");
});

test("PDF source config fields are explicit, paired, and require HTTPS source prefixes", () => {
  assert.deepEqual(unsupportedConfig("web_list", { allowUrlPrefixes: ["https://official.example/"], detail: envelopeConfig }), []);
  assert.deepEqual(unsupportedConfig("web_list", { allowUrlPrefixes: ["http://official.example/"], detail: envelopeConfig }), ["PDF opt-in requires HTTPS allowUrlPrefixes"]);
  assert.deepEqual(unsupportedConfig("rss", { allowUrlPrefixes: ["https://official.example/"], detail: envelopeConfig }), ["PDF body config is only supported by web_list"]);
  assert.deepEqual(unsupportedConfig("web_list", { detail: { articleSelector: ".article" } }), ["detail.articleSelector requires detail.attachmentSelector and a body selector or policy"]);
  assert.deepEqual(unsupportedConfig("web_list", { allowUrlPrefixes: ["https://official.example/"], detail: { pdfDirect: true, bodySelector: ".body" } }), ["detail.pdfDirect cannot be combined with HTML selectors"]);
  assert.deepEqual(unsupportedConfig("web_list", { allowUrlPrefixes: ["https://official.example/"], detail: {
    pdfDirect: true, pdfDirectUrlSuffix: ".pdf", bodySelector: ".body",
  } }), []);
  assert(unsupportedConfig("web_list", { allowUrlPrefixes: ["https://official.example/"], detail: {
    pdfDirect: true, pdfDirectUrlSuffix: ".PDF", bodySelector: ".body",
  } }).some((entry) => entry.includes("pdfDirectUrlSuffix must be .pdf")));
  assert(unsupportedConfig("web_list", { allowUrlPrefixes: ["https://official.example/"], detail: {
    pdfDirect: false, pdfDirectUrlSuffix: ".pdf", bodySelector: ".body",
  } }).some((entry) => entry.includes("pdfDirectUrlSuffix requires detail.pdfDirect=true")));
  assert.deepEqual(unsupportedConfig("web_list", { allowUrlPrefixes: ["https://official.example/"], detail: {
    pdfDirect: true, pdfDirectUrlSuffix: ".pdf", bodyPolicies: [{ selector: ".notice", minTextChars: 1 }],
  } }), [], "mixed direct-PDF mode can retain policy selectors without an attachment envelope");
  const policyEnvelope = {
    bodyPolicies: [{ selector: ".notice", minTextChars: 1 }], articleSelector: ".article",
    attachmentSelector: ".files", attachmentMode: "required",
  };
  assert.deepEqual(unsupportedConfig("web_list", { allowUrlPrefixes: ["https://official.example/"], detail: policyEnvelope }), []);
  assert.deepEqual(unsupportedConfig("web_list", { allowUrlPrefixes: ["https://official.example/"], detail: {
    ...policyEnvelope, pdfIdentity: { kind: "normalized_title" },
  } }), []);
  for (const pdfMaxBytes of [0, -1, 1.5, Number.NaN, 20 * 1024 * 1024 + 1]) {
    assert(unsupportedConfig("web_list", { allowUrlPrefixes: ["https://official.example/"], detail: { pdfDirect: true, pdfMaxBytes } }).some((entry) => entry.includes("pdfMaxBytes")));
  }
  assert.deepEqual(unsupportedConfig("web_list", { allowUrlPrefixes: ["https://official.example/"], detail: {
    pdfDirect: true, pdfIdentity: { kind: "normalized_title" }, pdfMaxBytes: 20 * 1024 * 1024,
  } }), []);
  assert(unsupportedConfig("web_list", { allowUrlPrefixes: ["https://official.example/"], detail: {
    pdfDirect: true, pdfIdentity: { kind: "document_number", regex: "([" },
  } }).some((entry) => entry.includes("valid regular expression")));
});

test("Xiamen debt config sends its required article PDF through the shared text extractor", async () => {
  const entry = (JSON.parse(readFileSync(new globalThis.URL("../industry/sources.json", import.meta.url), "utf8")) as {
    sources: Array<{ id: string; kind: string; enabled: boolean; site_fulltext: boolean; syndicate_fulltext: boolean; config: Record<string, any> }>;
  }).sources.find((source) => source.id === "xiamen-finance-debt");
  assert.ok(entry);
  assert.equal(entry.enabled, false);
  assert.equal(entry.site_fulltext, false);
  assert.equal(entry.syndicate_fulltext, false);
  assert.equal(entry.kind, "web_list");
  assert.deepEqual(unsupportedConfig("web_list", entry.config), []);
  assert.deepEqual(entry.config.allowUrlPrefixes, ["https://cz.xm.gov.cn/zwxx/czsj/dfzxx/"]);
  assert.deepEqual(entry.config.detail, {
    bodySelector: ".Custom_UnionStyle",
    titleRegex: "<div class=\"article_title text_align_center\" id=\"font_title\">([^<]+)</div>",
    publishedAtRegex: "<span class=\"article_time\">\\s*时间：([^<]+)</span>",
    articleSelector: ".article_component",
    attachmentSelector: ".article_attachment",
    attachmentMode: "required",
  });

  // This fixture copies the identity/body/attachment structure from the saved official detail.
  const url = "https://cz.xm.gov.cn/zwxx/czsj/dfzxx/202609/t20260911_3016829.htm";
  const title = "2026年厦门市政府专项债券（十六期）招标结果公告";
  const fixture = `<div class="article_component">
    <div class="article_title_group"><div class="article_title text_align_center" id="font_title">${title}</div></div>
    <span class="article_time">时间：2026-09-11 16:02</span>
    <div class="article_area"><div class="article_content_01"><div class="TRS_Editor"><div class="Custom_UnionStyle"><p>　　${title}。</p></div></div></div></div>
    <div class="article_attachment"><div class="title_base">附件下载</div><div class="list_base list_base_date_02"><ul><li><a href="./P020260911578215495483.pdf" title="2026年厦门市政府专项债券(十六期)招标结果公告.pdf">2026年厦门市政府专项债券(十六期)招标结果公告.pdf</a></li></ul></div></div>
  </div>`;
  const expectedArticle = { title, publishedAt: new Date("2026-09-11T00:00:00.000Z") };
  const fetcher = async (pdfUrl: string) => pdfResponse(pdfUrl, pdfFixture(["TENDER RESULT", "ISSUE XVI", "TOTAL 100"]));
  const result = await extractConfiguredHtmlBody(fixture, url, {
    ...entry.config.detail,
    publishedAtUtcOffset: entry.config.publishedAtUtcOffset,
  }, expectedArticle, entry.config.allowUrlPrefixes, fetcher);

  assert.equal(result.reason, null);
  assert.match(result.body!.text, /HTML 通知正文/);
  assert.match(result.body!.text, /PDF 原文/);
  assert.match(result.body!.text, /TENDER RESULT/);
  assert.match(result.body!.text, /ISSUE XVI/);
  assert.match(result.body!.text, /P020260911578215495483\.pdf/);
  assert.equal(result.attachments, undefined);

  const emptyPage = await extractConfiguredHtmlBody(fixture, url, {
    ...entry.config.detail,
    publishedAtUtcOffset: entry.config.publishedAtUtcOffset,
  }, expectedArticle, entry.config.allowUrlPrefixes, async (pdfUrl: string) => pdfResponse(pdfUrl, pdfFixture([])));
  assert.equal(emptyPage.reason, "pdf_page_no_text");
  assert.equal(emptyPage.body, null);
  assert.equal(emptyPage.attachments?.length, 1);
  assert.equal(requiresBodyReadinessHold(entry.config, "unconfirmed", null), true);
});
