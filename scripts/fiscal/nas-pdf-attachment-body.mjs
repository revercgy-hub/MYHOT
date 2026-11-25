#!/usr/bin/env node
/**
 * Recover body text for announcements whose article body is just a title plus an attachment.
 *
 * The extractor keeps only visible text, so an "相关附件：foo.pdf" line loses the href. This pass
 * re-fetches the original page, finds the attachment link, downloads the PDF and appends whatever
 * text layer it has. Scanned PDFs without a text layer stay as they are.
 *
 * Usage: node nas-pdf-attachment-body.mjs [--limit=30] [--dry]
 */
import * as cheerio from "cheerio";
import { sql, closeDb } from "@aihot/backend/db";
import { contentHash } from "@aihot/backend/content/materials";
import { parsePdfText } from "@aihot/backend/content/pdf-text";

const args = process.argv.slice(2);
const limit = Number((args.find((a) => a.startsWith("--limit=")) || "--limit=30").split("=")[1]);
const dry = args.includes("--dry");
const MAX_PDF = 8 * 1024 * 1024;
const MIN_TEXT = 120;

const rows = await sql`
  SELECT id, url, title, excerpt, revision, body_text, body_status
  FROM articles
  WHERE body_status = 'ok'
    AND length(coalesce(body_text,'')) < 400
    AND coalesce(body_text,'') ~ '附件'
  ORDER BY discovered_at DESC
  LIMIT ${limit}`;
console.log(JSON.stringify({ targets: rows.length, dry }));

const results = [];
for (const r of rows) {
  const note = { id: r.id, title: r.title.slice(0, 24) };
  try {
    const page = await fetch(r.url, {
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    });
    if (page.status !== 200) { results.push({ ...note, skip: `page_${page.status}` }); continue; }
    const $ = cheerio.load(await page.text());

    // Prefer PDF anchors; fall back to any anchor whose text mentions 附件 with a document suffix.
    const links = [];
    $("a[href]").each((_, a) => {
      const href = $(a).attr("href") || "";
      const text = ($(a).text() || "").trim();
      if (!/\.pdf($|\?)/i.test(href)) return;
      let abs; try { abs = new URL(href, r.url).href; } catch { return; }
      links.push({ url: abs, text });
    });
    if (!links.length) { results.push({ ...note, skip: "no_pdf_link" }); continue; }

    let appended = 0, tried = 0;
    for (const link of links.slice(0, 2)) {
      tried += 1;
      try {
        const res = await fetch(link.url, {
          headers: { "user-agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(30000),
          redirect: "follow",
        });
        if (res.status !== 200) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > MAX_PDF || buf.subarray(0, 5).toString("ascii") !== "%PDF-") continue;
        const parsed = await parsePdfText(buf, MAX_PDF);
        if (!parsed.ok || !parsed.text || parsed.text.trim().length < MIN_TEXT) continue;
        appended += parsed.text.trim().length;
        note.pdfText = (note.pdfText || 0) + parsed.text.trim().length;
        if (dry) continue;
        const merged = `${r.body_text.trim()}\n\n【附件正文】${link.text || "附件"}\n${parsed.text.trim()}`;
        const next = contentHash({ title: r.title, bodyText: merged, excerpt: r.excerpt });
        const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const html = merged.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join("\n");
        const [u] = await sql`
          UPDATE articles SET body_text = ${merged}, body_html = ${html},
            revision = revision + 1, content_hash = ${next},
            processing_state = 'new', updated_at = clock_timestamp()
          WHERE id = ${r.id} AND revision = ${r.revision}
          RETURNING revision`;
        note.written = !!u;
      } catch { /* try the next link */ }
      if (appended >= MIN_TEXT) break;
    }
    note.triedPdfs = tried;
    note.appended = appended;
    if (!appended) note.skip = "pdf_no_text_layer";
    results.push(note);
  } catch (e) { results.push({ ...note, skip: `err_${(e.message || "").slice(0, 24)}` }); }
}

const ok = results.filter((x) => x.appended > 0).length;
console.log(JSON.stringify({ finished: true, total: results.length, recovered: ok, detail: results }, null, 1));
await closeDb().catch(() => {});
process.exit(0);
