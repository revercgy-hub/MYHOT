import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import {
  codeManifestSha256,
  minimalLauncherEnv,
  getShanghaiSchedule,
  NIGHTLY_PILOT_CONSTANTS,
  parseMemAvailableBytes,
  runNightlyPilot,
  verifyFrozenFiles,
  verifyArtifactFiles,
  verifyNodeRuntimeMetadata,
} from "../scripts/fiscal/ollama-understand-nightly.mjs";

const harnessDirectory = await mkdtemp(path.join(os.tmpdir(), "nightly-harness-"));
after(() => rm(harnessDirectory, { recursive: true, force: true }));
const repoRoot = path.join(harnessDirectory, "repo");
const statePath = path.join(harnessDirectory, "state.json");
const launcherPath = path.join(harnessDirectory, "launch-understand.sh");
const wrapperPath = path.join(harnessDirectory, "nightly.mjs");
const resultDirectory = path.join(harnessDirectory, "results");
const codeFiles = { "test-file": "C".repeat(64), nightlyWrapper: "D".repeat(64), nasLauncher: "E".repeat(64) };
const frozen = {
  inputSha256: NIGHTLY_PILOT_CONSTANTS.inputSha256,
  codeManifestSha256: codeManifestSha256(codeFiles),
  wrapperSha256: codeFiles.nightlyWrapper,
  launcherSha256: codeFiles.nasLauncher,
  packageLockCanonicalSha256: "B".repeat(64),
  codeFiles,
};
const normalTime = new Date("2026-10-27T18:00:00.000Z"); // 02:00 Asia/Shanghai

test("nightly child inherits the pinned network anchor without inheriting credentials or node overrides", () => {
  const pin = "a".repeat(64);
  const input = { runId: "fixture", deadlineEpochMs: 1, resultPath: "/private/result", frozen };
  const env = minimalLauncherEnv(input, { PATH: "/bin", OLLAMA_UNDERSTAND_NETWORK_ANCHOR_API_IMAGE_SHA256: pin,
    LLM_API_KEY: "must-not-leak", DATABASE_URL: "must-not-leak", NODE_OPTIONS: "must-not-leak" });
  assert.equal(env.OLLAMA_UNDERSTAND_NETWORK_ANCHOR_API_IMAGE_SHA256, pin);
  assert.equal(env.PATH, "/bin");
  for (const key of ["LLM_API_KEY", "DATABASE_URL", "NODE_OPTIONS"]) assert.equal(env[key], undefined);
  assert.throws(() => minimalLauncherEnv(input, {}), /NETWORK_ANCHOR_PIN_HASH_INVALID/u);
  assert.throws(() => minimalLauncherEnv(input, { OLLAMA_UNDERSTAND_NETWORK_ANCHOR_API_IMAGE_SHA256: "invalid" }), /NETWORK_ANCHOR_PIN_HASH_INVALID/u);
});

function receiptEvidence() {
  const timestamp = "2026-10-27T18:01:00Z";
  return {
    format: "ollama-understand-receipt-evidence/v1",
    receipts: Array.from({ length: 8 }, (_, i) => ({ id: `r${i}`, service: "llm", model: "qwen3.5:9b", purpose: "understand", status: "completed", attempts: 1, createdAt: timestamp, completedAt: timestamp })),
    attempts: Array.from({ length: 8 }, (_, i) => ({ receiptId: `r${i}`, attempt: 1, service: "llm", model: "qwen3.5:9b", status: "received", startedAt: timestamp, finishedAt: timestamp, latencyMs: 10 })),
  };
}

