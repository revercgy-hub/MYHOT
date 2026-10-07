import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";

export const DEFAULT_P3_CONTENT_ENCODING_LIMIT_BYTES = 6 * 1024 * 1024;

export interface ContentEncodingLimits {
  maxInputBytes?: number;
  maxOutputBytes?: number;
}

export type ContentEncodingErrorCode =
  | "invalid_limit"
  | "input_too_large"
  | "output_too_large"
  | "stacked_content_encoding"
  | "unsupported_content_encoding"
  | "malformed_compressed_body";

export class ContentEncodingError extends Error {
  readonly code: ContentEncodingErrorCode;

  constructor(code: ContentEncodingErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ContentEncodingError";
    this.code = code;
  }
}

/** Read a local capture without allocating or retaining more than maxBytes + 1 bytes. */
export async function readBoundedFile(path: string, maxBytes = DEFAULT_P3_CONTENT_ENCODING_LIMIT_BYTES): Promise<Buffer> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > DEFAULT_P3_CONTENT_ENCODING_LIMIT_BYTES) {
    throw new ContentEncodingError("invalid_limit", `P3 file byte limit must be between 1 and ${DEFAULT_P3_CONTENT_ENCODING_LIMIT_BYTES}`);
  }
  const handle = await open(path, "r");
  try {
    const initial = await handle.stat();
    if (!initial.isFile()) throw new Error("Input path must be a regular file");
    if (initial.size > maxBytes) {
      throw new ContentEncodingError("input_too_large", `Input file exceeds the ${maxBytes}-byte limit`);
    }

    const bounded = Buffer.allocUnsafe(maxBytes + 1);
    let total = 0;
    while (total <= maxBytes) {
      const { bytesRead } = await handle.read(bounded, total, maxBytes + 1 - total, total);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > maxBytes) {
        throw new ContentEncodingError("input_too_large", `Input file exceeds the ${maxBytes}-byte limit`);
      }
    }
    return Buffer.from(bounded.subarray(0, total));
  } finally {
    await handle.close();
  }
}

/** Decode one bounded HTTP content-encoding layer for offline P3 evidence inspection. */
export function decodeContentEncoding(
  raw: Buffer,
  contentEncoding?: string | null,
  limits: ContentEncodingLimits = {},
): Buffer {
  const maxInputBytes = limits.maxInputBytes ?? DEFAULT_P3_CONTENT_ENCODING_LIMIT_BYTES;
  const maxOutputBytes = limits.maxOutputBytes ?? DEFAULT_P3_CONTENT_ENCODING_LIMIT_BYTES;
  if (!Number.isSafeInteger(maxInputBytes) || maxInputBytes < 1 || maxInputBytes > DEFAULT_P3_CONTENT_ENCODING_LIMIT_BYTES
    || !Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > DEFAULT_P3_CONTENT_ENCODING_LIMIT_BYTES) {
    throw new ContentEncodingError("invalid_limit", `P3 content-encoding byte limits must be between 1 and ${DEFAULT_P3_CONTENT_ENCODING_LIMIT_BYTES}`);
  }
  if (raw.byteLength > maxInputBytes) {
    throw new ContentEncodingError("input_too_large", `Encoded body exceeds the ${maxInputBytes}-byte input limit`);
  }

  const normalized = (contentEncoding ?? "").trim().toLowerCase();
  if (normalized.includes(",")) {
    throw new ContentEncodingError("stacked_content_encoding", "Stacked content-encodings are not supported");
  }
  if (normalized && !["identity", "gzip", "br", "deflate"].includes(normalized)) {
    throw new ContentEncodingError("unsupported_content_encoding", `Unsupported content-encoding: ${normalized}`);
  }

  if (!normalized || normalized === "identity") {
    if (raw.byteLength > maxOutputBytes) {
      throw new ContentEncodingError("output_too_large", `Decoded body exceeds the ${maxOutputBytes}-byte output limit`);
    }
    return Buffer.from(raw);
  }

  try {
    const decoded = normalized === "gzip"
      ? gunzipSync(raw, { maxOutputLength: maxOutputBytes })
      : normalized === "br"
        ? brotliDecompressSync(raw, { maxOutputLength: maxOutputBytes })
        : inflateSync(raw, { maxOutputLength: maxOutputBytes });
    if (decoded.byteLength > maxOutputBytes) {
      throw new ContentEncodingError("output_too_large", `Decoded body exceeds the ${maxOutputBytes}-byte output limit`);
    }
    return decoded;
  } catch (error) {
    if (error instanceof ContentEncodingError) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ERR_BUFFER_TOO_LARGE") {
      throw new ContentEncodingError("output_too_large", `Decoded body exceeds the ${maxOutputBytes}-byte output limit`, { cause: error });
    }
    throw new ContentEncodingError("malformed_compressed_body", `Could not decode ${normalized} content-encoding`, { cause: error });
  }
}

function printUsage(): void {
  console.log("Usage: node scripts/fiscal/p3-content-encoding.ts [--encoding identity|gzip|br|deflate] [--text] <captured-response-body>");
  console.log("Reads a local file only; reports wire/decoded sizes and SHA-256. Text output is opt-in and strict UTF-8.");
}

async function runCli(args: string[]): Promise<void> {
  let encoding: string | undefined;
  let showText = false;
  let inputPath: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg === "--help" || arg === "-h") {
      printUsage();
      return;
    }
    if (arg === "--text") {
      showText = true;
      continue;
    }
    if (arg === "--encoding") {
      const value = args[++index];
      if (!value) throw new Error("--encoding requires a value");
      encoding = value;
      continue;
    }
    if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    if (inputPath) throw new Error("Provide exactly one captured response body path");
    inputPath = arg;
  }
  if (!inputPath) throw new Error("A captured response body path is required");

  const raw = await readBoundedFile(inputPath);
  const decoded = decodeContentEncoding(raw, encoding);
  const summary: Record<string, unknown> = {
    contentEncoding: encoding?.trim().toLowerCase() || "identity",
    wireBytes: raw.byteLength,
    wireSha256: createHash("sha256").update(raw).digest("hex"),
    decodedBytes: decoded.byteLength,
    decodedSha256: createHash("sha256").update(decoded).digest("hex"),
  };
  if (showText) {
    try {
      summary.text = new TextDecoder("utf-8", { fatal: true }).decode(decoded);
    } catch (error) {
      throw new Error("Decoded body is not valid UTF-8; text was not printed", { cause: error });
    }
  }
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    process.exitCode = 1;
  });
}
