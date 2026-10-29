#!/usr/bin/env node
/** Bounded local-only summary draft runner. It never writes article/publication rows. */
import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import postgres from "postgres";
import { z } from "zod";
import { SUMMARY_DRAFT_SOURCE_IDS } from "./nas-candidate-batch.ts";
import { config } from "../../packages/backend/src/config.ts";
import { closeDb, sql } from "../../packages/backend/src/db.ts";
import { sha256, stableJson } from "../../packages/backend/src/lib/ids.ts";
import { buildArticlePrompt, parseTranslateOutput } from "../../packages/backend/src/editorial/writing.ts";
import { promptVersion } from "../../packages/backend/src/editorial/prompts.ts";
import { chatJson, markReceiptsCompleted } from "../../packages/backend/src/providers/llm.ts";
import { SummaryDraftSchema, summaryDraftId, writeSummaryDraft } from "../../packages/backend/src/admin/summary-drafts.ts";

const MAX_NIGHTLY = 10;
const MODEL_KEY = "default";
const MODEL = "qwen3.5:9b";
const BASE_URL = "http://192.168.3.100:11435/v1";
const FORMAT = "summary-draft-roster.v1";
const ID = /^[a-f0-9]{64}$/u;
const SAFE_RUN = /^[A-Za-z0-9][A-Za-z0-9._-]{7,79}$/u;
const PROXY_ENV = ["EGRESS_PROXY_URL", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"];
const NONLOCAL_PROVIDER_ENV = ["ZHIPU_API_KEY", "ZHIPU_BASE_URL", "DEEPSEEK_API_KEY", "DEEPSEEK_BASE_URL", "DASHSCOPE_API_KEY",
  "DASHSCOPE_BASE_URL", "XIAOMI_MIMO_API_KEY", "XIAOMI_MIMO_BASE_URL", "OPENAI_API_KEY", "OPENAI_BASE_URL", "ANTHROPIC_API_KEY",
  "ANTHROPIC_BASE_URL", "SOCIALDATA_API_KEY", "SOCIALDATA_BASE_URL", "X_API_KEY", "X_API_BASE_URL", "JINA_API_KEY", "JINA_BASE_URL",
  "DAJIALA_API_KEY", "DAJIALA_BASE_URL", "ARTIFICIAL_ANALYSIS_API_KEY", "PREFILTER_MODEL", "SCORE_MODEL", "UNDERSTAND_MODEL",
  "SUMMARIZE_MODEL", "STRUCTURE_MODEL", "GROUP_MODEL", "GROUP_REVIEW_MODEL", "DIGEST_MODEL", "REPORT_MODEL", "TRANSLATE_MODEL", "MONITOR_MODEL"];
const OFF_FLAGS = ["COLLECT_ENABLED", "JINA_BODY_FALLBACK", "FEISHU_CONTENT_PUSH_ENABLED", "FEISHU_INTERNAL_ENABLED",
  "INDEXNOW_SUBMIT_ENABLED", "EMBEDDINGS_ENABLED", "OCR_RUN_ENABLED", "WORKER_ENABLED", "ALLOW_PRIVATE_NETWORK_FETCH"];
const dataDir = path.resolve(config.dataDir);
const rosterDir = path.join(dataDir, "summary-draft-rosters");
const intentDir = path.join(dataDir, "summary-draft-intents");
const draftDir = path.join(dataDir, "summary-drafts");

export interface SummaryDraftRoster {
  schemaVersion: typeof FORMAT;
  sourceRunId: string;
  anchorAt: string;
  articleIds: string[];
}

const RosterSchema = z.object({ schemaVersion: z.literal(FORMAT), sourceRunId: z.string().regex(SAFE_RUN),
  anchorAt: z.string().datetime(),
  articleIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,80}$/u)).max(MAX_NIGHTLY) }).strict().refine((v) => new Set(v.articleIds).size === v.articleIds.length, "duplicate article IDs");
export function parseSummaryDraftRoster(value: unknown): SummaryDraftRoster { return RosterSchema.parse(value); }
const ModelOutput = z.object({ titleZh: z.string().trim().min(1).max(300), summaryZh: z.string().trim().min(1).max(2000), bodyZh: z.string() }).strict();

