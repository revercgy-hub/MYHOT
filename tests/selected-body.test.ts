import assert from "node:assert/strict";
import { test } from "node:test";
import { extractSelectedArticleEnvelope, extractSelectedBody } from "@aihot/backend/content/selected-body";
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

test("verified short structured bodies preserve table columns, empty cells, and units", () => {
  const result = extractSelectedBody(omo(), URL, config, expected);
  assert.equal(result.reason, null);
  assert.equal(result.body?.via, "selector");
  assert.match(result.body!.text, /期限 \| 利率 \| 操作量/);
  assert.match(result.body!.text, /隔夜 \| \| 6985亿元/);
  assert.match(result.body!.text, /7天 \| 1\.40% \| 905亿元/);
  assert.match(result.body!.html, /<table>/);
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

const financeTitle = "关于公布普惠金融示范区名单的通知";
const financeHtml = (notice = "简短公示说明。", files = '<a href="./result.pdf">考核结果表.pdf</a>', outside = "") => `<html><head>
<meta name="ArticleTitle" content="${financeTitle}"><meta name="PubDate" content="2026-06-08"></head><body>
${outside}<div class="box_content"><div class="my_doccontent"><p>${notice}</p></div><div class="gu-download"><ul>${files}</ul></div></div></body></html>`;
const envelopeConfig = { articleSelector: ".box_content", bodySelector: ".my_doccontent", attachmentSelector: ".gu-download", attachmentMode: "required" as const, publishedAtUtcOffset: "+08:00" };
const financeExpected = { title: financeTitle, publishedAt: new Date("2026-06-08T00:00:00+08:00") };

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
  assert.deepEqual(unsupportedConfig("web_list", { detail: { articleSelector: ".article" } }), ["detail.articleSelector requires detail.bodySelector and detail.attachmentSelector"]);
  assert.deepEqual(unsupportedConfig("web_list", { allowUrlPrefixes: ["https://official.example/"], detail: { pdfDirect: true, bodySelector: ".body" } }), ["detail.pdfDirect cannot be combined with HTML selectors"]);
});
