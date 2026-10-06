import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { execPath } from 'node:process';
import { assertCandidateTextLimit, buildSinglePageCandidates, OFFLINE_XIAMEN_OCR_ENABLED, SINGLE_PAGE_PROFILE } from '../scripts/fiscal/offline-xiamen-ocr.ts';

test('single-page OCR profile is fixed and monitor output stays inside its dedicated ignored target', async () => {
  assert.equal(OFFLINE_XIAMEN_OCR_ENABLED, false);
  assert.match(SINGLE_PAGE_PROFILE.inputPath, /\.data[\\/]fiscal-qa[\\/]xiamen-debt-round16-page\.png$/u);
  assert.match(SINGLE_PAGE_PROFILE.outputDirectory, /\.data[\\/]fiscal-qa[\\/]offline-ocr-xiamen-20261006$/u);
  assert.equal(SINGLE_PAGE_PROFILE.monitorFile, join(SINGLE_PAGE_PROFILE.outputDirectory, 'monitor-xiamen-1.jsonl'));
  assert.equal(SINGLE_PAGE_PROFILE.inputSha256, 'B4F300D8F3C768FD4B7F30411ACA9E2CAA9AEC2155532F7586AA13543816794D');
  assert.equal(SINGLE_PAGE_PROFILE.modelSha256, 'A5FCB6F0DB1E1D6D8522F39DB4E848F05984669172E584E8D76B6B3141E1F730');
  assert.equal(SINGLE_PAGE_PROFILE.licenseSha256, 'CFC7749B96F63BD31C3C42B5C471BF756814053E847C10F3EB003417BC523D30');
  await assert.rejects(stat(SINGLE_PAGE_PROFILE.outputDirectory), { code: 'ENOENT' });
});

test('candidate export compares fixed references against independent raw cell candidates', () => {
  const tsv = [
    'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
    '5\t1\t1\t1\t1\t1\t400\t940\t80\t20\t90\t22.78亿元',
    '5\t1\t1\t1\t1\t2\t1000\t1020\t40\t20\t85\t9.9%',
  ].join('\n');
  const result = buildSinglePageCandidates(tsv);
  assert.equal(result.fields.length, 14);
  assert.ok(result.fields.every(field => field.page === 1 && field.expectedReference));
  assert.equal(result.fields.find(field => field.field === 'planned_issue_size')?.candidate, '22.78亿元');
  assert.equal(result.fields.find(field => field.field === 'planned_issue_size')?.status, 'match');
  assert.equal(result.fields.find(field => field.field === 'planned_issue_size')?.missing, false);
  assert.equal(result.fields.find(field => field.field === 'planned_issue_size')?.mismatch, false);
  assert.equal(result.fields.find(field => field.field === 'coupon_rate')?.candidate, '9.9%');
  assert.equal(result.fields.find(field => field.field === 'coupon_rate')?.status, 'mismatch');
  assert.equal(result.fields.find(field => field.field === 'coupon_rate')?.mismatch, true);
  assert.equal(result.fields.find(field => field.field === 'publisher')?.status, 'missing');
  assert.equal(result.fields.find(field => field.field === 'publisher')?.mismatch, null);
  assert.equal(result.fields.find(field => field.field === 'maturity_if_redeemed')?.candidate, null);
  assert.equal(result.fields.find(field => field.field === 'maturity_if_redeemed')?.status, 'missing');
  assert.equal(result.sourceBoxCandidates.length, 10);
  assert.ok(result.sourceBoxCandidates.some(field => field.field === 'conditional_maturity_dates'));
  assert.ok(result.fields.every(field => !('gold' in field)));
});

test('120,000 character text cap rejects over-limit content without truncating', () => {
  assert.doesNotThrow(() => assertCandidateTextLimit('x'.repeat(120_000)));
  assert.throws(() => assertCandidateTextLimit('x'.repeat(120_001)), /120,000 characters/u);
});

test('default single-page CLI exits at its closed permit without creating the real OCR output directory', async () => {
  const script = join(process.cwd(), 'scripts/fiscal/offline-xiamen-ocr.ts');
  const result = spawnSync(execPath, [script], { cwd: process.cwd(), encoding: 'utf8', timeout: 5_000, windowsHide: true });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /single-page OCR permit is closed/u);
  await assert.rejects(stat(SINGLE_PAGE_PROFILE.outputDirectory), { code: 'ENOENT' });
});
