import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { access, lstat, mkdir, readFile, readdir, realpath, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TIME_ZONE = "Asia/Shanghai";
const WINDOW_START_MINUTE = 2 * 60;
const WINDOW_END_MINUTE = 6 * 60;
const MIN_MEM_AVAILABLE_BYTES = 4 * 1024 ** 3;
const MIN_FULL_RUN_WINDOW_MS = 30 * 60 * 1000;
const PILOT_DB_PORT = 55433;
const PRIVATE_NODE_PATH = "/vol2/1000/docker/fiscalhot-understand-nightly/bin/node";
const PRIVATE_NODE_VERSION = "v24.22.1";
const PRIVATE_NODE_SHA256 = "E32E2D16081CF644F88392934288086E7662529D0D43277C34F7AAD2207CFAFB";
const API_IMAGE_ID = "sha256:54d1a34f104b665ccdecc60e82f4cb67acf114fb3171b742990464ee6d4c7bc6";
const JOB_ID = "ollama-understand-development-r1";
const MODEL_DIGEST = "6488C96FA5FAAB64BB65CBD30D4289E20E6130EF535A93EF9A49F42EDA893EA7";
const INPUT_SHA256 = "95370FAA035D9322D4BDABB7E109A99BF3F9AE7ACDD411F9F98B233651271517";
const HEX_SHA256 = /^[A-F0-9]{64}$/u;
const PINNED_SOURCE_TREE_SHA256 = "852AB2B5B0A44EBACE29486EDD4F3C5B7112836D41B1FC121B692A81A20BE0EB";
const PINNED_CODE_FILES = Object.freeze({
  "scripts/migrate.ts": "2C19A38358146AC2C132FBFC0A8560D1FA35AB89F7C66A0CE38CE3E38C062A2D",
  "scripts/fiscal/ollama-understand-container-pilot.ts": "49FA51F1FE36F109CB2F3109348F40360C4061BDB052227E22CB26409A15243C",
  "scripts/fiscal/ollama-understand-pilot-guard.mjs": "10F829E296B976FB12354238333845EF8F80424D964F71A8E38C86396CAAB22E",
  "scripts/fiscal/ollama-understand-pilot-guard.d.mts": "528E14CD918CDDC5851CD83C10EC03A5201AFF99E8E74312EBB0E4A0032D2314",
});
const STATE_FORMAT = "ollama-understand-nightly-state/v1";
const RESULT_FORMAT = "ollama-understand-nightly-launch-result/v1";
const EXPECTED_CASES = Object.freeze([
  ["body-xkm1grgd10aj3ua4nwg5gfofd", "8BF8AB8815F43EF674BBC463296FBC3AA636A048F7DABBE38E42AC26604CCE1B", "2FF690CBE17DC2F480F9A0FD3FB14441FA6EB8C5AFDA50339ACAE1D756C7155B"],
  ["body-ebtwbnudqgmlkzj60wviji165", "3F97D5522F2057B3AE52D2E0EE6E08F270C41D7BFE5BD2CAF8833E9E5C245993", "13D0315D40C9BC690A3C47D7BBF155CBDBAC7FC6DF49753C76F51592AF334452"],
  ["body-fn6rshoxnk425y3ui1cxr6mpp", "2668AD3C5865B169F22D34853F4600EC437A8B6F9B9DB8038570D3F1B9C251D3", "C45CF48DA8FB58E95D1765E8D9D88388731270717D63C83B6125CBBE09A8A339"],
  ["body-j33dctglguvwqfa4ksqsdlwdf", "059E3C2D4607FCD0E7A0A8365BCAB7BD2A42191619E430DD8E1E183350221466", "2EB40BBC46DF54E9B0548BD64E033EAF9616BE6147F1232DF3A56555B6275EAB"],
]);
const RECEIPT_EVIDENCE_KEYS = new Set(["format", "receipts", "attempts"]);
const RECEIPT_ROW_KEYS = new Set(["id", "service", "model", "purpose", "status", "attempts", "createdAt", "completedAt"]);
const ATTEMPT_ROW_KEYS = new Set(["receiptId", "attempt", "service", "model", "status", "startedAt", "finishedAt", "latencyMs"]);

export class NightlyPilotError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "NightlyPilotError";
    this.code = code;
  }
}

export function verifyNodeRuntimeMetadata({ version, actualPath, expectedPath = PRIVATE_NODE_PATH, actualSha256 }) {
  if (version !== PRIVATE_NODE_VERSION) throw new NightlyPilotError("NIGHTLY_NODE_VERSION_MISMATCH");
  if (actualPath !== expectedPath) throw new NightlyPilotError("NIGHTLY_NODE_PATH_MISMATCH");
  if (typeof actualSha256 !== "string" || actualSha256.toUpperCase() !== PRIVATE_NODE_SHA256) throw new NightlyPilotError("NIGHTLY_NODE_HASH_MISMATCH");
  return { version, path: actualPath, sha256: PRIVATE_NODE_SHA256 };
}

