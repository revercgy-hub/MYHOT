#!/usr/bin/env node
/** Import independently reviewed native offline summaries through the canonical publication projector. */
import { createHash, randomBytes } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APP_ROOT = path.resolve(process.env.AIHOT_APP_ROOT ?? ROOT);
const appModule = (relative: string) => pathToFileURL(path.resolve(APP_ROOT, relative)).href;
const ACTOR = "fiscal-native-summary-import";
const REASON = "native-offline辅助摘要导入Staging；非人工精选、非Gold、未执行provider pipeline";
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${stableJson(row[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};

export interface NativeSummaryManifestRow {
  articleId: string; sourceId: string; url: string; title: string; publishedAt: string | null;
  revision: number; contentHash: string | null; bodyText: string; bodyTextSha256: string;
  articleRowText: string; articleRowSha256: string; sourceRowText: string; sourceRowSha256: string;
  overrideRowText: null; overrideRowSha256: null; publicationRowText: null; publicationRowSha256: null; analysisCount: 0;
  nativeInput: { title: string; date: string | null; source: { name: string; kind: string; tier: string; firstParty: true; ownerEntityId: string | null };
    url: string; body: string; bodySha256: string; sha256: string };
  prompts: { prefilterSystem: string; prefilterUser: string; summarySystem: ""; summaryUser: string;
    prefilterUserSha256: string; summaryUserSha256: string; prefilterInputSha256: string; summaryInputSha256: string };
}
export interface NativeSummaryManifest {
  schemaVersion: "fiscal.nas-native-summary-manifest.v1"; database: string; preparedAt: string;
  promptVersions: { prefilter: string; summarize: string };
  selection: { maxArticles: 30; ids: string[] }; rows: NativeSummaryManifestRow[];
}
export interface NativeSummaryPromptTools {
  PREFILTER_SYSTEM: string;
  prefilterUser(article: any): string;
  buildArticlePrompt(input: any): string;
  translateInputOf(article: any): any;
  promptVersion(...names: string[]): string;
}
export interface NativeSummaryQaItem {
  articleId: string; inputBodySha256: string;
  prefilterInputSha256: string; summaryInputSha256: string | null;
  prefilter: { label: "PASS" | "BLOCK" | "UNKNOWN"; reason: string; outputSha256: string };
  exclusionReason: string | null;
  titleZh?: string; summaryZh?: string; category?: string; tags?: string[]; outputSha256: string | null;
  selected: false; score: null; reason: null; relevance: "pass" | "block" | "unknown";
  providerReceipt: null; providerPipelineExecuted: false;
}
export interface NativeSummaryQa {
  schemaVersion: "fiscal.nas-native-summary-qa.v1"; result: "PASS_NATIVE_SUMMARY_QA"; independent: true;
  isGold: false; manifestSha256: string; reviewer: string; reviewedAt: string;
  native: { requestedModel: string; sessionId: string; generatedAt: string; executionKind: "native-offline-not-runtime-provider";
    providerReceipt: null; providerPipelineExecuted: false };
  items: NativeSummaryQaItem[];
}

function assertSha(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) throw new Error(`${label} must be a lowercase SHA-256`);
}
function normalizeTitle(value: unknown): string {
  if (typeof value !== "string") throw new Error("native titleZh must be a string");
  const title = value.replace(/\s+/gu, " ").trim();
  if (!title || [...title].length > 300 || !/[\u3400-\u9fff]/u.test(title)) throw new Error("native titleZh must be a concise Chinese title");
  return title;
}
function normalizeSummary(value: unknown): string {
  if (typeof value !== "string") throw new Error("native summaryZh must be a string");
  const summary = value.replace(/\s+/gu, " ").trim();
  if (!summary || [...summary].length > 2000 || !/[\u3400-\u9fff]/u.test(summary)) throw new Error("native summaryZh must be a Chinese summary of at most 2000 characters");
  return summary;
}
function assertDate(value: unknown, label: string): void {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || Date.parse(value) > Date.now() + 60_000) throw new Error(`${label} must be a valid non-future timestamp`);
}
export function summaryOutputSha(item: Pick<NativeSummaryQa["items"][number], "titleZh" | "summaryZh" | "category" | "tags">): string {
  return sha256(stableJson({ titleZh: item.titleZh, summaryZh: item.summaryZh, category: item.category, tags: item.tags }));
}
export function qaItemOutputSha(item: NativeSummaryQaItem): string {
  return sha256(stableJson({ prefilterInputSha256: item.prefilterInputSha256, summaryInputSha256: item.summaryInputSha256,
    label: item.prefilter.label, prefilterReason: item.prefilter.reason, exclusionReason: item.exclusionReason,
    titleZh: item.titleZh ?? null, summaryZh: item.summaryZh ?? null, category: item.category ?? null, tags: item.tags ?? null }));
}
export function validateNativeSummaryQa(manifest: NativeSummaryManifest, manifestSha: string, qa: NativeSummaryQa,
  taxonomy: { CATEGORIES: readonly { key: string }[]; CATEGORY_TAGS: readonly string[]; TOPIC_TAGS: readonly string[]; ENTITY_TAGS: readonly string[] }): NativeSummaryQa["items"] {
  assertSha(manifestSha, "manifest sha256");
  if (qa?.schemaVersion !== "fiscal.nas-native-summary-qa.v1" || qa.result !== "PASS_NATIVE_SUMMARY_QA" || qa.independent !== true ||
      qa.isGold !== false || qa.manifestSha256 !== manifestSha || qa.native?.executionKind !== "native-offline-not-runtime-provider" ||
      qa.native.providerReceipt !== null || qa.native.providerPipelineExecuted !== false || !qa.reviewer?.trim() ||
      !qa.native.requestedModel?.trim() || !qa.native.sessionId?.trim()) throw new Error("native QA provenance does not bind to this manifest");
  assertDate(qa.native.generatedAt, "native generatedAt");
  assertDate(qa.reviewedAt, "native QA reviewedAt");
  if (!Array.isArray(qa.items) || qa.items.length !== manifest.rows.length) throw new Error("native QA item count does not match manifest");
  const ids = new Set<string>();
  const categoryKeys = new Set(taxonomy.CATEGORIES.map((row) => row.key));
  const allowedTags = new Set([...taxonomy.CATEGORY_TAGS, ...taxonomy.TOPIC_TAGS, ...taxonomy.ENTITY_TAGS]);
  const byId = new Map(manifest.rows.map((row) => [row.articleId, row]));
  for (const item of qa.items) {
    const baseline = byId.get(item.articleId);
    if (!baseline || ids.has(item.articleId)) throw new Error(`unexpected or duplicate native QA article ${item.articleId}`);
    ids.add(item.articleId);
    if (item.inputBodySha256 !== baseline.bodyTextSha256 || item.prefilterInputSha256 !== baseline.prompts.prefilterInputSha256) {
      throw new Error(`native prefilter input hash mismatch for ${item.articleId}`);
    }
    if (!item.prefilter || !["PASS", "BLOCK", "UNKNOWN"].includes(item.prefilter.label) || !item.prefilter.reason?.trim() ||
        [...item.prefilter.reason].length > 20 || item.relevance !== item.prefilter.label.toLowerCase() ||
        item.selected !== false || item.score !== null || item.reason !== null ||
        item.providerReceipt !== null || item.providerPipelineExecuted !== false) throw new Error(`invalid native prefilter/provenance state for ${item.articleId}`);
    assertSha(item.prefilter.outputSha256, `prefilter output sha256 for ${item.articleId}`);
    if (item.prefilter.outputSha256 !== sha256(stableJson({ label: item.prefilter.label, reason: item.prefilter.reason }))) {
      throw new Error(`native prefilter output hash mismatch for ${item.articleId}`);
    }
    if (item.prefilter.label === "PASS") {
      if (item.summaryInputSha256 !== baseline.prompts.summaryInputSha256 || item.exclusionReason !== null || typeof item.titleZh !== "string" || typeof item.summaryZh !== "string" ||
          typeof item.category !== "string" || !Array.isArray(item.tags)) throw new Error(`PASS item lacks complete summary/category/tags: ${item.articleId}`);
      item.titleZh = normalizeTitle(item.titleZh);
      item.summaryZh = normalizeSummary(item.summaryZh);
      if (!categoryKeys.has(item.category)) throw new Error(`invalid category for ${item.articleId}`);
      if (item.tags.length < 1 || item.tags.length > 20 || new Set(item.tags).size !== item.tags.length ||
          item.tags.some((tag) => !allowedTags.has(tag))) throw new Error(`invalid tags for ${item.articleId}`);
    } else if (item.summaryInputSha256 !== null || typeof item.exclusionReason !== "string" || !item.exclusionReason.trim() || item.titleZh !== undefined ||
        item.summaryZh !== undefined || item.category !== undefined || item.tags !== undefined) {
      throw new Error(`BLOCK/UNKNOWN must give an exclusion reason and remain unpublished: ${item.articleId}`);
    }
    assertSha(item.outputSha256, `output sha256 for ${item.articleId}`);
    if (item.outputSha256 !== qaItemOutputSha(item)) throw new Error(`native output hash mismatch for ${item.articleId}`);
  }
  return qa.items;
}

