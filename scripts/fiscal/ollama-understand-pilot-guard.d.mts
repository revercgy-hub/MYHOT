export class UnderstandPilotGuardError extends Error {}

export interface UnderstandPilotGuardStats {
  requests: number;
  inFlight: number;
  requestCap: number;
  expectedCalls: number;
  requestStartedAtEpochMs: number[];
}

export type UnderstandPilotGuardedFetch = typeof fetch & { readonly stats: UnderstandPilotGuardStats };

export function assertUnderstandPilotDatabaseUrl(value: string): URL;

export function assertUnderstandPilotRuntimeIdentity(options: {
  dockerEnvExists: boolean;
  hostname: string;
  expectedContainerId: string;
  markerContainerId: string;
}): { hostname: string; containerId: string };

export function createUnderstandPilotFetchGuard(options: {
  apiKey: string;
  nativeFetch?: typeof fetch;
  expectedBaseUrl?: string;
  expectedModel?: string;
  deadlineEpochMs?: number | null;
  now?: () => number;
}): UnderstandPilotGuardedFetch;

export const UNDERSTAND_PILOT_CONSTANTS: Readonly<{
  database: string;
  databaseHost: string;
  databasePort: string;
  baseUrl: string;
  model: string;
  requestCap: number;
  concurrency: number;
  stageTokenCaps: Readonly<{ structure: number; understand: number }>;
  stageTimeoutMs: Readonly<{ structure: number; understand: number }>;
  expectedCalls: number;
}>;