async function verifyPrivateNodeRuntime() {
  let executablePath;
  let expectedPath;
  let bytes;
  try {
    [executablePath, expectedPath, bytes] = await Promise.all([
      realpath(process.execPath), realpath(PRIVATE_NODE_PATH), readFile(process.execPath),
    ]);
  } catch {
    throw new NightlyPilotError("NIGHTLY_NODE_BINARY_UNAVAILABLE");
  }
  return verifyNodeRuntimeMetadata({ version: process.version, actualPath: executablePath, expectedPath, actualSha256: sha256(bytes) });
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function lexicalCompare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) => lexicalCompare(a, b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function shanghaiParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]));
  return values;
}

export function getShanghaiSchedule(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new NightlyPilotError("INVALID_TIME");
  const p = shanghaiParts(date);
  const minuteOfDay = p.hour * 60 + p.minute;
  const dateKey = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  const wallNowAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const offsetMs = wallNowAsUtc - Math.floor(date.getTime() / 1000) * 1000;
  const deadlineEpochMs = Date.UTC(p.year, p.month - 1, p.day, 6, 0, 0) - offsetMs;
  return {
    dateKey,
    minuteOfDay,
    withinWindow: minuteOfDay >= WINDOW_START_MINUTE && minuteOfDay < WINDOW_END_MINUTE,
    deadlineEpochMs,
  };
}

export function parseMemAvailableBytes(text) {
  const match = /^MemAvailable:\s+(\d+)\s+kB\s*$/imu.exec(text);
  if (!match) throw new NightlyPilotError("MEMINFO_UNAVAILABLE");
  return Number(match[1]) * 1024;
}

export function codeManifestSha256(codeFiles) {
  const entries = Object.fromEntries(Object.entries(codeFiles).sort(([a], [b]) => lexicalCompare(a, b)));
  return sha256(Buffer.from(JSON.stringify(entries)));
}

async function collectFiles(directory, predicate = () => true) {
  const result = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    throw new NightlyPilotError("FROZEN_CODE_TREE_MISSING");
  }
  for (const entry of entries.sort((a, b) => lexicalCompare(a.name, b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await collectFiles(absolute, predicate));
    else if (entry.isFile() && predicate(absolute)) result.push(absolute);
  }
  return result;
}

async function readPinnedSourceTree(repoRoot) {
  const paths = [];
  paths.push(...await collectFiles(path.join(repoRoot, "packages/backend/src")));
  paths.push(...await collectFiles(path.join(repoRoot, "packages/contracts/src")));
  paths.push(...await collectFiles(path.join(repoRoot, "industry"), (file) => file.endsWith(".ts")
    || (file.includes(`${path.sep}prompts${path.sep}`) && file.endsWith(".md"))));
  paths.push(...await collectFiles(path.join(repoRoot, "database/migrations")));
  for (const relative of [
    "package.json", "package-lock.json", "tsconfig.base.json",
    "packages/backend/package.json", "packages/backend/tsconfig.json",
    "packages/contracts/package.json", "packages/contracts/tsconfig.json",
    "industry/package.json", "industry/tsconfig.json",
  ]) paths.push(path.join(repoRoot, relative));
  const files = {};
  for (const absolute of paths.sort(lexicalCompare)) {
    const relative = path.relative(repoRoot, absolute).split(path.sep).join("/");
    files[relative] = sha256(await readFile(absolute));
  }
  const treeSha256 = codeManifestSha256(files);
  if (treeSha256 !== PINNED_SOURCE_TREE_SHA256) throw new NightlyPilotError("FROZEN_SOURCE_TREE_HASH_MISMATCH");
  return { treeSha256, files };
}

