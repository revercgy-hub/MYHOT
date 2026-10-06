import { spawn } from 'node:child_process';
import { lstat, mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve, dirname, relative as relativePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertPreparedManifest, compareCell, gitBlobSha1, invokeTesseract, LIMITS, parseTsv, sha256, xiamenCandidate } from './ocr-scan-poc.ts';

// Separate from the historical five-page lock. This remains false until a Lead
// records the second, single-page execution checkoff for this exact code/profile.
export const OFFLINE_XIAMEN_OCR_ENABLED = false;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const INPUT_RELATIVE = '.data/fiscal-qa/xiamen-debt-round16-page.png';
const INPUT_PATH = resolve(ROOT, INPUT_RELATIVE);
const INPUT_BYTES = 602_201;
const INPUT_WIDTH = 1323;
const INPUT_HEIGHT = 1871;
const INPUT_SHA256 = 'B4F300D8F3C768FD4B7F30411ACA9E2CAA9AEC2155532F7586AA13543816794D';
const ENGINE = 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';
const ENGINE_VERSION = '5.5.0.20241111';
const ENGINE_SHA256 = 'CCD044D6CF16EAAAD151260E1FCC5E3E1504CD1B8644E940B4F7AE3E315DD0D3';
const PREPARED = resolve(ROOT, '.data/fiscal-qa/scan-ocr-poc-20261003');
const MODEL_PATH = join(PREPARED, 'tessdata/chi_sim.traineddata');
const LICENSE_PATH = join(PREPARED, 'LICENSE');
const MODEL_SIZE = 2_469_156;
const MODEL_BLOB = '388bac276d033d06e5ed5ba7a7ad14ae58f97dab';
const MODEL_SHA256 = 'A5FCB6F0DB1E1D6D8522F39DB4E848F05984669172E584E8D76B6B3141E1F730';
const LICENSE_SIZE = 11_358;
const LICENSE_BLOB = 'd645695673349e3947e8e5ae42332d0ac3164cd7';
const LICENSE_SHA256 = 'CFC7749B96F63BD31C3C42B5C471BF756814053E847C10F3EB003417BC523D30';
const OUTPUT_RELATIVE = '.data/fiscal-qa/offline-ocr-xiamen-20261006';
const OUTPUT = resolve(ROOT, OUTPUT_RELATIVE);
const RUN_LIMIT_MS = 180_000;
const PAGE_LIMIT_MS = 30_000;
const CONTROL_LOG_BYTES = 1024 * 1024;
const DIRECTORY_BYTES = 10 * 1024 * 1024;
const FAILURE_RESERVE_BYTES = 64 * 1024;
const ACTIVE_DIRECTORY_BYTES = DIRECTORY_BYTES - FAILURE_RESERVE_BYTES;
const MONITOR_FILE = join(OUTPUT, 'monitor-xiamen-1.jsonl');

export const SINGLE_PAGE_PROFILE = Object.freeze({ inputPath: INPUT_PATH, inputSha256: INPUT_SHA256, enginePath: ENGINE, engineVersion: ENGINE_VERSION, engineSha256: ENGINE_SHA256, modelPath: MODEL_PATH, modelSha256: MODEL_SHA256, licensePath: LICENSE_PATH, licenseSha256: LICENSE_SHA256, outputDirectory: OUTPUT, monitorFile: MONITOR_FILE, language: 'chi_sim', oem: 3, psm: 6, ompThreadLimit: 1, pageMs: PAGE_LIMIT_MS, runMs: RUN_LIMIT_MS, controlLogBytes: CONTROL_LOG_BYTES, directoryBytes: DIRECTORY_BYTES });

function pngDimensions(bytes: Buffer): { width: number; height: number } {
  if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.toString('ascii', 12, 16) !== 'IHDR') throw new Error('fixed PNG header invalid');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function canonicalPathKey(path: string): string {
  const canonical = resolve(path);
  return process.platform === 'win32' ? canonical.toLowerCase() : canonical;
}

function assertWithinRoot(rootReal: string, resolvedPath: string): void {
  const pathRelative = relativePath(rootReal, resolvedPath);
  if (isAbsolute(pathRelative) || pathRelative === '..' || pathRelative.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)) throw new Error('fixed OCR path resolves outside the workspace');
}