function shanghaiParts(date: Date): { minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]));
  return { minute: Number(values.hour) * 60 + Number(values.minute), second: Number(values.second) };
}

export function assertNightWindow(date: Date): void {
  const minute = Number.isFinite(date.getTime()) ? shanghaiParts(date).minute : Number.NaN;
  if (minute < 120 || minute >= 360) throw new Error("summary draft execution is allowed only from 02:00 through 05:59 Asia/Shanghai");
}

function nightDeadline(date: Date): number {
  const { minute, second } = shanghaiParts(date);
  return date.getTime() + (360 - minute) * 60_000 - second * 1_000 - date.getMilliseconds();
}

export async function runWithinNightWindow<T>(input: {
  items: readonly T[]; startedAt: Date; now?: () => Date;
  dispatch: (item: T, timeoutMs: number, deadlineAt: number) => Promise<unknown>;
}): Promise<Array<{ item: T; status: "completed" | "HOLD_night_window_closed" | "HOLD"; value?: unknown }>> {
  assertNightWindow(input.startedAt);
  const results = await runWithinDeadline({ ...input, deadlineAt: nightDeadline(input.startedAt) });
  return results.map((row): { item: T; status: "completed" | "HOLD_night_window_closed" | "HOLD"; value?: unknown } => ({
    ...row, status: row.status === "HOLD_deadline_closed" ? "HOLD_night_window_closed" : row.status,
  }));
}

export async function runWithinDeadline<T>(input: {
  items: readonly T[]; deadlineAt: number; now?: () => Date;
  dispatch: (item: T, timeoutMs: number, deadlineAt: number) => Promise<unknown>;
}): Promise<Array<{ item: T; status: "completed" | "HOLD_deadline_closed" | "HOLD"; value?: unknown }>> {
  const now = input.now ?? (() => new Date());
  const results: Array<{ item: T; status: "completed" | "HOLD_deadline_closed" | "HOLD"; value?: unknown }> = [];
  for (const item of input.items) {
    const current = now();
    if (current.getTime() >= input.deadlineAt) { results.push({ item, status: "HOLD_deadline_closed" }); continue; }
    const remainingMs = Math.floor(input.deadlineAt - current.getTime());
    if (remainingMs <= 0) { results.push({ item, status: "HOLD_deadline_closed" }); continue; }
    try {
      const value = await input.dispatch(item, Math.min(120_000, remainingMs), input.deadlineAt);
      results.push({ item, status: "completed", value });
    } catch { results.push({ item, status: "HOLD" }); }
  }
  return results;
}

const OneoffApprovalSchema = z.object({
  format: z.literal("summary-draft-oneoff-approval.v1"), runId: z.string().regex(SAFE_RUN), sourceRunId: z.string().regex(SAFE_RUN),
  rosterSha256: z.string().regex(ID), model: z.literal(MODEL), endpoint: z.literal(BASE_URL), operatorSha256: z.string().regex(ID),
  maxArticles: z.literal(MAX_NIGHTLY), maxCalls: z.literal(MAX_NIGHTLY), approvedAt: z.string().datetime(),
  expiresAt: z.string().datetime(), approvedBy: z.literal("user"),
}).strict();
export type OneoffApproval = z.infer<typeof OneoffApprovalSchema>;

function shanghaiDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function validateOneoffApproval(input: { file: string; expectedSha256: string; runId: string; roster: SummaryDraftRoster; rosterSha256: string }): Promise<OneoffApproval> {
  if (!ID.test(input.expectedSha256)) throw new Error("invalid one-off approval SHA-256");
  const file = assertPathWithin(dataDir, input.file);
  const rel = path.relative(dataDir, file).split(path.sep).filter(Boolean);
  let parent = dataDir;
  for (const component of rel.slice(0, -1)) {
    parent = path.join(parent, component);
    const st = await lstat(parent);
    if (!st.isDirectory() || st.isSymbolicLink() || (process.platform !== "win32" && (st.mode & 0o077) !== 0)) throw new Error("one-off approval path is unsafe");
  }
  const st = await lstat(file);
  if (!st.isFile() || st.isSymbolicLink() || st.size > 16_384 || (process.platform !== "win32" && (st.mode & 0o777) !== 0o600)) throw new Error("one-off approval file must be a private regular mode-600 file");
  const bytes = await readFile(file);
  if (sha256(bytes) !== input.expectedSha256) throw new Error("one-off approval SHA-256 mismatch");
  const approval = OneoffApprovalSchema.parse(JSON.parse(bytes.toString("utf8")));
  const actualOperatorSha256 = sha256(await readFile(fileURLToPath(import.meta.url)));
  if (approval.runId !== input.runId || approval.sourceRunId !== input.roster.sourceRunId || approval.rosterSha256 !== input.rosterSha256 ||
      approval.operatorSha256 !== actualOperatorSha256 || input.roster.articleIds.length > approval.maxArticles) throw new Error("one-off approval binding mismatch");
  const approvedAt = Date.parse(approval.approvedAt), expiresAt = Date.parse(approval.expiresAt), now = Date.now();
  if (!Number.isFinite(approvedAt) || !Number.isFinite(expiresAt) || expiresAt <= approvedAt || expiresAt - approvedAt > 30 * 60_000 || approvedAt > now || now >= expiresAt || shanghaiDateKey(new Date(approvedAt)) !== shanghaiDateKey(new Date(now))) throw new Error("one-off approval is expired or outside its validity period");
  return approval;
}

export async function claimOneoffApproval(approvalSha256: string, runId: string, approvedAt: string, claimDirectory = intentDir): Promise<void> {
  if (!ID.test(approvalSha256)) throw new Error("invalid one-off approval claim key");
  const approvedMs = Date.parse(approvedAt);
  if (!Number.isFinite(approvedMs)) throw new Error("invalid one-off approval claim date");
  const dateKey = shanghaiDateKey(new Date(approvedMs));
  await mkdir(claimDirectory, { recursive: true, mode: 0o700 });
  const st = await lstat(claimDirectory);
  if (!st.isDirectory() || st.isSymbolicLink() || (process.platform !== "win32" && (st.mode & 0o077) !== 0)) throw new Error("private output directory is unsafe");
  await writeFile(path.join(claimDirectory, `oneoff-${dateKey}.claim.json`), `${stableJson({ format: "summary-draft-oneoff-claim.v1", dateKey, approvalSha256, runId, claimedAt: new Date().toISOString() })}\n`, { flag: "wx", mode: 0o600 });
}

export function configureLocalModel(env: NodeJS.ProcessEnv): void {
  if (!env.LLM_API_KEY?.trim()) throw new Error("local Ollama API key must be injected through the process environment");
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required; no default database is allowed");
  const credentialsPath = path.join(dataDir, "summary-draft-empty-credentials-do-not-create");
  if (existsSync(credentialsPath)) throw new Error("summary operator credential isolation path exists");
  for (const key of PROXY_ENV) delete env[key];
  for (const key of NONLOCAL_PROVIDER_ENV) delete env[key];
  for (const key of OFF_FLAGS) env[key] = "false";
  env.LLM_BASE_URL = BASE_URL;
  env.LLM_MODEL = MODEL;
  env.LLM_EXTRA_JSON = JSON.stringify({ reasoning_effort: "none" });
  env.LLM_JSON_MODE = "false";
  env.LLM_VISION = "false";
  env.MODEL_CALLS_ENABLED = "true";
  env.AIHOT_CREDENTIALS_DIR = credentialsPath;
  env.DATABASE_POOL_MAX = "1";
  config.modelCallsEnabled = true;
}

export function installLocalFetchGuard(options: { fetchImpl?: typeof fetch; baseUrl?: string; deadlineAt?: number } = {}): () => void {
  const originalFetch = options.fetchImpl ?? globalThis.fetch;
  const expected = new URL(`${(options.baseUrl ?? BASE_URL).replace(/\/$/u, "")}/chat/completions`);
  globalThis.fetch = async (input: Request | URL | string, init?: RequestInit) => {
    let url: URL;
    try { url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url); }
    catch { throw new Error("provider request URL is invalid"); }
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (url.href !== expected.href || (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase() !== "POST" ||
        headers.get("authorization") !== `Bearer ${process.env.LLM_API_KEY}`) throw new Error("only the approved local Ollama endpoint is allowed");
    let signal = init?.signal;
    if (options.deadlineAt !== undefined) {
      const remaining = options.deadlineAt - Date.now();
      if (remaining <= 0) throw new Error("summary draft execution deadline closed before provider dispatch");
      const deadlineSignal = AbortSignal.timeout(remaining);
      signal = signal ? AbortSignal.any([signal, deadlineSignal]) : deadlineSignal;
    }
    return originalFetch(input, { ...init, signal, redirect: "error" });
  };
  return () => { globalThis.fetch = originalFetch; };
}

