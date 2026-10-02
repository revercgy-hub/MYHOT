import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIMITS = Object.freeze({
  requests: 2, requestMs: 120_000, prepareMs: 240_000, modelBytes: 32 * 1024 * 1024, metadataBytes: 1024 * 1024,
  pagePixels: 25_000_000, pageBytes: 20 * 1024 * 1024, totalInputBytes: 100 * 1024 * 1024,
  pageMs: 30_000, runMs: 180_000, pageOutputBytes: 1024 * 1024, outputBytes: 5 * 1024 * 1024,
  textChars: 120_000, workingSetSoftBytes: 512 * 1024 * 1024, sampleMs: 20, directoryBytes: 10 * 1024 * 1024,
});
// The run lock remains closed until the complete approved model/license and all required execution evidence exist.
export const OCR_RUN_ENABLED = false;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, '.data/fiscal-qa/scan-ocr-poc-20261002');
const MODEL_URL_BASE = 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast';
const APPROVED_MODEL_COMMIT = '87416418657359cb625c412a48b6e1d6d41c29bd';
const MODEL_URL = `${MODEL_URL_BASE}/${APPROVED_MODEL_COMMIT}/chi_sim.traineddata`;
const LICENSE_URL = `${MODEL_URL_BASE}/${APPROVED_MODEL_COMMIT}/LICENSE`;
const PAGES = [
  { id: 'fujian-1', path: '.data/fiscal-central-audit/rendered/fujian-1.png', sha256: '0D40BD4CCCBE928AC564185F089D177991C6DFD758CF732296E542872C7A016A', page: 1 },
  { id: 'fujian-2', path: '.data/fiscal-central-audit/rendered/fujian-2.png', sha256: 'F577BAC70BAAF3E9BABB855FBBB6284DFBAA47B38A4F5A744F2C13D8A9CCE97E', page: 2 },
  { id: 'fujian-3', path: '.data/fiscal-central-audit/rendered/fujian-3.png', sha256: '06AD562A74E89003122DBB1197698420B93E8DF37AAB49493DB118D1DDD9253A', page: 3 },
  { id: 'fujian-4', path: '.data/fiscal-central-audit/rendered/fujian-4.png', sha256: 'F8856773CC55744FF6246724CDC464C309F51EE45028254901320B98F89D00F8', page: 4 },
  { id: 'xiamen-1', path: '.data/fiscal-qa/xiamen-debt-round16-page.png', sha256: 'B4F300D8F3C768FD4B7F30411ACA9E2CAA9AEC2155532F7586AA13543816794D', page: 1 },
];

export function sha256(bytes: Buffer | string): string { return createHash('sha256').update(bytes).digest('hex').toUpperCase(); }
export function normalizeCandidate(s: string): string {
  return s.normalize('NFKC').replace(/[\s\u3000]+/gu, '').replace(/,/gu, '');
}
export function compareCell(expected: string, candidate: string): 'match' | 'mismatch' | 'missing' {
  const c = normalizeCandidate(candidate);
  if (!c) return 'missing';
  return normalizeCandidate(expected) === c ? 'match' : 'mismatch';
}

type Word = { x: number; y: number; w: number; h: number; text: string; confidence: number };
export function parseTsv(tsv: string): Word[] {
  const lines = tsv.trim().split(/\r?\n/u);
  return lines.slice(1).flatMap(line => {
    const c = line.split('\t');
    if (c.length < 12 || Number(c[0]) !== 5 || !c[11]?.trim()) return [];
    const [x, y, w, h, confidence] = [c[6], c[7], c[8], c[9], c[10]].map(Number);
    if (![x, y, w, h, confidence].every(Number.isFinite)) return [];
    return [{ x, y, w, h, text: c.slice(11).join('\t').trim(), confidence }];
  });
}
export function cellText(words: Word[], box: [number, number, number, number]): string {
  const [x0, y0, x1, y1] = box;
  return words.filter(w => {
    const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
    return cx >= x0 && cx < x1 && cy >= y0 && cy < y1;
  }).sort((a, b) => Math.abs(a.y - b.y) > 8 ? a.y - b.y : a.x - b.x).map(w => w.text).join(' ');
}

