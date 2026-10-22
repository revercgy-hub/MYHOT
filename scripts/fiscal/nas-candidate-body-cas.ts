#!/usr/bin/env node
/** Apply offline-verified candidate bodies using an exact native-row CAS. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const appModule = (relative: string) => pathToFileURL(path.resolve(process.env.AIHOT_APP_ROOT ?? ROOT, relative)).href;
const APPROVED_PLAN_SHA256 = "6a5ba8c1213a0de3a278b8368288a58588a755ae3d75257caedca9aa345492a0";
const APPROVED_ROWSET_SHA256 = "f56a4a3f7d9037cb5bb41761524f69e2a67fc01902296dedfec3b2bf2250cd7f";
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
let collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();
const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${stableJson(row[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};
const contentHash = (title: string, bodyText: string, excerpt: string | null) =>
  sha256([collapseWhitespace(title), collapseWhitespace(bodyText), collapseWhitespace(excerpt ?? "")].join("\u0001"));
function sameNativeRows<T>(actual: T[], expected: T[], key: (row: T) => string): boolean {
  if (actual.length !== expected.length) return false;
  const expectedByKey = new Map(expected.map((row) => [key(row), row]));
  if (expectedByKey.size !== expected.length) return false;
  return actual.every((row) => {
    const wanted = expectedByKey.get(key(row));
    return wanted !== undefined && JSON.stringify(row) === JSON.stringify(wanted);
  });
}

export interface CandidateBodyCasRow {
  articleId: string;
  expectedRowText: string;
  expectedRowSha256: string;
  expectedRevision: number;
  expectedContentHash: string | null;
  expectedTitle: string;
  expectedExcerpt: string | null;
  expectedSourceId: string;
  bodyText: string;
  bodyHtml: string;
  bodyTextSha256: string;
  bodyHtmlSha256: string;
  nextContentHash: string;
}

/** The followup article set is an audit subset of newArticles, not an additive set. */
export function collectFullArticleBaseline(rowset: any): Map<string, string> {
  const baselineRows = new Map<string, string>();
  for (const setName of ["newArticles", "pbocArticles"]) {
    const rows = rowset.rowsets?.[setName]?.rows;
    if (!Array.isArray(rows)) throw new Error(`body CAS rowset is missing ${setName}`);
    for (const entry of rows) {
      if (typeof entry?.id !== "string" || typeof entry?.row !== "string") throw new Error(`body CAS rowset has an invalid ${setName} entry`);
      const previous = baselineRows.get(entry.id);
      if (previous !== undefined && previous !== entry.row) throw new Error(`conflicting native baseline rows for ${entry.id}`);
      baselineRows.set(entry.id, entry.row);
    }
  }
  const followupRows = rowset.rowsets?.followupArticles?.rows;
  if (!Array.isArray(followupRows)) throw new Error("body CAS rowset is missing followupArticles subset");
  for (const entry of followupRows) {
    if (typeof entry?.id !== "string" || typeof entry?.row !== "string" || baselineRows.get(entry.id) !== entry.row) {
      throw new Error(`followup row is not an exact subset of the 418 native articles: ${String(entry?.id)}`);
    }
  }
  if (baselineRows.size !== 418) throw new Error("body CAS must bind the complete 418-row native article baseline");
  return baselineRows;
}

