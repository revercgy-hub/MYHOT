import diagnosticsChannel from "node:diagnostics_channel";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { decodeContentEncoding, readBoundedFile } from "./p3-content-encoding.ts";
import { installP3HttpBudget } from "./p3-http-budget.ts";
import { sha256, stableJson } from "../../packages/backend/src/lib/ids.ts";
import type { SourceRow } from "../../packages/backend/src/sources/types.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const LOCK_DIR = path.join(REPO_ROOT, ".data", "fiscal-qa", "locks");
const MAX_SOURCES = 4;
const MAX_PAGES = 2;
const PER_SOURCE_DISPATCH_CAP = 12;
const GLOBAL_DISPATCH_CAP = 48;
const MIN_DISPATCH_INTERVAL_MS = 1_000;
const ACTIVE_WAIT_MS = 1_100;
const MAX_CAPTURE_BYTES = 6 * 1024 * 1024;
const DISABLED_FLAGS = [
  "COLLECT_ENABLED", "MODEL_CALLS_ENABLED", "INDEXNOW_SUBMIT_ENABLED", "FEISHU_CONTENT_PUSH_ENABLED",
  "FEISHU_INTERNAL_ENABLED", "EMBEDDINGS_ENABLED", "OCR_RUN_ENABLED", "JINA_BODY_FALLBACK", "ALLOW_PRIVATE_NETWORK_FETCH",
] as const;
const PROXY_FLAGS = ["EGRESS_PROXY_URL", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"] as const;

function continuationPageUrl(listUrl: string, pageIndex: number): string {
  if (!Number.isSafeInteger(pageIndex) || pageIndex < 0 || pageIndex > 100) throw new Error("invalid web-list page index");
  return pageIndex === 0 ? listUrl : new URL(`index_${pageIndex}.htm`, listUrl).toString();
}

export interface PaginationContinuationDatabase {
  name: string;
  address: string;
  port: number;
  migrations: number;
}

export interface PaginationContinuationSource {
  id: string;
  configSha256: string;
  adapterConfigHash: string;
  enabled: false;
  siteFulltext: false;
  syndicateFulltext: false;
  cursor: Record<string, unknown>;
  listUrl: string;
  allowUrlPrefixes: string[];
  pageIndices: number[];
  pageUrls: string[];
  host: string;
  pathPrefix: string;
  maxPageIndex: number;
}

export interface PaginationContinuationScope {
  v: 1;
  createdAtUtc: string;
  databaseUrlSha256: string;
  database: PaginationContinuationDatabase;
  sourceIds: string[];
  sources: PaginationContinuationSource[];
  limits: {
    pagesPerSource: 2;
    perSourceDispatchCap: 12;
    globalDispatchCap: 48;
    minDispatchIntervalMs: 1_000;
    activeWaitMs: 1_100;
    maxCapturedResponseBytes: 6_291_456;
  };
  baselineCounts: Record<string, number>;
}

export interface ContinuationDispatch {
  origin: string;
  path: string;
  method: string;
}

export function parseExplicitSourceIds(value: string): string[] {
  const ids = value.split(",").map((id) => id.trim());
  if (!ids.length || ids.length > MAX_SOURCES || ids.some((id) => !/^[a-z0-9][a-z0-9_-]{0,79}$/iu.test(id))) {
    throw new Error(`--source-ids must contain 1-${MAX_SOURCES} explicit valid source IDs`);
  }
  if (new Set(ids).size !== ids.length) throw new Error("--source-ids cannot contain duplicates");
  return ids;
}

export function assertLoopbackTestDatabase(databaseUrl: string): { name: string; address: string; port: number } {
  let parsed: URL;
  try { parsed = new URL(databaseUrl); } catch { throw new Error("--database-url must identify a loopback *_test database"); }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !["127.0.0.1", "::1", "localhost"].includes(host)) {
    throw new Error("--database-url must use a loopback PostgreSQL host");
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\//u, ""));
  if (!/^[A-Za-z0-9_]+_test$/u.test(name)) throw new Error("database name must be a safe ASCII identifier ending in _test");
  const port = parsed.port ? Number(parsed.port) : 5432;
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) throw new Error("database port is invalid");
  return { name, address: host === "localhost" ? "127.0.0.1" : host, port };
}

export function canonicalScopeSha256(scope: unknown): string {
  return sha256(stableJson(scope));
}

