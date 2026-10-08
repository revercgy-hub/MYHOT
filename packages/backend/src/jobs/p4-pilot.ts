import { createHash } from "node:crypto";
import { closeSync, lstatSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT, config } from "../config.ts";
import { sql } from "../db.ts";
import { analyzeArticle, PROMPT_VERSIONS } from "../editorial/analyze.ts";
import { MODELS } from "../providers/llm.ts";
import { tierThreshold } from "../editorial/analyze.ts";
import { SELECTION } from "@aihot/industry/selection";

const FIXED_IDS = ["p4prep_treasury_20261008", "p4prep_omo192_20261008"] as const;
const FIXED_SOURCES = ["mof-treasury-debt-data", "pboc-open-market"] as const;
const EXECUTOR_LOCK = "fiscal-p4-bounded-executor-v1";
const RUN_TIMEOUT_MS = 3 * 60 * 60 * 1000;
const CAPABILITIES = ["prefilter", "score", "structure", "understand", "summarize"] as const;
const envEnabled = (key: string) => ["1", "true"].includes(process.env[key]?.toLowerCase() ?? "");

export interface FrozenRecord { id: string; title: string; url: string; source: { id: string; kind: string; tier: string }; revision: number; contentHash: string; revisionContentHash: string; bodyStatus: string; accepted: boolean }
export interface FrozenManifest { schema: string; mode: string; ready: boolean; database: { name: string }; requestedArticleIds: string[]; records: FrozenRecord[]; promptVersions: Record<string, string>; manifestHash: string }
export interface P4ExecutionOptions {
  manifestPath: string;
  manifest: FrozenManifest;
  manifestHash: string;
  contractHash: string;
  sourceConfigHash: string;
  maxRequests: 10 | 20;
  confirmed: true;
  outputPath: string;
  startedBy: "explicit-cli";
}

export interface P4ExecutionRow { id: string; sourceId: string; revision: number; contentHash: string; result: "analyzed" | "blocked"; analysisId: number | null; receiptIds: number[]; selected: boolean | null; relevance: string | null }

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => nested && typeof nested === "object" && !Array.isArray(nested)
    ? Object.fromEntries(Object.entries(nested as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) : nested);
}
function hash(value: unknown): string { return createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex"); }
function ensureLocalTestDatabase(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  if (!(["postgres:", "postgresql:"].includes(parsed.protocol)) || !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname.toLowerCase())) throw new Error("P4 executor requires a loopback PostgreSQL endpoint");
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!/^[a-zA-Z0-9_-]+_test$/.test(name)) throw new Error("P4 executor requires a database ending in _test");
  return name;
}
export function validateFrozenP4Manifest(m: FrozenManifest, expectedHash: string, limit: number): FrozenRecord[] {
  const { manifestHash: _provided, ...body } = m;
  if (m.schema !== "fiscal-p4-pilot-readiness/v1" || m.mode !== "READ_ONLY_DRY_RUN" || !m.ready || hash(body) !== expectedHash || m.manifestHash !== expectedHash) throw new Error("frozen readiness manifest is invalid or changed");
  if (limit !== 10 && limit !== 20) throw new Error("--max-requests must explicitly be 10 or 20");
  if (!/^[a-zA-Z0-9_-]+_test$/.test(m.database?.name ?? "")) throw new Error("readiness manifest must identify its isolated *_test preparation database");
  if (JSON.stringify(m.requestedArticleIds) !== JSON.stringify(FIXED_IDS) || m.records.length !== FIXED_IDS.length) throw new Error("P4 executor only accepts the frozen two-article manifest");
  const rows = FIXED_IDS.map((id, index) => m.records[index]!);
  for (const [i, row] of rows.entries()) {
    if (row.id !== FIXED_IDS[i] || row.source.id !== FIXED_SOURCES[i] || row.source.kind !== "web_list" || row.source.tier !== "T1" || !row.accepted || row.bodyStatus !== "ok" || !/^[a-f\d]{64}$/i.test(row.contentHash) || row.revisionContentHash !== row.contentHash) throw new Error(`frozen manifest record ${i + 1} does not match the approved P4 pair`);
  }
  if (JSON.stringify(m.promptVersions) !== JSON.stringify(PROMPT_VERSIONS)) throw new Error("prompt versions changed since the readiness snapshot");
  return rows;
}

