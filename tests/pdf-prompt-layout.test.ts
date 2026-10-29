import assert from "node:assert/strict";
import { test } from "node:test";
import { stripPdfLayoutAnnotations, prefilterUser } from "../packages/backend/src/editorial/writing.ts";
import { buildScoreInput, type AnalyzeInputArticle } from "../packages/backend/src/editorial/analyze.ts";

test("PDF prompt cleanup removes recognized coordinates while preserving amounts, dates and article content", () => {
  const raw = "【PDF 原文】\n[page=1 y=753.77] [x=90] 第21号解释  [x=126] 公积金弥补亏损\n[page=2 y=-1.5] [x=90.5] 2027年1月1日，金额100亿元，比例65%。";
  const cleaned = stripPdfLayoutAnnotations(raw);
  assert.equal(cleaned, "【PDF 原文】\n第21号解释  公积金弥补亏损\n2027年1月1日，金额100亿元，比例65%。");
  const article = { id: "pdf-layout", revision: 1, bodyStatus: "ok", title: "会计准则解释", url: "https://example.gov.cn/a", author: null,
    publishedAt: new Date("2026-10-29T00:00:00Z"), bodyText: raw, excerpt: null, xPost: null, media: [],
    source: { name: "财政部门", kind: "web_list", tier: "T1", firstParty: true } } as AnalyzeInputArticle;
  assert.doesNotMatch(prefilterUser(article), /\[page=|\[x=/u);
  assert.doesNotMatch(buildScoreInput(article), /\[page=|\[x=/u);
  assert.match(buildScoreInput(article), /100亿元，比例65%/u);
  assert.equal(article.bodyText, raw, "stored text and body hash input must remain unchanged");
});

test("ordinary bracketed content and malformed or unanchored markers remain intact", () => {
  const text = "政策参数[x=90]须保留。\n[page=1 y=2]没有坐标前缀的正文\n [page=1 y=2] [x=3] 引用示例\n[page=one y=2] [x=3] 非标准标记";
  assert.equal(stripPdfLayoutAnnotations(text), text);
});
