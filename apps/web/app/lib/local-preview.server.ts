import { isIP } from "node:net";

export interface LocalPreviewEnvironment {
  LOCAL_PREVIEW_ENABLED?: string;
  NODE_ENV?: string;
  SITE_URL?: string;
  WEB_HOST?: string;
  API_BASE_URL?: string;
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized === "::1") return true;
  return isIP(normalized) === 4 && normalized.startsWith("127.");
}

function isLoopbackUrl(value: string | undefined, fallback: string): boolean {
  try {
    const url = new URL(value || fallback);
    return (url.protocol === "http:" || url.protocol === "https:") && isLoopbackHost(url.hostname)
      && !url.username && !url.password && !url.search && !url.hash && (url.pathname === "/" || url.pathname === "");
  } catch {
    return false;
  }
}

/** Validate the opt-in using server-only configuration; requests cannot enable preview mode. */
export function resolveLocalPreviewEnabled(env: LocalPreviewEnvironment): boolean {
  const enabled = env.LOCAL_PREVIEW_ENABLED === "true" || env.LOCAL_PREVIEW_ENABLED === "1";
  if (!enabled) return false;
  if (env.NODE_ENV === "production") throw new Error("LOCAL_PREVIEW_ENABLED is forbidden in production");
  if (!isLoopbackUrl(env.SITE_URL, "https://example.invalid")) throw new Error("LOCAL_PREVIEW_ENABLED requires a loopback SITE_URL");
  if (!isLoopbackUrl(env.API_BASE_URL, "http://127.0.0.1:3001")) throw new Error("LOCAL_PREVIEW_ENABLED requires a loopback API_BASE_URL");
  if (!isLoopbackHost(env.WEB_HOST || "127.0.0.1")) throw new Error("LOCAL_PREVIEW_ENABLED requires a loopback WEB_HOST");
  return true;
}

export const LOCAL_PREVIEW_ENABLED = resolveLocalPreviewEnabled(process.env);

const LOCAL_PREVIEW_ARTICLE_IDS = new Set([
  "local-preview-pboc-omo-191",
  "local-preview-mof-budget-qa",
  "local-preview-pboc-xiamen-payment",
]);

export function isLocalPreviewArticleId(id: string): boolean {
  return LOCAL_PREVIEW_ARTICLE_IDS.has(id);
}