/** Fingerprint to show and explicitly re-supply before execution; includes source config and provider routing, never credential values. */
export async function readP4ExecutionContract(): Promise<{ databaseName: string; contractHash: string; sourceConfigHash: string; endpoint: string; model: string; promptVersions: typeof PROMPT_VERSIONS }> {
  const databaseName = ensureLocalTestDatabase(config.databaseUrl);
  const [db] = await sql<{ database_name: string }[]>`SELECT current_database() AS database_name`;
  if (db?.database_name !== databaseName) throw new Error("connected database name does not match DATABASE_URL");
  const sources = await sql<{ id: string; name: string; kind: string; tier: string; participation_mode: string; enabled: boolean; site_fulltext: boolean; syndicate_fulltext: boolean; config: unknown }[]>`
    SELECT id, name, kind, tier, participation_mode, enabled, site_fulltext, syndicate_fulltext, config FROM sources ORDER BY id`;
  const pilotSources = sources.filter((source) => FIXED_SOURCES.includes(source.id as typeof FIXED_SOURCES[number]));
  if (pilotSources.length !== FIXED_SOURCES.length || sources.some((s) => s.enabled || s.site_fulltext || s.syndicate_fulltext) || pilotSources.some((s) => s.participation_mode !== "editorial")) throw new Error("P4 source configuration is missing or unsafe; all sources must remain disabled and full text off");
  const sourceConfigHash = hash(sources);
  const modelSettings = await sql<{ key: string; model: string | null }[]>`SELECT key, value->>'model' AS model FROM settings WHERE key = ANY(${CAPABILITIES.map((cap) => `models.${cap}`)}) ORDER BY key`;
  if (modelSettings.some((row) => row.model !== null && row.model !== "deepseek-flash")) throw new Error("an admin capability override conflicts with the explicitly selected DeepSeek Flash model");
  const spec = MODELS["deepseek-flash"]!;
  const endpoint = process.env[spec.baseUrlEnv];
  if (!endpoint) throw new Error(`P4 executor requires ${spec.baseUrlEnv}; no provider fallback is allowed`);
  const endpointUrl = new URL(endpoint);
  if (endpointUrl.username || endpointUrl.password) throw new Error("provider endpoint must not embed credentials");
  if (endpointUrl.protocol !== "https:" || endpointUrl.hostname !== "api.deepseek.com" || endpointUrl.port || !["", "/"].includes(endpointUrl.pathname) || endpointUrl.search || endpointUrl.hash) throw new Error("P4 executor only permits the official DeepSeek API root endpoint");
  const providerEndpoint = "https://api.deepseek.com";
  const modelContract = { key: spec.key, service: spec.service, model: spec.model, endpoint: providerEndpoint, extra: spec.extra ?? null };
  const contractHash = hash({ databaseName, sourceConfigHash, modelSettings, modelContract, prompts: PROMPT_VERSIONS, thresholds: SELECTION.thresholds });
  return { databaseName, contractHash, sourceConfigHash, endpoint: providerEndpoint, model: spec.model, promptVersions: PROMPT_VERSIONS };
}

