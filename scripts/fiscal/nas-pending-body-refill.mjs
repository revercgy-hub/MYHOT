#!/usr/bin/env node
/**
 * Refill bodies for articles that were stored as `pending`.
 *
 * The collector fetches only a bounded number of detail pages per source per window, so anything
 * beyond that limit keeps body_status='pending' forever and never reaches the analyser, which only
 * looks at rows with a usable body. Running this before analysis drains that queue.
 *
 * Usage: node nas-pending-body-refill.mjs [--limit=120]
 */
import { sql, closeDb } from "@aihot/backend/db";
import { extractArticleBody } from "@aihot/backend/content/extract";

const limit = Number((process.argv.find((a) => a.startsWith("--limit=")) || "--limit=120").split("=")[1]);
const rows = await sql`
  SELECT id, source_id, title FROM articles
  WHERE body_status = 'pending' AND processing_state IN ('new', 'analyzed')
  ORDER BY discovered_at DESC
  LIMIT ${limit}`;
console.log(JSON.stringify({ targets: rows.length, limit }));

let ok = 0, unconfirmed = 0, failed = 0;
const bySource = {};
for (const [i, r] of rows.entries()) {
  let outcome = "failed";
  try {
    const res = await extractArticleBody(r.id, false);
    if (res === "ok") outcome = "ok";
    else if (res === "unconfirmed") outcome = "unconfirmed";
  } catch { outcome = "failed"; }
  if (outcome === "ok") ok += 1;
  else if (outcome === "unconfirmed") unconfirmed += 1;
  else failed += 1;
  bySource[r.source_id] ??= { ok: 0, unconfirmed: 0, failed: 0 };
  bySource[r.source_id][outcome] += 1;
  if ((i + 1) % 40 === 0) console.log(JSON.stringify({ progress: i + 1, ok, unconfirmed, failed }));
}

// Anything still pending after the attempt is reported so the morning check can show the residue.
const [left] = await sql`SELECT count(*)::int AS n FROM articles WHERE body_status = 'pending'`;
console.log(JSON.stringify({
  finished: true, total: rows.length, ok, unconfirmed, failed,
  stillPendingInDb: left?.n ?? null,
  worstSources: Object.entries(bySource)
    .sort((a, b) => b[1].failed + b[1].unconfirmed - (a[1].failed + a[1].unconfirmed))
    .slice(0, 5)
    .map(([id, v]) => `${id}: ok${v.ok}/unc${v.unconfirmed}/fail${v.failed}`),
}));
await closeDb().catch(() => {});
process.exit(0);
