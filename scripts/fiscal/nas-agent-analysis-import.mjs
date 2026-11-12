#!/usr/bin/env node
/** Import agent-authored relevance/summary judgements through the canonical projector.
 *  Input: /tmp/wb-judged.json = [{id,relevance,title_zh,summary_zh,category,score,selected,reason,tags}]
 */
import fs from "node:fs";
import { sql, closeDb } from "@aihot/backend/db";
import { publishArticle } from "@aihot/backend/publication/publish";

const rows = JSON.parse(fs.readFileSync("/tmp/wb-judged.json", "utf8"));
const dry = process.argv.includes("--dry");
const out = [];

for (const r of rows) {
  const [a] = await sql`
    SELECT id, revision, processing_state FROM articles WHERE id = ${r.id}`;
  if (!a) { out.push({ id: r.id, skip: "not_found" }); continue; }

  const [existing] = await sql`
    SELECT id FROM analyses WHERE article_id = ${r.id} AND input_revision = ${a.revision}`;
  if (existing) { out.push({ id: r.id, skip: "already_analyzed" }); continue; }

  if (dry) { out.push({ id: r.id, dry: true, relevance: r.relevance, selected: !!r.selected }); continue; }

  // Articles whose body was written by hand bypass extract.ts, which normally clears the pending
  // attachment marker on success. A stale marker makes publish.ts treat the row as held and silently
  // ignores an automatic selection, so drop it whenever the body is actually ready.
  const [ready] = await sql`
    SELECT body_status, length(coalesce(body_text, '')) AS n FROM articles WHERE id = ${r.id}`;
  if (ready?.body_status === "ok" && ready.n > 0) {
    await sql`UPDATE articles SET raw = raw - 'attachmentDiagnostic' WHERE id = ${r.id}
      AND raw ? 'attachmentDiagnostic'`;
    await sql`UPDATE articles SET raw = raw - '_aihotBodyExtraction' WHERE id = ${r.id}
      AND raw->'_aihotBodyExtraction'->>'state' = 'pending_parse'`;
  }

  await sql`
    INSERT INTO analyses (article_id, input_revision, origin, model, prompt_version, receipt_ids,
      relevance, category, tags, subjects, title_zh, summary_zh, reason_zh, score, selected, output)
    VALUES (${r.id}, ${a.revision}, 'model', 'workbuddy-agent', 'workbuddy-judge-v1', ${[]}::bigint[],
      ${r.relevance}, ${r.category ?? null}, ${(r.tags ?? [])}::text[], ${(r.subjects ?? [])}::text[],
      ${r.title_zh ?? null}, ${r.summary_zh ?? null}, ${r.reason ?? null},
      ${typeof r.score === "number" ? r.score : null}, ${!!r.selected}, ${sql.json({ by: "workbuddy-agent" })})
    ON CONFLICT DO NOTHING`;
  await sql`UPDATE articles SET processing_state = ${r.relevance === "block" ? "blocked" : "analyzed"},
    processing_error = NULL WHERE id = ${r.id}`;
  const published = await publishArticle(r.id);
  out.push({ id: r.id, relevance: r.relevance, selected: !!r.selected, published: published ? published.eligible : null });
}

const ok = out.filter((x) => !x.skip).length;
console.log(JSON.stringify({ dry, total: rows.length, applied: ok, sample: out.slice(0, 3) }));
await closeDb().catch(() => {});
process.exit(0);