export async function acquireSummaryDraftExecutionLock(): Promise<(() => Promise<void>) | null> {
  // The worker intentionally runs with DATABASE_POOL_MAX=1. Holding a reservation from the
  // shared business pool here would leave no connection for the first business query.
  const lockSql = postgres(config.databaseUrl, {
    max: 1,
    idle_timeout: 0,
    max_lifetime: 0,
    connect_timeout: 10,
    onnotice: () => {},
    connection: { application_name: "aihot-summary-draft-lock-v1", jit: "off" },
  });
  let keepConnection = false;
  try {
    const [row] = await lockSql<{ acquired: boolean }[]>`SELECT pg_try_advisory_lock(hashtext('aihot.summary-draft-nightly.v1')) AS acquired`;
    if (row?.acquired !== true) return null;
    keepConnection = true;
    let released = false;
    return async () => {
      if (released) return;
      released = true;
      try {
        const [unlock] = await lockSql<{ released: boolean }[]>`SELECT pg_advisory_unlock(hashtext('aihot.summary-draft-nightly.v1')) AS released`;
        if (unlock?.released !== true) throw new Error("summary draft advisory lock was not held during release");
      } finally {
        // Ending this dedicated session also releases its session lock if explicit unlock fails.
        await lockSql.end({ timeout: 5 });
      }
    };
  } finally {
    if (!keepConnection) await lockSql.end({ timeout: 5 });
  }
}

function safeFileName(id: string, suffix: string): string {
  if (!ID.test(id)) throw new Error("invalid immutable draft ID");
  return path.join(intentDir, `${id}.${suffix}.json`);
}

async function writeOnce(file: string, value: unknown): Promise<void> {
  const directory = path.dirname(file);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const st = await lstat(directory);
  if (!st.isDirectory() || st.isSymbolicLink() || (process.platform !== "win32" && (st.mode & 0o077) !== 0)) throw new Error("private output directory is unsafe");
  const bytes = Buffer.from(`${stableJson(value)}\n`, "utf8");
  await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
}

function argsOf(argv: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]!;
    if (!key.startsWith("--") || out.has(key)) throw new Error("invalid or duplicate option");
    if (key === "--prepare-roster" || key === "--execute") { out.set(key, "true"); continue; }
    if (!argv[i + 1] || argv[i + 1]!.startsWith("--")) throw new Error(`option requires a value: ${key}`);
    out.set(key, argv[++i]!);
  }
  return out;
}

function assertPathWithin(base: string, file: string): string {
  const absolute = path.resolve(file);
  if (absolute !== base && !absolute.startsWith(`${base}${path.sep}`)) throw new Error("input/output path must be inside AIHOT_DATA_DIR");
  return absolute;
}

async function hasPriorAttempt(articleId: string, bodyHash: string): Promise<boolean> {
  await mkdir(intentDir, { recursive: true, mode: 0o700 });
  for (const name of await readdir(intentDir)) {
    if (!name.endsWith(".intent.json")) continue;
    try {
      const value = JSON.parse((await readFile(path.join(intentDir, name))).toString("utf8"));
      if (value.articleId === articleId && value.bodySha256 === bodyHash) return true;
    } catch { return true; } // a damaged intent is a hold, never permission to pay again
  }
  return false;
}

async function readRunDraftSubjects(roster: SummaryDraftRoster): Promise<string[]> {
  await mkdir(intentDir, { recursive: true, mode: 0o700 });
  const subjects = new Set<string>();
  for (const name of await readdir(intentDir)) {
    if (!name.endsWith(".intent.json")) continue;
    try {
      const intent = JSON.parse((await readFile(path.join(intentDir, name))).toString("utf8"));
      if (intent.runId === roster.sourceRunId && roster.articleIds.includes(intent.articleId) && ID.test(intent.draftId)) subjects.add(intent.draftId);
    } catch { /* a broken intent remains a hold and has no receipt binding */ }
  }
  return [...subjects].sort();
}

