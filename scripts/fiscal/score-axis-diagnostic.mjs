import { z } from 'zod';

const AXES = ['sig', 'nov', 'cred', 'reson', 'act'];
const TYPES = ['policy_release', 'regulatory_rule', 'fiscal_data', 'financial_data', 'debt_event', 'regulatory_action', 'local_practice', 'research_analysis'];

/** Development diagnostics only: no threshold, gold label, or selection decision. */
export const ScoreAxisDiagnosticSchema = z.object({
  itemType: z.enum(TYPES),
  priorityClass: z.enum(['A', 'B', 'C']),
  dimensions: z.object(Object.fromEntries(AXES.map(key => [key, z.number().int().min(0).max(10)]))).strict(),
  attentionScore: z.number().int().min(0).max(100),
}).strict();

/** Read the current rubric instead of maintaining a second weight table. */
export function rubricWeights(prompt) {
  const result = {};
  for (const line of prompt.split(/\r?\n/)) {
    const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
    if (!TYPES.includes(cells[0])) continue;
    if (result[cells[0]] || cells.length !== 6 || cells.slice(1).some(cell => !/^\d+$/.test(cell))) throw Error('invalid or duplicate rubric row');
    const values = cells.slice(1).map(Number);
    if (values.some(value => value > 10) || values.reduce((sum, value) => sum + value, 0) !== 10) throw Error('rubric weights must sum to ten');
    result[cells[0]] = values;
  }
  if (Object.keys(result).length !== TYPES.length) throw Error('complete eight-type rubric required');
  return result;
}

export function scoreAxisDiagnosticPrompt(prompt) {
  rubricWeights(prompt);
  return prompt + '\n\n开发隔离诊断：本次仅替换输出格式，保留上述评分规则。输出一个JSON对象，字段为itemType（上述八类之一）、priorityClass（A/B/C）、dimensions（sig、nov、cred、reson、act各0至10整数）、attentionScore（0至100整数加权总分）。不要输出解释、推理过程或精选结论。';
}

export function reviewScoreAxes(prompt, value) {
  const data = ScoreAxisDiagnosticSchema.parse(value);
  const weights = rubricWeights(prompt)[data.itemType];
  const computedScore = AXES.reduce((sum, key, index) => sum + data.dimensions[key] * weights[index], 0);
  return { scope: 'development-diagnostic-only', ...data, computedScore, arithmeticMatches: computedScore === data.attentionScore };
}