function successfulResult(runId: string) {
  return {
    format: "ollama-understand-nightly-launch-result/v1",
    status: "COMPLETED",
    runId,
    inputSha256: frozen.inputSha256,
    codeManifestSha256: frozen.codeManifestSha256,
    wrapperSha256: frozen.wrapperSha256,
    launcherSha256: frozen.launcherSha256,
    model: "qwen3.5:9b",
    modelDigest: NIGHTLY_PILOT_CONSTANTS.modelDigest,
    modelRemoteMarkerStatus: "absent",
    modelCloudMarkerStatus: "null",
    apiImageId: "sha256:54d1a34f104b665ccdecc60e82f4cb67acf114fb3171b742990464ee6d4c7bc6",
    packageLockMatch: true,
    sourcePackageLockCanonicalSha256: frozen.packageLockCanonicalSha256,
    apiPackageLockCanonicalSha256: frozen.packageLockCanonicalSha256,
    imageSensitiveEnvAbsent: true,
    imageNodeOptionsAbsent: true,
    imageNodePathAbsent: true,
    actualProviderRequests: 8,
    receiptAttempts: 8,
    completedReceipts: 8,
    failedReceipts: 0,
    pendingReceipts: 0,
    unknownReceipts: 0,
    businessRowCountsUnchanged: true,
    predictionsSha256: "A".repeat(64),
    predictionsPath: path.join(resultDirectory, "predictions.json"),
    receiptEvidenceSha256: "B".repeat(64),
    receiptEvidencePath: path.join(resultDirectory, "receipts.json"),
    pgDumpSha256: "F".repeat(64),
    pgDumpPath: path.join(resultDirectory, "pilot.dump"),
    clientContainerId: "c".repeat(64),
    pgContainerId: "d".repeat(64),
    requestStartedAtEpochMs: Array.from({ length: 8 }, (_, i) => Date.parse("2026-10-27T18:00:00Z") + i * 1000),
    finishedAt: "2026-10-27T19:00:00.000Z",
  };
}

function harness(overrides: Record<string, unknown> = {}) {
  let state: any = overrides.initialState ?? null;
  let currentTime = overrides.now ?? normalTime;
  const writes: unknown[] = [];
  const calls: unknown[] = [];
  const verifyCalls: unknown[] = [];
  const options = {
    repoRoot,
    statePath,
    launcherPath,
    wrapperPath,
    expectedWrapperSha256: frozen.wrapperSha256,
    expectedLauncherSha256: frozen.launcherSha256,
    resultDirectory,
    lockHeld: true,
    now: () => currentTime as Date,
    readState: async () => state,
    writeState: async (_path: string, value: unknown) => { state = value; writes.push(value); },
    readMemAvailable: async () => overrides.memoryBytes ?? NIGHTLY_PILOT_CONSTANTS.minMemAvailableBytes,
    verifyFrozen: async (_root: string, expected: unknown) => { verifyCalls.push(expected); return overrides.frozen ?? frozen; },
    verifyRuntime: async () => true,
    resultExists: async () => overrides.resultAlreadyExists ?? false,
    verifyArtifacts: async () => overrides.artifactsVerified ?? true,
    executeLauncher: async (args: unknown) => {
      calls.push(args);
      return {
        exitCode: overrides.exitCode ?? 0,
        timedOut: overrides.timedOut ?? false,
        readResult: async () => overrides.result ?? successfulResult((args as { runId: string }).runId),
      };
    },
  };
  return {
    options,
    writes,
    calls,
    verifyCalls,
    setTime(value: Date) { currentTime = value; },
    getState() { return state; },
  };
}

test("Shanghai schedule starts at 02:00 and closes at 06:00 local time", () => {
  assert.equal(getShanghaiSchedule(new Date("2026-10-27T17:59:59Z")).withinWindow, false);
  const start = getShanghaiSchedule(new Date("2026-10-27T18:00:00Z"));
  assert.equal(start.withinWindow, true);
  assert.equal(start.dateKey, "2026-10-28");
  assert.equal(start.deadlineEpochMs, Date.parse("2026-10-27T22:00:00Z"));
  assert.equal(getShanghaiSchedule(new Date("2026-10-27T21:59:59Z")).withinWindow, true);
  assert.equal(getShanghaiSchedule(new Date("2026-10-27T22:00:00Z")).withinWindow, false);
});

