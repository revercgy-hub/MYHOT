import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertPrepareNotAttempted, assertPreparedManifest, cellText, compareCell, decodeCanonicalBase64, gitBlobSha1, invokeTesseract, LIMITS, normalizeCandidate, OCR_RUN_ENABLED, parsePinnedRootDirectory, parseTsv, prepareForOfflineTest, sha256 } from '../scripts/fiscal/ocr-scan-poc.ts';
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
  "const sample=()=>{const row={pid,at:new Date().toISOString(),workingSetBytes:1};fs.appendFileSync(path,JSON.stringify(row)+'\\n');process.stdout.write(JSON.stringify(row)+'\\n')};sample();",
  "const poll=setInterval(()=>{try{process.kill(pid,0);sample()}catch{clearInterval(poll);fs.appendFileSync(path,JSON.stringify({pid,exitCode:null,waited:true,at:new Date().toISOString()})+'\\n')}},20);",
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
  const f = fixture(); const complete = manifestForFixture(f);
  assert.throws(() => assertPreparedManifest(complete), /missing/u);
  assert.throws(() => assertPreparedManifest(complete, Buffer.from('different bytes'), f.license), /missing, changed/u);
  assert.throws(() => assertPreparedManifest(complete, f.model, Buffer.from('unknown license')), /SHA|Apache/u);
  assert.throws(() => assertPreparedManifest({ ...complete, commit: '0'.repeat(40) }, f.model, f.license), /GitHub API profile/u);
  assert.throws(() => assertPreparedManifest({ ...complete, rootUrl: `${ROOT_URL}&evil=1` }, f.model, f.license), /GitHub API profile/u);
  assert.throws(() => assertPreparedManifest({ ...complete, files: { ...complete.files, model: { ...complete.files.model, url: 'https://untrusted.invalid/blob' } } }, f.model, f.license), /model API blob identity/u);
  assert.doesNotThrow(() => assertPreparedManifest(complete, f.model, f.license));
});

const PIN = '87416418657359cb625c412a48b6e1d6d41c29bd';
const API = 'https://api.github.com/repos/tesseract-ocr/tessdata_fast';
const ROOT_URL = `${API}/contents?ref=${PIN}`;
const LICENSE_BYTES = Buffer.from('Apache License\nVersion 2.0, January 2004\n');

function blobEntry(name: string, bytes: Buffer, overrides: Record<string, unknown> = {}) {
  return { name, path: name, type: 'file', sha: gitBlobSha1(bytes), size: bytes.length, download_url: 'https://untrusted.invalid/never-fetch', git_url: 'https://untrusted.invalid/never-fetch', ...overrides };
}
function fixture(model = Buffer.from('mock chi_sim model bytes'), license = LICENSE_BYTES, changes: { entries?: any[]; modelObject?: any; licenseObject?: any } = {}) {
  const modelEntry = blobEntry('chi_sim.traineddata', model);
  const licenseEntry = blobEntry('LICENSE', license);
  const entries = changes.entries ?? [modelEntry, licenseEntry];
  const modelUrl = `${API}/git/blobs/${modelEntry.sha}`;
  const licenseUrl = `${API}/git/blobs/${licenseEntry.sha}`;
  const makeBlob = (bytes: Buffer, entry: any, override?: any) => Buffer.from(JSON.stringify({ encoding: 'base64', size: entry.size, sha: entry.sha, content: bytes.toString('base64'), url: 'https://untrusted.invalid/never-fetch', ...override }));
  const bodies = new Map<string, Buffer>([
    [ROOT_URL, Buffer.from(JSON.stringify(entries))],
    [modelUrl, makeBlob(model, modelEntry, changes.modelObject)],
    [licenseUrl, makeBlob(license, licenseEntry, changes.licenseObject)],
  ]);
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (init?.redirect !== 'manual') throw new Error('redirect mode not manual');
    const bytes = bodies.get(url);
    if (!bytes) throw new Error(`unexpected URL ${url}`);
    return new Response(bytes, { status: 200, headers: { 'content-length': String(bytes.length) } });
  };
  return { model, license, modelEntry, licenseEntry, modelUrl, licenseUrl, rootBytes: bodies.get(ROOT_URL)!, bodies, fetchImpl };
}