/** Exact per-article row CAS plus revision insert. Caller owns one encompassing SQL transaction. */
export async function applyCandidateBodyCas(tx: any, proposals: CandidateBodyCasRow[]): Promise<Array<{ articleId: string; revision: number; contentHash: string }>> {
  if (!Array.isArray(proposals) || !proposals.length || proposals.length > 150) throw new Error("body CAS requires 1–150 frozen proposals");
  const ids = proposals.map((row) => row.articleId);
  if (new Set(ids).size !== ids.length || proposals.some((row) => !/^[A-Za-z0-9_-]{1,80}$/u.test(row.articleId))) {
    throw new Error("body CAS article IDs must be unique safe identifiers");
  }
  for (const row of proposals) {
    if (sha256(row.expectedRowText) !== row.expectedRowSha256 || !row.expectedRowText ||
        row.expectedRevision < 1 || row.expectedContentHash === null ||
        !row.expectedTitle || !row.expectedSourceId ||
        sha256(row.bodyText) !== row.bodyTextSha256 || sha256(row.bodyHtml) !== row.bodyHtmlSha256 ||
        contentHash(row.expectedTitle, row.bodyText, row.expectedExcerpt) !== row.nextContentHash ||
        row.bodyText.trim().length < 40 || !row.bodyHtml.trim()) {
      throw new Error(`invalid frozen body CAS evidence for ${row.articleId}`);
    }
  }
  const locked: Array<{ id: string; row_text: string; source_id: string; revision: number; content_hash: string | null;
    title: string; excerpt: string | null;
    body_status: string; body_text: string | null; body_html: string | null }> = await tx`
      SELECT a.id, to_jsonb(a)::text AS row_text, a.source_id, a.revision, a.content_hash,
        a.title, a.excerpt,
        a.body_status, a.body_text, a.body_html
      FROM articles a WHERE a.id = ANY(${tx.array(ids, 1009)}) ORDER BY a.id FOR UPDATE`;
  if (locked.length !== proposals.length) throw new Error("body CAS target row count changed");
  const byId = new Map(locked.map((row) => [row.id, row]));
  const inserted: Array<{ articleId: string; revision: number; contentHash: string }> = [];
  for (const proposal of proposals) {
    const row = byId.get(proposal.articleId);
    if (!row || row.row_text !== proposal.expectedRowText || sha256(row.row_text) !== proposal.expectedRowSha256 ||
        row.revision !== proposal.expectedRevision || row.content_hash !== proposal.expectedContentHash ||
        row.title !== proposal.expectedTitle || row.excerpt !== proposal.expectedExcerpt ||
        row.source_id !== proposal.expectedSourceId || row.body_status !== "pending" ||
        row.body_text !== null || row.body_html !== null) {
      throw new Error(`body CAS baseline changed for ${proposal.articleId}`);
    }
    const [updated] = await tx<{ revision: number }[]>`
      UPDATE articles SET body_text = ${proposal.bodyText}, body_html = ${proposal.bodyHtml}, body_status = 'ok',
        revision = revision + 1, content_hash = ${proposal.nextContentHash}, updated_at = clock_timestamp()
      WHERE id = ${proposal.articleId} AND revision = ${proposal.expectedRevision}
        AND content_hash = ${proposal.expectedContentHash}
        AND body_status = 'pending' AND body_text IS NULL AND body_html IS NULL
        AND to_jsonb(articles)::text = ${proposal.expectedRowText}
      RETURNING revision`;
    if (!updated || updated.revision !== proposal.expectedRevision + 1) throw new Error(`body CAS update failed for ${proposal.articleId}`);
    await tx`INSERT INTO article_revisions (article_id, revision, content_hash, title, body_text)
      VALUES (${proposal.articleId}, ${updated.revision}, ${proposal.nextContentHash}, ${proposal.expectedTitle}, ${proposal.bodyText})`;
    inserted.push({ articleId: proposal.articleId, revision: updated.revision, contentHash: proposal.nextContentHash });
  }
  return inserted;
}

