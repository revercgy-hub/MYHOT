import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

/** Project frozen development material into a neutral human review packet. */
export function buildReviewPacket(prepared, caseIds, developmentCaseIds) {
  if (!Array.isArray(prepared.cases) || !Array.isArray(caseIds) || !caseIds.length || new Set(caseIds).size !== caseIds.length) throw Error("unique review case IDs required");
  if (!Array.isArray(developmentCaseIds) || caseIds.some(id => !developmentCaseIds.includes(id))) throw Error("review case is outside the explicit development scope");
  const byId = new Map();
  for (const row of prepared.cases) {
    if (byId.has(row.caseId)) throw Error("duplicate prepared case ID");
    byId.set(row.caseId, row);
  }
  const cases = caseIds.map((caseId, index) => {
    const row = byId.get(caseId);
    if (!row || typeof row.bodyText !== "string" || !row.bodyText.trim() || sha256(row.bodyText) !== row.bodySha256) throw Error("review body missing or hash mismatch");
    const url = new URL(row.url);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw Error("invalid review source URL");
    return { number: index + 1, caseId, title: row.title, sourceName: row.sourceName, publishedAt: row.publishedAt,
      url: row.url, bodySha256: row.bodySha256, bodyText: row.bodyText,
      humanAnnotation: { status: "needs_review", decision: null, reason: null } };
  });
  return { format: "fiscal.calibration-human-review/v1", purpose: "development-preference-reconfirmation-not-holdout",
    instructions: "逐篇阅读原文，判断进入精选、仅放全部动态或暂不能判断，并尽量说明理由。旧标签和模型预测不在本审阅包展示。回复只进入新审阅记录，不自动覆盖Gold或发布内容。",
    caseCount: cases.length, cases };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, ids, output, manifest] = process.argv.slice(2);
  if (!input || !ids || !output || !manifest) throw Error("usage: node scripts/fiscal/calibration-review-packet.mjs prepared.json id,id packet.json gold-manifest.json");
  const bytes = readFileSync(input);
  const manifestBytes = readFileSync(manifest);
  const developmentCaseIds = JSON.parse(manifestBytes).candidates.filter(row => row.samplingContext?.benchmarkSplit === "development").map(row => row.caseId);
  const result = { ...buildReviewPacket(JSON.parse(bytes), ids.split(","), developmentCaseIds), preparedFileSha256: sha256(bytes), developmentManifestSha256: sha256(manifestBytes) };
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ status: "NEEDS_HUMAN_REVIEW", caseCount: result.caseCount, outputSha256: sha256(readFileSync(output)) }));
}