function testOutput(name: string) {
  const workspace = join(scratch, name);
  return { workspace, outDir: join(workspace, '.data/fiscal-qa/scan-ocr-poc-20261003') };
}

function manifestForFixture(f: ReturnType<typeof fixture>) {
  return {
    schemaVersion: 1, status: 'complete', trainedDataComplete: true, runnable: true, language: 'chi_sim',
    repository: 'tesseract-ocr/tessdata_fast', commit: PIN, transport: 'github-rest-git-blob-v1', rootUrl: ROOT_URL,
    rootEntries: { model: { path: f.modelEntry.path, sha: f.modelEntry.sha, size: f.modelEntry.size }, license: { path: f.licenseEntry.path, sha: f.licenseEntry.sha, size: f.licenseEntry.size } },
    files: {
      model: { path: 'chi_sim.traineddata', blobSha: f.modelEntry.sha, size: f.model.length, url: f.modelUrl, sha256: sha256(f.model) },
      license: { path: 'LICENSE', blobSha: f.licenseEntry.sha, size: f.license.length, url: f.licenseUrl, sha256: sha256(f.license) },
    },
    modelSha256: sha256(f.model), modelBytes: f.model.length, licenseSha256: sha256(f.license), licenseBytes: f.license.length,
    licenseName: 'Apache-2.0', requests: [ROOT_URL, f.modelUrl, f.licenseUrl].map(url => ({ url, status: 200, eofComplete: true, bytesReceived: f.bodies.get(url)!.length, contentLength: f.bodies.get(url)!.length })),
  };
}

test('Git blob SHA1 uses a NUL byte in the Git object header', () => {
  assert.equal(gitBlobSha1(Buffer.from('test content')), '08cf6101416f0ce0dda3c80e627f333854c4085c');
});

test('pinned root parser requires unique exact regular-file identities and bounded sizes', () => {
  const f = fixture();
  assert.deepEqual(parsePinnedRootDirectory(f.rootBytes), {
    model: { path: 'chi_sim.traineddata', sha: f.modelEntry.sha, size: f.model.length },
    license: { path: 'LICENSE', sha: f.licenseEntry.sha, size: f.license.length },
  });
  const entries = JSON.parse(f.rootBytes.toString());
  for (const invalid of [
    [entries[0], { ...entries[1], name: 'LICENSE-OLD' }],
    [entries[0], entries[1], entries[0]],
    [{ ...entries[0], type: 'dir' }, entries[1]],
    [{ ...entries[0], path: '../chi_sim.traineddata' }, entries[1]],
    [{ ...entries[0], sha: '1'.repeat(39) }, entries[1]],
    [{ ...entries[0], size: LIMITS.modelBytes + 1 }, entries[1]],
  ]) assert.throws(() => parsePinnedRootDirectory(Buffer.from(JSON.stringify(invalid))));
  assert.throws(() => parsePinnedRootDirectory(Buffer.alloc(LIMITS.metadataBytes + 1)), /exceeds 1 MiB/u);
  assert.throws(() => parsePinnedRootDirectory(Buffer.from('{broken')), /JSON is invalid/u);
});

test('GitHub Base64 accepts canonical content and quartet-wrapped LF/CRLF only', () => {
  const bytes = Buffer.from('0123456789abcdef');
  const encoded = bytes.toString('base64');
  assert.deepEqual(decodeCanonicalBase64(encoded, bytes.length), bytes);
  assert.deepEqual(decodeCanonicalBase64(`${encoded.slice(0, 8)}\n${encoded.slice(8)}`, bytes.length), bytes);
  assert.deepEqual(decodeCanonicalBase64(`${encoded.slice(0, 8)}\r\n${encoded.slice(8)}\r\n`, bytes.length), bytes);
  for (const bad of [` ${encoded}`, `${encoded}=`, `${encoded.slice(0, 6)}\n${encoded.slice(6)}`, `${encoded}\n\n`, encoded.replace(/[A-Za-z0-9+/]/u, '!')]) {
    assert.throws(() => decodeCanonicalBase64(bad, bytes.length));
  }
  assert.throws(() => decodeCanonicalBase64(encoded, bytes.length + 1), /wrong size/u);
});

