export function prepareDetailMetadataCandidate(source: Record<string, any>): {
  format: string; status: string; sourceId: string; beforeConfigSha256: string; candidateConfigSha256: string;
  candidate: Record<string, any>; guardrails: Record<string, boolean | number>;
};