export function validateContinuationScope(scope: unknown, expectedSha256: string): PaginationContinuationScope {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) throw new Error("scope must be a JSON object");
  const value = scope as PaginationContinuationScope;
  if (value.v !== 1 || !/^[a-f\d]{64}$/iu.test(expectedSha256) || canonicalScopeSha256(value) !== expectedSha256.toLowerCase()) {
    throw new Error("scope hash or schema version mismatch");
  }
  if (!/^[a-f\d]{64}$/iu.test(value.databaseUrlSha256) || !/^[A-Za-z0-9_]+_test$/u.test(value.database.name) ||
      !["127.0.0.1", "::1"].includes(value.database.address) || !Number.isSafeInteger(value.database.port) || value.database.port < 1 ||
      value.database.port > 65_535 || value.database.migrations !== 35 ||
      !isDeepStrictEqual(value.limits, { pagesPerSource: MAX_PAGES, perSourceDispatchCap: PER_SOURCE_DISPATCH_CAP,
        globalDispatchCap: GLOBAL_DISPATCH_CAP, minDispatchIntervalMs: MIN_DISPATCH_INTERVAL_MS,
        activeWaitMs: ACTIVE_WAIT_MS, maxCapturedResponseBytes: MAX_CAPTURE_BYTES })) {
    throw new Error("scope database identity or migration count is invalid");
  }
  const ids = parseExplicitSourceIds(value.sourceIds.join(","));
  if (ids.length !== value.sources.length || !isDeepStrictEqual(ids, value.sources.map((source) => source.id))) {
    throw new Error("scope source IDs do not match source snapshots");
  }
  for (const source of value.sources) {
    const cursor = source.cursor as { webListBackfill?: Record<string, unknown> } | null;
    const backfill = cursor?.webListBackfill;
    const start = backfill?.nextPageIndex;
    const expectedIndices = Number.isSafeInteger(start) && Number(start) >= 0
      ? Array.from({ length: Math.min(MAX_PAGES, Math.max(0, source.maxPageIndex - Number(start) + 1)) }, (_item, index) => Number(start) + index)
      : [];
    if (source.enabled !== false || source.siteFulltext !== false || source.syndicateFulltext !== false ||
        !/^[a-f\d]{64}$/iu.test(source.configSha256) || !/^[a-f\d]{64}$/iu.test(source.adapterConfigHash) ||
        !backfill || backfill.state !== "active" || backfill.coverage !== "unproven" ||
        !Number.isSafeInteger(start) || Number(start) < 0 || backfill.pagesCommitted !== start ||
        typeof backfill.generationId !== "string" || typeof backfill.anchorAt !== "string" || typeof backfill.cutoffAt !== "string" ||
        backfill.pendingPage !== undefined || source.pageIndices.join(",") !== expectedIndices.join(",") ||
        source.pageUrls.length !== expectedIndices.length || source.pageUrls.some((url, index) => url !== continuationPageUrl(source.listUrl, expectedIndices[index]!)) ||
        backfill.configHash !== source.adapterConfigHash) {
      throw new Error(`scope cursor, flags, or page range is invalid for ${source.id}`);
    }
  }
  return value;
}

export function isAllowedContinuationDispatch(source: PaginationContinuationSource, dispatch: ContinuationDispatch, parsedMetadataUrls: ReadonlySet<string> = new Set()): boolean {
  if (String(dispatch.method).toUpperCase() !== "GET") return false;
  let url: URL;
  try { url = new URL(dispatch.path, dispatch.origin); } catch { return false; }
  let origin: URL;
  try { origin = new URL(source.listUrl); } catch { return false; }
  if (url.protocol !== "https:" || url.origin !== origin.origin || url.search || url.hash || url.username || url.password) return false;
  if (source.pageUrls.includes(url.toString())) return true;
  if (!url.pathname.startsWith(source.pathPrefix) || /\/index_\d+\.htm$/iu.test(url.pathname) || !parsedMetadataUrls.has(url.toString())) return false;
  return source.allowUrlPrefixes.some((prefix) => {
    try { const allowedPrefix = new URL(prefix); return allowedPrefix.origin === url.origin && url.pathname.startsWith(allowedPrefix.pathname); }
    catch { return false; }
  });
}

function timestamp(): string { return new Date().toISOString().replace(/[:.]/gu, "-"); }
function sourceSha(source: SourceRow): string { return sha256(stableJson(source.config)); }
function listUrl(row: SourceRow): string { return String(row.config.url ?? ""); }
function sourceTargetMatchesScope(source: PaginationContinuationSource, row: SourceRow): boolean {
  try {
    const configuredUrl = String(row.config.url ?? "");
    const url = new URL(configuredUrl);
    const derivedDirectory = `${url.origin}${url.pathname}`;
    return configuredUrl === source.listUrl && derivedDirectory === source.listUrl &&
      Array.isArray(row.config.allowUrlPrefixes) && isDeepStrictEqual(row.config.allowUrlPrefixes, source.allowUrlPrefixes);
  } catch { return false; }
}

async function readBaseline(tx: any, sourceIds: string[]): Promise<{ counts: Record<string, number>; bodyCounts: unknown[]; jobCounts: unknown[] }> {
  const [counts] = await tx`
    SELECT (SELECT count(*)::int FROM schema_migrations) AS migrations,
      (SELECT count(*)::int FROM sources) AS sources,
      (SELECT count(*)::int FROM articles) AS articles,
      (SELECT count(*)::int FROM fetch_runs) AS fetch_runs,
      (SELECT count(*)::int FROM article_revisions) AS revisions,
      (SELECT count(*)::int FROM article_discoveries) AS discoveries,
      (SELECT count(*)::int FROM analyses) AS analyses,
      (SELECT count(*)::int FROM receipts) AS receipts,
      (SELECT count(*)::int FROM publications) AS publications,
      (SELECT count(*)::int FROM selected_ledger) AS selected,
      (SELECT count(*)::int FROM job_runs) AS job_runs`;
  const bodyCounts = await tx`SELECT source_id,body_status,count(*)::int AS count FROM articles WHERE source_id=ANY(${sourceIds}) GROUP BY source_id,body_status ORDER BY source_id,body_status`;
  const jobsPresent = Boolean((await tx`SELECT to_regclass('pgboss.job') IS NOT NULL AS present`)[0]?.present);
  const jobCounts = jobsPresent ? await tx`SELECT j.name,j.state,count(*)::int AS count,
      count(*) FILTER (WHERE j.started_on IS NOT NULL)::int AS started
    FROM pgboss.job j LEFT JOIN articles a ON a.id=j.data->>'articleId'
    WHERE a.source_id=ANY(${sourceIds}) GROUP BY j.name,j.state ORDER BY j.name,j.state` : [];
  return { counts, bodyCounts, jobCounts };
}

