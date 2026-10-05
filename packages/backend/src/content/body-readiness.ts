import { sql, type Sql } from "../db.ts";

export const STRICT_BODY_READY_CONFIG_KEY = "requireBodyReadyForAutomaticSelection";

/** Opt-in is deliberately exact: absent, false, and non-boolean values keep legacy behavior. */
export function requiresBodyReadyForAutomaticSelection(config: unknown): boolean {
  if (!config || typeof config !== "object" || Array.isArray(config)) return false;
  const aihot = (config as Record<string, unknown>)._aihot;
  return !!aihot && typeof aihot === "object" && !Array.isArray(aihot) &&
    (aihot as Record<string, unknown>)[STRICT_BODY_READY_CONFIG_KEY] === true;
}

export function isBodyReady(bodyStatus: unknown, bodyText: unknown): boolean {
  return bodyStatus === "ok" && typeof bodyText === "string" && bodyText.trim().length > 0;
}

export function requiresBodyReadinessHold(config: unknown, bodyStatus: unknown, bodyText: unknown): boolean {
  return requiresBodyReadyForAutomaticSelection(config) && !isBodyReady(bodyStatus, bodyText);
}

/** SQL equivalent used by every public projection and by selected-ledger reads. */
export function bodyReadinessHoldSql(sourceConfig: ReturnType<Sql>, bodyStatus: ReturnType<Sql>, bodyText: ReturnType<Sql>) {
  const enabled = sql`coalesce(${sourceConfig} -> '_aihot' -> ${STRICT_BODY_READY_CONFIG_KEY} = 'true'::jsonb, false)`;
  // Match String.trim()'s ECMAScript whitespace set, including NBSP, line separators, ideographic
  // space, and BOM. PostgreSQL btrim(text) without an explicit character set removes only U+0020.
  const trimChars = sql`E' \\t\\n\\r\\f' || chr(11) || chr(160) || chr(5760) || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196) || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201) || chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288) || chr(65279)`;
  const ready = sql`coalesce(${bodyStatus} = 'ok' AND nullif(btrim(${bodyText}, ${trimChars}), '') IS NOT NULL, false)`;
  return sql`(${enabled} AND NOT (${ready}))`;
}
