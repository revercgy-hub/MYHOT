import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIMITS = Object.freeze({
  requests: 3, requestMs: 30_000, modelBytes: 32 * 1024 * 1024, metadataBytes: 1024 * 1024,
  pagePixels: 25_000_000, pageBytes: 20 * 1024 * 1024, totalInputBytes: 100 * 1024 * 1024,
  pageMs: 30_000, runMs: 180_000, pageOutputBytes: 1024 * 1024, outputBytes: 5 * 1024 * 1024,
  textChars: 120_000, workingSetSoftBytes: 512 * 1024 * 1024, sampleMs: 200, directoryBytes: 10 * 1024 * 1024,
});
// This PoC never enables native OCR until the Windows monitor/kill-wait path has independent fake-process validation.
export const OCR_RUN_ENABLED = false;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, '.data/fiscal-qa/scan-ocr-poc');
const MODEL_URL_BASE = 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast';
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

export function assertPreparedManifest(manifest: any, modelBytes?: Buffer): void {
  if (manifest?.trainedDataComplete !== true || manifest?.runnable !== true) throw new Error('prepared chi_sim data is incomplete; run is forbidden');
  if (!modelBytes || !manifest.modelSha256 || sha256(modelBytes) !== manifest.modelSha256 || modelBytes.length > LIMITS.modelBytes) throw new Error('chi_sim data missing, changed, or over limit');
}

