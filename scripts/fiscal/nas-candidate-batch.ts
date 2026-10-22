#!/usr/bin/env node
/** Bounded direct-source candidate ingest for the isolated NAS staging database. */
import { createHash } from "node:crypto";
import diagnosticsChannel from "node:diagnostics_channel";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import type { Candidate, SourceRow } from "../../packages/backend/src/sources/types.ts";

const ROOT = process.env.AIHOT_APP_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const appModule = (relative: string) => pathToFileURL(path.resolve(ROOT, relative)).href;
const CATALOG_PATH = path.join(ROOT, "industry/sources.json");
const CATALOG_BYTES = readFileSync(CATALOG_PATH);
const CATALOG = JSON.parse(CATALOG_BYTES.toString("utf8")) as { sources: Array<Record<string, any>> };
const DEFAULT_SOURCE_IDS = ["mof-budget-work"];
const MAX_SOURCES = 48;
const MAX_NEW_PER_SOURCE = 30;
const MAX_NEW_TOTAL = 600;
const MAX_DETAILS_TOTAL = 150;
const MAX_DISPATCHES = 198;
const MIN_INTERVAL_MS = 1_100;
const MAX_CAPTURE_BYTES = 8 * 1024 * 1024;
const FIXED_APP_SHA = "21ca4d400bda9071f1e0b8761d404d1fc5b001e5";
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};

export interface BatchSourcePlan {
  id: string;
  kind: "web_list" | "json_list";
  url: string;
  maxNew: number;
  maxDetails: number;
  unsupportedConfig: string[];
}

export function buildSourcePlan(input: {
  catalogSources: Array<Record<string, any>>;
  sourceIds: string[];
  maxNewPerSource: number;
  maxDetailsTotal: number;
  unsupportedConfig: (kind: SourceRow["kind"], config: Record<string, unknown>) => string[];
}): BatchSourcePlan[] {
  if (input.sourceIds.length < 1 || input.sourceIds.length > MAX_SOURCES || new Set(input.sourceIds).size !== input.sourceIds.length) {
    throw new Error("source IDs must contain 1–48 unique configured sources");
  }
  if (!Number.isSafeInteger(input.maxNewPerSource) || input.maxNewPerSource < 1 || input.maxNewPerSource > MAX_NEW_PER_SOURCE) {
    throw new Error(`per-source candidate cap must be 1–${MAX_NEW_PER_SOURCE}`);
  }
  if (!Number.isSafeInteger(input.maxDetailsTotal) || input.maxDetailsTotal < 0 || input.maxDetailsTotal > MAX_DETAILS_TOTAL) {
    throw new Error(`detail cap must be 0–${MAX_DETAILS_TOTAL}`);
  }
  const rows = new Map(input.catalogSources.map((row) => [String(row.id), row]));
  return input.sourceIds.map((id) => {
    const row = rows.get(id);
    if (!row || !["web_list", "json_list"].includes(row.kind) || row.enabled !== false ||
        row.site_fulltext !== false || row.syndicate_fulltext !== false) throw new Error(`source is not a configured disabled summary-only list: ${id}`);
    const config = row.config ?? {};
    const url = new URL(String(config.url ?? ""));
    if (!config.url || !["http:", "https:"].includes(url.protocol) || url.username || url.password ||
        url.hostname === "r.jina.ai" || url.hostname.endsWith(".jina.ai") || !Array.isArray(config.allowUrlPrefixes) || !config.allowUrlPrefixes.length) {
      throw new Error(`source must have a direct public configured URL and allowlist: ${id}`);
    }
    if (row.kind === "web_list" && (config.adapter !== undefined || config.parseMode === "markdown" || !config.itemSelector)) {
      throw new Error(`source is outside the direct configured HTML list scope: ${id}`);
    }
    if (row.kind === "json_list" && !config.itemsPath && !config.categorySelection?.itemsPath && !config.jsonKey && !config.windowVar) {
      throw new Error(`JSON source has no configured list mapping: ${id}`);
    }
    if (config.method !== undefined && config.method !== "GET") throw new Error(`non-GET list source is excluded: ${id}`);
    const unsupported = input.unsupportedConfig(row.kind, config);
    if (unsupported.length) throw new Error(`unsupported source config for ${id}: ${unsupported.join(",")}`);
    const detail = config.detail;
    const sourceDetailCap = detail && Number.isSafeInteger(detail.maxFetches) && detail.maxFetches > 0
      ? Math.min(10, detail.maxFetches) : 0;
    return { id, kind: row.kind, url: url.href, maxNew: input.maxNewPerSource,
      maxDetails: Math.min(sourceDetailCap, input.maxDetailsTotal), unsupportedConfig: unsupported };
  });
}