export function buildSinglePageCandidates(tsv: string): { fields: Array<{ page: 1; field: string; expectedReference: string; candidate: string | null; status: 'match' | 'mismatch' | 'missing'; missing: boolean; mismatch: boolean | null; note?: string }>; sourceBoxCandidates: any[] } {
  const sourceBoxCandidates = xiamenCandidate(parseTsv(tsv));
  const boxes = new Map(sourceBoxCandidates.map(item => [item.field, item.candidate || null]));
  // Human reference values are copied from P3_XIAMEN_MANUAL_REVIEW.md; they
  // are compared only in this ignored fixed-sample report, never written to Gold.
  const fields = [
    ['publisher', '厦门市财政局', null, 'No reviewed OCR box for the publisher.'],
    ['title_period', '2026年厦门市政府专项债券（十六期）招标结果公告', null, 'No reviewed OCR box for the announcement title and period.'],
    ['tender_date', '2026年9月11日已完成招标', null, 'No reviewed OCR box for the body tender date.'],
    ['bond_code', '199701', boxes.get('bond_code')],
    ['planned_issue_size', '22.78亿元', boxes.get('planned_issue_size')],
    ['actual_issue_size', '22.78亿元', boxes.get('actual_issue_size')],
    ['term', '7年（5+2年，含权）', boxes.get('term')],
    ['coupon_rate', '1.55%', boxes.get('coupon_rate')],
    ['issue_price', '100元', boxes.get('issue_price')],
    ['coupon_frequency', '12月/次', boxes.get('coupon_frequency')],
    ['payment_date', '每年9月14日（节假日顺延）', boxes.get('payment_date')],
    ['maturity_if_redeemed', '2031年9月14日', null, 'Combined maturity cell is retained below; no split candidate is inferred.'],
    ['maturity_if_not_redeemed', '2033年9月14日', null, 'Combined maturity cell is retained below; no split candidate is inferred.'],
    ['seal_date', '2026年9月11日', null, 'No reviewed OCR box for the signed date.'],
  ] as Array<[string, string, string | null | undefined, string?]>;
  return {
    fields: fields.map(([field, expectedReference, rawCandidate, note]) => {
      const candidate = rawCandidate || null;
      const comparison = compareCell(expectedReference, candidate ?? '');
      return { page: 1, field, expectedReference, candidate, status: comparison, missing: comparison === 'missing', mismatch: comparison === 'missing' ? null : comparison === 'mismatch', ...(note ? { note } : {}) };
    }),
    sourceBoxCandidates,
  };
}

export function assertCandidateTextLimit(text: string): void {
  if (text.length > LIMITS.textChars) throw new Error('single-page OCR text exceeds 120,000 characters');
}

function runBounded(executable: string, args: string[], timeoutMs: number, maxBytes: number, totalDeadline: number): Promise<{ code: number | null; text: string }> {
  return new Promise((resolvePromise, reject) => {
    if (Date.now() >= totalDeadline) { reject(new Error('single-page total budget exhausted before bounded command')); return; }
    const child = spawn(executable, args, { cwd: ROOT, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let bytes = 0;
    let text = '';
    let reason = '';
    let settled = false;
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    const finishError = (message: string) => { if (settled) return; settled = true; clearTimeout(timer); if (cleanupTimer) clearTimeout(cleanupTimer); reject(new Error(message)); };
    const stop = (message: string) => {
      if (reason) return;
      reason = message;
      try { child.kill(); } catch {}
      const cleanupDeadline = Math.min(Date.now() + LIMITS.cleanupMs, totalDeadline);
      const left = Math.max(0, cleanupDeadline - Date.now());
      cleanupTimer = setTimeout(() => finishError(`${reason}; bounded command close not observed within cleanup budget`), left);
    };
    const timer = setTimeout(() => stop('bounded preflight command timed out'), Math.min(timeoutMs, totalDeadline - Date.now()));
    const collect = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBytes) stop('bounded preflight command output exceeded its limit');
      else text += chunk.toString('utf8');
    };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);
    child.once('error', error => finishError(`bounded preflight command error: ${error.name}`));
    child.once('close', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (cleanupTimer) clearTimeout(cleanupTimer);
      if (reason) reject(new Error(`${reason}; process close observed`));
      else resolvePromise({ code, text });
    });
  });
}