async function boundedFetch(url: string, maxBytes: number, log: any[]): Promise<Buffer> {
  if (log.length >= LIMITS.requests) throw new Error('request budget exhausted');
  const entry: any = { number: log.length + 1, url, startedAt: new Date().toISOString(), redirect: 'manual' };
  log.push(entry); // Count at the actual fetch call boundary, including failures.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIMITS.requestMs);
  try {
    const response = await fetch(url, { redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': 'AIHOT-local-OCR-PoC/1.0', Accept: '*/*' } });
    entry.status = response.status;
    if (response.status >= 300 && response.status < 400) throw new Error(`redirect rejected (${response.status})`);
    if (response.status !== 200) throw new Error(`unexpected HTTP ${response.status}`);
    const chunks: Buffer[] = []; let total = 0; entry.bytesReceived = 0;
    if (!response.body) throw new Error('empty response stream');
    for await (const chunk of response.body) {
      const b = Buffer.from(chunk); total += b.length;
      entry.bytesReceived = total;
      if (total > maxBytes) { await response.body.cancel().catch(() => {}); throw new Error(`response exceeds ${maxBytes} bytes`); }
      chunks.push(b);
    }
    const result = Buffer.concat(chunks); entry.bytes = result.length; entry.sha256 = sha256(result); entry.completedAt = new Date().toISOString();
    return result;
  } catch (error) { entry.error = String(error); throw error; }
  finally { clearTimeout(timer); }
}

export async function prepare(): Promise<void> {
  await mkdir(join(OUT, 'tessdata'), { recursive: true });
  for (const name of ['prepare-failure.json', 'upstream.json', 'manifest.json']) {
    try { await stat(join(OUT, name)); throw new Error(`one-shot prepare already attempted: ${name}; do not retry`); }
    catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
  }
  const requests: any[] = [];
  try {
    const metaBytes = await boundedFetch('https://api.github.com/repos/tesseract-ocr/tessdata_fast/commits/main', LIMITS.metadataBytes, requests);
    const meta = JSON.parse(metaBytes.toString('utf8'));
    if (!/^[0-9a-f]{40}$/iu.test(meta.sha)) throw new Error('official commit API did not return full SHA');
    const commit = meta.sha.toLowerCase();
    const model = await boundedFetch(`${MODEL_URL_BASE}/${commit}/chi_sim.traineddata`, LIMITS.modelBytes, requests);
    const license = await boundedFetch(`${MODEL_URL_BASE}/${commit}/LICENSE`, LIMITS.metadataBytes, requests);
    await writeFile(join(OUT, 'tessdata/chi_sim.traineddata'), model, { flag: 'wx' });
    await writeFile(join(OUT, 'LICENSE'), license, { flag: 'wx' });
    await writeFile(join(OUT, 'upstream.json'), JSON.stringify({ repository: 'tesseract-ocr/tessdata_fast', commit, metadataUrl: 'https://api.github.com/repos/tesseract-ocr/tessdata_fast/commits/main', modelUrl: `${MODEL_URL_BASE}/${commit}/chi_sim.traineddata`, licenseUrl: `${MODEL_URL_BASE}/${commit}/LICENSE`, retrievedAt: new Date().toISOString(), modelBytes: model.length, modelSha256: sha256(model), licenseBytes: license.length, licenseSha256: sha256(license), licenseName: 'LICENSE at pinned commit', requests }, null, 2));
    await writeFile(join(OUT, 'manifest.json'), JSON.stringify({ schemaVersion: 1, status: 'complete', trainedDataComplete: true, runnable: true, commit, modelSha256: sha256(model), modelBytes: model.length, language: 'chi_sim', licenseSha256: sha256(license) }, null, 2));
    console.log(`prepared commit=${commit} model_bytes=${model.length} license_bytes=${license.length}`);
  } catch (error) {
    await writeFile(join(OUT, 'prepare-failure.json'), JSON.stringify({ error: String(error), requests }, null, 2));
    await writeFile(join(OUT, 'manifest.json'), JSON.stringify({ schemaVersion: 1, status: 'incomplete', trainedDataComplete: false, runnable: false, modelSha256: null, language: 'chi_sim', reason: String(error), requests }, null, 2));
    throw error;
  }
}

function pngDimensions(buf: Buffer): { width: number; height: number } {
  if (buf.length < 24 || buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || buf.toString('ascii', 12, 16) !== 'IHDR') throw new Error('invalid PNG header');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function invokeTesseract(exe: string, image: string, outBase: string, tessdata: string, elapsedBeforeMs: number, runtimeLog: any): Promise<void> {
  const remaining = Math.min(LIMITS.pageMs, LIMITS.runMs - elapsedBeforeMs);
  if (remaining <= 0) throw new Error('total runtime budget exhausted');
  const args = [image, outBase, '-l', 'chi_sim', '--oem', '3', '--psm', '6', '--tessdata-dir', tessdata, 'txt', 'tsv'];
  const started = Date.now();
  const safeEnv: NodeJS.ProcessEnv = { OMP_THREAD_LIMIT: '1' };
  for (const name of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'PATH']) if (process.env[name]) safeEnv[name] = process.env[name];
  const child = spawn(exe, args, { windowsHide: true, env: safeEnv, stdio: ['ignore', 'ignore', 'pipe'] });
  runtimeLog.pid = child.pid;
  let stderrBytes = 0, killed = false, killReason = '';
  const stderr: Buffer[] = [];
  child.stderr.on('data', (chunk: Buffer) => {
    stderrBytes += chunk.length;
    if (stderrBytes <= LIMITS.pageOutputBytes) stderr.push(chunk);
    else { killReason = 'stderr output limit'; try { child.kill(); killed = true; } catch {} }
  });
  let processClosed = false;
  let childError: Error | undefined;
  const closed = new Promise<void>(resolvePromise => {
    child.once('error', error => { childError = error; try { child.kill(); } catch {} });
    child.once('close', () => { processClosed = true; resolvePromise(); });
  });
  if (!child.pid) { try { child.kill(); } catch {} await closed; throw new Error(`Tesseract failed to spawn: ${childError ?? 'missing pid'}`); }
  const samplePath = join(OUT, `monitor-${runtimeLog.pageId}.jsonl`);
  const monitor = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$ErrorActionPreference='Stop'; $p=[Diagnostics.Process]::GetProcessById(${child.pid}); $f=[IO.StreamWriter]::new('${samplePath.replaceAll("'", "''")}', $false); $peak=0; $i=0; try { while(-not $p.HasExited) { $p.Refresh(); $ws=[long]$p.WorkingSet64; if($ws -gt $peak){$peak=$ws}; $i++; $f.WriteLine((@{at=[DateTime]::UtcNow.ToString('o');workingSetBytes=$ws;sampleMs=100} | ConvertTo-Json -Compress)); $f.Flush(); if($ws -gt ${LIMITS.workingSetSoftBytes}) { $p.Kill(); $p.WaitForExit(); $f.WriteLine((@{kill='single-process';reason='working-set-soft-line';peakWorkingSetBytes=$peak;waited=$true;at=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress)); break }; Start-Sleep -Milliseconds 100 }; if($p.HasExited){$p.WaitForExit()}; $f.WriteLine((@{exitCode=$p.ExitCode;peakWorkingSetBytes=$peak;waited=$true;samples=$i;at=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress)) } finally {$f.Dispose();$p.Dispose()}`], { windowsHide: true, stdio: 'ignore' });
  let monitorError: Error | undefined;
  let monitorExitCode: number | null = null;
  monitor.once('error', error => { monitorError = error; if (!processClosed) { killReason = 'resource monitor failed'; killed = true; try { child.kill(); } catch {} } });
  const monitorClosed = new Promise<number | null>(resolveCode => monitor.once('close', code => {
    monitorExitCode = code;
    if (!processClosed) { killReason = 'resource monitor exited before Tesseract'; killed = true; try { child.kill(); } catch {} }
    resolveCode(code);
  }));
  const startedAt = Date.now();
  const watchdog = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    if (!processClosed && (elapsed > remaining || Date.now() - started > LIMITS.pageMs)) { killReason = elapsed > LIMITS.pageMs ? 'page deadline' : 'total deadline'; try { child.kill(); killed = true; } catch {} }
    void Promise.all(['.txt', '.tsv'].map(ext => stat(`${outBase}${ext}`).then(s => s.size).catch(() => 0)))
      .then(sizes => { if (sizes[0] + sizes[1] + stderrBytes > LIMITS.pageOutputBytes && !processClosed) { killReason = 'combined page output limit'; try { child.kill(); killed = true; } catch {} } });
  }, 100);
  try { await closed; } finally { clearInterval(watchdog); }
  await monitorClosed;
  if (childError) throw new Error(`Tesseract process error: ${childError}`);
  if (monitorError || monitorExitCode !== 0) throw new Error(`resource monitor failed: ${monitorError ?? `exit ${monitorExitCode}`}`);
  const monitorRows = (await readFile(samplePath, 'utf8')).trim().split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line));
  const sampleRows = monitorRows.filter(row => Number.isFinite(row.workingSetBytes));
  if (!sampleRows.length || monitorRows.at(-1)?.waited !== true) throw new Error('resource monitor had no samples or did not confirm wait completion');
  let maxGapMs = 0;
  for (let i=1;i<sampleRows.length;i++) maxGapMs=Math.max(maxGapMs,Date.parse(sampleRows[i].at)-Date.parse(sampleRows[i-1].at));
  runtimeLog.workingSetPeakBytes = Math.max(...sampleRows.map(row => row.workingSetBytes));
  runtimeLog.monitorSamples = sampleRows.length;
  runtimeLog.monitorMaxGapMs = maxGapMs;
  if(maxGapMs>250) throw new Error(`resource monitor sample gap ${maxGapMs}ms exceeded 250ms`);
  const stderrBuf = Buffer.concat(stderr); await writeFile(`${outBase}.stderr`, stderrBuf);
  runtimeLog.elapsedMs = Date.now() - started; runtimeLog.stderrBytes = stderrBytes; runtimeLog.killed = killed; runtimeLog.killReason = killReason || null;
  if (killed) throw new Error(`Tesseract terminated: ${killReason}`);
  if (child.exitCode !== 0) throw new Error(`Tesseract exit ${child.exitCode}: ${stderrBuf.toString('utf8')}`);
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
  if (!OCR_RUN_ENABLED) throw new Error('OCR run is disabled: resource monitor and timeout/kill-wait behavior are not validated');
  const manifest = JSON.parse(await readFile(join(OUT, 'manifest.json'), 'utf8'));
  assertPreparedManifest(manifest);
  const modelPath = join(OUT, 'tessdata/chi_sim.traineddata');
  const model = await readFile(modelPath);
  assertPreparedManifest(manifest, model);
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
  const report={date:'2026-09-30',engine:{path:exe,version,sha256:exeHash,language:'chi_sim',modelCommit:manifest.commit,modelSha256:manifest.modelSha256,oem:3,psm:6,ompThreadLimit:1},inputs:inputRecords,totalInputBytes:totalInput,startedAt:new Date(started).toISOString(),elapsedMs:Date.now()-started,totalOutputBytes:totalOutput,totalTextChars:totalChars,pages,tesseractSoftMonitor:{path:'monitor-*.jsonl',sampleIntervalMs:100,workingSetStopLineBytes:LIMITS.workingSetSoftBytes,kind:'soft sampled stop line; not a hard RSS cap',singleProcessKillAndWait:true},candidateSummary:{automaticGoldComparison:false,manualFieldComparisonRequired:true},fixedSampleOcr:'candidate-only',gate2:'NOT_PASSED',sourceOrPublicationWrites:false};
  await writeFile(join(OUT,'run.json'),JSON.stringify(report,null,2));
  console.log(`OCR baseline done pages=${pages.length} candidate_only=true elapsed_ms=${report.elapsedMs}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode=process.argv[2];
  (mode==='prepare'?prepare():mode==='run'?run():Promise.reject(new Error('usage: node scripts/fiscal/ocr-scan-poc.ts <prepare|run>'))).catch(err=>{console.error(String(err));process.exitCode=1;});
}