export function classifyCandidates(input: {
  candidates: Candidate[];
  source: SourceRow;
  knownIdentities: ReadonlySet<string>;
  identityKeyFor: (material: Candidate & { sourceId: string; via: "fetch" }) => string;
  allowed: (url: string, source: SourceRow) => boolean;
  rewrite?: { from: string; to: string };
  maxNew: number;
  inWindow: (candidate: Candidate) => boolean;
}): { eligible: Array<{ identityKey: string; candidate: Candidate }>; known: number; duplicate: number; held: number; capped: boolean } {
  const identities = new Set<string>();
  const fresh: Array<{ identityKey: string; candidate: Candidate }> = [];
  let known = 0, duplicate = 0, held = 0;
  for (const original of input.candidates) {
    let candidate = original;
    if (input.rewrite?.from && input.rewrite.to && candidate.url.startsWith(input.rewrite.from)) {
      candidate = { ...candidate, url: input.rewrite.to + candidate.url.slice(input.rewrite.from.length) };
    }
    if (!input.allowed(original.url, input.source) || !input.allowed(candidate.url, input.source) ||
        !candidate.title?.trim() || candidate.title.trim().length < 6 || !input.inWindow(candidate)) { held++; continue; }
    const identityKey = input.identityKeyFor({ ...candidate, sourceId: input.source.id, via: "fetch" });
    if (identities.has(identityKey)) { duplicate++; continue; }
    identities.add(identityKey);
    if (input.knownIdentities.has(identityKey)) { known++; continue; }
    fresh.push({ identityKey, candidate });
  }
  return { eligible: fresh.slice(0, input.maxNew), known, duplicate, held, capped: fresh.length > input.maxNew };
}

export function detailConfigIsDirectHtml(source: SourceRow): boolean {
  const detail = source.config.detail;
  return source.kind === "web_list" && typeof detail?.bodySelector === "string" && !!detail.bodySelector.trim() &&
    Number.isSafeInteger(detail.maxFetches) && detail.maxFetches > 0 && detail.mode === undefined &&
    detail.pdfDirect !== true && detail.attachmentSelector === undefined && detail.attachmentScopeSelector === undefined &&
    detail.attachmentMode === undefined && detail.articleSelector === undefined && detail.bodyPolicies === undefined &&
    !!(detail.titleSelector || detail.titleRegex) && !!(detail.publishedAtSelector || detail.publishedAtRegex) &&
    !String(source.config.url).startsWith("https://r.jina.ai/");
}

export function sameConfiguredDay(a: Date, b: Date, offset: string): boolean {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!m || !Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return false;
  const sign = m[1] === "+" ? 1 : -1;
  const minutes = sign * (Number(m[2]) * 60 + Number(m[3]));
  const day = (value: Date) => new Date(value.getTime() + minutes * 60_000).toISOString().slice(0, 10);
  return day(a) === day(b);
}

export function decodeCapturedBody(body: Buffer, contentType: string | null): string {
  let charset = /charset=([\w-]+)/iu.exec(contentType ?? "")?.[1]?.toLowerCase() ?? "utf-8";
  if (!/charset=/iu.test(contentType ?? "") && !/^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/iu.test(contentType ?? "")) {
    const head = body.subarray(0, 2048).toString("latin1");
    const meta = /<meta[^>]+charset=["']?([\w-]+)/iu.exec(head) ?? /encoding=["']([\w-]+)["']/iu.exec(head);
    if (meta) charset = meta[1]!.toLowerCase();
  }
  if (charset === "gb2312") charset = "gbk";
  try { return new TextDecoder(charset).decode(body).replace(/\uFFFD+/gu, "\uFFFD"); }
  catch { return body.toString("utf8").replace(/\uFFFD+/gu, "\uFFFD"); }
}

type RawRecord = {
  ordinal: number; method: string; url: string; status: number | null; contentType: string | null;
  contentEncoding: string | null; redirectLocation: string | null; bytes: number; sha256: string | null;
  eof: boolean; truncated: boolean; file: string | null; error: string | null;
};

function safeUrl(value: string): string {
  try { const u = new URL(value); u.username = ""; u.password = ""; return u.href; } catch { return "<invalid-url>"; }
}

