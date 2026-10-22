import { closeSync, openSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateManifest } from "./gold-dataset.ts";

const SCRIPT_FILE = fileURLToPath(import.meta.url);

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function display(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") return "（缺失）";
  return value.replace(/[\\`*_{}\[\]()#|<>]/g, "\\$&").replaceAll("\r", " ").replaceAll("\n", " ");
}

function safeUrlLink(value: unknown): string {
  if (typeof value !== "string") return "（缺失）";
  try {
    const url = new URL(value);
    if (!(url.protocol === "https:" || url.protocol === "http:") || url.username || url.password) return "（URL不接受：仅允许无凭据的HTTP(S)链接）";
    return `<${url.href.replaceAll(">", "%3E")}>`;
  } catch {
    return "（URL不接受：仅允许无凭据的HTTP(S)链接）";
  }
}

export function renderReviewPacket(input: unknown): string {
  const validation = validateManifest(input);
  if (validation.status === "SCHEMA_ERROR") {
    const details = validation.issues.slice(0, 5).map((issue) => `${issue.path}: ${issue.code}`).join(", ");
    throw new Error(`manifest failed the existing Gold metadata validator${details ? ` (${details})` : ""}`);
  }
  if (!isRecord(input) || !Array.isArray(input.candidates)) throw new Error("validated manifest candidates are unavailable");

  const sections = input.candidates.map((raw: unknown, index: number) => {
    if (!isRecord(raw)) throw new Error(`candidates[${index}] must be an object`);
    const material = isRecord(raw.material) ? raw.material : {};
    const evidence = isRecord(raw.evidence) ? raw.evidence : {};
    const sourceFacts = isRecord(raw.sourceFacts) ? raw.sourceFacts : {};
    const sampling = isRecord(raw.samplingContext) ? raw.samplingContext : {};
    const bodyStatus = display(evidence.bodyStatus);
    const bodyReason = evidence.bodyUnavailableReason;
    const bodyHash = evidence.bodySha256;
    const observationHash = evidence.observationSha256;
    const bodyEvidence = bodyStatus === "ok"
      ? "状态为 `ok`；正文未复制到本packet。"
      : `状态为 **${bodyStatus}**；正文未复制到本packet。`;

    const evidenceRows = [
      ["文章身份", evidence.sourceArticleId ? display(evidence.sourceArticleId) : `诊断身份：${display(evidence.diagnosticId)}`],
      ["来源 ID / 类型", `${display(evidence.sourceId)} / ${display(sourceFacts.sourceKind)}`],
      ["原文 URL", safeUrlLink(evidence.url)],
      ["来源材料名称", display(material.sourceName)],
      ["发布日期", display(material.publishedAt)],
      ["正文状态", bodyEvidence],
      ["正文未就绪原因", bodyReason ? display(bodyReason) : "（无）"],
      ["正文 SHA-256", bodyHash ? display(bodyHash) : "（无）"],
      ["观察 SHA-256", observationHash ? display(observationHash) : "（无）"],
    ];
    return [
      `## ${index + 1}. ${display(raw.caseId)}`,
      "",
      `**标题：** ${display(material.title)}`,
      "",
      "| 核验字段 | 记录 |",
      "| --- | --- |",
      ...evidenceRows.map(([key, value]) => `| ${key} | ${value} |`),
      "",
      `**Gold decision（人工填写）：** [ ] select　[ ] reject　[ ] either`,
      "",
      "**标注理由（人工填写）：** ____________________________________________________________",
      "",
      "**标注人 / 确认人（人工填写）：** ______________________________",
      "",
      "**确认时间（人工填写）：** ______________________________",
      "",
      `**事件组：** [ ] 人工确认当前草稿 ${display(raw.eventGroupId)}　[ ] 修改为：____________________　[ ] 有证据的独立QA核验（manifest须记录reviewer/method/time/evidence SHA-256）`,
      "",
      `**数据集切分：** [ ] 人工确认development　[ ] 人工确认holdout　[ ] 按事件组确定性分配并独立QA（manifest须记录reviewer/method/time/evidence SHA-256）　当前草稿：${display(sampling.benchmarkSplit)}（未确认）`,
    ].join("\n");
  });

  return [
    "# P5 Gold 人工审阅 packet",
    "",
    "此文件只提供来源身份与正文状态证据，不包含原文全文，也不写入任何Gold答案。原清单含工具建议，但本packet不展示建议内容，请人工独立填写Gold decision。事件分组可由人工确认，或在同一真实事件有明确来源事实且留下可审计provenance时由agent独立核验；有歧义的保持needs_review。数据集切分可由人工确认，或在事件分组核验后按冻结的确定性规则整体分配并独立检查泄漏；留过偏好/seed的样本不得进入holdout。agent核验必须记录reviewer、method、verifiedAt和绑定证据的SHA-256，不得伪记为user_confirmed。正文引用不会写入packet；正文为hold/unavailable时不得按标题猜测标签。",
    "",
    `候选数：${input.candidates.length}　清单状态：DRAFT　validator：${validation.status}`,
    "",
    ...sections.flatMap((section: string, index: number) => index === 0 ? [section] : ["", "---", "", section]),
    "",
  ].join("\n");
}

function main(argv: string[]): number {
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
    console.log("Usage: node scripts/fiscal/gold-review-packet.ts <metadata-manifest.json> [--out review-packet.md]");
    return 0;
  }
  if (argv.length !== 1 && argv.length !== 3 || argv.length === 3 && argv[1] !== "--out") {
    console.error("Usage: node scripts/fiscal/gold-review-packet.ts <metadata-manifest.json> [--out review-packet.md]");
    return 2;
  }
  try {
    const manifestPath = path.resolve(argv[0]);
    const input = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
    const packet = renderReviewPacket(input);
    if (argv.length === 3) {
      const outputPath = path.resolve(argv[2]);
      const fd = openSync(outputPath, "wx");
      try { writeFileSync(fd, packet, { encoding: "utf8" }); }
      finally { closeSync(fd); }
    } else process.stdout.write(packet);
    return 0;
  } catch (error) {
    console.error(String(error));
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_FILE)) process.exitCode = main(process.argv.slice(2));