test('fixed API prepare uses exactly root plus the two SHA-derived blob URLs and commits complete files last', async () => {
  const f = fixture(); const output = testOutput('api-success'); const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => { calls.push(String(input)); return f.fetchImpl(input, init); };
  await prepareForOfflineTest(output.workspace, output.outDir, fetchImpl, { requestMs: 1000, prepareMs: 5000 });
  assert.deepEqual(calls, [ROOT_URL, f.modelUrl, f.licenseUrl]);
  assert.ok(calls.every(url => url.startsWith(`${API}/`)));
  assert.ok(!calls.some(url => url.includes('untrusted.invalid')));
  const manifest = JSON.parse(await readFile(join(output.outDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.status, 'complete');
  assert.equal(manifest.runnable, true);
  assert.equal(manifest.transport, 'github-rest-git-blob-v1');
  assert.equal(manifest.commit, PIN);
  assert.equal(manifest.files.model.blobSha, f.modelEntry.sha);
  assert.equal(manifest.files.license.blobSha, f.licenseEntry.sha);
  assert.equal(manifest.files.model.sha256, sha256(f.model));
  assert.equal(manifest.files.license.sha256, sha256(f.license));
  assert.equal(manifest.requests.length, 3);
  assert.ok(manifest.requests.every((entry: any) => entry.eofComplete && entry.bytesReceived === entry.contentLength));
  assert.deepEqual(await readFile(join(output.outDir, 'tessdata/chi_sim.traineddata')), f.model);
  assert.deepEqual(await readFile(join(output.outDir, 'LICENSE')), f.license);
  assert.doesNotThrow(() => assertPreparedManifest(manifest, f.model, f.license));
  assert.throws(() => assertPreparedManifest({ ...manifest, transport: 'raw-url-v0' }, f.model, f.license), /GitHub API profile/u);
});

test('pinned API aborts after invalid root metadata without requesting either blob', async () => {
  const f = fixture(); const output = testOutput('bad-root'); const calls: string[] = [];
  const entries = JSON.parse(f.rootBytes.toString()); entries[0].path = '../chi_sim.traineddata';
  const fetchImpl: typeof fetch = async input => { calls.push(String(input)); return new Response(JSON.stringify(entries), { status: 200 }); };
  await assert.rejects(prepareForOfflineTest(output.workspace, output.outDir, fetchImpl, { requestMs: 1000, prepareMs: 5000 }));
  assert.deepEqual(calls, [ROOT_URL]);
  const failure = JSON.parse(await readFile(join(output.outDir, 'prepare-failure.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(join(output.outDir, 'manifest.json'), 'utf8'));
  assert.equal(failure.requests.length, 1);
  assert.equal(failure.requests[0].error.message, 'pinned directory entry invalid for chi_sim.traineddata');
  assert.equal(manifest.runnable, false);
  await assert.rejects(stat(join(output.outDir, 'tessdata/chi_sim.traineddata')));
});

test('blob JSON identity, size, encoding, Base64, and Git SHA failures stop before complete files', async t => {
  const variants = [
    { name: 'wrong model sha', change: (f: ReturnType<typeof fixture>) => fixture(f.model, f.license, { modelObject: { sha: '0'.repeat(40) } }) },
    { name: 'wrong model size', change: (f: ReturnType<typeof fixture>) => fixture(f.model, f.license, { modelObject: { size: f.model.length + 1 } }) },
    { name: 'wrong encoding', change: (f: ReturnType<typeof fixture>) => fixture(f.model, f.license, { modelObject: { encoding: 'utf8' } }) },
    { name: 'invalid base64', change: (f: ReturnType<typeof fixture>) => fixture(f.model, f.license, { modelObject: { content: '%%%=' } }) },
    { name: 'content hash mismatch', change: (f: ReturnType<typeof fixture>) => fixture(f.model, f.license, { modelObject: { content: Buffer.from('X'.repeat(f.model.length)).toString('base64') } }) },
  ];
  for (const item of variants) await t.test(item.name, async () => {
    const f = item.change(fixture()); const output = testOutput(item.name.replaceAll(' ', '-')); const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => { calls.push(String(input)); return f.fetchImpl(input, init); };
    await assert.rejects(prepareForOfflineTest(output.workspace, output.outDir, fetchImpl, { requestMs: 1000, prepareMs: 5000 }));
    assert.equal(calls.length, 2);
    assert.equal(calls[0], ROOT_URL);
    assert.equal(calls[1], f.modelUrl);
    const manifest = JSON.parse(await readFile(join(output.outDir, 'manifest.json'), 'utf8'));
    assert.equal(manifest.runnable, false);
    await assert.rejects(stat(join(output.outDir, 'tessdata/chi_sim.traineddata')));
    await assert.rejects(stat(join(output.outDir, 'LICENSE')));
  });
});

test('redirect, stream truncation, stream error, and encoded cap fail closed', async t => {
  const cases: Array<{ name: string; response: (url: string) => Response }> = [
    { name: 'redirect', response: () => new Response(null, { status: 302, headers: { location: `${API}/git/blobs/${'a'.repeat(40)}` } }) },
    { name: 'content-length truncation', response: () => new Response(Buffer.from('[]'), { status: 200, headers: { 'content-length': '999' } }) },
    { name: 'stream error', response: () => new Response(new ReadableStream({ start(controller) { controller.error(Object.assign(new Error('socket ended at 192.168.4.2:1234'), { code: 'ECONNRESET' })); } }), { status: 200 }) },
    { name: 'encoded cap', response: () => new Response(Buffer.from(JSON.stringify([]) + ' '.repeat(LIMITS.metadataBytes)), { status: 200 }) },
  ];
  for (const item of cases) await t.test(item.name, async () => {
    const output = testOutput(item.name.replaceAll(' ', '-')); let calls = 0;
    const fetchImpl: typeof fetch = async (_input, init) => { calls++; assert.equal(init?.redirect, 'manual'); return item.response(String(_input)); };
    await assert.rejects(prepareForOfflineTest(output.workspace, output.outDir, fetchImpl, { requestMs: 1000, prepareMs: 5000 }));
    assert.equal(calls, 1);
    const failure = JSON.parse(await readFile(join(output.outDir, 'prepare-failure.json'), 'utf8'));
    const rendered = JSON.stringify(failure);
    assert.ok(!rendered.includes('192.168.4.2'));
    assert.ok(!rendered.includes('untrusted.invalid'));
    if (item.name === 'stream error') assert.equal(failure.requests[0].error.code, 'ECONNRESET');
    assert.equal(JSON.parse(await readFile(join(output.outDir, 'manifest.json'), 'utf8')).runnable, false);
  });
});

test('license content is verified before any file can be committed runnable', async () => {
  const badLicense = Buffer.from('not the approved license'); const f = fixture(Buffer.from('model'), badLicense); const output = testOutput('bad-license');
  await assert.rejects(prepareForOfflineTest(output.workspace, output.outDir, f.fetchImpl, { requestMs: 1000, prepareMs: 5000 }), /not Apache-2.0/u);
  assert.equal(JSON.parse(await readFile(join(output.outDir, 'manifest.json'), 'utf8')).runnable, false);
  await assert.rejects(stat(join(output.outDir, 'tessdata/chi_sim.traineddata')));
  await assert.rejects(stat(join(output.outDir, 'LICENSE')));
});

test('deadline abort, one-shot reuse, and out-of-scope path never admit extra requests', async () => {
  const output = testOutput('one-shot'); const f = fixture(); let calls = 0;
  const fetchImpl: typeof fetch = async (input, init) => { calls++; return f.fetchImpl(input, init); };
  await prepareForOfflineTest(output.workspace, output.outDir, fetchImpl, { requestMs: 1000, prepareMs: 5000 });
  await assert.rejects(prepareForOfflineTest(output.workspace, output.outDir, fetchImpl, { requestMs: 1000, prepareMs: 5000 }), /already attempted/u);
  assert.equal(calls, 3);
  await assert.rejects(prepareForOfflineTest(output.workspace, join(output.workspace, 'outside'), fetchImpl, { requestMs: 1000, prepareMs: 5000 }), /outside the fixed/u);
  assert.equal(calls, 3);

  const deadline = testOutput('deadline'); let abortCalls = 0;
  const abortFetch: typeof fetch = async (_input, init) => {
    abortCalls++;
    return new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true }));
  };
  await assert.rejects(prepareForOfflineTest(deadline.workspace, deadline.outDir, abortFetch, { requestMs: 20, prepareMs: 1000 }));
  assert.equal(abortCalls, 1);
  const failure = JSON.parse(await readFile(join(deadline.outDir, 'prepare-failure.json'), 'utf8'));
  assert.equal(failure.requests.length, 1);
  assert.equal(failure.requests[0].error.name, 'AbortError');

  const total = testOutput('total-deadline'); let totalCalls = 0;
  const slowFirstResponse: typeof fetch = async () => {
    totalCalls++;
    await new Promise(resolve => setTimeout(resolve, 35));
    return new Response(f.rootBytes, { status: 200 });
  };
  await assert.rejects(prepareForOfflineTest(total.workspace, total.outDir, slowFirstResponse, { requestMs: 500, prepareMs: 20 }), /deadline exhausted/u);
  assert.equal(totalCalls, 1);
  const totalFailure = JSON.parse(await readFile(join(total.outDir, 'prepare-failure.json'), 'utf8'));
  assert.equal(totalFailure.requests.length, 1);
  assert.equal(totalFailure.manifest, undefined);
  assert.equal(JSON.parse(await readFile(join(total.outDir, 'manifest.json'), 'utf8')).runnable, false);
});

test('prepare one-shot marker rejects a repeat attempt before any request', async () => {
  const marker = join(scratch, 'prepare-attempt.json');
  await writeFile(marker, '{"startedAt":"fixed"}', { flag: 'wx' });
  await assert.rejects(assertPrepareNotAttempted(scratch), /already attempted/u);
});

test('real Windows monitor observes the exact fake-child PID and records natural close/wait', { skip: process.platform !== 'win32' }, async t => {
  const task = invocation("console.error(JSON.stringify({keys:Object.keys(process.env).sort(),env:process.env}));setTimeout(()=>{},180);", 'normal');
  await task.run();
  const rows = (await readFile(join(scratch, 'normal.jsonl'), 'utf8')).trim().split(/\r?\n/u).map(line => JSON.parse(line));
  assert.ok(Number.isInteger(task.runtimeLog.pid) && task.runtimeLog.pid > 0);
  assert.ok(rows.some(row => Number.isFinite(row.workingSetBytes)));
  assert.equal(rows.at(-1).waited, true);
  assert.equal(task.runtimeLog.childCloseObserved, true);
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
  // Keep the total budget (even after its cleanup reserve) well beyond this
  // page deadline so this fixture exercises only the active page limit.
  const task = invocation('setInterval(() => {}, 1000);', 'deadline', { monitorCode: sampledMonitor, elapsedBeforeMs: 0, budget: { pageMs: 1000, runMs: 10_000, cleanupMs: 1000 } });
  await assert.rejects(task.run(), /terminated: page deadline/u);
  const rows = (await readFile(join(scratch, 'deadline.jsonl'), 'utf8')).trim().split(/\r?\n/u).map(line => JSON.parse(line));
  assert.equal(task.runtimeLog.killed, true);
  assert.equal(task.runtimeLog.killReason, 'page deadline');
  assert.equal(task.runtimeLog.closeObserved, true);
  assert.ok(task.runtimeLog.signal);
  assert.equal(rows.at(-1).waited, true);
});

test('total experiment deadline also kills and waits for the fake child', async () => {
  const task = invocation('setInterval(() => {}, 1000);', 'total-deadline', { monitorCode: sampledMonitor, budget: { pageMs: 10_000, runMs: 3000, cleanupMs: 1000 } });
  await assert.rejects(task.run(), /terminated: total deadline/u);
  assert.equal(task.runtimeLog.killReason, 'total deadline');
  assert.equal(task.runtimeLog.closeObserved, true);
  assert.ok(task.runtimeLog.signal);
});

test('output over limit terminates the exact child and is also checked after close', async () => {
  const task = invocation("console.error('x'.repeat(8192));setInterval(()=>{},1000);", 'output', { monitorCode: sampledMonitor, budget: { pageMs: 5000, runMs: 6000, cleanupMs: 1000, pageOutputBytes: 1024 } });
  await assert.rejects(task.run(), /terminated: combined page output limit/u);
  assert.equal(task.runtimeLog.killed, true);
  assert.equal(task.runtimeLog.closeObserved, true);
  assert.ok(task.runtimeLog.signal);
  const file = await stat(join(scratch, 'output.stderr'));
  assert.ok(file.size > 1024);
});

test('text and TSV output files count together toward the page output cap', async () => {
  const code = "const fs=require('node:fs');const p=process.argv[1];setTimeout(()=>{fs.writeFileSync(p+'.txt','t'.repeat(600));fs.writeFileSync(p+'.tsv','v'.repeat(600))},60);setInterval(()=>{},1000);";
  const task = invocation(code, 'file-output', { monitorCode: sampledMonitor, budget: { pageMs: 5000, runMs: 6000, cleanupMs: 1000, pageOutputBytes: 1024 } });
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
    const task = invocation('setInterval(() => {}, 1000);', item.name.replaceAll(' ', '-'), { monitorCode: item.code, budget: { pageMs: 5000, runMs: 6000, cleanupMs: 1000 } });
    await assert.rejects(task.run(), item.error);
    assert.equal(task.runtimeLog.killed, true);
    assert.equal(task.runtimeLog.closeObserved, true);
    assert.ok(task.runtimeLog.signal);
  });
});

