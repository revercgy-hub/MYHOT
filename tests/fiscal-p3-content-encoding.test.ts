import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, deflateSync, gzipSync } from "node:zlib";
import * as cheerio from "cheerio";
import { test } from "node:test";
import {
  ContentEncodingError,
  DEFAULT_P3_CONTENT_ENCODING_LIMIT_BYTES,
  decodeContentEncoding,
  readBoundedFile,
} from "../scripts/fiscal/p3-content-encoding.ts";

const html = Buffer.from([
  "<html><body><ul>",
  '<li class="item"><a href="/gzdt/caizhengjiancha/202608/t20260828_3996275.htm">exact</a></li>',
  '<li class="item"><a href="/gzdt/caizhengjiancha/202608/t20260828_3996275.htm.evil">suffix</a></li>',
  "</ul></body></html>",
].join(""), "utf8");

function expectCode(run: () => unknown, code: ContentEncodingError["code"]): void {
  assert.throws(run, (error: unknown) => error instanceof ContentEncodingError && error.code === code);
}

test("identity and absent content-encoding preserve an empty or plain body", () => {
  assert.deepEqual(decodeContentEncoding(Buffer.alloc(0)), Buffer.alloc(0));
  assert.deepEqual(decodeContentEncoding(html, "identity"), html);
  assert.deepEqual(decodeContentEncoding(html, "  IDENTITY  "), html);
});

test("gzip, Brotli, and deflate decode to the original bytes", () => {
  assert.deepEqual(decodeContentEncoding(gzipSync(html), "gzip"), html);
  assert.deepEqual(decodeContentEncoding(brotliCompressSync(html), "br"), html);
  assert.deepEqual(decodeContentEncoding(deflateSync(html), "deflate"), html);
});

test("a gzip listing is decoded before local Cheerio candidate inspection", () => {
  const decoded = decodeContentEncoding(gzipSync(html), "gzip").toString("utf8");
  const $ = cheerio.load(decoded);
  const hrefs = $("li.item a").toArray().map((node) => $(node).attr("href"));
  assert.deepEqual(hrefs, [
    "/gzdt/caizhengjiancha/202608/t20260828_3996275.htm",
    "/gzdt/caizhengjiancha/202608/t20260828_3996275.htm.evil",
  ]);
  assert(hrefs.some((href) => href?.endsWith(".htm.evil")), "the candidate boundary must see and reject suffix lookalikes");
});

test("malformed, truncated, and stacked encodings fail closed", () => {
  expectCode(() => decodeContentEncoding(Buffer.from("not gzip"), "gzip"), "malformed_compressed_body");
  const compressed = gzipSync(html);
  expectCode(() => decodeContentEncoding(compressed.subarray(0, compressed.length - 4), "gzip"), "malformed_compressed_body");
  expectCode(() => decodeContentEncoding(compressed, "gzip, br"), "stacked_content_encoding");
});

test("unsupported encodings and invalid limits fail closed", async () => {
  expectCode(() => decodeContentEncoding(html, "compress"), "unsupported_content_encoding");
  expectCode(() => decodeContentEncoding(html, "identity", { maxInputBytes: 0 }), "invalid_limit");
  expectCode(() => decodeContentEncoding(html, "identity", { maxOutputBytes: DEFAULT_P3_CONTENT_ENCODING_LIMIT_BYTES + 1 }), "invalid_limit");
  await assert.rejects(readBoundedFile("unused", DEFAULT_P3_CONTENT_ENCODING_LIMIT_BYTES + 1), (error: unknown) =>
    error instanceof ContentEncodingError && error.code === "invalid_limit");
});

test("wire and decoded bodies each obey the six MiB bound", () => {
  const bytes = Buffer.alloc(6 * 1024 * 1024 + 1, 0x61);
  expectCode(() => decodeContentEncoding(bytes, "identity"), "input_too_large");

  const bomb = gzipSync(Buffer.alloc(1024 * 1024, 0x61));
  expectCode(() => decodeContentEncoding(bomb, "gzip", { maxOutputBytes: 64 * 1024 }), "output_too_large");
});

test("bounded file reader accepts normal files and rejects oversized captures before reading them", async () => {
  const directory = await mkdtemp(join(tmpdir(), "p3-content-encoding-"));
  const smallPath = join(directory, "small.body");
  const oversizedPath = join(directory, "oversized.body");
  try {
    const expected = Buffer.from("captured bytes", "utf8");
    await writeFile(smallPath, expected);
    assert.deepEqual(await readBoundedFile(smallPath, 64), expected);

    const oversizedHandle = await open(oversizedPath, "w");
    try {
      await oversizedHandle.truncate(DEFAULT_P3_CONTENT_ENCODING_LIMIT_BYTES + 1);
    } finally {
      await oversizedHandle.close();
    }
    await assert.rejects(readBoundedFile(oversizedPath), (error: unknown) =>
      error instanceof ContentEncodingError && error.code === "input_too_large");

    const cliPath = fileURLToPath(new URL("../scripts/fiscal/p3-content-encoding.ts", import.meta.url));
    const cli = spawnSync(process.execPath, [cliPath, "--encoding", "identity", oversizedPath], { encoding: "utf8" });
    assert.equal(cli.status, 1);
    assert.match(cli.stderr, /Input file exceeds the/);
    assert.equal((await readFile(smallPath)).byteLength, expected.byteLength);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