export function assertPreparedManifest(manifest: any, modelBytes?: Buffer, licenseBytes?: Buffer): void {
  if (manifest?.schemaVersion !== 1 || manifest?.status !== 'complete' || manifest?.trainedDataComplete !== true || manifest?.runnable !== true || manifest?.language !== 'chi_sim') throw new Error('prepared chi_sim data is incomplete; run is forbidden');
  if (manifest.commit !== APPROVED_MODEL_COMMIT || manifest.repository !== 'tesseract-ocr/tessdata_fast') throw new Error('chi_sim data is not from the approved repository commit');
  if (manifest.modelUrl !== MODEL_URL || manifest.licenseUrl !== LICENSE_URL) throw new Error('chi_sim data URLs are not pinned to the approved commit');
  if (!modelBytes || modelBytes.length === 0 || !manifest.modelSha256 || modelBytes.length !== manifest.modelBytes || sha256(modelBytes) !== manifest.modelSha256 || modelBytes.length > LIMITS.modelBytes) throw new Error('chi_sim data missing, changed, or over limit');
  if (!licenseBytes || !manifest.licenseSha256 || licenseBytes.length !== manifest.licenseBytes || licenseBytes.length > LIMITS.metadataBytes || sha256(licenseBytes) !== manifest.licenseSha256) throw new Error('pinned Apache-2.0 license text missing, changed, or over limit');
  const licenseText = licenseBytes.toString('utf8');
  if (manifest.licenseName !== 'Apache-2.0' || !licenseText.includes('Apache License') || !licenseText.includes('Version 2.0')) throw new Error('pinned license text is not identified as Apache-2.0');
}

export async function boundedFetch(url: string, maxBytes: number, log: any[], fetchImpl: typeof fetch = fetch, totalDeadline = Date.now() + LIMITS.prepareMs): Promise<Buffer> {
  if (url !== MODEL_URL && url !== LICENSE_URL) throw new Error('request URL is outside the approved fixed-file allowlist');
  const approvedMaxBytes = url === MODEL_URL ? LIMITS.modelBytes : LIMITS.metadataBytes;
  if (maxBytes > approvedMaxBytes) throw new Error('requested byte cap exceeds the approved file limit');
  if (log.some(entry => entry.url === url)) throw new Error('approved URL already attempted; do not retry');
  if (log.length >= LIMITS.requests) throw new Error('request budget exhausted');
  const requestStarted = Date.now();
  const timeoutMs = Math.min(LIMITS.requestMs, totalDeadline - requestStarted);
  if (timeoutMs <= 0) throw new Error('prepare total deadline exhausted');
  const entry: any = { number: log.length + 1, url, startedAt: new Date().toISOString(), redirect: 'manual', bytesReceived: 0, eofComplete: false };
  log.push(entry); // Count at the actual fetch call boundary, including failures.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': 'AIHOT-local-OCR-PoC/1.0', Accept: '*/*' } });
    entry.status = response.status;
    if (response.status >= 300 && response.status < 400) throw new Error(`redirect rejected (${response.status})`);
    if (response.status !== 200) throw new Error(`unexpected HTTP ${response.status}`);
    const contentLengthHeader = response.headers.get('content-length');
    const expectedBytes = contentLengthHeader && /^\d+$/u.test(contentLengthHeader) ? Number(contentLengthHeader) : null;
    entry.contentLength = expectedBytes;
    const chunks: Buffer[] = []; let total = 0; entry.bytesReceived = 0;
    if (!response.body) throw new Error('empty response stream');
    for await (const chunk of response.body) {
      const b = Buffer.from(chunk); total += b.length;
      entry.bytesReceived = total;
      if (total > maxBytes) { await response.body.cancel().catch(() => {}); throw new Error(`response exceeds ${maxBytes} bytes`); }
      chunks.push(b);
    }
    if (expectedBytes !== null && total !== expectedBytes) throw new Error(`incomplete response: content-length ${expectedBytes}, received ${total}`);
    const result = Buffer.concat(chunks); entry.bytes = result.length; entry.sha256 = sha256(result); entry.eofComplete = true; entry.completedAt = new Date().toISOString();
    return result;
  } catch (error) { entry.error = String(error); throw error; }
  finally { clearTimeout(timer); entry.endedAt = new Date().toISOString(); entry.elapsedMs = Date.now() - requestStarted; }
}