function asCasRows(plan: any, rowset: any): CandidateBodyCasRow[] {
  if (plan.schemaVersion !== "nas-candidate-offline-detail-replay.v1" || plan.networkDispatches !== 0 || plan.databaseWrites !== 0 ||
      plan.originalRunId !== "nas-candidate-remaining46-20261022" || plan.casPlan?.mode !== "proposal_only_not_executed" ||
      plan.casPlan?.articles?.length !== 27 || rowset.database !== "fiscalhot_staging" || rowset.counts?.articles !== 418 ||
      rowset.sources?.count !== 48 || rowset.sources?.flags?.enabled !== 0 || rowset.review?.count !== 150) {
    throw new Error("body CAS input is outside the frozen 27-row post-46-source scope");
  }
  const baselineRows = collectFullArticleBaseline(rowset);
  const parsedOutputs = new Map((plan.outputs ?? []).map((row: any) => [String(row.articleId), row]));
  return plan.casPlan.articles.map((item: any) => {
    const nativeRow = baselineRows.get(item.articleId);
    const output = parsedOutputs.get(item.articleId) as any;
    if (!nativeRow || !output || output.bodyStatus !== "ok" || item.expected?.bodyStatus !== "pending" ||
        item.expected?.bodyText !== null || item.expected?.bodyHtml !== null ||
        sha256(nativeRow) !== item.rollbackBaselineRowSha256 || sha256(String(output.bodyText)) !== item.writeProposal.bodyTextSha256 ||
        sha256(String(output.bodyHtml)) !== item.writeProposal.bodyHtmlSha256) {
      throw new Error(`body CAS input does not bind to a verified native article row: ${item.articleId}`);
    }
    const article = JSON.parse(nativeRow);
    // The complete native to_jsonb row text, including microseconds, is the CAS. Never parse PG timestamps through JS Date.
    return { articleId: item.articleId, expectedRowText: nativeRow, expectedRowSha256: item.rollbackBaselineRowSha256,
      expectedRevision: item.expected.revision, expectedContentHash: item.expected.contentHash,
      expectedTitle: item.expected.title, expectedExcerpt: item.expected.excerpt, expectedSourceId: item.sourceId,
      bodyText: output.bodyText, bodyHtml: output.bodyHtml, bodyTextSha256: item.writeProposal.bodyTextSha256,
      bodyHtmlSha256: item.writeProposal.bodyHtmlSha256, nextContentHash: item.writeProposal.contentHash };
  });
}

