import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIMITS = Object.freeze({
  requests: 3, requestMs: 120_000, prepareMs: 240_000, modelBytes: 32 * 1024 * 1024, licenseBytes: 1024 * 1024,
  metadataBytes: 1024 * 1024, metadataEntries: 1000, apiJsonOverheadBytes: 64 * 1024,
  pagePixels: 25_000_000, pageBytes: 20 * 1024 * 1024, totalInputBytes: 100 * 1024 * 1024,
  pageMs: 30_000, runMs: 180_000, pageOutputBytes: 1024 * 1024, outputBytes: 5 * 1024 * 1024,
  textChars: 120_000, workingSetSoftBytes: 512 * 1024 * 1024, sampleMs: 20, directoryBytes: 10 * 1024 * 1024,
  cleanupMs: 5_000, monitorLogBytes: 1024 * 1024, monitorLineBytes: 4 * 1024,
});
// The run lock remains closed until the complete approved model/license and all required execution evidence exist.
export const OCR_RUN_ENABLED = false;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, '.data/fiscal-qa/scan-ocr-poc-20261003');
const API_BASE = 'https://api.github.com/repos/tesseract-ocr/tessdata_fast';
const APPROVED_MODEL_COMMIT = '87416418657359cb625c412a48b6e1d6d41c29bd';
const ROOT_CONTENTS_URL = `${API_BASE}/contents?ref=${APPROVED_MODEL_COMMIT}`;
const MODEL_PATH = 'chi_sim.traineddata';
const LICENSE_PATH = 'LICENSE';
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