test('monitor startup must reach READY before the child is spawned', async () => {
  const task = invocation('process.exit(0);', 'monitor-startup', { monitorCode: 'process.exit(9);', monitorReady: false, budget: { pageMs: 5000, runMs: 6000, cleanupMs: 1000 } });
  await assert.rejects(task.run(), /resource monitor startup failed/u);
  assert.equal(task.runtimeLog.pid, undefined);
});

test('a child spawn failure still waits for both child and monitor within the page budget', async () => {
  const outBase = join(scratch, 'missing-executable');
  const runtimeLog: any = { pageId: 'missing-executable' };
  await assert.rejects(invokeTesseract(join(scratch, 'does-not-exist.exe'), 'fake-image', outBase, 'fake-data', 0, runtimeLog, {
    monitorCommand: execPath,
    monitorArgs: () => ['-e', "process.stdout.write('READY\\n');process.stdin.once('end',()=>process.exit(0));"],
    samplePath: join(scratch, 'missing.jsonl'),
    budget: { pageMs: 800, runMs: 1200, cleanupMs: 100 },
  }), /failed to spawn/u);
  assert.equal(runtimeLog.childSpawned, false);
  assert.equal(runtimeLog.childCloseObserved, false);
  assert.equal(runtimeLog.childSpawnFailureWithoutPid, true);
  assert.equal(runtimeLog.childCloseWaited, true);
  assert.equal(runtimeLog.monitorCloseObserved, true);
  assert.equal(runtimeLog.cleanupTimeout, false);
});

