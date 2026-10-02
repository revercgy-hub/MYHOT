import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertPrepareNotAttempted, assertPreparedManifest, boundedFetch, cellText, compareCell, invokeTesseract, LIMITS, normalizeCandidate, OCR_RUN_ENABLED, parseTsv, sha256 } from '../scripts/fiscal/ocr-scan-poc.ts';
import { execPath } from 'node:process';

let scratch: string;
test.beforeEach(async () => { scratch = await mkdtemp(join(tmpdir(), 'ocr-process-verification-')); });
test.afterEach(async () => { await rm(scratch, { recursive: true, force: true }); });

function fakeChild(code: string, childArgs: string[] = []): { command: string; args: string[] } {
  return { command: execPath, args: ['-e', code, ...childArgs] };
}
function fakeMonitor(code: string) {
  return (_pid: number, samplePath: string, softLimit: number) => [
    '-e', `process.stdout.write('READY\\n');process.stdin.once('data',data=>{process.argv.splice(1,0,String(data).trim());${code}});`, samplePath, String(softLimit),
  ];
}
const sampledMonitor = [
  "const fs=require('node:fs');const pid=Number(process.argv[1]);const path=process.argv[2];",
  "const poll=setInterval(()=>{try{process.kill(pid,0);const row={pid,at:new Date().toISOString(),workingSetBytes:1};fs.appendFileSync(path,JSON.stringify(row)+'\\n');process.stdout.write(JSON.stringify(row)+'\\n')}catch{clearInterval(poll);fs.appendFileSync(path,JSON.stringify({pid,waited:true,at:new Date().toISOString()})+'\\n')}},20);",
].join('');
function invocation(childCode: string, pageId: string, options: { monitorCode?: string; monitorReady?: boolean; budget?: any; elapsedBeforeMs?: number } = {}) {
  const outBase = join(scratch, pageId);
  const child = fakeChild(childCode, [outBase]);
  const runtimeLog: any = { pageId };
  return {
    runtimeLog,
    run: () => invokeTesseract(child.command, 'fake-image', outBase, 'fake-data', options.elapsedBeforeMs ?? 0, runtimeLog, {
      childArgs: child.args,
      samplePath: join(scratch, `${pageId}.jsonl`),
      ...(options.monitorCode ? { monitorCommand: execPath, monitorArgs: options.monitorReady === false ? (() => ['-e', options.monitorCode!]) : fakeMonitor(options.monitorCode) } : {}),
      budget: options.budget,
    }),
  };
}

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
  const license = Buffer.from('Apache License\nVersion 2.0, January 2004');
  const commit = '87416418657359cb625c412a48b6e1d6d41c29bd';
  const base = `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/${commit}`;
  const complete = {
    schemaVersion: 1, language: 'chi_sim', status: 'complete', trainedDataComplete: true, runnable: true, repository: 'tesseract-ocr/tessdata_fast', commit,
    modelUrl: `${base}/chi_sim.traineddata`, modelSha256: sha256(bytes), modelBytes: bytes.length,
    licenseUrl: `${base}/LICENSE`, licenseName: 'Apache-2.0', licenseSha256: sha256(license), licenseBytes: license.length,
  };
  assert.throws(() => assertPreparedManifest(complete), /missing/u);
  assert.throws(() => assertPreparedManifest(complete, Buffer.from('different bytes'), license), /changed/u);
  assert.throws(() => assertPreparedManifest(complete, bytes), /license text missing/u);
  assert.throws(() => assertPreparedManifest({ ...complete, commit: '0'.repeat(40) }, bytes, license), /approved repository commit/u);
  assert.throws(() => assertPreparedManifest({ ...complete, licenseUrl: `${base}/../LICENSE` }, bytes, license), /URLs are not pinned/u);
  assert.throws(() => assertPreparedManifest(complete, bytes, Buffer.from('unknown license')), /Apache-2.0/u);
  assert.doesNotThrow(() => assertPreparedManifest(complete, bytes, license));
});