async function assertOutputIgnoredAndAbsent(totalDeadline: number): Promise<void> {
  const result = await runBounded('git', ['check-ignore', '--quiet', '--', OUTPUT_RELATIVE], 5_000, 16 * 1024, totalDeadline);
  if (result.code !== 0) throw new Error('single-page output path is not ignored');
  const rootReal = await realpath(ROOT);
  const outputParentReal = await realpath(dirname(OUTPUT));
  assertWithinRoot(rootReal, outputParentReal);
  if (canonicalPathKey(outputParentReal) !== canonicalPathKey(dirname(OUTPUT))) throw new Error('single-page output parent was redirected by a reparse point');
  try { await lstat(OUTPUT); throw new Error('single-page output directory already exists; no retry or overwrite'); }
  catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
}

async function assertFixedFileUnderWorkspace(path: string): Promise<void> {
  const [rootReal, fileReal] = await Promise.all([realpath(ROOT), realpath(path)]);
  assertWithinRoot(rootReal, fileReal);
  if (canonicalPathKey(fileReal) !== canonicalPathKey(path)) throw new Error('fixed OCR input path was redirected by a reparse point');
}

async function validateFixedProfile(totalDeadline: number): Promise<{ inputBytes: Buffer; modelBytes: Buffer; licenseBytes: Buffer; manifest: any; engineHash: string }> {
  const fixedFiles = [
    { path: INPUT_PATH, exact: INPUT_BYTES, max: INPUT_BYTES },
    { path: MODEL_PATH, exact: MODEL_SIZE, max: MODEL_SIZE },
    { path: LICENSE_PATH, exact: LICENSE_SIZE, max: LICENSE_SIZE },
    { path: join(PREPARED, 'manifest.json'), max: 1024 * 1024 },
    { path: ENGINE, max: 128 * 1024 * 1024 },
  ];
  for (const file of fixedFiles) {
    const identity = await lstat(file.path);
    if (!identity.isFile() || identity.size <= 0 || identity.size > file.max || (file.exact !== undefined && identity.size !== file.exact)) throw new Error(`fixed input file size/type invalid: ${file.path === ENGINE ? 'engine' : file.path === INPUT_PATH ? 'PNG' : 'prepared artifact'}`);
    if (file.path !== ENGINE) await assertFixedFileUnderWorkspace(file.path);
  }
  const inputBytes = await readFile(INPUT_PATH);
  const dimensions = pngDimensions(inputBytes);
  if (inputBytes.length !== INPUT_BYTES || dimensions.width !== INPUT_WIDTH || dimensions.height !== INPUT_HEIGHT || sha256(inputBytes) !== INPUT_SHA256) throw new Error('fixed Xiamen PNG identity mismatch');
  if (inputBytes.length > LIMITS.pageBytes || dimensions.width * dimensions.height > LIMITS.pagePixels) throw new Error('fixed Xiamen PNG exceeds existing page caps');
  const [modelBytes, licenseBytes, manifestBytes, executableBytes] = await Promise.all([
    readFile(MODEL_PATH), readFile(LICENSE_PATH), readFile(join(PREPARED, 'manifest.json')), readFile(ENGINE),
  ]);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  assertPreparedManifest(manifest, modelBytes, licenseBytes);
  if (modelBytes.length !== MODEL_SIZE || gitBlobSha1(modelBytes) !== MODEL_BLOB || sha256(modelBytes) !== MODEL_SHA256) throw new Error('fixed chi_sim model identity mismatch');
  if (licenseBytes.length !== LICENSE_SIZE || gitBlobSha1(licenseBytes) !== LICENSE_BLOB || sha256(licenseBytes) !== LICENSE_SHA256) throw new Error('fixed model LICENSE identity mismatch');
  const engineHash = sha256(executableBytes);
  if (engineHash !== ENGINE_SHA256) throw new Error('fixed Tesseract executable hash mismatch');
  if (Date.now() >= totalDeadline) throw new Error('single-page total budget exhausted during identity preflight');
  return { inputBytes, modelBytes, licenseBytes, manifest, engineHash };
}