export async function assertPrepareNotAttempted(outDir: string): Promise<void> {
  for (const name of ['prepare-attempt.json', 'prepare-failure.json', 'upstream.json', 'manifest.json']) {
    try { await stat(join(outDir, name)); throw new Error(`one-shot prepare already attempted: ${name}; do not retry`); }
    catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
  }
}

export async function prepare(): Promise<void> {
  const prepareStarted = Date.now();
  const totalDeadline = prepareStarted + LIMITS.prepareMs;
  await mkdir(join(OUT, 'tessdata'), { recursive: true });
  await assertPrepareNotAttempted(OUT);
  const requests: any[] = [];
  await writeFile(join(OUT, 'prepare-attempt.json'), JSON.stringify({ startedAt: new Date(prepareStarted).toISOString(), commit: APPROVED_MODEL_COMMIT, modelUrl: MODEL_URL, licenseUrl: LICENSE_URL }, null, 2), { flag: 'wx' });
  try {
    const commit = APPROVED_MODEL_COMMIT;
    const model = await boundedFetch(MODEL_URL, LIMITS.modelBytes, requests, fetch, totalDeadline);
    const license = await boundedFetch(LICENSE_URL, LIMITS.metadataBytes, requests, fetch, totalDeadline);
    const licenseText = license.toString('utf8');
    if (!licenseText.includes('Apache License') || !licenseText.includes('Version 2.0')) throw new Error('pinned repository LICENSE is not Apache-2.0');
    if (Date.now() > totalDeadline) throw new Error('prepare total deadline exhausted before finalization');
    if (Date.now() >= totalDeadline) throw new Error('prepare total deadline exhausted before saving files');
    await writeFile(join(OUT, 'tessdata/chi_sim.traineddata'), model, { flag: 'wx' });
    if (Date.now() >= totalDeadline) throw new Error('prepare total deadline exhausted before saving license');
    await writeFile(join(OUT, 'LICENSE'), license, { flag: 'wx' });
    if (Date.now() >= totalDeadline) throw new Error('prepare total deadline exhausted before saving manifest');
    await writeFile(join(OUT, 'upstream.json'), JSON.stringify({ repository: 'tesseract-ocr/tessdata_fast', commit, commitUrl: `https://github.com/tesseract-ocr/tessdata_fast/commit/${commit}`, modelUrl: MODEL_URL, licenseUrl: LICENSE_URL, retrievedAt: new Date().toISOString(), modelBytes: model.length, modelSha256: sha256(model), licenseBytes: license.length, licenseSha256: sha256(license), licenseName: 'Apache-2.0', requests, elapsedMs: Date.now() - prepareStarted }, null, 2), { flag: 'wx' });
    await writeFile(join(OUT, 'manifest.json'), JSON.stringify({ schemaVersion: 1, status: 'complete', trainedDataComplete: true, runnable: true, repository: 'tesseract-ocr/tessdata_fast', commit, modelUrl: MODEL_URL, modelSha256: sha256(model), modelBytes: model.length, language: 'chi_sim', licenseUrl: LICENSE_URL, licenseName: 'Apache-2.0', licenseSha256: sha256(license), licenseBytes: license.length }, null, 2), { flag: 'wx' });
    console.log(`prepared commit=${commit} model_bytes=${model.length} license_bytes=${license.length}`);
  } catch (error) {
    await writeFile(join(OUT, 'prepare-failure.json'), JSON.stringify({ error: String(error), requests, startedAt: new Date(prepareStarted).toISOString(), endedAt: new Date().toISOString(), elapsedMs: Date.now() - prepareStarted }, null, 2), { flag: 'wx' });
    await writeFile(join(OUT, 'manifest.json'), JSON.stringify({ schemaVersion: 1, status: 'incomplete', trainedDataComplete: false, runnable: false, modelSha256: null, language: 'chi_sim', reason: String(error), requests }, null, 2), { flag: 'wx' });
    throw error;
  }
}