export async function verifyFrozenFiles(repoRoot, { wrapperPath, launcherPath, expectedWrapperSha256, expectedLauncherSha256 } = {}) {
  const actualCodeFiles = {};
  for (const [relativePath, expectedSha] of Object.entries(PINNED_CODE_FILES)) {
    let bytes;
    try {
      bytes = await readFile(path.join(repoRoot, relativePath));
    } catch {
      throw new NightlyPilotError("FROZEN_CODE_MISSING");
    }
    const actualSha = sha256(bytes);
    if (actualSha !== expectedSha) throw new NightlyPilotError("FROZEN_CODE_HASH_MISMATCH");
    actualCodeFiles[relativePath] = actualSha;
  }
  actualCodeFiles.nightlyNodeSha256 = PRIVATE_NODE_SHA256;
  const sourceTree = await readPinnedSourceTree(repoRoot);
  actualCodeFiles.sourceTreeSha256 = sourceTree.treeSha256;
  if (!wrapperPath || !launcherPath || !HEX_SHA256.test(expectedWrapperSha256 ?? "") || !HEX_SHA256.test(expectedLauncherSha256 ?? "")) {
    throw new NightlyPilotError("NIGHTLY_EXECUTABLE_HASH_CONFIG_INVALID");
  }
  for (const [name, filePath, expected] of [
    ["nightlyWrapper", wrapperPath, expectedWrapperSha256],
    ["nasLauncher", launcherPath, expectedLauncherSha256],
  ]) {
    let bytes;
    try {
      bytes = await readFile(filePath);
    } catch {
      throw new NightlyPilotError("NIGHTLY_EXECUTABLE_MISSING");
    }
    const actualSha = sha256(bytes);
    if (actualSha !== expected) throw new NightlyPilotError("NIGHTLY_EXECUTABLE_HASH_MISMATCH");
    actualCodeFiles[name] = actualSha;
  }
  let inputBytes;
  try {
    inputBytes = await readFile(path.join(repoRoot, ".data/fiscal-qa/development150-local-pilot-20261026/inputs-request-only.json"));
  } catch {
    throw new NightlyPilotError("FROZEN_INPUT_MISSING");
  }
  const inputSha256 = sha256(inputBytes);
  if (inputSha256 !== INPUT_SHA256) throw new NightlyPilotError("FROZEN_INPUT_HASH_MISMATCH");
  let packageLockCanonicalSha256;
  try {
    const packageLock = JSON.parse(await readFile(path.join(repoRoot, "package-lock.json"), "utf8"));
    packageLockCanonicalSha256 = sha256(Buffer.from(stableJson(packageLock)));
  } catch {
    throw new NightlyPilotError("FROZEN_PACKAGE_LOCK_INVALID");
  }
  return {
    inputSha256,
    codeManifestSha256: codeManifestSha256(actualCodeFiles),
    wrapperSha256: actualCodeFiles.nightlyWrapper,
    launcherSha256: actualCodeFiles.nasLauncher,
    nodeSha256: PRIVATE_NODE_SHA256,
    packageLockCanonicalSha256,
    codeFiles: actualCodeFiles,
    sourceFiles: sourceTree.files,
  };
}

function baseState({ schedule, frozen, status, reason, memoryAvailableBytes, runId }) {
  return {
    format: STATE_FORMAT,
    jobId: JOB_ID,
    status,
    attemptDateShanghai: schedule.dateKey,
    updatedAt: new Date().toISOString(),
    runId,
    reason: reason ?? null,
    memoryAvailableBytes: memoryAvailableBytes ?? null,
    inputSha256: frozen?.inputSha256 ?? INPUT_SHA256,
    codeManifestSha256: frozen?.codeManifestSha256 ?? null,
    wrapperSha256: frozen?.wrapperSha256 ?? null,
    launcherSha256: frozen?.launcherSha256 ?? null,
  };
}

function stateIsValid(state) {
  const reviewWithoutHashes = state?.status === "REVIEW_REQUIRED";
  return !!state && state.format === STATE_FORMAT && state.jobId === JOB_ID
    && state.inputSha256 === INPUT_SHA256
    && (reviewWithoutHashes || (typeof state.codeManifestSha256 === "string" && HEX_SHA256.test(state.codeManifestSha256)
      && typeof state.wrapperSha256 === "string" && HEX_SHA256.test(state.wrapperSha256)
      && typeof state.launcherSha256 === "string" && HEX_SHA256.test(state.launcherSha256)))
    && ["SKIPPED_RESOURCE", "SKIPPED_WINDOW", "RUNNING", "COMPLETED", "REVIEW_REQUIRED"].includes(state.status)
    && typeof state.attemptDateShanghai === "string";
}

function isTerminal(status) {
  return status === "COMPLETED" || status === "REVIEW_REQUIRED";
}

function sameLocalDate(state, schedule) {
  return state?.attemptDateShanghai === schedule.dateKey;
}