async function receiptEvidence(roster: SummaryDraftRoster) {
  const subjects = await readRunDraftSubjects(roster);
  if (!subjects.length) return { receipts: [], attempts: 0, completed: 0, failed: 0, unknown: 0, pending: 0 };
  const rows = await sql<{ id: number; subject: string; model: string; status: string; attempts: number }[]>`
    SELECT id,subject,model,status,attempts FROM receipts WHERE purpose='summary-draft' AND subject=ANY(${sql.array(subjects)}) ORDER BY subject`;
  const attempts = rows.length ? await sql<{ receipt_id: number; attempt: number; status: string }[]>`
    SELECT receipt_id,attempt,status FROM receipt_attempts WHERE receipt_id=ANY(${sql.array(rows.map((row) => row.id))}::bigint[]) ORDER BY receipt_id,attempt` : [];
  return { receipts: rows.map((row) => ({ receiptId: row.id, draftId: row.subject, model: row.model, status: row.status,
    attempts: row.attempts, attemptStatuses: attempts.filter((attempt) => attempt.receipt_id === row.id).map((attempt) => attempt.status) })),
    attempts: attempts.length, completed: rows.filter((row) => row.status === "completed").length,
    failed: rows.filter((row) => row.status === "failed").length, unknown: rows.filter((row) => row.status === "unknown").length,
    pending: rows.filter((row) => row.status === "pending" || row.status === "received").length };
}

async function listEligible(anchor: Date, limit = 120) {
  const sourceIds = [...SUMMARY_DRAFT_SOURCE_IDS];
  const [counts] = await sql<{ total: number; enabled: number; siteFulltext: number; syndicate: number }[]>`
    SELECT count(*)::int AS total,count(*) FILTER (WHERE enabled)::int AS enabled,
      count(*) FILTER (WHERE site_fulltext)::int AS "siteFulltext",count(*) FILTER (WHERE syndicate_fulltext)::int AS syndicate
    FROM sources`;
  if (!counts || counts.total !== 48 || counts.enabled !== 0 || counts.siteFulltext !== 0 || counts.syndicate !== 0) throw new Error("source safety flags are not all disabled");
  const approvedSources = await sql<{ id: string; enabled: boolean; site_fulltext: boolean; syndicate_fulltext: boolean; participation_mode: string; first_party: boolean }[]>`
    SELECT id,enabled,site_fulltext,syndicate_fulltext,participation_mode,first_party FROM sources WHERE id=ANY(${sql.array(sourceIds)}) ORDER BY id`;
  if (approvedSources.length !== sourceIds.length || approvedSources.some((source) => source.enabled || source.site_fulltext || source.syndicate_fulltext ||
      source.participation_mode !== "editorial" || !source.first_party)) throw new Error("approved daily-latest source identity/flags drifted");
  return sql<any[]>`
    SELECT a.id,a.source_id,a.url,a.title,a.published_at,a.revision,a.content_hash,a.body_status,a.body_text,a.discovered_at,
      to_jsonb(a)::text AS article_row_text,to_jsonb(s)::text AS source_row_text,s.name AS source_name,s.enabled,s.site_fulltext,s.syndicate_fulltext,
      s.participation_mode,s.first_party,(SELECT count(*)::int FROM analyses an WHERE an.article_id=a.id) AS analysis_count,
      (SELECT to_jsonb(o)::text FROM editorial_overrides o WHERE o.article_id=a.id) AS override_row_text,
      (SELECT to_jsonb(p)::text FROM publications p WHERE p.article_id=a.id) AS publication_row_text
    FROM articles a JOIN sources s ON s.id=a.source_id
    WHERE a.source_id=ANY(${sql.array(sourceIds)}) AND a.published_at >= ${new Date(anchor.getTime()-7*86400000)} AND a.published_at <= ${anchor}
      AND a.body_status='ok' AND length(btrim(a.body_text))>0 AND s.enabled=false AND s.site_fulltext=false AND s.syndicate_fulltext=false
      AND s.participation_mode='editorial' AND s.first_party=true
      AND NOT EXISTS (SELECT 1 FROM analyses an WHERE an.article_id=a.id)
      AND NOT EXISTS (SELECT 1 FROM editorial_overrides o WHERE o.article_id=a.id)
      AND NOT EXISTS (SELECT 1 FROM publications p WHERE p.article_id=a.id)
    ORDER BY a.published_at DESC,a.id LIMIT ${limit}`;
}