function pngDimensions(buf: Buffer): { width: number; height: number } {
  if (buf.length < 24 || buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || buf.toString('ascii', 12, 16) !== 'IHDR') throw new Error('invalid PNG header');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

type ProcessBudget = Pick<typeof LIMITS, 'pageMs' | 'runMs' | 'pageOutputBytes' | 'workingSetSoftBytes'>;
type ProcessHooks = {
  /** Test seam for a local fake child. Production always uses the fixed Tesseract arguments below. */
  childArgs?: string[];
  /** Fake monitor seam; it follows the production READY/stdin-PID/sample-stdout handshake. */
  monitorCommand?: string;
  monitorArgs?: (pid: number, samplePath: string, workingSetSoftBytes: number) => string[];
  samplePath?: string;
  budget?: Partial<ProcessBudget>;
};

export async function invokeTesseract(exe: string, image: string, outBase: string, tessdata: string, elapsedBeforeMs: number, runtimeLog: any, hooks: ProcessHooks = {}): Promise<void> {
  const budget: ProcessBudget = { ...LIMITS, ...hooks.budget };
  const remaining = Math.min(budget.pageMs, budget.runMs - elapsedBeforeMs);
  if (remaining <= 0) throw new Error('total runtime budget exhausted');
  const args = hooks.childArgs ?? [image, outBase, '-l', 'chi_sim', '--oem', '3', '--psm', '6', '--tessdata-dir', tessdata, 'txt', 'tsv'];
  const started = Date.now();
  const safeEnv: NodeJS.ProcessEnv = { OMP_THREAD_LIMIT: '1' };
  for (const name of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'PATH']) if (process.env[name]) safeEnv[name] = process.env[name];
  // Windows/libuv fills these identity variables for child processes even when omitted; clear them explicitly.
  for (const name of ['HOMEDRIVE', 'HOMEPATH', 'LOGONSERVER', 'SYSTEMDRIVE', 'USERDOMAIN', 'USERNAME', 'USERPROFILE']) safeEnv[name] = '';
  let stderrBytes = 0, killed = false, killReason = '';
  const stderr: Buffer[] = [];
  let processClosed = false;
  let childExitCode: number | null = null;
  let childSignal: NodeJS.Signals | null = null;
  let childClosedAt: string | undefined;
  let childError: Error | undefined;
  let child: ReturnType<typeof spawn> | undefined;
  const terminate = (reason: string) => {
    if (processClosed || !child) return;
    if (!killed) killReason = reason;
    try { killed = child.kill() || killed; } catch {}
  };
  const samplePath = hooks.samplePath ?? join(OUT, `monitor-${runtimeLog.pageId}.jsonl`);
  const powershellMonitorArgs = (_pid: number, path: string, softLimit: number) => {
    const script = [
      "$ErrorActionPreference='Stop'",
      "$warm=[Diagnostics.Process]::GetCurrentProcess(); $warm.Refresh(); $warmBytes=[long]$warm.WorkingSet64; $warm.Dispose()",
      "[Console]::Out.WriteLine('READY'); [Console]::Out.Flush()",
      "$idLine=[Console]::In.ReadLine(); if($null -eq $idLine){throw 'missing child PID'}",
      `$p=[Diagnostics.Process]::GetProcessById([int]$idLine); $f=[IO.StreamWriter]::new('${path.replaceAll("'", "''")}', $false); $peak=0; $i=0; try { while(-not $p.HasExited) { $p.Refresh(); if($p.HasExited){break}; $ws=[long]$p.WorkingSet64; if($ws -gt $peak){$peak=$ws}; $i++; $at=[DateTime]::UtcNow.ToString('o'); $row='{"pid":'+$p.Id+',"at":"'+$at+'","workingSetBytes":'+$ws+'}'; $f.WriteLine($row); $f.Flush(); [Console]::Out.WriteLine($row); [Console]::Out.Flush(); if($ws -gt ${softLimit}) { $p.Kill(); $p.WaitForExit(); $at=[DateTime]::UtcNow.ToString('o'); $f.WriteLine('{"pid":'+$p.Id+',"kill":"single-process","reason":"working-set-soft-line","peakWorkingSetBytes":'+$peak+',"waited":true,"at":"'+$at+'"}'); break }; Start-Sleep -Milliseconds ${LIMITS.sampleMs} }; if($p.HasExited){$p.WaitForExit()}; $at=[DateTime]::UtcNow.ToString('o'); $exitJson='null'; try{$exitJson=[string]$p.ExitCode}catch{}; if([string]::IsNullOrWhiteSpace($exitJson)){$exitJson='null'}; $f.WriteLine('{"pid":'+$p.Id+',"exitCode":'+$exitJson+',"peakWorkingSetBytes":'+$peak+',"waited":true,"samples":'+$i+',"at":"'+$at+'"}') } finally {$f.Dispose();$p.Dispose()}`,
    ].join('; ');
    return ['-NoProfile', '-NonInteractive', '-Command', script];
  };
  const monitor = spawn(hooks.monitorCommand ?? 'powershell.exe', (hooks.monitorArgs ?? powershellMonitorArgs)(0, samplePath, budget.workingSetSoftBytes), { windowsHide: true, env: safeEnv, stdio: ['pipe', 'pipe', 'pipe'] });
  let monitorError: Error | undefined;
  let monitorExitCode: number | null = null;
  const monitorStderr: Buffer[] = [];
  const liveSampleRows: any[] = [];
  let readyResolve!: () => void;
  let readyReject!: (error: Error) => void;
  let monitorReady = false;
  let monitorStdoutBuffer = '';
  const readySignal = new Promise<void>((resolveReady, rejectReady) => { readyResolve = resolveReady; readyReject = rejectReady; });
  monitor.stdout?.on('data', (chunk: Buffer) => {
    monitorStdoutBuffer += chunk.toString('utf8');
    const lines = monitorStdoutBuffer.split(/\r?\n/u);
    monitorStdoutBuffer = lines.pop() ?? '';
    for (const line of lines.filter(Boolean)) {
      if (line === 'READY') { monitorReady = true; readyResolve(); continue; }
      try {
        const row = JSON.parse(line);
        if (Number.isFinite(row.workingSetBytes) && typeof row.at === 'string' && row.pid === runtimeLog.pid) liveSampleRows.push(row);
        else throw new Error('PID or sample fields did not match the target child');
      } catch (error) {
        monitorError = new Error(`invalid monitor sample: ${String(error)}; ${line.slice(0, 120)}`);
        if (!monitorReady) readyReject(monitorError);
        terminate('resource monitor invalid sample');
      }
    }
  });
  monitor.stderr?.on('data', (chunk: Buffer) => monitorStderr.push(chunk));
  const monitorClosed = new Promise<number | null>(resolveCode => monitor.once('close', code => {
    monitorExitCode = code;
    if (child && !processClosed) terminate('resource monitor exited before Tesseract');
    if (!monitorReady) readyReject(new Error(`resource monitor exited before READY (exit ${code})`));
    resolveCode(code);
  }));
  const startupTimeoutMs = Math.min(5_000, remaining);
  const startupTimer = setTimeout(() => readyReject(new Error(`resource monitor startup exceeded ${startupTimeoutMs}ms`)), startupTimeoutMs);
  monitor.once('error', error => { monitorError = error; readyReject(error); });
  await readySignal.catch(async error => {
    clearTimeout(startupTimer);
    try { monitor.kill(); } catch {}
    await monitorClosed;
    throw new Error(`resource monitor startup failed: ${error}`);
  });
  clearTimeout(startupTimer);
  if (monitorExitCode !== null) throw new Error(`resource monitor exited before child spawn (exit ${monitorExitCode})`);
  child = spawn(exe, args, { windowsHide: true, env: safeEnv, stdio: ['ignore', 'ignore', 'pipe'] });
  runtimeLog.pid = child.pid;
  const closed = new Promise<void>(resolvePromise => {
    child!.stderr?.on('data', (chunk: Buffer) => {
      stderrBytes += chunk.length;
      if (stderrBytes <= LIMITS.pageOutputBytes) stderr.push(chunk);
      else terminate('stderr output limit');
    });
    child!.once('error', error => { childError = error; terminate('child process error'); });
    child!.once('close', (code, signal) => { processClosed = true; childClosedAt = new Date().toISOString(); childExitCode = code; childSignal = signal; resolvePromise(); });
  });
  if (!child.pid) { monitor.stdin?.end(); await Promise.all([closed, monitorClosed]); throw new Error(`Tesseract failed to spawn: ${childError ?? 'missing pid'}`); }
  monitor.stdin?.end(`${child.pid}\n`);
  const childStartedAt = Date.now();
  const sampleWatchdog = setInterval(() => {
    if (processClosed) return;
    const lastAt = liveSampleRows.length ? Date.parse(liveSampleRows.at(-1).at) : null;
    const overdue = lastAt === null ? Date.now() - childStartedAt > 250 : Date.now() - lastAt > 250;
    if (overdue) terminate(lastAt === null ? 'resource monitor first sample overdue' : 'resource monitor sample overdue');
  }, 25);
  const startedAt = started;
  const watchdog = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    if (!processClosed && (elapsed > remaining || Date.now() - started > budget.pageMs)) terminate(elapsed > budget.pageMs ? 'page deadline' : 'total deadline');
    void Promise.all(['.txt', '.tsv'].map(ext => stat(`${outBase}${ext}`).then(s => s.size).catch(() => 0)))
      .then(sizes => { if (sizes[0] + sizes[1] + stderrBytes > budget.pageOutputBytes) terminate('combined page output limit'); });
  }, 100);
  try { await closed; } finally { clearInterval(watchdog); clearInterval(sampleWatchdog); }
  await monitorClosed;
  runtimeLog.exitCode = childExitCode;
  runtimeLog.signal = childSignal;
  runtimeLog.closeObserved = processClosed;
  runtimeLog.monitorExitCode = monitorExitCode;
  runtimeLog.killed = killed;
  runtimeLog.killReason = killReason || null;
  const stderrBuf = Buffer.concat(stderr);
  await writeFile(`${outBase}.stderr`, stderrBuf);
  if (childError) throw new Error(`Tesseract process error: ${childError}`);
  if (monitorError || monitorExitCode !== 0) throw new Error(`resource monitor failed: ${monitorError ?? `exit ${monitorExitCode}; ${Buffer.concat(monitorStderr).toString('utf8').trim()}`}`);
  const finalSizes = await Promise.all(['.txt', '.tsv'].map(ext => stat(`${outBase}${ext}`).then(s => s.size).catch(() => 0)));
  if (finalSizes[0] + finalSizes[1] + stderrBytes > budget.pageOutputBytes && !killed) throw new Error('combined page output limit exceeded');
  let monitorText: string;
  try { monitorText = await readFile(samplePath, 'utf8'); }
  catch { throw new Error('resource monitor produced no samples or wait record'); }
  let monitorRows: any[];
  try { monitorRows = monitorText.trim().split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line)); }
  catch (error) { throw new Error(`resource monitor log is invalid: ${String(error)}; ${JSON.stringify(monitorText.slice(0, 500))}`); }
  const sampleRows = monitorRows.filter(row => Number.isFinite(row.workingSetBytes));
  if (!sampleRows.length || monitorRows.at(-1)?.waited !== true) throw new Error('resource monitor had no samples or did not confirm wait completion');
  if (sampleRows.some(row => row.pid !== runtimeLog.pid) || monitorRows.at(-1)?.pid !== runtimeLog.pid) throw new Error('resource monitor PID did not match the exact child PID');
  if (liveSampleRows.length !== sampleRows.length) throw new Error('resource monitor live samples did not match its flushed sample log');
  const softStop = monitorRows.find(row => row.kill === 'single-process' && row.reason === 'working-set-soft-line');
  if (softStop) { killed = true; killReason = 'working-set-soft-line'; }
  runtimeLog.killed = killed;
  runtimeLog.killReason = killReason || null;
  let maxGapMs = 0;
  for (let i=1;i<sampleRows.length;i++) maxGapMs=Math.max(maxGapMs,Date.parse(sampleRows[i].at)-Date.parse(sampleRows[i-1].at));
  const firstSampleDelayMs = Date.parse(sampleRows[0].at) - childStartedAt;
  if (!Number.isFinite(firstSampleDelayMs) || firstSampleDelayMs < 0) throw new Error('resource monitor first sample time is invalid');
  maxGapMs = Math.max(maxGapMs, firstSampleDelayMs);
  const lastSampleToCloseMs = Date.parse(childClosedAt!) - Date.parse(sampleRows.at(-1).at);
  if (!Number.isFinite(lastSampleToCloseMs) || lastSampleToCloseMs < 0) throw new Error('resource monitor final sample preceded child close check is invalid');
  maxGapMs = Math.max(maxGapMs, lastSampleToCloseMs);
  runtimeLog.workingSetPeakBytes = Math.max(...sampleRows.map(row => row.workingSetBytes));
  runtimeLog.monitorSamples = sampleRows.length;
  runtimeLog.monitorMaxGapMs = maxGapMs;
  runtimeLog.monitorFirstSampleDelayMs = firstSampleDelayMs;
  runtimeLog.monitorLastSampleToCloseMs = lastSampleToCloseMs;
  if(killed) throw new Error(`Tesseract terminated: ${killReason}`);
  if(maxGapMs>250) throw new Error(`resource monitor sample gap ${maxGapMs}ms exceeded 250ms`);
  runtimeLog.elapsedMs = Date.now() - started; runtimeLog.stderrBytes = stderrBytes; runtimeLog.killed = killed; runtimeLog.killReason = killReason || null;
  if (killed) throw new Error(`Tesseract terminated: ${killReason}`);
  if (childExitCode !== 0) throw new Error(`Tesseract exit ${childExitCode ?? childSignal}: ${stderrBuf.toString('utf8')}`);
}