export async function prepareNativeSummaryManifest(tx: any, articleIds: string[], now: Date, promptTools: NativeSummaryPromptTools): Promise<NativeSummaryManifest> {
  if (!Array.isArray(articleIds) || articleIds.length < 1 || articleIds.length > 30 || new Set(articleIds).size !== articleIds.length ||
      articleIds.some((id) => !/^[A-Za-z0-9_-]{1,80}$/u.test(id))) throw new Error("prepare requires 1–30 unique article IDs");
  const identity = (await tx`SELECT current_database() AS database`)[0];
  if (!identity || typeof identity.database !== "string") throw new Error("database identity unavailable");
  const rows = await tx`SELECT a.id, a.source_id, a.url, a.title, a.author, a.published_at, a.revision, a.content_hash,
      a.body_status, a.body_text, to_jsonb(a)::text AS article_row_text,
      s.name AS source_name, s.kind AS source_kind, s.tier AS source_tier, s.owner_entity_id,
      s.config AS source_config, to_jsonb(s)::text AS source_row_text,
      (SELECT to_jsonb(o)::text FROM editorial_overrides o WHERE o.article_id=a.id) AS override_row_text,
      (SELECT to_jsonb(p)::text FROM publications p WHERE p.article_id=a.id) AS publication_row_text,
      (SELECT count(*)::int FROM analyses an WHERE an.article_id=a.id) AS analysis_count
    FROM articles a JOIN sources s ON s.id=a.source_id WHERE a.id=ANY(${tx.array(articleIds, 1009)}) ORDER BY a.id`;
  if (rows.length !== articleIds.length) throw new Error("some selected native summary candidates do not exist");
  const sources = await tx`SELECT count(*)::int AS total, count(*) FILTER (WHERE enabled)::int AS enabled,
      count(*) FILTER (WHERE site_fulltext)::int AS fulltext, count(*) FILTER (WHERE syndicate_fulltext)::int AS syndicate
    FROM sources`;
  const flags = sources[0];
  if (flags?.total !== 48 || flags.enabled !== 0 || flags.fulltext !== 0 || flags.syndicate !== 0) throw new Error("all 48 sources must remain disabled with both full-text flags off");
  const manifestRows: NativeSummaryManifestRow[] = rows.map((row: any) => {
    const source = JSON.parse(row.source_row_text);
    if (row.body_status !== "ok" || typeof row.body_text !== "string" || !row.body_text.trim() || row.analysis_count !== 0 ||
        source.enabled !== false || source.site_fulltext !== false || source.syndicate_fulltext !== false || source.participation_mode !== "editorial" || source.first_party !== true ||
        row.override_row_text !== null || row.publication_row_text !== null) throw new Error(`candidate is not a first-import body-ready row: ${row.id}`);
    const articleRowText = row.article_row_text as string, sourceRowText = row.source_row_text as string;
    const nativeInput = { title: row.title, date: row.published_at ? new Date(row.published_at).toISOString() : null,
      source: { name: row.source_name, kind: row.source_kind, tier: row.source_tier, firstParty: true as const,
        ownerEntityId: row.owner_entity_id ?? null }, url: row.url, body: row.body_text, bodySha256: sha256(row.body_text) };
    const article = { id: row.id, revision: Number(row.revision), contentHash: row.content_hash, sourceId: row.source_id,
      title: row.title, url: row.url, author: row.author ?? null, publishedAt: row.published_at ? new Date(row.published_at) : null,
      discoveredAt: null, bodyText: row.body_text, excerpt: null, bodyStatus: row.body_status, xPost: null, media: [],
      source: { name: row.source_name, id: row.source_id, kind: row.source_kind, tier: row.source_tier,
        participationMode: "editorial", firstParty: true, tags: [], ownerEntityId: row.owner_entity_id ?? null,
        fetchesBody: row.source_kind === "web_list" || row.source_config?.fetchPublicContent === true || !!row.source_config?.detail } };
    const prefilterUser = promptTools.prefilterUser(article);
    const summaryUser = promptTools.buildArticlePrompt(promptTools.translateInputOf(article));
    const prompts = { prefilterSystem: promptTools.PREFILTER_SYSTEM, prefilterUser, summarySystem: "" as const, summaryUser,
      prefilterUserSha256: sha256(prefilterUser), summaryUserSha256: sha256(summaryUser),
      prefilterInputSha256: sha256(`${promptTools.PREFILTER_SYSTEM}\u0000${prefilterUser}`), summaryInputSha256: sha256(summaryUser) };
    return { articleId: row.id, sourceId: row.source_id, url: row.url, title: row.title,
      publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
      revision: Number(row.revision), contentHash: row.content_hash, bodyText: row.body_text,
      bodyTextSha256: sha256(row.body_text), articleRowText, articleRowSha256: sha256(articleRowText),
      sourceRowText, sourceRowSha256: sha256(sourceRowText), overrideRowText: null, overrideRowSha256: null,
      publicationRowText: null, publicationRowSha256: null, analysisCount: 0,
      nativeInput: { ...nativeInput, sha256: sha256(stableJson(nativeInput)) }, prompts };
  });
  const promptVersions = { prefilter: promptTools.promptVersion("prefilter"), summarize: promptTools.promptVersion("summarize-article", "summarize-article-empty", "summarize-short-post", "summarize-short-post-quoted", "summarize-long-post", "summarize-long-post-quoted", "identity-context") };
  return { schemaVersion: "fiscal.nas-native-summary-manifest.v1", database: identity.database, promptVersions,
    preparedAt: now.toISOString(), selection: { maxArticles: 30, ids: articleIds }, rows: manifestRows };
}

