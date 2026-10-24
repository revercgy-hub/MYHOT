#!/usr/bin/env node
/** Prepare, capture, replay and CAS a bounded set of already-pending article bodies. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import { applyCandidateBodyCas, type CandidateBodyCasRow } from "./nas-candidate-body-cas.ts";
import { createBudgetedDetailFetcher, decodeCapturedBody, detailConfigIsDirectHtml, sameConfiguredDay } from "./nas-candidate-batch.ts";

const ROOT = process.env.AIHOT_APP_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const appModule = (relative: string) => pathToFileURL(path.resolve(ROOT, relative)).href;
const CATALOG_BYTES = readFileSync(path.join(ROOT, "industry/sources.json"));
const CATALOG = JSON.parse(CATALOG_BYTES.toString("utf8")) as { sources: Array<Record<string, any>> };
const CAP = 50;
const MIN_INTERVAL_MS = 1_100;
const MAX_DETAIL_BYTES = 6 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
const MAX_DECODED_BYTES = 6 * 1024 * 1024;
const APPROVED_LEGACY_INVENTORY_SHA256 = "a67f047a2e4b90afc7cbcd0b9abe66b9f470dbcaa5da702189b8e5fa06367ee2";
const LEGACY_MANIFEST_SHA256: Record<string, string> = {
  ".data/fiscal-qa/pending-body-20261012/evidence/fiscalhot_source_expand_b2_20261012_test/manifest.json": "af47b70358a9f14f5a3e2fa221664966210c2b9909d10226f11d8b6234508636",
  ".data/fiscal-qa/pending-body-full-20261013/http-body-evidence/manifest.json": "d0065e5afca39d70a548d0173fa2c6cfb49fa098220df4d7b2ef170f790ed6a6",
  ".data/fiscal-qa/source-expand-body-20261013/evidence/manifest.json": "b95aeee0239291135ea3a948bbde6eeb0b70c3a8ee791f1b02d3432f12d18573",
  ".data/fiscal-qa/bulk-body-20261021-batch2/execution-manifest.json": "7c43fa613242ce84b50f79919c82629efb920672722775eb9aa7e4a5b88cc165",
  ".data/fiscal-qa/source-expand-20261012/evidence/manifest.json": "773ec80e8e67b128654c89dc76f8e5dd15e81a81529054ef7e86f712551c2d6f",
  ".data/fiscal-qa/pending-body-anomaly-20261012/evidence/fiscalhot_source_anomaly_20261012_test/manifest.json": "230d195f149e711547adbb1abab6c9af164fc0c0480cd52f6c9aae3c30606906",
  ".data/fiscal-qa/catalog-sweep-20261013/evidence/manifest.json": "a0b8734dc167e942abd949fea9b1ce77d1c66d01b3a58ebe30b573358c314657",
  ".data/fiscal-qa/bulk-20261012/evidence/manifest.json": "7879d85c71194a905f727f47ff424a88f7263e41ead5a67f70c8c0c43dd9a7c5",
  ".data/fiscal-qa/pending-body-catalog-20261013/evidence/manifest.json": "e0489d410b1b78c9df87c444aa4c1e7f06ed4d19b17ee29986b71cec93f299d4",
  ".data/fiscal-qa/source-expand-20261013/evidence/manifest.json": "4590123b38a71a2eaae9ddc18b571c83f651d19a0cb508f77e580eb0d52ab3b7",
  ".data/fiscal-qa/source-expand-b2-20261012/evidence/manifest.json": "9b621cf3575519c04c7d11f255c1ba61443c2b45f023ec96b596e4c4b03f6253",
  ".data/fiscal-qa/pending-audit-20261016/html-four/http-body-evidence/manifest.json": "bded1702942a6533a6f8183e1035f740cd96e415eb8c6310359172081fb38e79",
  ".data/fiscal-qa/pending-body-html-12-20261014/op2/http-body-evidence/manifest.json": "f06b41524254dbfd4c5286eef4605f386800aaacfc352d175e99af353ec3f500",
  ".data/fiscal-qa/pending-body-20261012/evidence/fiscalhot_bulk_20261012_test/manifest.json": "b0995793b63167907701eb638ac22a5ba980d49279a28da0ef7059ea5f000b2d",
  ".data/fiscal-qa/bulk-collection-20261021/main-body40/attempt-2/execution-manifest.json": "574894715c677904a3d428964d86e751f11532e7d35a90996519a3b78c69d7fb",
  ".data/fiscal-qa/pending-body-20261012/evidence/fiscalhot_source_expand_20261012_test/manifest.json": "ba72367bfabbb7f68b671e082353b10ec8d968438621332ad822077d867587ee",
  ".data/fiscal-qa/regional-bulk-20261012/evidence/manifest.json": "c625abeee74a70be9b5f1800db50fb25a3708064d83d2b9ce2e17048eeb665ed",
  ".data/fiscal-qa/pending-body-20261012/evidence/fiscalhot_regional_bulk_20261012_test/manifest.json": "d048dc24bb8b7923e15818acf8c6653f36412aa9f0279e8ab303d2619473b56d",
  ".data/fiscal-qa/source-anomaly-20261012/evidence/manifest.json": "1a17b48a4447e2bb39b83153aab91f5ef0d2492ec473edec4230e1dbdd670f71",
  ".data/fiscal-qa/pending-body-next-20261013/http-body-evidence/manifest.json": "8dc5fd16f26de31ca9a37ee5a9e0b25157e97025ffba4e76e2553437866ec094",
  ".data/fiscal-qa/bulk-body-20261021/execution-manifest.json": "21516946587ae3dae8ff65ae1da81a1c423e9ae45a047ae5311c7a7aa4d85ef0",
  ".data/fiscal-qa/pending-body-shaanxi-positive-20261012/evidence/fiscalhot_regional_bulk_20261012_test/manifest.json": "9cd8a8d09f47be6b3d1a751bdc653ae55de8f60220704244822618106e5cfa50",
  ".data/fiscal-qa/pending-audit-20261016/html-business-four-v2/http-body-evidence/manifest.json": "020e2a6fd0c0e590ece8ee887c39445191dc8a0a0c6e222d9594708092cddae7",
};
const SAFETY_FLAGS = ["COLLECT_ENABLED", "MODEL_CALLS_ENABLED", "JINA_BODY_FALLBACK", "FEISHU_CONTENT_PUSH_ENABLED",
  "FEISHU_INTERNAL_ENABLED", "INDEXNOW_SUBMIT_ENABLED", "EMBEDDINGS_ENABLED", "OCR_RUN_ENABLED", "WORKER_ENABLED", "ALLOW_PRIVATE_NETWORK_FETCH"];
const PROTECTED_RELATIONS = ["sources", "article_discoveries", "editorial_overrides", "publications", "analyses", "receipts",
  "receipt_attempts", "job_runs", "fetch_runs", "translations", "translation_attempts", "grouping_decisions", "grouping_overrides",
  "regroup_pending", "selected_ledger", "selected_state", "audit_log", "ingest_events", "gold_review_batches", "gold_review_cases",
  "gold_review_idempotency"];
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${stableJson(row[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};
const hashRows = (rows: Array<{ row_text: string }>) => sha256(rows.map((row) => row.row_text).join("\n") + (rows.length ? "\n" : ""));

export interface PendingTarget {
  articleId: string;
  sourceId: string;
  url: string;
  title: string;
  publishedAt: string | null;
  revision: number;
  contentHash: string | null;
  excerpt: string | null;
  sourceRowSha256: string;
  rowText: string;
  rowSha256: string;
}

export interface PendingSnapshot {
  database: string;
  capturedAt: string;
  counts: Record<string, number>;
  rowsets: Record<string, { count: number; sha256: string }>;
}

export interface ExistingUrlEvidence {
  schemaVersion: "nas-pending-existing-url-evidence.v1";
  entries: Array<{ url: string; evidenceSha256: string; status: "captured" | "dispatch-attempted" | "offline-review-required" }>;
}

export interface PendingBodyManifest {
  schemaVersion: "nas-pending-body-batch.v1";
  runId: string;
  operatorSha256: string;
  catalogSha256: string;
  database: string;
  snapshot: PendingSnapshot;
  snapshotSha256: string;
  selection: { strategy: "explicit-article-ids" | "source-round-robin-published-desc-id-asc" | "source-round-robin-prior-captured-published-desc-id-asc"; articleIds: string[];
    excludedResponseUrlCount: number; excludedResponseUrlEvidenceSha256: string;
    excludedResponseUrlEntriesSha256: string; excludedResponseUrls: ExistingUrlEvidence["entries"]; legacyInventorySha256?: string };
  legacyReuseGroups?: Array<{ articleId: string; sourceId: string; url: string; candidates: LegacyReuseCandidate[] }>;
  targets: PendingTarget[];
}

export interface LegacyReuseCandidate {
  manifestPath: string;
  manifestSha256: string;
  requestId: number;
  recordIndex: number;
  responsePath: string;
  bytes: number;
  bodySha256: string;
  contentType: string;
  contentEncoding: string;
}

export interface PendingCaptureRecord {
  articleId: string;
  sourceId: string;
  url: string;
  method: "GET";
  dispatchedAt: string | null;
  completedAt: string | null;
  status: number;
  responseUrl: string;
  contentType: string | null;
  /** Origin response `content-encoding` header; pre-transport-decode legacy files use this to decode bytes. */
  contentEncoding: string | null;
  /** Encoding of the bytes in `file`; new Undici fetches transparently decode content encodings. */
  bodyEncoding?: string;
  /** Explicit transport representation; absent on historical raw captures. */
  bodyRepresentation?: "undici-decoded";
  /** Origin response header, kept separately from the stored body encoding. */
  originContentEncoding?: string | null;
  bytes: number;
  bodySha256: string;
  eof: boolean;
  file: string;
  networkEvidenceKind?: "fresh-dispatch" | "legacy-capture";
  legacySourceManifestSha256?: string;
  legacySourceManifestPath?: string;
  legacySourceRequestId?: number;
  legacySourceRecordIndex?: number;
  legacySourceManifestStartedAtUtc?: string | null;
  legacySourceManifestFinishedAtUtc?: string | null;
  legacyInventorySha256?: string;
  legacyDuplicateEvidence?: LegacyReuseCandidate[];
}