export async function prepareRoster(input: { sourceRunId: string; now: Date; outputFile: string }): Promise<SummaryDraftRoster> {
  if (!SAFE_RUN.test(input.sourceRunId)) throw new Error("invalid collector run id");
  const rows = await listEligible(input.now);
  const articleIds: string[] = [];
  for (const row of rows) {
    const bodySha = sha256(row.body_text);
    if (await hasPriorAttempt(row.id, bodySha)) continue;
    articleIds.push(row.id);
    if (articleIds.length === MAX_NIGHTLY) break;
  }
  const roster = parseSummaryDraftRoster({ schemaVersion: FORMAT, sourceRunId: input.sourceRunId, anchorAt: input.now.toISOString(), articleIds });
  const target = assertPathWithin(dataDir, input.outputFile);
  await writeOnce(target, roster);
  return roster;
}

async function loadRoster(file: string, expectedSha: string): Promise<SummaryDraftRoster> {
  const resolved = assertPathWithin(dataDir, file);
  const stat = await lstat(resolved).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink()) throw new Error("roster file is unsafe or missing");
  const bytes = await readFile(resolved);
  if (!ID.test(expectedSha) || sha256(bytes) !== expectedSha) throw new Error("roster SHA-256 mismatch");
  const roster = parseSummaryDraftRoster(JSON.parse(bytes.toString("utf8")));
  if (roster.articleIds.length > MAX_NIGHTLY) throw new Error("roster exceeds the 10 article nightly cap");
  return roster;
}

async function readCurrentArticle(id: string, anchor: Date) {
  const [row] = await sql<any[]>`
    SELECT a.id,a.source_id,a.url,a.title,a.published_at,a.revision,a.content_hash,a.body_status,a.body_text,a.discovered_at,
      to_jsonb(a)::text AS article_row_text,to_jsonb(s)::text AS source_row_text,s.name AS source_name,s.enabled,s.site_fulltext,s.syndicate_fulltext,
      s.participation_mode,s.first_party,(SELECT count(*)::int FROM analyses an WHERE an.article_id=a.id) AS analysis_count,
      (SELECT to_jsonb(o)::text FROM editorial_overrides o WHERE o.article_id=a.id) AS override_row_text,
      (SELECT to_jsonb(p)::text FROM publications p WHERE p.article_id=a.id) AS publication_row_text
    FROM articles a JOIN sources s ON s.id=a.source_id WHERE a.id=${id}`;
  if (!row) throw new Error(`article missing: ${id}`);
  const published = row.published_at ? new Date(row.published_at) : null;
  if (!published || published > anchor || published < new Date(anchor.getTime()-7*86400000) || row.body_status !== "ok" || !row.body_text?.trim() ||
      row.enabled !== false || row.site_fulltext !== false || row.syndicate_fulltext !== false || row.participation_mode !== "editorial" || row.first_party !== true ||
      row.analysis_count !== 0 || row.override_row_text !== null || row.publication_row_text !== null ||
      !SUMMARY_DRAFT_SOURCE_IDS.includes(row.source_id)) throw new Error(`article fails strict fresh summary scope: ${id}`);
  return row;
}