export async function buildContinuationScope(databaseUrl: string, sourceIds: string[]) {
  const db = assertLoopbackTestDatabase(databaseUrl);
  const ids = parseExplicitSourceIds(sourceIds.join(","));
  for (const flag of DISABLED_FLAGS) process.env[flag] = "false";
  process.env.DATABASE_URL = databaseUrl;
  const { validateWebListPagination, webListPaginationConfigHash } = await import("../../packages/backend/src/sources/web-list-pagination.ts");
  const { sql, closeDb } = await import("../../packages/backend/src/db.ts");
  try {
    return await sql.begin(async (tx) => {
      await tx`SET TRANSACTION READ ONLY`;
      const [identity] = await tx`SELECT current_database() AS name, host(inet_server_addr()) AS address, inet_server_port() AS port`;
      if (identity.name !== db.name || identity.address !== db.address || Number(identity.port) !== db.port) throw new Error("connected database identity differs from --database-url");
      const [migrationRow] = await tx`SELECT count(*)::int AS count FROM schema_migrations`;
      const migrations = Number(migrationRow.count);
      if (migrations !== 35) throw new Error("pagination continuation requires exactly 35 migrations");
      const rows = await tx`SELECT id,name,kind,config,cursor,enabled,site_fulltext,syndicate_fulltext FROM sources WHERE id=ANY(${ids}) ORDER BY array_position(${ids},id)` as Array<SourceRow & { site_fulltext: boolean; syndicate_fulltext: boolean }>;
      if (rows.length !== ids.length) throw new Error("one or more explicit source IDs were not found");
      const baseline = await readBaseline(tx, ids);
      const sources: PaginationContinuationSource[] = rows.map((row) => {
        const cfg = row.config ?? {};
        const pagination = cfg.pagination;
        const list = listUrl(row);
        const url = new URL(list);
        const paginationErrors = validateWebListPagination(row.kind, cfg);
        if (paginationErrors.length) throw new Error(`source pagination config is invalid for ${row.id}: ${paginationErrors.join(", ")}`);
        const cursor = row.cursor as Record<string, unknown> | null;
        const backfill = cursor?.webListBackfill as Record<string, unknown> | undefined;
        const start = Number(backfill?.nextPageIndex);
        const maxPageIndex = Number(pagination?.maxPageIndex);
        if (row.kind !== "web_list" || row.enabled || row.site_fulltext || row.syndicate_fulltext ||
            pagination?.mode !== "mof_index_v1" || !Number.isSafeInteger(maxPageIndex) || maxPageIndex < start ||
            Number(pagination?.maxPagesPerRun) < 1 || Number(pagination.maxPagesPerRun) > MAX_PAGES ||
            Number(pagination?.maxDispatches) < 1 || Number(pagination.maxDispatches) > PER_SOURCE_DISPATCH_CAP ||
            !backfill || backfill.state !== "active" || backfill.coverage !== "unproven" || backfill.pendingPage !== undefined ||
            backfill.pagesCommitted !== start || !Number.isSafeInteger(start) || !Number.isFinite(Date.parse(String(backfill.anchorAt))) ||
            !Number.isFinite(Date.parse(String(backfill.cutoffAt)) ) ||
            (pagination.detailMode !== undefined && pagination.detailMode !== "direct_html_metadata_v1") ||
            cfg.detail?.pdfDirect === true || cfg.detail?.attachmentSelector || cfg.detail?.attachmentScopeSelector ||
            cfg.detail?.attachmentMode || !Array.isArray(cfg.allowUrlPrefixes) || cfg.allowUrlPrefixes.length !== 1 ||
            cfg.allowUrlPrefixes[0] !== list || url.protocol !== "https:") {
          throw new Error(`source is not a disabled metadata-only bounded pagination source: ${row.id}`);
        }
        if (pagination.detailMode === "direct_html_metadata_v1" && (!Number.isSafeInteger(cfg.detail?.maxFetches) ||
            cfg.detail.maxFetches < 1 || cfg.detail.maxFetches > 10 ||
            ![cfg.detail?.publishedAtSelector, cfg.detail?.publishedAtRegex, cfg.detail?.titleSelector, cfg.detail?.titleRegex].some(Boolean))) {
          throw new Error(`metadata-only detail mode requires a bounded configured HTML rule: ${row.id}`);
        }
        const pageIndices = Array.from({ length: Math.min(MAX_PAGES, maxPageIndex - start + 1) }, (_item, index) => start + index);
        if (!pageIndices.length) throw new Error(`source cursor is at its configured terminal page: ${row.id}`);
        const source = row as SourceRow;
        return {
          id: row.id,
          configSha256: sourceSha(source),
          adapterConfigHash: webListPaginationConfigHash(source),
          enabled: false,
          siteFulltext: false,
          syndicateFulltext: false,
          cursor: structuredClone(cursor ?? {}),
          listUrl: list,
          allowUrlPrefixes: [...cfg.allowUrlPrefixes],
          pageIndices,
          pageUrls: pageIndices.map((index) => continuationPageUrl(list, index)),
          host: url.hostname,
          pathPrefix: url.pathname,
          maxPageIndex,
        };
      });
      return {
        v: 1 as const,
        createdAtUtc: new Date().toISOString(),
        databaseUrlSha256: sha256(databaseUrl),
        database: { name: identity.name, address: identity.address, port: Number(identity.port), migrations },
        sourceIds: ids,
        sources,
        limits: {
          pagesPerSource: 2 as const,
          perSourceDispatchCap: 12 as const,
          globalDispatchCap: 48 as const,
          minDispatchIntervalMs: 1_000 as const,
          activeWaitMs: 1_100 as const,
          maxCapturedResponseBytes: 6_291_456,
        },
        baselineCounts: baseline.counts,
      } satisfies PaginationContinuationScope;
    });
  } finally { await closeDb(); }
}