function verifyLaunchResult(result, expected, runId, deadlineEpochMs) {
  const hex = /^[A-F0-9]{64}$/u;
  const safeMarkerStatus = (value) => typeof value === "string" && value.length > 0
    && value.split(",").every((part) => ["absent", "null", "false", "empty", "local"].includes(part));
  const requestTimes = result?.requestStartedAtEpochMs;
  return result?.format === RESULT_FORMAT
    && result.status === "COMPLETED"
    && result.runId === runId
    && result.inputSha256 === expected.inputSha256
    && result.codeManifestSha256 === expected.codeManifestSha256
    && result.wrapperSha256 === expected.wrapperSha256
    && result.launcherSha256 === expected.launcherSha256
    && result.model === "qwen3.5:9b"
    && typeof result.modelDigest === "string" && result.modelDigest.toUpperCase() === MODEL_DIGEST
    && safeMarkerStatus(result.modelRemoteMarkerStatus)
    && safeMarkerStatus(result.modelCloudMarkerStatus)
    && result.apiImageId === API_IMAGE_ID
    && result.packageLockMatch === true
    && typeof result.sourcePackageLockCanonicalSha256 === "string"
    && result.sourcePackageLockCanonicalSha256.toUpperCase() === expected.packageLockCanonicalSha256
    && typeof result.apiPackageLockCanonicalSha256 === "string"
    && result.apiPackageLockCanonicalSha256.toUpperCase() === expected.packageLockCanonicalSha256
    && result.imageSensitiveEnvAbsent === true
    && result.imageNodeOptionsAbsent === true
    && result.imageNodePathAbsent === true
    && result.actualProviderRequests === 8
    && result.receiptAttempts === 8
    && result.completedReceipts === 8
    && result.failedReceipts === 0
    && result.pendingReceipts === 0
    && result.unknownReceipts === 0
    && result.businessRowCountsUnchanged === true
    && typeof result.predictionsSha256 === "string" && hex.test(result.predictionsSha256)
    && typeof result.predictionsPath === "string" && path.isAbsolute(result.predictionsPath)
    && typeof result.receiptEvidenceSha256 === "string" && hex.test(result.receiptEvidenceSha256)
    && typeof result.receiptEvidencePath === "string" && path.isAbsolute(result.receiptEvidencePath)
    && typeof result.pgDumpSha256 === "string" && hex.test(result.pgDumpSha256)
    && typeof result.pgDumpPath === "string" && path.isAbsolute(result.pgDumpPath)
    && typeof result.clientContainerId === "string" && /^[a-f0-9]{64}$/iu.test(result.clientContainerId)
    && typeof result.pgContainerId === "string" && /^[a-f0-9]{64}$/iu.test(result.pgContainerId)
    && Array.isArray(requestTimes) && requestTimes.length === 8
    && requestTimes.every((value) => Number.isSafeInteger(value) && value < deadlineEpochMs)
    && requestTimes.every((value, index) => index === 0 || value >= requestTimes[index - 1]);
}