test('official download helper enforces exact URL admission, one-shot request budget, redirect, timeout, byte cap, and EOF', async () => {
  const commit = '87416418657359cb625c412a48b6e1d6d41c29bd';
  const modelUrl = `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/${commit}/chi_sim.traineddata`;
  let calls = 0;
  const okFetch: typeof fetch = async () => { calls++; return new Response('ok', { status: 200 }); };
  await assert.rejects(boundedFetch('https://example.invalid/file', 10, [], okFetch), /allowlist/u);
  await assert.rejects(boundedFetch(modelUrl, LIMITS.modelBytes + 1, [], okFetch), /approved file limit/u);
  await assert.rejects(boundedFetch(modelUrl, 10, [{}, {}], okFetch), /budget exhausted/u);
  assert.equal(calls, 0);
  await assert.rejects(boundedFetch(modelUrl, 10, [{ url: modelUrl }], okFetch), /already attempted/u);
  const redirected: typeof fetch = async () => { calls++; return new Response(null, { status: 302, headers: { location: modelUrl } }); };
  await assert.rejects(boundedFetch(modelUrl, 10, [], redirected), /redirect rejected/u);
  const oversized: typeof fetch = async () => { calls++; return new Response('0123456789', { status: 200 }); };
  await assert.rejects(boundedFetch(modelUrl, 4, [], oversized), /exceeds 4 bytes/u);
  const shortEof: typeof fetch = async () => ({
    status: 200, headers: new Headers({ 'content-length': '5' }),
    body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('ab')); controller.close(); } }),
  } as Response);
  await assert.rejects(boundedFetch(modelUrl, 10, [], shortEof), /incomplete response/u);
  const timeoutFetch: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  await assert.rejects(boundedFetch(modelUrl, 10, [], timeoutFetch, Date.now() + 20), /aborted/u);
  const successfulLog: any[] = [];
  assert.equal((await boundedFetch(modelUrl, 10, successfulLog, okFetch)).toString(), 'ok');
  assert.equal(successfulLog[0].eofComplete, true);
  assert.equal(successfulLog[0].bytesReceived, 2);
  assert.equal(calls, 3);
});

test('prepare one-shot marker rejects a repeat attempt before any request', async () => {
  const marker = join(scratch, 'prepare-attempt.json');
  await writeFile(marker, '{"startedAt":"fixed"}', { flag: 'wx' });
  await assert.rejects(assertPrepareNotAttempted(scratch), /already attempted/u);
});

test('real Windows monitor observes the exact fake-child PID and records natural close/wait', async t => {
  const task = invocation("console.error(JSON.stringify({keys:Object.keys(process.env).sort(),env:process.env}));setTimeout(()=>{},180);", 'normal');
  await task.run();
  const rows = (await readFile(join(scratch, 'normal.jsonl'), 'utf8')).trim().split(/\r?\n/u).map(line => JSON.parse(line));
  assert.ok(Number.isInteger(task.runtimeLog.pid) && task.runtimeLog.pid > 0);
  assert.ok(rows.some(row => Number.isFinite(row.workingSetBytes)));
  assert.equal(rows.at(-1).waited, true);
  assert.equal(task.runtimeLog.closeObserved, true);
  assert.equal(task.runtimeLog.exitCode, 0);
  assert.ok(rows.some(row => Number.isFinite(row.workingSetBytes)));
  assert.ok(task.runtimeLog.monitorLastSampleToCloseMs >= 0);
  assert.ok(task.runtimeLog.monitorMaxGapMs <= 250, JSON.stringify(task.runtimeLog));
  t.diagnostic(`pid=${task.runtimeLog.pid} samples=${task.runtimeLog.monitorSamples} first_ms=${task.runtimeLog.monitorFirstSampleDelayMs} max_gap_ms=${task.runtimeLog.monitorMaxGapMs} final_ms=${task.runtimeLog.monitorLastSampleToCloseMs}`);
  const observed = JSON.parse(await readFile(join(scratch, 'normal.stderr'), 'utf8')) as { keys: string[]; env: Record<string, string> };
  const keys = observed.keys;
  const allowed = ['OMP_THREAD_LIMIT', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'PATH', 'HOMEDRIVE', 'HOMEPATH', 'LOGONSERVER', 'SYSTEMDRIVE', 'USERDOMAIN', 'USERNAME', 'USERPROFILE'];
  assert.ok(keys.every(key => allowed.includes(key)), keys.join(', '));
  assert.ok(keys.includes('OMP_THREAD_LIMIT'));
  for (const key of ['HOMEDRIVE', 'HOMEPATH', 'LOGONSERVER', 'SYSTEMDRIVE', 'USERDOMAIN', 'USERNAME', 'USERPROFILE']) assert.equal(observed.env[key], '');
});

test('deadline kills the fake child and waits for its close event under the real Windows monitor', async () => {
  const task = invocation('setInterval(() => {}, 1000);', 'deadline', { monitorCode: sampledMonitor, budget: { pageMs: 400, runMs: 1000 } });
  await assert.rejects(task.run(), /terminated: page deadline/u);
  const rows = (await readFile(join(scratch, 'deadline.jsonl'), 'utf8')).trim().split(/\r?\n/u).map(line => JSON.parse(line));
  assert.equal(task.runtimeLog.killed, true);
  assert.equal(task.runtimeLog.killReason, 'page deadline');
  assert.equal(task.runtimeLog.closeObserved, true);
  assert.ok(task.runtimeLog.signal);
  assert.equal(rows.at(-1).waited, true);
});

