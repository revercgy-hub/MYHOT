/** Internal, fail-closed marker for an article whose configured business attachment needs parsing. */
export const ATTACHMENT_DIAGNOSTIC_RAW_KEY = "_aihotBodyExtraction";
const UPSTREAM_RAW_KEY = "_aihotBodyExtractionUpstreamRaw";
const ESCAPED_UPSTREAM_RAW = "_aihotBodyExtractionEscapedUpstreamRaw";
const ESCAPED_FLAG = "_aihotBodyExtractionRestoreUpstreamRaw";
/** Companion provenance bit; every ingress escapes this reserved key before persistence. */
export const ATTACHMENT_DIAGNOSTIC_PIPELINE_MARKER_KEY = "_aihotBodyExtractionPipelineMarker";

const ENVELOPE_ATTACHMENT_FAILURES = new Set([
  "attachment_required", "attachment_ambiguous", "attachment_unsupported", "attachment_unclassified", "attachment_url_invalid", "attachment_region_not_unique",
]);

export const ATTACHMENT_DIAGNOSTIC_REASONS = [
  "attachments_unprocessed",
  "attachment_required",
  "attachment_ambiguous",
  "attachment_unsupported",
  "attachment_unclassified",
  "attachment_url_invalid",
  "attachment_region_not_unique",
  "pdf_url_rejected",
  "pdf_fetch_failed",
  "pdf_http_status",
  "pdf_redirected",
  "pdf_mime_rejected",
  "invalid_pdf",
  "pdf_too_large",
  "pdf_page_limit",
  "pdf_text_limit",
  "pdf_no_text",
  "pdf_page_no_text",
  "pdf_output_limit",
  "pdf_encrypted",
  "pdf_parse_failed",
  "pdf_timeout",
  "pdf_worker_failed",
  "pdf_layout_invalid",
] as const;
const PDF_ATTACHMENT_FAILURES = new Set(ATTACHMENT_DIAGNOSTIC_REASONS.filter((reason) => reason.startsWith("pdf_") || reason === "invalid_pdf"));

export type AttachmentDiagnosticReason = (typeof ATTACHMENT_DIAGNOSTIC_REASONS)[number];
export interface AttachmentReference {
  url: string;
  title: string;
}
export interface AttachmentDiagnostic {
  version: 1;
  state: "pending_parse";
  kind: "attachment";
  reason: AttachmentDiagnosticReason;
  articleUrl: string;
  attachments: AttachmentReference[];
}

export interface AttachmentDiagnosticInput {
  reason: string;
  articleUrl: string;
  attachments?: ReadonlyArray<{ url: string; title?: string | null }>;
}

type JsonRecord = Record<string, unknown>;
const own = (v: object, k: string) => Object.prototype.hasOwnProperty.call(v, k);
const record = (v: unknown): v is JsonRecord => v !== null && typeof v === "object" && !Array.isArray(v);

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    if (!(u.protocol === "https:" || u.protocol === "http:") || u.username || u.password) return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Build only the small, serialisable evidence shape. Unknown reasons and unsafe URLs are rejected. */
export function createAttachmentDiagnostic(input: AttachmentDiagnosticInput): AttachmentDiagnostic | null {
  const reason = ATTACHMENT_DIAGNOSTIC_REASONS.find((candidate) => candidate === input.reason);
  if (!reason) return null;
  const articleUrl = safeHttpUrl(input.articleUrl);
  if (!articleUrl) return null;
  const attachments: AttachmentReference[] = [];
  for (const entry of (input.attachments ?? []).slice(0, 20)) {
    const url = safeHttpUrl(entry?.url);
    if (!url) continue;
    attachments.push({ url, title: typeof entry.title === "string" ? entry.title.trim().slice(0, 300) : "" });
  }
  return { version: 1, state: "pending_parse", kind: "attachment", reason: input.reason as AttachmentDiagnosticReason, articleUrl, attachments };
}

/** Classify only evidence produced by an explicit attachment/direct-PDF config or selected PDF body. */
export function attachmentDiagnosticForFailure(
  config: { pdfDirect?: unknown; attachmentSelector?: unknown; attachmentScopeSelector?: unknown },
  input: AttachmentDiagnosticInput,
): AttachmentDiagnostic | null {
  const reason = ATTACHMENT_DIAGNOSTIC_REASONS.find((candidate) => candidate === input.reason);
  if (!reason) return null;
  const attached = Array.isArray(input.attachments) ? input.attachments.length > 0 : false;
  const explicitEnvelope = typeof config.attachmentSelector === "string" && !!config.attachmentSelector.trim();
  const eligible = reason === "attachments_unprocessed"
    ? attached
    : ENVELOPE_ATTACHMENT_FAILURES.has(reason)
      ? explicitEnvelope
      : PDF_ATTACHMENT_FAILURES.has(reason)
        ? config.pdfDirect === true || (explicitEnvelope && attached)
        : false;
  return eligible ? createAttachmentDiagnostic({ ...input, reason }) : null;
}

function readDiagnosticValue(value: unknown): AttachmentDiagnostic | null {
  if (!record(value) || value.version !== 1 || value.state !== "pending_parse" || value.kind !== "attachment" ||
    typeof value.reason !== "string" || typeof value.articleUrl !== "string" || !Array.isArray(value.attachments)) return null;
  const diagnostic = createAttachmentDiagnostic({
    reason: value.reason,
    articleUrl: value.articleUrl,
    attachments: value.attachments.filter(record).map((a) => ({ url: String(a.url ?? ""), title: typeof a.title === "string" ? a.title : "" })),
  });
  if (!diagnostic || diagnostic.attachments.length !== value.attachments.length) return null;
  return diagnostic;
}

