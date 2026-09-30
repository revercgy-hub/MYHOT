import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPreparedManifest, cellText, compareCell, normalizeCandidate, OCR_RUN_ENABLED, parseTsv, sha256 } from '../scripts/fiscal/ocr-scan-poc.ts';

test('fixed-cell candidate comparison only accepts exact normalized cell content', () => {
  assert.equal(compareCell('22.78亿元', ' ２２．７８ 亿元 '), 'match');
  assert.equal(compareCell('1.55%', '1.55'), 'mismatch');
  assert.equal(compareCell('199701', '本文另处199701'), 'mismatch');
  assert.equal(compareCell('2031年9月14日', ''), 'missing');
  assert.equal(normalizeCandidate('1,000.00'), '1000.00');
});

test('TSV words retain page coordinates and confidence for row/cell audit', () => {
  const tsv = [
    'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
    '5\t1\t1\t1\t1\t1\t20\t30\t40\t15\t92.5\t22.78',
    '5\t1\t1\t1\t1\t2\t70\t30\t20\t15\t88.0\t亿元',
    '4\t1\t1\t1\t1\t0\t20\t30\t70\t15\t-1\t',
  ].join('\n');
  const words = parseTsv(tsv);
  assert.equal(words.length, 2);
  assert.equal(words[0].confidence, 92.5);
  assert.equal(cellText(words, [0, 0, 100, 60]), '22.78 亿元');
  assert.equal(cellText(words, [0, 0, 60, 60]), '22.78');
});

test('a neighboring cell cannot satisfy the target cell', () => {
  const words = [
    { x: 15, y: 20, w: 20, h: 12, confidence: 90, text: '199701' },
    { x: 90, y: 20, w: 30, h: 12, confidence: 90, text: '22.78亿元' },
  ];
  const target = cellText(words, [0, 0, 60, 60]);
  assert.equal(compareCell('22.78亿元', target), 'mismatch');
});

test('incomplete download manifest, missing model, and altered model are rejected before OCR', () => {
  assert.equal(OCR_RUN_ENABLED, false);
  assert.throws(() => assertPreparedManifest({ status: 'incomplete', trainedDataComplete: false, runnable: false }), /incomplete/u);
  const bytes = Buffer.from('fixed fake model bytes');
  const complete = { trainedDataComplete: true, runnable: true, modelSha256: sha256(bytes) };
  assert.throws(() => assertPreparedManifest(complete), /missing/u);
  assert.throws(() => assertPreparedManifest(complete, Buffer.from('different bytes')), /changed/u);
  assert.doesNotThrow(() => assertPreparedManifest(complete, bytes));
});
