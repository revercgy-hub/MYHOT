export class NightlyPilotError extends Error {
  code: string;
}

export interface ShanghaiSchedule {
  dateKey: string;
  minuteOfDay: number;
  withinWindow: boolean;
  deadlineEpochMs: number;
}

export interface FrozenNightlyFiles {
  inputSha256: string;
  codeManifestSha256: string;
  wrapperSha256: string;
  launcherSha256: string;
  nodeSha256: string;
  packageLockCanonicalSha256: string;
  codeFiles: Record<string, string>;
  sourceFiles: Record<string, string>;
}

export interface NightlyPilotState {
  format: string;
  jobId: string;
  status: "SKIPPED_RESOURCE" | "SKIPPED_WINDOW" | "RUNNING" | "COMPLETED" | "REVIEW_REQUIRED";
  attemptDateShanghai: string;
  updatedAt: string;
  runId: string | null;
  reason: string | null;
  memoryAvailableBytes: number | null;
  inputSha256: string;
  codeManifestSha256: string;
  wrapperSha256: string | null;
  launcherSha256: string | null;
  [key: string]: unknown;
}

export function getShanghaiSchedule(date: Date): ShanghaiSchedule;
export function parseMemAvailableBytes(text: string): number;
export function codeManifestSha256(codeFiles: Record<string, string>): string;
export function verifyNodeRuntimeMetadata(options: {
  version: string;
  actualPath: string;
  expectedPath?: string;
  actualSha256: string;
}): { version: string; path: string; sha256: string };
export function verifyFrozenFiles(repoRoot: string, options: {
  wrapperPath: string;
  launcherPath: string;
  expectedWrapperSha256: string;
  expectedLauncherSha256: string;
}): Promise<FrozenNightlyFiles>;
export function verifyInheritedFlock(lockPath: string, fdDirectory?: string): Promise<boolean>;
export function verifyArtifactFiles(result: Record<string, unknown>, resultDirectory: string): Promise<boolean>;

export function runNightlyPilot(options: {
  repoRoot: string;
  statePath: string;
  launcherPath: string;
  wrapperPath: string;
  expectedWrapperSha256: string;
  expectedLauncherSha256: string;
  resultDirectory: string;
  lockHeld: boolean;
  now?: () => Date;
  readState: (path: string) => Promise<NightlyPilotState | null>;
  writeState: (path: string, state: NightlyPilotState) => Promise<void>;
  readMemAvailable: () => Promise<number>;
  verifyFrozen?: (repoRoot: string, options: {
    wrapperPath: string;
    launcherPath: string;
    expectedWrapperSha256: string;
    expectedLauncherSha256: string;
  }) => Promise<FrozenNightlyFiles>;
  verifyRuntime?: () => Promise<unknown>;
  resultExists: (path: string) => Promise<boolean>;
  verifyArtifacts?: (result: Record<string, unknown>, resultDirectory: string) => Promise<boolean>;
  executeLauncher: (args: {
    launcherPath: string;
    repoRoot: string;
    runId: string;
    deadlineEpochMs: number;
    resultPath: string;
    frozen: FrozenNightlyFiles;
  }) => Promise<{
    exitCode: number | null;
    timedOut?: boolean;
    readResult: (path: string) => Promise<Record<string, unknown>>;
  }>;
}): Promise<{ outcome: string; state: NightlyPilotState | null }>;

export const NIGHTLY_PILOT_CONSTANTS: Readonly<{
  timeZone: string;
  windowStart: string;
  windowEndExclusive: string;
  minMemAvailableBytes: number;
  minFullRunWindowMs: number;
  privateNodeVersion: string;
  privateNodePath: string;
  privateNodeSha256: string;
  minFullRunWindowMs: number;
  databasePort: number;
  requestCap: number;
  expectedProviderRequests: number;
  model: string;
  modelDigest: string;
  jobId: string;
  inputSha256: string;
  frozenCodeFiles: Readonly<Record<string, string>>;
}>;
export function minimalLauncherEnv(input: { runId: string; deadlineEpochMs: number; resultPath: string; frozen: { inputSha256: string; codeManifestSha256: string; wrapperSha256: string; launcherSha256: string } }, inheritedEnv?: NodeJS.ProcessEnv): Record<string, string>;