class ResponseCapture {
  private readonly requestRows = new WeakMap<object, RawRecord & { chunks: Buffer[]; hasher: ReturnType<typeof createHash>; rawRequestUrl: string }>();
  private readonly listeners: Array<() => void> = [];
  private readonly responseDir: string;
  readonly rows: Array<RawRecord & { rawRequestUrl: string }> = [];
  constructor(responseDir: string) {
    this.responseDir = responseDir;
    this.listen("undici:request:create", (message) => {
      const request = message?.request;
      if (!request) return;
      const rawRequestUrl = `${String(request.origin ?? "")}${String(request.path ?? "")}`;
      const row = { ordinal: this.rows.length + 1, method: String(request.method ?? ""), url: safeUrl(rawRequestUrl),
        rawRequestUrl, status: null, contentType: null, contentEncoding: null, redirectLocation: null,
        bytes: 0, sha256: null, eof: false, truncated: false, file: null, error: null,
        chunks: [] as Buffer[], hasher: createHash("sha256") };
      this.rows.push(row);
      this.requestRows.set(request, row);
    });
    this.listen("undici:request:headers", (message) => {
      const row = this.requestRows.get(message?.request);
      const response = message?.response;
      if (!row || !response) return;
      row.status = Number(response.statusCode ?? 0) || null;
      row.contentType = this.header(response.headers, "content-type");
      row.contentEncoding = this.header(response.headers, "content-encoding") ?? "identity";
      const location = this.header(response.headers, "location");
      if (location) { try { row.redirectLocation = safeUrl(new URL(location, row.rawRequestUrl).href); } catch { row.redirectLocation = "<invalid-url>"; } }
    });
    this.listen("undici:request:bodyChunkReceived", (message) => {
      const row = this.requestRows.get(message?.request);
      if (!row || !message.chunk) return;
      const chunk = Buffer.from(message.chunk);
      row.bytes += chunk.length;
      row.hasher.update(chunk);
      if (row.bytes <= MAX_CAPTURE_BYTES) row.chunks.push(chunk);
      else { row.truncated = true; row.chunks = []; }
    });
    this.listen("undici:request:trailers", (message) => this.finish(message?.request, true));
    this.listen("undici:request:error", (message) => {
      const row = this.requestRows.get(message?.request);
      if (row) row.error = String(message.error?.code ?? message.error?.name ?? "request_error");
      this.finish(message?.request, false);
    });
  }
  private listen(name: string, fn: (message: any) => void) {
    const channel = diagnosticsChannel.channel(name);
    channel.subscribe(fn);
    this.listeners.push(() => channel.unsubscribe(fn));
  }
  private header(headers: unknown, wanted: string): string | null {
    if (Array.isArray(headers)) {
      for (let i = 0; i < headers.length; i += 2) if (String(headers[i]).toLowerCase() === wanted) return String(headers[i + 1] ?? "");
    } else if (headers && typeof headers === "object") {
      for (const [key, value] of Object.entries(headers)) if (key.toLowerCase() === wanted) return String(value ?? "");
    }
    return null;
  }
  private finish(request: object | undefined, eof: boolean) {
    if (!request) return;
    const row = this.requestRows.get(request);
    if (!row || row.file || row.sha256) return;
    const bytes = Buffer.concat(row.chunks);
    row.sha256 = row.hasher.copy().digest("hex");
    row.truncated ||= bytes.length !== row.bytes || row.bytes > MAX_CAPTURE_BYTES;
    row.eof = eof && !row.truncated;
    if (!row.truncated && row.eof) {
      const file = `response-${String(row.ordinal).padStart(3, "0")}.body`;
      writeFileSync(path.join(this.responseDir, file), bytes, { flag: "wx", mode: 0o600 });
      row.file = `responses/${file}`;
    }
    row.chunks = [];
    row.hasher.destroy();
  }
  close() { for (const unsubscribe of this.listeners) unsubscribe(); }
}

function parseCli() {
  return parseArgs({ options: {
    "source-ids": { type: "string", default: DEFAULT_SOURCE_IDS.join(",") },
    "max-new-per-source": { type: "string", default: "30" },
    "max-details": { type: "string", default: "0" },
    "run-id": { type: "string" },
    execute: { type: "boolean", default: false },
  }, strict: true });
}