function safeCaptureFailure(error: unknown): { errorName: string; errorMessage: string } {
  const value = error && typeof error === "object" ? error as { name?: unknown; message?: unknown } : null;
  const errorName = typeof value?.name === "string" && /^[A-Za-z][A-Za-z0-9]{0,63}$/u.test(value.name) ? value.name : "Error";
  const rawMessage = typeof value?.message === "string" ? value.message : String(error ?? "unknown fetch failure");
  const errorMessage = rawMessage
    .replace(/https?:\/\/[^\s<>"']+/giu, "[redacted-url]")
    .replace(/\bBearer\s+[^\s,;]+/giu, "Bearer [redacted]")
    .replace(/\b(authorization|proxy-authorization)\s*[:=]\s*(?:Bearer\s+)?[^\s,;]+/giu, "$1=[redacted]")
    .replace(/\b(token|password|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/giu, "$1=[redacted]")
    .slice(0, 500);
  return { errorName, errorMessage };
}

export interface LegacyOfflineCaptureEvidence {
  schemaVersion: "nas-pending-legacy-capture.v1";
  articleId: string;
  sourceId: string;
  url: string;
  requestId: number;
  method: "GET";
  dispatchedAt: string | null;
  completedAt: null;
  status: number;
  responseUrl: string;
  contentType: string;
  contentEncoding: string;
  bytes: number;
  bodySha256: string;
  eof: true;
  file: string;
  sourceManifestSha256: string;
  sourceManifestStartedAtUtc: string | null;
  sourceManifestFinishedAtUtc: string | null;
  networkCompliance: "UNPROVEN_HISTORICAL_CADENCE";
  legacyInventorySha256?: string;
}

export function asLegacyOfflineCaptureRecord(evidence: LegacyOfflineCaptureEvidence): PendingCaptureRecord {
  if (evidence.schemaVersion !== "nas-pending-legacy-capture.v1" || evidence.completedAt !== null ||
      evidence.networkCompliance !== "UNPROVEN_HISTORICAL_CADENCE") throw new Error("invalid legacy offline capture evidence");
  return { articleId: evidence.articleId, sourceId: evidence.sourceId, url: evidence.url, method: evidence.method,
    dispatchedAt: evidence.dispatchedAt, completedAt: evidence.completedAt, status: evidence.status, responseUrl: evidence.responseUrl,
    contentType: evidence.contentType, contentEncoding: evidence.contentEncoding, bytes: evidence.bytes,
    bodySha256: evidence.bodySha256, eof: evidence.eof, file: evidence.file, networkEvidenceKind: "legacy-capture",
    legacySourceManifestSha256: evidence.sourceManifestSha256,
    legacySourceManifestStartedAtUtc: evidence.sourceManifestStartedAtUtc,
    legacySourceManifestFinishedAtUtc: evidence.sourceManifestFinishedAtUtc };
}

export interface PendingProposalBundle {
  schemaVersion: "nas-pending-body-proposals.v1";
  runId: string;
  manifestSha256: string;
  capturesSha256: string;
  inputSha256: string;
  freshDispatchCount: number;
  legacyOfflineCaptureCount: number;
  historicalNetworkCompliance: "PASS_FOR_FRESH_DISPATCHES_ONLY" | "UNPROVEN_HISTORICAL_CADENCE";
  proposals: CandidateBodyCasRow[];
  holds: Array<{ articleId: string; reason: string; bodySha256: string | null }>;
}

export function parsePendingArticleIds(value: string): string[] {
  const ids = value.split(",").map((id) => id.trim());
  if (!ids.length || ids.length > CAP || ids.some((id) => !/^[A-Za-z0-9_-]{1,80}$/u.test(id)) || new Set(ids).size !== ids.length) {
    throw new Error("article IDs must contain 1–50 unique safe identifiers");
  }
  return ids;
}

export function parseExistingUrlEvidence(bytes: Buffer): { evidence: ExistingUrlEvidence; sha256: string; urls: Set<string> } {
  const evidence = JSON.parse(bytes.toString("utf8")) as ExistingUrlEvidence;
  if (evidence.schemaVersion !== "nas-pending-existing-url-evidence.v1" || !Array.isArray(evidence.entries)) {
    throw new Error("prior response evidence has an unsupported schema");
  }
  const urls = new Set<string>();
  for (const entry of evidence.entries) {
    let parsed: URL;
    try { parsed = new URL(entry.url); } catch { throw new Error("prior response evidence contains an invalid URL"); }
    if (!(["http:", "https:"].includes(parsed.protocol)) || parsed.username || parsed.password || parsed.hash ||
        parsed.href !== entry.url || !/^[a-f0-9]{64}$/u.test(entry.evidenceSha256) ||
        !["captured", "dispatch-attempted", "offline-review-required"].includes(entry.status) || urls.has(entry.url)) {
      throw new Error("prior response evidence contains an unsafe or duplicate URL entry");
    }
    urls.add(entry.url);
  }
  return { evidence, sha256: sha256(bytes), urls };
}

/** Strictly adapts one preserved legacy GET for offline parsing; unknown times stay null. */
export function adaptLegacyExecutionDispatch(input: { target: PendingTarget; manifestBytes: Buffer; requestId: number;
  rawBytes: Buffer; file: string; expectedManifestSha256: string }): LegacyOfflineCaptureEvidence {
  const manifest = JSON.parse(input.manifestBytes.toString("utf8"));
  const digest = sha256(input.manifestBytes);
  const dispatches = Array.isArray(manifest.dispatches) ? manifest.dispatches.filter((row: any) => row.requestId === input.requestId) : [];
  const dispatch = dispatches[0];
  const events = Array.isArray(manifest.dispatchBudget?.requests) ? manifest.dispatchBudget.requests.filter((row: any) => row.requestId === input.requestId) : [];
  const requestUrl = dispatch?.origin && dispatch?.path ? new URL(dispatch.path, dispatch.origin).href : null;
  const startedAt = Date.parse(String(manifest.startedAtUtc ?? ""));
  const finishedAt = Date.parse(String(manifest.finishedAtUtc ?? ""));
  const eventByName = new Map<string, any[]>();
  for (const event of events) eventByName.set(event.event, [...(eventByName.get(event.event) ?? []), event]);
  const create = eventByName.get("undici:request:create")?.[0];
  const send = eventByName.get("undici:client:sendHeaders")?.[0];
  const headers = eventByName.get("undici:request:headers")?.[0];
  const eventTime = (row: any): number => Date.parse(String(row?.at ?? ""));
  const eventTimes = [create, send, headers].map(eventTime);
  const eventEvidenceComplete = events.length === 3 && !!create && !!send && !!headers &&
    [create, send, headers].every((event) => event.origin === dispatch?.origin && event.path === dispatch?.path && event.method === "GET") &&
    eventTimes.every(Number.isFinite) && eventTimes[0]! <= eventTimes[1]! && eventTimes[1]! <= eventTimes[2]! && headers.statusCode === 200;
  const dispatchedAt = eventEvidenceComplete ? create!.at as string : null;
  const startedAtUtc = Number.isFinite(startedAt) ? manifest.startedAtUtc as string : null;
  const finishedAtUtc = Number.isFinite(finishedAt) ? manifest.finishedAtUtc as string : null;
  const file = input.file.replace(/\\/gu, "/");
  const supportedManifest = manifest.schema === "fiscal.bulk-collection-20261021.main-body40-execution-manifest.v1" &&
    manifest.result === "bounded_body_batch_completed" || manifest.schema === "fiscal.bulk-body-20261021.execution-manifest.v2" &&
    manifest.result === "bounded_body_batch_completed" || manifest.schema === undefined && typeof manifest.task === "string" &&
    /(?:pending-body|body extraction|body sample|body pass|detail cap|48-source serial bounded one-page catalog sweep)/iu.test(manifest.task) &&
    ["bounded_body_db_completed", "bounded_batch_completed", "partial_or_failed"].includes(manifest.result);
  if (!/^[a-f0-9]{64}$/u.test(input.expectedManifestSha256) || digest !== input.expectedManifestSha256 || !supportedManifest || dispatches.length !== 1 ||
      !dispatch || requestUrl !== input.target.url || dispatch.method !== "GET" || dispatch.statusCode !== 200 ||
      dispatch.contentType?.split(";")[0]?.trim().toLowerCase() !== "text/html" || dispatch.eof !== true || dispatch.captureTruncated !== false ||
      dispatch.location != null || (manifest.redirectResponses ?? []).some((row: any) => row.requestId === input.requestId) ||
      dispatch.bytes !== input.rawBytes.length || dispatch.bodySha256 !== sha256(input.rawBytes) ||
      !/^([A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.body$/u.test(file) || input.rawBytes.length > MAX_DETAIL_BYTES ||
      (Number.isFinite(startedAt) && Number.isFinite(finishedAt) && finishedAt < startedAt) ||
      (headers?.statusCode !== undefined && headers.statusCode !== dispatch.statusCode)) {
    throw new Error("legacy response cannot be safely adapted for offline replay");
  }
  return { schemaVersion: "nas-pending-legacy-capture.v1", articleId: input.target.articleId, sourceId: input.target.sourceId,
    url: input.target.url, requestId: input.requestId, method: "GET", dispatchedAt, completedAt: null,
    status: dispatch.statusCode, responseUrl: input.target.url, contentType: dispatch.contentType, contentEncoding: dispatch.contentEncoding ?? "identity",
    bytes: input.rawBytes.length, bodySha256: sha256(input.rawBytes), eof: true, file, sourceManifestSha256: digest,
    sourceManifestStartedAtUtc: startedAtUtc, sourceManifestFinishedAtUtc: finishedAtUtc,
    networkCompliance: "UNPROVEN_HISTORICAL_CADENCE" };
}

/** Deterministic metadata-only ordering; it never reads or ranks Gold/review/model fields. */
export function selectRoundRobinPendingTargets(rows: Array<{ articleId: string; sourceId: string; url: string; publishedAt: string | null }>,
  catalogSources: Array<Record<string, any>>, cap = CAP, excludedUrls: ReadonlySet<string> = new Set()): string[] {
  if (!Number.isSafeInteger(cap) || cap < 1 || cap > CAP) throw new Error("pending target cap must be 1–50");
  const catalog = new Map(catalogSources.map((row) => [String(row.id), row]));
  const bySource = new Map<string, typeof rows>();
  for (const row of rows) {
    if (excludedUrls.has(row.url)) continue;
    const source = catalog.get(row.sourceId);
    if (!source || source.kind !== "web_list" || source.enabled !== false || source.site_fulltext !== false || source.syndicate_fulltext !== false ||
        !detailConfigIsDirectHtml(source) || !row.publishedAt) continue;
    let url: URL;
    try { url = new URL(row.url); } catch { continue; }
    if (!(["http:", "https:"].includes(url.protocol)) || url.username || url.password || url.hash ||
        !source.config.allowUrlPrefixes.some((prefix: string) => url.href.startsWith(prefix))) continue;
    const group = bySource.get(row.sourceId) ?? [];
    group.push(row); bySource.set(row.sourceId, group);
  }
  const sources = [...bySource.keys()].sort((a, b) => a.localeCompare(b));
  for (const [sourceId, group] of bySource) {
    group.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)) || a.articleId.localeCompare(b.articleId));
    const configured = Number(catalog.get(sourceId)?.config?.detail?.maxFetches ?? 0);
    group.splice(Math.min(10, configured));
  }
  const selected: string[] = [];
  for (let offset = 0; selected.length < cap; offset++) {
    let found = false;
    for (const sourceId of sources) {
      const row = bySource.get(sourceId)?.[offset];
      if (!row) continue;
      selected.push(row.articleId); found = true;
      if (selected.length === cap) break;
    }
    if (!found) break;
  }
  if (!selected.length) throw new Error("no eligible pending articles in configured direct-HTML source scope");
  return selected;
}

/** Returns a reusable prior response only when the frozen inventory proves one complete exact-URL detail dispatch. */
export function singleReusableLegacyDispatch(record: any, target: { articleId: string; sourceId: string; url: string }): any | null {
  const dispatches = record?.evidence?.responseDispatches;
  if (record?.exactURL !== target.url || record?.sourceId !== target.sourceId || !Array.isArray(dispatches) || dispatches.length !== 1) return null;
  const row = dispatches[0];
  const manifestRelative = typeof row.manifestPath === "string" ? row.manifestPath.replace(/\\/gu, "/") : "";
  if (row.exactArticleURLRequest !== true || row.requestURL !== target.url || row.method !== "GET" || row.statusCode !== 200 ||
      !/^text\/html(?:\s*;|$)/iu.test(row.contentType ?? "") || row.eof !== true || row.captureTruncated !== false ||
      row.fileExists !== true || row.transportComplete !== true || !Number.isSafeInteger(row.fileBytes) || row.fileBytes < 1 ||
      row.fileBytes !== row.declaredBytes || row.fileSha256 !== row.declaredSha256 || !/^[a-f0-9]{64}$/u.test(row.fileSha256 ?? "") ||
      typeof row.responsePath !== "string" || !LEGACY_MANIFEST_SHA256[manifestRelative]) return null;
  return row;
}

/** Metadata-only eligibility for one or more frozen response members; raw files are checked only by legacy-adapt. */
export function reusableIdenticalLegacyDispatchGroup(record: any,
  target: { articleId: string; sourceId: string; url: string }): LegacyReuseCandidate[] | null {
  const dispatches = record?.evidence?.responseDispatches;
  const rawCaptures = record?.evidence?.rawCaptures;
  if (record?.exactURL !== target.url || record?.sourceId !== target.sourceId || !Array.isArray(dispatches) || !dispatches.length ||
      !Array.isArray(rawCaptures) || rawCaptures.length !== dispatches.length) return null;
  const candidates: LegacyReuseCandidate[] = [];
  for (let recordIndex = 0; recordIndex < dispatches.length; recordIndex++) {
    const row = dispatches[recordIndex];
    const manifestPath = typeof row.manifestPath === "string" ? row.manifestPath.replace(/\\/gu, "/") : "";
    const approvedSha = LEGACY_MANIFEST_SHA256[manifestPath];
    const captureRows = rawCaptures.filter((capture: any) => capture.file?.replace(/\\/gu, "/") === manifestPath &&
      capture.rawFile?.replace(/\\/gu, "/") === row.rawFile?.replace(/\\/gu, "/") && capture.responseUrl === target.url);
    const capture = captureRows[0];
    if (!approvedSha || captureRows.length !== 1 || !Number.isSafeInteger(row.requestId) || row.requestId < 0 ||
        row.exactArticleURLRequest !== true || row.requestURL !== target.url || row.method !== "GET" ||
        row.statusCode !== 200 || !/^text\/html(?:\s*;|$)/iu.test(row.contentType ?? "") || row.eof !== true || row.captureTruncated !== false ||
        row.fileExists !== true || row.transportComplete !== true || !Number.isSafeInteger(row.fileBytes) || row.fileBytes < 1 ||
        row.fileBytes !== row.declaredBytes || row.fileSha256 !== row.declaredSha256 || !/^[a-f0-9]{64}$/u.test(row.fileSha256 ?? "") ||
        typeof row.responsePath !== "string" || row.responsePath.replace(/\\/gu, "/") !== capture.rawFile?.replace(/\\/gu, "/") ||
        capture.fileExists !== true || capture.eof !== true || capture.captureTruncated !== false ||
        capture.completeRaw !== true || capture.rawBytes !== row.fileBytes || capture.rawSha256 !== row.fileSha256 ||
        capture.contentType !== row.contentType || typeof capture.contentEncoding !== "string" ||
        capture.responseUrl !== target.url || capture.statusCode !== 200) return null;
    candidates.push({ manifestPath, manifestSha256: approvedSha, requestId: row.requestId, recordIndex,
      responsePath: row.responsePath.replace(/\\/gu, "/"), bytes: row.fileBytes, bodySha256: row.fileSha256,
      contentType: row.contentType, contentEncoding: capture.contentEncoding });
  }
  const reference = candidates[0]!;
  if (candidates.some((row) => row.bytes !== reference.bytes || row.bodySha256 !== reference.bodySha256 ||
      row.contentType !== reference.contentType || row.contentEncoding !== reference.contentEncoding)) return null;
  return candidates.sort((a, b) => compareText(a.manifestPath, b.manifestPath) || compareText(a.manifestSha256, b.manifestSha256) ||
    a.requestId - b.requestId || a.recordIndex - b.recordIndex);
}

export function assertRuntimeSafetyFlags(env: NodeJS.ProcessEnv): void {
  const enabled = SAFETY_FLAGS.filter((key) => env[key] !== undefined && env[key] !== "false" && env[key] !== "0" && env[key] !== "");
  if (enabled.length) throw new Error(`unsafe runtime flags enabled: ${enabled.join(",")}`);
}

export function assertDispatchNetworkGuard(config: { allowPrivateNetworkFetch?: unknown }): void {
  if (config.allowPrivateNetworkFetch !== false) throw new Error("public detail dispatch requires the connect-time private-network guard");
}

export function decodePendingCapturedResponse(body: Buffer, contentType: string | null, contentEncoding: string | null): string {
  if (body.length > MAX_DETAIL_BYTES) throw new Error("captured response exceeds the 6 MiB raw-byte limit");
  let decoded = body;
  const encodings = (contentEncoding ?? "identity").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  for (const encoding of encodings.reverse()) {
    if (encoding === "identity") continue;
    if (encoding === "gzip" || encoding === "x-gzip") decoded = gunzipSync(decoded, { maxOutputLength: MAX_DECODED_BYTES });
    else if (encoding === "deflate") decoded = inflateSync(decoded, { maxOutputLength: MAX_DECODED_BYTES });
    else if (encoding === "br") decoded = brotliDecompressSync(decoded, { maxOutputLength: MAX_DECODED_BYTES });
    else throw new Error(`unsupported captured content encoding: ${encoding}`);
    if (decoded.length > MAX_DECODED_BYTES) throw new Error("decompressed response exceeds the 6 MiB output limit");
  }
  const text = decodeCapturedBody(decoded, contentType);
  if (text.length > MAX_DECODED_BYTES) throw new Error("decoded response text exceeds the 6 MiB text limit");
  return text;
}

export function validatePendingTarget(source: Record<string, any>, article: Record<string, any>, input: {
  catalogSource: Record<string, any> | undefined;
  allowed: (url: string, source: Record<string, any>) => boolean;
  publicUrl: (url: string) => Promise<unknown>;
}): Promise<void> {
  if (!input.catalogSource || source.enabled !== false || source.site_fulltext !== false || source.syndicate_fulltext !== false ||
      source.kind !== "web_list" || stableJson(source.config) !== stableJson(input.catalogSource.config) ||
      !detailConfigIsDirectHtml(source as never)) throw new Error(`source is outside the configured disabled direct-HTML scope: ${String(source.id)}`);
  if (article.body_status !== "pending" || article.body_text !== null || article.body_html !== null) throw new Error(`article is not an empty pending body: ${String(article.id)}`);
  const url = new URL(String(article.url));
  if (!input.allowed(url.href, source) || !Array.isArray(source.config.allowUrlPrefixes) ||
      !source.config.allowUrlPrefixes.some((prefix: string) => url.href.startsWith(prefix))) throw new Error(`article URL is outside the source allowlist: ${String(article.id)}`);
  if (url.username || url.password || url.hash || !["http:", "https:"].includes(url.protocol) || url.hostname === "r.jina.ai" || url.hostname.endsWith(".jina.ai")) {
    throw new Error(`article URL is not a direct public HTTP(S) target: ${String(article.id)}`);
  }
  return input.publicUrl(url.href).then(() => undefined);
}

/** Full rowsets are hashed in-process; only counts and digests are written to the manifest. */
export async function readPendingSnapshot(tx: any, targetIds: string[], publicUrl: (url: string) => Promise<unknown>, allowed: (url: string, source: any) => boolean,
  includeTargets = true): Promise<{ snapshot: PendingSnapshot; targets: PendingTarget[] }> {
  const db = (await tx`SELECT current_database() AS database`)[0]?.database;
  const sources: Array<any> = await tx`SELECT to_jsonb(s)::text AS row_text FROM sources s ORDER BY id`;
  const articles: Array<any> = await tx`SELECT to_jsonb(a)::text AS row_text FROM articles a ORDER BY id`;
  const revisions: Array<any> = await tx`SELECT to_jsonb(r)::text AS row_text FROM article_revisions r ORDER BY article_id, revision`;
  const discoveries: Array<any> = await tx`SELECT to_jsonb(d)::text AS row_text FROM article_discoveries d ORDER BY article_id, source_id, via`;
  const counts: Record<string, number> = { sources: sources.length, articles: articles.length, revisions: revisions.length, discoveries: discoveries.length };
  const rowsets: PendingSnapshot["rowsets"] = {
    sources: { count: sources.length, sha256: hashRows(sources) }, articles: { count: articles.length, sha256: hashRows(articles) },
    revisions: { count: revisions.length, sha256: hashRows(revisions) }, discoveries: { count: discoveries.length, sha256: hashRows(discoveries) },
  };
  for (const relation of PROTECTED_RELATIONS.slice(2)) {
    const rows: Array<any> = await tx.unsafe(`SELECT to_jsonb(r)::text AS row_text FROM ${relation} r ORDER BY to_jsonb(r)::text`);
    counts[relation] = rows.length;
    rowsets[relation] = { count: rows.length, sha256: hashRows(rows) };
  }
  const pgbossPresent = Boolean((await tx`SELECT to_regclass('pgboss.job') IS NOT NULL AS present`)[0]?.present);
  const pgbossRows: Array<any> = pgbossPresent ? await tx`SELECT to_jsonb(j)::text AS row_text FROM pgboss.job j ORDER BY to_jsonb(j)::text` : [];
  counts["pgboss.job"] = pgbossRows.length;
  rowsets["pgboss.job"] = { count: pgbossRows.length, sha256: hashRows(pgbossRows) };
  const snapshot: PendingSnapshot = { database: String(db), capturedAt: new Date().toISOString(), counts, rowsets };
  if (!includeTargets) return { snapshot, targets: [] };
  const ids = targetIds;
  const articleRows: Array<any> = await tx`SELECT a.id, a.source_id, a.url, a.title, a.published_at::text AS published_at,
      a.revision, a.content_hash, a.excerpt, a.body_status, a.body_text, a.body_html, to_jsonb(a)::text AS row_text,
      to_jsonb(s)::text AS source_row_text, s.enabled AS source_enabled, s.site_fulltext, s.syndicate_fulltext, s.kind, s.config
    FROM articles a JOIN sources s ON s.id = a.source_id WHERE a.id = ANY(${tx.array(ids, 1009)}) ORDER BY a.id`;
  if (articleRows.length !== ids.length) throw new Error("one or more requested article IDs are missing");
  const catalogById = new Map(CATALOG.sources.map((row) => [String(row.id), row]));
  const targets: PendingTarget[] = [];
  for (const row of articleRows) {
    await validatePendingTarget({ id: row.source_id, enabled: row.source_enabled, site_fulltext: row.site_fulltext,
      syndicate_fulltext: row.syndicate_fulltext, kind: row.kind, config: row.config },
    { id: row.id, url: row.url, body_status: row.body_status, body_text: row.body_text, body_html: row.body_html },
    { catalogSource: catalogById.get(row.source_id), allowed, publicUrl });
    if (!row.content_hash || !Number.isSafeInteger(Number(row.revision)) || Number(row.revision) < 1) throw new Error(`article baseline is incomplete: ${row.id}`);
    targets.push({ articleId: row.id, sourceId: row.source_id, url: row.url, title: row.title,
      publishedAt: row.published_at, revision: Number(row.revision), contentHash: row.content_hash, excerpt: row.excerpt,
      sourceRowSha256: sha256(row.source_row_text), rowText: row.row_text, rowSha256: sha256(row.row_text) });
  }
  const rank = new Map(targetIds.map((id, index) => [id, index]));
  targets.sort((a, b) => rank.get(a.articleId)! - rank.get(b.articleId)!);
  return { snapshot, targets };
}

export function buildPendingManifest(input: { runId: string; operatorBytes: Buffer; catalogBytes?: Buffer; database: string;
  snapshot: PendingSnapshot; targets: PendingTarget[]; selectionStrategy?: PendingBodyManifest["selection"]["strategy"];
  excludedResponseUrlEvidence?: { sha256: string; entries: ExistingUrlEvidence["entries"] }; legacyInventorySha256?: string;
  legacyReuseGroups?: PendingBodyManifest["legacyReuseGroups"] }): PendingBodyManifest {
  if (!/^[A-Za-z0-9_-]{1,80}$/u.test(input.runId) || input.targets.length < 1 || input.targets.length > CAP ||
      new Set(input.targets.map((target) => target.articleId)).size !== input.targets.length) throw new Error("invalid pending body manifest scope");
  if (input.snapshot.database !== input.database) throw new Error("manifest database does not match frozen snapshot");
  const perSource = new Map<string, number>();
  for (const target of input.targets) perSource.set(target.sourceId, (perSource.get(target.sourceId) ?? 0) + 1);
  for (const [sourceId, count] of perSource) {
    const source = CATALOG.sources.find((row) => row.id === sourceId);
    const cap = Math.min(10, Number(source?.config?.detail?.maxFetches ?? 0));
    if (!source || !detailConfigIsDirectHtml(source) || count > cap) throw new Error(`per-source target cap exceeds configured direct-detail budget: ${sourceId}`);
  }
  const manifest: PendingBodyManifest = { schemaVersion: "nas-pending-body-batch.v1", runId: input.runId,
    operatorSha256: sha256(input.operatorBytes), catalogSha256: sha256(input.catalogBytes ?? CATALOG_BYTES), database: input.database,
    snapshot: input.snapshot, snapshotSha256: sha256(stableJson(input.snapshot)),
    selection: { strategy: input.selectionStrategy ?? "explicit-article-ids", articleIds: input.targets.map((target) => target.articleId),
      excludedResponseUrlCount: input.excludedResponseUrlEvidence?.entries.length ?? 0,
      excludedResponseUrlEvidenceSha256: input.excludedResponseUrlEvidence?.sha256 ?? sha256(stableJson([])),
      excludedResponseUrlEntriesSha256: sha256(stableJson(input.excludedResponseUrlEvidence?.entries ?? [])),
      excludedResponseUrls: input.excludedResponseUrlEvidence?.entries ?? [],
      ...(input.legacyInventorySha256 ? { legacyInventorySha256: input.legacyInventorySha256 } : {}) }, targets: input.targets };
  if (input.legacyReuseGroups) manifest.legacyReuseGroups = input.legacyReuseGroups;
  return manifest;
}

/** Enforces one actual dispatch at a time and the minimum interval, with auditable timestamps. */
export async function capturePendingBodies(input: {
  targets: PendingTarget[]; sources: Map<string, Record<string, any>>; captureDir: string;
  fetchDetail: (url: string, source: any, need: any, options: any) => Promise<any>;
  makeFetcher: (budget: any) => (url: string, options: any) => Promise<any>;
  allowed: (url: string, source: any) => boolean;
  publicUrl: (url: string) => Promise<unknown>;
  now?: () => Date; wait?: (ms: number) => Promise<void>;
}): Promise<PendingCaptureRecord[]> {
  if (input.targets.length < 1 || input.targets.length > CAP) throw new Error("capture requires 1–50 frozen targets");
  mkdirSync(input.captureDir, { recursive: true, mode: 0o700 });
  const prior = new Map<string, PendingCaptureRecord>();
  const attempted = new Map<string, { articleId: string; url: string; intentAt: string }>();
  const priorDispatches: number[] = [];
  for (const name of readdirSync(input.captureDir)) {
    if (!name.endsWith(".json")) continue;
    const pathName = path.join(input.captureDir, name);
    if (lstatSync(pathName).isSymbolicLink()) throw new Error("capture evidence may not be a symlink");
    const evidence = JSON.parse(readFileSync(pathName, "utf8"));
    if (evidence.schemaVersion === "nas-pending-body-dispatch-intent.v1" && typeof evidence.url === "string") {
      const intentAt = Date.parse(String(evidence.intentAt ?? ""));
      if (!/^[A-Za-z0-9_-]{1,80}$/u.test(String(evidence.articleId ?? "")) || evidence.method !== "GET" || !Number.isFinite(intentAt)) {
        throw new Error("prior dispatch intent is incomplete or has an invalid timestamp; refusing another GET");
      }
      if (attempted.has(evidence.url)) throw new Error("duplicate dispatch intent for one exact URL is ambiguous");
      attempted.set(evidence.url, { articleId: evidence.articleId, url: evidence.url, intentAt: String(evidence.intentAt ?? "") });
      priorDispatches.push(intentAt);
      continue;
    }
    for (const row of evidence.records ?? []) if (typeof row.url === "string") {
      const dispatchedAt = Date.parse(String(row.dispatchedAt ?? ""));
      const completedAt = Date.parse(String(row.completedAt ?? ""));
      if (!Number.isFinite(dispatchedAt) || !Number.isFinite(completedAt) || completedAt < dispatchedAt || row.method !== "GET" || row.responseUrl !== row.url) {
        throw new Error("prior capture timestamps or request identity are invalid; refusing another GET");
      }
      if (prior.has(row.url)) throw new Error("duplicate capture metadata for one exact URL is ambiguous");
      prior.set(row.url, row);
      priorDispatches.push(dispatchedAt);
    }
  }
  const records: PendingCaptureRecord[] = [];
  let lastDispatch = priorDispatches.length ? Math.max(...priorDispatches) : Number.NEGATIVE_INFINITY;
  for (const target of input.targets) {
    const priorIntent = attempted.get(target.url);
    const priorCapture = prior.get(target.url);
    if (priorIntent && priorIntent.articleId !== target.articleId || priorCapture && priorCapture.articleId !== target.articleId) {
      throw new Error(`prior dispatch/capture identity conflicts with ${target.articleId}`);
    }
    if (attempted.has(target.url) && !prior.has(target.url)) throw new Error(`previous dispatch for ${target.articleId} has no complete capture; refusing a second GET`);
    if (prior.has(target.url)) {
      const old = prior.get(target.url)!;
      const bodyPath = path.resolve(input.captureDir, old.file);
      if (old.articleId !== target.articleId || old.eof !== true || old.status !== 200 || !bodyPath.startsWith(`${path.resolve(input.captureDir)}${path.sep}`) ||
          lstatSync(bodyPath).isSymbolicLink() || !statSync(bodyPath).isFile() ||
          (process.platform !== "win32" && (statSync(bodyPath).mode & 0o777) !== 0o600) || sha256(readFileSync(bodyPath)) !== old.bodySha256) {
        throw new Error(`existing capture is invalid or ambiguous for ${target.articleId}`);
      }
      records.push(old); continue;
    }
    const source = input.sources.get(target.sourceId);
    if (!source) throw new Error(`target source is missing: ${target.sourceId}`);
    await validatePendingTarget(source, { ...target, body_status: "pending", body_text: null, body_html: null },
      { catalogSource: CATALOG.sources.find((row) => row.id === target.sourceId), allowed: input.allowed, publicUrl: input.publicUrl });
    const before = (input.now ?? (() => new Date()))();
    const remaining = MIN_INTERVAL_MS - (before.getTime() - lastDispatch);
    if (Number.isFinite(remaining) && remaining > 0) {
      const wait = input.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
      await wait(remaining);
    }
    let dispatchedAt: Date | undefined;
    let intentAt: string | undefined;
    const budget = { beforeDispatch: ({ url, method, redirectHop }: any) => {
      if (method !== "GET" || redirectHop !== 0 || url.href !== target.url) throw new Error(`out-of-scope detail dispatch for ${target.articleId}`);
      const intentTime = (input.now ?? (() => new Date()))();
      intentAt = intentTime.toISOString();
      writePrivate(path.join(input.captureDir, `dispatch-intent-${target.articleId}.json`), { schemaVersion: "nas-pending-body-dispatch-intent.v1",
        articleId: target.articleId, sourceId: target.sourceId, method: "GET", url: target.url, intentAt });
      dispatchedAt = (input.now ?? (() => new Date()))();
      if (lastDispatch !== Number.NEGATIVE_INFINITY && dispatchedAt.getTime() - lastDispatch < MIN_INTERVAL_MS) throw new Error("detail dispatch interval is below 1100ms");
      lastDispatch = dispatchedAt.getTime();
    }, allowRedirect: () => false };
    const runBudget = { ...budget };
    let rawResponse: any;
    let fetchError: unknown;
    const baseFetcher = input.makeFetcher(runBudget);
    const captureFetcher = async (url: string, options: any) => {
      if (url !== target.url) throw new Error(`detail fetcher URL differs from frozen target ${target.articleId}`);
      try {
        rawResponse = await baseFetcher(url, { ...options, timeoutMs: Math.min(TIMEOUT_MS, options.timeoutMs ?? TIMEOUT_MS),
          maxBytes: Math.min(MAX_DETAIL_BYTES, options.maxBytes ?? MAX_DETAIL_BYTES), maxRedirects: 0, runBudget });
      } catch (error) { fetchError = error; throw error; }
      return rawResponse;
    };
    let parseError: unknown;
    try {
      await input.fetchDetail(target.url, source, { date: true, title: true, summary: false, body: true,
        expectedTitle: target.title, expectedPublishedAt: target.publishedAt ? new Date(target.publishedAt) : undefined },
      { runBudget, fetcher: captureFetcher });
    } catch (error) { parseError = error; }
    const completedAt = (input.now ?? (() => new Date()))();
    const response = rawResponse;
    if (!dispatchedAt || !response || response.url !== target.url || !Number.isInteger(response.status) ||
        response.status < 100 || response.status > 599 || !Buffer.isBuffer(response.body) || response.body.length > MAX_DETAIL_BYTES) {
      const failure = safeCaptureFailure(fetchError ?? parseError);
      writePrivate(path.join(input.captureDir, `capture-failure-${target.articleId}.json`), {
        schemaVersion: "nas-pending-body-capture-failure.v1", articleId: target.articleId, sourceId: target.sourceId,
        method: "GET", url: target.url, intentAt: intentAt ?? null,
        stage: "fetcher-did-not-return-complete-bounded-response", responseEnvelopePresent: !!response,
        ...failure,
      });
      throw new Error(`detail response lacks complete bounded raw bytes for ${target.articleId}`);
    }
    const file = `responses/${target.articleId}-${sha256(target.url).slice(0, 12)}.body`;
    const bodyPath = path.join(input.captureDir, file);
    mkdirSync(path.dirname(bodyPath), { recursive: true, mode: 0o700 });
    writeFileSync(bodyPath, response.body, { flag: "wx", mode: 0o600 });
    const record: PendingCaptureRecord = { articleId: target.articleId, sourceId: target.sourceId, url: target.url, method: "GET",
      dispatchedAt: dispatchedAt.toISOString(), completedAt: completedAt.toISOString(), status: response.status,
      responseUrl: response.url, contentType: response.headers?.get?.("content-type") ?? null,
      contentEncoding: response.headers?.get?.("content-encoding") ?? "identity", bytes: response.body.length,
      bodyEncoding: "identity", bodyRepresentation: "undici-decoded",
      originContentEncoding: response.headers?.get?.("content-encoding") ?? "identity",
      bodySha256: sha256(response.body), eof: true, file, networkEvidenceKind: "fresh-dispatch" };
    records.push(record);
    writeFileSync(path.join(input.captureDir, `capture-${target.articleId}.json`), `${JSON.stringify({ schemaVersion: "nas-pending-body-capture.v1", records: [record] }, null, 2)}\n`,
      { flag: "wx", mode: 0o600 });
    if (parseError && !response.body.length) throw parseError;
  }
  return records;
}

export async function parsePendingCapture(input: { manifest: PendingBodyManifest; records: PendingCaptureRecord[]; captureDir: string;
  sources: Map<string, Record<string, any>>; fetchDetail: (url: string, source: any, need: any, options: any) => Promise<any> }): Promise<{
    proposals: CandidateBodyCasRow[]; holds: Array<{ articleId: string; reason: string; bodySha256: string | null }>;
  }> {
  const proposals: CandidateBodyCasRow[] = [];
  const holds: Array<{ articleId: string; reason: string; bodySha256: string | null }> = [];
  for (const target of input.manifest.targets) {
    const capture = input.records.find((row) => row.articleId === target.articleId);
    if (!capture || capture.url !== target.url || capture.responseUrl !== target.url || capture.method !== "GET" ||
        capture.status !== 200 || capture.eof !== true || !/^text\/html(?:\s*;|$)/iu.test(capture.contentType ?? "")) {
      holds.push({ articleId: target.articleId, reason: "capture_missing_or_incomplete", bodySha256: capture?.bodySha256 ?? null }); continue;
    }
    const capturePath = path.resolve(input.captureDir, capture.file);
    if (!capturePath.startsWith(`${path.resolve(input.captureDir)}${path.sep}`) || lstatSync(capturePath).isSymbolicLink()) throw new Error("capture file path is unsafe");
    const raw = readFileSync(capturePath);
    if (raw.length !== capture.bytes || raw.length > MAX_DETAIL_BYTES || sha256(raw) !== capture.bodySha256) throw new Error(`capture bytes/hash differ for ${target.articleId}`);
    const source = input.sources.get(target.sourceId);
    if (!source) throw new Error(`target source is missing: ${target.sourceId}`);
    let got: any;
    try {
      let bodyEncoding: string | null;
      if (capture.bodyRepresentation === "undici-decoded") {
        if (capture.bodyEncoding !== "identity") throw new Error("undici-decoded capture must bind identity body bytes");
        if ((capture.originContentEncoding ?? "identity") !== (capture.contentEncoding ?? "identity")) {
          throw new Error("origin content-encoding differs from recorded response header");
        }
        bodyEncoding = capture.bodyEncoding;
      } else if (capture.bodyRepresentation === undefined && capture.bodyEncoding === undefined) {
        bodyEncoding = capture.contentEncoding;
      } else {
        throw new Error("unsupported or ambiguous captured body representation");
      }
      const text = decodePendingCapturedResponse(raw, capture.contentType, bodyEncoding);
      const fakeResponse = { status: capture.status, url: capture.responseUrl, headers: new Headers({ "content-type": capture.contentType ?? "text/html" }),
        body: Buffer.from(text), text: () => text };
      got = await input.fetchDetail(target.url, source, { date: true, title: true, summary: false, body: true,
        expectedTitle: target.title, expectedPublishedAt: target.publishedAt ? new Date(target.publishedAt) : undefined },
      { fetcher: async () => fakeResponse });
    } catch { holds.push({ articleId: target.articleId, reason: "offline_parse_failed", bodySha256: capture.bodySha256 }); continue; }
    const detail = got.body;
    const offset = String(source.config.detail.publishedAtUtcOffset ?? source.config.publishedAtUtcOffset ?? "+08:00");
    if (!detail?.text?.trim() || !detail.html?.trim()) { holds.push({ articleId: target.articleId, reason: "body_selector_declined", bodySha256: capture.bodySha256 }); continue; }
    if (got.title !== target.title) { holds.push({ articleId: target.articleId, reason: "detail_title_mismatch", bodySha256: capture.bodySha256 }); continue; }
    if (!target.publishedAt || !got.publishedAt || !sameConfiguredDay(new Date(target.publishedAt), got.publishedAt, offset)) {
      holds.push({ articleId: target.articleId, reason: "detail_date_mismatch", bodySha256: capture.bodySha256 }); continue;
    }
    const bodyText = detail.text.trim();
    const bodyHtml = detail.html;
    const textModule = await import(appModule("packages/backend/src/lib/text.ts"));
    const nextContentHash = sha256([textModule.collapseWhitespace(target.title), textModule.collapseWhitespace(bodyText),
      textModule.collapseWhitespace(target.excerpt ?? "")].join("\u0001"));
    proposals.push({ articleId: target.articleId, expectedRowText: target.rowText, expectedRowSha256: target.rowSha256,
      expectedRevision: target.revision, expectedContentHash: target.contentHash, expectedTitle: target.title,
      expectedExcerpt: target.excerpt, expectedSourceId: target.sourceId, bodyText, bodyHtml,
      bodyTextSha256: sha256(bodyText), bodyHtmlSha256: sha256(bodyHtml), nextContentHash });
  }
  return { proposals, holds };
}

export function buildPendingProposalBundle(manifest: PendingBodyManifest, manifestSha256: string,
  captureRecords: PendingCaptureRecord[], parsed: { proposals: CandidateBodyCasRow[]; holds: Array<{ articleId: string; reason: string; bodySha256: string | null }> }): PendingProposalBundle {
  if (!/^[a-f0-9]{64}$/u.test(manifestSha256)) throw new Error("proposal manifest digest is invalid");
  const captureIds = new Set<string>();
  let previousDispatch = Number.NEGATIVE_INFINITY;
  const freshDispatches = captureRecords.filter((row) => row.networkEvidenceKind !== "legacy-capture");
  const legacyCaptures = captureRecords.filter((row) => row.networkEvidenceKind === "legacy-capture");
  for (const record of [...freshDispatches].sort((a, b) => Date.parse(a.dispatchedAt ?? "") - Date.parse(b.dispatchedAt ?? ""))) {
    const dispatched = Date.parse(record.dispatchedAt ?? "");
    const completed = Date.parse(record.completedAt ?? "");
    if (!Number.isFinite(dispatched) || !Number.isFinite(completed) || completed < dispatched ||
        record.method !== "GET" || record.responseUrl !== record.url || !Number.isInteger(record.status) || record.status < 100 || record.status > 599 || record.eof !== true ||
        record.bytes < 0 || record.bytes > MAX_DETAIL_BYTES ||
        !/^[a-f0-9]{64}$/u.test(record.bodySha256) ||
        (Number.isFinite(previousDispatch) && dispatched - previousDispatch < MIN_INTERVAL_MS) || captureIds.has(record.articleId)) {
      throw new Error(`invalid or out-of-cadence capture evidence for ${record.articleId}`);
    }
    previousDispatch = dispatched;
    captureIds.add(record.articleId);
  }
  for (const record of legacyCaptures) {
    const dispatched = record.dispatchedAt === null ? Number.NaN : Date.parse(record.dispatchedAt);
    const legacyStarted = record.legacySourceManifestStartedAtUtc == null ? Number.NaN : Date.parse(record.legacySourceManifestStartedAtUtc);
    const legacyFinished = record.legacySourceManifestFinishedAtUtc == null ? Number.NaN : Date.parse(record.legacySourceManifestFinishedAtUtc);
    if (record.completedAt !== null || (record.dispatchedAt !== null && !Number.isFinite(dispatched)) ||
        record.method !== "GET" || record.responseUrl !== record.url || !Number.isInteger(record.status) || record.status < 100 || record.status > 599 ||
        record.eof !== true || record.bytes < 0 || record.bytes > MAX_DETAIL_BYTES || !/^[a-f0-9]{64}$/u.test(record.bodySha256) ||
        !/^[a-f0-9]{64}$/u.test(record.legacySourceManifestSha256 ?? "") ||
        !/^[a-f0-9]{64}$/u.test(record.legacyInventorySha256 ?? "") ||
        (record.legacySourceManifestStartedAtUtc != null && !Number.isFinite(legacyStarted)) ||
        (record.legacySourceManifestFinishedAtUtc != null && !Number.isFinite(legacyFinished)) ||
        (Number.isFinite(legacyStarted) && Number.isFinite(legacyFinished) && legacyFinished < legacyStarted) || captureIds.has(record.articleId)) {
      throw new Error(`invalid legacy offline capture evidence for ${record.articleId}`);
    }
    captureIds.add(record.articleId);
  }
  const targetIds = new Set(manifest.targets.map((target) => target.articleId));
  if ([...captureIds].some((id) => !targetIds.has(id)) || parsed.proposals.some((proposal) => !captureIds.has(proposal.articleId)) ||
      parsed.holds.some((hold) => !captureIds.has(hold.articleId))) throw new Error("capture/proposal rows exceed frozen target IDs");
  const capturesSha256 = sha256(stableJson(captureRecords));
  const freshDispatchCount = freshDispatches.length;
  const legacyOfflineCaptureCount = legacyCaptures.length;
  const historicalNetworkCompliance = legacyOfflineCaptureCount ? "UNPROVEN_HISTORICAL_CADENCE" as const : "PASS_FOR_FRESH_DISPATCHES_ONLY" as const;
  const digestInput = { runId: manifest.runId, manifestSha256, capturesSha256, freshDispatchCount, legacyOfflineCaptureCount,
    historicalNetworkCompliance, proposals: parsed.proposals, holds: parsed.holds };
  return { schemaVersion: "nas-pending-body-proposals.v1", ...digestInput, inputSha256: sha256(stableJson(digestInput)) };
}

export function assertOnlyExpectedArticleChanges(beforeArticles: Array<{ id: string; row_text: string }>,
  afterArticles: Array<{ id: string; row_text: string }>, beforeRevisions: Array<{ article_id: string; revision: number; row_text: string }>,
  afterRevisions: Array<{ article_id: string; revision: number; row_text: string }>, proposals: CandidateBodyCasRow[]): void {
  const proposalById = new Map(proposals.map((row) => [row.articleId, row]));
  const beforeById = new Map(beforeArticles.map((row) => [row.id, row.row_text]));
  if (beforeById.size !== beforeArticles.length || afterArticles.length !== beforeArticles.length) throw new Error("article row identity/count changed during pending body CAS");
  for (const row of afterArticles) {
    const beforeText = beforeById.get(row.id);
    if (beforeText === undefined) throw new Error(`unexpected article appeared during body CAS: ${row.id}`);
    const proposal = proposalById.get(row.id);
    if (!proposal) {
      if (row.row_text !== beforeText) throw new Error(`non-target article changed during body CAS: ${row.id}`);
      continue;
    }
    const before = JSON.parse(beforeText);
    const after = JSON.parse(row.row_text);
    const mutable = new Set(["body_text", "body_html", "body_status", "revision", "content_hash", "updated_at"]);
    const beforeKeys = Object.keys(before).sort();
    const afterKeys = Object.keys(after).sort();
    if (stableJson(beforeKeys) !== stableJson(afterKeys) || before.revision !== proposal.expectedRevision ||
        after.revision !== proposal.expectedRevision + 1 || after.body_status !== "ok" ||
        after.body_text !== proposal.bodyText || after.body_html !== proposal.bodyHtml || after.content_hash !== proposal.nextContentHash) {
      throw new Error(`target article has unexpected body CAS fields: ${row.id}`);
    }
    for (const key of beforeKeys) if (!mutable.has(key) && stableJson(before[key]) !== stableJson(after[key])) {
      throw new Error(`non-body article field changed during CAS: ${row.id}.${key}`);
    }
  }
  const beforeRevisionByKey = new Map(beforeRevisions.map((row) => [`${row.article_id}\u0000${row.revision}`, row.row_text]));
  if (beforeRevisionByKey.size !== beforeRevisions.length) throw new Error("revision baseline contains duplicate identities");
  const afterRevisionByKey = new Map(afterRevisions.map((row) => [`${row.article_id}\u0000${row.revision}`, row.row_text]));
  if (afterRevisionByKey.size !== afterRevisions.length || afterRevisionByKey.size !== beforeRevisionByKey.size + proposals.length) {
    throw new Error("article revision identity/count changed unexpectedly during CAS");
  }
  for (const [key, rowText] of beforeRevisionByKey) if (afterRevisionByKey.get(key) !== rowText) {
    throw new Error(`existing article revision changed during CAS: ${key.replace("\u0000", "/")}`);
  }
  const expectedNewKeys = new Set<string>();
  for (const proposal of proposals) {
    const key = `${proposal.articleId}\u0000${proposal.expectedRevision + 1}`;
    expectedNewKeys.add(key);
    const text = afterRevisionByKey.get(key);
    if (!text) throw new Error(`expected article revision was not inserted: ${proposal.articleId}`);
    const row = JSON.parse(text);
    if (row.article_id !== proposal.articleId || row.revision !== proposal.expectedRevision + 1 ||
        row.content_hash !== proposal.nextContentHash || row.title !== proposal.expectedTitle || row.body_text !== proposal.bodyText) {
      throw new Error(`new article revision differs from proposal: ${proposal.articleId}`);
    }
  }
  for (const key of afterRevisionByKey.keys()) if (!beforeRevisionByKey.has(key) && !expectedNewKeys.has(key)) {
    throw new Error(`unexpected article revision inserted during CAS: ${key.replace("\u0000", "/")}`);
  }
}

function assertTargetsHaveNoPriorResponse(targets: PendingTarget[], evidence: ExistingUrlEvidence["entries"]): void {
  const prior = new Set(evidence.map((entry) => entry.url));
  const overlap = targets.find((target) => prior.has(target.url));
  if (overlap) throw new Error(`target has prior detail response/dispatch evidence; route to offline review instead of a new GET: ${overlap.articleId}`);
}

export function verifyFreshBackupProof(proofPath: string, manifest: PendingBodyManifest,
  options: { proposalInputSha256?: string; now?: Date; maxAgeMs?: number; pgRestoreList?: (dumpPath: string) => string; pgRestoreVersion?: string } = {}): { dumpPath: string; proofSha256: string; dumpSha256: string } {
  const proofFile = path.resolve(proofPath);
  if (lstatSync(proofFile).isSymbolicLink() || !statSync(proofFile).isFile() || (process.platform !== "win32" && (statSync(proofFile).mode & 0o777) !== 0o600)) {
    throw new Error("backup proof must be a private mode-600 regular file");
  }
  const proofBytes = readFileSync(proofFile);
  const proof = JSON.parse(proofBytes.toString("utf8"));
  if (proof.schemaVersion !== "nas-pending-body-backup-proof.v1" || proof.database !== manifest.database ||
      (options.proposalInputSha256 && proof.proposalInputSha256 !== options.proposalInputSha256) ||
      proof.snapshotRowsetsSha256 !== sha256(stableJson(manifest.snapshot.rowsets))) throw new Error("backup proof does not bind the frozen database rowsets");
  const dumpPath = path.resolve(path.dirname(proofFile), String(proof.dumpFile ?? ""));
  if (!dumpPath.startsWith(`${path.dirname(proofFile)}${path.sep}`) || lstatSync(dumpPath).isSymbolicLink() ||
      !statSync(dumpPath).isFile() || (process.platform !== "win32" && (statSync(dumpPath).mode & 0o777) !== 0o600)) {
    throw new Error("fresh database dump must be mode 600 and inside the proof directory");
  }
  const dumpBytes = readFileSync(dumpPath);
  const dumpSha256 = sha256(dumpBytes);
  if (dumpBytes.length !== proof.dumpBytes || dumpSha256 !== proof.dumpSha256) throw new Error("database dump bytes/hash differ from backup proof");
  const list = (options.pgRestoreList ?? ((file) => execFileSync("pg_restore", ["--list", file], { encoding: "utf8", timeout: 30_000 })))(dumpPath);
  if (sha256(list) !== proof.pgRestoreListSha256) throw new Error("pg_restore --list output hash differs from backup proof");
  const version = options.pgRestoreVersion ?? execFileSync("pg_restore", ["--version"], { encoding: "utf8", timeout: 5_000 });
  if (!/\b17\./u.test(version)) throw new Error("fresh backup must be verified by PostgreSQL 17 pg_restore");
  const created = Date.parse(proof.createdAt);
  const floor = Math.max(Date.parse(manifest.snapshot.capturedAt), ...((proof.latestCaptureCompletedAt ? [Date.parse(proof.latestCaptureCompletedAt)] : [])));
  const age = (options.now ?? new Date()).getTime() - created;
  if (!Number.isFinite(created) || created < floor || age < 0 || age > (options.maxAgeMs ?? 2 * 60 * 60_000)) {
    throw new Error("backup proof is stale or predates the frozen capture window");
  }
  return { dumpPath, proofSha256: sha256(proofBytes), dumpSha256 };
}

export async function applyPendingBodyCas(sql: any, manifest: PendingBodyManifest, proposals: CandidateBodyCasRow[], execute: boolean): Promise<Array<any>> {
  if (manifest.schemaVersion !== "nas-pending-body-batch.v1" || manifest.snapshotSha256 !== sha256(stableJson(manifest.snapshot)) ||
      proposals.length < 1 || proposals.length > CAP || proposals.some((row) => !manifest.targets.some((target) => target.articleId === row.articleId))) {
    throw new Error("pending body CAS input is outside the frozen v1 scope");
  }
  const ids = manifest.targets.map((target) => target.articleId);
  if (new Set(proposals.map((row) => row.articleId)).size !== proposals.length) throw new Error("pending body proposals contain duplicate IDs");
  return sql.begin(async (tx: any) => {
    await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;
    const identity = (await tx`SELECT current_database() AS database`)[0]?.database;
    if (identity !== manifest.database) throw new Error("pending body CAS database identity changed");
    const sourceRows: Array<{ row_text: string }> = await tx`SELECT to_jsonb(s)::text AS row_text FROM sources s ORDER BY id FOR SHARE`;
    if (sourceRows.length !== manifest.snapshot.rowsets.sources.count || hashRows(sourceRows) !== manifest.snapshot.rowsets.sources.sha256) {
      throw new Error("source config/flags changed before pending body CAS");
    }
    const sourceSafety = (await tx`SELECT count(*)::int AS total, count(*) FILTER (WHERE enabled)::int AS enabled,
      count(*) FILTER (WHERE site_fulltext)::int AS site_fulltext, count(*) FILTER (WHERE syndicate_fulltext)::int AS syndicate FROM sources`)[0];
    if (Number(sourceSafety?.total) < 1 || Number(sourceSafety?.enabled) !== 0 || Number(sourceSafety?.site_fulltext) !== 0 ||
        Number(sourceSafety?.syndicate) !== 0) throw new Error("source collection/fulltext safety flags are not all disabled");
    const { snapshot } = await readPendingSnapshot(tx, ids, async () => undefined, (url, source) =>
      source.config.allowUrlPrefixes.some((prefix: string) => url.startsWith(prefix)));
    if (stableJson(snapshot.counts) !== stableJson(manifest.snapshot.counts) || stableJson(snapshot.rowsets) !== stableJson(manifest.snapshot.rowsets)) {
      throw new Error("pending body baseline rowset changed before CAS");
    }
    const latestGold = Object.fromEntries(Object.entries(snapshot.rowsets).filter(([name]) => name.startsWith("gold_review_")));
    const baselineGold = Object.fromEntries(Object.entries(manifest.snapshot.rowsets).filter(([name]) => name.startsWith("gold_review_")));
    if (stableJson(latestGold) !== stableJson(baselineGold)) throw new Error("protected Gold review rowset changed before CAS");
    const targetById = new Map(manifest.targets.map((target) => [target.articleId, target]));
    const textModule = await import(appModule("packages/backend/src/lib/text.ts"));
    for (const proposal of proposals) {
      const target = targetById.get(proposal.articleId);
      if (!target || proposal.expectedRowText !== target.rowText || proposal.expectedRowSha256 !== target.rowSha256 ||
          sha256(proposal.bodyText) !== proposal.bodyTextSha256 || sha256(proposal.bodyHtml) !== proposal.bodyHtmlSha256 ||
          proposal.expectedRevision !== target.revision || proposal.expectedContentHash !== target.contentHash ||
          proposal.expectedTitle !== target.title || proposal.expectedExcerpt !== target.excerpt || proposal.expectedSourceId !== target.sourceId ||
          proposal.bodyText.trim().length < 40 || !proposal.bodyHtml.trim() ||
          sha256([textModule.collapseWhitespace(target.title), textModule.collapseWhitespace(proposal.bodyText),
            textModule.collapseWhitespace(target.excerpt ?? "")].join("\u0001")) !== proposal.nextContentHash) {
        throw new Error(`proposal does not bind to the frozen article row: ${proposal.articleId}`);
      }
      const rawTarget = JSON.parse(target.rowText);
      if (rawTarget.id !== target.articleId || rawTarget.source_id !== target.sourceId || rawTarget.url !== target.url ||
          rawTarget.revision !== target.revision || rawTarget.content_hash !== target.contentHash || rawTarget.body_status !== "pending" ||
          rawTarget.body_text !== null || rawTarget.body_html !== null) throw new Error(`frozen target row is invalid: ${target.articleId}`);
    }
    if (!execute) return [];
    const articlesBefore: Array<{ id: string; row_text: string }> = await tx`SELECT id, to_jsonb(a)::text AS row_text FROM articles a ORDER BY id`;
    const revisionsBefore: Array<{ article_id: string; revision: number; row_text: string }> = await tx`SELECT article_id, revision, to_jsonb(r)::text AS row_text FROM article_revisions r ORDER BY article_id, revision`;
    const writes = await applyCandidateBodyCas(tx, proposals);
    const articlesAfter: Array<{ id: string; row_text: string }> = await tx`SELECT id, to_jsonb(a)::text AS row_text FROM articles a ORDER BY id`;
    const revisionsAfter: Array<{ article_id: string; revision: number; row_text: string }> = await tx`SELECT article_id, revision, to_jsonb(r)::text AS row_text FROM article_revisions r ORDER BY article_id, revision`;
    assertOnlyExpectedArticleChanges(articlesBefore, articlesAfter, revisionsBefore, revisionsAfter, proposals);
    const after = await readPendingSnapshot(tx, ids, async () => undefined, (url, source) =>
      source.config.allowUrlPrefixes.some((prefix: string) => url.startsWith(prefix)), false);
    for (const relation of PROTECTED_RELATIONS) {
      if (stableJson(after.snapshot.rowsets[relation]) !== stableJson(manifest.snapshot.rowsets[relation])) {
        throw new Error(`protected relation changed during body CAS: ${relation}`);
      }
    }
    for (const relation of ["sources", "article_discoveries"]) {
      if (stableJson(after.snapshot.rowsets[relation]) !== stableJson(manifest.snapshot.rowsets[relation])) throw new Error(`protected rowset changed during CAS: ${relation}`);
    }
    if (after.snapshot.counts.articles !== manifest.snapshot.counts.articles ||
        after.snapshot.counts.revisions !== manifest.snapshot.counts.revisions + writes.length) throw new Error("article/revision counts changed unexpectedly during CAS");
    return writes;
  });
}

export function assertPendingProposalBundle(bundle: PendingProposalBundle, manifestSha256: string): void {
  const digestInput = { runId: bundle.runId, manifestSha256: bundle.manifestSha256, capturesSha256: bundle.capturesSha256,
    freshDispatchCount: bundle.freshDispatchCount, legacyOfflineCaptureCount: bundle.legacyOfflineCaptureCount,
    historicalNetworkCompliance: bundle.historicalNetworkCompliance,
    proposals: bundle.proposals, holds: bundle.holds };
  if (bundle.schemaVersion !== "nas-pending-body-proposals.v1" || bundle.manifestSha256 !== manifestSha256 ||
      !/^[a-f0-9]{64}$/u.test(bundle.capturesSha256) || bundle.inputSha256 !== sha256(stableJson(digestInput))) {
    throw new Error("proposal bundle hash or manifest binding is invalid");
  }
  if (!bundle.proposals.length || bundle.proposals.length > CAP || bundle.proposals.some((proposal) =>
      bundle.holds.some((hold) => hold.articleId === proposal.articleId))) throw new Error("proposal bundle contains invalid body/hold overlap or count");
}

function readPrivateJsonBytes(pathName: string): Buffer {
  const absolute = path.resolve(pathName);
  const metadata = lstatSync(absolute);
  if (metadata.isSymbolicLink() || !metadata.isFile() || (process.platform !== "win32" && (metadata.mode & 0o777) !== 0o600)) {
    throw new Error("operator input must be a private mode-600 regular file");
  }
  return readFileSync(absolute);
}

function assertSnapshotMatches(expected: PendingSnapshot, actual: PendingSnapshot): void {
  if (expected.database !== actual.database || stableJson(expected.counts) !== stableJson(actual.counts) ||
      stableJson(expected.rowsets) !== stableJson(actual.rowsets)) throw new Error("frozen database snapshot drifted; retain captures and prepare a new scope");
}

function existingCaptureUrls(captureDir: string): Set<string> {
  if (!existsSync(captureDir)) return new Set();
  const root = path.resolve(captureDir);
  if (lstatSync(root).isSymbolicLink()) throw new Error("capture directory may not be a symlink");
  const urls = new Set<string>();
  for (const name of readdirSync(root)) {
    if (!name.endsWith(".json")) continue;
    const file = path.join(root, name);
    if (lstatSync(file).isSymbolicLink()) throw new Error("capture metadata may not be a symlink");
    const evidence = JSON.parse(readFileSync(file, "utf8"));
    if (evidence.schemaVersion === "nas-pending-body-dispatch-intent.v1" && typeof evidence.url === "string") urls.add(evidence.url);
    for (const row of evidence.records ?? []) if (typeof row.url === "string") urls.add(row.url);
  }
  return urls;
}

function writePrivate(pathName: string, value: unknown): void {
  mkdirSync(path.dirname(pathName), { recursive: true, mode: 0o700 });
  writeFileSync(pathName, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { mode: { type: "string" }, "article-ids": { type: "string" }, "next-eligible": { type: "boolean" },
    "run-id": { type: "string" }, manifest: { type: "string" }, captures: { type: "string" }, "capture-dir": { type: "string" },
    "exclude-evidence": { type: "string" }, "legacy-evidence": { type: "string" }, "legacy-evidence-sha256": { type: "string" },
    "reuse-prior-captures": { type: "boolean" }, proposals: { type: "string" }, "backup-proof": { type: "string" },
    "approval-sha256": { type: "string" }, out: { type: "string" } }, strict: true });
  const mode = values.mode;
  if (!["prepare", "capture", "legacy-adapt", "offline-parse", "preflight-only", "execute"].includes(String(mode))) {
    throw new Error("mode must be prepare, capture, legacy-adapt, offline-parse, preflight-only or execute");
  }
  if (mode === "prepare" && (Boolean(values["article-ids"]) === Boolean(values["next-eligible"]) || !values["run-id"] || !values.out || !values["exclude-evidence"])) {
    throw new Error("prepare requires (--article-ids <id,id>|--next-eligible), --run-id, --exclude-evidence and --out");
  }
  if (values["reuse-prior-captures"] && (mode !== "prepare" || !values["next-eligible"])) throw new Error("reuse-prior-captures is valid only with --next-eligible prepare");
  if (values["reuse-prior-captures"] && (!values["legacy-evidence"] || values["legacy-evidence-sha256"] !== APPROVED_LEGACY_INVENTORY_SHA256)) {
    throw new Error("reuse-prior-captures requires the exact reviewed --legacy-evidence inventory and SHA-256");
  }
  if (mode === "capture" && (!values.manifest || !values["capture-dir"] || !values.out || !values["approval-sha256"])) throw new Error("capture requires manifest, capture-dir, out and reviewed manifest --approval-sha256");
  if (mode === "offline-parse" && (!values.manifest || !values.captures || !values["capture-dir"] || !values.out)) throw new Error("offline-parse requires manifest, captures, capture-dir and out");
  if (mode === "legacy-adapt" && (!values.manifest || !values["legacy-evidence"] || !values["legacy-evidence-sha256"] ||
      !values["capture-dir"] || !values.out || !values["approval-sha256"])) {
    throw new Error("legacy-adapt requires frozen manifest, reviewed manifest SHA, exact legacy evidence SHA, capture-dir and out");
  }
  if ((mode === "preflight-only" || mode === "execute") && (!values.manifest || !values.proposals || !values["backup-proof"] || !values.out)) {
    throw new Error("preflight-only/execute requires manifest, proposals, backup-proof and out");
  }
  if (mode === "execute" && !values["approval-sha256"]) throw new Error("execute requires exact reviewed proposal --approval-sha256");
  assertRuntimeSafetyFlags(process.env);
  for (const key of SAFETY_FLAGS) process.env[key] = "false";
  process.env.ALLOW_PRIVATE_NETWORK_FETCH = "false";
  process.env.COLLECT_SKIP_JINA = "true";
  process.env.AIHOT_CREDENTIALS_DIR = "/nonexistent-pending-body-credentials";
  for (const key of ["LLM_API_KEY", "OPENAI_API_KEY", "OPENAI_BASE_URL", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY",
    "DASHSCOPE_API_KEY", "EMBEDDING_API_KEY", "JINA_API_KEY", "OCR_API_KEY", "SOCIALDATA_API_KEY", "DAJIALA_API_KEY",
    "FEISHU_APP_ID", "FEISHU_APP_SECRET", "FEISHU_CONTENT_PUSH_WEBHOOK", "FEISHU_INTERNAL_WEBHOOK", "INDEXNOW_KEY",
    "EGRESS_PROXY_URL", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]) delete process.env[key];
  if (mode === "offline-parse" || mode === "legacy-adapt") {
    const manifestBytes = readPrivateJsonBytes(values.manifest!);
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as PendingBodyManifest;
    if (manifest.schemaVersion !== "nas-pending-body-batch.v1" || manifest.operatorSha256 !== sha256(readFileSync(fileURLToPath(import.meta.url))) ||
        manifest.snapshotSha256 !== sha256(stableJson(manifest.snapshot))) throw new Error("manifest version, operator or snapshot hash changed");
    if (mode === "legacy-adapt") {
      const manifestSha256 = sha256(manifestBytes);
      if (values["approval-sha256"] !== manifestSha256) throw new Error("legacy offline import requires reviewed exact manifest SHA-256");
      const inventoryBytes = readPrivateJsonBytes(values["legacy-evidence"]!);
      const inventorySha256 = sha256(inventoryBytes);
      if (inventorySha256 !== APPROVED_LEGACY_INVENTORY_SHA256 || values["legacy-evidence-sha256"] !== inventorySha256 ||
          manifest.selection.legacyInventorySha256 !== inventorySha256) {
        throw new Error("legacy dispatch inventory differs from the independently frozen evidence SHA-256");
      }
      const inventory = JSON.parse(inventoryBytes.toString("utf8"));
      if (inventory.schema !== "nas-pending-capture-inventory.v1" || !Array.isArray(inventory.records) ||
          !Array.isArray(manifest.selection?.excludedResponseUrls)) throw new Error("legacy dispatch inventory or manifest scope schema is invalid");
      const evidenceRoot = path.resolve(ROOT, ".data/fiscal-qa");
      const evidenceEntries = new Map(manifest.selection.excludedResponseUrls.map((entry) => [entry.url, entry]));
      const reuseGroups = new Map((manifest.legacyReuseGroups ?? []).map((group) => [group.articleId, group]));
      if (reuseGroups.size !== (manifest.legacyReuseGroups ?? []).length) throw new Error("legacy reuse manifest repeats a target group");
      const captureDir = path.resolve(values["capture-dir"]!);
      const pendingCopies: Array<{ target: PendingTarget; rawBytes: Buffer; record: PendingCaptureRecord }> = [];
      for (const target of manifest.targets) {
        const excluded = evidenceEntries.get(target.url);
        if (!excluded || excluded.status !== "captured") throw new Error(`legacy frozen scope lacks captured evidence for target ${target.articleId}`);
        const matchingArticles = inventory.records.filter((row: any) => row.exactURL === target.url && row.sourceId === target.sourceId);
        if (matchingArticles.length !== 1) throw new Error(`legacy inventory target identity is missing or duplicated: ${target.articleId}`);
        const article = matchingArticles[0];
        const candidates = reusableIdenticalLegacyDispatchGroup(article, target);
        const frozenGroup = reuseGroups.get(target.articleId);
        const planned = frozenGroup?.candidates ?? (candidates?.length === 1 ? candidates : null);
        if (!candidates || !planned || frozenGroup && (frozenGroup.sourceId !== target.sourceId || frozenGroup.url !== target.url) ||
            stableJson(planned) !== stableJson(candidates)) {
          throw new Error(`legacy complete candidate group differs from the frozen manifest for ${target.articleId}`);
        }
        const verified: Array<{ candidate: LegacyReuseCandidate; evidence: LegacyOfflineCaptureEvidence; rawBytes: Buffer }> = [];
        for (const candidate of planned) {
          const manifestRelative = candidate.manifestPath;
          const approvedManifestSha = LEGACY_MANIFEST_SHA256[manifestRelative];
          if (!approvedManifestSha || approvedManifestSha !== candidate.manifestSha256) {
            throw new Error(`legacy source manifest is outside the reviewed SHA allowlist: ${manifestRelative}`);
          }
          const sourceManifestPath = path.resolve(ROOT, manifestRelative);
          if (!sourceManifestPath.startsWith(`${evidenceRoot}${path.sep}`) || lstatSync(sourceManifestPath).isSymbolicLink()) {
            throw new Error("legacy source manifest path is unsafe");
          }
          const sourceManifestBytes = readFileSync(sourceManifestPath);
          if (sha256(sourceManifestBytes) !== candidate.manifestSha256) throw new Error("legacy source manifest bytes differ from frozen allowlist");
          const sourceRootPath = path.resolve(ROOT, candidate.responsePath);
          if (!sourceRootPath.startsWith(`${evidenceRoot}${path.sep}`) || lstatSync(sourceRootPath).isSymbolicLink() || !statSync(sourceRootPath).isFile()) {
            throw new Error("legacy raw response path is unsafe or missing");
          }
          const rawBytes = readFileSync(sourceRootPath);
          if (rawBytes.length !== candidate.bytes || sha256(rawBytes) !== candidate.bodySha256) {
            throw new Error("legacy raw response bytes differ from frozen inventory");
          }
          const sourceManifest = JSON.parse(sourceManifestBytes.toString("utf8"));
          const dispatches = sourceManifest.dispatches?.filter((item: any) => item.requestId === candidate.requestId) ?? [];
          const dispatch = dispatches[0];
          if (dispatches.length !== 1 || !dispatch?.rawFile) throw new Error("legacy manifest requestId is ambiguous or lacks its raw-file binding");
          const originalRawPath = path.resolve(path.dirname(sourceManifestPath), dispatch.rawFile);
          if (originalRawPath !== sourceRootPath) throw new Error("legacy inventory response path differs from source manifest raw path");
          const evidence = adaptLegacyExecutionDispatch({ target, manifestBytes: sourceManifestBytes, requestId: candidate.requestId,
            rawBytes, file: `responses/legacy-${target.articleId}-${sha256(target.url).slice(0, 12)}.body`,
            expectedManifestSha256: candidate.manifestSha256 });
          if (evidence.bytes !== candidate.bytes || evidence.bodySha256 !== candidate.bodySha256 || evidence.contentType !== candidate.contentType ||
              evidence.contentEncoding !== candidate.contentEncoding) throw new Error("legacy raw response metadata differs from frozen duplicate group");
          verified.push({ candidate, evidence, rawBytes });
        }
        const selected = verified[0];
        if (!selected || verified.some((member) => member.rawBytes.length !== selected.rawBytes.length || sha256(member.rawBytes) !== sha256(selected.rawBytes) ||
            member.evidence.contentType !== selected.evidence.contentType || member.evidence.contentEncoding !== selected.evidence.contentEncoding)) {
          throw new Error("legacy duplicate group does not contain identical complete raw response bytes");
        }
        const captureFile = `responses/legacy-${target.articleId}-${sha256(target.url).slice(0, 12)}.body`;
        const duplicateEvidence = verified.length > 1 ? verified.map((member) => member.candidate) : undefined;
        pendingCopies.push({ target, rawBytes: selected.rawBytes, record: { ...asLegacyOfflineCaptureRecord({ ...selected.evidence, file: captureFile }),
          legacySourceManifestPath: selected.candidate.manifestPath, legacySourceRequestId: selected.candidate.requestId,
          legacySourceRecordIndex: selected.candidate.recordIndex, legacyInventorySha256: inventorySha256,
          ...(duplicateEvidence ? { legacyDuplicateEvidence: duplicateEvidence } : {}) } });
      }
      if (reuseGroups.size && reuseGroups.size !== manifest.targets.length) throw new Error("legacy group lineage must cover every frozen target exactly once");
      if (pendingCopies.length !== manifest.targets.length || new Set(pendingCopies.map((row) => row.target.articleId)).size !== manifest.targets.length) {
        throw new Error("legacy adapter coverage is incomplete or duplicated; no captures were written");
      }
      const records: PendingCaptureRecord[] = [];
      for (const item of pendingCopies) {
        const bodyDestination = path.resolve(captureDir, item.record.file);
        if (!bodyDestination.startsWith(`${captureDir}${path.sep}`)) throw new Error("legacy destination path escapes the private capture directory");
        mkdirSync(path.dirname(bodyDestination), { recursive: true, mode: 0o700 });
        writeFileSync(bodyDestination, item.rawBytes, { flag: "wx", mode: 0o600 });
        records.push(item.record);
      }
      const hasDuplicateLineage = records.some((row) => (row.legacyDuplicateEvidence?.length ?? 0) > 1);
      const output = { schemaVersion: hasDuplicateLineage ? "nas-pending-legacy-captures.v2" : "nas-pending-legacy-captures.v1", manifestSha256,
        legacyInventorySha256: inventorySha256, networkCompliance: "UNPROVEN_HISTORICAL_CADENCE" as const,
        capturesSha256: sha256(stableJson(records)), records };
      writePrivate(path.resolve(values.out!), output);
      console.log(JSON.stringify({ result: "LEGACY_OFFLINE_IMPORT_COMPLETE_NO_NETWORK", runId: manifest.runId,
        targetCount: manifest.targets.length, legacyCaptureCount: records.length, coverageComplete: records.length === manifest.targets.length,
        legacyInventorySha256: inventorySha256, capturesSha256: output.capturesSha256, output: path.resolve(values.out!) }));
      return;
    }
    const capturesBytes = readPrivateJsonBytes(values.captures!);
    const captures = JSON.parse(capturesBytes.toString("utf8"));
    const manifestHasReusePlan = Array.isArray(manifest.legacyReuseGroups) && manifest.legacyReuseGroups.length > 0;
    const manifestHasDuplicateGroup = manifest.legacyReuseGroups?.some((group) => group.candidates.length > 1) ?? false;
    const isFresh = captures.schemaVersion === "nas-pending-body-captures.v1" && !manifestHasReusePlan;
    const singlePlanMatchesRecords = !manifestHasReusePlan || Array.isArray(captures.records) && captures.records.length === manifest.targets.length &&
      captures.records.every((row: any) => {
        const target = manifest.targets.find((item) => item.articleId === row.articleId);
        const group = manifest.legacyReuseGroups!.find((item) => item.articleId === row.articleId);
        const candidate = group?.candidates.length === 1 ? group.candidates[0] : null;
        return !!target && !!group && !!candidate && group.sourceId === target.sourceId && group.url === target.url && row.sourceId === target.sourceId &&
          row.url === target.url && row.legacySourceManifestSha256 === candidate.manifestSha256 &&
          row.legacySourceManifestPath === candidate.manifestPath && row.legacySourceRequestId === candidate.requestId &&
          row.legacySourceRecordIndex === candidate.recordIndex && row.bytes === candidate.bytes && row.bodySha256 === candidate.bodySha256 &&
          row.contentType === candidate.contentType && row.contentEncoding === candidate.contentEncoding;
      });
    const isLegacyV1 = captures.schemaVersion === "nas-pending-legacy-captures.v1" && captures.networkCompliance === "UNPROVEN_HISTORICAL_CADENCE" &&
      !manifestHasDuplicateGroup && singlePlanMatchesRecords && /^[a-f0-9]{64}$/u.test(captures.legacyInventorySha256 ?? "") && captures.records.every((row: any) =>
        row.networkEvidenceKind === "legacy-capture" && row.legacyInventorySha256 === captures.legacyInventorySha256);
    const isLegacyV2 = captures.schemaVersion === "nas-pending-legacy-captures.v2" && captures.networkCompliance === "UNPROVEN_HISTORICAL_CADENCE" &&
      /^[a-f0-9]{64}$/u.test(captures.legacyInventorySha256 ?? "") && Array.isArray(captures.records) &&
      captures.records.every((row: any) => row.networkEvidenceKind === "legacy-capture" && row.legacyInventorySha256 === captures.legacyInventorySha256 &&
        Number.isSafeInteger(row.legacySourceRequestId) && Number.isSafeInteger(row.legacySourceRecordIndex) &&
        typeof row.legacySourceManifestPath === "string" && /^[a-f0-9]{64}$/u.test(row.legacySourceManifestSha256 ?? "")) &&
      Array.isArray(manifest.legacyReuseGroups) && manifestHasDuplicateGroup &&
      captures.records.length === manifest.targets.length && captures.records.every((row: any) => {
        const target = manifest.targets.find((item) => item.articleId === row.articleId);
        const group = manifest.legacyReuseGroups!.find((item) => item.articleId === row.articleId);
        const candidates = group?.candidates ?? [];
        const representative = candidates[0];
        const lineage = row.legacyDuplicateEvidence;
        const duplicatesValid = candidates.length > 1 && Array.isArray(lineage) && lineage.length === candidates.length &&
          stableJson(lineage) === stableJson([...lineage].sort((a: LegacyReuseCandidate, b: LegacyReuseCandidate) =>
            compareText(a.manifestPath, b.manifestPath) || compareText(a.manifestSha256, b.manifestSha256) || a.requestId - b.requestId || a.recordIndex - b.recordIndex)) &&
          stableJson(lineage) === stableJson(candidates) && lineage.every((member: LegacyReuseCandidate) =>
            LEGACY_MANIFEST_SHA256[member.manifestPath] === member.manifestSha256 && Number.isSafeInteger(member.requestId) &&
            Number.isSafeInteger(member.recordIndex) && member.bytes === row.bytes && member.bodySha256 === row.bodySha256 &&
            member.contentType === row.contentType && member.contentEncoding === row.contentEncoding);
        const singletonValid = candidates.length === 1 && lineage === undefined &&
          LEGACY_MANIFEST_SHA256[representative?.manifestPath ?? ""] === representative?.manifestSha256 &&
          representative?.bytes === row.bytes && representative?.bodySha256 === row.bodySha256 &&
          representative?.contentType === row.contentType && representative?.contentEncoding === row.contentEncoding;
        return !!target && !!group && group.sourceId === target.sourceId && group.url === target.url && row.sourceId === target.sourceId && row.url === target.url &&
          row.legacySourceManifestSha256 === representative?.manifestSha256 && row.legacySourceManifestPath === representative?.manifestPath &&
          row.legacySourceRequestId === representative?.requestId && row.legacySourceRecordIndex === representative?.recordIndex &&
          (duplicatesValid || singletonValid);
      });
    if ((!isFresh && !isLegacyV1 && !isLegacyV2) || captures.manifestSha256 !== sha256(manifestBytes) ||
        captures.capturesSha256 !== sha256(stableJson(captures.records))) throw new Error("capture index differs from exact frozen manifest or record bytes");
    const { fetchDetail } = await import(appModule("packages/backend/src/sources/web-list.ts"));
    const sources = new Map(CATALOG.sources.map((source) => [String(source.id), source]));
    const parsed = await parsePendingCapture({ manifest, records: captures.records, captureDir: path.resolve(values["capture-dir"]!), sources, fetchDetail });
    const bundle = buildPendingProposalBundle(manifest, sha256(manifestBytes), captures.records, parsed);
    writePrivate(path.resolve(values.out!), bundle);
    console.log(JSON.stringify({ result: "OFFLINE_PARSE_COMPLETE", proposalInputSha256: bundle.inputSha256,
      proposals: bundle.proposals.length, holds: bundle.holds.length, output: path.resolve(values.out!) }));
    return;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required; no implicit database target");
  const parsedUrl = new URL(databaseUrl);
  const database = decodeURIComponent(parsedUrl.pathname.slice(1));
  if (!(database === "fiscalhot_staging" && parsedUrl.hostname === "db") &&
      (!/^[a-z0-9_]+_(?:test|ci)$/iu.test(database) || !["127.0.0.1", "localhost", "::1", "[::1]"].includes(parsedUrl.hostname))) {
    throw new Error("target must be exact NAS staging or a loopback *_test/_ci database");
  }
  const { sql, closeDb } = await import(appModule("packages/backend/src/db.ts"));
  const { assertPublicUrl } = await import(appModule("packages/backend/src/lib/url.ts"));
  const { allowed, fetchDetail } = await import(appModule("packages/backend/src/sources/web-list.ts"));
  try {
    if (mode === "prepare") {
      const explicitIds = values["article-ids"] ? parsePendingArticleIds(values["article-ids"]) : null;
      const priorBytes = readPrivateJsonBytes(values["exclude-evidence"]!);
      const priorEvidence = parseExistingUrlEvidence(priorBytes);
      let legacyInventoryBytes: Buffer | null = null;
      let legacyInventory: any = null;
      let legacyInventorySha256: string | undefined;
      let legacyReuseGroups: PendingBodyManifest["legacyReuseGroups"];
      if (values["reuse-prior-captures"]) {
        legacyInventoryBytes = readPrivateJsonBytes(values["legacy-evidence"]!);
        legacyInventorySha256 = sha256(legacyInventoryBytes);
        if (legacyInventorySha256 !== APPROVED_LEGACY_INVENTORY_SHA256 || values["legacy-evidence-sha256"] !== legacyInventorySha256) {
          throw new Error("legacy reuse inventory differs from the independently frozen evidence SHA-256");
        }
        legacyInventory = JSON.parse(legacyInventoryBytes.toString("utf8"));
        if (legacyInventory.schema !== "nas-pending-capture-inventory.v1" || !Array.isArray(legacyInventory.records)) {
          throw new Error("legacy reuse inventory schema is invalid");
        }
      }
      const result = await sql.begin(async (tx: any) => {
        await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`;
        const sourceSafety = (await tx`SELECT count(*)::int AS total, count(*) FILTER (WHERE enabled)::int AS enabled,
          count(*) FILTER (WHERE site_fulltext)::int AS site_fulltext, count(*) FILTER (WHERE syndicate_fulltext)::int AS syndicate FROM sources`)[0];
        if (Number(sourceSafety.total) < 1 || Number(sourceSafety.enabled) !== 0 || Number(sourceSafety.site_fulltext) !== 0 || Number(sourceSafety.syndicate) !== 0) {
          throw new Error("source safety flags are not all disabled");
        }
        let ids = explicitIds;
        let selectionStrategy: PendingBodyManifest["selection"]["strategy"] = "explicit-article-ids";
        if (!ids) {
          const pending: Array<any> = await tx`SELECT a.id AS "articleId", a.source_id AS "sourceId", a.url,
            a.published_at::text AS "publishedAt", a.body_status, a.body_text, a.body_html,
            s.enabled, s.site_fulltext, s.syndicate_fulltext, s.kind, s.config FROM articles a JOIN sources s ON s.id = a.source_id
            WHERE a.body_status = 'pending' AND a.body_text IS NULL AND a.body_html IS NULL`;
          const catalogById = new Map(CATALOG.sources.map((source) => [String(source.id), source]));
          const metadataRows = pending.filter((row) => {
            const catalogSource = catalogById.get(row.sourceId);
            return row.enabled === false && row.site_fulltext === false && row.syndicate_fulltext === false &&
              catalogSource && stableJson(row.config) === stableJson(catalogSource.config);
          });
          if (values["reuse-prior-captures"]) {
            const priorCaptured = new Set(priorEvidence.evidence.entries.filter((entry) => entry.status === "captured").map((entry) => entry.url));
            const inventoryRows = new Map<string, any>();
            for (const item of legacyInventory.records) {
              if (typeof item.exactURL === "string" && typeof item.sourceId === "string") {
                const key = `${item.sourceId}\n${item.exactURL}`;
                if (inventoryRows.has(key)) throw new Error("legacy reuse inventory repeats a source/article URL identity");
                inventoryRows.set(key, item);
              }
            }
            const candidateGroups = new Map<string, LegacyReuseCandidate[]>();
            const reusableRows = metadataRows.filter((row) => {
              if (!priorCaptured.has(row.url)) return false;
              const candidates = reusableIdenticalLegacyDispatchGroup(inventoryRows.get(`${row.sourceId}\n${row.url}`), row);
              if (!candidates) return false;
              candidateGroups.set(String(row.articleId), candidates);
              return true;
            });
            ids = selectRoundRobinPendingTargets(reusableRows, CATALOG.sources, CAP);
            const selected = new Set(ids);
            legacyReuseGroups = reusableRows.filter((row) => selected.has(String(row.articleId))).map((row) => ({
              articleId: String(row.articleId), sourceId: String(row.sourceId), url: String(row.url),
              candidates: candidateGroups.get(String(row.articleId))!,
            }));
            selectionStrategy = "source-round-robin-prior-captured-published-desc-id-asc";
          } else {
            ids = selectRoundRobinPendingTargets(metadataRows, CATALOG.sources, CAP, priorEvidence.urls);
            selectionStrategy = "source-round-robin-published-desc-id-asc";
          }
        }
        const { snapshot, targets } = await readPendingSnapshot(tx, ids, async () => undefined, allowed);
        return buildPendingManifest({ runId: values["run-id"]!, operatorBytes: readFileSync(fileURLToPath(import.meta.url)), database,
          snapshot, targets, selectionStrategy, excludedResponseUrlEvidence: { sha256: priorEvidence.sha256, entries: priorEvidence.evidence.entries },
          legacyInventorySha256, legacyReuseGroups });
      });
      writePrivate(path.resolve(values.out!), result);
      console.log(JSON.stringify({ result: "PREPARED_READ_ONLY", runId: result.runId, database: result.database,
        targetCount: result.targets.length, selectionStrategy: result.selection.strategy,
        excludedPriorResponseUrlCount: result.selection.excludedResponseUrlCount,
        excludedPriorResponseUrlEvidenceSha256: result.selection.excludedResponseUrlEvidenceSha256,
        snapshotSha256: result.snapshotSha256, output: path.resolve(values.out!) }));
      return;
    }

    const manifestBytes = readPrivateJsonBytes(values.manifest!);
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as PendingBodyManifest;
    const manifestSha256 = sha256(manifestBytes);
    if (manifest.schemaVersion !== "nas-pending-body-batch.v1" || manifest.operatorSha256 !== sha256(readFileSync(fileURLToPath(import.meta.url))) ||
        manifest.database !== database || manifest.snapshotSha256 !== sha256(stableJson(manifest.snapshot))) throw new Error("manifest version, operator, database or snapshot hash changed");
    if (mode === "capture") {
      if (values["approval-sha256"] !== manifestSha256) throw new Error("public capture requires reviewed exact manifest SHA-256");
      if (!Array.isArray(manifest.selection?.excludedResponseUrls) || manifest.selection.excludedResponseUrlCount !== manifest.selection.excludedResponseUrls.length ||
          !/^[a-f0-9]{64}$/u.test(manifest.selection.excludedResponseUrlEvidenceSha256) ||
          manifest.selection.excludedResponseUrlEntriesSha256 !== sha256(stableJson(manifest.selection.excludedResponseUrls))) {
        throw new Error("manifest lacks frozen prior-response exclusion evidence");
      }
      assertTargetsHaveNoPriorResponse(manifest.targets, manifest.selection.excludedResponseUrls);
      const allowedCaptureSources = new Map(CATALOG.sources.map((source) => [String(source.id), source]));
      const before = await sql.begin(async (tx: any) => {
        await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`;
        const sourceSafety = (await tx`SELECT count(*)::int AS total, count(*) FILTER (WHERE enabled)::int AS enabled,
          count(*) FILTER (WHERE site_fulltext)::int AS site_fulltext, count(*) FILTER (WHERE syndicate_fulltext)::int AS syndicate FROM sources`)[0];
        if (Number(sourceSafety?.total) < 1 || Number(sourceSafety?.enabled) !== 0 || Number(sourceSafety?.site_fulltext) !== 0 ||
            Number(sourceSafety?.syndicate) !== 0) throw new Error("source collection/fulltext safety flags are not all disabled");
        const snap = await readPendingSnapshot(tx, manifest.targets.map((row) => row.articleId), (url) => assertPublicUrl(url, false), allowed);
        assertSnapshotMatches(manifest.snapshot, snap.snapshot);
        return snap;
      });
      const { guardedFetch } = await import(appModule("packages/backend/src/lib/http-fetch.ts"));
      const { config: appConfig } = await import(appModule("packages/backend/src/config.ts"));
      assertDispatchNetworkGuard(appConfig);
      const captureDir = path.resolve(values["capture-dir"]!);
      const oldUrls = existingCaptureUrls(captureDir);
      const records = await capturePendingBodies({ targets: before.targets, sources: allowedCaptureSources, captureDir,
        allowed, publicUrl: (url) => assertPublicUrl(url, false), fetchDetail,
        makeFetcher: (budget) => createBudgetedDetailFetcher(budget, guardedFetch as never) });
      const output = { schemaVersion: "nas-pending-body-captures.v1", manifestSha256, capturesSha256: sha256(stableJson(records)), records };
      writePrivate(path.resolve(values.out!), output);
      console.log(JSON.stringify({ result: "CAPTURE_COMPLETE", runId: manifest.runId, dispatches: records.filter((row) => !oldUrls.has(row.url)).length,
        captureSetSha256: output.capturesSha256, output: path.resolve(values.out!) }));
      return;
    }

    const proposalBytes = readPrivateJsonBytes(values.proposals!);
    const bundle = JSON.parse(proposalBytes.toString("utf8")) as PendingProposalBundle;
    assertPendingProposalBundle(bundle, manifestSha256);
    if (mode === "execute" && values["approval-sha256"] !== bundle.inputSha256) throw new Error("execute requires Root approval of the exact proposal input SHA-256");
    const backup = verifyFreshBackupProof(values["backup-proof"]!, manifest, { proposalInputSha256: bundle.inputSha256 });
    const writes = await applyPendingBodyCas(sql, manifest, bundle.proposals, mode === "execute");
    const report = { schemaVersion: "nas-pending-body-result.v1", result: mode === "execute" ? "COMMITTED" : "PREFLIGHT_PASS_NO_WRITES",
      runId: manifest.runId, database, manifestSha256, proposalInputSha256: bundle.inputSha256,
      backupProofSha256: backup.proofSha256, dumpSha256: backup.dumpSha256, proposalCount: bundle.proposals.length, holdCount: bundle.holds.length,
      writes: writes.length, revisions: writes.map((row: any) => ({ articleId: row.articleId, revision: row.revision })) };
    writePrivate(path.resolve(values.out!), report);
    console.log(JSON.stringify({ ...report, output: path.resolve(values.out!) }));
  } finally { await closeDb(); }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