async function assertRuntimeIdle(ids: string[], lockPid: number) {
  const [connections] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM pg_stat_activity
    WHERE datname = current_database() AND pid <> pg_backend_pid() AND pid <> ${lockPid}`;
  if (connections!.count) throw new Error("P4 executor requires exclusive database access; another process is connected");
  const jobsTable = await sql<{ exists: boolean }[]>`SELECT to_regclass('pgboss.job') IS NOT NULL AS exists`;
  if (jobsTable[0]?.exists) {
    const [active] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM pgboss.job WHERE state IN ('created','retry','active')`;
    if (active!.count) throw new Error("P4 executor refuses a database with queued or active jobs");
  }
  const [runs] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM job_runs WHERE status = 'running'`;
  if (runs!.count) throw new Error("P4 executor refuses a database with a running scheduled job");
  const [heartbeat] = await sql<{ updated_at: Date }[]>`SELECT updated_at FROM settings WHERE key = 'heartbeat.worker'`;
  if (heartbeat?.updated_at && Date.now() - heartbeat.updated_at.getTime() < 180_000) throw new Error("P4 executor refuses a live worker heartbeat");
  const [busy] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM fetch_runs WHERE status = 'running'`;
  if (busy!.count) throw new Error("P4 executor refuses an active collector run");
  const [states] = await sql<{ bad: number }[]>`SELECT count(*)::int AS bad FROM articles WHERE id = ANY(${ids}) AND (processing_state IN ('failed') OR processing_attempts > 0 OR processing_retry_at IS NOT NULL OR processing_queued_at IS NOT NULL)`;
  if (states!.bad) throw new Error("P4 executor refuses retry/failed/queued articles");
}

function reportFile(pathValue: string): string {
  const base = path.resolve(REPO_ROOT, ".data/fiscal-p4-pilot");
  const resolved = path.resolve(REPO_ROOT, pathValue);
  if (resolved === base || !resolved.startsWith(`${base}${path.sep}`) || path.extname(resolved) !== ".json") throw new Error("--out must be a JSON file inside .data/fiscal-p4-pilot");
  return resolved;
}

