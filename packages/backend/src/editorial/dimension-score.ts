import { z } from "zod";
import { ITEM_TYPES } from "./vocabulary.ts";

export const SCORE_AXES = ["sig", "nov", "cred", "reson", "act"] as const;
export const DimensionScoreSchema = z.object({
  itemType: z.enum(ITEM_TYPES),
  dimensions: z.object({
    sig: z.number().int().min(0).max(10), nov: z.number().int().min(0).max(10),
    cred: z.number().int().min(0).max(10), reson: z.number().int().min(0).max(10),
    act: z.number().int().min(0).max(10),
  }).strict(),
}).strict();
export type DimensionScore = z.infer<typeof DimensionScoreSchema>;
export type ScoreWeights = Record<DimensionScore["itemType"], readonly number[]>;

/** The industry rubric remains the only weight source. Fail before any model call on drift. */
export function readScoreWeights(prompt: string): ScoreWeights {
  const rows = new Map<string, number[]>();
  for (const line of prompt.split(/\r?\n/u)) {
    const cells = line.split("|").slice(1, -1).map(cell => cell.trim());
    if (!(ITEM_TYPES as readonly string[]).includes(cells[0] ?? "")) continue;
    if (rows.has(cells[0]!) || cells.length !== 6 || cells.slice(1).some(cell => !/^\d+$/u.test(cell))) throw new Error("Invalid score weight row");
    const values = cells.slice(1).map(Number);
    if (values.some(value => value > 10) || values.reduce((sum, value) => sum + value, 0) !== 10) throw new Error("Score weights must sum to ten");
    rows.set(cells[0]!, values);
  }
  if (rows.size !== ITEM_TYPES.length) throw new Error("Complete industry score weights required");
  const weights = {} as ScoreWeights;
  for (const type of ITEM_TYPES) weights[type] = rows.get(type)!;
  return weights;
}

/** No model-supplied total, normalization, floor, or threshold adjustment. */
export function dimensionAttentionScore(value: unknown, weights: ScoreWeights): number {
  const parsed = DimensionScoreSchema.parse(value);
  const row = weights[parsed.itemType];
  if (!row || row.length !== 5 || row.some(w => !Number.isInteger(w) || w < 0 || w > 10) || row.reduce((sum, w) => sum + w, 0) !== 10) throw new Error("Invalid score weights");
  return SCORE_AXES.reduce((sum, axis, index) => sum + parsed.dimensions[axis] * row[index]!, 0);
}

/** Development candidate only; remove the old output instructions instead of contradicting them. */
export function buildDimensionScorePrompt(prompt: string): string {
  readScoreWeights(prompt);
  const replacements = [
    ["你的任务不是做“精选/不精选”决策，而是把当前材料所代表的事件，对财政金融政策、监管和管理工作的注意力价值压缩成一个0–100的整数分数。", "你的任务不是做“精选/不精选”决策，而是按下述原有五轴评估当前材料所代表的事件。返回内容类型和五项0–10整数分数；加权总分由程序计算，不由你输出。"],
    ["不输出理由、分类、五轴、置信度或精选结论。最终只有一个分数。", "只输出内容类型和五项分数，不输出理由、置信度、加权总分或精选结论。"],
    ["## 内部计算步骤（只在心里完成，不要输出）", "## 评估步骤（仅返回内容类型和五项分数）"],
  ] as const;
  let result = prompt;
  for (const [before, after] of replacements) {
    if (result.split(before).length !== 2) throw new Error("Unsupported score prompt output contract");
    result = result.replace(before, after);
  }
  const finalMarker = "只返回合法JSON，不要Markdown，不要解释。顶层必须且只能包含`attentionScore`：";
  const parts = result.split(finalMarker);
  if (parts.length !== 2 || parts[1]!.trim() !== '{"attentionScore": 0}') throw new Error("Unsupported score prompt final contract");
  return parts[0] + '只返回合法JSON，不要Markdown，不要解释。顶层必须且只能包含itemType和dimensions；dimensions必须且只能包含sig、nov、cred、reson、act，各为0–10整数。itemType使用上述八类之一。不输出attentionScore，总分由程序按同一权重表计算。\n\n{"itemType":"local_practice","dimensions":{"sig":0,"nov":0,"cred":0,"reson":0,"act":0}}\n';
}
