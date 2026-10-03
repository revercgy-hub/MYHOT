// Read-only P4 sample readiness audit. It never imports or invokes analysis, provider, worker, or queue code.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { CAPABILITIES } from "../../packages/backend/src/editorial/models.ts";
import { promptVersion } from "../../packages/backend/src/editorial/prompts.ts";
import { config, REPO_ROOT } from "../../packages/backend/src/config.ts";
import { closeDb, sql, type Tx } from "../../packages/backend/src/db.ts";
import { MODELS } from "../../packages/backend/src/providers/llm.ts";
import { SELECTION } from "../../industry/selection.ts";

const CAPABILITY_KEYS = ["prefilter", "score", "understand", "summarize", "structure"] as const;
const QUEUE_NAMES = ["content.analyze", "content.extract-body"] as const;
const ACTIVE_JOB_STATES = ["created", "retry", "active"] as const;

export interface PilotArticleRow {
  id: string;
  title: string;
  url: string;
  revision: number;
  content_hash: string | null;
  revision_content_hash: string | null;
  body_status: string;
  body_chars: number;
  source_id: string;
  source_name: string;
  source_enabled: boolean;
  source_kind: string;
  source_tier: string;
  participation_mode: string;
  processing_state: string;
  processing_queued_at: Date | null;
  processing_retry_at: Date | null;
  processing_attempts: number;
  latest_analysis_revision: number | null;
  latest_analysis_origin: string | null;
  latest_analysis_prompt_version: string | null;
  latest_analysis_model: string | null;
}

export interface PilotJobRow { article_id: string; name: string; state: string }
export interface PilotReceiptIssue { subject: string; status: string }
export interface PilotModelSetting { key: string; model: string | null }
export interface PilotBudget { service: string; per_minute: number; per_hour: number; per_day: number }
export interface PilotUsage { service: string; minute: number; hour: number; day: number }
interface PilotSnapshot {
  databaseName: string;
  snapshotAt: string;
  articles: PilotArticleRow[];
  jobs: PilotJobRow[];
  receiptIssues: PilotReceiptIssue[];
  settings: PilotModelSetting[];
  budgets: PilotBudget[];
  usage: PilotUsage[];
  activeWorkerHeartbeat: boolean;
}

export interface PilotRecord {
  id: string;
  title: string;
  url: string;
  source: { id: string; name: string; enabled: boolean; kind: string; tier: string };
  revision: number;
  contentHash: string | null;
  revisionContentHash: string | null;
  bodyStatus: string;
  bodyChars: number;
  processingState: string;
  processingQueued: boolean;
  processingRetry: boolean;
  processingAttempts: number;
  latestAnalysis: { revision: number | null; origin: string | null; promptVersion: string | null; model: string | null };
  accepted: boolean;
  rejectionReasons: string[];
}

export interface ProviderCallPlan {
  stage: "prefilter" | "score" | "structure" | "understand" | "summarize";
  capability: typeof CAPABILITY_KEYS[number];
  modelKey: string;
  provider: string;
  providerModel: string;
  maxCallsPerArticle: number;
  condition: string;
}

export function parseArticleIds(value: string): string[] {
  const ids = value.split(",").map((item) => item.trim());
  if (!ids.length || ids.some((id) => !/^[a-zA-Z0-9_-]{1,80}$/.test(id))) throw new Error("--article-ids must be a comma-separated explicit list of valid article IDs");
  if (new Set(ids).size !== ids.length) throw new Error("--article-ids cannot contain duplicates");
  if (ids.length > 50) throw new Error("--article-ids is limited to 50 explicit IDs per audit");
  return ids;
}

export function assertTestDatabaseName(databaseUrl: string): string {
  let name: string;
  try {
    const parsed = new URL(databaseUrl);
    const host = parsed.hostname.toLowerCase();
    if (!(["postgres:", "postgresql:"].includes(parsed.protocol)) || !["localhost", "127.0.0.1", "[::1]"].includes(host)) {
      throw new Error("non-local database endpoint");
    }
    name = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  }
  catch { throw new Error("DATABASE_URL must identify a local *_test database"); }
  if (!/^[a-zA-Z0-9_-]+_test$/.test(name)) throw new Error("P4 dry-run only reads a database whose name ends in _test");
  return name;
}

