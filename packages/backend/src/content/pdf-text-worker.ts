// One document per process. The parent owns byte, page-count, output-size and wall-clock limits.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const MAX_INPUT_BYTES = 6 * 1024 * 1024;
const MAX_PAGES = 40;
const MAX_TEXT_CHARS = 120_000;

interface PositionedSpan { x: number; text: string }
interface PositionedLine { y: number; spans: PositionedSpan[] }

function reply(value: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const part of process.stdin) {
    const chunk = Buffer.from(part as Uint8Array);
    size += chunk.length;
    if (size > MAX_INPUT_BYTES) {
      reply({ ok: false, reason: "pdf_too_large" });
      process.exitCode = 0;
      return;
    }
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks, size);
  if (bytes.length < 5 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
    reply({ ok: false, reason: "invalid_pdf" });
    return;
  }

  let dispose: (() => Promise<void>) | undefined;
  let encrypted = false;
  try {
    const task = getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: false,
      disableFontFace: true,
      useWorkerFetch: false,
      disableAutoFetch: true,
      disableStream: true,
      verbosity: 0,
      isEvalSupported: false,
    } as Parameters<typeof getDocument>[0]);
    task.onPassword = () => { encrypted = true; void task.destroy(); };
    dispose = () => task.destroy();
    const pdf = await task.promise;
    if (pdf.numPages < 1 || pdf.numPages > MAX_PAGES) {
      await task.destroy();
      reply({ ok: false, reason: "pdf_page_limit" });
      return;
    }
    const pages: Array<{ text: string; lines: PositionedLine[] }> = [];
    let total = 0;
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      const lines: PositionedLine[] = [];
      for (const item of content.items) {
        if (!item || !("str" in item)) continue;
        const text = item.str.trim();
        if (!text) continue;
        const x = item.transform[4];
        const y = item.transform[5];
        let line = lines.find((candidate) => Math.abs(candidate.y - y) < 1.5);
        if (!line) lines.push((line = { y, spans: [] }));
        line.spans.push({ x, text });
      }
      lines.sort((a, b) => b.y - a.y);
      for (const line of lines) line.spans.sort((a, b) => a.x - b.x);
      const lineText = lines.map((line) => line.spans.map((span) => span.text).join("   ")).join("\n");
      if (!lineText.replace(/\s/g, "")) {
        await task.destroy();
        reply({ ok: false, reason: "pdf_page_no_text" });
        return;
      }
      pages.push({ text: lineText, lines });
      total += lineText.length + (pages.length > 1 ? 2 : 0);
      page.cleanup();
      if (total > MAX_TEXT_CHARS) {
        await task.destroy();
        reply({ ok: false, reason: "pdf_text_limit" });
        return;
      }
    }
    await task.destroy();
    const text = pages.map((page) => page.text).join("\n\n").trim();
    if (!text) {
      reply({ ok: false, reason: "pdf_no_text" });
      return;
    }
    const response = JSON.stringify({ ok: true, pageCount: pdf.numPages, text, layout: pages.map((page, index) => ({ page: index + 1, lines: page.lines })) });
    if (Buffer.byteLength(response, "utf8") > 900 * 1024) {
      reply({ ok: false, reason: "pdf_output_limit" });
      return;
    }
    process.stdout.write(`${response}\n`);
  } catch (error) {
    try { await dispose?.(); } catch { /* process exits */ }
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    reply({ ok: false, reason: encrypted || /password|encrypt/.test(message) ? "pdf_encrypted" : "pdf_parse_failed" });
  }
}

void main().catch(() => {
  reply({ ok: false, reason: "pdf_parse_failed" });
  process.exitCode = 1;
});