function rejectExistingReport(filePath: string): void {
  try {
    lstatSync(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error("P4 output already exists; refusing to overwrite or execute");
}

/** Reserve the exact final path exclusively before any provider request; final write uses this fd. */
function reserveReportFile(filePath: string): number {
  mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    return openSync(filePath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("P4 output already exists; refusing to overwrite or execute");
    throw new Error("P4 output path is not writable; refusing to execute");
  }
}

/** One-shot worker-layer entry. It invokes guarded analysis only; no ordinary queues/worker are started. */
export async function executeBoundedP4(options: P4ExecutionOptions): Promise<{ rows: P4ExecutionRow[]; reportPath: string; runHash: string }> {
  if (!options.confirmed || options.startedBy !== "explicit-cli") throw new Error("P4 execution requires explicit CLI confirmation");
  const frozenRows = validateFrozenP4Manifest(options.manifest, options.manifestHash, options.maxRequests);
  const reportPath = reportFile(options.outputPath);
  rejectExistingReport(reportPath);
  const name = ensureLocalTestDatabase(config.databaseUrl);
  const [connected] = await sql<{ database_name: string }[]>`SELECT current_database() AS database_name`;
  if (connected?.database_name !== name) throw new Error("connected database name changed");
  if (name === options.manifest.database.name) throw new Error("P4 execution must use a new isolated database separate from the read-only preparation snapshot");
  const contract = await readP4ExecutionContract();
  if (contract.contractHash !== options.contractHash || contract.sourceConfigHash !== options.sourceConfigHash) throw new Error("source/provider execution contract changed after freeze");
  if (!envEnabled("MODEL_CALLS_ENABLED") || ["COLLECT_ENABLED", "INDEXNOW_SUBMIT_ENABLED", "FEISHU_CONTENT_PUSH_ENABLED", "FEISHU_INTERNAL_ENABLED", "JINA_BODY_FALLBACK"].some(envEnabled) || config.indexNowSubmitEnabled || config.feishuContentPushEnabled) throw new Error("executor requires explicit model enablement with collection and external push valves off");
  const modelEnvs = { prefilter: "PREFILTER_MODEL", score: "SCORE_MODEL", structure: "STRUCTURE_MODEL", understand: "UNDERSTAND_MODEL", summarize: "SUMMARIZE_MODEL" };
  for (const cap of CAPABILITIES) if (process.env[modelEnvs[cap]] && process.env[modelEnvs[cap]] !== "deepseek-flash") throw new Error("capability model override conflicts with the frozen DeepSeek Flash selection");

  const lock = await sql.reserve();
  let locked = false;
  let reportFd: number | null = null;
  const startedAt = Date.now();
  const rows: P4ExecutionRow[] = [];
  const runHash = hash({ manifestHash: options.manifestHash, contractHash: options.contractHash, maxRequests: options.maxRequests });
  try {
    const [lockRow] = await lock<{ acquired: boolean; pid: number }[]>`SELECT pg_try_advisory_lock(hashtext(${EXECUTOR_LOCK})) AS acquired, pg_backend_pid() AS pid`;
    locked = !!lockRow?.acquired;
    if (!locked) throw new Error("another P4 executor holds the exclusive lock");
    await assertRuntimeIdle([...FIXED_IDS], lockRow!.pid);
    const [articleCount] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM articles`;
    if (articleCount!.count !== FIXED_IDS.length) throw new Error("P4 execution database must contain only the two frozen articles");
    const currentRows = await sql<{ id: string; source_id: string; revision: number; content_hash: string | null; revision_content_hash: string | null; body_status: string; body_text: string | null; media: unknown; x_post: unknown; config: Record<string, unknown>; participation_mode: string; title: string; url: string; source_kind: string; source_tier: string }[]>`
      SELECT a.id, a.source_id, a.revision, a.content_hash, ar.content_hash AS revision_content_hash, a.body_status, a.body_text, a.media, a.x_post, s.config, s.participation_mode, a.title, a.url, s.kind AS source_kind, s.tier AS source_tier
      FROM articles a JOIN sources s ON s.id = a.source_id LEFT JOIN article_revisions ar ON ar.article_id = a.id AND ar.revision = a.revision WHERE a.id = ANY(${[...FIXED_IDS]}) ORDER BY array_position(${[...FIXED_IDS]}::text[], a.id)`;
    if (currentRows.length !== FIXED_IDS.length) throw new Error("one or more frozen P4 articles are missing");
    for (const [index, row] of currentRows.entries()) {
      const expected = frozenRows[index]!;
      if (row.id !== expected.id || row.title !== expected.title || row.url !== expected.url || row.source_id !== expected.source.id || row.source_kind !== expected.source.kind || row.source_tier !== expected.source.tier || row.revision !== expected.revision || row.content_hash !== expected.contentHash || row.revision_content_hash !== expected.contentHash || row.body_status !== "ok" || !row.body_text?.trim() || row.participation_mode !== "editorial" || row.x_post || (Array.isArray(row.media) && row.media.length > 0)) throw new Error(`frozen P4 input ${expected.id} changed or is not text-only/body-ready`);
      if (row.config === null) throw new Error("source configuration missing");
    }
    const existing = await sql<{ article_id: string }[]>`SELECT article_id FROM analyses WHERE article_id = ANY(${[...FIXED_IDS]}) UNION SELECT split_part(subject, '@', 1) AS article_id FROM receipts WHERE subject = ANY(${FIXED_IDS.map((id, index) => `article:${id}@${frozenRows[index]!.revision}`)})`;
    if (existing.length) throw new Error("P4 executor refuses a previously analyzed or receipted article; no replay/retry");
    const [receiptState] = await sql<{ bad: number; attempts: number }[]>`SELECT count(*) FILTER (WHERE status IN ('pending','unknown'))::int AS bad, count(*)::int AS attempts FROM receipts WHERE service = 'deepseek' OR subject LIKE 'article:%'`;
    if (receiptState!.bad || receiptState!.attempts) throw new Error("fresh P4 database must have zero prior live receipt activity");
    const [budget] = await sql<{ per_minute: number; per_hour: number; per_day: number }[]>`SELECT per_minute, per_hour, per_day FROM budgets WHERE service = 'deepseek'`;
    if (!budget || budget.per_minute <= 0 || budget.per_hour <= 0 || budget.per_day !== options.maxRequests) {
      await sql`INSERT INTO budgets (service, per_minute, per_hour, per_day, note) VALUES ('deepseek', ${options.maxRequests}, ${options.maxRequests}, ${options.maxRequests}, 'one-shot bounded P4 executor') ON CONFLICT (service) DO UPDATE SET per_minute = ${Math.min(budget?.per_minute ?? options.maxRequests, options.maxRequests)}, per_hour = ${Math.min(budget?.per_hour ?? options.maxRequests, options.maxRequests)}, per_day = ${options.maxRequests}, note = 'one-shot bounded P4 executor', updated_at = now()`;
    }
    const frozenConfigHash = (await readP4ExecutionContract()).contractHash;
    if (frozenConfigHash !== options.contractHash) throw new Error("execution contract drifted before first analysis");
    for (const frozen of frozenRows) {
      if (Date.now() - startedAt >= RUN_TIMEOUT_MS) throw new Error("bounded P4 run exceeded its finite runtime");
      await assertRuntimeIdle([...FIXED_IDS], lockRow!.pid);
      const currentContract = await readP4ExecutionContract();
      if (currentContract.contractHash !== options.contractHash) throw new Error("execution contract drifted between articles");
      if (reportFd === null) reportFd = reserveReportFile(reportPath);
      const currentSource = currentRows.find((row) => row.id === frozen.id)!;
      const result = await analyzeArticle(frozen.id, { boundedPilot: { revision: frozen.revision, contentHash: frozen.contentHash, sourceId: frozen.source.id, sourceConfigHash: hash(currentSource.config), title: frozen.title, url: frozen.url, model: "deepseek-flash" } });
      if (!result || result.stale || result.needsBody || result.skippedReason || !result.output) throw new Error(`bounded analysis did not produce a final result for ${frozen.id}`);
      rows.push({ id: frozen.id, sourceId: frozen.source.id, revision: frozen.revision, contentHash: frozen.contentHash, result: result.output.relevance === "block" ? "blocked" : "analyzed", analysisId: result.analysisId, receiptIds: result.receiptIds, selected: result.output.selected, relevance: result.output.relevance });
    }
    const report = { schema: "fiscal-p4-bounded-execution/v1", runHash, manifestHash: options.manifestHash, contractHash: options.contractHash, sourceConfigHash: options.sourceConfigHash, model: "deepseek-flash", service: "deepseek", maxRequests: options.maxRequests, startedAt: new Date(startedAt).toISOString(), finishedAt: new Date().toISOString(), rows, publicationWrites: 0, groupingWrites: 0, queueWrites: 0, extractionRequests: 0, collectionRequests: 0, workerStarted: false };
    if (reportFd === null) throw new Error("P4 output was not reserved before analysis");
    writeFileSync(reportFd, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8" });
    return { rows, reportPath, runHash };
  } finally {
    try {
      if (locked) await lock`SELECT pg_advisory_unlock(hashtext(${EXECUTOR_LOCK}))`;
    } finally {
      try {
        lock.release();
      } finally {
        if (reportFd !== null) closeSync(reportFd);
      }
    }
  }
}

export const p4ExecutionLimits = { fixedArticleIds: FIXED_IDS, fixedSourceIds: FIXED_SOURCES, maxCallsPerArticle: 5, timeoutMs: RUN_TIMEOUT_MS, promptVersions: PROMPT_VERSIONS, thresholds: SELECTION.thresholds, eligibleThreshold: tierThreshold("T1") } as const;