test('dedicated output directory cap includes marker/control files and stops the exact child', async () => {
  await writeFile(join(scratch, 'existing-control.json'), 'x'.repeat(700));
  const task = invocation("setInterval(()=>{},1000);", 'directory-cap', { monitorCode: sampledMonitor, budget: { pageMs: 5000, runMs: 6000, cleanupMs: 1000, directoryBytes: 1024 } });
  const run = () => invokeTesseract(execPath, 'fake-image', join(scratch, 'directory-cap'), 'fake-data', 0, task.runtimeLog, {
    childArgs: ['-e', "const fs=require('node:fs');const path=process.argv[1];setInterval(()=>{fs.writeFileSync(path+'.txt','y'.repeat(500))},50);setInterval(()=>{},1000);", join(scratch, 'directory-cap')],
    monitorCommand: execPath,
    monitorArgs: fakeMonitor(sampledMonitor),
    samplePath: join(scratch, 'directory-cap.jsonl'),
    directoryPath: scratch,
    budget: { pageMs: 5000, runMs: 6000, cleanupMs: 1000, directoryBytes: 1024 },
  });
  await assert.rejects(run(), /output directory byte limit/u);
  assert.equal(task.runtimeLog.closeObserved, true);
  assert.equal(task.runtimeLog.killed, true);
});