const FIJIAN_ROW_Y: Record<number, number[]> = {
  1: [878,910,943,976],
  2: [163,197,230,263,297,330,363,397,430,463,497,530,563,599,632,665,698,732,765,799,832,872],
};
function fujianCandidate(pageNo: number, words: Word[]): any[] {
  const ys = FIJIAN_ROW_Y[pageNo]; if (!ys) return [];
  const startRow = pageNo === 1 ? 1 : 4; const x = [91,129,410,542,638,739];
  const rows = pageNo === 1 ? 3 : 21;
  const out: any[] = [];
  for (let i=0;i<rows;i++) {
    const y0=ys[i], y1=ys[i+1], rowNo=startRow+i;
    for (const [j,key] of [[0,'sequence_or_total'],[1,'institution'],[2,'amount'],[3,'rate'],[4,'interest']] as Array<[number,string]>) {
      const candidate=cellText(words,[x[j],y0,x[j+1],y1]);
      out.push({ page: pageNo, row: rowNo, field: key, candidate, box:[x[j],y0,x[j+1],y1], confidence:'word confidence is preserved in raw TSV; no automated gold judgment' });
    }
  }
  return out;
}

function xiamenCandidate(words: Word[]): any[] {
  // Fixed, image-specific four-column table geometry. Candidate text only; no auto-match.
  const x=[172,315,747,897,1151], y=[799,924,1001,1064,1127,1327];
  const cells:Array<[number,number,string]>=[
    [0,0,'bond_name'],[0,1,'bond_code'],[1,0,'planned_issue_size'],[1,1,'actual_issue_size'],
    [2,0,'term'],[2,1,'coupon_rate'],[3,0,'issue_price'],[3,1,'coupon_frequency'],[4,0,'payment_date'],[4,1,'conditional_maturity_dates'],
  ];
  return cells.map(([r,c,field])=>({page:1,field,candidate:cellText(words,[x[c*2+1],y[r],x[c*2+2],y[r+1]]),box:[x[c*2+1],y[r],x[c*2+2],y[r+1]],confidence:'word confidence is preserved in raw TSV; no automated gold judgment'}));
}

