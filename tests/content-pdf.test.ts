import assert from "node:assert/strict";
import { test } from "node:test";
import { runBoundedProcess } from "@aihot/backend/content/bounded-process";
import { parsePdfText } from "@aihot/backend/content/pdf-text";

function pdfFixture(inputRows: string[] | string[][], pageCount = 1): Buffer {
  const pageIds = Array.from({ length: pageCount }, (_, i) => i + 3);
  const contentIds = Array.from({ length: pageCount }, (_, i) => pageCount + 3 + i);
  const fontId = contentIds[contentIds.length - 1]! + 1;
  const pageRows = Array.isArray(inputRows[0]) ? inputRows as string[][] : pageIds.map(() => inputRows as string[]);
  const objects = new Map<number, Buffer>();
  objects.set(1, Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "ascii"));
  objects.set(2, Buffer.from(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`, "ascii"));
  for (let i = 0; i < pageIds.length; i++) {
    const id = pageIds[i]!;
    objects.set(id, Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`, "ascii"));
    const rows = pageRows[i] ?? [];
    const stream = ["BT", "/F1 12 Tf", "50 760 Td", ...rows.flatMap((row, rowNo) => [
      rowNo === 0 ? `(${row.replace(/[\\()]/g, "\\$&")}) Tj` : `0 -18 Td (${row.replace(/[\\()]/g, "\\$&")}) Tj`,
    ]), "ET"].join("\n");
    const streamBytes = Buffer.from(stream, "ascii");
    objects.set(contentIds[i]!, Buffer.concat([Buffer.from(`<< /Length ${streamBytes.length} >>\nstream\n`, "ascii"), streamBytes, Buffer.from("\nendstream", "ascii")]));
  }
  objects.set(fontId, Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "ascii"));
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "ascii")];
  const offsets = new Array(fontId + 1).fill(0);
  let position = chunks[0]!.length;
  for (let id = 1; id <= fontId; id++) {
    const object = objects.get(id)!;
    offsets[id] = position;
    const chunk = Buffer.concat([Buffer.from(`${id} 0 obj\n`, "ascii"), object, Buffer.from("\nendobj\n", "ascii")]);
    chunks.push(chunk);
    position += chunk.length;
  }
  const xrefOffset = position;
  const xref = [`xref\n0 ${fontId + 1}\n`, "0000000000 65535 f \n", ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)].join("");
  chunks.push(Buffer.from(`${xref}trailer\n<< /Size ${fontId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`, "ascii"));
  return Buffer.concat(chunks);
}

test("offline PDF text parser extracts all page text and exposes page count", async () => {
  const got = await parsePdfText(pdfFixture(["REGION | TIER | VALUE", "EAST | T3 | FUJIAN", "CITY | T2 | XIAMEN"]));
  assert.equal(got.ok, true);
  if (!got.ok) return;
  assert.equal(got.pageCount, 1);
  assert.match(got.text, /REGION \| TIER \| VALUE/);
  assert.match(got.text, /EAST \| T3 \| FUJIAN/);
  assert.match(got.text, /CITY \| T2 \| XIAMEN/);
});

test("offline PDF parser fails closed on empty, malformed and oversized inputs", async () => {
  assert.deepEqual(await parsePdfText(Buffer.from("not a pdf")), { ok: false, reason: "invalid_pdf" });
  assert.deepEqual(await parsePdfText(Buffer.from("%PDF-1.7\nnot a valid document")), { ok: false, reason: "pdf_parse_failed" });
  const empty = await parsePdfText(pdfFixture([]));
  assert.deepEqual(empty, { ok: false, reason: "pdf_page_no_text" });
  assert.deepEqual(await parsePdfText(Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(6 * 1024 * 1024)])), { ok: false, reason: "pdf_too_large" });
});