test('monitor stdout byte-cap failure stays bounded and reports any unobserved monitor close', async () => {
  const task = invocation('setInterval(() => {}, 1000);', 'monitor-log-cap', { monitorCode: "setTimeout(()=>process.stdout.write('x'.repeat(2048)),100);setInterval(()=>{},1000);", budget: { pageMs: 5000, runMs: 6000, cleanupMs: 1000, monitorLogBytes: 1024, monitorLineBytes: 128 } });
  await assert.rejects(task.run(), /monitor\/control log byte limit|process cleanup timeout/u);
  assert.equal(task.runtimeLog.childCloseObserved, true);
  assert.match(task.runtimeLog.monitorError, /monitor\/control log byte limit/u);
  assert.equal(task.runtimeLog.cleanupTimeout, !task.runtimeLog.monitorCloseObserved);
});

test('injected low soft working-set line records actual PID kill and wait', async () => {
  const monitor = [
    "const fs=require('node:fs');const pid=Number(process.argv[1]);const path=process.argv[2];const soft=Number(process.argv[3]);",
    "const at=new Date().toISOString();const sample={pid,at,workingSetBytes:soft+1};fs.appendFileSync(path,JSON.stringify(sample)+'\\n');process.stdout.write(JSON.stringify(sample)+'\\n');",
    "try{process.kill(pid)}catch{}",
    "const poll=setInterval(()=>{try{process.kill(pid,0)}catch{clearInterval(poll);const done=new Date().toISOString();fs.appendFileSync(path,JSON.stringify({pid,kill:'single-process',reason:'working-set-soft-line',waited:true,at:done})+'\\n');fs.appendFileSync(path,JSON.stringify({pid,exitCode:null,waited:true,at:done})+'\\n');}},10);",
  ].join('');
  const task = invocation('setInterval(() => {}, 1000);', 'soft-stop', { monitorCode: monitor, budget: { pageMs: 5000, runMs: 6000, cleanupMs: 1000, workingSetSoftBytes: 0 } });
  await assert.rejects(task.run(), /terminated: working-set-soft-line/u);
  const rows = (await readFile(join(scratch, 'soft-stop.jsonl'), 'utf8')).trim().split(/\r?\n/u).map(line => JSON.parse(line));
  assert.equal(rows[0].workingSetBytes, 1);
  assert.equal(rows.at(-1).waited, true);
  assert.equal(task.runtimeLog.pid > 0, true);
  assert.equal(task.runtimeLog.killReason, 'working-set-soft-line');
  assert.equal(task.runtimeLog.closeObserved, true);
});
