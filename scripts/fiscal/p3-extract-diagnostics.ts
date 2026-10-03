// Local-only observer for the structured warning emitted by extractArticleBody().
// It stores only a fixed article ID, source ID, outcome, and an allowlisted helper reason.
import { AsyncLocalStorage } from "node:async_hooks";

export type ExtractState = "ok" | "unconfirmed" | "skipped";
export type ExtractFailureReason =
  | "selector_missing" | "selector_not_unique" | "body_policy_invalid" | "body_policy_ambiguous"
  | "body_policy_table_invalid" | "non_article_container" | "empty_body" | "short_body_not_allowed"
  | "identity_missing" | "identity_mismatch" | "attachments_unprocessed" | "article_missing"
  | "article_not_unique" | "body_missing" | "body_not_unique" | "attachment_region_not_unique"
  | "attachment_required" | "attachment_ambiguous" | "attachment_unsupported" | "attachment_unclassified"
  | "attachment_url_invalid" | "article_not_html" | "article_http_status" | "article_fetch_failed"
  | "pdf_body_unconfirmed";

export interface P3ExtractDiagnostic {
  articleId: string;
  state: ExtractState | "threw";
  sourceId: string | null;
  failureReason: ExtractFailureReason | null;
}

type CaptureState = { articleId: string; sourceId: string | null; failureReason: ExtractFailureReason | null };
const context = new AsyncLocalStorage<CaptureState>();
let captureQueue: Promise<void> = Promise.resolve();
const SAFE_REASONS = new Set<ExtractFailureReason>([
  "selector_missing", "selector_not_unique", "body_policy_invalid", "body_policy_ambiguous",
  "body_policy_table_invalid", "non_article_container", "empty_body", "short_body_not_allowed",
  "identity_missing", "identity_mismatch", "attachments_unprocessed", "article_missing",
  "article_not_unique", "body_missing", "body_not_unique", "attachment_region_not_unique",
  "attachment_required", "attachment_ambiguous", "attachment_unsupported", "attachment_unclassified",
  "attachment_url_invalid", "article_not_html", "article_http_status", "article_fetch_failed",
  "pdf_body_unconfirmed",
]);

function safeSourceId(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value) ? value : null;
}

function observeWarning(args: unknown[], capture: CaptureState): void {
  if (capture.failureReason !== null || typeof args[0] !== "string") return;
  let record: unknown;
  try { record = JSON.parse(args[0]); } catch { return; }
  if (!record || typeof record !== "object") return;
  const value = record as Record<string, unknown>;
  if (value.level !== "warn" || value.msg !== "source body selector declined" || value.article !== capture.articleId) return;
  if (typeof value.reason !== "string" || !SAFE_REASONS.has(value.reason as ExtractFailureReason)) return;
  capture.sourceId = safeSourceId(value.source);
  capture.failureReason = value.reason as ExtractFailureReason;
}

/** Serialize this temporary process-wide console patch; AsyncLocalStorage isolates unrelated async work. */
export async function captureExtractBodyDiagnostic(
  articleId: string,
  extract: (id: string) => Promise<ExtractState>,
): Promise<P3ExtractDiagnostic> {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(articleId)) throw new Error("Invalid diagnostic article ID");
  const previous = captureQueue;
  let release!: () => void;
  captureQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;

  const capture: CaptureState = { articleId, sourceId: null, failureReason: null };
  const originalDescriptor = Object.getOwnPropertyDescriptor(console, "warn");
  const originalWarn = console.warn;
  const wrappedWarn = function (this: Console, ...args: unknown[]) {
    const active = context.getStore();
    if (active === capture) observeWarning(args, capture);
    return Reflect.apply(originalWarn, this, args);
  };
  let state: P3ExtractDiagnostic["state"] = "threw";
  try {
    Object.defineProperty(console, "warn", { configurable: true, enumerable: originalDescriptor?.enumerable ?? false, writable: true, value: wrappedWarn });
    try {
      state = await context.run(capture, () => extract(articleId));
    } catch {
      state = "threw";
    }
    return { articleId, state, sourceId: capture.sourceId, failureReason: capture.failureReason };
  } finally {
    if (originalDescriptor) Object.defineProperty(console, "warn", originalDescriptor);
    else delete (console as Partial<Console>).warn;
    release();
  }
}

/** Run the backend extractor once and return only fields safe for a local diagnostic manifest. */
export async function runExtractArticleBodyDiagnostic(articleId: string): Promise<P3ExtractDiagnostic> {
  for (const key of ["COLLECT_ENABLED", "MODEL_CALLS_ENABLED", "INDEXNOW_SUBMIT_ENABLED", "FEISHU_CONTENT_PUSH_ENABLED", "FEISHU_INTERNAL_ENABLED", "JINA_BODY_FALLBACK", "ALLOW_PRIVATE_NETWORK_FETCH"]) {
    process.env[key] = "false";
  }
  const { extractArticleBody } = await import("@aihot/backend/content/extract");
  return captureExtractBodyDiagnostic(articleId, (id) => extractArticleBody(id, false));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const articleId = process.argv[2] ?? "";
  if (!articleId) {
    console.error("Usage: node scripts/fiscal/p3-extract-diagnostics.ts <articleId>");
    process.exitCode = 2;
  } else {
    const result = await runExtractArticleBodyDiagnostic(articleId);
    console.log(JSON.stringify(result));
    if (result.state === "threw") process.exitCode = 1;
  }
}