export async function applyFrozenBodyCas(sql: any, plan: any, rowset: any, execute = true): Promise<Array<{ articleId: string; revision: number; contentHash: string }>> {
  const proposals = asCasRows(plan, rowset);
  return sql.begin(async (tx: any) => {
    await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;
    const identity = (await tx`SELECT current_database() AS database, inet_server_addr()::text AS address`)[0];
    if (identity?.database !== "fiscalhot_staging") throw new Error("body CAS only permits the exact NAS staging database");
    const sourceRows = await tx`SELECT to_jsonb(s)::text AS row FROM sources s ORDER BY id FOR SHARE`;
    const hashRows = (rows: Array<{ row: string }>) => sha256(rows.map((row) => row.row).join("\n") + (rows.length ? "\n" : ""));
    if (sourceRows.length !== 48 || hashRows(sourceRows) !== rowset.sources.rowsSha256) throw new Error("source rowset changed before body CAS");
    const flags = (await tx`SELECT count(*)::int AS total, count(*) FILTER (WHERE enabled)::int AS enabled,
      count(*) FILTER (WHERE site_fulltext)::int AS site_fulltext, count(*) FILTER (WHERE syndicate_fulltext)::int AS syndicate FROM sources`)[0];
    if (Number(flags?.total) !== 48 || Number(flags?.enabled) !== 0 || Number(flags?.site_fulltext) !== 0 || Number(flags?.syndicate) !== 0) {
      throw new Error("source safety flags changed before body CAS");
    }
    const reviewRows = await tx`SELECT to_jsonb(c)::text AS row FROM gold_review_cases c WHERE batch_hash = 'ef0a79d3cd791efad169ab4904e6666fb34cf1515fe3a6f0a3456a125042c889' ORDER BY case_id FOR SHARE`;
    if (reviewRows.length !== rowset.review.count || hashRows(reviewRows) !== rowset.review.rowsSha256) throw new Error("protected review rows changed before body CAS");
    const articleRows = await tx`SELECT a.id, to_jsonb(a)::text AS row FROM articles a ORDER BY a.id FOR SHARE`;
    const baselineArticles = ["newArticles", "pbocArticles"].flatMap((name) => rowset.rowsets[name].rows).map((row: any) => ({ id: row.id, row: row.row }));
    if (articleRows.length !== 418 || !sameNativeRows(articleRows, baselineArticles, (row: any) => row.id)) throw new Error("complete article rowset changed before body CAS");
    const revisionRows = await tx`SELECT article_id, revision, to_jsonb(r)::text AS row FROM article_revisions r ORDER BY article_id, revision FOR SHARE`;
    const baselineRevisions = ["newRevisions", "pbocRevisions"].flatMap((name) => rowset.rowsets[name].rows)
      .map((row: any) => ({ article_id: row.article_id, revision: row.revision, row: row.row }));
    if (revisionRows.length !== 418 || !sameNativeRows(revisionRows, baselineRevisions, (row: any) => `${row.article_id}\u0000${row.revision}`)) throw new Error("complete revision rowset changed before body CAS");
    const discoveryRows = await tx`SELECT article_id, source_id, via, to_jsonb(d)::text AS row FROM article_discoveries d ORDER BY article_id, source_id, via FOR SHARE`;
    const baselineDiscoveries = ["newDiscoveries", "pbocDiscoveries"].flatMap((name) => rowset.rowsets[name].rows)
      .map((row: any) => ({ article_id: row.article_id, source_id: row.source_id, via: row.via, row: row.row }));
    if (discoveryRows.length !== 418 || !sameNativeRows(discoveryRows, baselineDiscoveries, (row: any) => `${row.article_id}\u0000${row.source_id}\u0000${row.via}`)) throw new Error("complete discovery rowset changed before body CAS");
    for (const table of ["publications", "analyses", "receipts", "receipt_attempts", "job_runs", "fetch_runs"]) {
      const count = (await tx.unsafe(`SELECT count(*)::int AS count FROM ${table}`))[0]?.count;
      if (count !== 0) throw new Error(`${table} is not empty before body CAS`);
    }
    const pgboss = (await tx`SELECT to_regclass('pgboss.job') IS NOT NULL AS present`)[0]?.present;
    if (pgboss && Number((await tx`SELECT count(*)::int AS count FROM pgboss.job`)[0]?.count) !== 0) throw new Error("pgboss.job is not empty before body CAS");
    if (!execute) return [];
    return applyCandidateBodyCas(tx, proposals);
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const get = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
  const execute = args.includes("--execute");
  const preflightOnly = args.includes("--preflight-only");
  if (execute === preflightOnly || !get("--plan") || !get("--rowset") || get("--expected-database") !== "fiscalhot_staging") {
    throw new Error("usage: node scripts/fiscal/nas-candidate-body-cas.ts (--preflight-only|--execute) --plan <approved-cas-plan.json> --rowset <fresh-native-rowset.json> --expected-database fiscalhot_staging");
  }
  const dbUrlString = process.env.DATABASE_URL;
  if (!dbUrlString) throw new Error("DATABASE_URL is required; no default target is allowed");
  const dbUrl = new URL(dbUrlString);
  if (decodeURIComponent(dbUrl.pathname.slice(1)) !== "fiscalhot_staging" || dbUrl.hostname !== "db") throw new Error("DATABASE_URL must target the exact compose staging database");
  const planPath = path.resolve(get("--plan")!);
  const rowsetPath = path.resolve(get("--rowset")!);
  if (sha256(readFileSync(planPath)) !== APPROVED_PLAN_SHA256 || sha256(readFileSync(rowsetPath)) !== APPROVED_ROWSET_SHA256) {
    throw new Error("body CAS files differ from the independently frozen plan and fresh 418-row postcheck");
  }
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  const rowset = JSON.parse(readFileSync(rowsetPath, "utf8"));
  const textModule = await import(appModule("packages/backend/src/lib/text.ts"));
  collapseWhitespace = textModule.collapseWhitespace;
  const { sql, closeDb } = await import(appModule("packages/backend/src/db.ts"));
  try {
    const writes = await applyFrozenBodyCas(sql, plan, rowset, execute);
    const report = { schemaVersion: "nas-candidate-body-cas-result.v1", result: execute ? "COMMITTED" : "PREFLIGHT_PASS_NO_WRITES",
      database: "fiscalhot_staging", createdAt: new Date().toISOString(),
      planSha256: sha256(readFileSync(planPath)), rowsetSha256: sha256(readFileSync(rowsetPath)), writes: writes.length,
      revisionIds: writes.map((row) => ({ articleId: row.articleId, revision: row.revision })) };
    const out = get("--out");
    if (out) writeFileSync(path.resolve(out), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify(report, null, 2));
  } finally { await closeDb(); }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