function safeOutDir(value: string): string {
  const outDir = path.resolve(REPO_ROOT, value);
  const base = path.join(REPO_ROOT, ".data", "fiscal-qa");
  if (outDir === base || !outDir.startsWith(`${base}${path.sep}`)) throw new Error("--out-dir must be inside .data/fiscal-qa/<scope>");
  return outDir;
}

async function writeExclusive(filePath: string, contents: string): Promise<void> {
  const handle = await open(filePath, "wx", 0o600);
  try { await handle.writeFile(contents, "utf8"); } finally { await handle.close(); }
}

function safeRequestPath(value: unknown): string { return String(value ?? "").split(/[?#]/u, 1)[0]; }
function sourceForUrl(scope: PaginationContinuationScope, originValue: unknown, pathValue: unknown): PaginationContinuationSource | null {
  try {
    const url = new URL(String(pathValue), String(originValue));
    const exactPage = scope.sources.find((source) => source.pageUrls.includes(url.toString()));
    if (exactPage) return exactPage;
    const matches = scope.sources.filter((source) => url.protocol === "https:" && url.hostname === source.host && url.pathname.startsWith(source.pathPrefix));
    return matches.length === 1 ? matches[0]! : null;
  } catch { return null; }
}

async function executeScope(scopePath: string, expectedSha: string, outDirPath: string) {
  const fullScopePath = path.resolve(scopePath);
  const scope = validateContinuationScope(JSON.parse(readFileSync(fullScopePath, "utf8")), expectedSha);
  const databaseUrl = process.env.P3_TEST_DATABASE_URL ?? "";
  const expectedDb = assertLoopbackTestDatabase(databaseUrl);
  if (sha256(databaseUrl) !== scope.databaseUrlSha256) throw new Error("P3_TEST_DATABASE_URL must exactly match the frozen scope database URL");
  if (process.env.DATABASE_URL && sha256(process.env.DATABASE_URL) !== scope.databaseUrlSha256) throw new Error("DATABASE_URL must exactly match the frozen scope database URL");
  const outDir = safeOutDir(outDirPath);
  mkdirSync(outDir, { recursive: true });
  const rawDir = path.join(outDir, "responses");
  mkdirSync(rawDir, { recursive: false });
  mkdirSync(LOCK_DIR, { recursive: true });
  const lockPath = path.join(LOCK_DIR, `${expectedDb.name}.pagination.lock`);
  const claimPath = path.join(LOCK_DIR, `${expectedDb.name}.pagination-${expectedSha}.claim`);
  let lockHandle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    lockHandle = await open(lockPath, "wx", 0o600);
    await lockHandle.writeFile(JSON.stringify({ pid: process.pid, startedAtUtc: new Date().toISOString(), database: expectedDb.name, scopeSha256: expectedSha }), "utf8");
  } catch (error) {
    await lockHandle?.close().catch(() => {});
    lockHandle = null;
    throw new Error(`database pagination lock is held or stale: ${lockPath}`, { cause: error });
  }
  try {
    await writeExclusive(claimPath, `${JSON.stringify({ claimedAtUtc: new Date().toISOString(), scopeSha256: expectedSha, outDir }, null, 2)}\n`);
    const startedAtUtc = new Date().toISOString();
    await writeExclusive(path.join(outDir, "execution-started.json"), `${JSON.stringify({ startedAtUtc, scopeSha256: expectedSha, database: scope.database }, null, 2)}\n`);
    for (const flag of DISABLED_FLAGS) process.env[flag] = "false";
    process.env.COLLECT_SKIP_JINA = "true";
    process.env.DATABASE_URL = databaseUrl;
    for (const key of PROXY_FLAGS) delete process.env[key];

    const { sql, closeDb } = await import("../../packages/backend/src/db.ts");
    const { validateWebListPagination, webListPaginationConfigHash } = await import("../../packages/backend/src/sources/web-list-pagination.ts");
    const queue = await import("../../packages/backend/src/jobs/queue.ts");
    const { collectSource } = await import("../../packages/backend/src/sources/collect.ts");
    const { fromHtml } = await import("../../packages/backend/src/sources/web-list.ts");
    const requireBackend = createRequire(path.resolve(REPO_ROOT, "packages/backend/src/lib/http-fetch.ts"));
    const undici = requireBackend("undici") as { Agent: { prototype: { dispatch: (...args: any[]) => unknown } }; ProxyAgent: { prototype: { dispatch: (...args: any[]) => unknown } } };
    const prototypes = [undici.Agent.prototype, undici.ProxyAgent.prototype];
    const actualDispatches: Array<Record<string, unknown>> = [];
    const requestRows: Array<Record<string, any>> = [];
    const sourceConfigById = new Map<string, Record<string, any>>();
    const blockedDispatches: Array<Record<string, unknown>> = [];
    const activeRequests = new Set<number>();
    const allowedMetadataUrlsBySource = new Map(scope.sources.map((source) => [source.id, new Set<string>()]));
    let maxConcurrentRequests = 0;
    let activeSource: PaginationContinuationSource | null = null;
    let lastDispatchAt: number | null = null;
    const waitCell = new Int32Array(new SharedArrayBuffer(4));
    const budget = installP3HttpBudget(GLOBAL_DISPATCH_CAP, { minDispatchIntervalMs: MIN_DISPATCH_INTERVAL_MS });
    const originalDispatch = prototypes.map((prototype) => prototype.dispatch);
    const dispatchPacer = (original: (...args: any[]) => unknown) => function (this: unknown, options: any, handler: any) {
      const source = activeSource;
      const url = sourceForUrl(scope, options?.origin, options?.path);
      const allowed = source && url?.id === source.id && isAllowedContinuationDispatch(source, {
        origin: String(options?.origin ?? ""), path: String(options?.path ?? ""), method: String(options?.method ?? ""),
      }, allowedMetadataUrlsBySource.get(source.id));
      if (!allowed) {
        blockedDispatches.push({ atUtc: new Date().toISOString(), sourceId: source?.id ?? null, origin: String(options?.origin ?? ""), path: safeRequestPath(options?.path), method: String(options?.method ?? ""), reason: "outside_frozen_scope" });
        const error = Object.assign(new Error("pagination_continuation_scope_rejected"), { code: "PAGINATION_CONTINUATION_SCOPE_REJECTED" });
        if (typeof handler?.onResponseError === "function") { handler.onResponseError(null, error); return false; }
        throw error;
      }
      const sourceUsed = actualDispatches.filter((row) => row.sourceId === source.id).length;
      if (sourceUsed >= PER_SOURCE_DISPATCH_CAP || budget.snapshot().dispatched >= GLOBAL_DISPATCH_CAP) {
        blockedDispatches.push({ atUtc: new Date().toISOString(), sourceId: source.id, origin: String(options.origin), path: safeRequestPath(options.path), method: String(options.method), reason: "dispatch_cap" });
        const error = Object.assign(new Error("pagination_continuation_dispatch_cap"), { code: "PAGINATION_CONTINUATION_DISPATCH_CAP" });
        if (typeof handler?.onResponseError === "function") { handler.onResponseError(null, error); return false; }
        throw error;
      }
      if (lastDispatchAt !== null) {
        const remaining = ACTIVE_WAIT_MS - (performance.now() - lastDispatchAt);
        if (remaining > 0) Atomics.wait(waitCell, 0, 0, Math.ceil(remaining));
      }
      const monotonicMs = performance.now();
      const started = new Date().toISOString();
      const usedBefore = budget.snapshot().dispatched;
      const result = Reflect.apply(original, this, [options, handler]);
      const usedAfter = budget.snapshot().dispatched;
      if (usedAfter > usedBefore) {
        lastDispatchAt = monotonicMs;
        actualDispatches.push({ sequence: actualDispatches.length + 1, atUtc: started, monotonicMs, sourceId: source.id, origin: String(options.origin), path: safeRequestPath(options.path), method: String(options.method) });
      }
      return result;
    };
    for (let index = 0; index < prototypes.length; index++) Object.defineProperty(prototypes[index], "dispatch", { configurable: true, enumerable: false, writable: true, value: dispatchPacer(originalDispatch[index]!) });

    const channelSubscriptions: Array<() => void> = [];
    const responseByRequest = new WeakMap<object, Record<string, any>>();
    const observe = (name: string, callback: (message: any) => void) => {
      const channel = diagnosticsChannel.channel(name);
      channel.subscribe(callback);
      channelSubscriptions.push(() => channel.unsubscribe(callback));
    };
    observe("undici:request:create", (message) => {
      const request = message?.request;
      if (!request || typeof request !== "object") return;
      const source = sourceForUrl(scope, request.origin, request.path);
      const row = { id: requestRows.length + 1, sourceId: source?.id ?? null, origin: String(request.origin ?? ""), path: safeRequestPath(request.path), method: String(request.method ?? ""), statusCode: null as number | null, headers: {} as Record<string,string>, bytes: 0, capturedBytes: 0, chunks: [] as Buffer[], digest: createHash("sha256"), rawFile: null as string | null, eof: false, truncated: false, finished: false };
      responseByRequest.set(request, row);
      requestRows.push(row);
      activeRequests.add(row.id);
      maxConcurrentRequests = Math.max(maxConcurrentRequests, activeRequests.size);
    });
    observe("undici:request:headers", (message) => {
      const row = message?.request && responseByRequest.get(message.request);
      if (!row || !message.response) return;
      row.statusCode = message.response.statusCode ?? null;
      const pairs = message.response.headers;
      if (Array.isArray(pairs)) for (let index = 0; index + 1 < pairs.length; index += 2) row.headers[String(pairs[index]).toLowerCase()] = String(pairs[index + 1] ?? "");
      else for (const [key, value] of Object.entries(pairs ?? {})) row.headers[key.toLowerCase()] = String(value ?? "");
      row.contentType = row.headers["content-type"] ?? null;
    });
    observe("undici:request:bodyChunkReceived", (message) => {
      const row = message?.request && responseByRequest.get(message.request);
      if (!row || !message.chunk) return;
      const bytes = Buffer.from(message.chunk);
      row.bytes += bytes.length;
      row.digest.update(bytes);
      if (row.capturedBytes + bytes.length <= MAX_CAPTURE_BYTES) { row.chunks.push(bytes); row.capturedBytes += bytes.length; }
      else row.truncated = true;
    });
    const finish = (request: object, eof: boolean) => {
      const row = responseByRequest.get(request);
      if (!row || row.finished) return;
      row.finished = true;
      row.finishedAtUtc = new Date().toISOString();
      row.sha256 = row.digest.digest("hex");
      row.eof = eof && !row.truncated && row.capturedBytes === row.bytes;
      if (row.eof) {
        const filename = `dispatch-${String(row.id).padStart(3, "0")}.body`;
        writeFileSync(path.join(rawDir, filename), Buffer.concat(row.chunks), { flag: "wx" });
        row.rawFile = `responses/${filename}`;
        const source = scope.sources.find((candidate) => candidate.pageUrls.includes(new URL(row.path, row.origin).toString()));
        if (source && row.statusCode === 200 && /^\s*text\/html(?:\s*;|\s*$)/iu.test(String(row.contentType ?? ""))) {
          try {
            const config = sourceConfigById.get(source.id);
            if (!config) throw new Error("source configuration was not pinned in memory before list parse");
            const sourceRow = { id: source.id, name: source.id, kind: "web_list", config, tier: "", participation_mode: "editorial", first_party: false, interval_minutes: 1440, enabled: false, cursor: source.cursor, fail_count: 0 } as SourceRow;
            const decoded = decodeContentEncoding(Buffer.concat(row.chunks), row.headers["content-encoding"] ?? "identity");
            const charset = /charset\s*=\s*["']?([\w-]+)/iu.exec(row.contentType ?? "")?.[1] ?? "utf-8";
            const html = new TextDecoder(charset.toLowerCase() === "gb2312" ? "gbk" : charset).decode(decoded);
            const candidates = fromHtml(html, new URL(row.path, row.origin).toString(), sourceRow, source.listUrl);
            const allowedUrls = allowedMetadataUrlsBySource.get(source.id)!;
            for (const candidate of candidates) {
              const target = new URL(candidate.url);
              if (target.origin === new URL(source.listUrl).origin && !target.search && !target.hash &&
                  !/\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|png|jpe?g|gif)$/iu.test(target.pathname) &&
                  source.allowUrlPrefixes.some((prefix) => { const allowedPrefix = new URL(prefix); return allowedPrefix.origin === target.origin && target.pathname.startsWith(allowedPrefix.pathname); })) {
                allowedUrls.add(target.toString());
              }
            }
          } catch (error) { row.metadataCandidateParseError = error instanceof Error ? error.message : String(error); }
        }
      }
      delete row.chunks;
      delete row.digest;
      activeRequests.delete(row.id);
    };
    observe("undici:request:trailers", (message) => { if (message?.request) finish(message.request, true); });
    observe("undici:request:error", (message) => { const row = message?.request && responseByRequest.get(message.request); if (row) row.error = String(message.error?.code ?? message.error?.name ?? "request_error"); if (message?.request) finish(message.request, false); });

    let before: Record<string, number> | null = null;
    let after: Record<string, number> | null = null;
    let sourceRuns: Array<Record<string, any>> = [];
    let failure: string | null = null;
    let queueJobs: Array<Record<string, any>> = [];
    try {
      const [identity] = await sql`SELECT current_database() AS name, host(inet_server_addr()) AS address, inet_server_port() AS port`;
      if (identity.name !== scope.database.name || identity.address !== scope.database.address || Number(identity.port) !== scope.database.port) throw new Error("live database identity changed after scope creation");
      const baseline = await sql.begin(async (tx) => { await tx`SET TRANSACTION READ ONLY`; return readBaseline(tx, scope.sourceIds); });
      before = baseline.counts;
      if (!isDeepStrictEqual(before, scope.baselineCounts)) throw new Error("database baseline counts changed after scope was frozen");
      if (baseline.jobCounts.some((job: any) => job.started > 0 || job.state !== "created")) throw new Error("existing source jobs are not all unconsumed created jobs");
      for (const source of scope.sources) {
        const [row] = await sql`SELECT id,kind,config,cursor,enabled,site_fulltext,syndicate_fulltext FROM sources WHERE id=${source.id}`;
        if (!row || sourceSha(row as SourceRow) !== source.configSha256 || !sourceTargetMatchesScope(source, row as SourceRow) ||
            validateWebListPagination(row.kind, row.config).length > 0 || !isDeepStrictEqual(row.cursor, source.cursor) ||
            webListPaginationConfigHash(row as SourceRow) !== source.adapterConfigHash || row.enabled || row.site_fulltext || row.syndicate_fulltext) {
          throw new Error(`source cursor/config compare-and-swap precondition failed: ${source.id}`);
        }
        sourceConfigById.set(source.id, row.config);
      }
      for (const source of scope.sources) {
        if (budget.snapshot().dispatched >= GLOBAL_DISPATCH_CAP) break;
        const [row] = await sql`SELECT id,kind,config,cursor,enabled,site_fulltext,syndicate_fulltext FROM sources WHERE id=${source.id}`;
        if (!row || sourceSha(row as SourceRow) !== source.configSha256 || !sourceTargetMatchesScope(source, row as SourceRow) ||
            validateWebListPagination(row.kind, row.config).length > 0 || !isDeepStrictEqual(row.cursor, source.cursor) ||
            webListPaginationConfigHash(row as SourceRow) !== source.adapterConfigHash || row.enabled || row.site_fulltext || row.syndicate_fulltext) {
          throw new Error(`source cursor/config compare-and-swap precondition failed before collection: ${source.id}`);
        }
        activeSource = source;
        const started = new Date().toISOString();
        const dispatchBefore = budget.snapshot().dispatched;
        const result = await collectSource(source.id, { force: true });
        const [fetchRun] = await sql`SELECT id,status,found_count,new_count,error,detail FROM fetch_runs WHERE source_id=${source.id} ORDER BY id DESC LIMIT 1`;
        const [afterSource] = await sql`SELECT config,cursor,enabled,site_fulltext,syndicate_fulltext,health FROM sources WHERE id=${source.id}`;
        const beforeBackfill = (source.cursor as any).webListBackfill;
        const afterBackfill = (afterSource?.cursor as any)?.webListBackfill;
        const cursorValid = Boolean(afterBackfill && afterBackfill.nextPageIndex === Number(beforeBackfill.nextPageIndex) + source.pageIndices.length &&
          afterBackfill.pagesCommitted === Number(beforeBackfill.pagesCommitted) + source.pageIndices.length &&
          afterBackfill.generationId === beforeBackfill.generationId && afterBackfill.anchorAt === beforeBackfill.anchorAt &&
          afterBackfill.cutoffAt === beforeBackfill.cutoffAt && afterBackfill.coverage === "unproven" && afterBackfill.pendingPage === undefined);
        sourceRuns.push({ sourceId: source.id, startedAtUtc: started, result, fetchRun, dispatchesUsed: budget.snapshot().dispatched - dispatchBefore,
          cursor: afterSource?.cursor ?? null, configSha256: afterSource ? sourceSha({ ...row, config: afterSource.config } as SourceRow) : null,
          cursorValid, flags: { enabled: afterSource?.enabled, siteFulltext: afterSource?.site_fulltext, syndicateFulltext: afterSource?.syndicate_fulltext }, health: afterSource?.health ?? null });
        activeSource = null;
      }
      activeSource = null;
      await queue.stopBoss().catch(() => {});
      const afterSnapshot = await readBaseline(sql, scope.sourceIds);
      after = afterSnapshot.counts;
      const [jobTable] = await sql`SELECT to_regclass('pgboss.job') IS NOT NULL AS present`;
      queueJobs = jobTable.present ? await sql`SELECT j.name,j.state,j.started_on,a.source_id,count(*)::int AS count
        FROM pgboss.job j LEFT JOIN articles a ON a.id=j.data->>'articleId'
        WHERE a.source_id=ANY(${scope.sourceIds}) GROUP BY j.name,j.state,j.started_on,a.source_id ORDER BY a.source_id,j.name,j.state` : [];
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      activeSource = null;
    } finally {
      activeSource = null;
      for (const unsubscribe of channelSubscriptions) unsubscribe();
      for (let index = 0; index < prototypes.length; index++) Object.defineProperty(prototypes[index], "dispatch", { configurable: true, enumerable: false, writable: true, value: originalDispatch[index] });
      const budgetSnapshot = budget.snapshot();
      budget.uninstall();
      await queue.stopBoss().catch(() => {});
      const sortedDispatches = actualDispatches.map((row) => Number(row.monotonicMs));
      const gapsMs = sortedDispatches.slice(1).map((current, index) => Math.round((current - sortedDispatches[index]) * 1_000) / 1_000);
      const violations: string[] = [];
      if (budgetSnapshot.dispatched > GLOBAL_DISPATCH_CAP || budgetSnapshot.rejected > 0 || budgetSnapshot.minDispatchIntervalMs !== MIN_DISPATCH_INTERVAL_MS) violations.push("global_dispatch_guard_violation");
      if (actualDispatches.length !== budgetSnapshot.dispatched || actualDispatches.some((request) => request.method !== "GET")) violations.push("dispatch_capture_mismatch_or_non_get");
      if (gapsMs.some((gap) => gap < MIN_DISPATCH_INTERVAL_MS)) violations.push("dispatch_interval_below_guard");
      if (maxConcurrentRequests > 1) violations.push("requests_overlapped");
      if (blockedDispatches.length) violations.push("out_of_scope_dispatch_blocked");
      if (requestRows.some((row) => !row.finished || row.truncated || (row.statusCode !== null && !row.rawFile))) violations.push("response_capture_not_complete_or_over_limit");
      if (requestRows.some((row) => row.statusCode !== 200 || !/^\s*text\/html(?:\s*;|\s*$)/iu.test(String(row.contentType ?? "")))) violations.push("non_html_or_non_200_response");
      if (sourceRuns.some((run) => run.result?.status !== "ok" || run.dispatchesUsed > PER_SOURCE_DISPATCH_CAP || run.flags?.enabled || run.flags?.siteFulltext || run.flags?.syndicateFulltext)) violations.push("source_run_or_flags_violation");
      if (sourceRuns.some((run) => !run.cursorValid)) violations.push("cursor_generation_or_window_violation");
      if (after && ["analyses","receipts","publications","selected","job_runs"].some((key) => Number(after?.[key]) !== Number(before?.[key]))) violations.push("downstream_rows_changed");
      if (queueJobs.some((job) => job.started_on !== null || job.state !== "created")) violations.push("job_was_consumed");
      const pageAudits: Array<Record<string, unknown>> = [];
      const pageAuditErrors: string[] = [];
      for (const source of scope.sources) {
        const sourceConfig = sourceConfigById.get(source.id);
        if (!sourceConfig) continue;
        const sourceRow = { id: source.id, name: source.id, kind: "web_list", config: sourceConfig, tier: "", participation_mode: "editorial", first_party: false, interval_minutes: 1440, enabled: false, cursor: source.cursor, fail_count: 0 } as SourceRow;
        const pages: Array<Record<string, unknown>> = [];
        const pageIdentityHashes: string[][] = [];
        for (const url of source.pageUrls) {
          const parsedUrl = new URL(url);
          const response = requestRows.find((item) => item.sourceId === source.id && item.origin === parsedUrl.origin && item.path === parsedUrl.pathname);
          let candidates: any[] = [];
          let error: string | null = response?.metadataCandidateParseError ?? null;
          if (response?.rawFile && response.eof) {
            try {
              const wire = await readBoundedFile(path.join(outDir, response.rawFile));
              if (sha256(wire) !== response.sha256) throw new Error("saved response SHA-256 mismatch");
              const decoded = decodeContentEncoding(wire, response.headers?.["content-encoding"] ?? "identity");
              const charset = /charset\s*=\s*["']?([\w-]+)/iu.exec(response.contentType ?? "")?.[1] ?? "utf-8";
              const html = new TextDecoder(charset.toLowerCase() === "gb2312" ? "gbk" : charset).decode(decoded);
              candidates = fromHtml(html, url, sourceRow, url);
            } catch (decodeError) { error = decodeError instanceof Error ? decodeError.message : String(decodeError); }
          } else error ??= response ? "list response capture is incomplete" : "frozen list page was not requested";
          if (response && (response.statusCode !== 200 || !/^\s*text\/html(?:\s*;|\s*$)/iu.test(String(response.contentType ?? "")))) error ??= "list response was not HTTP 200 text/html";
          if (error) pageAuditErrors.push(`${source.id}:${url}:${error}`);
          const { identityKeyFor } = await import("../../packages/backend/src/content/materials.ts");
          const hashes = candidates.map((candidate) => sha256(identityKeyFor({ ...candidate, sourceId: source.id, via: "fetch" }))).sort();
          pageIdentityHashes.push(hashes);
          pages.push({ url, requested: Boolean(response), status: response?.statusCode ?? null, contentType: response?.contentType ?? null, rawSha256: response?.sha256 ?? null,
            capturedComplete: Boolean(response?.eof), candidateCount: candidates.length, candidateUrls: candidates.map((candidate) => candidate.url), identityHashes: hashes, auditError: error });
        }
        const previousSet = new Set((source.cursor.webListBackfill as any)?.lastPageIdentityHashes ?? []);
        const currentSet = new Set(pageIdentityHashes[0] ?? []);
        const nextSet = new Set(pageIdentityHashes[1] ?? []);
        pageAudits.push({ sourceId: source.id, pages,
          previousPageIdentityOverlapHashes: [...currentSet].filter((hash) => previousSet.has(hash)),
          currentPageIdentityOverlapHashes: [...currentSet].filter((hash) => nextSet.has(hash)) });
      }
      if (pageAuditErrors.length) violations.push("requested_page_audit_failed");
      const manifest = { result: failure || violations.length ? "partial_or_failed" : "bounded_continuation_complete", scopeSha256: expectedSha,
        startedAtUtc, finishedAtUtc: new Date().toISOString(), database: scope.database, limits: scope.limits, before, after,
        sourceRuns, dispatchBudget: budgetSnapshot, actualDispatchPacer: { dispatches: actualDispatches, gapsMs, maxConcurrentRequests },
        blockedDispatches, responseCaptures: requestRows.map(({ headers, ...row }) => ({ ...row, headers: { "content-type": headers?.["content-type"] ?? null, "content-encoding": headers?.["content-encoding"] ?? null } })), pageAudits, queueJobs, failure, safetyViolations: violations,
        interpretation: { coverage: "unproven; this bounded continuation does not establish 90-day completeness", workerStarted: false,
          bodyExtractionAttachmentsPdfOcrJinaModelsProviders: false, jobsConsumed: false } };
      writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx", mode: 0o600 });
      await closeDb().catch(() => {});
      if (failure || violations.length) throw new Error(`continuation failed safety checks; see ${path.join(outDir, "manifest.json")}`);
    }
  } finally {
    await lockHandle?.close().catch(() => {});
    await import("node:fs/promises").then(({ unlink }) => unlink(lockPath).catch(() => {}));
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: {
    "database-url": { type: "string" }, "source-ids": { type: "string" }, "out-dir": { type: "string" },
    execute: { type: "boolean", default: false }, scope: { type: "string" }, "scope-sha": { type: "string" },
  } });
  if (values.execute) {
    if (!values.scope || !values["scope-sha"] || !values["out-dir"]) throw new Error("execution requires --execute --scope --scope-sha --out-dir");
    await executeScope(values.scope, values["scope-sha"], values["out-dir"]);
    return;
  }
  if (!values["database-url"] || !values["source-ids"]) throw new Error("plan mode requires --database-url and explicit --source-ids");
  const ids = parseExplicitSourceIds(values["source-ids"]);
  const scope = await buildContinuationScope(values["database-url"], ids);
  const scopeSha = canonicalScopeSha256(scope);
  if (values["out-dir"]) {
    const outDir = safeOutDir(values["out-dir"]);
    mkdirSync(outDir, { recursive: true });
    await writeExclusive(path.join(outDir, "scope.json"), `${JSON.stringify(scope, null, 2)}\n`);
    console.log(JSON.stringify({ mode: "plan", scopeSha256: scopeSha, scopePath: path.join(outDir, "scope.json"), database: scope.database, sources: scope.sources.map(({ id, pageIndices, pageUrls }) => ({ id, pageIndices, pageUrls })) }, null, 2));
  } else console.log(JSON.stringify({ mode: "plan", scopeSha256: scopeSha, scope }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