test("artifact verifier checks actual hashes, path confinement, and sanitized receipt evidence", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ollama-nightly-evidence-"));
  try {
    const predictionsPath = path.join(dir, "predictions.json");
    const receiptEvidencePath = path.join(dir, "receipts.json");
    const pgDumpPath = path.join(dir, "pilot.dump");
    const predictions = Buffer.from(JSON.stringify({
      format: "ollama-local-development-understand-pilot/v1",
      inputSha256: NIGHTLY_PILOT_CONSTANTS.inputSha256,
      actualProviderRequests: 8,
      results: [
        ["body-xkm1grgd10aj3ua4nwg5gfofd", "8BF8AB8815F43EF674BBC463296FBC3AA636A048F7DABBE38E42AC26604CCE1B", "2FF690CBE17DC2F480F9A0FD3FB14441FA6EB8C5AFDA50339ACAE1D756C7155B"],
        ["body-ebtwbnudqgmlkzj60wviji165", "3F97D5522F2057B3AE52D2E0EE6E08F270C41D7BFE5BD2CAF8833E9E5C245993", "13D0315D40C9BC690A3C47D7BBF155CBDBAC7FC6DF49753C76F51592AF334452"],
        ["body-fn6rshoxnk425y3ui1cxr6mpp", "2668AD3C5865B169F22D34853F4600EC437A8B6F9B9DB8038570D3F1B9C251D3", "C45CF48DA8FB58E95D1765E8D9D88388731270717D63C83B6125CBBE09A8A339"],
        ["body-j33dctglguvwqfa4ksqsdlwdf", "059E3C2D4607FCD0E7A0A8365BCAB7BD2A42191619E430DD8E1E183350221466", "2EB40BBC46DF54E9B0548BD64E033EAF9616BE6147F1232DF3A56555B6275EAB"],
      ].map(([caseId, inputSha256, bodySha256]) => ({ caseId, inputSha256, bodySha256 })),
    }) + "\n");
    const receipts = Buffer.from(`${JSON.stringify(receiptEvidence())}\n`);
    const dump = Buffer.from("pgdump bytes");
    await Promise.all([writeFile(predictionsPath, predictions), writeFile(receiptEvidencePath, receipts), writeFile(pgDumpPath, dump)]);
    const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex").toUpperCase();
    const result = {
      predictionsPath, predictionsSha256: hash(predictions),
      receiptEvidencePath, receiptEvidenceSha256: hash(receipts),
      pgDumpPath, pgDumpSha256: hash(dump),
    };
    assert.equal(await verifyArtifactFiles(result, dir), true);
    assert.equal(await verifyArtifactFiles({ ...result, pgDumpPath: path.join(dir, "..", "outside.dump") }, dir), false);
    const unsafe = Buffer.from(JSON.stringify({
      ...receiptEvidence(),
      receipts: receiptEvidence().receipts.map((row, index) => index === 0 ? { ...row, reasoning: "private" } : row),
    }));
    await writeFile(receiptEvidencePath, unsafe);
    assert.equal(await verifyArtifactFiles({ ...result, receiptEvidenceSha256: hash(unsafe) }, dir), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("reads MemAvailable in bytes and fails closed when it is missing", () => {
  assert.equal(parseMemAvailableBytes("MemTotal: 100 kB\nMemAvailable: 4194304 kB\nSwapFree: 9 kB\n"), 4 * 1024 ** 3);
  assert.throws(() => parseMemAvailableBytes("MemTotal: 100 kB\n"), /MEMINFO_UNAVAILABLE/u);
});

test("node runtime provenance requires the pinned private binary, version, and SHA", () => {
  // Independent value copied from the installer's verified node.sha256, not from the wrapper constant.
  const installerObservedNodeSha256 = "E32E2D16081CF644F88392934288086E7662529D0D43277C34F7AAD2207CFAFB";
  assert.equal(NIGHTLY_PILOT_CONSTANTS.privateNodeSha256, installerObservedNodeSha256);
  assert.deepEqual(verifyNodeRuntimeMetadata({
    version: NIGHTLY_PILOT_CONSTANTS.privateNodeVersion,
    actualPath: NIGHTLY_PILOT_CONSTANTS.privateNodePath,
    actualSha256: installerObservedNodeSha256,
  }), {
    version: NIGHTLY_PILOT_CONSTANTS.privateNodeVersion,
    path: NIGHTLY_PILOT_CONSTANTS.privateNodePath,
    sha256: installerObservedNodeSha256,
  });
  assert.throws(() => verifyNodeRuntimeMetadata({
    version: NIGHTLY_PILOT_CONSTANTS.privateNodeVersion,
    actualPath: NIGHTLY_PILOT_CONSTANTS.privateNodePath,
    actualSha256: "E32E2D16081CF644F88392934288086E7662529D0D43277C34F7AAD2207CFABF",
  }), /NIGHTLY_NODE_HASH_MISMATCH/u);
  assert.throws(() => verifyNodeRuntimeMetadata({
    version: NIGHTLY_PILOT_CONSTANTS.privateNodeVersion,
    actualPath: NIGHTLY_PILOT_CONSTANTS.privateNodePath,
    actualSha256: "0".repeat(64),
  }), /NIGHTLY_NODE_HASH_MISMATCH/u);
});

test("the old code pins reject the current checkout after source or line-ending changes", async () => {
  const repoRootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const wrapperFile = path.resolve(repoRootPath, "scripts/fiscal/ollama-understand-nightly.mjs");
  const wrapperHash = createHash("sha256").update(await readFile(wrapperFile)).digest("hex").toUpperCase();
  await assert.rejects(verifyFrozenFiles(repoRootPath, {
    wrapperPath: wrapperFile,
    launcherPath: wrapperFile,
    expectedWrapperSha256: wrapperHash,
    expectedLauncherSha256: wrapperHash,
  }), (error: unknown) => ["FROZEN_SOURCE_TREE_HASH_MISMATCH", "FROZEN_CODE_HASH_MISMATCH"].includes((error as { code?: string }).code ?? ""));
});

const frozenArtifactRoot = process.env.AIHOT_NIGHTLY_FROZEN_ROOT;
test("explicit old frozen artifact still verifies its pinned 228-file tree and evidence", {
  skip: !frozenArtifactRoot ? "set AIHOT_NIGHTLY_FROZEN_ROOT to the private frozen 228-file artifact" : false,
}, async () => {
  const repoRootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const artifactRoot = path.resolve(frozenArtifactRoot!);
  assert.notEqual(await realpath(artifactRoot), await realpath(repoRootPath), "frozen artifact must be an external copy");
  const wrapperFile = path.resolve(artifactRoot, "scripts/fiscal/ollama-understand-nightly.mjs");
  const launcherFile = path.resolve(artifactRoot, "scripts/fiscal/ollama-understand-nightly-launcher.sh");
  const wrapperHash = createHash("sha256").update(await readFile(wrapperFile)).digest("hex").toUpperCase();
  const launcherHash = createHash("sha256").update(await readFile(launcherFile)).digest("hex").toUpperCase();
  const result = await verifyFrozenFiles(artifactRoot, {
    wrapperPath: wrapperFile,
    launcherPath: launcherFile,
    expectedWrapperSha256: wrapperHash,
    expectedLauncherSha256: launcherHash,
  });
  assert.equal(result.inputSha256, NIGHTLY_PILOT_CONSTANTS.inputSha256);
  assert.equal(result.sourceFiles && Object.keys(result.sourceFiles).length, 228);
  assert.equal(result.wrapperSha256, wrapperHash);
  assert.equal(result.launcherSha256, launcherHash);
  assert.equal(result.packageLockCanonicalSha256.length, 64);
  assert.equal(result.codeManifestSha256, codeManifestSha256(result.codeFiles));
  await assert.rejects(verifyFrozenFiles(artifactRoot, {
    wrapperPath: wrapperFile,
    launcherPath: launcherFile,
    expectedWrapperSha256: "0".repeat(64),
    expectedLauncherSha256: launcherHash,
  }), /NIGHTLY_EXECUTABLE_HASH_MISMATCH/u);
});

test("below 4 GiB records SKIPPED_RESOURCE without launching; a later night may retry", async () => {
  const h = harness({ memoryBytes: NIGHTLY_PILOT_CONSTANTS.minMemAvailableBytes - 1 });
  const skipped = await runNightlyPilot(h.options as never);
  assert.equal(skipped.outcome, "SKIPPED_RESOURCE");
  assert.equal(skipped.state?.reason, "MEM_AVAILABLE_BELOW_4_GIB");
  assert.equal(h.calls.length, 0);

  h.setTime(new Date("2026-10-28T18:00:00Z"));
  h.options.readMemAvailable = async () => NIGHTLY_PILOT_CONSTANTS.minMemAvailableBytes;
  const retried = await runNightlyPilot(h.options as never);
  assert.equal(retried.outcome, "COMPLETED");
  assert.equal(h.calls.length, 1);
});

test("a resource skip cannot relaunch twice in the same Shanghai night", async () => {
  const h = harness({ memoryBytes: 1024 });
  assert.equal((await runNightlyPilot(h.options as never)).outcome, "SKIPPED_RESOURCE");
  h.options.readMemAvailable = async () => NIGHTLY_PILOT_CONSTANTS.minMemAvailableBytes;
  h.setTime(new Date("2026-10-27T20:00:00Z")); // 04:00 local, same night
  assert.equal((await runNightlyPilot(h.options as never)).outcome, "NOOP_ALREADY_ATTEMPTED_TODAY");
  assert.equal(h.calls.length, 0);
});

test("outside the window, terminal states and missing flock never launch", async () => {
  const outside = harness({ now: new Date("2026-10-27T22:00:00Z") });
  assert.equal((await runNightlyPilot(outside.options as never)).outcome, "NOOP_OUTSIDE_WINDOW");
  assert.equal(outside.calls.length, 0);
  assert.equal(outside.writes.length, 0);

  const completed = harness({ initialState: { format: "ollama-understand-nightly-state/v1", jobId: NIGHTLY_PILOT_CONSTANTS.jobId, status: "COMPLETED", attemptDateShanghai: "2026-10-26", inputSha256: frozen.inputSha256, codeManifestSha256: frozen.codeManifestSha256, wrapperSha256: frozen.wrapperSha256, launcherSha256: frozen.launcherSha256 } });
  assert.equal((await runNightlyPilot(completed.options as never)).outcome, "NOOP_TERMINAL");
  assert.equal(completed.calls.length, 0);

  const noLock = harness();
  noLock.options.lockHeld = false;
  await assert.rejects(runNightlyPilot(noLock.options as never), /FLOCK_REQUIRED/u);
  assert.equal(noLock.calls.length, 0);
});

test("an abandoned RUNNING state is terminal review, never an automatic retry", async () => {
  const h = harness({ initialState: {
    format: "ollama-understand-nightly-state/v1", jobId: NIGHTLY_PILOT_CONSTANTS.jobId, status: "RUNNING",
    attemptDateShanghai: "2026-10-26", inputSha256: frozen.inputSha256, codeManifestSha256: frozen.codeManifestSha256,
    wrapperSha256: frozen.wrapperSha256, launcherSha256: frozen.launcherSha256,
  } });
  const result = await runNightlyPilot(h.options as never);
  assert.equal(result.outcome, "REVIEW_REQUIRED");
  assert.equal(result.state?.reason, "STALE_RUNNING_STATE_UNCERTAIN_PROVIDER_OUTCOME");
  assert.equal(h.calls.length, 0);
});

test("runtime binary mismatch becomes terminal review before launcher execution", async () => {
  const h = harness();
  h.options.verifyRuntime = async () => { throw Object.assign(new Error("redacted"), { code: "NIGHTLY_NODE_HASH_MISMATCH" }); };
  const result = await runNightlyPilot(h.options as never);
  assert.equal(result.outcome, "REVIEW_REQUIRED");
  assert.equal(result.state?.reason, "NIGHTLY_NODE_HASH_MISMATCH");
  assert.equal(h.calls.length, 0);
});

test("successful result is pinned to 8 completed receipts and later runs are no-op", async () => {
  const h = harness();
  const result = await runNightlyPilot(h.options as never);
  assert.equal(result.outcome, "COMPLETED");
  assert.equal(result.state?.providerRequests, 8);
  assert.equal(result.state?.receiptEvidenceSha256, "B".repeat(64));
  assert.equal(h.calls.length, 1);
  assert.equal(h.verifyCalls.length, 2);
  assert.deepEqual(h.verifyCalls[0], h.verifyCalls[1]);
  assert.equal((await runNightlyPilot(h.options as never)).outcome, "NOOP_TERMINAL");
  assert.equal(h.calls.length, 1);
});

test("launcher-confirmed pre-container memory shortage is retryable next night", async () => {
  const h = harness({
    exitCode: 75,
    result: {
      format: "ollama-understand-nightly-launch-result/v1",
      runId: `${NIGHTLY_PILOT_CONSTANTS.jobId}-20261028`,
      status: "SKIPPED_RESOURCE",
      reason: "MODEL_RESIDENT_MEMORY_BELOW_GATE",
      preflightOnly: true,
      providerRequestsStarted: 0,
      actualProviderRequests: 0,
      containersCreated: 0,
      inputSha256: frozen.inputSha256,
      codeManifestSha256: frozen.codeManifestSha256,
      wrapperSha256: frozen.wrapperSha256,
      launcherSha256: frozen.launcherSha256,
      checkedAt: "2026-10-27T18:01:00Z",
    },
  });
  const skipped = await runNightlyPilot(h.options as never);
  assert.equal(skipped.outcome, "SKIPPED_RESOURCE");
  assert.equal(skipped.state?.providerRequests, 0);
  assert.equal(skipped.state?.reason, "MODEL_RESIDENT_MEMORY_BELOW_GATE");
  assert.equal(h.calls.length, 1);
  h.setTime(new Date("2026-10-28T18:00:00Z"));
  h.options.executeLauncher = async (args: unknown) => {
    h.calls.push(args);
    return { exitCode: 0, timedOut: false, readResult: async () => successfulResult((args as { runId: string }).runId) };
  };
  assert.equal((await runNightlyPilot(h.options as never)).outcome, "COMPLETED");
});

test("launcher-confirmed namespace port conflict is retryable with no container or request", async () => {
  const h = harness({
    exitCode: 75,
    result: {
      format: "ollama-understand-nightly-launch-result/v1",
      runId: `${NIGHTLY_PILOT_CONSTANTS.jobId}-20261028`,
      status: "SKIPPED_RESOURCE",
      reason: "PILOT_DB_PORT_BUSY",
      preflightOnly: true,
      providerRequestsStarted: 0,
      actualProviderRequests: 0,
      containersCreated: 0,
      inputSha256: frozen.inputSha256,
      codeManifestSha256: frozen.codeManifestSha256,
      wrapperSha256: frozen.wrapperSha256,
      launcherSha256: frozen.launcherSha256,
      checkedAt: "2026-10-27T18:01:00Z",
    },
  });
  const result = await runNightlyPilot(h.options as never);
  assert.equal(result.outcome, "SKIPPED_RESOURCE");
  assert.equal(result.state?.reason, "PILOT_DB_PORT_BUSY");
  assert.equal(result.state?.providerRequests, 0);
  assert.equal(h.calls.length, 1);
});

test("short remaining time skips before launch to avoid a partial overnight run", async () => {
  const h = harness({ now: new Date("2026-10-27T21:31:00Z") }); // 05:31, 29 minutes remain; 30-minute budget required
  const result = await runNightlyPilot(h.options as never);
  assert.equal(result.outcome, "SKIPPED_WINDOW");
  assert.equal(result.state?.reason, "INSUFFICIENT_WINDOW_FOR_FULL_8_REQUEST_RUN");
  assert.equal(h.calls.length, 0);
});

test("exact 30-minute remaining budget may start the single nightly run", async () => {
  const h = harness({ now: new Date("2026-10-27T21:30:00Z") }); // 05:30 local
  assert.equal((await runNightlyPilot(h.options as never)).outcome, "COMPLETED");
  assert.equal(h.calls.length, 1);
});

test("any launcher failure, deadline or malformed evidence becomes terminal review", async () => {
  for (const h of [
    harness({ exitCode: 1 }),
    harness({ timedOut: true }),
    harness({ result: { ...successfulResult("wrong-run"), actualProviderRequests: 7 } }),
    harness({ result: { ...successfulResult("bad-model-digest"), modelDigest: "0".repeat(64) } }),
    harness({ result: { ...successfulResult("bad-model-marker"), modelRemoteMarkerStatus: "remote" } }),
    harness({ result: { ...successfulResult("bad-image"), apiImageId: "wrong-image" } }),
    harness({ result: { ...successfulResult("bad-package-lock"), apiPackageLockCanonicalSha256: "0".repeat(64) } }),
    harness({ result: { ...successfulResult("bad-image-env"), imageNodePathAbsent: false } }),
    harness({ artifactsVerified: false }),
  ]) {
    const result = await runNightlyPilot(h.options as never);
    assert.equal(result.outcome, "REVIEW_REQUIRED");
    assert.equal(result.state?.status, "REVIEW_REQUIRED");
    assert.equal((await runNightlyPilot(h.options as never)).outcome, "NOOP_TERMINAL");
    assert.equal(h.calls.length, 1);
  }
});
