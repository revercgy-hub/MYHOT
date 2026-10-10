import { closeSync, openSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const REPORT_SCHEMA = "fiscal-p4-bounded-execution/v1";
const METADATA_SCHEMA = "fiscal-p4-quality-review-metadata/v1";
const MAX_TITLE_CHARS = 300;
const MAX_SUMMARY_CHARS = 1200;
const MAX_LIST_ITEMS = 24;
const MAX_LIST_ITEM_CHARS = 100;

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): RecordValue {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function requireIdentity(value: unknown, label: string): RecordValue & {
  articleId: string; sourceId: string; revision: number; contentHash: string; analysisId: number;
} {
  const row = requireRecord(value, label);
  const articleId = requireString(row.articleId, `${label}.articleId`);
  const sourceId = requireString(row.sourceId, `${label}.sourceId`);
  if (!Number.isSafeInteger(row.revision) || (row.revision as number) < 1) throw new Error(`${label}.revision must be a positive integer`);
  if (typeof row.contentHash !== "string" || !/^[a-f\d]{64}$/i.test(row.contentHash)) throw new Error(`${label}.contentHash must be a SHA-256 hex string`);
  if (!Number.isSafeInteger(row.analysisId) || (row.analysisId as number) < 1) throw new Error(`${label}.analysisId must be a positive integer`);
  return row as typeof row & { articleId: string; sourceId: string; revision: number; contentHash: string; analysisId: number };
}

function identityKey(row: { articleId: string; sourceId: string; revision: number; contentHash: string; analysisId: number }): string {
  return JSON.stringify([row.articleId, row.sourceId, row.revision, row.contentHash.toLowerCase(), row.analysisId]);
}

function markdown(value: string): string {
  return value.replace(/[\\`*_{}\[\]()#!|]/g, "\\$&").replace(/[\r\n]+/g, " ").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function textCell(value: unknown, maxChars: number, missing = "（未提供）"): string {
  if (value === null || value === undefined) return missing;
  if (typeof value !== "string") return "（格式异常：期望文本）";
  const trimmed = value.trim();
  if (!trimmed) return missing;
  const bounded = trimmed.length > maxChars
    ? `${trimmed.slice(0, maxChars)}…（原字段超过 ${maxChars} 字符，已截断）`
    : trimmed;
  return markdown(bounded);
}

function safeUrl(value: unknown): string {
  if (typeof value !== "string") return "（链接未提供）";
  if (value.length > 2048) return "（链接未接受：超过长度上限）";
  try {
    const url = new URL(value);
    if (!(url.protocol === "https:" || url.protocol === "http:") || url.username || url.password) return "（链接不接受：仅允许无凭据的 HTTP(S)）";
    const sensitiveParam = /(?:^|[_-])(?:api[_-]?key|key|token|secret|password|credential|auth|signature|sig|access[_-]?token)(?:$|[_-])/i;
    const safeParams: string[][] = [...url.searchParams].map(([key, item]) => [key, sensitiveParam.test(key) ? "[redacted]" : item]);
    url.search = new URLSearchParams(safeParams).toString();
    url.hash = "";
    const target = url.href.replaceAll(">", "%3E");
    return `<${target}>`;
  } catch {
    return "（链接不接受：仅允许无凭据的 HTTP(S)）";
  }
}

function stringList(value: unknown, label: string): string {
  if (value === null || value === undefined) return "（未提供）";
  if (!Array.isArray(value)) return "（格式异常：期望文本列表）";
  if (value.length === 0) return "（空）";
  const shown = value.slice(0, MAX_LIST_ITEMS).map((item) => textCell(item, MAX_LIST_ITEM_CHARS, "（空项）"));
  if (value.length > MAX_LIST_ITEMS) shown.push(`（另有 ${value.length - MAX_LIST_ITEMS} 项未展示）`);
  return `${label}：${shown.join("；")}`;
}

function numberDisplay(value: unknown): string {
  if (value === null || value === undefined) return "未提供";
  if (typeof value !== "number" || !Number.isFinite(value)) return "格式异常（未提供有效数值）";
  return String(value);
}

function scoresDisplay(value: unknown): string {
  if (value === null || value === undefined) return "未提供";
  if (!Array.isArray(value) || value.some((score) => typeof score !== "number" || !Number.isFinite(score))) return "格式异常（未提供有效分数列表）";
  return value.length ? value.map((score) => String(score)).join(" / ") : "（空）";
}

function factFrame(value: unknown): string {
  if (value === null || value === undefined) return "（未提供）";
  if (!isRecord(value)) return "（格式异常：期望事实框架对象）";
  const fields = ["title", "subject", "action", "object", "occurredAt"] as const;
  return fields.map((field) => `${field}=${textCell(value[field], 160, "（空）")}`).join("；");
}

function manualReview(index: number): string[] {
  return [
    `### 人工复核 ${index}`,
    "",
    "以下均未预填判断，请人工对照原文和业务规则填写。",
    "",
    "- 事实摘要：□准确　□部分有误　□有误　□无法判断　理由：____________________________",
    "- 内容类型：□准确　□部分有误　□有误　□无法判断　理由：____________________________",
    "- 主题/分类：□准确　□部分有误　□有误　□无法判断　理由：____________________________",
    "- 评分：□合理　□偏高　□偏低　□无法判断　理由：____________________________________",
    "- 事件关系（系统聚簇未运行）：□同一事件　□不同事件　□不确定　理由：________________",
    "",
  ];
}

/** Render an offline, metadata-only sheet. Extra input properties are ignored by explicit field selection. */
export function renderP4QualityReview(reportInput: unknown, metadataInput: unknown): string {
  const report = requireRecord(reportInput, "execution report");
  const metadata = requireRecord(metadataInput, "article/analysis metadata");
  if (report.schema !== REPORT_SCHEMA) throw new Error(`execution report.schema must be ${REPORT_SCHEMA}`);
  if (metadata.schema !== METADATA_SCHEMA) throw new Error(`article/analysis metadata.schema must be ${METADATA_SCHEMA}`);
  if (!Array.isArray(report.rows)) throw new Error("execution report.rows must be an array");
  if (!Array.isArray(metadata.articles)) throw new Error("article/analysis metadata.articles must be an array");

  const reportRows = report.rows.map((value, index) => {
    const row = requireRecord(value, `execution report.rows[${index}]`);
    // The bounded executor's established report uses `id`; the companion metadata uses `articleId`.
    return requireIdentity({ ...row, articleId: row.id }, `execution report.rows[${index}]`);
  });
  const metadataRows = metadata.articles.map((row, index) => requireIdentity(row, `article/analysis metadata.articles[${index}]`));
  if (reportRows.length === 0) throw new Error("execution report contains no articles to review");
  const seenReport = new Set<string>();
  const seenMetadata = new Set<string>();
  for (const row of reportRows) {
    if (seenReport.has(row.articleId)) throw new Error("execution report contains duplicate articleId values");
    seenReport.add(row.articleId);
  }
  for (const row of metadataRows) {
    if (seenMetadata.has(row.articleId)) throw new Error("article/analysis metadata contains duplicate articleId values");
    seenMetadata.add(row.articleId);
  }
  if (reportRows.length !== metadataRows.length) throw new Error("execution report and metadata must contain the same article rows");

  const metadataById = new Map(metadataRows.map((row) => [row.articleId, row]));
  const joined = reportRows.map((reportRow) => {
    const metadataRow = metadataById.get(reportRow.articleId);
    if (!metadataRow) throw new Error("article/analysis metadata is missing a report article");
    if (identityKey(reportRow) !== identityKey(metadataRow)) throw new Error("article/analysis identity drift detected");
    return { reportRow, metadataRow };
  });

  const out = [
    "# P4 人工质量审查表",
    "",
    "本表由既有 P4 execution report 与独立的文章/分析元数据离线生成。展示的内容是模型输出，未经人工核验；本表不自动判断质量，不代表 Gold 标签或 P4 通过。系统聚簇阶段未运行，事件关系栏只供人工填写。分数与阈值按元数据原样列示，不重新计算。receipt ID、receipt 响应、正文及密钥不导出。",
    "",
  ];
  if (report.runHash !== undefined) {
    if (typeof report.runHash !== "string" || !/^[a-f\d]{64}$/i.test(report.runHash)) throw new Error("execution report.runHash must be a SHA-256 hex string");
    out.push(`Run：${report.runHash}`, "");
  }

  joined.forEach(({ reportRow, metadataRow }, index) => {
    const article = isRecord(metadataRow.article) ? metadataRow.article : {};
    const analysis = isRecord(metadataRow.analysis) ? metadataRow.analysis : {};
    out.push(
      `## ${index + 1}. ${textCell(article.title, MAX_TITLE_CHARS, "（标题未提供）")}`,
      "",
      `来源：${textCell(reportRow.sourceId, 100)}　文章 ID：${textCell(reportRow.articleId, 100)}　修订：${reportRow.revision}　分析 ID：${reportRow.analysisId}`,
      `原文链接：${safeUrl(article.url)}　发布日期：${textCell(article.publishedAt, 80)}`,
      "",
      "### 模型输出（待人工核验）",
      "",
      `- 中文标题：${textCell(analysis.titleZh, MAX_TITLE_CHARS)}`,
      `- 中文摘要：${textCell(analysis.summaryZh, MAX_SUMMARY_CHARS)}`,
      `- 内容类型：${textCell(analysis.itemType, 100)}`,
      `- 作者角色：${textCell(analysis.authorRole, 100)}`,
      `- 分类：${textCell(analysis.category, 100)}`,
      `- 主题标签：${stringList(analysis.tags, "标签")}`,
      `- 主体：${stringList(analysis.subjects, "主体")}`,
      `- 相关性：${textCell(reportRow.relevance, 100)}`,
      `- 两次评分（原样）：${scoresDisplay(analysis.scores)}`,
      `- 已记录分数：${numberDisplay(analysis.score)}；已记录阈值：${numberDisplay(analysis.threshold)}；执行报告 selected：${typeof reportRow.selected === "boolean" ? String(reportRow.selected) : "未提供"}`,
      `- Fact frame（模型结构输出）：${factFrame(analysis.factFrame)}`,
      "",
      "系统聚簇：未运行。以下事件关系判断仅由人工填写，不是系统聚类结果。",
      "",
      ...manualReview(index + 1),
      "---",
      "",
    );
  });
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

function main(argv: string[]): number {
  const { values, positionals } = parseArgs({
    options: { out: { type: "string" }, help: { type: "boolean", default: false } },
    allowPositionals: true,
    strict: true,
    args: argv,
  });
  if (values.help) {
    console.log("Usage: node scripts/fiscal/p4-quality-review.ts <execution-report.json> <article-analysis-metadata.json> [--out review.md]");
    return 0;
  }
  if (positionals.length !== 2) throw new Error("provide an execution report JSON and an article/analysis metadata JSON");
  const readJson = (inputPath: string, label: string): unknown => {
    const content = readFileSync(path.resolve(inputPath), "utf8");
    try { return JSON.parse(content) as unknown; }
    catch { throw new Error(`${label} JSON is invalid`); }
  };
  const report = readJson(positionals[0]!, "execution report");
  const metadata = readJson(positionals[1]!, "article/analysis metadata");
  const rendered = renderP4QualityReview(report, metadata);
  if (values.out) {
    const outputPath = path.resolve(values.out);
    const fd = openSync(outputPath, "wx", 0o600);
    try { writeFileSync(fd, rendered, { encoding: "utf8" }); }
    finally { closeSync(fd); }
  } else process.stdout.write(rendered);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_FILE)) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    console.error(error instanceof Error ? error.message : "P4 quality review generation failed");
    process.exitCode = 2;
  }
}