test('total experiment deadline also kills and waits for the fake child', async () => {
  const task = invocation('setInterval(() => {}, 1000);', 'total-deadline', { monitorCode: sampledMonitor, budget: { pageMs: 5000, runMs: 450 }, elapsedBeforeMs: 0 });
  await assert.rejects(task.run(), /terminated: total deadline/u);
  assert.equal(task.runtimeLog.killReason, 'total deadline');
  assert.equal(task.runtimeLog.closeObserved, true);
  assert.ok(task.runtimeLog.signal);
});

test('output over limit terminates the exact child and is also checked after close', async () => {
  const task = invocation("console.error('x'.repeat(8192));setInterval(()=>{},1000);", 'output', { monitorCode: sampledMonitor, budget: { pageMs: 5000, runMs: 6000, pageOutputBytes: 1024 } });
  await assert.rejects(task.run(), /terminated: combined page output limit/u);
  assert.equal(task.runtimeLog.killed, true);
  assert.equal(task.runtimeLog.closeObserved, true);
  assert.ok(task.runtimeLog.signal);
  const file = await stat(join(scratch, 'output.stderr'));
  assert.ok(file.size > 1024);
});

test('text and TSV output files count together toward the page output cap', async () => {
  const code = "const fs=require('node:fs');const p=process.argv[1];setTimeout(()=>{fs.writeFileSync(p+'.txt','t'.repeat(600));fs.writeFileSync(p+'.tsv','v'.repeat(600))},60);setInterval(()=>{},1000);";
  const task = invocation(code, 'file-output', { monitorCode: sampledMonitor, budget: { pageMs: 5000, runMs: 6000, pageOutputBytes: 1024 } });
  await assert.rejects(task.run(), /terminated: combined page output limit/u);
  assert.equal(task.runtimeLog.closeObserved, true);
  assert.ok(task.runtimeLog.signal);
  const [txt, tsv] = await Promise.all([stat(join(scratch, 'file-output.txt')), stat(join(scratch, 'file-output.tsv'))]);
  assert.ok(txt.size + tsv.size > 1024);
});

test('monitor early exit, failure, and no samples all fail closed and wait for child termination', async t => {
  const cases = [
    { name: 'early exit', code: 'process.exit(0);', error: /no samples/u },
    { name: 'monitor failure', code: 'process.exit(7);', error: /resource monitor failed: exit 7/u },
    { name: 'no samples', code: "require('node:fs').writeFileSync(process.argv[2], JSON.stringify({waited:true})+'\\n');", error: /no samples/u },
  ];
  for (const item of cases) await t.test(item.name, async () => {
    const task = invocation('setInterval(() => {}, 1000);', item.name.replaceAll(' ', '-'), { monitorCode: item.code, budget: { pageMs: 5000, runMs: 6000 } });
    await assert.rejects(task.run(), item.error);
    assert.equal(task.runtimeLog.killed, true);
    assert.equal(task.runtimeLog.closeObserved, true);
    assert.ok(task.runtimeLog.signal);
  });
});

test('monitor startup must reach READY before the child is spawned', async () => {
  const task = invocation('process.exit(0);', 'monitor-startup', { monitorCode: 'process.exit(9);', monitorReady: false, budget: { pageMs: 5000, runMs: 6000 } });
  await assert.rejects(task.run(), /resource monitor startup failed/u);
  assert.equal(task.runtimeLog.pid, undefined);
});

test('injected low soft working-set line records actual PID kill and wait', async () => {
  const monitor = [
    "const fs=require('node:fs');const pid=Number(process.argv[1]);const path=process.argv[2];const soft=Number(process.argv[3]);",
    "const at=new Date().toISOString();const sample={pid,at,workingSetBytes:soft+1};fs.appendFileSync(path,JSON.stringify(sample)+'\\n');process.stdout.write(JSON.stringify(sample)+'\\n');",
    "try{process.kill(pid)}catch{}",
    "const poll=setInterval(()=>{try{process.kill(pid,0)}catch{clearInterval(poll);const done=new Date().toISOString();fs.appendFileSync(path,JSON.stringify({pid,kill:'single-process',reason:'working-set-soft-line',waited:true,at:done})+'\\n');fs.appendFileSync(path,JSON.stringify({pid,waited:true,at:done})+'\\n');}},10);",
  ].join('');
  const task = invocation('setInterval(() => {}, 1000);', 'soft-stop', { monitorCode: monitor, budget: { pageMs: 5000, runMs: 6000, workingSetSoftBytes: 0 } });
  await assert.rejects(task.run(), /terminated: working-set-soft-line/u);
  const rows = (await readFile(join(scratch, 'soft-stop.jsonl'), 'utf8')).trim().split(/\r?\n/u).map(line => JSON.parse(line));
  assert.equal(rows[0].workingSetBytes, 1);
  assert.equal(rows.at(-1).waited, true);
  assert.equal(task.runtimeLog.pid > 0, true);
  assert.equal(task.runtimeLog.killReason, 'working-set-soft-line');
  assert.equal(task.runtimeLog.closeObserved, true);
});