async function summarizeOne(row: any, roster: SummaryDraftRoster, promptVersionValue: string, timeoutMs: number): Promise<{ status: string; draftId: string; receiptId?: number }> {
  const bodySha256 = sha256(row.body_text);
  const user = buildArticlePrompt({ id: row.id, title: row.title, publishedAt: row.published_at ? new Date(row.published_at) : undefined,
    sourceName: row.source_name, sourceKind: "web_list", text: row.body_text, bodyStatus: "ok", fetchesBody: true } as never);
  const system = "";
  const userSha256 = sha256(user);
  const draftId = summaryDraftId({ articleId: row.id, revision: Number(row.revision), bodySha256, promptVersion: promptVersionValue, userSha256, model: MODEL });
  const intentFile = safeFileName(draftId, "intent");
  await writeOnce(intentFile, { format: "summary-draft-intent.v1", draftId, runId: roster.sourceRunId, articleId: row.id,
    revision: Number(row.revision), bodySha256, promptVersion: promptVersionValue, userSha256, model: MODEL, createdAt: new Date().toISOString() });
  const result = await chatJson({ model: MODEL_KEY, purpose: "summary-draft", subject: draftId, promptVersion: promptVersionValue,
    system, user, schema: z.object({ titleZh: z.string(), summaryZh: z.string(), bodyZh: z.string() }).strict(), json: false,
    parse: parseTranslateOutput, temperature: 0.2, maxTokens: 2048, attemptTag: `draft-${draftId}`, timeoutMs });
  if (result.reused) throw new Error("unexpected provider receipt reuse; no automatic retry or reuse is allowed");
  await markReceiptsCompleted([result.receiptId]);
  const generated = ModelOutput.safeParse(result.data);
  if (!generated.success) throw new Error("provider output is unusable; draft held");
  const draft = SummaryDraftSchema.parse({ format: "summary-draft.v1", draftId, runId: roster.sourceRunId,
    createdAt: new Date().toISOString(), article: { articleId: row.id, sourceId: row.source_id, sourceName: row.source_name,
      url: row.url, title: row.title, publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
      revision: Number(row.revision), contentHash: row.content_hash, bodyText: row.body_text, bodySha256: bodySha256,
      articleRowSha256: sha256(row.article_row_text), sourceRowSha256: sha256(row.source_row_text) },
    prompt: { model: MODEL_KEY, providerModel: MODEL, promptVersion: promptVersionValue, system, user, systemSha256: sha256(system), userSha256 },
    databaseExpectations: { analysisCount: 0, overrideRowSha256: null, publicationRowSha256: null,
      sourceEnabled: false, sourceSiteFulltext: false, sourceSyndicateFulltext: false },
    output: { titleZh: generated.data.titleZh, summaryZh: generated.data.summaryZh, selected: false, score: null, reason: null, category: null, tags: [] },
    provider: { receiptId: result.receiptId, service: "llm", model: MODEL, purpose: "summary-draft", attempts: 1, status: "completed" } });
  await writeSummaryDraft(draft);
  return { status: "draft", draftId, receiptId: result.receiptId };
}

async function executeRosterUntil(roster: SummaryDraftRoster, startedAt: Date, deadlineAt: number, nightWindow: boolean) {
  if (nightWindow) assertNightWindow(startedAt);
  const identity = (await sql<{ database: string }[]>`SELECT current_database() AS database`)[0];
  if (!identity?.database) throw new Error("database identity unavailable");
  const promptVersionValue = promptVersion("summarize-article", "summarize-article-empty", "summarize-short-post", "summarize-short-post-quoted", "summarize-long-post", "summarize-long-post-quoted", "identity-context");
  const dispatch = async (articleId: string, timeoutMs: number) => {
    try {
      const row = await readCurrentArticle(articleId, new Date(roster.anchorAt));
      if (await hasPriorAttempt(articleId, sha256(row.body_text))) return { articleId, status: "HOLD_prior_input_attempt" };
      return { articleId, ...await summarizeOne(row, roster, promptVersionValue, timeoutMs) };
    } catch (error) { return { articleId, status: "HOLD", reason: error instanceof Error ? error.name : "UnknownError" }; }
  };
  const bounded = nightWindow
    ? await runWithinNightWindow({ items: roster.articleIds, startedAt, dispatch })
    : await runWithinDeadline({ items: roster.articleIds, deadlineAt, dispatch });
  const results: Array<Record<string, unknown>> = bounded.map(({ item: articleId, status, value }) => status === "completed" && value && typeof value === "object"
    ? value as Record<string, unknown>
    : { articleId, status: status === "completed" ? "HOLD" : status === "HOLD_deadline_closed" ? "HOLD_oneoff_deadline_closed" : status });
  const receipts = await receiptEvidence(roster);
  return { results, providerCalls: receipts.attempts, receipts };
}