export function gitBlobSha1(bytes: Buffer): string {
  return createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`, 'ascii')).update(bytes).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireJson(bytes: Buffer, label: string): unknown {
  try { return JSON.parse(bytes.toString('utf8')); }
  catch { throw new Error(`${label} JSON is invalid`); }
}

function requireFileIdentity(value: unknown, path: string, maxBytes: number): { path: string; sha: string; size: number } {
  if (!isRecord(value) || value.type !== 'file' || value.name !== path || value.path !== path) throw new Error(`pinned directory entry invalid for ${path}`);
  if (typeof value.sha !== 'string' || !/^[a-f0-9]{40}$/u.test(value.sha)) throw new Error(`pinned blob SHA invalid for ${path}`);
  if (!Number.isSafeInteger(value.size) || (value.size as number) <= 0 || (value.size as number) > maxBytes) throw new Error(`pinned blob size invalid for ${path}`);
  return { path, sha: value.sha, size: value.size as number };
}

export function parsePinnedRootDirectory(bytes: Buffer): { model: { path: string; sha: string; size: number }; license: { path: string; sha: string; size: number } } {
  if (bytes.length > LIMITS.metadataBytes) throw new Error('root directory JSON exceeds 1 MiB');
  const entries = requireJson(bytes, 'root directory');
  if (!Array.isArray(entries) || entries.length > LIMITS.metadataEntries) throw new Error('root directory shape or entry count invalid');
  const models = entries.filter(item => isRecord(item) && (item.name === MODEL_PATH || item.path === MODEL_PATH));
  const licenses = entries.filter(item => isRecord(item) && (item.name === LICENSE_PATH || item.path === LICENSE_PATH));
  if (models.length !== 1 || licenses.length !== 1) throw new Error('root directory must contain one unique model and LICENSE entry');
  const model = requireFileIdentity(models[0], MODEL_PATH, LIMITS.modelBytes);
  const license = requireFileIdentity(licenses[0], LICENSE_PATH, LIMITS.licenseBytes);
  if (model.sha === license.sha) throw new Error('model and license must have distinct blob identities');
  return { model, license };
}

function base64Length(size: number): number { return 4 * Math.ceil(size / 3); }
function blobResponseCap(size: number): number { return 2 * base64Length(size) + LIMITS.apiJsonOverheadBytes; }

export function decodeCanonicalBase64(value: string, expectedSize: number): Buffer {
  if (typeof value !== 'string' || expectedSize <= 0) throw new Error('blob Base64 content or size invalid');
  // GitHub may wrap Base64 at line boundaries. Allow LF/CRLF only between complete quartets.
  if (/\r(?!\n)|[^\x00-\x7f]/u.test(value)) throw new Error('blob Base64 contains unsupported whitespace or characters');
  const lines = value.split(/\r?\n/u);
  if (lines.some((line, index) => line.length === 0 && index !== lines.length - 1)) throw new Error('blob Base64 contains an empty wrapped line');
  for (const line of lines.slice(0, -1)) if (line.length % 4 !== 0) throw new Error('blob Base64 line break is not on a quartet boundary');
  const compact = lines.join('');
  if (compact.length !== base64Length(expectedSize) || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(compact)) throw new Error('blob Base64 alphabet or padding invalid');
  const decoded = Buffer.from(compact, 'base64');
  if (decoded.length !== expectedSize || decoded.toString('base64') !== compact) throw new Error('blob Base64 is not canonical or has the wrong size');
  return decoded;
}

function parseBlobJson(bytes: Buffer, identity: { path: string; sha: string; size: number }): Buffer {
  if (bytes.length > blobResponseCap(identity.size)) throw new Error(`blob JSON exceeds encoded cap for ${identity.path}`);
  const response = requireJson(bytes, `blob ${identity.path}`);
  if (!isRecord(response) || response.sha !== identity.sha || response.size !== identity.size || response.encoding !== 'base64' || typeof response.content !== 'string') throw new Error(`blob JSON identity invalid for ${identity.path}`);
  const decoded = decodeCanonicalBase64(response.content, identity.size);
  if (gitBlobSha1(decoded) !== identity.sha) throw new Error(`decoded Git blob SHA mismatch for ${identity.path}`);
  return decoded;
}

export function assertPreparedManifest(manifest: any, modelBytes?: Buffer, licenseBytes?: Buffer): void {
  if (manifest?.schemaVersion !== 1 || manifest?.status !== 'complete' || manifest?.trainedDataComplete !== true || manifest?.runnable !== true || manifest?.language !== 'chi_sim') throw new Error('prepared chi_sim data is incomplete; run is forbidden');
  if (manifest.repository !== 'tesseract-ocr/tessdata_fast' || manifest.commit !== APPROVED_MODEL_COMMIT || manifest.transport !== 'github-rest-git-blob-v1' || manifest.rootUrl !== ROOT_CONTENTS_URL) throw new Error('prepared data is not from the approved GitHub API profile');
  const model = manifest.files?.model, license = manifest.files?.license;
  const rootModel = manifest.rootEntries?.model, rootLicense = manifest.rootEntries?.license;
  if (!isRecord(rootModel) || rootModel.path !== MODEL_PATH || !isRecord(model) || model.path !== MODEL_PATH || model.blobSha !== rootModel.sha || model.size !== rootModel.size || model.url !== `${API_BASE}/git/blobs/${model.blobSha}`) throw new Error('model API blob identity is not pinned');
  if (!isRecord(rootLicense) || rootLicense.path !== LICENSE_PATH || !isRecord(license) || license.path !== LICENSE_PATH || license.blobSha !== rootLicense.sha || license.size !== rootLicense.size || license.url !== `${API_BASE}/git/blobs/${license.blobSha}`) throw new Error('license API blob identity is not pinned');
  if (!/^[a-f0-9]{40}$/u.test(String(model.blobSha)) || !/^[a-f0-9]{40}$/u.test(String(license.blobSha)) || model.blobSha === license.blobSha) throw new Error('prepared blob SHA invalid');
  if (!modelBytes || modelBytes.length === 0 || modelBytes.length !== model.size || modelBytes.length !== manifest.rootEntries.model.size || modelBytes.length > LIMITS.modelBytes || !manifest.modelSha256 || sha256(modelBytes) !== manifest.modelSha256 || gitBlobSha1(modelBytes) !== model.blobSha) throw new Error('chi_sim data missing, changed, or over limit');
  if (!licenseBytes || licenseBytes.length === 0 || licenseBytes.length !== license.size || licenseBytes.length !== manifest.rootEntries.license.size || licenseBytes.length > LIMITS.licenseBytes || !manifest.licenseSha256 || sha256(licenseBytes) !== manifest.licenseSha256 || gitBlobSha1(licenseBytes) !== license.blobSha) throw new Error('pinned Apache-2.0 license text missing, changed, or over limit');
  if (model.sha256 !== manifest.modelSha256 || manifest.modelBytes !== modelBytes.length || license.sha256 !== manifest.licenseSha256 || manifest.licenseBytes !== licenseBytes.length) throw new Error('prepared file hashes and sizes are inconsistent');
  const expectedUrls = [ROOT_CONTENTS_URL, model.url, license.url];
  const validRequest = (entry: unknown, index: number) => isRecord(entry) && entry.url === expectedUrls[index] && entry.status === 200 && entry.eofComplete === true && typeof entry.bytesReceived === 'number' && Number.isSafeInteger(entry.bytesReceived) && entry.bytesReceived > 0 && (entry.contentLength === null || entry.contentLength === undefined || (typeof entry.contentLength === 'number' && entry.contentLength === entry.bytesReceived));
  if (!Array.isArray(manifest.requests) || manifest.requests.length !== LIMITS.requests || manifest.requests.some((entry: unknown, index: number) => !validRequest(entry, index))) throw new Error('prepared request provenance is incomplete or inconsistent');
  const licenseText = licenseBytes.toString('utf8');
  if (manifest.licenseName !== 'Apache-2.0' || !licenseText.includes('Apache License') || !licenseText.includes('Version 2.0')) throw new Error('pinned license text is not identified as Apache-2.0');
}

type RequestRecord = { number: number; url: string; startedAt: string; endedAt?: string; elapsedMs?: number; status?: number; contentLength?: number | null; bytesReceived: number; eofComplete: boolean; error?: Record<string, string> };

function safeError(error: unknown): Record<string, string> {
  const errorRecord = isRecord(error) ? error : {};
  const cause = isRecord(errorRecord.cause) ? errorRecord.cause : {};
  const safeText = (value: unknown, max: number) => typeof value === 'string'
    ? value.replace(/https?:\/\/[^\s"'<>]+/giu, '[url]').replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/gu, '[endpoint]').replace(/(?:token|authorization|password|secret)[=:]\S+/giu, '[redacted]').slice(0, max)
    : '';
  const safeCode = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,80}$/u.test(value) ? value : '';
  const result: Record<string, string> = {};
  const name = safeCode(errorRecord.name); if (name) result.name = name;
  const message = safeText(errorRecord.message, 240); if (message) result.message = message;
  const causeName = safeCode(cause.name); if (causeName) result.causeName = causeName;
  for (const key of ['code', 'errno', 'syscall'] as const) {
    const topValue = safeCode(errorRecord[key]); if (topValue) result[key] = topValue;
    const causeValue = safeCode(cause[key]); if (causeValue) result[`cause${key[0].toUpperCase()}${key.slice(1)}`] = causeValue;
  }
  return result;
}

async function boundedApiFetch(url: string, maxWireBytes: number, log: RequestRecord[], fetchImpl: typeof fetch, totalDeadline: number, requestMs: number): Promise<Buffer> {
  const allowed = url === ROOT_CONTENTS_URL || /^[a-f0-9]{40}$/u.test(url.slice(`${API_BASE}/git/blobs/`.length)) && url.startsWith(`${API_BASE}/git/blobs/`);
  if (!allowed || !url.startsWith(`${API_BASE}/`)) throw new Error('request URL is outside the approved GitHub API allowlist');
  if (log.some(entry => entry.url === url)) throw new Error('approved API URL already attempted; do not retry');
  if (log.length >= LIMITS.requests) throw new Error('API request budget exhausted');
  const requestStarted = Date.now();
  const timeoutMs = Math.min(requestMs, totalDeadline - requestStarted);
  if (timeoutMs <= 0) throw new Error('prepare total deadline exhausted before request admission');
  const entry: RequestRecord = { number: log.length + 1, url, startedAt: new Date(requestStarted).toISOString(), bytesReceived: 0, eofComplete: false };
  log.push(entry); // Admission is recorded immediately before the fetch call, including failures.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': 'AIHOT-local-OCR-PoC/1.0', Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
    entry.status = response.status;
    if (response.status >= 300 && response.status < 400) throw new Error(`redirect rejected (${response.status})`);
    if (response.status !== 200) throw new Error(`unexpected HTTP ${response.status}`);
    const contentLengthHeader = response.headers.get('content-length');
    if (contentLengthHeader !== null && !/^\d+$/u.test(contentLengthHeader)) throw new Error('invalid Content-Length header');
    const expectedBytes = contentLengthHeader === null ? null : Number(contentLengthHeader);
    if (expectedBytes !== null && !Number.isSafeInteger(expectedBytes)) throw new Error('invalid Content-Length value');
    entry.contentLength = expectedBytes;
    const chunks: Buffer[] = []; let total = 0; entry.bytesReceived = 0;
    if (!response.body) throw new Error('empty response stream');
    for await (const chunk of response.body) {
      const b = Buffer.from(chunk); total += b.length;
      entry.bytesReceived = total;
      if (total > maxWireBytes) { await response.body.cancel().catch(() => {}); throw new Error(`response exceeds encoded cap ${maxWireBytes}`); }
      chunks.push(b);
    }
    if (expectedBytes !== null && total !== expectedBytes) throw new Error(`incomplete response: content-length ${expectedBytes}, received ${total}`);
    const result = Buffer.concat(chunks); entry.eofComplete = true;
    return result;
  } catch (error) { entry.error = safeError(error); throw error; }
  finally { clearTimeout(timer); entry.endedAt = new Date().toISOString(); entry.elapsedMs = Date.now() - requestStarted; }
}

function assertOutputScope(outDir: string, workspaceRoot: string): string {
  const expected = resolve(workspaceRoot, '.data/fiscal-qa/scan-ocr-poc-20261003');
  if (resolve(outDir) !== expected) throw new Error('prepare output path is outside the fixed ignored batch directory');
  return expected;
}

export async function assertPrepareNotAttempted(outDir: string): Promise<void> {
  for (const name of ['prepare-attempt.json', 'prepare-failure.json', 'upstream.json', 'manifest.json', 'LICENSE', 'tessdata/chi_sim.traineddata', '.tmp-model', '.tmp-license', '.tmp-manifest']) {
    try { await stat(join(outDir, name)); throw new Error(`one-shot prepare already attempted: ${name}; do not retry`); }
    catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
  }
}

type PrepareTestOptions = { requestMs?: number; prepareMs?: number };

export async function prepareForOfflineTest(workspaceRoot: string, outDir: string, fetchImpl: typeof fetch, budgets: PrepareTestOptions = {}): Promise<void> {
  const output = assertOutputScope(outDir, workspaceRoot);
  const prepareStarted = Date.now();
  const requestMs = budgets.requestMs ?? LIMITS.requestMs, prepareMs = budgets.prepareMs ?? LIMITS.prepareMs;
  if (!Number.isSafeInteger(requestMs) || requestMs < 1 || requestMs > LIMITS.requestMs || !Number.isSafeInteger(prepareMs) || prepareMs < 1 || prepareMs > LIMITS.prepareMs) throw new Error('prepare test budgets must remain within approved maximums');
  const totalDeadline = prepareStarted + prepareMs;
  await mkdir(join(output, 'tessdata'), { recursive: true });
  await assertPrepareNotAttempted(output);
  const requests: RequestRecord[] = [];
  await writeFile(join(output, 'prepare-attempt.json'), JSON.stringify({ startedAt: new Date(prepareStarted).toISOString(), repository: 'tesseract-ocr/tessdata_fast', commit: APPROVED_MODEL_COMMIT, rootUrl: ROOT_CONTENTS_URL, paths: [MODEL_PATH, LICENSE_PATH], requestLimit: LIMITS.requests }, null, 2), { flag: 'wx' });
  const tempFiles = [join(output, '.tmp-model'), join(output, '.tmp-license'), join(output, '.tmp-manifest')];
  const finalFiles = [join(output, 'tessdata/chi_sim.traineddata'), join(output, 'LICENSE'), join(output, 'upstream.json'), join(output, 'manifest.json')];
  const timeLeft = () => totalDeadline - Date.now();
  try {
    const request = async (url: string, cap: number) => {
      if (timeLeft() <= 0) throw new Error('prepare total deadline exhausted before request admission');
      const result = await boundedApiFetch(url, cap, requests, fetchImpl, totalDeadline, requestMs);
      if (timeLeft() <= 0) throw new Error('prepare total deadline exhausted after response');
      return result;
    };
    const parseLast = <T>(fn: () => T): T => {
      try { return fn(); }
      catch (error) { const last = requests.at(-1); if (last) last.error = safeError(error); throw error; }
    };
    const rootBytes = await request(ROOT_CONTENTS_URL, LIMITS.metadataBytes);
    const root = parseLast(() => parsePinnedRootDirectory(rootBytes));
    const modelUrl = `${API_BASE}/git/blobs/${root.model.sha}`;
    const licenseUrl = `${API_BASE}/git/blobs/${root.license.sha}`;
    const modelWire = await request(modelUrl, blobResponseCap(root.model.size));
    const model = parseLast(() => parseBlobJson(modelWire, root.model));
    const licenseWire = await request(licenseUrl, blobResponseCap(root.license.size));
    const license = parseLast(() => parseBlobJson(licenseWire, root.license));
    if (model.length + license.length > LIMITS.modelBytes + LIMITS.licenseBytes) throw new Error('combined decoded files exceed 33 MiB');
    const licenseText = license.toString('utf8');
    if (!licenseText.includes('Apache License') || !licenseText.includes('Version 2.0')) throw new Error('pinned repository LICENSE is not Apache-2.0');
    const manifest = {
      schemaVersion: 1, status: 'complete', trainedDataComplete: true, runnable: true, language: 'chi_sim',
      repository: 'tesseract-ocr/tessdata_fast', commit: APPROVED_MODEL_COMMIT, transport: 'github-rest-git-blob-v1', rootUrl: ROOT_CONTENTS_URL,
      rootEntries: { model: root.model, license: root.license },
      files: {
        model: { path: MODEL_PATH, blobSha: root.model.sha, size: model.length, url: modelUrl, sha256: sha256(model) },
        license: { path: LICENSE_PATH, blobSha: root.license.sha, size: license.length, url: licenseUrl, sha256: sha256(license) },
      },
      modelSha256: sha256(model), modelBytes: model.length, licenseSha256: sha256(license), licenseBytes: license.length,
      licenseName: 'Apache-2.0', requests, startedAt: new Date(prepareStarted).toISOString(), elapsedMs: Date.now() - prepareStarted,
    };
    assertPreparedManifest(manifest, model, license);
    const upstream = { ...manifest, modelGitBlobSha1: root.model.sha, licenseGitBlobSha1: root.license.sha, modelSha256: sha256(model), modelBytes: model.length, licenseSha256: sha256(license), licenseBytes: license.length };
    if (timeLeft() <= 0) throw new Error('prepare total deadline exhausted before staging files');
    await writeFile(tempFiles[0], model, { flag: 'wx' });
    if (timeLeft() <= 0) throw new Error('prepare total deadline exhausted while staging model');
    await writeFile(tempFiles[1], license, { flag: 'wx' });
    if (timeLeft() <= 0) throw new Error('prepare total deadline exhausted while staging license');
    await writeFile(tempFiles[2], JSON.stringify(manifest, null, 2), { flag: 'wx' });
    await rename(tempFiles[0], finalFiles[0]);
    await rename(tempFiles[1], finalFiles[1]);
    await writeFile(finalFiles[2], JSON.stringify(upstream, null, 2), { flag: 'wx' });
    if (timeLeft() <= 0) throw new Error('prepare total deadline exhausted before complete manifest');
    await rename(tempFiles[2], finalFiles[3]);
    if (timeLeft() < 0) throw new Error('prepare total deadline exhausted while committing manifest');
    console.log(`prepared commit=${APPROVED_MODEL_COMMIT} model_bytes=${model.length} license_bytes=${license.length}`);
  } catch (error) {
    await Promise.all([...tempFiles, ...finalFiles].map(path => rm(path, { force: true }).catch(() => {})));
    const failure = { error: safeError(error), requests, startedAt: new Date(prepareStarted).toISOString(), endedAt: new Date().toISOString(), elapsedMs: Date.now() - prepareStarted };
    await writeFile(join(output, 'prepare-failure.json'), JSON.stringify(failure, null, 2), { flag: 'wx' });
    await writeFile(join(output, 'manifest.json'), JSON.stringify({ schemaVersion: 1, status: 'incomplete', trainedDataComplete: false, runnable: false, language: 'chi_sim', repository: 'tesseract-ocr/tessdata_fast', commit: APPROVED_MODEL_COMMIT, transport: 'github-rest-git-blob-v1', rootUrl: ROOT_CONTENTS_URL, requests }, null, 2), { flag: 'wx' });
    throw error;
  }
}

export async function prepare(): Promise<void> { return prepareForOfflineTest(ROOT, OUT, fetch); }

function pngDimensions(buf: Buffer): { width: number; height: number } {
  if (buf.length < 24 || buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || buf.toString('ascii', 12, 16) !== 'IHDR') throw new Error('invalid PNG header');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

type ProcessBudgetKey = 'pageMs' | 'runMs' | 'pageOutputBytes' | 'workingSetSoftBytes' | 'cleanupMs' | 'monitorLogBytes' | 'monitorLineBytes' | 'directoryBytes';
type ProcessBudget = { [K in ProcessBudgetKey]: number };
type ProcessHooks = {
  /** Test seam for a local fake child. Production always uses the fixed Tesseract arguments below. */
  childArgs?: string[];
  /** Fake monitor seam; it follows the production READY/stdin-PID/sample-stdout handshake. */
  monitorCommand?: string;
  monitorArgs?: (pid: number, samplePath: string, workingSetSoftBytes: number) => string[];
  samplePath?: string;
  /** Fixed single-page callers may audit every regular file in their dedicated output directory. */
  directoryPath?: string;
  budget?: Partial<ProcessBudget>;
};

export async function invokeTesseract(exe: string, image: string, outBase: string, tessdata: string, elapsedBeforeMs: number, runtimeLog: any, hooks: ProcessHooks = {}): Promise<void> {
  const budget: ProcessBudget = { ...LIMITS, ...hooks.budget };
  const totalRemaining = budget.runMs - elapsedBeforeMs;
  // Reserve the maximum cleanup grace inside the total budget before admitting
  // either monitor or child; cleanup must never extend the 180s wall-clock cap.
  const remaining = Math.min(budget.pageMs, totalRemaining - budget.cleanupMs);
  if (remaining <= 0) throw new Error('total runtime budget exhausted');
  const args = hooks.childArgs ?? [image, outBase, '-l', 'chi_sim', '--oem', '3', '--psm', '6', '--tessdata-dir', tessdata, 'txt', 'tsv'];
  const started = Date.now();
  const totalDeadline = started + totalRemaining;
  const safeEnv: NodeJS.ProcessEnv = { OMP_THREAD_LIMIT: '1' };
  for (const name of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'PATH']) if (process.env[name]) safeEnv[name] = process.env[name];
  // Windows/libuv fills these identity variables for child processes even when omitted; clear them explicitly.
  for (const name of ['HOMEDRIVE', 'HOMEPATH', 'LOGONSERVER', 'SYSTEMDRIVE', 'USERDOMAIN', 'USERNAME', 'USERPROFILE']) safeEnv[name] = '';
  let stderrBytes = 0, monitorStdoutBytes = 0, monitorStderrBytes = 0, killed = false, killReason = '';
  const stderr: Buffer[] = [];
  let processClosed = false;
  let childExitCode: number | null = null;
  let childSignal: NodeJS.Signals | null = null;
  let childClosedAt: string | undefined;
  let childError: Error | undefined;
  let spawnFailedWithoutPid = false;
  let child: ReturnType<typeof spawn> | undefined;
  const terminate = (reason: string) => {
    if (processClosed || !child) return;
    if (!killed) killReason = reason;
    try { killed = child.kill() || killed; } catch {}
  };
  const stopMonitor = () => { try { monitor.kill(); } catch {} };
  const waitUntil = async (promise: Promise<unknown>, deadline: number): Promise<boolean> => {
    const left = Math.max(0, deadline - Date.now());
    if (left === 0) return false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settled = await Promise.race([
      promise.then(() => true),
      new Promise<boolean>(resolvePromise => { timer = setTimeout(() => resolvePromise(false), left); }),
    ]);
    if (timer) clearTimeout(timer);
    return settled;
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
  const liveSampleRows: any[] = [];
  let readyResolve!: () => void;
  let readyReject!: (error: Error) => void;
  let monitorReady = false;
  let monitorStdoutBuffer = '';
  let monitorLineOverflow = false;
  const maxMonitorSamples = Math.ceil((remaining + budget.cleanupMs) / LIMITS.sampleMs) + 20;
  const readySignal = new Promise<void>((resolveReady, rejectReady) => { readyResolve = resolveReady; readyReject = rejectReady; });
  monitor.stdout?.on('data', (chunk: Buffer) => {
    monitorStdoutBytes += chunk.length;
    if (monitorStdoutBytes + monitorStderrBytes > budget.monitorLogBytes) {
      monitorError = new Error('monitor/control log byte limit exceeded');
      if (!monitorReady) readyReject(monitorError);
      terminate('monitor/control log byte limit');
      stopMonitor();
      return;
    }
    monitorStdoutBuffer += chunk.toString('utf8');
    if (Buffer.byteLength(monitorStdoutBuffer) > budget.monitorLineBytes && !monitorStdoutBuffer.includes('\n')) {
      monitorLineOverflow = true;
      monitorError = new Error('monitor line byte limit exceeded');
      if (!monitorReady) readyReject(monitorError);
      terminate('monitor line byte limit');
      stopMonitor();
      monitorStdoutBuffer = '';
      return;
    }
    const lines = monitorStdoutBuffer.split(/\r?\n/u);
    monitorStdoutBuffer = lines.pop() ?? '';
    if (Buffer.byteLength(monitorStdoutBuffer) > budget.monitorLineBytes) {
      monitorLineOverflow = true;
      monitorError = new Error('monitor line byte limit exceeded');
      if (!monitorReady) readyReject(monitorError);
      terminate('monitor line byte limit');
      stopMonitor();
      monitorStdoutBuffer = '';
    }
    for (const line of lines.filter(Boolean)) {
      if (Buffer.byteLength(line) > budget.monitorLineBytes) {
        monitorLineOverflow = true;
        monitorError = new Error('monitor line byte limit exceeded');
        if (!monitorReady) readyReject(monitorError);
        terminate('monitor line byte limit');
        stopMonitor();
        continue;
      }
      if (line === 'READY') { monitorReady = true; readyResolve(); continue; }
      try {
        const row = JSON.parse(line);
        if (Number.isFinite(row.workingSetBytes) && typeof row.at === 'string' && row.pid === runtimeLog.pid && liveSampleRows.length < maxMonitorSamples) liveSampleRows.push(row);
        else throw new Error('PID or sample fields did not match the target child');
      } catch (error) {
        monitorError = new Error(`invalid monitor sample: ${String(error)}; ${line.slice(0, 120)}`);
        if (!monitorReady) readyReject(monitorError);
        terminate('resource monitor invalid sample');
      }
    }
  });
  monitor.stderr?.on('data', (chunk: Buffer) => {
    monitorStderrBytes += chunk.length;
    if (monitorStdoutBytes + monitorStderrBytes > budget.monitorLogBytes) {
      monitorError = new Error('monitor/control log byte limit exceeded');
      if (!monitorReady) readyReject(monitorError);
      terminate('monitor/control log byte limit');
      stopMonitor();
    }
  });
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
    stopMonitor();
    const closedByCleanup = await waitUntil(monitorClosed, Math.min(Date.now() + budget.cleanupMs, totalDeadline));
    runtimeLog.monitorCloseObserved = monitorExitCode !== null;
    runtimeLog.monitorCleanupWaited = closedByCleanup;
    runtimeLog.cleanupTimeout = !closedByCleanup;
    if (monitorError) runtimeLog.monitorError = monitorError.message.slice(0, 240);
    if (monitorExitCode !== null) runtimeLog.monitorExitCode = monitorExitCode;
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
    child!.once('error', error => {
      childError = error;
      if (!child!.pid) {
        // Node reports an executable lookup failure without admitting a child PID.
        // Record no admission, resolve the lifecycle waiter, and still wait for monitor close.
        spawnFailedWithoutPid = true;
        processClosed = true;
        childClosedAt = new Date().toISOString();
        childExitCode = null;
        childSignal = null;
        resolvePromise();
      } else terminate('child process error');
    });
    child!.once('close', (code, signal) => { processClosed = true; childClosedAt = new Date().toISOString(); childExitCode = code; childSignal = signal; resolvePromise(); });
  });
  if (!child.pid) {
    monitor.stdin?.end();
    const pair = Promise.all([closed, monitorClosed]);
    let didClose = await waitUntil(pair, started + remaining);
    if (!didClose) {
      const cleanupDeadline = Math.min(Date.now() + budget.cleanupMs, totalDeadline, started + remaining + budget.cleanupMs);
      if (!processClosed) terminate('spawn failure cleanup');
      if (monitorExitCode === null) stopMonitor();
      didClose = await waitUntil(pair, cleanupDeadline);
    }
    runtimeLog.childSpawned = Boolean(child.pid);
    runtimeLog.childCloseObserved = Boolean(child.pid) && processClosed;
    runtimeLog.childSpawnFailureWithoutPid = spawnFailedWithoutPid;
    runtimeLog.monitorCloseObserved = monitorExitCode !== null;
    runtimeLog.childCloseWaited = spawnFailedWithoutPid || processClosed;
    runtimeLog.monitorCloseWaited = monitorExitCode !== null;
    runtimeLog.cleanupTimeout = !didClose || (!spawnFailedWithoutPid && !processClosed) || monitorExitCode === null;
    if (runtimeLog.cleanupTimeout) throw new Error(`Tesseract spawn cleanup timeout; child_closed=${processClosed}; monitor_closed=${monitorExitCode !== null}`);
    throw new Error(`Tesseract failed to spawn: ${childError ?? 'missing pid'}`);
  }
  monitor.stdin?.end(`${child.pid}\n`);
  const childStartedAt = Date.now();
  const sampleWatchdog = setInterval(() => {
    if (processClosed) return;
    const lastAt = liveSampleRows.length ? Date.parse(liveSampleRows.at(-1).at) : null;
    const overdue = lastAt === null ? Date.now() - childStartedAt > 250 : Date.now() - lastAt > 250;
    if (overdue) terminate(lastAt === null ? 'resource monitor first sample overdue' : 'resource monitor sample overdue');
  }, 25);
  const startedAt = started;
  let checking = false;
  const watchdog = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    if (!processClosed && (elapsed > remaining || Date.now() - started > budget.pageMs)) terminate(elapsed > budget.pageMs ? 'page deadline' : 'total deadline');
    if (checking) return;
    checking = true;
    void Promise.all([
      ...['.txt', '.tsv'].map(ext => stat(`${outBase}${ext}`).then(s => s.size).catch(() => 0)),
      stat(samplePath).then(s => s.size).catch(() => 0),
      hooks.directoryPath ? readdir(hooks.directoryPath, { withFileTypes: true }).then(async entries => {
        let total = 0;
        for (const entry of entries) {
          if (!entry.isFile()) throw new Error('single-page output directory contains a non-file entry');
          total += (await stat(join(hooks.directoryPath!, entry.name))).size;
        }
        return total;
      }).catch(() => Number.POSITIVE_INFINITY) : Promise.resolve(0),
    ]).then(sizes => {
      if (sizes[0] + sizes[1] + stderrBytes > budget.pageOutputBytes) terminate('combined page output limit');
      if (sizes[2] + monitorStdoutBytes + monitorStderrBytes > budget.monitorLogBytes) {
        monitorError = new Error('monitor/control log byte limit exceeded');
        terminate('monitor/control log byte limit');
        stopMonitor();
      }
      if (hooks.directoryPath && sizes[3] > (budget.directoryBytes ?? LIMITS.directoryBytes)) terminate('output directory byte limit');
    }).finally(() => { checking = false; });
  }, 100);
  const bothClosed = Promise.all([closed, monitorClosed]);
  let bothClosedByBudget = await waitUntil(bothClosed, started + remaining);
  if (!bothClosedByBudget) {
    if (!processClosed) terminate(Date.now() - started > budget.pageMs ? 'page deadline' : 'total deadline');
    const cleanupDeadline = Math.min(Date.now() + budget.cleanupMs, totalDeadline);
    const reserveForMonitorStop = Math.min(500, Math.floor(budget.cleanupMs / 2));
    bothClosedByBudget = await waitUntil(bothClosed, Math.max(Date.now(), cleanupDeadline - reserveForMonitorStop));
    if (!bothClosedByBudget) {
      if (!processClosed) terminate('cleanup timeout');
      if (monitorExitCode === null) stopMonitor();
      bothClosedByBudget = await waitUntil(bothClosed, cleanupDeadline);
    }
  }
  clearInterval(watchdog);
  clearInterval(sampleWatchdog);
  runtimeLog.childCloseObserved = processClosed;
  runtimeLog.monitorCloseObserved = monitorExitCode !== null;
  runtimeLog.childCloseWaited = processClosed;
  runtimeLog.monitorCloseWaited = monitorExitCode !== null;
  runtimeLog.cleanupTimeout = !bothClosedByBudget || !processClosed || monitorExitCode === null;
  if (runtimeLog.cleanupTimeout) {
    runtimeLog.killed = killed;
    runtimeLog.killReason = killReason || null;
    if (monitorError) runtimeLog.monitorError = monitorError.message.slice(0, 240);
    throw new Error(`process cleanup timeout; child_closed=${processClosed}; monitor_closed=${monitorExitCode !== null}`);
  }
  runtimeLog.exitCode = childExitCode;
  runtimeLog.signal = childSignal;
  runtimeLog.closeObserved = processClosed;
  runtimeLog.monitorExitCode = monitorExitCode;
  runtimeLog.killed = killed;
  runtimeLog.killReason = killReason || null;
  if (monitorError) runtimeLog.monitorError = monitorError.message.slice(0, 240);
  const stderrBuf = Buffer.concat(stderr);
  await writeFile(`${outBase}.stderr`, stderrBuf);
  if (childError) throw new Error(`Tesseract process error: ${childError}`);
  if (monitorError || monitorLineOverflow || monitorExitCode !== 0) throw new Error(`resource monitor failed: ${monitorError ?? `exit ${monitorExitCode}`}`);
  const finalSizes = await Promise.all(['.txt', '.tsv'].map(ext => stat(`${outBase}${ext}`).then(s => s.size).catch(() => 0)));
  if (finalSizes[0] + finalSizes[1] + stderrBytes > budget.pageOutputBytes && !killed) throw new Error('combined page output limit exceeded');
  if (hooks.directoryPath) {
    const entries = await readdir(hooks.directoryPath, { withFileTypes: true });
    let bytes = 0;
    for (const entry of entries) {
      if (!entry.isFile()) throw new Error('single-page output directory contains a non-file entry');
      bytes += (await stat(join(hooks.directoryPath, entry.name))).size;
    }
    const directoryLimit = budget.directoryBytes ?? LIMITS.directoryBytes;
    if (bytes > directoryLimit) throw new Error(`output directory byte limit exceeded (${bytes} > ${directoryLimit})`);
  }
  let monitorText: string;
  try {
    const sampleStat = await stat(samplePath);
    if (sampleStat.size + monitorStdoutBytes + monitorStderrBytes > budget.monitorLogBytes) throw new Error('monitor/control log byte limit exceeded');
    monitorText = await readFile(samplePath, 'utf8');
  }
  catch { throw new Error('resource monitor produced no samples or wait record'); }
  let monitorRows: any[];
  try { monitorRows = monitorText.trim().split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line)); }
  catch (error) { throw new Error(`resource monitor log is invalid: ${String(error)}; ${JSON.stringify(monitorText.slice(0, 500))}`); }
  const sampleRows = monitorRows.filter(row => Number.isFinite(row.workingSetBytes));
  if (!sampleRows.length || monitorRows.at(-1)?.waited !== true || monitorRows.at(-1)?.exitCode === undefined) throw new Error(`resource monitor had no samples or did not confirm wait completion; samples=${sampleRows.length}; final=${JSON.stringify(monitorRows.at(-1) ?? null).slice(0, 240)}`);
  if (sampleRows.some(row => row.pid !== runtimeLog.pid) || monitorRows.at(-1)?.pid !== runtimeLog.pid) throw new Error('resource monitor PID did not match the exact child PID');
  if (liveSampleRows.length !== sampleRows.length) throw new Error('resource monitor live samples did not match its flushed sample log');
  const sampleTimes = sampleRows.map(row => Date.parse(row.at));
  if (sampleTimes.some(value => !Number.isFinite(value))) throw new Error('resource monitor sample timestamp is invalid');
  const softStop = monitorRows.find(row => row.kill === 'single-process' && row.reason === 'working-set-soft-line');
  if (softStop) { killed = true; killReason = 'working-set-soft-line'; }
  runtimeLog.killed = killed;
  runtimeLog.killReason = killReason || null;
  let maxGapMs = 0;
  for (let i=1;i<sampleTimes.length;i++) {
    const gap = sampleTimes[i] - sampleTimes[i-1];
    if (gap < 0) throw new Error('resource monitor sample timestamps are out of order');
    maxGapMs = Math.max(maxGapMs, gap);
  }
  const firstSampleDelayMs = sampleTimes[0] - childStartedAt;
  if (!Number.isFinite(firstSampleDelayMs) || firstSampleDelayMs < 0) throw new Error('resource monitor first sample time is invalid');
  maxGapMs = Math.max(maxGapMs, firstSampleDelayMs);
  const lastSampleToCloseMs = Date.parse(childClosedAt!) - sampleTimes.at(-1)!;
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

export function xiamenCandidate(words: Word[]): any[] {
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
  (mode==='prepare'?prepare():mode==='run'?run():Promise.reject(new Error('usage: node scripts/fiscal/ocr-scan-poc.ts <prepare|run>'))).catch(err=>{console.error(JSON.stringify(safeError(err)));process.exitCode=1;});
}
