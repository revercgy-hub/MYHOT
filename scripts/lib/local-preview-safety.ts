const LOCAL_PREVIEW_DATABASE = "fiscalhot_preview_test";
const LOCAL_PREVIEW_HOST = "127.0.0.1";
const LOCAL_PREVIEW_PORT = "5432";
const SAFE_OFF_FLAGS = [
  "COLLECT_ENABLED",
  "MODEL_CALLS_ENABLED",
  "JINA_BODY_FALLBACK",
  "INDEXNOW_SUBMIT_ENABLED",
  "FEISHU_CONTENT_PUSH_ENABLED",
  "FEISHU_INTERNAL_ENABLED",
  "ALLOW_PRIVATE_NETWORK_FETCH",
] as const;

export interface PreviewSeedEnvironment {
  DATABASE_URL?: string;
  NODE_ENV?: string;
  DEV_AUTH_ROLE?: string;
  [key: string]: string | undefined;
}

/** A familiar prefix alone is not authorization to mutate data in the preview database. */
export function assertLocalPreviewIds(ids: readonly string[], allowedIds: readonly string[]): void {
  const allowed = new Set(allowedIds);
  const unknown = [...new Set(ids.filter((id) => !allowed.has(id)))];
  if (unknown.length) throw new Error(`preview DB contains IDs outside the fixed sample allow-list: ${unknown.join(", ")}`);
}

/** Fill only unset safety flags with false, then verify the exact isolated target before DB imports. */
export function prepareLocalPreviewSeedEnvironment(env: PreviewSeedEnvironment): { database: string; safetyFlags: Record<string, "false"> } {
  if (env.NODE_ENV === "production") throw new Error("local preview seed is forbidden in production");
  if (Object.keys(env).some((key) => key.startsWith("DEV_AUTH_") && !!env[key])) throw new Error("local preview seed refuses DEV_AUTH_* bypasses");

  for (const key of SAFE_OFF_FLAGS) {
    if (env[key] === undefined || env[key] === "") env[key] = "false";
    if (!/^(false|0)$/i.test(env[key]!)) throw new Error(`local preview seed requires ${key}=false`);
    env[key] = "false";
  }
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("FEISHU_") && key.endsWith("_ENABLED") && value && !/^(false|0)$/i.test(value)) {
      throw new Error(`local preview seed requires ${key}=false`);
    }
  }

  let target: URL;
  try {
    target = new URL(env.DATABASE_URL ?? "");
  } catch {
    throw new Error("local preview seed requires an explicit DATABASE_URL");
  }
  const database = target.pathname.replace(/^\//, "");
  if (target.protocol !== "postgres:" && target.protocol !== "postgresql:") throw new Error("local preview seed requires PostgreSQL");
  if (target.hostname !== LOCAL_PREVIEW_HOST || target.port !== LOCAL_PREVIEW_PORT || database !== LOCAL_PREVIEW_DATABASE
    || target.username !== "postgres" || target.password || target.search || target.hash) {
    throw new Error("local preview seed only accepts postgres@127.0.0.1:5432/fiscalhot_preview_test without password or URL options");
  }
  return { database, safetyFlags: Object.fromEntries(SAFE_OFF_FLAGS.map((key) => [key, "false"])) as Record<string, "false"> };
}