test("offline PDF parser refuses encrypted documents", async () => {
  const encryptedFixture = Buffer.from("JVBERi0xLjMKJeLjz9MKMSAwIG9iago8PAovUHJvZHVjZXIgPDc0ZjNkMmM4YjQ+Cj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovQ291bnQgMQovS2lkcyBbIDQgMCBSIF0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9SZXNvdXJjZXMgPDwKPj4KL01lZGlhQm94IFsgMC4wIDAuMCA3MiA3MiBdCi9QYXJlbnQgMiAwIFIKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL1YgMgovUiAzCi9MZW5ndGggMTI4Ci9QIDQyOTQ5NjcyOTIKL0ZpbHRlciAvU3RhbmRhcmQKL08gPDBiYTM4MzVmODhmOTAzODhlNzRlNTQ1ODQxMjVjZTE0MmJlMGRlMjRjNmIwZDM3NzQ2ZTA3NWI4OTE3NTY2NzE+Ci9VIDxmMzU2YzUzZTkwOGVjN2JkN2Q2NGE2MTNkM2U4OTM5NTI4YmY0ZTVlNGU3NThhNDE2NDAwNGU1NmZmZmEwMTA4Pgo+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAwNTkgMDAwMDAgbiAKMDAwMDAwMDExOCAwMDAwMCBuIAowMDAwMDAwMTY3IDAwMDAwIG4gCjAwMDAwMDAyNTkgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA2Ci9Sb290IDMgMCBSCi9JbmZvIDEgMCBSCi9JRCBbIDw2NDY2NjM2MTY2MzUzNDMyMzczOTMwMzMzMjMwMzY2NDY0MzEzMTM0MzQzMTY0MzA2MjM1NjI2MTM5MzYzMTYyPiA8NjQ2NjYzNjE2NjM1MzQzMjM3MzkzMDMzMzIzMDM2NjQ2NDMxMzEzNDM0MzE2NDMwNjIzNTYyNjEzOTM2MzE2Mj4gXQovRW5jcnlwdCA1IDAgUgo+PgpzdGFydHhyZWYKNDc0CiUlRU9GCg==", "base64");
  assert.deepEqual(await parsePdfText(encryptedFixture), { ok: false, reason: "pdf_encrypted" });
});

test("offline PDF parser enforces the page cap and serializes independent processes", async () => {
  const tooManyPages = await parsePdfText(pdfFixture(["PAGE"], 41));
  assert.deepEqual(tooManyPages, { ok: false, reason: "pdf_page_limit" });
  const results = await Promise.all(["A", "B", "C"].map((row) => parsePdfText(pdfFixture([row]))));
  assert.deepEqual(results.map((item) => item.ok), [true, true, true]);
});

test("a textless page prevents a mixed scanned/text PDF from being accepted", async () => {
  assert.deepEqual(await parsePdfText(pdfFixture([["text page"], []], 2)), { ok: false, reason: "pdf_page_no_text" });
});

test("offline PDF parser rejects output beyond the text ceiling", async () => {
  assert.deepEqual(await parsePdfText(pdfFixture(Array.from({ length: 1300 }, () => "x".repeat(100)), 32)), { ok: false, reason: "pdf_text_limit" });
});

test("bounded child timeout waits for termination and output overflow kills the child", async () => {
  const hung = await runBoundedProcess(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { input: Buffer.alloc(0), timeoutMs: 50, maxOutputBytes: 64 });
  assert.equal(hung.timedOut, true);
  assert.equal(hung.spawnFailed, false);
  const overflow = await runBoundedProcess(process.execPath, ["-e", "process.stdout.write('x'.repeat(4096))"], { input: Buffer.alloc(0), timeoutMs: 2000, maxOutputBytes: 64 });
  assert.equal(overflow.outputExceeded, true);
  const subsequent = await parsePdfText(pdfFixture(["AFTER TERMINATION"]));
  assert.equal(subsequent.ok, true, "a killed child releases its slot after close and a new parser process succeeds");
});
