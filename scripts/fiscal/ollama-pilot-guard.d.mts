export class PilotGuardError extends Error {}

export interface PilotGuardStats {
  requests: number;
  inFlight: number;
}

export type GuardedFetch = typeof fetch & { readonly stats: PilotGuardStats };

export function assertPilotDatabaseUrl(value: string): URL;

export function createOllamaPilotFetchGuard(options: {
  apiKey: string;
  nativeFetch?: typeof fetch;
  maxRequests?: number;
  maxInFlight?: number;
  expectedBaseUrl?: string;
  expectedModel?: string;
}): GuardedFetch;

export const OLLAMA_PILOT_CONSTANTS: Readonly<{
  database: string;
  databaseHost: string;
  databasePort: string;
  baseUrl: string;
  model: string;
  requestCap: number;
  concurrency: number;
  tokenCaps: readonly number[];
}>;
