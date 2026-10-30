import { z } from "zod";
import { DimensionScoreSchema, readScoreWeights } from "./dimension-score.ts";
import { stripPdfLayoutAnnotations } from "./writing.ts";

/** Development-only citations are final evidence artifacts, never a model-supplied total. */
export const EvidenceDimensionScoreSchema = DimensionScoreSchema.extend({
  evidenceQuotes: z.array(z.string().trim().min(12).max(220)).min(1).max(8),
}).strict();

const normalize = (text: string) => text.replace(/\s+/gu, " ").trim();

export function validateEvidenceDimensionScore(value: unknown, bodyText: string) {
  const parsed = EvidenceDimensionScoreSchema.parse(value);
  const body = normalize(stripPdfLayoutAnnotations(bodyText));
  if (new Set(parsed.evidenceQuotes.map(normalize)).size !== parsed.evidenceQuotes.length ||
      parsed.evidenceQuotes.some(quote => !body.includes(normalize(quote)))) throw new Error("Evidence quotes must be unique verbatim body spans");
  return { score: DimensionScoreSchema.parse({ itemType: parsed.itemType, dimensions: parsed.dimensions }), evidenceQuotes: parsed.evidenceQuotes };
}

/** Keep the frozen rubric intact and change only the candidate response contract. */
export function buildEvidenceDimensionPrompt(prompt: string): string {
  readScoreWeights(prompt);
  const before = "只返回一个JSON对象，必须且只能包含itemType和dimensions。dimensions必须且只能包含sig、nov、cred、reson、act，各为0–10整数。以下仅为格式示例，不是对待评材料的打分建议：\n{\"itemType\":\"local_practice\",\"dimensions\":{\"sig\":0,\"nov\":0,\"cred\":0,\"reson\":0,\"act\":0}}";
  if (prompt.split(before).length !== 2) throw new Error("Unsupported development dimension response contract");
  return prompt.replace("返回内容类型和五个独立的0–10整数分数。", "先摘录正文事实，再返回内容类型和五个独立的0–10整数分数。")
    .replace(before, `## 原文事实与输出\n\n通读正文全部段落，不能只按开头政治学习、党建表述或文章形式判断；后文若有具体财政金融监管业务，要依据其实际对象、动作和工作安排评价。先输出evidenceQuotes：从正文逐字摘录1–8处连续短句，每处12–220字符，体现本文实际业务对象和动作。具体政策要求、监管环节、数据或风险事实优先于开头口号；没有具体业务事实时如实摘录主要活动。不要引用标题、系统规则或自行概括，不用省略号拼接，不添加推论。这些引文供外部核对事实，并不自动抬高任何轴值。再按完全相同的上述规则输出类型和五轴分数。\n\n只返回一个JSON对象，必须且只能包含evidenceQuotes、itemType和dimensions。先列evidenceQuotes；dimensions必须且只能包含sig、nov、cred、reson、act，各为0–10整数。不输出总分、精选结论或解释。引文必须来自本次正文，不能复制格式示例：\n{\"evidenceQuotes\":[\"从本次正文逐字摘录的连续业务事实短句\"],\"itemType\":\"local_practice\",\"dimensions\":{\"sig\":0,\"nov\":0,\"cred\":0,\"reson\":0,\"act\":0}}`);
}