async function verifyEngineVersion(totalDeadline: number): Promise<string> {
  const version = await runBounded(ENGINE, ['--version'], 5_000, 16 * 1024, totalDeadline);
  const engineVersion = version.text.split(/\r?\n/u)[0] ?? '';
  if (version.code !== 0 || !engineVersion.includes(ENGINE_VERSION)) throw new Error('fixed Tesseract version mismatch');
  return engineVersion;
}

async function directoryFileBytes(directory: string): Promise<number> {
  const entries = await readdir(directory, { withFileTypes: true });
  let bytes = 0;
  for (const entry of entries) {
    if (!entry.isFile()) throw new Error('single-page output directory contains an unexpected non-file entry');
    bytes += (await stat(join(directory, entry.name))).size;
  }
  return bytes;
}

async function runSinglePage(): Promise<void> {
  if (!OFFLINE_XIAMEN_OCR_ENABLED) throw new Error('single-page OCR permit is closed; requires a separate Lead execution checkoff');
  if (process.argv.length !== 2) throw new Error('offline single-page OCR accepts no command-line overrides');
  const preflightStarted = Date.now();
  const totalDeadline = preflightStarted + RUN_LIMIT_MS;
  await assertOutputIgnoredAndAbsent(totalDeadline);
  const fixed = await validateFixedProfile(totalDeadline);
  if (Date.now() >= totalDeadline) throw new Error('single-page total budget exhausted before output admission');
  await mkdir(OUTPUT); // Exclusive creation: no recursive recovery or overwrite.
  const outputInfo = await lstat(OUTPUT);
  if (!outputInfo.isDirectory() || outputInfo.isSymbolicLink()) throw new Error('single-page output directory is not the expected new directory');
  await assertFixedFileUnderWorkspace(OUTPUT);
  const attempt: any = { schemaVersion: 1, startedAt: new Date().toISOString(), input: INPUT_RELATIVE, inputBytes: INPUT_BYTES, inputWidth: INPUT_WIDTH, inputHeight: INPUT_HEIGHT, inputPixels: INPUT_WIDTH * INPUT_HEIGHT, inputSha256: INPUT_SHA256, engine: ENGINE, expectedEngineVersion: ENGINE_VERSION, engineSha256: fixed.engineHash, preparedDirectory: PREPARED, modelPath: MODEL_PATH, modelBytes: MODEL_SIZE, modelCommit: '87416418657359cb625c412a48b6e1d6d41c29bd', modelBlob: MODEL_BLOB, modelSha256: MODEL_SHA256, licensePath: LICENSE_PATH, licenseBytes: LICENSE_SIZE, licenseName: 'Apache-2.0', licenseBlob: LICENSE_BLOB, licenseSha256: LICENSE_SHA256, language: 'chi_sim', oem: 3, psm: 6, ompThreadLimit: 1, output: OUTPUT, monitorFile: MONITOR_FILE, pageBudgetMs: PAGE_LIMIT_MS, totalBudgetMs: RUN_LIMIT_MS, monitorReadyMs: 5_000, sampleIntervalMs: LIMITS.sampleMs, sampleGapLimitMs: 250, workingSetSoftBytes: LIMITS.workingSetSoftBytes, pageOutputBytes: LIMITS.pageOutputBytes, monitorControlBytes: CONTROL_LOG_BYTES, outputDirectoryBytes: DIRECTORY_BYTES, failureReserveBytes: FAILURE_RESERVE_BYTES, permit: 'Lead single-page checkoff required', candidateOnly: true, preflight: { status: 'fixed-files-and-hashes-passed', checkedAt: new Date().toISOString() } };
  await writeFile(join(OUTPUT, 'attempt.json'), JSON.stringify(attempt, null, 2), { flag: 'wx' });
  const runtimeLog: any = { pageId: 'xiamen-1', preflightStartedAt: new Date(preflightStarted).toISOString() };
  try {
    const engineVersion = await verifyEngineVersion(totalDeadline);
    attempt.preflight = { status: 'passed', engineVersion, engineSha256: fixed.engineHash, preparedCommit: fixed.manifest.commit, validatedAt: new Date().toISOString() };
    await writeFile(join(OUTPUT, 'attempt.json'), JSON.stringify(attempt, null, 2));
    if (Date.now() >= totalDeadline) throw new Error('single-page total budget exhausted before child admission');
    const elapsedBefore = Date.now() - preflightStarted;
    await invokeTesseract(ENGINE, INPUT_PATH, join(OUTPUT, 'result'), join(PREPARED, 'tessdata'), elapsedBefore, runtimeLog, { samplePath: MONITOR_FILE, directoryPath: OUTPUT, budget: { pageMs: PAGE_LIMIT_MS, runMs: RUN_LIMIT_MS, pageOutputBytes: 1024 * 1024, monitorLogBytes: CONTROL_LOG_BYTES, directoryBytes: ACTIVE_DIRECTORY_BYTES } });
    if (Date.now() >= totalDeadline) throw new Error('single-page total budget exhausted after OCR close');
    const txt = await readFile(join(OUTPUT, 'result.txt'), 'utf8');
    const tsv = await readFile(join(OUTPUT, 'result.tsv'), 'utf8');
    assertCandidateTextLimit(txt);
    const candidates = buildSinglePageCandidates(tsv);
    await writeFile(join(OUTPUT, 'candidate-only.json'), JSON.stringify({ status: 'candidate-only', textChars: txt.length, rawTextFile: 'result.txt', rawTsvFile: 'result.tsv', normalization: 'compareCell preserves raw values and compares NFKC text after removing whitespace and commas', fields: candidates.fields, sourceBoxCandidates: candidates.sourceBoxCandidates, unknowns: ['seal fine print', 'QR content'], noArticleOrPublicationWrite: true, noGoldOrBodyStatusWrite: true }, null, 2), { flag: 'wx' });
    if (Date.now() >= totalDeadline) throw new Error('single-page total budget exhausted before final report');
    const beforeReportBytes = await directoryFileBytes(OUTPUT);
    const runReport = JSON.stringify({ status: 'candidate-only', attempt, runtimeLog, outputBytesBeforeRunReport: beforeReportBytes, elapsedMs: Date.now() - preflightStarted, downstreamWrites: false, gate2: 'NOT_PASSED' }, null, 2);
    if (beforeReportBytes + Buffer.byteLength(runReport) > ACTIVE_DIRECTORY_BYTES) throw new Error('single-page report would exceed the reserved directory cap');
    if (Date.now() >= totalDeadline) throw new Error('single-page total budget exhausted before final report');
    await writeFile(join(OUTPUT, 'run.json'), runReport, { flag: 'wx' });
    if (Date.now() >= totalDeadline || await directoryFileBytes(OUTPUT) > DIRECTORY_BYTES) throw new Error('single-page final deadline or directory byte limit exceeded');
  } catch (error) {
    runtimeLog.failure = error instanceof Error ? error.message.slice(0, 500) : 'unknown error';
    const failedAt = new Date().toISOString();
    const failureText = () => JSON.stringify({ status: 'failed', attempt, runtimeLog, failedAt, noRetry: true }, null, 2);
    const runPath = join(OUTPUT, 'run.json');
    const existingRun = await stat(runPath).then(() => true).catch(() => false);
    const failurePath = join(OUTPUT, 'failure.json');
    if (existingRun) await writeFile(runPath, failureText());
    await writeFile(failurePath, failureText(), { flag: 'wx' });
    let bytes = await directoryFileBytes(OUTPUT);
    if (bytes > DIRECTORY_BYTES) {
      runtimeLog.failure = `${runtimeLog.failure}; output directory cap exceeded (${bytes} > ${DIRECTORY_BYTES} bytes)`;
      const cappedFailure = failureText();
      await writeFile(failurePath, cappedFailure);
      if (existingRun) await writeFile(runPath, cappedFailure);
      bytes = await directoryFileBytes(OUTPUT);
      if (bytes > DIRECTORY_BYTES) throw new Error(`${runtimeLog.failure}; bounded failure record saved but directory remains over cap (${bytes} bytes)`);
    }
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runSinglePage().catch(error => { console.error(JSON.stringify({ name: error?.name ?? 'Error', message: String(error?.message ?? error).slice(0, 500) })); process.exitCode = 1; });
}
