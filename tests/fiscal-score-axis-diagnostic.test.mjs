import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rubricWeights, reviewScoreAxes, scoreAxisDiagnosticPrompt } from '../scripts/fiscal/score-axis-diagnostic.mjs';

const prompt = fs.readFileSync(new URL('../industry/prompts/selection-score.md', import.meta.url), 'utf8');
const value = { itemType: 'local_practice', priorityClass: 'B', dimensions: { sig: 4, nov: 5, cred: 6, reson: 8, act: 7 }, attentionScore: 59 };

test('diagnostic recomputes in axis order and exposes arithmetic mismatch without selection', () => {
  const result = reviewScoreAxes(prompt, { ...value, dimensions: { act: 7, reson: 8, cred: 6, nov: 5, sig: 4 } });
  assert.equal(result.computedScore, 60);
  assert.equal(result.arithmeticMatches, false);
  assert.equal(reviewScoreAxes(prompt, { ...value, attentionScore: 60 }).arithmeticMatches, true);
  assert.equal('selected' in result, false);
  assert.equal('threshold' in result, false);
});

test('diagnostic rejects missing, duplicate, malformed and renormalized rubric rows', () => {
  assert.equal(Object.keys(rubricWeights(prompt)).length, 8);
  const row = prompt.split(/\r?\n/).find(line => line.startsWith('| local_practice |'));
  assert.throws(() => rubricWeights(prompt.replace(row, '')));
  assert.throws(() => rubricWeights(prompt + '\n' + row));
  assert.throws(() => rubricWeights(prompt.replace(row, row.replace(/2/, '3'))));
  assert.throws(() => rubricWeights(prompt.replace(row, row.replace(/2/, '2.0'))));
});

test('diagnostic schema rejects scale errors, extra explanations and labels', () => {
  for (const input of [
    { ...value, dimensions: { ...value.dimensions, sig: 40 } },
    { ...value, dimensions: { ...value.dimensions, sig: 4.5 } },
    { ...value, dimensions: { ...value.dimensions, explanation: 'x' } },
    { ...value, selected: true },
    { ...value, gold: 'select' },
    { ...value, itemType: 'unknown' },
  ]) assert.throws(() => reviewScoreAxes(prompt, input));
  assert.ok(scoreAxisDiagnosticPrompt(prompt).startsWith(prompt));
});