export function evaluatePilotRecords(
  ids: string[],
  rows: PilotArticleRow[],
  jobs: PilotJobRow[],
  receiptIssues: PilotReceiptIssue[],
  activeWorkerHeartbeat: boolean,
): PilotRecord[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const jobsById = new Map<string, PilotJobRow[]>();
  for (const job of jobs) jobsById.set(job.article_id, [...(jobsById.get(job.article_id) ?? []), job]);
  const issuesBySubject = new Map(receiptIssues.map((issue) => [issue.subject, issue.status]));

  return ids.map((id) => {
    const row = byId.get(id);
    const reasons: string[] = [];
    if (!row) return {
      id, title: "", url: "", source: { id: "", name: "", enabled: false, kind: "", tier: "" },
      revision: 0, contentHash: null, revisionContentHash: null, bodyStatus: "missing", bodyChars: 0,
      processingState: "missing", processingQueued: false, processingRetry: false, processingAttempts: 0,
      latestAnalysis: { revision: null, origin: null, promptVersion: null, model: null }, accepted: false, rejectionReasons: ["article_id_not_found"],
    };

    let publicHttps = false;
    try {
      const parsed = new URL(row.url);
      publicHttps = parsed.protocol === "https:" && !!parsed.hostname && !parsed.username && !parsed.password && !parsed.hostname.endsWith(".invalid");
    } catch { /* invalid URL remains rejected */ }
    if (!publicHttps) reasons.push("article_url_not_public_https");
    if (row.body_status !== "ok") reasons.push(row.body_status === "unconfirmed" ? "body_unconfirmed" : `body_status_${row.body_status || "missing"}`);
    if (row.body_chars <= 0) reasons.push("body_empty");
    if (!row.content_hash || !/^[a-f\d]{64}$/i.test(row.content_hash)) reasons.push("content_hash_missing_or_invalid");
    if (row.revision_content_hash !== row.content_hash) reasons.push("revision_hash_mismatch");
    if (row.participation_mode !== "editorial") reasons.push("source_not_editorial");
    if (row.processing_queued_at) reasons.push("article_has_processing_queued_at");
    if (row.processing_retry_at || row.processing_attempts > 0 || row.processing_state === "failed") reasons.push("article_has_legacy_retry_or_failed_state");
    if (activeWorkerHeartbeat && row.processing_state === "new") reasons.push("active_worker_may_sweep_new_article");
    if (jobsById.has(id)) reasons.push("article_has_active_or_retry_job");
    const issue = issuesBySubject.get(`article:${id}@${row.revision}`);
    if (issue) reasons.push(issue === "unknown" ? "article_has_unknown_receipt" : "article_has_pending_receipt");

    let title = "";
    try { title = String(row.title); } catch { /* string conversion cannot include body */ }
    return {
      id, title, url: row.url, source: { id: row.source_id, name: row.source_name, enabled: row.source_enabled, kind: row.source_kind, tier: row.source_tier },
      revision: row.revision, contentHash: row.content_hash, revisionContentHash: row.revision_content_hash, bodyStatus: row.body_status,
      bodyChars: row.body_chars, processingState: row.processing_state, processingQueued: !!row.processing_queued_at,
      processingRetry: !!row.processing_retry_at, processingAttempts: row.processing_attempts,
      latestAnalysis: { revision: row.latest_analysis_revision, origin: row.latest_analysis_origin, promptVersion: row.latest_analysis_prompt_version, model: row.latest_analysis_model },
      accepted: reasons.length === 0, rejectionReasons: reasons,
    };
  });
}