export async function executeRoster(input: { roster: SummaryDraftRoster; execute: boolean; now: Date }): Promise<{ results: Array<Record<string, unknown>>; providerCalls: number; receipts?: Awaited<ReturnType<typeof receiptEvidence>> }> {
  const roster = parseSummaryDraftRoster(input.roster);
  if (!input.execute) return { results: roster.articleIds.map((articleId) => ({ articleId, status: "plan-only" })), providerCalls: 0 };
  assertNightWindow(input.now);
  return executeRosterUntil(roster, input.now, nightDeadline(input.now), true);
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = argsOf(argv);
  const approvalPath = args.get("--oneoff-approval"), approvalHash = args.get("--oneoff-approval-sha256");
  if (Boolean(approvalPath) !== Boolean(approvalHash) || ((approvalPath || approvalHash) && (!args.has("--execute") || args.has("--prepare-roster")))) throw new Error("one-off approval options require --execute and cannot be used with --prepare-roster");
  const mode = args.has("--prepare-roster");
  if (mode === args.has("--roster")) throw new Error("choose exactly one of --prepare-roster or --roster");
  if (mode) {
    if (!args.get("--source-run-id") || !args.get("--out")) throw new Error("--prepare-roster requires --source-run-id and --out");
    const dbName = (await sql<{ database: string }[]>`SELECT current_database() AS database`)[0]?.database;
    if (!dbName) throw new Error("database identity unavailable");
    const roster = await prepareRoster({ sourceRunId: args.get("--source-run-id")!, now: new Date(), outputFile: args.get("--out")! });
    console.log(JSON.stringify({ result: "ROSTER_PREPARED", sourceRunId: roster.sourceRunId, anchorAt: roster.anchorAt, database: dbName, articleCount: roster.articleIds.length, articleIds: roster.articleIds, output: path.resolve(args.get("--out")!) }, null, 2));
    return;
  }
  if (!args.get("--roster") || !args.get("--roster-sha256") || !args.get("--run-id")) throw new Error("--roster requires --roster-sha256 and --run-id");
  if (!SAFE_RUN.test(args.get("--run-id")!)) throw new Error("invalid operator run ID");
  const rosterFile = assertPathWithin(dataDir, args.get("--roster")!);
  const roster = await loadRoster(rosterFile, args.get("--roster-sha256")!);
  const rosterSha256 = sha256(await readFile(rosterFile));
  if (!args.has("--execute")) {
    const plan = await executeRoster({ roster, execute: false, now: new Date() });
    console.log(JSON.stringify({ result: "PLAN_ONLY", runId: args.get("--run-id"), rosterSha256, ...plan }, null, 2));
    return;
  }
  const runId = args.get("--run-id")!;
  const approval = approvalPath && approvalHash ? await validateOneoffApproval({ file: approvalPath, expectedSha256: approvalHash, runId, roster, rosterSha256 }) : null;
  if (!approval) assertNightWindow(new Date());
  configureLocalModel(process.env);
  const releaseLock = await acquireSummaryDraftExecutionLock();
  if (!releaseLock) throw new Error("another summary draft operator holds the exclusive database lock");
  try {
    const startedAt = new Date();
    if (approval) {
      if (Date.now() >= Date.parse(approval.expiresAt)) throw new Error("one-off approval expired before execution");
      await claimOneoffApproval(approvalHash!, runId, approval.approvedAt);
    }
    const deadlineAt = approval ? Math.min(Date.parse(approval.expiresAt), startedAt.getTime() + 25 * 60_000) : nightDeadline(startedAt);
    const restoreFetch = installLocalFetchGuard({ deadlineAt });
    try {
      const plan = approval ? await executeRosterUntil(roster, startedAt, deadlineAt, false) : await executeRoster({ roster, execute: true, now: startedAt });
      console.log(JSON.stringify({ result: "SUMMARY_DRAFTS_FINISHED", runId, rosterSha256, oneoff: Boolean(approval), ...plan }, null, 2));
    } finally { restoreFetch(); }
  } finally {
    await releaseLock();
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { await main(); }
  catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error(JSON.stringify({ result: "HOLD", error: name }));
    process.exitCode = 1;
  } finally { await closeDb(); }
}
