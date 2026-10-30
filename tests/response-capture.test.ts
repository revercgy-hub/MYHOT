import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { fetch } from "undici";
import { ResponseCapture, decodeCapturedResponse } from "../scripts/fiscal/nas-candidate-batch.ts";

test("response capture retains complete compressed entity bytes independently of Fetch decoding", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "fiscal-capture-"));
  mkdirSync(path.join(directory, "responses"));
  const text = "<html>完整中文列表证据</html>", raw = gzipSync(text);
  const server = createServer((_req, res) => { res.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-encoding": "gzip" }); res.end(raw); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const capture = new ResponseCapture(path.join(directory, "responses"));
  try {
    const port = (server.address() as { port: number }).port;
    assert.equal(await (await fetch(`http://127.0.0.1:${port}/`)).text(), text);
    assert.equal(capture.rows.length, 1);
    const row = capture.rows[0]!;
    assert.equal(row.eof, true); assert.equal(row.truncated, false); assert.equal(row.bytes, raw.length);
    assert.equal(row.sha256, createHash("sha256").update(raw).digest("hex"));
    assert.deepEqual(readFileSync(path.join(directory, row.file!)), raw);
    assert.equal(decodeCapturedResponse(raw, row.contentType, row.contentEncoding), text);
  } finally {
    capture.close(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    assert.ok(directory.startsWith(path.join(os.tmpdir(), "fiscal-capture-")));
    rmSync(directory, { recursive: true });
  }
});