export function readAttachmentDiagnostic(raw: unknown): AttachmentDiagnostic | null {
  return record(raw) && raw[ATTACHMENT_DIAGNOSTIC_PIPELINE_MARKER_KEY] === true
    ? readDiagnosticValue(raw[ATTACHMENT_DIAGNOSTIC_RAW_KEY])
    : null;
}

export function hasPendingAttachmentParse(raw: unknown): boolean {
  return readAttachmentDiagnostic(raw)?.state === "pending_parse";
}

function isEscapedUpstreamRaw(value: unknown): value is { _aihotBodyExtractionEscapedUpstreamRaw: { version: 1; raw: unknown } } {
  if (!record(value)) return false;
  const envelope = value[ESCAPED_UPSTREAM_RAW];
  return record(envelope) && envelope.version === 1 && own(envelope, "raw");
}

/**
 * Incoming feed/API raw data is untrusted. Escape a collision with our reserved namespace so an
 * upstream object can never forge the internal pending marker. The original value stays intact.
 */
export function preserveIncomingRaw(raw: unknown): unknown {
  if (isEscapedUpstreamRaw(raw) && !own(raw, ATTACHMENT_DIAGNOSTIC_RAW_KEY) && !own(raw, ATTACHMENT_DIAGNOSTIC_PIPELINE_MARKER_KEY) && !own(raw, UPSTREAM_RAW_KEY) && !own(raw, ESCAPED_FLAG)) {
    return raw;
  }
  if (record(raw) && (own(raw, ATTACHMENT_DIAGNOSTIC_RAW_KEY) || own(raw, ATTACHMENT_DIAGNOSTIC_PIPELINE_MARKER_KEY) || own(raw, UPSTREAM_RAW_KEY) || own(raw, ESCAPED_UPSTREAM_RAW) || own(raw, ESCAPED_FLAG))) {
    return { [ESCAPED_UPSTREAM_RAW]: { version: 1, raw } };
  }
  return raw;
}

export function setAttachmentDiagnostic(raw: unknown, diagnostic: AttachmentDiagnostic): unknown {
  const checked = readDiagnosticValue(diagnostic);
  if (!checked) throw new TypeError("invalid attachment diagnostic");
  // A valid companion proves this value was previously produced by this helper. Update in place
  // before ingress escaping so repeated diagnostic reasons do not nest/restore a stale marker.
  if (record(raw) && readAttachmentDiagnostic(raw)) {
    return { ...raw, [ATTACHMENT_DIAGNOSTIC_RAW_KEY]: checked, [ATTACHMENT_DIAGNOSTIC_PIPELINE_MARKER_KEY]: true };
  }
  const safeRaw = preserveIncomingRaw(raw);
  if (record(safeRaw)) {
    if (!own(safeRaw, ATTACHMENT_DIAGNOSTIC_RAW_KEY)) {
      if (isEscapedUpstreamRaw(safeRaw)) return { ...safeRaw, [ATTACHMENT_DIAGNOSTIC_RAW_KEY]: checked, [ATTACHMENT_DIAGNOSTIC_PIPELINE_MARKER_KEY]: true, [ESCAPED_FLAG]: true };
      return { ...safeRaw, [ATTACHMENT_DIAGNOSTIC_RAW_KEY]: checked, [ATTACHMENT_DIAGNOSTIC_PIPELINE_MARKER_KEY]: true };
    }
  }
  return { [ATTACHMENT_DIAGNOSTIC_RAW_KEY]: checked, [ATTACHMENT_DIAGNOSTIC_PIPELINE_MARKER_KEY]: true, [UPSTREAM_RAW_KEY]: safeRaw };
}

/** Remove only a valid internal marker, restoring the exact prior upstream raw value on collisions. */
export function clearAttachmentDiagnostic(raw: unknown): unknown {
  if (!record(raw) || !readAttachmentDiagnostic(raw)) return raw;
  if (own(raw, UPSTREAM_RAW_KEY)) return preserveIncomingRaw(raw[UPSTREAM_RAW_KEY]);
  const restoreEscaped = raw[ESCAPED_FLAG] === true;
  const { [ATTACHMENT_DIAGNOSTIC_RAW_KEY]: _marker, [ATTACHMENT_DIAGNOSTIC_PIPELINE_MARKER_KEY]: _trusted, [ESCAPED_FLAG]: _flag, ...rest } = raw;
  if (restoreEscaped && isEscapedUpstreamRaw(rest)) return preserveIncomingRaw(rest[ESCAPED_UPSTREAM_RAW].raw);
  return rest;
}

/**
 * Merge a new listing's raw payload without letting it erase an internal attachment marker. Missing
 * upstream raw means preserve the stored value. Existing marker data is authoritative only from the
 * stored row; inbound JSON is always escaped before it is considered.
 */
export function mergeIncomingRawWithStoredDiagnostic(existingRaw: unknown, incomingRaw: unknown): unknown {
  if (incomingRaw === undefined) return existingRaw;
  const previous = readAttachmentDiagnostic(existingRaw);
  const safeIncoming = preserveIncomingRaw(incomingRaw);
  return previous ? setAttachmentDiagnostic(safeIncoming, previous) : safeIncoming;
}