async function main() {
  const args = parseCli().values;
  // Set all runtime valves before importing backend config, HTTP or database modules.
  for (const key of ["COLLECT_ENABLED", "MODEL_CALLS_ENABLED", "JINA_BODY_FALLBACK", "FEISHU_CONTENT_PUSH_ENABLED",
    "FEISHU_INTERNAL_ENABLED", "INDEXNOW_SUBMIT_ENABLED", "EMBEDDINGS_ENABLED", "OCR_RUN_ENABLED", "WORKER_ENABLED",
    "ALLOW_PRIVATE_NETWORK_FETCH"]) process.env[key] = "false";
  process.env.COLLECT_SKIP_JINA = "true";
  process.env.AIHOT_CREDENTIALS_DIR = "/nonexistent-nas-candidate-credentials";
  for (const key of ["LLM_API_KEY", "OPENAI_API_KEY", "OPENAI_BASE_URL", "ANTHROPIC_API_KEY", "GEMINI_API_KEY",
    "GOOGLE_API_KEY", "DASHSCOPE_API_KEY", "EMBEDDING_API_KEY", "JINA_API_KEY", "OCR_API_KEY", "SOCIALDATA_API_KEY",
    "DAJIALA_API_KEY", "FEISHU_APP_ID", "FEISHU_APP_SECRET", "FEISHU_CONTENT_PUSH_WEBHOOK", "FEISHU_INTERNAL_WEBHOOK",
    "INDEXNOW_KEY", "EGRESS_PROXY_URL", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]) delete process.env[key];
  const sourceIds = String(args["source-ids"]).split(",").map((id) => id.trim());
  const maxNewPerSource = Number(args["max-new-per-source"]);
  const maxDetailsTotal = Number(args["max-details"]);
  const { unsupportedConfig } = (await import(appModule("packages/backend/src/sources/config-keys.ts"))) as typeof import("../../packages/backend/src/sources/config-keys.ts");
  const sourcePlan = buildSourcePlan({ catalogSources: CATALOG.sources, sourceIds, maxNewPerSource, maxDetailsTotal, unsupportedConfig });
  const totalNewCap = Math.min(MAX_NEW_TOTAL, sourcePlan.length * maxNewPerSource);
  const totalDetailCap = Math.min(MAX_DETAILS_TOTAL, maxDetailsTotal,
    sourcePlan.reduce((sum, source) => sum + source.maxDetails, 0));
  const catalogSha256 = sha256(CATALOG_BYTES);
  const operatorSha256 = sha256(readFileSync(fileURLToPath(import.meta.url)));
  const startedAt = new Date().toISOString();
  const plan = { result: args.execute ? "EXECUTE_SCOPE_READONLY_PREFLIGHT_PASS" : "PLAN_ONLY_NO_DATABASE_NO_HTTP_NO_WRITES",
    startedAt, sourceIds, catalogSha256, operatorSha256, fixedAppSha: FIXED_APP_SHA, maxDispatches: sourcePlan.length + totalDetailCap,
    maxNewPerSource, maxNewTotal: totalNewCap, maxDetailsTotal: totalDetailCap,
    minIntervalMs: MIN_INTERVAL_MS, serial: true, redirects: 0, retries: 0, queueProcessing: false,
    collectSource: false, sourceWrites: false, flags: Object.fromEntries(["COLLECT_ENABLED", "MODEL_CALLS_ENABLED", "JINA_BODY_FALLBACK",
      "FEISHU_CONTENT_PUSH_ENABLED", "FEISHU_INTERNAL_ENABLED", "INDEXNOW_SUBMIT_ENABLED", "EMBEDDINGS_ENABLED", "OCR_RUN_ENABLED", "WORKER_ENABLED"].map((key) => [key, "false"])),
    sources: sourcePlan.map((source) => ({ ...source, enabled: false, detailAllowed: source.maxDetails > 0 })) };
  if (!args.execute) { console.log(JSON.stringify(plan, null, 2)); return; }

  const { sql, closeDb } = (await import(appModule("packages/backend/src/db.ts"))) as typeof import("../../packages/backend/src/db.ts");
  let capture: ResponseCapture | undefined;
  let outDir: string | undefined;
  let dispatches = 0;
  const requests: Array<{ sourceId: string; type: "list" | "detail"; expectedUrl: string; ordinal: number }> = [];
  const results: Array<Record<string, unknown>> = [];
  try {
    const dbUrlString = process.env.DATABASE_URL;
    if (!dbUrlString) throw new Error("DATABASE_URL is required in the API operator environment");
    const dbUrl = new URL(dbUrlString);
    const dbName = decodeURIComponent(dbUrl.pathname.replace(/^\//u, ""));
    const stagingTarget = dbName === "fiscalhot_staging" && dbUrl.hostname === "db";
    const testTarget = /^[a-z0-9_]+_(?:test|ci)$/iu.test(dbName) && ["127.0.0.1", "localhost", "::1"].includes(dbUrl.hostname.replace(/^\[|\]$/gu, ""));
    if (!stagingTarget && !testTarget) throw new Error("database target must be exact fiscalhot_staging on compose host db, or loopback *_test/*_ci");
    const dbIdentity = (await sql`SELECT current_database() AS database, inet_server_addr()::text AS address, inet_server_port() AS port`)[0]!;
    if (dbIdentity.database !== dbName || (stagingTarget && dbUrl.hostname !== "db") || (testTarget && !["127.0.0.1", "::1"].includes(String(dbIdentity.address).replace(/^\[|\]$/gu, "")))) {
      throw new Error("connected database identity differs from the exact allowed target");
    }
    const ids = sourcePlan.map((source) => source.id);
    const dbSources = await sql<Array<SourceRow & { source_row_text: string; site_fulltext: boolean; syndicate_fulltext: boolean; name: string }>>`
      SELECT s.*, to_jsonb(s)::text AS source_row_text FROM sources s WHERE s.id = ANY(${ids}) ORDER BY s.id`;
    if (dbSources.length !== sourcePlan.length) throw new Error("one or more configured source rows are missing in target database");
    const catalogById = new Map(CATALOG.sources.map((source) => [source.id, source]));
    const sourceById = new Map(dbSources.map((row) => [row.id, row]));
    for (const row of dbSources) {
      const catalog = catalogById.get(row.id)!;
      if (row.kind !== catalog.kind || row.name !== catalog.name || stableJson(row.config) !== stableJson(catalog.config) ||
          row.enabled !== false || row.site_fulltext !== false || row.syndicate_fulltext !== false) {
        throw new Error(`source config or safety flags differ from fixed catalog: ${row.id}`);
      }
    }
    if (!args["run-id"] || !/^[a-z0-9][a-z0-9_-]{2,80}$/iu.test(args["run-id"])) throw new Error("--execute requires a fresh safe --run-id");
    const runRoot = "/data/operators/runs";
    mkdirSync(runRoot, { recursive: true, mode: 0o700 });
    outDir = path.join(runRoot, String(args["run-id"]));
    mkdirSync(outDir, { recursive: false, mode: 0o700 });
    const responseDir = path.join(outDir, "responses");
    mkdirSync(responseDir, { recursive: false, mode: 0o700 });
    capture = new ResponseCapture(responseDir);
    const { fetchWebList, allowed, fetchDetail } = (await import(appModule("packages/backend/src/sources/web-list.ts"))) as typeof import("../../packages/backend/src/sources/web-list.ts");
    const { fetchJsonList } = (await import(appModule("packages/backend/src/sources/json-list.ts"))) as typeof import("../../packages/backend/src/sources/json-list.ts");
    const { identityKeyFor, upsertMaterial } = (await import(appModule("packages/backend/src/content/materials.ts"))) as typeof import("../../packages/backend/src/content/materials.ts");
    const { noiseFiltered } = (await import(appModule("packages/backend/src/sources/collect.ts"))) as typeof import("../../packages/backend/src/sources/collect.ts");
    const runId = String(args["run-id"]);
    const manifestPath = path.join(outDir, "scope.json");
    const scope = { schemaVersion: "nas-candidate-batch.v1", runId, database: dbName, startedAt,
      catalogSha256, operatorSha256, fixedAppSha: FIXED_APP_SHA, sourceIds, maxNewPerSource, maxNewTotal: totalNewCap, maxDetailsTotal: totalDetailCap,
      minIntervalMs: MIN_INTERVAL_MS, limits: { listGetsPerSource: 1, maxRedirects: 0, retries: 0, maxBodyBytes: MAX_CAPTURE_BYTES },
      sources: sourcePlan.map((p) => ({ ...p, sourceRowSha256: sha256(sourceById.get(p.id)!.source_row_text) })) };
    writeFileSync(manifestPath, `${JSON.stringify(scope, null, 2)}\n`, { flag: "wx", mode: 0o600 });

    let lastDispatchAt = 0;
    const runBudget = (source: SourceRow, expectedUrl: string, sourceId: string, type: "list" | "detail") => ({
      signal: AbortSignal.timeout(20_000),
      beforeDispatch({ url, method, redirectHop }: { url: URL; method: string; redirectHop: number }) {
        const wait = MIN_INTERVAL_MS - (Date.now() - lastDispatchAt);
        if (wait > 0) throw new Error("dispatch rate guard rejected an early request");
        if (dispatches >= MAX_DISPATCHES || method !== "GET" || redirectHop !== 0 || url.href !== expectedUrl ||
            !allowed(url.href, source) || !source.config.allowUrlPrefixes.some((prefix: string) => url.href.startsWith(prefix))) {
          throw new Error(`network scope rejected request for ${sourceId}`);
        }
        lastDispatchAt = Date.now();
        dispatches++;
        requests.push({ sourceId, type, expectedUrl, ordinal: dispatches });
      },
      allowRedirect() { return false; },
    });
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    let globalDetails = 0;
    let globalNew = 0;
    const alreadyCreated = new Set<string>();
    for (let sourceIndex = 0; sourceIndex < sourcePlan.length; sourceIndex++) {
      const planRow = sourcePlan[sourceIndex]!;
      if (dispatches > 0) await sleep(Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastDispatchAt)));
      const source = sourceById.get(planRow.id)!;
      const responseStart = capture.rows.length;
      const dispatchesBeforeSource = dispatches;
      const beforeRowText = source.source_row_text;
      let phase: "list" | "detail" | "write" = "list";
      try {
        const listBefore = dispatches;
        const candidates = source.kind === "web_list"
          ? await fetchWebList(source, { listUrl: planRow.url, runBudget: runBudget(source, planRow.url, source.id, "list") })
          : await fetchJsonList(source, { runBudget: runBudget(source, planRow.url, source.id, "list") });
        if (dispatches !== listBefore + 1) throw new Error("configured list did not dispatch exactly once");
        const listRaw = capture.rows.at(-1)!;
        if (!listRaw || listRaw.status !== 200 || !listRaw.eof || listRaw.truncated || !listRaw.file) throw new Error("list response was not HTTP 200 with complete bounded raw capture");
        const candidateIdentities = [...new Set(candidates.map((candidate) => identityKeyFor({ ...candidate, sourceId: source.id, via: "fetch" })))];
        const knownRows = candidateIdentities.length
          ? await sql<{ identity_key: string }[]>`SELECT identity_key FROM articles WHERE identity_key = ANY(${sql(candidateIdentities)})`
          : [];
        const known = new Set(knownRows.map((row) => row.identity_key));
        const filtered = candidates.filter((candidate) => allowed(candidate.url, source) && !noiseFiltered(candidate, source));
        const firstImportMonths = Number(source.config._aihot?.initialBackfillMonths ?? 3);
        const cutoff = Date.now() - Math.max(1, firstImportMonths) * 30 * 86_400_000;
        const result = classifyCandidates({ candidates: filtered, source, knownIdentities: known,
          identityKeyFor, allowed, rewrite: source.config.itemUrlPrefixRewrite, maxNew: Math.max(0, Math.min(planRow.maxNew, totalNewCap - globalNew)),
          inWindow: (candidate) => {
            if (!candidate.publishedAt) return source.config._aihot?.initialBackfillRequirePublishedAt !== true;
            const date = candidate.publishedAt instanceof Date ? candidate.publishedAt : new Date(candidate.publishedAt as never);
            return Number.isFinite(date.getTime()) && date.getTime() <= Date.now() && date.getTime() >= cutoff;
          } });
        phase = "detail";
        const detailTargets: Array<{ identityKey: string; candidate: Candidate; got?: Awaited<ReturnType<typeof fetchDetail>>; bodyOk?: boolean; hold?: string }> =
          result.eligible.map((item) => ({ ...item }));
        let detailUsed = 0;
        let detailFailure: string | null = null;
        for (const target of detailTargets) {
          if (globalDetails >= totalDetailCap || detailUsed >= planRow.maxDetails || !detailConfigIsDirectHtml(source) || target.candidate.attachmentDiagnostic ||
              /\.pdf(?:$|[?#])/iu.test(target.candidate.url) || alreadyCreated.has(target.identityKey)) continue;
          const url = target.candidate.url;
          let parsed: URL;
          try { parsed = new URL(url); } catch { target.hold = "invalid_detail_url"; continue; }
          if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash || !allowed(url, source) ||
              !source.config.allowUrlPrefixes.some((prefix: string) => url.startsWith(prefix))) { target.hold = "detail_url_outside_allowlist"; continue; }
          if (detailUsed > 0 || dispatches > 0) await sleep(Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastDispatchAt)));
          const detailBefore = dispatches;
          detailUsed++;
          globalDetails++;
          try {
            target.got = await fetchDetail(url, source, { date: true, title: true, summary: false, body: true,
              expectedTitle: target.candidate.title, expectedPublishedAt: target.candidate.publishedAt ?? null },
            { runBudget: runBudget(source, url, source.id, "detail") });
            const raw = capture.rows.at(-1);
            if (dispatches !== detailBefore + 1 || !raw || raw.status !== 200 || !raw.eof || raw.truncated || !raw.file) {
              throw new Error("detail response was not one HTTP 200 with complete bounded raw capture");
            }
            const got = target.got;
            if (!got.body?.text?.trim() || !got.body.html?.trim()) target.hold = "configured_body_selector_not_confirmed";
            else if (!got.title) target.hold = "detail_title_unconfirmed";
            else if (got.title.trim().normalize("NFKC") !== target.candidate.title.trim().normalize("NFKC")) target.hold = "detail_title_mismatch";
            else if (!got.publishedAt) target.hold = "detail_date_unconfirmed";
            else if (target.candidate.publishedAt &&
              !sameConfiguredDay(target.candidate.publishedAt, got.publishedAt, String(source.config.detail.publishedAtUtcOffset ?? source.config.publishedAtUtcOffset ?? "+08:00"))) target.hold = "detail_date_mismatch";
            else target.bodyOk = !target.hold;
            if (target.bodyOk && got.publishedAt) target.candidate.publishedAt = got.publishedAt;
          } catch (error) {
            detailFailure = String(error instanceof Error ? error.message : error).slice(0, 500);
            target.hold = "detail_request_failed";
            break;
          }
        }

        phase = "write";
        const writeResult = await sql.begin(async (tx) => {
          const [current] = await tx<{ source_row_text: string; enabled: boolean; site_fulltext: boolean; syndicate_fulltext: boolean }[]>`
            SELECT to_jsonb(s)::text AS source_row_text, s.enabled, s.site_fulltext, s.syndicate_fulltext FROM sources s WHERE s.id = ${source.id} FOR UPDATE`;
          if (!current || current.source_row_text !== beforeRowText || current.enabled !== false || current.site_fulltext !== false || current.syndicate_fulltext !== false) {
            throw new Error(`source row/config/cursor/flags changed before write: ${source.id}`);
          }
          let created = 0, held = 0, knownAtCommit = 0;
          const items: Array<Record<string, unknown>> = [];
          for (const target of detailTargets) {
            const globalDuplicate = alreadyCreated.has(target.identityKey);
            if (globalDuplicate) { knownAtCommit++; continue; }
            const [existing] = await tx<{ identity_key: string }[]>`SELECT identity_key FROM articles WHERE identity_key = ${target.identityKey} FOR SHARE`;
            if (existing) throw new Error(`identity appeared concurrently; source transaction rolled back: ${source.id}`);
            const attachmentDiagnostic = target.candidate.attachmentDiagnostic ?? target.got?.attachmentDiagnostic;
            const material = { ...target.candidate, raw: undefined, media: [], sourceId: source.id, via: "fetch" as const, backfill: null,
              bodyHtml: target.bodyOk ? target.got?.body?.html ?? null : null,
              bodyText: target.bodyOk ? target.got?.body?.text ?? null : null,
              attachmentDiagnostic,
              bodyStatus: target.bodyOk ? "ok" as const : attachmentDiagnostic ? "unconfirmed" as const : "pending" as const };
            const saved = await upsertMaterial(material, tx);
            if (!saved.created) throw new Error(`canonical material insert did not create a new identity: ${source.id}`);
            created++;
            items.push({ articleId: saved.articleId, identityKey: target.identityKey, url: target.candidate.url,
              title: target.candidate.title, publishedAt: target.candidate.publishedAt?.toISOString() ?? null,
              bodyStatus: material.bodyStatus, bodySha256: material.bodyText ? sha256(material.bodyText) : null,
              detailHold: target.hold ?? null });
            if (target.hold) held++;
          }
          return { created, held, knownAtCommit, items };
        });
        for (const item of writeResult.items) alreadyCreated.add(String(item.identityKey));
        globalNew += writeResult.created;
        const decodedText = decodeCapturedBody(readFileSync(path.join(outDir!, String(listRaw.file))), listRaw.contentType);
        results.push({ sourceId: source.id, status: "ok", dispatches: dispatches - dispatchesBeforeSource, listDispatches: 1, listResponse: { status: listRaw.status, bytes: listRaw.bytes,
          rawSha256: listRaw.sha256, eof: listRaw.eof, rawFile: listRaw.file, decodedUtf8Sha256: sha256(decodedText),
          contentType: listRaw.contentType, contentEncoding: listRaw.contentEncoding, finalUrl: listRaw.url },
          found: candidates.length, eligibleNew: result.eligible.length, known: result.known, duplicate: result.duplicate, parseHeld: result.held,
          capped: result.capped, cap: planRow.maxNew, detailsAttempted: capture.rows.slice(responseStart + 1).length,
          detailFailure, ...writeResult });
      } catch (error) {
        results.push({ sourceId: source.id, status: "failed", dispatches: dispatches - dispatchesBeforeSource,
          phase,
          error: String(error instanceof Error ? error.message : error).slice(0, 800), raw: capture.rows.slice(responseStart).map((row) => ({ ordinal: row.ordinal,
            method: row.method, url: row.url, status: row.status, bytes: row.bytes, sha256: row.sha256, eof: row.eof, file: row.file, error: row.error })) });
        if (phase !== "list") break;
      }
    }
    const report = { schemaVersion: "nas-candidate-batch-result.v1", model: "gpt-6-luna high", providerCalls: 0,
      runId: String(args["run-id"]), operatorSha256, fixedAppSha: FIXED_APP_SHA, startedAt,
      completedAt: new Date().toISOString(), database: dbName, catalogSha256, sourceIds,
      limits: { maxDispatches: MAX_DISPATCHES, maxNewPerSource, maxNewTotal: totalNewCap, maxDetailsTotal: totalDetailCap, minIntervalMs: MIN_INTERVAL_MS,
        redirects: 0, retries: 0, queueProcessing: false, collectSource: false, sourceWrites: false },
      flags: Object.fromEntries(["COLLECT_ENABLED", "MODEL_CALLS_ENABLED", "JINA_BODY_FALLBACK", "FEISHU_CONTENT_PUSH_ENABLED",
        "FEISHU_INTERNAL_ENABLED", "INDEXNOW_SUBMIT_ENABLED", "EMBEDDINGS_ENABLED", "OCR_RUN_ENABLED", "WORKER_ENABLED"].map((key) => [key, process.env[key]])),
      requests: requests.map((request) => ({ ...request })),
      responseRaw: capture.rows.map(({ rawRequestUrl: _rawRequestUrl, ...row }) => ({ ...row,
        decodedTextSha256: row.file ? sha256(decodeCapturedBody(readFileSync(path.join(outDir!, row.file)), row.contentType)) : null })), results,
      totals: { sources: sourceIds.length, ok: results.filter((r) => r.status === "ok").length,
        failed: results.filter((r) => r.status === "failed").length,
        newArticles: results.reduce((sum, r) => sum + Number(r.created ?? 0), 0),
        detailsAttempted: requests.filter((r) => r.type === "detail").length } };
    writeFileSync(path.join(outDir, "result.json"), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ result: "COMPLETE", runId: args["run-id"], totals: report.totals, evidenceDir: outDir }, null, 2));
  } catch (error) {
    if (outDir) {
      try {
        writeFileSync(path.join(outDir, "aborted.json"), `${JSON.stringify({ schemaVersion: "nas-candidate-batch-abort.v1",
          runId: args["run-id"] ?? null, operatorSha256, fixedAppSha: FIXED_APP_SHA, startedAt, abortedAt: new Date().toISOString(), dispatches,
          requests, responseRaw: capture?.rows.map(({ rawRequestUrl: _rawRequestUrl, ...row }) => ({ ...row,
            decodedTextSha256: row.file ? sha256(decodeCapturedBody(readFileSync(path.join(outDir!, row.file)), row.contentType)) : null })) ?? [], results,
          error: String(error instanceof Error ? error.message : error).slice(0, 800) }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
      } catch { /* preserve the first evidence file; never overwrite */ }
    }
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    capture?.close();
    await closeDb();
  }
}

const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url : false;
if (invoked) await main();