function effectiveModelKey(capability: typeof CAPABILITY_KEYS[number], settings: Map<string, string | null>): string {
  const cap = CAPABILITIES[capability];
  const adminChoice = settings.get(`models.${capability}`);
  const envChoice = process.env[cap.env];
  const chosen = (adminChoice && MODELS[adminChoice] ? adminChoice : envChoice) ?? cap.default;
  return MODELS[chosen] ? chosen : cap.default;
}

export function buildProviderPlan(
  records: PilotRecord[],
  settingsRows: PilotModelSetting[],
  modelSpecs: typeof MODELS = MODELS,
): ProviderCallPlan[] {
  const settings = new Map(settingsRows.map((row) => [row.key, row.model]));
  const accepted = records.filter((row) => row.accepted);
  const capabilities = new Set<typeof CAPABILITY_KEYS[number]>();
  for (const record of accepted) {
    capabilities.add("prefilter");
    capabilities.add("structure");
    if (SELECTION.thresholds[record.source.tier as keyof typeof SELECTION.thresholds] !== undefined) {
      capabilities.add("score"); capabilities.add("understand"); capabilities.add("summarize");
    } else capabilities.add("summarize");
  }
  const stage: Record<typeof CAPABILITY_KEYS[number], { calls: number; condition: string }> = {
    prefilter: { calls: 1, condition: "once; BLOCK terminates later stages" },
    score: { calls: 2, condition: "only when source tier has a selection threshold" },
    structure: { calls: 1, condition: "after non-BLOCK prefilter; runs alongside scores" },
    understand: { calls: 1, condition: "when score is selected or above understand floor" },
    summarize: { calls: 1, condition: "low score/no threshold, or understand content-filter fallback; some inputs short-circuit without a provider call" },
  };
  const order: typeof CAPABILITY_KEYS[number][] = ["prefilter", "score", "structure", "understand", "summarize"];
  return order.filter((capability) => capabilities.has(capability)).map((capability) => {
    const modelKey = effectiveModelKey(capability, settings);
    const spec = modelSpecs[modelKey]!;
    const providerModel = spec.key === "default" ? (process.env.LLM_MODEL || "UNCONFIGURED") : spec.model;
    return {
      stage: capability, capability, modelKey, provider: spec.service, providerModel,
      maxCallsPerArticle: stage[capability].calls, condition: stage[capability].condition,
    };
  });
}

export function promptVersions(): Record<string, string> {
  return {
    prefilter: promptVersion("prefilter"),
    score: promptVersion("selection-score"),
    understand: promptVersion("understand"),
    summarize: promptVersion("summarize-article", "summarize-article-empty", "summarize-short-post", "summarize-short-post-quoted", "summarize-long-post", "summarize-long-post-quoted", "identity-context"),
    structure: promptVersion("structure"),
  };
}

export function budgetSnapshot(
  plan: ProviderCallPlan[], acceptedCount: number, budgets: PilotBudget[], usage: PilotUsage[],
) {
  const callsByService = new Map<string, number>();
  for (const item of plan) callsByService.set(item.provider, (callsByService.get(item.provider) ?? 0) + item.maxCallsPerArticle * acceptedCount);
  const budgetsByService = new Map(budgets.map((item) => [item.service, item]));
  const usageByService = new Map(usage.map((item) => [item.service, item]));
  return [...callsByService.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([service, maxPlannedCalls]) => {
    const budget = budgetsByService.get(service);
    const used = usageByService.get(service) ?? { service, minute: 0, hour: 0, day: 0 };
    if (!budget) return { service, maxPlannedCalls, budgetConfigured: false, capacitySnapshot: "unlimited_by_current_config", used: { minute: used.minute, hour: used.hour, day: used.day }, remaining: null, amountEstimate: null };
    const remaining = { minute: Math.max(0, budget.per_minute - used.minute), hour: Math.max(0, budget.per_hour - used.hour), day: Math.max(0, budget.per_day - used.day) };
    const fits = maxPlannedCalls <= remaining.minute && maxPlannedCalls <= remaining.hour && maxPlannedCalls <= remaining.day;
    return { service, maxPlannedCalls, budgetConfigured: true, capacitySnapshot: fits ? "fits_current_snapshot_only" : "exceeds_current_snapshot", used: { minute: used.minute, hour: used.hour, day: used.day }, remaining, amountEstimate: null };
  });
}

