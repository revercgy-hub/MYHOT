import { createHash } from 'node:crypto';
const FIELDS = {
  'mof-treasury-debt-data': ['titleSelector', 'publishedAtRegex'],
  'pboc-open-market': ['titleSelector', 'titleAuthoritative', 'publishedAtRegex', 'publishedAtAuthoritative'],
};
export const stableSourceJson = value => Array.isArray(value) ? `[${value.map(stableSourceJson).join(',')}]` : value && typeof value === 'object'
  ? `{${Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableSourceJson(value[key])).join(',')}}` : JSON.stringify(value);
const sha = value => createHash('sha256').update(stableSourceJson(value)).digest('hex');

/** Reconcile only missing title/date metadata on two existing disabled sources. */
export function prepareSourceMetadataReconciliation(live, canonical) {
  const fields = FIELDS[live?.id];
  if (!fields || canonical?.id !== live.id || live.kind !== 'web_list' || live.kind !== canonical.kind || live.name !== canonical.name) throw Error('source reconciliation identity mismatch');
  for (const flag of ['enabled', 'site_fulltext', 'syndicate_fulltext']) if (live[flag] !== false || canonical[flag] !== false) throw Error('source reconciliation requires disabled flags');
  if (!live.config?.detail || !canonical.config?.detail) throw Error('source detail metadata required');
  const candidateConfig = structuredClone(live.config), addedFields = [];
  for (const key of fields) {
    const value = canonical.config.detail[key];
    if ((key.endsWith('Authoritative') && value !== true) || (!key.endsWith('Authoritative') && (typeof value !== 'string' || !value.trim()))) throw Error('canonical metadata field is invalid');
    if (Object.hasOwn(live.config.detail, key)) {
      if (stableSourceJson(live.config.detail[key]) !== stableSourceJson(value)) throw Error('existing metadata cannot be overwritten');
    } else { candidateConfig.detail[key] = value; addedFields.push('detail.' + key); }
  }
  if (stableSourceJson(candidateConfig) !== stableSourceJson(canonical.config)) throw Error('non-metadata source drift is outside reconciliation scope');
  return { format: 'fiscal.source-metadata-reconciliation/v1', sourceId: live.id, status: addedFields.length ? 'CANDIDATE' : 'UNCHANGED',
    addedFields, beforeConfigSha256: sha(live.config), candidateConfigSha256: sha(candidateConfig), candidateConfig };
}