function isInsideDirectory(root, target) {
  const relative = path.relative(root, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function containsSensitiveReceiptField(value) {
  if (!value || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value)) {
    if (/^(?:request|requestbody|requestpayload|response|responsebody|responsetext|responsecontent|prompt|prompttext|authorization|api[_-]?key|raw[_-].*|headers?|error|secret|message)$/iu.test(key)) return true;
    if (containsSensitiveReceiptField(child)) return true;
  }
  return false;
}

function hasExactKeys(value, expected) {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === expected.size && Object.keys(value).every((key) => expected.has(key));
}

/** Verify launcher-persisted evidence by reading the exact bytes before allowing COMPLETED. */
export async function verifyArtifactFiles(result, resultDirectory) {
  let root;
  try {
    root = await realpath(resultDirectory);
  } catch {
    return false;
  }
  const artifacts = [
    [result?.predictionsPath, result?.predictionsSha256, "predictions"],
    [result?.receiptEvidencePath, result?.receiptEvidenceSha256, "receiptEvidence"],
    [result?.pgDumpPath, result?.pgDumpSha256, "pgDump"],
  ];
  const bytesByName = {};
  for (const [candidate, expectedSha, name] of artifacts) {
    if (typeof candidate !== "string" || !path.isAbsolute(candidate) || !HEX_SHA256.test(expectedSha ?? "")) return false;
    try {
      const resolved = await realpath(candidate);
      if (!isInsideDirectory(root, resolved) || !(await lstat(resolved)).isFile()) return false;
      const bytes = await readFile(resolved);
      if (sha256(bytes) !== expectedSha) return false;
      bytesByName[name] = bytes;
    } catch {
      return false;
    }
  }
  try {
    const predictions = JSON.parse(bytesByName.predictions.toString("utf8"));
    const receiptEvidence = JSON.parse(bytesByName.receiptEvidence.toString("utf8"));
    if (predictions?.format !== "ollama-local-development-understand-pilot/v1"
      || predictions.inputSha256 !== INPUT_SHA256 || predictions.actualProviderRequests !== 8
      || !Array.isArray(predictions.results) || predictions.results.length !== EXPECTED_CASES.length
      || !predictions.results.every((row, index) => row?.caseId === EXPECTED_CASES[index][0]
        && row?.inputSha256 === EXPECTED_CASES[index][1] && row?.bodySha256 === EXPECTED_CASES[index][2])) return false;
    if (!hasExactKeys(receiptEvidence, RECEIPT_EVIDENCE_KEYS)
      || receiptEvidence.format !== "ollama-understand-receipt-evidence/v1"
      || !Array.isArray(receiptEvidence.receipts) || receiptEvidence.receipts.length !== 8
      || !Array.isArray(receiptEvidence.attempts) || receiptEvidence.attempts.length !== 8
      || !receiptEvidence.receipts.every((row) => hasExactKeys(row, RECEIPT_ROW_KEYS))
      || !receiptEvidence.attempts.every((row) => hasExactKeys(row, ATTEMPT_ROW_KEYS))
      || containsSensitiveReceiptField(receiptEvidence)) return false;
  } catch {
    return false;
  }
  return true;
}

/**
 * Executes one scheduled attempt. All external effects are injected so the state machine can be
 * verified offline. A filesystem flock held by the caller prevents concurrent cron invocations.
 */
export async function runNightlyPilot({
  repoRoot,
  statePath,
  launcherPath,
  wrapperPath,
  expectedWrapperSha256,
  expectedLauncherSha256,
  resultDirectory,
  lockHeld,
  now = () => new Date(),
  readState,
  writeState,
  readMemAvailable,
  verifyFrozen = verifyFrozenFiles,
  verifyRuntime = async () => true,
  resultExists,
  verifyArtifacts = verifyArtifactFiles,
  executeLauncher,
}) {
  if (lockHeld !== true) throw new NightlyPilotError("FLOCK_REQUIRED");
  for (const [key, value] of Object.entries({ repoRoot, statePath, launcherPath, wrapperPath, expectedWrapperSha256, expectedLauncherSha256, resultDirectory, readState, writeState, readMemAvailable, resultExists, verifyArtifacts, verifyRuntime, executeLauncher })) {
    if (!value) throw new NightlyPilotError(`CONFIG_MISSING_${key.toUpperCase()}`);
  }
  const instant = now();
  const schedule = getShanghaiSchedule(instant);
  let existing;
  try {
    existing = await readState(statePath);
  } catch {
    const blocked = baseState({ schedule, status: "REVIEW_REQUIRED", reason: "STATE_READ_FAILED" });
    await writeState(statePath, blocked);
    return { outcome: "REVIEW_REQUIRED", state: blocked };
  }
  if (existing && !stateIsValid(existing)) {
    const blocked = baseState({ schedule, status: "REVIEW_REQUIRED", reason: "STATE_INVALID" });
    await writeState(statePath, blocked);
    return { outcome: "REVIEW_REQUIRED", state: blocked };
  }
  if (existing && isTerminal(existing.status)) return { outcome: "NOOP_TERMINAL", state: existing };
  if (existing?.status === "RUNNING") {
    const blocked = { ...existing, status: "REVIEW_REQUIRED", reason: "STALE_RUNNING_STATE_UNCERTAIN_PROVIDER_OUTCOME", updatedAt: instant.toISOString() };
    await writeState(statePath, blocked);
    return { outcome: "REVIEW_REQUIRED", state: blocked };
  }
  if (!schedule.withinWindow) return { outcome: "NOOP_OUTSIDE_WINDOW", state: existing ?? null };
  if (existing && ["SKIPPED_RESOURCE", "SKIPPED_WINDOW"].includes(existing.status) && sameLocalDate(existing, schedule)) {
    return { outcome: "NOOP_ALREADY_ATTEMPTED_TODAY", state: existing };
  }

  try {
    await verifyRuntime();
  } catch (error) {
    const blocked = baseState({ schedule, status: "REVIEW_REQUIRED", reason: error?.code ?? "NIGHTLY_NODE_VERIFICATION_FAILED" });
    await writeState(statePath, blocked);
    return { outcome: "REVIEW_REQUIRED", state: blocked };
  }

  let frozen;
  try {
    frozen = await verifyFrozen(repoRoot, { wrapperPath, launcherPath, expectedWrapperSha256, expectedLauncherSha256 });
  } catch (error) {
    const blocked = baseState({ schedule, status: "REVIEW_REQUIRED", reason: error?.code ?? "FROZEN_INPUT_VERIFICATION_FAILED" });
    await writeState(statePath, blocked);
    return { outcome: "REVIEW_REQUIRED", state: blocked };
  }
  if (existing && ["SKIPPED_RESOURCE", "SKIPPED_WINDOW"].includes(existing.status)
    && (existing.codeManifestSha256 !== frozen.codeManifestSha256 || existing.wrapperSha256 !== frozen.wrapperSha256 || existing.launcherSha256 !== frozen.launcherSha256)) {
    const blocked = baseState({ schedule, frozen, status: "REVIEW_REQUIRED", reason: "FROZEN_CODE_CHANGED_AFTER_RESOURCE_SKIP" });
    await writeState(statePath, blocked);
    return { outcome: "REVIEW_REQUIRED", state: blocked };
  }
  let memoryAvailableBytes;
  try {
    memoryAvailableBytes = await readMemAvailable();
  } catch {
    const blocked = baseState({ schedule, frozen, status: "REVIEW_REQUIRED", reason: "MEMINFO_UNAVAILABLE" });
    await writeState(statePath, blocked);
    return { outcome: "REVIEW_REQUIRED", state: blocked };
  }
  if (!Number.isSafeInteger(memoryAvailableBytes) || memoryAvailableBytes < MIN_MEM_AVAILABLE_BYTES) {
    const skipped = baseState({ schedule, frozen, status: "SKIPPED_RESOURCE", reason: "MEM_AVAILABLE_BELOW_4_GIB", memoryAvailableBytes });
    await writeState(statePath, skipped);
    return { outcome: "SKIPPED_RESOURCE", state: skipped };
  }
  const beforeLaunch = now();
  const finalSchedule = getShanghaiSchedule(beforeLaunch);
  if (!finalSchedule.withinWindow || finalSchedule.deadlineEpochMs <= beforeLaunch.getTime()) {
    const skipped = baseState({ schedule: finalSchedule, frozen, status: "SKIPPED_WINDOW", reason: "WINDOW_CLOSED_BEFORE_LAUNCH", memoryAvailableBytes });
    await writeState(statePath, skipped);
    return { outcome: "SKIPPED_WINDOW", state: skipped };
  }
  let latestFrozen;
  try {
    latestFrozen = await verifyFrozen(repoRoot, { wrapperPath, launcherPath, expectedWrapperSha256, expectedLauncherSha256 });
  } catch (error) {
    const blocked = baseState({ schedule: finalSchedule, frozen, status: "REVIEW_REQUIRED", reason: error?.code ?? "FROZEN_INPUT_RECHECK_FAILED", memoryAvailableBytes });
    await writeState(statePath, blocked);
    return { outcome: "REVIEW_REQUIRED", state: blocked };
  }
  if (latestFrozen.inputSha256 !== frozen.inputSha256 || latestFrozen.codeManifestSha256 !== frozen.codeManifestSha256
    || latestFrozen.wrapperSha256 !== frozen.wrapperSha256 || latestFrozen.launcherSha256 !== frozen.launcherSha256) {
    const blocked = baseState({ schedule: finalSchedule, frozen, status: "REVIEW_REQUIRED", reason: "FROZEN_FILES_CHANGED_BEFORE_LAUNCH", memoryAvailableBytes });
    await writeState(statePath, blocked);
    return { outcome: "REVIEW_REQUIRED", state: blocked };
  }
  const finalCheckTime = now();
  if (!getShanghaiSchedule(finalCheckTime).withinWindow || finalSchedule.deadlineEpochMs - finalCheckTime.getTime() < MIN_FULL_RUN_WINDOW_MS) {
    const skipped = baseState({ schedule: finalSchedule, frozen, status: "SKIPPED_WINDOW", reason: "INSUFFICIENT_WINDOW_FOR_FULL_8_REQUEST_RUN", memoryAvailableBytes });
    await writeState(statePath, skipped);
    return { outcome: "SKIPPED_WINDOW", state: skipped };
  }

  const runId = `${JOB_ID}-${finalSchedule.dateKey.replaceAll("-", "")}`;
  const resultPath = path.join(resultDirectory, `${runId}.result.json`);
  let existingResult;
  try {
    await mkdir(resultDirectory, { recursive: true, mode: 0o700 });
    existingResult = await resultExists(resultPath);
  } catch {
    const blocked = baseState({ schedule: finalSchedule, frozen, status: "REVIEW_REQUIRED", reason: "RESULT_PATH_CHECK_FAILED", memoryAvailableBytes });
    await writeState(statePath, blocked);
    return { outcome: "REVIEW_REQUIRED", state: blocked };
  }
  if (existingResult) {
    const blocked = baseState({ schedule: finalSchedule, frozen, status: "REVIEW_REQUIRED", reason: "RESULT_EVIDENCE_ALREADY_EXISTS", memoryAvailableBytes });
    await writeState(statePath, blocked);
    return { outcome: "REVIEW_REQUIRED", state: blocked };
  }
  const running = {
    ...baseState({ schedule: finalSchedule, frozen, status: "RUNNING", memoryAvailableBytes, runId }),
    startedAt: beforeLaunch.toISOString(),
    deadlineEpochMs: finalSchedule.deadlineEpochMs,
  };
  await writeState(statePath, running);
  let launch;
  try {
    launch = await executeLauncher({ launcherPath, repoRoot, runId, deadlineEpochMs: finalSchedule.deadlineEpochMs, resultPath, frozen });
  } catch {
    const blocked = { ...running, status: "REVIEW_REQUIRED", reason: "LAUNCHER_EXECUTION_UNCERTAIN", updatedAt: now().toISOString() };
    await writeState(statePath, blocked);
    return { outcome: "REVIEW_REQUIRED", state: blocked };
  }
  if (launch?.exitCode === 75 && launch?.timedOut !== true) {
    let skipResult;
    try {
      skipResult = await launch.readResult(resultPath);
    } catch {
      const blocked = { ...running, status: "REVIEW_REQUIRED", reason: "RESOURCE_SKIP_EVIDENCE_MISSING", updatedAt: now().toISOString() };
      await writeState(statePath, blocked);
      return { outcome: "REVIEW_REQUIRED", state: blocked };
    }
    const allowedReasons = new Set(["MODEL_RESIDENT_MEMORY_BELOW_GATE", "NAS_MEM_AVAILABLE_BELOW_GATE", "PILOT_DB_PORT_BUSY"]);
    if (skipResult?.format !== RESULT_FORMAT || skipResult.runId !== runId || skipResult.status !== "SKIPPED_RESOURCE"
      || !allowedReasons.has(skipResult.reason) || skipResult.preflightOnly !== true || skipResult.providerRequestsStarted !== 0
      || skipResult.actualProviderRequests !== 0 || skipResult.containersCreated !== 0
      || skipResult.inputSha256 !== frozen.inputSha256 || skipResult.codeManifestSha256 !== frozen.codeManifestSha256
      || skipResult.wrapperSha256 !== frozen.wrapperSha256 || skipResult.launcherSha256 !== frozen.launcherSha256
      || typeof skipResult.checkedAt !== "string" || !Number.isFinite(Date.parse(skipResult.checkedAt))) {
      const blocked = { ...running, status: "REVIEW_REQUIRED", reason: "RESOURCE_SKIP_EVIDENCE_CONTRACT_FAILED", updatedAt: now().toISOString() };
      await writeState(statePath, blocked);
      return { outcome: "REVIEW_REQUIRED", state: blocked };
    }
    const skipped = {
      ...running,
      status: "SKIPPED_RESOURCE",
      updatedAt: now().toISOString(),
      reason: skipResult.reason,
      providerRequests: 0,
      checkedAt: skipResult.checkedAt ?? now().toISOString(),
    };
    await writeState(statePath, skipped);
    return { outcome: "SKIPPED_RESOURCE", state: skipped };
  }
  if (launch?.exitCode !== 0 || launch?.timedOut === true) {
    const blocked = { ...running, status: "REVIEW_REQUIRED", reason: launch?.timedOut ? "WINDOW_DEADLINE_REACHED" : "LAUNCHER_FAILED_OR_INTERRUPTED", updatedAt: now().toISOString() };
    await writeState(statePath, blocked);
    return { outcome: "REVIEW_REQUIRED", state: blocked };
  }
  let result;
  try {
    result = await launch.readResult(resultPath);
  } catch {
    const blocked = { ...running, status: "REVIEW_REQUIRED", reason: "LAUNCH_EVIDENCE_MISSING_OR_INVALID", updatedAt: now().toISOString() };
    await writeState(statePath, blocked);
    return { outcome: "REVIEW_REQUIRED", state: blocked };
  }
  if (!verifyLaunchResult(result, frozen, runId, finalSchedule.deadlineEpochMs)) {
    const blocked = { ...running, status: "REVIEW_REQUIRED", reason: "LAUNCH_EVIDENCE_CONTRACT_FAILED", updatedAt: now().toISOString() };
    await writeState(statePath, blocked);
    return { outcome: "REVIEW_REQUIRED", state: blocked };
  }
  let artifactsVerified = false;
  try {
    artifactsVerified = await verifyArtifacts(result, resultDirectory);
  } catch {
    artifactsVerified = false;
  }
  if (!artifactsVerified) {
    const blocked = { ...running, status: "REVIEW_REQUIRED", reason: "PERSISTED_ARTIFACT_HASH_OR_SANITIZATION_FAILED", updatedAt: now().toISOString() };
    await writeState(statePath, blocked);
    return { outcome: "REVIEW_REQUIRED", state: blocked };
  }
  const completed = {
    ...running,
    status: "COMPLETED",
    updatedAt: now().toISOString(),
    finishedAt: result.finishedAt ?? now().toISOString(),
    reason: null,
    providerRequests: result.actualProviderRequests,
    receiptAttempts: result.receiptAttempts,
    predictionsSha256: result.predictionsSha256,
    receiptEvidenceSha256: result.receiptEvidenceSha256,
    clientContainerId: result.clientContainerId,
    modelDigest: result.modelDigest,
  };
  await writeState(statePath, completed);
  return { outcome: "COMPLETED", state: completed };
}

async function readStateFile(statePath) {
  try {
    return JSON.parse(await readFile(statePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function writeStateFile(statePath, value) {
  await mkdir(path.dirname(statePath), { recursive: true, mode: 0o700 });
  const temp = `${statePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  await rename(temp, statePath);
}

function minimalLauncherEnv({ runId, deadlineEpochMs, resultPath, frozen }) {
  const env = {};
  for (const name of ["PATH", "HOME", "USER", "LOGNAME", "LANG", "LC_ALL", "TZ"]) {
    if (process.env[name]) env[name] = process.env[name];
  }
  env.OLLAMA_PILOT_RUN_ID = runId;
  env.OLLAMA_PILOT_DEADLINE_EPOCH_MS = String(deadlineEpochMs);
  env.OLLAMA_PILOT_RESULT_PATH = resultPath;
  env.OLLAMA_PILOT_INPUT_SHA256 = frozen.inputSha256;
  env.OLLAMA_PILOT_CODE_MANIFEST_SHA256 = frozen.codeManifestSha256;
  env.OLLAMA_PILOT_WRAPPER_SHA256 = frozen.wrapperSha256;
  env.OLLAMA_PILOT_LAUNCHER_SHA256 = frozen.launcherSha256;
  return env;
}

function runLauncher({ launcherPath, repoRoot, runId, deadlineEpochMs, resultPath, frozen }) {
  const env = minimalLauncherEnv({ runId, deadlineEpochMs, resultPath, frozen });
  const remainingMs = Math.max(0, deadlineEpochMs - Date.now());
  return new Promise((resolve, reject) => {
    if (remainingMs <= 0) return resolve({ exitCode: null, timedOut: true });
    const child = spawn(launcherPath, [], { cwd: repoRoot, env, stdio: "ignore", windowsHide: true });
    let finished = false;
    let killTimer;
    const deadlineTimer = setTimeout(() => {
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
    }, remainingMs);
    const settle = (result) => {
      if (finished) return;
      finished = true;
      clearTimeout(deadlineTimer);
      if (killTimer) clearTimeout(killTimer);
      resolve(result);
    };
    child.once("error", () => {
      clearTimeout(deadlineTimer);
      reject(new NightlyPilotError("LAUNCHER_SPAWN_FAILED"));
    });
    child.once("close", (code, signal) => settle({ exitCode: code, signal, timedOut: Date.now() >= deadlineEpochMs }));
  });
}

function readHostMemAvailable() {
  return readFile("/proc/meminfo", "utf8").then(parseMemAvailableBytes);
}

async function readResult(resultPath) {
  return JSON.parse(await readFile(resultPath, "utf8"));
}

export async function verifyInheritedFlock(lockPath, fdDirectory = "/proc/self/fd") {
  let expected;
  let descriptors;
  try {
    expected = await realpath(lockPath);
    descriptors = await readdir(fdDirectory);
  } catch {
    return false;
  }
  for (const fd of descriptors) {
    if (!/^\d+$/u.test(fd)) continue;
    try {
      if (await realpath(path.join(fdDirectory, fd)) === expected) return true;
    } catch {
      // Descriptor may close between enumeration and resolution.
    }
  }
  return false;
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function main() {
  if (process.env.OLLAMA_UNDERSTAND_LOCK_HELD !== "1" || !process.env.OLLAMA_UNDERSTAND_LOCK_PATH
    || !await verifyInheritedFlock(process.env.OLLAMA_UNDERSTAND_LOCK_PATH)) throw new NightlyPilotError("FLOCK_REQUIRED");
  const repoRoot = process.env.OLLAMA_UNDERSTAND_REPO_ROOT;
  const statePath = process.env.OLLAMA_UNDERSTAND_STATE_PATH;
  const launcherPath = process.env.OLLAMA_UNDERSTAND_LAUNCHER;
  const expectedWrapperSha256 = process.env.OLLAMA_UNDERSTAND_WRAPPER_SHA256?.toUpperCase();
  const expectedLauncherSha256 = process.env.OLLAMA_UNDERSTAND_LAUNCHER_SHA256?.toUpperCase();
  const resultDirectory = process.env.OLLAMA_UNDERSTAND_RESULT_DIR;
  const wrapperPath = fileURLToPath(import.meta.url);
  if (!repoRoot || !statePath || !launcherPath || !resultDirectory || !expectedWrapperSha256 || !expectedLauncherSha256) throw new NightlyPilotError("NIGHTLY_CONFIGURATION_MISSING");
  const result = await runNightlyPilot({
    repoRoot, statePath, launcherPath, wrapperPath, expectedWrapperSha256, expectedLauncherSha256, resultDirectory,
    lockHeld: true,
    readState: readStateFile,
    writeState: writeStateFile,
    readMemAvailable: readHostMemAvailable,
    verifyRuntime: verifyPrivateNodeRuntime,
    resultExists: pathExists,
    executeLauncher: async (opts) => ({ ...await runLauncher(opts), readResult }),
  });
  process.stdout.write(`${result.outcome}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const code = error instanceof NightlyPilotError ? error.code : "NIGHTLY_UNEXPECTED_ERROR";
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
}

export const NIGHTLY_PILOT_CONSTANTS = Object.freeze({
  timeZone: TIME_ZONE,
  windowStart: "02:00",
  windowEndExclusive: "06:00",
  minMemAvailableBytes: MIN_MEM_AVAILABLE_BYTES,
  minFullRunWindowMs: MIN_FULL_RUN_WINDOW_MS,
  privateNodeVersion: PRIVATE_NODE_VERSION,
  privateNodePath: PRIVATE_NODE_PATH,
  privateNodeSha256: PRIVATE_NODE_SHA256,
  databasePort: PILOT_DB_PORT,
  requestCap: 12,
  expectedProviderRequests: 8,
  model: "qwen3.5:9b",
  modelDigest: MODEL_DIGEST,
  jobId: JOB_ID,
  inputSha256: INPUT_SHA256,
  frozenCodeFiles: PINNED_CODE_FILES,
});
