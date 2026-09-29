import { fileURLToPath } from "node:url";
import { runBoundedProcess } from "./bounded-process.ts";

export type PdfTextFailure = "pdf_too_large" | "invalid_pdf" | "pdf_page_limit" | "pdf_text_limit" | "pdf_no_text" | "pdf_page_no_text" | "pdf_output_limit" | "pdf_encrypted" | "pdf_parse_failed" | "pdf_timeout" | "pdf_worker_failed";
export interface PdfTextLayoutLine { y: number; spans: Array<{ x: number; text: string }> }
export type PdfTextResult = { ok: true; pageCount: number; text: string; layout: Array<{ page: number; lines: PdfTextLayoutLine[] }> } | { ok: false; reason: PdfTextFailure };

const MAX_INPUT_BYTES = 6 * 1024 * 1024;
const MAX_TEXT_CHARS = 120_000;
const MAX_WORKER_OUTPUT_BYTES = 1024 * 1024;
const PDF_PARSE_TIMEOUT_MS = 10_000;
const workerPath = fileURLToPath(new URL("./pdf-text-worker.ts", import.meta.url));

// Parsing is serialized in this process. Each job still receives a fresh child process and document.
let queue: Promise<unknown> = Promise.resolve();

async function parseOne(bytes: Buffer): Promise<PdfTextResult> {
  const run = await runBoundedProcess(process.execPath, ["--experimental-strip-types", "--max-old-space-size=192", workerPath], {
    input: bytes,
    timeoutMs: PDF_PARSE_TIMEOUT_MS,
    maxOutputBytes: MAX_WORKER_OUTPUT_BYTES,
    windowsHide: true,
  });
  if (run.timedOut) return { ok: false, reason: "pdf_timeout" };
  if (run.outputExceeded) return { ok: false, reason: "pdf_output_limit" };
  if (run.spawnFailed || run.code !== 0) return { ok: false, reason: "pdf_worker_failed" };
  try {
    const response = JSON.parse(run.stdout.toString("utf8")) as PdfTextResult;
    if (response && response.ok === true && Number.isInteger(response.pageCount) && response.pageCount >= 1 && response.pageCount <= 40 &&
      typeof response.text === "string" && response.text.trim() && response.text.length <= MAX_TEXT_CHARS && Array.isArray(response.layout)) {
      return response;
    }
    if (response && response.ok === false && typeof response.reason === "string") return response;
  } catch { /* malformed child output fails closed */ }
  return { ok: false, reason: "pdf_worker_failed" };
}

/** Offline-only PDF text extraction. Accepts bytes; it never resolves URLs or fetches resources. */
export function parsePdfText(input: Uint8Array): Promise<PdfTextResult> {
  if (input.byteLength > MAX_INPUT_BYTES) return Promise.resolve({ ok: false, reason: "pdf_too_large" });
  const bytes = Buffer.from(input);
  if (bytes.length < 5 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
    return Promise.resolve({ ok: false, reason: "invalid_pdf" });
  }
  const result = queue.then(() => parseOne(bytes));
  queue = result.then(() => undefined, () => undefined);
  return result;
}