/** Read-only exact preflight. It requests no row/advisory locks and does not reserve targets for a later apply. */
export async function preflightNativeSummaryImport(sql: any, manifest: NativeSummaryManifest, qa: NativeSummaryQa,
  manifestSha: string, qaSha: string, taxonomy: Parameters<typeof validateNativeSummaryQa>[3],
  promptTools: NativeSummaryPromptTools, now = new Date()) {
  assertManifest(manifest); assertSha(manifestSha, "manifest file sha256"); assertSha(qaSha, "QA file sha256");
  const reviewedItems = validateNativeSummaryQa(manifest, manifestSha, qa, taxonomy);
  return sql.begin(async (tx: any) => {
    await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`;
    const transaction = (await tx`SELECT current_database() AS database, inet_server_addr()::text AS address,
      current_setting('transaction_read_only') AS read_only`)[0];
    if (transaction?.read_only !== "on") throw new Error("native summary preflight requires a read-only transaction");
    if (transaction.database !== manifest.database) throw new Error("manifest and connected database do not match");
    const address = String(transaction.address ?? "").replace(/\/\d+$/u, "");
    const loopbackAddress = ["127.0.0.1", "::1"].includes(address);
    if (manifest.database === "fiscalhot_staging" ? !address || loopbackAddress : !loopbackAddress) {
      throw new Error("database server address does not match the exact staging or loopback-test target");
    }
    const current = await prepareNativeSummaryManifest(tx, manifest.selection.ids, now, promptTools);
    if (current.database !== manifest.database || stableJson(current.selection) !== stableJson(manifest.selection) ||
        stableJson(current.promptVersions) !== stableJson(manifest.promptVersions) ||
        stableJson(current.rows) !== stableJson(manifest.rows)) {
      throw new Error("native summary exact preflight failed: current article/source/body/revision/prompt rows differ from manifest");
    }
    const eligibleArticleIds = reviewedItems.filter((item) => item.prefilter.label === "PASS").map((item) => item.articleId);
    return { result: "NATIVE_SUMMARY_PREFLIGHT_PASS_NO_WRITES", database: manifest.database, manifestSha256: manifestSha,
      qaSha256: qaSha, eligibleArticleIds, excluded: reviewedItems.filter((item) => item.prefilter.label !== "PASS").map((item) => ({
        articleId: item.articleId, prefilterLabel: item.prefilter.label, reason: item.exclusionReason })),
      writes: 0, rowLocksTaken: false, advisoryLockRequested: false, transactionReadOnly: true, applyCalled: false,
      note: "Read-only point-in-time check only; this does not reserve rows or guarantee a later apply will pass CAS." };
  });
}

function assertManifest(manifest: NativeSummaryManifest): void {
  if (manifest?.schemaVersion !== "fiscal.nas-native-summary-manifest.v1" || manifest.selection?.maxArticles !== 30 ||
      !Array.isArray(manifest.rows) || manifest.rows.length < 1 || manifest.rows.length > 30 || manifest.selection.ids.length !== manifest.rows.length ||
      new Set(manifest.rows.map((row) => row.articleId)).size !== manifest.rows.length ||
      !manifest.promptVersions?.prefilter || !manifest.promptVersions?.summarize) throw new Error("invalid or out-of-scope native summary manifest");
  assertDate(manifest.preparedAt, "manifest preparedAt");
  if (!manifest.database.endsWith("_test") && !manifest.database.endsWith("_ci") && manifest.database !== "fiscalhot_staging") throw new Error("manifest database is not an allowed staging/test database");
  if (new Set(manifest.selection.ids).size !== manifest.selection.ids.length) throw new Error("manifest selected IDs must be unique");
  for (const row of manifest.rows) {
    let article: Record<string, any>, source: Record<string, any>;
    try { article = JSON.parse(row.articleRowText); source = JSON.parse(row.sourceRowText); }
    catch { throw new Error(`native summary manifest row JSON is invalid for ${row.articleId}`); }
    if (!manifest.selection.ids.includes(row.articleId) || row.analysisCount !== 0 || row.overrideRowText !== null || row.overrideRowSha256 !== null ||
        row.publicationRowText !== null || row.publicationRowSha256 !== null ||
        !Number.isSafeInteger(row.revision) || row.revision < 1 || !row.url.startsWith("https://") || !row.title.trim() || !row.bodyText.trim() ||
        sha256(row.bodyText) !== row.bodyTextSha256 || sha256(row.articleRowText) !== row.articleRowSha256 || sha256(row.sourceRowText) !== row.sourceRowSha256 ||
        article.id !== row.articleId || article.source_id !== row.sourceId || article.url !== row.url || article.title !== row.title ||
        article.body_status !== "ok" || article.body_text !== row.bodyText || Number(article.revision) !== row.revision || article.content_hash !== row.contentHash ||
        source.id !== row.sourceId || source.enabled !== false || source.site_fulltext !== false || source.syndicate_fulltext !== false ||
        source.participation_mode !== "editorial" || source.first_party !== true || row.nativeInput.title !== row.title ||
        row.nativeInput.date !== row.publishedAt || row.nativeInput.source.name !== source.name || row.nativeInput.source.kind !== source.kind ||
        row.nativeInput.source.tier !== source.tier || row.nativeInput.source.firstParty !== true || row.nativeInput.source.ownerEntityId !== (source.owner_entity_id ?? null) ||
        row.nativeInput.url !== row.url || row.nativeInput.body !== row.bodyText || row.nativeInput.bodySha256 !== row.bodyTextSha256 ||
        row.nativeInput.sha256 !== sha256(stableJson({ title: row.nativeInput.title, date: row.nativeInput.date, source: row.nativeInput.source,
          url: row.nativeInput.url, body: row.nativeInput.body, bodySha256: row.nativeInput.bodySha256 })) ||
        row.prompts.prefilterUserSha256 !== sha256(row.prompts.prefilterUser) || row.prompts.summaryUserSha256 !== sha256(row.prompts.summaryUser) ||
        row.prompts.prefilterInputSha256 !== sha256(`${row.prompts.prefilterSystem}\u0000${row.prompts.prefilterUser}`) ||
        row.prompts.summaryInputSha256 !== sha256(row.prompts.summaryUser) || row.prompts.summarySystem !== "") {
      throw new Error(`invalid native summary manifest baseline for ${row.articleId}`);
    }
  }
}

function assertAllowedDatabaseUrl(value: string): { database: string; hostname: string } {
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.slice(1));
  const loopback = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname);
  const exactStaging = database === "fiscalhot_staging" && url.hostname === "db";
  const testTarget = /_(?:test|ci)$/iu.test(database) && loopback;
  if (!exactStaging && !testTarget) throw new Error("DATABASE_URL must target exact fiscalhot_staging@db or a loopback *_test/*_ci database");
  return { database, hostname: url.hostname };
}

/** Fresh exact row/source CAS and first-import-only projection, owned by one serializable transaction. */
export async function applyNativeSummaryImport(sql: any, manifest: NativeSummaryManifest, qa: NativeSummaryQa,
  manifestSha: string, qaSha: string, taxonomy: Parameters<typeof validateNativeSummaryQa>[3], publishArticleTx: (tx: any, id: string, options?: any) => Promise<any>, now = new Date()) {
  assertManifest(manifest); assertSha(manifestSha, "manifest file sha256"); assertSha(qaSha, "QA file sha256");
  const reviewedItems = validateNativeSummaryQa(manifest, manifestSha, qa, taxonomy);
  const summaries = reviewedItems.filter((item) => item.prefilter.label === "PASS");
  return sql.begin(async (tx: any) => {
    await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;
    const identity = (await tx`SELECT current_database() AS database, inet_server_addr()::text AS address`)[0];
    if (identity?.database !== manifest.database) throw new Error("manifest and connected database do not match");
    const address = String(identity.address ?? "").replace(/\/\d+$/u, "");
    const loopbackAddress = ["127.0.0.1", "::1"].includes(address);
    if (manifest.database === "fiscalhot_staging" ? !address || loopbackAddress : !loopbackAddress) {
      throw new Error("database server address does not match the exact staging or loopback-test target");
    }
    const sourceRows = await tx`SELECT id, enabled, site_fulltext, syndicate_fulltext FROM sources ORDER BY id FOR SHARE`;
    if (sourceRows.length !== 48 || sourceRows.some((row: any) => row.enabled || row.site_fulltext || row.syndicate_fulltext)) {
      throw new Error("source safety flags changed before native summary apply");
    }
    const ids = manifest.rows.map((row) => row.articleId);
    const current = await tx`SELECT a.id, to_jsonb(a)::text AS article_row_text, to_jsonb(s)::text AS source_row_text,
      (SELECT to_jsonb(o)::text FROM editorial_overrides o WHERE o.article_id=a.id) AS override_row_text,
      (SELECT to_jsonb(p)::text FROM publications p WHERE p.article_id=a.id) AS publication_row_text,
      (SELECT count(*)::int FROM analyses an WHERE an.article_id=a.id) AS analysis_count
      FROM articles a JOIN sources s ON s.id=a.source_id WHERE a.id=ANY(${tx.array(ids, 1009)}) ORDER BY a.id FOR UPDATE OF a,s`;
    if (current.length !== manifest.rows.length) throw new Error("native summary target row count changed");
    const currentById = new Map(current.map((row: any) => [row.id, row]));
    for (const row of manifest.rows) {
      const actual: any = currentById.get(row.articleId);
      if (!actual || actual.article_row_text !== row.articleRowText || sha256(actual.article_row_text) !== row.articleRowSha256 ||
          actual.source_row_text !== row.sourceRowText || sha256(actual.source_row_text) !== row.sourceRowSha256 ||
          actual.override_row_text !== null || actual.publication_row_text !== null || actual.analysis_count !== 0) {
        throw new Error(`native summary exact CAS failed for ${row.articleId}`);
      }
    }
    const timestamp = now.toISOString();
    const rowsById = new Map(summaries.map((item) => [item.articleId, item]));
    for (const row of manifest.rows.filter((candidate) => rowsById.has(candidate.articleId))) {
      const item = rowsById.get(row.articleId)!;
      const provenance = { executionKind: "native-offline-not-runtime-provider", requestedModel: qa.native.requestedModel,
        sessionId: qa.native.sessionId, generatedAt: qa.native.generatedAt, prefilterInputSha256: item.prefilterInputSha256,
        summaryInputSha256: item.summaryInputSha256, inputBodySha256: item.inputBodySha256, outputSha256: item.outputSha256,
        prefilter: item.prefilter,
        qaFileSha256: qaSha, manifestSha256: manifestSha,
        providerReceipt: null, providerPipelineExecuted: false, isGold: false, selected: false };
      const article = JSON.parse(row.articleRowText);
      const raw = { ...(article.raw && typeof article.raw === "object" && !Array.isArray(article.raw) ? article.raw : {}), nativeSummaryImport: provenance };
      const rawUpdated = await tx`UPDATE articles SET raw=${tx.json(raw)}, updated_at=now()
        WHERE id=${row.articleId} AND to_jsonb(articles)::text=${row.articleRowText} RETURNING id`;
      if (rawUpdated.length !== 1) throw new Error(`native summary article CAS update failed for ${row.articleId}`);
      const fields = { title: item.titleZh, summary: item.summaryZh, relevance: "pass", category: item.category,
        tags: item.tags, selected: false, score: null, reason: null };
      await tx`INSERT INTO editorial_overrides (article_id, fields, visibility, reason, version, updated_by)
        VALUES (${row.articleId}, ${tx.json(fields)}, 'public', ${REASON}, 1, ${ACTOR})`;
      await publishArticleTx(tx, row.articleId, { now });
      await tx`INSERT INTO audit_log (actor, action, subject, reason, before, after)
        VALUES (${ACTOR}, 'content.override', ${`content:${row.articleId}`}, ${REASON}, NULL,
          ${tx.json({ ...provenance, titleZh: item.titleZh, summaryZh: item.summaryZh, category: item.category, tags: item.tags })})`;
    }
    return { result: summaries.length ? "NATIVE_SUMMARY_IMPORT_COMMITTED" : "NATIVE_SUMMARY_NO_PASS_ITEMS", database: manifest.database, manifestSha256: manifestSha,
      qaSha256: qaSha, qaFileSha256: qaSha, imported: summaries.length, articleIds: summaries.map((item) => item.articleId),
      excluded: reviewedItems.filter((item) => item.prefilter.label !== "PASS").map((item) => ({ articleId: item.articleId,
        prefilterLabel: item.prefilter.label, reason: item.exclusionReason })), appliedAt: timestamp };
  });
}

function argsOf(args: string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    const name = args[i]!;
    if (!name.startsWith("--") || result.has(name)) throw new Error("invalid or duplicate command line option");
    if (name === "--prepare" || name === "--apply" || name === "--preflight-only") { result.set(name, "true"); continue; }
    if (!args[i + 1] || args[i + 1]!.startsWith("--")) throw new Error("invalid or duplicate command line option");
    result.set(name, args[++i]!);
  }
  return result;
}
function writePrivateNew(file: string, contents: string): void {
  const resolved = assertPrivateNewTarget(file);
  writeFileSync(resolved, contents, { flag: "wx", mode: 0o600 });
}
function assertPrivateNewTarget(file: string): string {
  const resolved = path.resolve(file), dataRoot = path.resolve(APP_ROOT, ".data") + path.sep;
  if (!resolved.startsWith(dataRoot)) throw new Error("private manifest and result files must be written under AIHOT_APP_ROOT/.data");
  if (existsSync(resolved)) throw new Error("private output file already exists");
  const directory = path.dirname(resolved);
  mkdirSync(directory, { recursive: true });
  const probe = path.join(directory, `.native-summary-write-probe-${process.pid}-${randomBytes(8).toString("hex")}`);
  let descriptor: number | undefined;
  let created = false;
  try {
    descriptor = openSync(probe, "wx", 0o600);
    created = true;
    writeSync(descriptor, "native-summary-output-preflight");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    if (created && existsSync(probe)) unlinkSync(probe);
  }
  if (existsSync(resolved)) throw new Error("private output file already exists");
  return resolved;
}
async function main(): Promise<void> {
  const args = argsOf(process.argv.slice(2));
  const modeFlags = ["--prepare", "--apply", "--preflight-only"].filter((flag) => args.has(flag));
  if (modeFlags.length !== 1) throw new Error("usage: --prepare --article-ids id,id --out .data/... | --preflight-only --manifest file --manifest-sha256 sha --qa file --qa-sha256 sha --out .data/... | --apply --manifest file --manifest-sha256 sha --qa file --qa-sha256 sha --out .data/...");
  const mode = modeFlags[0] === "--prepare" ? "prepare" : modeFlags[0] === "--apply" ? "apply" : "preflight-only";
  const outputFile = args.get("--out");
  if (!outputFile) throw new Error(`${mode} requires --out`);
  assertPrivateNewTarget(outputFile);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required; no default database is allowed");
  const target = assertAllowedDatabaseUrl(databaseUrl);
  const [{ sql, closeDb }, taxonomy] = await Promise.all([
    import(appModule("packages/backend/src/db.ts")), import(appModule("industry/taxonomy.ts")),
  ]);
  try {
    if (mode === "prepare") {
      if (target.database !== "fiscalhot_staging" && !target.database.endsWith("_test") && !target.database.endsWith("_ci")) throw new Error("prepare only permits staging/test targets");
      const out = args.get("--out"), ids = args.get("--article-ids")?.split(",").map((id) => id.trim()).filter(Boolean) ?? [];
      if (!out || !ids.length) throw new Error("prepare requires --article-ids and --out");
      const [writing, prompts] = await Promise.all([
        import(appModule("packages/backend/src/editorial/writing.ts")), import(appModule("packages/backend/src/editorial/prompts.ts")),
      ]);
      const promptTools: NativeSummaryPromptTools = { PREFILTER_SYSTEM: writing.PREFILTER_SYSTEM,
        prefilterUser: writing.prefilterUser, buildArticlePrompt: writing.buildArticlePrompt,
        translateInputOf: writing.translateInputOf, promptVersion: prompts.promptVersion };
      const manifest = await sql.begin((tx: any) => prepareNativeSummaryManifest(tx, ids, new Date(), promptTools));
      if (manifest.database !== target.database) throw new Error("database URL and connected database mismatch");
      assertManifest(manifest);
      const contents = `${JSON.stringify(manifest, null, 2)}\n`;
      writePrivateNew(out, contents);
      console.log(JSON.stringify({ result: "NATIVE_SUMMARY_MANIFEST_PREPARED", database: target.database,
        manifestSha256: sha256(contents), candidates: ids.length, out }, null, 2));
      return;
    }
    const manifestFile = args.get("--manifest"), manifestSha = args.get("--manifest-sha256"), qaFile = args.get("--qa"), qaSha = args.get("--qa-sha256"), out = args.get("--out");
    if (!manifestFile || !manifestSha || !qaFile || !qaSha || !out) throw new Error(`${mode} requires --manifest, --manifest-sha256, --qa, --qa-sha256, and --out`);
    assertSha(manifestSha, "manifest file sha256"); assertSha(qaSha, "QA file sha256");
    const manifestBytes = readFileSync(path.resolve(manifestFile)), qaBytes = readFileSync(path.resolve(qaFile));
    if (sha256(manifestBytes) !== manifestSha || sha256(qaBytes) !== qaSha) throw new Error("manifest or independent native QA file SHA mismatch");
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as NativeSummaryManifest;
    const qa = JSON.parse(qaBytes.toString("utf8")) as NativeSummaryQa;
    if (manifest.database !== target.database) throw new Error("manifest database does not match DATABASE_URL target");
    let result: any;
    if (mode === "preflight-only") {
      const [writing, prompts] = await Promise.all([
        import(appModule("packages/backend/src/editorial/writing.ts")), import(appModule("packages/backend/src/editorial/prompts.ts")),
      ]);
      const promptTools: NativeSummaryPromptTools = { PREFILTER_SYSTEM: writing.PREFILTER_SYSTEM,
        prefilterUser: writing.prefilterUser, buildArticlePrompt: writing.buildArticlePrompt,
        translateInputOf: writing.translateInputOf, promptVersion: prompts.promptVersion };
      result = await preflightNativeSummaryImport(sql, manifest, qa, manifestSha, qaSha, taxonomy, promptTools);
    } else {
      const { publishArticleTx } = await import(appModule("packages/backend/src/publication/publish.ts"));
      result = await applyNativeSummaryImport(sql, manifest, qa, manifestSha, qaSha, taxonomy, publishArticleTx);
    }
    const contents = `${JSON.stringify(result, null, 2)}\n`;
    writePrivateNew(out, contents);
    console.log(JSON.stringify(result, null, 2));
  } finally { await closeDb(); }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