function canonicalHash(value: unknown): string {
  const canonical = JSON.stringify(value, (_key, nested) => nested && typeof nested === "object" && !Array.isArray(nested)
    ? Object.fromEntries(Object.entries(nested as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) : nested);
  return createHash("sha256").update(canonical).digest("hex");
}

export function freezeManifest<T extends Record<string, unknown>>(input: T): T & { manifestHash: string } {
  const manifest = { ...input };
  return { ...manifest, manifestHash: canonicalHash(manifest) };
}

async function readSnapshot(ids: string[]): Promise<PilotSnapshot> {
  return sql.begin(async (tx) => {
    await tx.unsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const [db] = await tx<{ database_name: string; snapshot_at: Date }[]>`SELECT current_database() AS database_name, transaction_timestamp() AS snapshot_at`;
    const articles = await tx<PilotArticleRow[]>`
      SELECT a.id, a.title, a.url, a.revision, a.content_hash, ar.content_hash AS revision_content_hash, a.body_status,
        coalesce(length(a.body_text), 0)::int AS body_chars, s.id AS source_id, s.name AS source_name, s.enabled AS source_enabled,
        s.kind AS source_kind, s.tier AS source_tier, s.participation_mode, a.processing_state, a.processing_queued_at,
        a.processing_retry_at, a.processing_attempts,
        latest.input_revision AS latest_analysis_revision, latest.origin AS latest_analysis_origin,
        latest.prompt_version AS latest_analysis_prompt_version, latest.model AS latest_analysis_model
      FROM articles a JOIN sources s ON s.id = a.source_id
      LEFT JOIN article_revisions ar ON ar.article_id = a.id AND ar.revision = a.revision
      LEFT JOIN LATERAL (
        SELECT input_revision, origin, prompt_version, model FROM analyses WHERE article_id = a.id ORDER BY id DESC LIMIT 1
      ) latest ON true
      WHERE a.id = ANY(${ids})`;
    const subjects = articles.map((row) => `article:${row.id}@${row.revision}`);
    const jobsTable = await tx<{ exists: boolean }[]>`SELECT to_regclass('pgboss.job') IS NOT NULL AS exists`;
    const jobs = jobsTable[0]?.exists ? await tx<PilotJobRow[]>`
      SELECT data->>'articleId' AS article_id, name, state FROM pgboss.job
      WHERE name = ANY(${[...QUEUE_NAMES]}) AND state = ANY(${[...ACTIVE_JOB_STATES]}) AND data->>'articleId' = ANY(${ids})` : [];
    const receiptIssues = subjects.length ? await tx<PilotReceiptIssue[]>`
      SELECT subject, status FROM receipts WHERE subject = ANY(${subjects}) AND status IN ('pending', 'unknown')` : [];
    const settings = await tx<PilotModelSetting[]>`
      SELECT key, value->>'model' AS model FROM settings
      WHERE key = ANY(${CAPABILITY_KEYS.map((capability) => `models.${capability}`)}) OR key = 'heartbeat.worker'`;
    const heartbeat = settings.find((item) => item.key === "heartbeat.worker");
    const workerUpdated = heartbeat ? await tx<{ updated_at: Date }[]>`SELECT updated_at FROM settings WHERE key = 'heartbeat.worker'` : [];
    const activeWorkerHeartbeat = !!workerUpdated[0] && Date.now() - workerUpdated[0].updated_at.getTime() < 180_000;
    const budgets = await tx<PilotBudget[]>`SELECT service, per_minute, per_hour, per_day FROM budgets`;
    const usage = await tx<PilotUsage[]>`
      SELECT service,
        count(*) FILTER (WHERE started_at > now() - interval '1 minute')::int AS minute,
        count(*) FILTER (WHERE started_at > now() - interval '1 hour')::int AS hour,
        count(*)::int AS day
      FROM receipt_attempts WHERE origin = 'live' AND started_at > now() - interval '1 day' GROUP BY service`;
    return { databaseName: db!.database_name, snapshotAt: db!.snapshot_at.toISOString(), articles, jobs, receiptIssues, settings, budgets, usage, activeWorkerHeartbeat };
  });
}

function outputPath(value: string | undefined, timestamp: string): string {
  const base = path.resolve(REPO_ROOT, ".data/fiscal-p4-pilot");
  const candidate = path.resolve(REPO_ROOT, value ?? path.join(".data", "fiscal-p4-pilot", `manifest-${timestamp.replace(/[:.]/g, "-")}.json`));
  if (candidate !== base && !candidate.startsWith(`${base}${path.sep}`)) throw new Error("--out must stay inside .data/fiscal-p4-pilot");
  if (path.extname(candidate).toLowerCase() !== ".json") throw new Error("--out must end in .json");
  return candidate;
}

async function main() {
  const { values } = parseArgs({
    options: { "article-ids": { type: "string" }, out: { type: "string" }, help: { type: "boolean", default: false } },
    strict: true,
  });
  if (values.help) {
    console.log("Usage: node scripts/fiscal/p4-pilot.ts --article-ids id1,id2 [--out .data/fiscal-p4-pilot/manifest.json]");
    return;
  }
  if (!values["article-ids"]) throw new Error("--article-ids is required; automatic candidate selection is disabled");
  const ids = parseArticleIds(values["article-ids"]);
  const databaseName = assertTestDatabaseName(config.databaseUrl);
  const snapshot = await readSnapshot(ids);
  if (snapshot.databaseName !== databaseName) throw new Error("connected database name changed during audit");
  const records = evaluatePilotRecords(ids, snapshot.articles, snapshot.jobs, snapshot.receiptIssues, snapshot.activeWorkerHeartbeat);
  const accepted = records.filter((record) => record.accepted);
  const providerPlan = buildProviderPlan(records, snapshot.settings);
  const budget = budgetSnapshot(providerPlan, accepted.length, snapshot.budgets, snapshot.usage);
  const hasRejects = records.some((record) => !record.accepted);
  const modelCallsEnabled = process.env.MODEL_CALLS_ENABLED !== "false";
  const promptVersionSnapshot = promptVersions();
  const manifest = freezeManifest({
    schema: "fiscal-p4-pilot-readiness/v1", mode: "READ_ONLY_DRY_RUN", ready: !hasRejects,
    database: { name: databaseName, snapshotAt: snapshot.snapshotAt }, requestedArticleIds: ids,
    records, providerPlan, promptVersions: promptVersionSnapshot,
    scoreRule: { thresholds: SELECTION.thresholds, scoreCallsPerEligibleTierArticle: 2, writerFallback: "understand may be followed by summarize after content-filter refusal" },
    budget, budgetIsReserved: false, amountEstimate: null,
    sourceEnabledWarning: "disabled sources can be read by explicit-ID dry-run; disabled is not an execution safety boundary",
    modelCallsFlagObserved: modelCallsEnabled, modelCallsFlagMeaning: "observed only; this script cannot call a provider regardless of the flag",
    execution: { modelCalls: 0, analysisWrites: 0, publicationWrites: 0, queueWrites: 0, collectionRequests: 0, httpRequests: 0, workerStarted: false },
    limitations: ["budget capacity is a non-reserving snapshot; concurrent attempts can change it", "provider charges cannot be priced here; amount estimate is unknown", "an external worker started after this snapshot is outside this read-only audit", "this manifest does not claim model or editorial validation"],
  });
  const out = outputPath(values.out, snapshot.snapshotAt);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ ready: manifest.ready, requested: ids.length, accepted: accepted.length, rejected: records.length - accepted.length, database: databaseName, manifestHash: manifest.manifestHash, manifestPath: path.relative(REPO_ROOT, out) }, null, 2));
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "P4 dry-run failed");
    process.exitCode = 1;
  }).finally(() => closeDb());
}