async function run(): Promise<void> {
  if (!OCR_RUN_ENABLED) throw new Error('OCR run is disabled: model/license and execution prerequisites have not all been accepted');
  const manifest = JSON.parse(await readFile(join(OUT, 'manifest.json'), 'utf8'));
  const modelPath = join(OUT, 'tessdata/chi_sim.traineddata');
  const model = await readFile(modelPath);
  const license = await readFile(join(OUT, 'LICENSE'));
  assertPreparedManifest(manifest, model, license);
  if (!/^[0-9a-f]{40}$/iu.test(manifest.commit)) throw new Error('language model commit is not pinned');
  const exe = 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';
  const version = await new Promise<string>((res, rej) => { const p=spawn(exe,['--version'],{windowsHide:true}); let s=''; p.stdout.on('data',d=>s+=d); p.on('close',code=>code===0?res(s.split(/\r?\n/u)[0]):rej(new Error('Tesseract version failed'))); p.on('error',rej); });
  if (!version.includes('5.5.0')) throw new Error(`unexpected Tesseract version ${version}`);
  const exeHash=sha256(await readFile(exe));
  const inputRecords: any[]=[]; let totalInput=0;
  for (const p of PAGES) {
    const bytes=await readFile(join(ROOT,p.path)); const dim=pngDimensions(bytes); totalInput+=bytes.length;
    if(sha256(bytes)!==p.sha256||bytes.length>LIMITS.pageBytes||dim.width*dim.height>LIMITS.pagePixels) throw new Error(`fixed input invalid: ${p.id}`);
    inputRecords.push({ ...p, bytes:bytes.length, width:dim.width,height:dim.height,pixels:dim.width*dim.height });
  }
  if(totalInput>LIMITS.totalInputBytes) throw new Error('total input bytes over limit');
  const started=Date.now(); const pages:any[]=[]; let totalOutput=0,totalChars=0;
  for(let i=0;i<PAGES.length;i++) {
    const p=PAGES[i], inPath=join(ROOT,p.path), outBase=join(OUT,`result-${p.id}`);
    const pageLog:any={pageId:p.id,startedAt:new Date().toISOString(),arguments:['-l','chi_sim','--oem','3','--psm','6','txt','tsv'],threadLimit:1};
    try {
      await invokeTesseract(exe,inPath,outBase,join(OUT,'tessdata'),Date.now()-started,pageLog);
      const txt=await readFile(`${outBase}.txt`,'utf8'), tsv=await readFile(`${outBase}.tsv`,'utf8');
      const outBytes=Buffer.byteLength(txt)+Buffer.byteLength(tsv)+pageLog.stderrBytes;
      totalOutput+=outBytes;totalChars+=txt.length;
      if(outBytes>LIMITS.pageOutputBytes||totalOutput>LIMITS.outputBytes||totalChars>LIMITS.textChars) throw new Error('aggregate/page output cap exceeded');
      const words=parseTsv(tsv);
      const candidates=p.id.startsWith('fujian')?fujianCandidate(p.page,words):xiamenCandidate(words);
      pages.push({ ...pageLog,status:'completed',outputBytes:outBytes,textChars:txt.length,wordCount:words.length,rawTextFile:`result-${p.id}.txt`,rawTsvFile:`result-${p.id}.tsv`,candidateCells:candidates,fullGoldReview:'manual comparison required; candidate text is never marked trusted',unknowns:['seal fine print','QR content'] });
    } catch(error) { pages.push({ ...pageLog,status:'failed',error:String(error) }); throw error; }
  }
  const outputs=await Promise.all(PAGES.flatMap(p=>['.txt','.tsv','.stderr'].map(async ext=>({name:`result-${p.id}${ext}`,bytes:(await stat(join(OUT,`result-${p.id}${ext}`)).catch(()=>({size:0} as any))).size}))));
  if(outputs.reduce((a,b)=>a+b.bytes,0)>LIMITS.directoryBytes) throw new Error('experiment output directory exceeds 10MiB');
  const report={date:'2026-10-02',engine:{path:exe,version,sha256:exeHash,language:'chi_sim',modelCommit:manifest.commit,modelSha256:manifest.modelSha256,licenseName:manifest.licenseName,licenseSha256:manifest.licenseSha256,oem:3,psm:6,ompThreadLimit:1},inputs:inputRecords,totalInputBytes:totalInput,startedAt:new Date(started).toISOString(),elapsedMs:Date.now()-started,totalOutputBytes:totalOutput,totalTextChars:totalChars,pages,tesseractSoftMonitor:{path:'monitor-*.jsonl',readyHandshakeTimeoutMs:5_000,sampleIntervalMs:LIMITS.sampleMs,maxObservedGapMs:Math.max(...pages.map(page=>page.monitorMaxGapMs??0)),workingSetStopLineBytes:LIMITS.workingSetSoftBytes,kind:'soft sampled stop line; not a hard RSS cap',singleProcessKillAndWait:true,processTreeKill:false},candidateSummary:{automaticGoldComparison:false,manualFieldComparisonRequired:true},fixedSampleOcr:'candidate-only',gate2:'NOT_PASSED',sourceOrPublicationWrites:false};
  await writeFile(join(OUT,'run.json'),JSON.stringify(report,null,2));
  console.log(`OCR baseline done pages=${pages.length} candidate_only=true elapsed_ms=${report.elapsedMs}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode=process.argv[2];
  (mode==='prepare'?prepare():mode==='run'?run():Promise.reject(new Error('usage: node scripts/fiscal/ocr-scan-poc.ts <prepare|run>'))).catch(err=>{console.error(String(err));process.exitCode=1;});
}
