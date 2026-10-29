import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { brotliCompressSync, deflateSync, gzipSync } from "node:zlib";
import postgres from "postgres";
import { applyPendingBodyCas, buildPendingManifest, capturePendingBodies, parsePendingArticleIds,
  buildPartialCaptureRecovery, buildPartialCaptureRunResult,
  captureWithPartialRecovery, parsePendingCapture, readPendingSnapshot, selectRoundRobinPendingTargets, validatePendingTarget,
  validatePartialCaptureProposal, validatePartialCaptureRecovery,
  verifyFreshBackupProof, buildPendingProposalBundle, assertPendingProposalBundle, assertRuntimeSafetyFlags,
  parseExistingUrlEvidence, assertOnlyExpectedArticleChanges, assertDispatchNetworkGuard, decodePendingCapturedResponse,
  adaptLegacyExecutionDispatch, asLegacyOfflineCaptureRecord, singleReusableLegacyDispatch, reusableIdenticalLegacyDispatchGroup, timeoutPauseReason, pendingReplaySource,
  type PendingTarget } from "../scripts/fiscal/nas-pending-body-batch.ts";
import { type CandidateBodyCasRow } from "../scripts/fiscal/nas-candidate-body-cas.ts";
import { createBudgetedDetailFetcher, detailConfigIsDirectHtml } from "../scripts/fiscal/nas-candidate-batch.ts";
import { fetchDetail } from "../packages/backend/src/sources/web-list.ts";
import { guardedFetch } from "../packages/backend/src/lib/http-fetch.ts";
import { config } from "../packages/backend/src/config.ts";

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const stableCanonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableCanonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${stableCanonicalJson(row[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};
const catalog = JSON.parse(readFileSync("industry/sources.json", "utf8")).sources as Array<Record<string, any>>;
const source = catalog.find((row) => row.id === "mof-beijing-supervision-dynamics")!;
const sourceFor = (id: string) => catalog.find((row) => row.id === id)!;
const allowed = (url: string, row: Record<string, any>) => row.config.allowUrlPrefixes.some((prefix: string) => url.startsWith(prefix));

test("reviewed saved-body metadata is explicit, limited to two disabled sources, and leaves source rows unchanged", async () => {
  for (const id of ["mof-fujian-supervision-dynamics", "mof-xiamen-supervision-dynamics"]) {
    const original = structuredClone(sourceFor(id)), before = structuredClone(original);
    const article = { id: "reviewed_scope", url: `${original.config.allowUrlPrefixes[0]}202610/t20261012_12345.htm`, body_status: "pending", body_text: null, body_html: null };
    const input = { catalogSource: sourceFor(id), allowed, publicUrl: async () => undefined };
    assert.throws(() => validatePendingTarget(original, article, input), /configured disabled direct-HTML scope/u);
    await validatePendingTarget(original, article, { ...input, reviewedMetadataSourceIds: [id] });
    assert.deepEqual(original, before);
    assert.equal(pendingReplaySource(original, [id]).config.detail.titleSelector, "h2.title_con");
    assert.throws(() => pendingReplaySource({ ...original, enabled: true }, [id]), /scope/u);
    assert.throws(() => pendingReplaySource(original, ["other"]), /unreviewed/u);
    assert.throws(() => pendingReplaySource(original, [id, id]), /unreviewed/u);
    const changed = structuredClone(original); changed.config.detail.bodySelector = "body";
    assert.throws(() => validatePendingTarget(changed, article, { ...input, reviewedMetadataSourceIds: [id] }), /scope/u);
  }
});

test("only a hash-bound manifest opt-in repairs saved response metadata; legacy replay still holds the same body", async () => {
  const reviewed = sourceFor("mof-fujian-supervision-dynamics");
  const title = "财政部福建监管局：开展预算执行核查";
  const url = `${reviewed.config.allowUrlPrefixes[0]}202610/t20261012_12345.htm`;
  const target: PendingTarget = { articleId: "reviewed_body", sourceId: reviewed.id, url, title, publishedAt: "2026-10-12T00:00:00+08:00", revision: 1,
    contentHash: sha256("old"), excerpt: null, sourceRowSha256: sha256("source"), rowText: "{}", rowSha256: sha256("{}") };
  const html = `<html><head><meta name="ArticleTitle" content="${title}"><meta name="PubDate" content="2026-10-12 10:00:00"></head><body><h2 class="title_con">${title}</h2><div class="my_doccontent"><p>${"财政部门检查预算执行情况，核实资金拨付与项目进度，督促整改问题。".repeat(30)}</p></div></body></html>`;
  const bytes = Buffer.from(html), directory = mkdtempSync(path.join(os.tmpdir(), "reviewed-body-metadata-"));
  try {
    writeFileSync(path.join(directory, "capture.body"), bytes);
    const manifest = buildPendingManifest({ runId: "reviewed_body_metadata", operatorBytes: Buffer.from("operator"), database: "fiscalhot_test",
      snapshot: { database: "fiscalhot_test", capturedAt: "2026-10-29T00:00:00Z", counts: {}, rowsets: {} }, targets: [target], reviewedMetadataSourceIds: [reviewed.id] });
    const records = [{ articleId: target.articleId, sourceId: target.sourceId, url, responseUrl: url, method: "GET" as const, status: 200, eof: true,
      bytes: bytes.length, bodySha256: sha256(bytes), contentType: "text/html", contentEncoding: "identity", file: "capture.body", dispatchedAt: null, completedAt: null }];
    const sources = new Map([[reviewed.id, reviewed]]);
    const repaired = await parsePendingCapture({ manifest, records, captureDir: directory, sources, fetchDetail });
    assert.equal(repaired.proposals.length, 1);
    assert.equal(repaired.holds.length, 0);
    const legacy = { ...manifest }; delete legacy.reviewedMetadataSourceIds;
    assert.notEqual(sha256(stableCanonicalJson(manifest)), sha256(stableCanonicalJson(legacy)));
    const old = await parsePendingCapture({ manifest: legacy, records, captureDir: directory, sources, fetchDetail });
    assert.equal(old.proposals.length, 0);
    assert.equal(old.holds[0]?.reason, "detail_title_mismatch");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("reviewed metadata DB regression commits bodies while leaving canonical source rows and protected rowsets unchanged", async (t) => {
  const databaseUrl = process.env.REVIEWED_METADATA_TEST_DATABASE_URL;
  if (!databaseUrl) return t.skip("requires the dedicated loopback fiscalhot_reviewed_metadata_20261029_test DB");
  const parsed = new URL(databaseUrl);
  assert.ok(["127.0.0.1", "localhost"].includes(parsed.hostname));
  assert.equal(parsed.pathname, "/fiscalhot_reviewed_metadata_20261029_test");
  const sql = postgres(databaseUrl, { max: 1 });
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const sourceIds = ["mof-fujian-supervision-dynamics", "mof-xiamen-supervision-dynamics"];
  const ids = sourceIds.map((_, index) => `reviewed_meta_${suffix}_${index}`);
  try {
    for (const [index, id] of ids.entries()) {
      const row = sourceFor(sourceIds[index]!);
      await sql`INSERT INTO articles(id,source_id,identity_key,url,title,published_at,discovered_at,timeline_at,revision,content_hash,body_status)
        VALUES(${id},${row.id},${`url:https://example.invalid/${id}`},${`${row.config.allowUrlPrefixes[0]}${id}.htm`},${`隔离metadata正文 ${index}`},'2026-10-12',now(),now(),1,${sha256(id)},'pending')`;
      await sql`INSERT INTO article_revisions(article_id,revision,content_hash,title,body_text) VALUES(${id},1,${sha256(id)},${`隔离metadata正文 ${index}`},NULL)`;
    }
    await assert.rejects(sql.begin(async tx => readPendingSnapshot(tx, ids, async () => undefined, allowed)), /configured disabled direct-HTML scope/u);
    const frozen = await sql.begin(async tx => { await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`; return readPendingSnapshot(tx, ids, async () => undefined, allowed, true, sourceIds); });
    const manifest = buildPendingManifest({ runId: `reviewed_meta_${suffix}`, operatorBytes: Buffer.from("operator"), database: parsed.pathname.slice(1),
      snapshot: frozen.snapshot, targets: frozen.targets, reviewedMetadataSourceIds: sourceIds });
    const bodyText = "财政部门核验预算执行和资金拨付情况，检查原始凭证并督促相关单位整改。".repeat(3);
    const proposals: CandidateBodyCasRow[] = frozen.targets.map(target => ({ articleId: target.articleId, expectedRowText: target.rowText,
      expectedRowSha256: target.rowSha256, expectedRevision: target.revision, expectedContentHash: target.contentHash,
      expectedTitle: target.title, expectedExcerpt: target.excerpt, expectedSourceId: target.sourceId, bodyText, bodyHtml: `<p>${bodyText}</p>`,
      bodyTextSha256: sha256(bodyText), bodyHtmlSha256: sha256(`<p>${bodyText}</p>`),
      nextContentHash: sha256([target.title.replace(/\s+/gu, " ").trim(), bodyText, target.excerpt ?? ""].join("\u0001")) }));
    assert.deepEqual(await applyPendingBodyCas(sql, manifest, proposals, false), []);
    assert.equal((await applyPendingBodyCas(sql, manifest, proposals, true)).length, 2);
    const after = await sql.begin(tx => readPendingSnapshot(tx, ids, async () => undefined, allowed, false, sourceIds));
    for (const name of Object.keys(frozen.snapshot.rowsets).filter(name => !["articles", "revisions"].includes(name))) assert.deepEqual(after.snapshot.rowsets[name], frozen.snapshot.rowsets[name]);
    const rows = await sql`SELECT revision,body_status,body_text FROM articles WHERE id=ANY(${sql.array(ids,1009)})`;
    assert.ok(rows.every(row => row.revision === 2 && row.body_status === "ok" && row.body_text === bodyText));
  } finally {
    await sql`DELETE FROM article_revisions WHERE article_id=ANY(${sql.array(ids,1009)})`;
    await sql`DELETE FROM articles WHERE id=ANY(${sql.array(ids,1009)})`;
    await sql.end();
  }
});

test("pending IDs and next-batch selection stay bounded and metadata-only", () => {
  assert.deepEqual(parsePendingArticleIds("one, two"), ["one", "two"]);
  assert.throws(() => parsePendingArticleIds("same,same"), /unique/);
  assert.throws(() => parsePendingArticleIds(Array.from({ length: 51 }, (_, i) => `id${i}`).join(",")), /1–50/);
  const rows = [
    { articleId: "a_late", sourceId: source.id, url: `${source.config.allowUrlPrefixes[0]}a.html`, publishedAt: "2026-10-21T12:00:00Z" },
    { articleId: "a_early", sourceId: source.id, url: `${source.config.allowUrlPrefixes[0]}b.html`, publishedAt: "2026-10-20T12:00:00Z" },
    { articleId: "b_first", sourceId: sourceFor("mof-henan-supervision-dynamics").id,
      url: `${sourceFor("mof-henan-supervision-dynamics").config.allowUrlPrefixes[0]}c.html`, publishedAt: "2026-10-19T12:00:00Z" },
    { articleId: "unsupported", sourceId: "mof-budget-work", url: "https://yss.mof.gov.cn/gongzuodongtai/x.html", publishedAt: "2026-10-22T00:00:00Z" },
    { articleId: "undated", sourceId: source.id, url: `${source.config.allowUrlPrefixes[0]}d.html`, publishedAt: null },
  ];
  assert.deepEqual(selectRoundRobinPendingTargets(rows, catalog, 3), ["a_late", "b_first", "a_early"]);
  const excluded = new Set([rows[0]!.url]);
  assert.deepEqual(selectRoundRobinPendingTargets(rows, catalog, 3, excluded), ["a_early", "b_first"]);
  assert.equal(detailConfigIsDirectHtml(source), true);
});

test("prior actual response evidence is canonical, unique, hash-bound and excluded from fresh GET selection", () => {
  const firstUrl = `${source.config.allowUrlPrefixes[0]}captured.html`;
  const bytes = Buffer.from(JSON.stringify({ schemaVersion: "nas-pending-existing-url-evidence.v1", entries: [
    { url: firstUrl, evidenceSha256: sha256("raw response evidence"), status: "offline-review-required" },
  ] }));
  const parsed = parseExistingUrlEvidence(bytes);
  assert.equal(parsed.urls.has(firstUrl), true);
  assert.equal(parsed.sha256, sha256(bytes));
  assert.throws(() => parseExistingUrlEvidence(Buffer.from(JSON.stringify({ schemaVersion: "nas-pending-existing-url-evidence.v1", entries: [
    { url: firstUrl, evidenceSha256: sha256("a"), status: "captured" }, { url: firstUrl, evidenceSha256: sha256("b"), status: "captured" },
  ] }))), /unsafe or duplicate/);
  assert.throws(() => parseExistingUrlEvidence(Buffer.from(JSON.stringify({ schemaVersion: "nas-pending-existing-url-evidence.v1", entries: [
    { url: "http://user:pass@public.example/private", evidenceSha256: sha256("a"), status: "captured" },
  ] }))), /unsafe or duplicate/);
});

test("pending direct-HTML scope admits only the exact reviewed GovCN JSON-list detail contract", async () => {
  const govcn = sourceFor("govcn-policy-library");
  assert.equal(sha256(readFileSync("industry/sources.json")), "27af3250bbc472ed20019983093b43336cc1967b9ae3193e6b202da4df27ad3f");
  const article = { id: "i758oqu7el8o048ktmhec6qeu", url: "https://www.gov.cn/zhengce/zhengceku/202610/content_7084402.htm",
    body_status: "pending", body_text: null, body_html: null };
  const dbSource = { id: govcn.id, kind: govcn.kind, enabled: govcn.enabled, site_fulltext: govcn.site_fulltext,
    syndicate_fulltext: govcn.syndicate_fulltext, config: structuredClone(govcn.config) };
  let publicUrlChecks = 0;
  const validate = (sourceOverride: Record<string, any> = dbSource, catalogOverride: Record<string, any> = govcn,
    articleOverride: Record<string, any> = article) => validatePendingTarget(sourceOverride, articleOverride, {
      catalogSource: catalogOverride, allowed, publicUrl: async () => { publicUrlChecks += 1; },
    });
  await assert.doesNotReject(validate());
  assert.equal(publicUrlChecks, 1);
  assert.equal(detailConfigIsDirectHtml(govcn), false, "the shared 46-source selector remains web_list-only");
  const govcnTarget: PendingTarget = { articleId: article.id, sourceId: govcn.id, url: article.url, title: "农业农村部通知",
    publishedAt: "2026-10-28T13:55:00.000Z", revision: 1, contentHash: sha256("existing body identity"), excerpt: null,
    sourceRowSha256: sha256("govcn source row"), rowText: JSON.stringify(article), rowSha256: sha256(JSON.stringify(article)) };
  const snapshot = { database: "fiscalhot_staging", capturedAt: new Date().toISOString(), counts: {}, rowsets: {} };
  const manifest = buildPendingManifest({ runId: "govcn_json_detail_test", operatorBytes: Buffer.from("operator"),
    database: "fiscalhot_staging", snapshot, targets: [govcnTarget] });
  assert.deepEqual(manifest.selection.articleIds, [article.id]);
  assert.throws(() => buildPendingManifest({ runId: "govcn_json_detail_cap_test", operatorBytes: Buffer.from("operator"),
    database: "fiscalhot_staging", snapshot, targets: Array.from({ length: 6 }, (_, index) => ({ ...govcnTarget,
      articleId: `govcn_cap_${index}`, url: `https://www.gov.cn/zhengce/zhengceku/202610/content_${7084402 + index}.htm` })) }),
  /per-source target cap/u);
  const changes: Array<(copy: Record<string, any>) => void> = [
    (copy) => { copy.id = "other-json-list"; },
    (copy) => { copy.kind = "web_list"; },
    (copy) => { copy.config.detail.bodySelector = ".other"; },
    (copy) => { copy.config.detail.titleRegex = "<title>(.*?)</title>"; },
    (copy) => { copy.config.detail.publishedAtRegex = ""; },
    (copy) => { copy.config.detail.publishedAtUtcOffset = "Z"; },
    (copy) => { copy.config.summaryIsBody = true; },
    (copy) => { copy.enabled = true; },
    (copy) => { copy.site_fulltext = true; },
    (copy) => { copy.syndicate_fulltext = true; },
    (copy) => { copy.config.detail.attachmentSelector = ".pdf"; },
  ];
  for (const change of changes) {
    const bad = structuredClone(dbSource); change(bad);
    const badCatalog = structuredClone(govcn); badCatalog.config = structuredClone(bad.config);
    badCatalog.id = bad.id; badCatalog.kind = bad.kind;
    assert.throws(() => validate(bad, badCatalog), /source is outside/u);
  }
  for (const url of ["https://www.gov.cn/zhengce/zhengceku/not-a-policy.htm", "https://other.gov.cn/zhengce/zhengceku/202610/content_7084402.htm",
    "https://www.gov.cn/zhengce/zhengceku/202610/content_7084402.htm?redirect=1", "https://www.gov.cn/zhengce/zhengceku/202610/content_7084402.html"]) {
    assert.throws(() => validate(dbSource, govcn, { ...article, url }), /exact official detail pattern/u);
  }
});

test("legacy adapter binds an allowlisted completed GET and leaves completion/cadence explicitly unproven", () => {
  const url = `${source.config.allowUrlPrefixes[0]}legacy-body.html`;
  const target: PendingTarget = { articleId: "legacy_article", sourceId: source.id, url, title: "legacy title",
    publishedAt: "2026-10-21T00:00:00Z", revision: 1, contentHash: sha256("old"), excerpt: null,
    sourceRowSha256: sha256("source"), rowText: "{}", rowSha256: sha256("{}") };
  const rawBytes = Buffer.from("preserved legacy response bytes");
  const request = { requestId: 7, origin: new URL(url).origin, path: `${new URL(url).pathname}`, method: "GET" };
  const startedAtUtc = "2026-10-21T10:00:00.000Z";
  const finishedAtUtc = "2026-10-21T10:01:00.000Z";
  const manifestBytes = Buffer.from(JSON.stringify({ task: "one serial frozen pending-body DB pass; extraction only; no list re-fetch",
    result: "bounded_body_db_completed", startedAtUtc, finishedAtUtc,
    dispatches: [{ ...request, statusCode: 200, contentType: "text/html; charset=utf-8", bytes: rawBytes.length,
      bodySha256: sha256(rawBytes), eof: true, captureTruncated: false, location: null, contentEncoding: "identity", rawFile: "responses/dispatch-007.body" }],
    redirectResponses: [], dispatchBudget: { requests: [
      { ...request, event: "undici:request:create", at: "2026-10-21T10:00:01.000Z" },
      { ...request, event: "undici:client:sendHeaders", at: "2026-10-21T10:00:01.010Z" },
      { ...request, event: "undici:request:headers", at: "2026-10-21T10:00:01.100Z", statusCode: 200 },
    ] } }));
  const evidence = adaptLegacyExecutionDispatch({ target, manifestBytes, requestId: 7, rawBytes,
    file: "responses/legacy_article.body", expectedManifestSha256: sha256(manifestBytes) });
  assert.equal(evidence.dispatchedAt, "2026-10-21T10:00:01.000Z");
  assert.equal(evidence.completedAt, null);
  assert.equal(evidence.networkCompliance, "UNPROVEN_HISTORICAL_CADENCE");
  assert.equal(evidence.bodySha256, sha256(rawBytes));
  const record = { ...asLegacyOfflineCaptureRecord(evidence), legacyInventorySha256: sha256("frozen inventory") };
  assert.equal(record.networkEvidenceKind, "legacy-capture");
  assert.equal(record.completedAt, null);
  assert.throws(() => adaptLegacyExecutionDispatch({ target, manifestBytes, requestId: 7, rawBytes,
    file: "responses/legacy_article.body", expectedManifestSha256: sha256("different manifest") }), /allowlist|safely adapted/);
  const incompleteBytes = Buffer.from(JSON.stringify({ ...JSON.parse(manifestBytes.toString("utf8")),
    dispatches: [{ ...JSON.parse(manifestBytes.toString("utf8")).dispatches[0], eof: false }] }));
  assert.throws(() => adaptLegacyExecutionDispatch({ target, manifestBytes: incompleteBytes, requestId: 7, rawBytes,
    file: "responses/legacy_article.body", expectedManifestSha256: sha256(incompleteBytes) }), /safely adapted/);
  const noTimes = JSON.parse(manifestBytes.toString("utf8"));
  noTimes.task = "48-source serial bounded one-page catalog sweep; preserved detail evidence only";
  delete noTimes.startedAtUtc;
  delete noTimes.finishedAtUtc;
  delete noTimes.dispatchBudget;
  const noTimeBytes = Buffer.from(JSON.stringify(noTimes));
  const noTimeEvidence = adaptLegacyExecutionDispatch({ target, manifestBytes: noTimeBytes, requestId: 7, rawBytes,
    file: "responses/legacy_article.body", expectedManifestSha256: sha256(noTimeBytes) });
  assert.equal(noTimeEvidence.dispatchedAt, null);
  assert.equal(noTimeEvidence.sourceManifestStartedAtUtc, null);
  assert.equal(noTimeEvidence.sourceManifestFinishedAtUtc, null);
  const offlineManifest = buildPendingManifest({ runId: "legacy_no_times", operatorBytes: Buffer.from("operator"), database: "fiscalhot_staging",
    snapshot: { database: "fiscalhot_staging", capturedAt: "2026-10-22T00:00:00Z", counts: {}, rowsets: {} }, targets: [target] });
  const offlineRecord = { ...asLegacyOfflineCaptureRecord(noTimeEvidence), legacyInventorySha256: sha256("inventory") };
  assert.doesNotThrow(() => buildPendingProposalBundle(offlineManifest, sha256("manifest"), [offlineRecord], {
    proposals: [], holds: [{ articleId: target.articleId, reason: "selector hold", bodySha256: sha256(rawBytes) }],
  }));
});

test("legacy-adapt CLI imports complete reviewed scope offline with exact target coverage", (t) => {
  const inventoryPath = ".data/fiscal-qa/pending-capture-inventory-20261022/inventory.json";
  if (!existsSync(inventoryPath)) return t.skip("requires the private frozen legacy capture inventory and response files");
  const inventoryBytes = readFileSync(inventoryPath);
  const inventorySha = sha256(inventoryBytes);
  assert.equal(inventorySha, "a67f047a2e4b90afc7cbcd0b9abe66b9f470dbcaa5da702189b8e5fa06367ee2");
  const inventory = JSON.parse(inventoryBytes.toString("utf8"));
  const prior = readFileSync(".data/fiscal-qa/pending-capture-inventory-20261022/detail-response-exclusions.json");
  const priorEvidence = JSON.parse(prior.toString("utf8"));
  const capturedUrls = new Set(priorEvidence.entries.filter((entry: any) => entry.status === "captured").map((entry: any) => entry.url));
  const eligibleRows = inventory.records.filter((row: any) => capturedUrls.has(row.exactURL) && catalog.some((candidate) => candidate.id === row.sourceId &&
    candidate.kind === "web_list" && detailConfigIsDirectHtml(candidate)) && (reusableIdenticalLegacyDispatchGroup(row,
      { articleId: "test", sourceId: row.sourceId, url: row.exactURL })?.length ?? 0) > 0);
  const rawRecord = eligibleRows.find((row: any) => reusableIdenticalLegacyDispatchGroup(row,
    { articleId: "test", sourceId: row.sourceId, url: row.exactURL })!.length > 1);
  assert.ok(rawRecord);
  const duplicateCandidates = reusableIdenticalLegacyDispatchGroup(rawRecord, { articleId: "test", sourceId: rawRecord.sourceId, url: rawRecord.exactURL })!;
  const rawSingle = eligibleRows.find((row: any) => reusableIdenticalLegacyDispatchGroup(row,
    { articleId: "test", sourceId: row.sourceId, url: row.exactURL })!.length === 1 &&
    (row.sourceId !== rawRecord.sourceId || Number(sourceFor(row.sourceId).config.detail.maxFetches) >= 2));
  assert.ok(rawSingle, "real frozen inventory has a captured singleton suitable for a mixed batch");
  const singleCandidates = reusableIdenticalLegacyDispatchGroup(rawSingle, { articleId: "test", sourceId: rawSingle.sourceId, url: rawSingle.exactURL })!;
  const urlEvidence = priorEvidence.entries.find((row: any) => row.url === rawRecord.exactURL);
  assert.equal(urlEvidence?.status, "captured");
  const dispatch = rawRecord.evidence.responseDispatches[0];
  const sourceBytes = readFileSync(dispatch.responsePath);
  const target: PendingTarget = { articleId: "legacy_cli_duplicate", sourceId: rawRecord.sourceId, url: rawRecord.exactURL,
    title: "fixture title", publishedAt: "2026-10-21T00:00:00Z", revision: 1, contentHash: sha256("old-body"), excerpt: null,
    sourceRowSha256: sha256("source-row"), rowText: "{}", rowSha256: sha256("{}") };
  const singleTarget: PendingTarget = { ...target, articleId: "legacy_cli_single", sourceId: rawSingle.sourceId, url: rawSingle.exactURL };
  const operatorBytes = readFileSync("scripts/fiscal/nas-pending-body-batch.ts");
  const manifest = buildPendingManifest({ runId: "legacy_cli_test", operatorBytes, database: "fiscalhot_staging",
    snapshot: { database: "fiscalhot_staging", capturedAt: "2026-10-22T00:00:00Z", counts: {}, rowsets: {} }, targets: [target, singleTarget],
    selectionStrategy: "source-round-robin-prior-captured-published-desc-id-asc",
    excludedResponseUrlEvidence: { sha256: sha256(prior), entries: priorEvidence.entries }, legacyInventorySha256: inventorySha,
    legacyReuseGroups: [{ articleId: target.articleId, sourceId: target.sourceId, url: target.url, candidates: duplicateCandidates },
      { articleId: singleTarget.articleId, sourceId: singleTarget.sourceId, url: singleTarget.url, candidates: singleCandidates }] });
  const temp = mkdtempSync(path.join(os.tmpdir(), "nas-pending-legacy-cli-"));
  const fixtureRoot = path.join(temp, "root");
  mkdirSync(path.join(fixtureRoot, "industry"), { recursive: true });
  copyFileSync("industry/sources.json", path.join(fixtureRoot, "industry/sources.json"));
  for (const candidate of manifest.legacyReuseGroups!.flatMap((group) => group.candidates)) {
    for (const relative of [candidate.manifestPath, candidate.responsePath]) {
      const destination = path.join(fixtureRoot, relative);
      mkdirSync(path.dirname(destination), { recursive: true });
      copyFileSync(relative, destination);
    }
  }
  const manifestPath = path.join(temp, "manifest.json");
  const outputPath = path.join(temp, "captures.json");
  const captureDir = path.join(temp, "captures");
  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`, { flag: "wx", mode: 0o600 });
  const manifestSha = sha256(readFileSync(manifestPath));
  try {
    const stdout = execFileSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.resolve("scripts/fiscal/nas-pending-body-batch.ts"),
      "--mode=legacy-adapt", `--manifest=${manifestPath}`, `--approval-sha256=${manifestSha}`, `--legacy-evidence=${path.resolve(inventoryPath)}`,
      `--legacy-evidence-sha256=${inventorySha}`, `--capture-dir=${captureDir}`, `--out=${outputPath}`],
      { encoding: "utf8", timeout: 30_000, env: { ...process.env, AIHOT_APP_ROOT: fixtureRoot, MODEL_CALLS_ENABLED: "false" } });
    const report = JSON.parse(stdout.trim());
    assert.equal(report.result, "LEGACY_OFFLINE_IMPORT_COMPLETE_NO_NETWORK");
    assert.equal(report.targetCount, 2);
    assert.equal(report.legacyCaptureCount, 2);
    assert.equal(report.coverageComplete, true);
    const output = JSON.parse(readFileSync(outputPath, "utf8"));
    assert.equal(output.schemaVersion, "nas-pending-legacy-captures.v2");
    assert.equal(output.records.length, manifest.targets.length);
    assert.deepEqual(output.records.map((row: any) => row.articleId), manifest.targets.map((row) => row.articleId));
    assert.equal(output.records[0].bodySha256, sha256(sourceBytes));
    assert.equal(output.records[0].legacyDuplicateEvidence.length, 2);
    assert.equal(output.records[0].legacyDuplicateEvidence[0].manifestPath,
      [...output.records[0].legacyDuplicateEvidence].sort((a: any, b: any) => a.manifestPath.localeCompare(b.manifestPath))[0].manifestPath);
    assert.equal(Object.hasOwn(output.records[1], "legacyDuplicateEvidence"), false, "singleton provenance remains represented without duplicate lineage");
    assert.equal(output.records[1].legacySourceManifestPath, singleCandidates[0]!.manifestPath);
    assert.equal(output.records[0].completedAt, null);
    assert.equal(output.networkCompliance, "UNPROVEN_HISTORICAL_CADENCE");
    const proposalPath = path.join(temp, "proposals.json");
    const parsed = execFileSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.resolve("scripts/fiscal/nas-pending-body-batch.ts"),
      "--mode=offline-parse", `--manifest=${manifestPath}`, `--captures=${outputPath}`, `--capture-dir=${captureDir}`, `--out=${proposalPath}`],
      { encoding: "utf8", timeout: 30_000, env: { ...process.env, AIHOT_APP_ROOT: process.cwd(), MODEL_CALLS_ENABLED: "false" } });
    assert.equal(JSON.parse(parsed.trim()).result, "OFFLINE_PARSE_COMPLETE", "v2 duplicate lineage is accepted only against its frozen manifest group");
    assert.equal(JSON.parse(readFileSync(proposalPath, "utf8")).legacyOfflineCaptureCount, 2);
    const rejectOfflineParse = (captures: any, label: string) => {
      const badCapturesPath = path.join(temp, `${label}-captures.json`);
      const badProposalPath = path.join(temp, `${label}-proposals.json`);
      writeFileSync(badCapturesPath, `${JSON.stringify(captures)}\n`, { flag: "wx", mode: 0o600 });
      assert.throws(() => execFileSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.resolve("scripts/fiscal/nas-pending-body-batch.ts"),
        "--mode=offline-parse", `--manifest=${manifestPath}`, `--captures=${badCapturesPath}`, `--capture-dir=${captureDir}`, `--out=${badProposalPath}`],
        { encoding: "utf8", timeout: 30_000, stdio: "pipe", env: { ...process.env, AIHOT_APP_ROOT: process.cwd(), MODEL_CALLS_ENABLED: "false" } }));
      assert.equal(existsSync(badProposalPath), false, `${label} must not produce a proposal`);
    };
    const downgraded = structuredClone(output);
    downgraded.schemaVersion = "nas-pending-legacy-captures.v1";
    rejectOfflineParse(downgraded, "downgraded-v1");
    const brokenLineage = structuredClone(output);
    brokenLineage.records[0].legacyDuplicateEvidence.pop();
    brokenLineage.capturesSha256 = sha256(stableCanonicalJson(brokenLineage.records));
    rejectOfflineParse(brokenLineage, "truncated-duplicate-lineage");
    const tamperPath = path.join(fixtureRoot, manifest.legacyReuseGroups![0]!.candidates[1]!.responsePath);
    const tampered = readFileSync(tamperPath);
    writeFileSync(tamperPath, Buffer.concat([tampered, Buffer.from("tamper")]));
    const failedCaptureDir = path.join(temp, "tampered-captures");
    const failedOutputPath = path.join(temp, "tampered-captures.json");
    assert.throws(() => execFileSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.resolve("scripts/fiscal/nas-pending-body-batch.ts"),
      "--mode=legacy-adapt", `--manifest=${manifestPath}`, `--approval-sha256=${manifestSha}`, `--legacy-evidence=${path.resolve(inventoryPath)}`,
      `--legacy-evidence-sha256=${inventorySha}`, `--capture-dir=${failedCaptureDir}`, `--out=${failedOutputPath}`],
      { encoding: "utf8", timeout: 30_000, stdio: "pipe", env: { ...process.env, AIHOT_APP_ROOT: fixtureRoot, MODEL_CALLS_ENABLED: "false" } }));
    assert.equal(existsSync(failedOutputPath), false, "no output is written after one group member fails hash verification");
    assert.equal(existsSync(failedCaptureDir) ? readdirSync(failedCaptureDir).length : 0, 0,
      "no representative copy is written before every group member verifies");
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test("duplicate legacy reuse candidate groups fail closed on raw, metadata, URL, origin or completeness differences", () => {
  // Synthetic metadata exercises the group contract without private response files.
  // The approved manifest path is still required by the production guard.
  const manifestPath = ".data/fiscal-qa/catalog-sweep-20261013/evidence/manifest.json";
  const url = `${source.config.allowUrlPrefixes[0]}synthetic-duplicate.html`;
  const record = { exactURL: url, sourceId: source.id, evidence: {
    responseDispatches: [1, 2].map((requestId) => ({ manifestPath, requestId, exactArticleURLRequest: true, requestURL: url,
      method: "GET", statusCode: 200, contentType: "text/html", eof: true, captureTruncated: false, fileExists: true,
      transportComplete: true, fileBytes: 20, declaredBytes: 20, fileSha256: "a".repeat(64), declaredSha256: "a".repeat(64),
      responsePath: `responses/${requestId}.body`, rawFile: `responses/${requestId}.body` })),
    rawCaptures: [1, 2].map((requestId) => ({ file: manifestPath, rawFile: `responses/${requestId}.body`, responseUrl: url,
      fileExists: true, eof: true, captureTruncated: false, completeRaw: true, rawBytes: 20, rawSha256: "a".repeat(64),
      contentType: "text/html", contentEncoding: "gzip", statusCode: 200 })),
  } };
  const target = { articleId: "group_target", sourceId: record.sourceId, url: record.exactURL };
  const first = reusableIdenticalLegacyDispatchGroup(record, target)!;
  assert.equal(first.length, 2);
  assert.deepEqual(first, reusableIdenticalLegacyDispatchGroup(record, target), "candidate ordering is stable");
  const mutations: Array<(copy: any) => void> = [
    (copy) => { copy.evidence.responseDispatches[1].fileSha256 = "0".repeat(64); copy.evidence.responseDispatches[1].declaredSha256 = "0".repeat(64);
      copy.evidence.rawCaptures[1].rawSha256 = "0".repeat(64); },
    (copy) => { copy.evidence.responseDispatches[1].fileBytes += 1; copy.evidence.responseDispatches[1].declaredBytes += 1;
      copy.evidence.rawCaptures[1].rawBytes += 1; },
    (copy) => { copy.evidence.responseDispatches[1].contentType = "text/plain"; copy.evidence.rawCaptures[1].contentType = "text/plain"; },
    (copy) => { copy.evidence.rawCaptures[1].contentEncoding = "identity"; },
    (copy) => { copy.evidence.responseDispatches[1].requestURL = "https://different.example/article"; },
    (copy) => { copy.evidence.responseDispatches[1].statusCode = 206; copy.evidence.rawCaptures[1].statusCode = 206; },
    (copy) => { copy.evidence.rawCaptures[1].eof = false; },
  ];
  for (const mutate of mutations) {
    const copy = structuredClone(record);
    mutate(copy);
    assert.equal(reusableIdenticalLegacyDispatchGroup(copy, target), null);
  }
});

test("post-CAS whole-row verification rejects trigger side effects and unexpected revisions", () => {
  const article = { id: "x", title: "title", body_text: null, body_html: null, body_status: "pending", revision: 1,
    content_hash: "old", updated_at: "old-time", url: "https://example.invalid/a" };
  const proposal = { articleId: "x", expectedRevision: 1, expectedTitle: "title", nextContentHash: "next-hash",
    bodyText: "approved body", bodyHtml: "<p>approved body</p>" } as CandidateBodyCasRow;
  const revision = { article_id: "x", revision: 1, content_hash: "old", title: "title", body_text: null, created_at: "old-time" };
  const inserted = { article_id: "x", revision: 2, content_hash: "next-hash", title: "title", body_text: "approved body", created_at: "new-time" };
  const asText = (value: unknown) => JSON.stringify(value);
  assert.doesNotThrow(() => assertOnlyExpectedArticleChanges([{ id: "x", row_text: asText(article) }],
    [{ id: "x", row_text: asText({ ...article, body_text: "approved body", body_html: "<p>approved body</p>", body_status: "ok",
      revision: 2, content_hash: "next-hash", updated_at: "new-time" }) }],
    [{ article_id: "x", revision: 1, row_text: asText(revision) }],
    [{ article_id: "x", revision: 1, row_text: asText(revision) }, { article_id: "x", revision: 2, row_text: asText(inserted) }], [proposal]));
  assert.throws(() => assertOnlyExpectedArticleChanges([{ id: "x", row_text: asText(article) }],
    [{ id: "x", row_text: asText({ ...article, title: "trigger changed title", body_text: "approved body", body_html: "<p>approved body</p>",
      body_status: "ok", revision: 2, content_hash: "next-hash" }) }],
    [{ article_id: "x", revision: 1, row_text: asText(revision) }],
    [{ article_id: "x", revision: 1, row_text: asText(revision) }, { article_id: "x", revision: 2, row_text: asText(inserted) }], [proposal]), /non-body article field/);
});

test("source guard accepts configured public HTTP or HTTPS only and rejects private/disallowed targets", async () => {
  const url = `${source.config.allowUrlPrefixes[0]}test-article.html`;
  let publicChecks = 0;
  await validatePendingTarget(source, { id: "pending_one", url, body_status: "pending", body_text: null, body_html: null },
    { catalogSource: source, allowed, publicUrl: async (target) => { publicChecks++; assert.equal(target, url); } });
  assert.equal(publicChecks, 1);
  const httpSource = { ...source, config: { ...source.config, url: "http://public.example/list", allowUrlPrefixes: ["http://public.example/articles/"] } };
  await validatePendingTarget(httpSource, { id: "pending_http", url: "http://public.example/articles/1", body_status: "pending", body_text: null, body_html: null },
    { catalogSource: httpSource, allowed: (target, row) => row.config.allowUrlPrefixes.some((prefix: string) => target.startsWith(prefix)), publicUrl: async () => undefined });
  assert.throws(() => validatePendingTarget(source, { id: "pending_bad", url: "https://example.org/outside", body_status: "pending", body_text: null, body_html: null },
    { catalogSource: source, allowed, publicUrl: async () => undefined }), /allowlist/);
  const privateSource = { ...source, config: { ...source.config, url: "http://127.0.0.1/list", allowUrlPrefixes: ["http://127.0.0.1/articles/"] } };
  await assert.rejects(validatePendingTarget(privateSource, { id: "pending_private", url: "http://127.0.0.1/articles/private", body_status: "pending", body_text: null, body_html: null },
    { catalogSource: privateSource, allowed: (target, row) => row.config.allowUrlPrefixes.some((prefix: string) => target.startsWith(prefix)),
      publicUrl: async () => { throw new Error("private URL denied"); } }), /private URL denied/);
  assert.throws(() => validatePendingTarget({ ...source, enabled: true }, { id: "pending_enabled", url, body_status: "pending", body_text: null, body_html: null },
    { catalogSource: source, allowed, publicUrl: async () => undefined }), /disabled direct-HTML scope/);
});

test("pending response decoder caps raw, gzip, deflate, brotli and decoded text sizes", () => {
  const expanded = Buffer.alloc(6 * 1024 * 1024 + 1, 65);
  for (const [encoding, compressed] of [["gzip", gzipSync(expanded)], ["deflate", deflateSync(expanded)], ["br", brotliCompressSync(expanded)]] as const) {
    assert.throws(() => decodePendingCapturedResponse(compressed, "text/html", encoding), /larger|limit|output|buffer/iu, encoding);
  }
  assert.throws(() => decodePendingCapturedResponse(Buffer.alloc(6 * 1024 * 1024 + 1), "text/html", "identity"), /raw-byte limit/iu);
  assert.throws(() => decodePendingCapturedResponse(Buffer.from("small"), "text/html", "zstd"), /unsupported captured content encoding/iu);
});

test("Undici loopback gzip response records decoded body bytes separately from origin encoding", async () => {
  const html = Buffer.from("<!doctype html><html><body>loopback gzip fixture</body></html>");
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-encoding": "gzip" });
    response.end(gzipSync(html));
  });
  const priorPrivateNetworkSetting = config.allowPrivateNetworkFetch;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  config.allowPrivateNetworkFetch = true;
  try {
    const response = await guardedFetch(`http://127.0.0.1:${address.port}/gzip-fixture`, { route: "direct", maxRedirects: 0 });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-encoding"), "gzip");
    assert.deepEqual(response.body, html, "Undici returns transparently decoded bytes");
    assert.notDeepEqual(response.body.subarray(0, 2), Buffer.from([0x1f, 0x8b]));
  } finally {
    config.allowPrivateNetworkFetch = priorPrivateNetworkSetting;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("guardedFetch loopback timeout is an identifiable DOMException TimeoutError", async () => {
  const server = createServer(() => { /* Hold the response until the bounded fetch aborts. */ });
  const priorPrivateNetworkSetting = config.allowPrivateNetworkFetch;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  config.allowPrivateNetworkFetch = true;
  try {
    await assert.rejects(guardedFetch(`http://127.0.0.1:${address.port}/timeout-fixture`, {
      route: "direct", timeoutMs: 50, maxRedirects: 0,
    }), (error: unknown) => error instanceof DOMException && error.name === "TimeoutError");
  } finally {
    config.allowPrivateNetworkFetch = priorPrivateNetworkSetting;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("capture records Undici body and origin encodings separately and preserves fetch failure details privately", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "nas-pending-body-representation-"));
  const target: PendingTarget = { articleId: "representation_one", sourceId: source.id,
    url: `${source.config.allowUrlPrefixes[0]}representation_one.html`, title: "测试标题", publishedAt: "2026-10-21T00:00:00+08:00",
    revision: 1, contentHash: sha256("old"), excerpt: null, sourceRowSha256: sha256("source"), rowText: "{}", rowSha256: sha256("{}") };
  const html = Buffer.from("<!doctype html><html><body>decoded body</body></html>");
  const invoke = async (captureDir: string, makeFetcher: (budget: any) => (url: string, options: any) => Promise<any>) => capturePendingBodies({
    targets: [target], sources: new Map([[source.id, source]]), captureDir, allowed, publicUrl: async () => undefined,
    now: () => new Date("2026-10-24T12:00:00.000Z"), wait: async () => undefined,
    makeFetcher, fetchDetail: async (url, _row, _need, options) => {
      try { await options.fetcher(url, { timeoutMs: 20_000, maxBytes: 6 * 1024 * 1024 }); } catch { /* web-list catches fetch failures before returning */ }
      return { body: null };
    },
  });
  try {
    const outcome = await invoke(dir, (budget) => async (url) => {
      budget.beforeDispatch({ url: new URL(url), method: "GET", redirectHop: 0 });
      return { status: 200, url, headers: new Headers({ "content-type": "text/html", "content-encoding": "gzip" }), body: html };
    });
    const records = outcome.records;
    assert.equal(records[0]?.contentEncoding, "gzip");
    assert.equal(records[0]?.originContentEncoding, "gzip");
    assert.equal(records[0]?.bodyEncoding, "identity");
    assert.equal(records[0]?.bodyRepresentation, "undici-decoded");

    const failureDir = path.join(dir, "failure");
    await assert.rejects(invoke(failureDir, (budget) => async (url) => {
      budget.beforeDispatch({ url: new URL(url), method: "GET", redirectHop: 0 });
      throw Object.assign(new TypeError("fetch failed https://user:pass@example.test/article?token=secret Authorization: Bearer very-secret token=abc"), { name: "TypeError" });
    }), /lacks complete bounded raw bytes/u);
    const failure = JSON.parse(readFileSync(path.join(failureDir, `capture-failure-${target.articleId}.json`), "utf8"));
    assert.equal(failure.errorName, "TypeError");
    assert.match(failure.errorMessage, /\[redacted-url\]/u);
    assert.doesNotMatch(failure.errorMessage, /user|pass|secret|token=abc|very-secret/iu);
    assert.match(failure.errorMessage, /authorization=\[redacted\]/iu);
    assert.match(failure.errorMessage, /token=\[redacted\]/iu);
    if (process.platform !== "win32") assert.equal((lstatSync(path.join(failureDir, `capture-failure-${target.articleId}.json`)).mode & 0o777), 0o600);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("capture refuses malformed prior dispatch intent without issuing a new request", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "nas-pending-intent-"));
  const target: PendingTarget = { articleId: "intent_pending", sourceId: source.id, url: `${source.config.allowUrlPrefixes[0]}intent_pending.html`,
    title: "测试标题", publishedAt: "2026-10-21T00:00:00Z", revision: 1, contentHash: sha256("old"), excerpt: null,
    sourceRowSha256: sha256("source"), rowText: "{}", rowSha256: sha256("{}") };
  let networkCalls = 0;
  writeFileSync(path.join(dir, "dispatch-intent-intent_pending.json"), JSON.stringify({ schemaVersion: "nas-pending-body-dispatch-intent.v1",
    articleId: target.articleId, sourceId: target.sourceId, method: "GET", url: target.url, intentAt: "not-a-timestamp" }), { flag: "wx", mode: 0o600 });
  try {
    await assert.rejects(capturePendingBodies({ targets: [target], sources: new Map([[source.id, source]]), captureDir: dir, allowed,
      publicUrl: async () => undefined, fetchDetail: async () => { networkCalls++; return { body: null }; }, makeFetcher: () => async () => {
        networkCalls++; throw new Error("must not dispatch");
      } }), /intent is incomplete or has an invalid timestamp/);
    assert.equal(networkCalls, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("capture is exact-URL, serial, bounded, immutable and reuses an existing URL without another fetch", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "nas-pending-capture-"));
  let clock = 100_000;
  let fetchCalls = 0;
  const dispatchAt: number[] = [];
  const targets: PendingTarget[] = [0, 1].map((index) => {
    const articleId = `cap_${index}`;
    return { articleId, sourceId: source.id, url: `${source.config.allowUrlPrefixes[0]}${articleId}.html`, title: "测试正文标题",
      publishedAt: "2026-10-21T00:00:00+08:00", revision: 1, contentHash: sha256(`old${index}`), excerpt: null,
      sourceRowSha256: sha256("source"), rowText: "{}", rowSha256: sha256("{}") };
  });
  const html = Buffer.from("<html><body>bounded capture fixture</body></html>");
  const invoke = () => capturePendingBodies({ targets, sources: new Map([[source.id, source]]), captureDir: dir,
    allowed, publicUrl: async () => undefined, now: () => new Date(clock), wait: async (ms) => { clock += ms; },
    makeFetcher: (budget) => createBudgetedDetailFetcher(budget, (async (url: string, options: Record<string, any>) => {
      fetchCalls++;
      assert.equal(options.timeoutMs <= 20_000, true);
      assert.equal(options.maxBytes <= 6 * 1024 * 1024, true);
      budget.beforeDispatch({ url: new URL(url), method: "GET", redirectHop: 0 });
      dispatchAt.push(clock);
      return { status: 200, url, headers: new Headers({ "content-type": "text/html; charset=utf-8" }), body: html, text: () => html.toString("utf8") };
    }) as never),
    fetchDetail: async (url, _row, _need, options) => { await options.fetcher(url, { timeoutMs: 90_000, maxBytes: 99_000_000 }); return { body: null }; },
  });
  try {
    const first = await invoke();
    assert.equal(first.records.length, 2);
    assert.deepEqual(dispatchAt, [100_000, 101_100]);
    assert.equal(fetchCalls, 2);
    assert.equal(first.records.every((row) => row.eof && row.status === 200 && row.method === "GET"), true);
    assert.deepEqual(first.targets.map((row) => row.status), ["captured", "captured"]);
    for (const row of first.records) {
      const bodyFile = path.join(dir, row.file);
      assert.equal(sha256(readFileSync(bodyFile)), row.bodySha256);
      if (process.platform !== "win32") assert.equal((lstatSync(bodyFile).mode & 0o777), 0o600);
      assert.ok(Date.parse(row.completedAt!) >= Date.parse(row.dispatchedAt!));
    }
    const reused = await invoke();
    assert.equal(reused.records.length, 2);
    assert.deepEqual(reused.targets.map((row) => row.status), ["reused", "reused"]);
    assert.equal(fetchCalls, 2, "same exact URLs must reuse immutable captures");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("capture continues only after a real fetch timeout, pauses source and hostname, and accounts for every frozen target", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "nas-pending-timeout-continue-"));
  let clock = 200_000;
  const sourceA = sourceFor("mof-ningbo-supervision-dynamics");
  const sourceOtherHost = sourceFor("mof-beijing-supervision-dynamics");
  const targetFor = (articleId: string, row: Record<string, any>, url: string): PendingTarget => ({ articleId, sourceId: row.id, url,
    title: "测试正文标题", publishedAt: "2026-10-21T00:00:00+08:00", revision: 1, contentHash: sha256(`old-${articleId}`), excerpt: null,
    sourceRowSha256: sha256(`source-${row.id}`), rowText: "{}", rowSha256: sha256("{}") });
  const targets: PendingTarget[] = [
    targetFor("timeout_one", sourceA, `${sourceA.config.allowUrlPrefixes[0]}timeout_one.html`),
    targetFor("same_source_two", sourceA, `${sourceA.config.allowUrlPrefixes[0]}same_source_two.html`),
    targetFor("other_host_four", sourceOtherHost, `${sourceOtherHost.config.allowUrlPrefixes[0]}other_host_four.html`),
  ];
  const sources = new Map([sourceA, sourceOtherHost].map((row) => [row.id, row]));
  const requests: string[] = [];
  const dispatchAt: number[] = [];
  const outcome = await capturePendingBodies({ targets, sources, captureDir: dir, allowed, continueAfterTimeout: true,
    publicUrl: async () => undefined, now: () => new Date(clock), wait: async (ms) => { clock += ms; },
    makeFetcher: (budget) => async (url) => {
      requests.push(url);
      budget.beforeDispatch({ url: new URL(url), method: "GET", redirectHop: 0 });
      dispatchAt.push(clock);
      if (url === targets[0]!.url) throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      const body = Buffer.from("<html><body>complete capture</body></html>");
      return { status: 200, url, headers: new Headers({ "content-type": "text/html; charset=utf-8" }), body };
    },
    fetchDetail: async (url, _source, _need, options) => options.fetcher(url, { timeoutMs: 20_000, maxBytes: 6 * 1024 * 1024 }),
  });
  try {
    assert.deepEqual(requests, [targets[0]!.url, targets[2]!.url], "same-source target is skipped and another host continues");
    assert.deepEqual(dispatchAt, [200_000, 201_100], "continuation still observes the 1100 ms dispatch interval");
    assert.equal(outcome.records.length, 1);
    assert.deepEqual(outcome.timeoutFailures.map((row) => row.articleId), ["timeout_one"]);
    assert.deepEqual(outcome.skipped.map((row) => [row.articleId, row.reason, row.triggerArticleId]), [
      ["same_source_two", "same-source-after-timeout", "timeout_one"],
    ]);
    assert.deepEqual(outcome.targets.map((row) => row.status), ["timeout", "skipped", "captured"]);
    assert.equal(new Set(outcome.targets.map((row) => row.articleId)).size, targets.length);
    assert.equal(existsSync(path.join(dir, "dispatch-intent-same_source_two.json")), false);
    assert.equal(existsSync(path.join(dir, "dispatch-intent-other_host_four.json")), true);
    const failure = JSON.parse(readFileSync(path.join(dir, "capture-failure-timeout_one.json"), "utf8"));
    assert.equal(failure.errorName, "TimeoutError");
    assert.equal(failure.stage, "fetcher-did-not-return-complete-bounded-response");
    const manifest = buildPendingManifest({ runId: "timeout-continue-test", operatorBytes: Buffer.from("test operator"),
      database: "fiscalhot_pending_test", snapshot: { database: "fiscalhot_pending_test", capturedAt: "2026-10-22T00:00:00Z", counts: {}, rowsets: {} }, targets });
    const partial = buildPartialCaptureRunResult(manifest, sha256("manifest bytes"), outcome);
    assert.equal(partial.schemaVersion, "nas-pending-body-capture-run.v1");
    assert.equal(partial.result, "PARTIAL_WITH_TIMEOUTS");
    assert.equal(partial.targetCount, 3);
    assert.equal(partial.dispatchCount, 2, "only the timeout and final successful target were dispatched");
    assert.equal(partial.completeResponseCount, 1);
    assert.equal(partial.timeoutFailureCount, 1);
    assert.equal(partial.skippedCount, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("capture never treats a spoofed TimeoutError name or security/filesystem failures as continuable", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "nas-pending-timeout-hard-stop-"));
  const target: PendingTarget = { articleId: "spoof_timeout", sourceId: source.id,
    url: `${source.config.allowUrlPrefixes[0]}spoof_timeout.html`, title: "测试标题", publishedAt: "2026-10-21T00:00:00Z",
    revision: 1, contentHash: sha256("old"), excerpt: null, sourceRowSha256: sha256("source"), rowText: "{}", rowSha256: sha256("{}") };
  const sources = new Map([[source.id, source]]);
  const run = (captureDir: string, makeFetcher: (budget: any) => (url: string) => Promise<any>, continueAfterTimeout = true) => capturePendingBodies({
    targets: [target], sources, captureDir, allowed, continueAfterTimeout, publicUrl: async () => undefined,
    makeFetcher, fetchDetail: async (url, _source, _need, options) => options.fetcher(url, { timeoutMs: 20_000, maxBytes: 6 * 1024 * 1024 }),
  });
  try {
    await assert.rejects(run(path.join(dir, "spoof"), (budget) => async (url) => {
      budget.beforeDispatch({ url: new URL(url), method: "GET", redirectHop: 0 });
      throw Object.assign(new Error("spoofed timeout label"), { name: "TimeoutError" });
    }), /lacks complete bounded raw bytes/u);

    await assert.rejects(run(path.join(dir, "abort"), (budget) => async (url) => {
      budget.beforeDispatch({ url: new URL(url), method: "GET", redirectHop: 0 });
      throw new DOMException("aborted", "AbortError");
    }), /lacks complete bounded raw bytes/u, "AbortError is not a fetch timeout continuation signal");

    await assert.rejects(run(path.join(dir, "default-false"), (budget) => async (url) => {
      budget.beforeDispatch({ url: new URL(url), method: "GET", redirectHop: 0 });
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    }, false), /lacks complete bounded raw bytes/u, "continuation remains opt-in");

    await assert.rejects(run(path.join(dir, "incomplete-response"), (budget) => async (url) => {
      budget.beforeDispatch({ url: new URL(url), method: "GET", redirectHop: 0 });
      return { status: 200, url, headers: new Headers({ "content-type": "text/html" }), body: undefined };
    }), /lacks complete bounded raw bytes/u, "a returned but incomplete response envelope is not a timeout continuation");

    const securityDir = path.join(dir, "security");
    await assert.rejects(run(securityDir, (budget) => async (url) => {
      budget.beforeDispatch({ url: new URL(`${url}?redirected=1`), method: "GET", redirectHop: 1 });
      return null;
    }), /lacks complete bounded raw bytes/u);
    assert.equal(existsSync(path.join(securityDir, `dispatch-intent-${target.articleId}.json`)), false,
      "a dispatch-budget/security rejection remains a hard stop before network intent persistence");
    assert.equal(existsSync(path.join(securityDir, `capture-failure-${target.articleId}.json`)), true,
      "the hard-stop error is preserved without authorizing continuation");

    const filesystemDir = path.join(dir, "filesystem");
    writeFileSync(filesystemDir, "not a directory", { flag: "wx", mode: 0o600 });
    let filesystemFetchCalls = 0;
    await assert.rejects(run(filesystemDir, () => async () => { filesystemFetchCalls++; throw new DOMException("timeout", "TimeoutError"); }));
    assert.equal(filesystemFetchCalls, 0, "an output-directory filesystem failure hard-stops before dispatch");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("fail-fast capture persists hash-bound partial partition and offline recovery safely holds unrequested rows", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "nas-pending-partial-recovery-"));
  const captureDir = path.join(dir, "captures");
  const targets: PendingTarget[] = ["partial_ready", "partial_selector_hold", "partial_timeout", "partial_never_sent"].map((articleId) => ({
    articleId, sourceId: source.id, url: `${source.config.allowUrlPrefixes[0]}${articleId}.html`, title: "财政监督工作动态通知",
    publishedAt: "2026-10-21T00:00:00+08:00", revision: 1, contentHash: sha256(`old-${articleId}`), excerpt: null,
    sourceRowSha256: sha256(`source-${articleId}`), rowText: "{}", rowSha256: sha256("{}") }));
  const manifest = buildPendingManifest({ runId: "partial-recovery-test", operatorBytes: readFileSync("scripts/fiscal/nas-pending-body-batch.ts"),
    database: "fiscalhot_pending_test", snapshot: { database: "fiscalhot_pending_test", capturedAt: "2026-10-22T00:00:00Z", counts: {}, rowsets: {} }, targets });
  manifest.operatorSha256 = "ef3515718b67952f78ba9075364e3212355ff9173fecba312ddaa99c8766ff9f";
  const manifestPath = path.join(dir, "manifest.json"), recoveryPath = path.join(dir, "capture-recovery.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`, { flag: "wx", mode: 0o600 });
  const manifestSha = sha256(readFileSync(manifestPath));
  let clock = 200_000;
  const validHtml = Buffer.from(`<html><head><meta name="PubDate" content="2026-10-21"></head><body><h2 class="title_con">财政监督工作动态通知</h2><div class="my_doccontent"><p>${"这是用于验证冻结选择器、标题和发布日期一致性的一段公开正文内容。".repeat(12)}</p></div></body></html>`);
  const selectorMismatchHtml = Buffer.from(validHtml.toString("utf8").replace("财政监督工作动态通知</h2>", "其他标题</h2>"));
  const run = () => capturePendingBodies({ targets, sources: new Map([[source.id, source]]), captureDir, allowed,
    publicUrl: async () => undefined, now: () => new Date(clock), wait: async (ms) => { clock += ms; },
    makeFetcher: (budget) => async (url) => {
      budget.beforeDispatch({ url: new URL(url), method: "GET", redirectHop: 0 });
      if (url === targets[2]!.url) throw new DOMException("fixture timeout", "TimeoutError");
      return { status: 200, url, headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
        body: url === targets[1]!.url ? selectorMismatchHtml : validHtml };
    }, fetchDetail: async (url, _source, _need, options) => options.fetcher(url, { timeoutMs: 20_000, maxBytes: 6 * 1024 * 1024 }) });
  try {
    await assert.rejects(captureWithPartialRecovery({ manifest, manifestSha256: manifestSha, captureDir, out: recoveryPath,
      recoveryOperatorSha256: sha256(readFileSync("scripts/fiscal/nas-pending-body-batch.ts")), capture: run }), /lacks complete bounded raw bytes/u,
    "the original fail-fast capture remains nonzero after atomic partial evidence is written");
    assert.equal(existsSync(recoveryPath), true);
    const recovery = JSON.parse(readFileSync(recoveryPath, "utf8"));
    assert.equal(recovery.schemaVersion, "nas-pending-body-capture-recovery.v1");
    assert.equal(recovery.captureOperatorSha256, manifest.operatorSha256, "capture provenance remains the frozen old operator hash");
    assert.equal(recovery.recoveryOperatorSha256, sha256(readFileSync("scripts/fiscal/nas-pending-body-batch.ts")), "recovery parser provenance is separately recorded");
    assert.deepEqual(recovery.targets.map((row: any) => row.status), ["captured", "captured", "failed", "notRequested"]);
    assert.equal(recovery.records.length, 2);
    validatePartialCaptureRecovery({ recovery, manifest, manifestSha256: manifestSha, captureDir });

    const proposalsPath = path.join(dir, "proposals.json"), rebuiltRecoveryPath = path.join(dir, "rebuilt-recovery.json");
    const env = { ...process.env, AIHOT_APP_ROOT: process.cwd(), COLLECT_ENABLED: "false", MODEL_CALLS_ENABLED: "false",
      JINA_BODY_FALLBACK: "false", FEISHU_CONTENT_PUSH_ENABLED: "false", FEISHU_INTERNAL_ENABLED: "false",
      INDEXNOW_SUBMIT_ENABLED: "false", EMBEDDINGS_ENABLED: "false", OCR_RUN_ENABLED: "false", WORKER_ENABLED: "false",
      ALLOW_PRIVATE_NETWORK_FETCH: "false" };
    assert.throws(() => execFileSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.resolve("scripts/fiscal/nas-pending-body-batch.ts"),
      "--mode=recover-partial", `--manifest=${manifestPath}`, `--approval-sha256=${sha256("wrong manifest approval")}`,
      `--capture-dir=${captureDir}`, `--out=${path.join(dir, "wrong-recovery.json")}`],
    { encoding: "utf8", timeout: 30_000, stdio: "pipe", env }), /reviewed exact manifest SHA-256/u,
    "recovery rejects a nonmatching manifest approval SHA");
    const recoveredStdout = execFileSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.resolve("scripts/fiscal/nas-pending-body-batch.ts"),
      "--mode=recover-partial", `--manifest=${manifestPath}`, `--approval-sha256=${manifestSha}`, `--capture-dir=${captureDir}`, `--out=${rebuiltRecoveryPath}`],
      { encoding: "utf8", timeout: 30_000, env });
    const recoveryReport = JSON.parse(recoveredStdout.trim()), rebuiltRecovery = JSON.parse(readFileSync(rebuiltRecoveryPath, "utf8"));
    assert.equal(recoveryReport.coverageComplete, false);
    assert.deepEqual(rebuiltRecovery.targets.map((row: any) => row.status), ["captured", "captured", "failed", "notRequested"]);
    assert.equal(rebuiltRecovery.captureOperatorSha256, manifest.operatorSha256,
      "offline reconstruction accepts an old frozen capture operator without rewriting its provenance");
    const stdout = execFileSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.resolve("scripts/fiscal/nas-pending-body-batch.ts"),
      "--mode=offline-parse", "--partial-recovery", `--manifest=${manifestPath}`, `--approval-sha256=${manifestSha}`, `--captures=${recoveryPath}`,
      `--capture-dir=${captureDir}`, `--out=${proposalsPath}`], { encoding: "utf8", timeout: 30_000, env });
    const report = JSON.parse(stdout.trim()), bundle = JSON.parse(readFileSync(proposalsPath, "utf8"));
    assert.equal(report.result, "OFFLINE_PARTIAL_RECOVERY_COMPLETE");
    assert.equal(report.coverageComplete, false);
    assert.deepEqual(report.partialCaptureRecovery, { schemaVersion: "nas-pending-body-capture-recovery.v1", coverageComplete: false,
      recoverySha256: sha256(readFileSync(recoveryPath)), captureOperatorSha256: manifest.operatorSha256,
      recoveryOperatorSha256: sha256(readFileSync("scripts/fiscal/nas-pending-body-batch.ts")),
      capturedCount: 2, failedCount: 1, failedDispatchCount: 1, dispatchIntentCount: 3, notRequestedCount: 1 });
    assert.ok(bundle.proposals.some((row: any) => row.articleId === targets[0]!.articleId), "valid captured response can be READY");
    assert.ok(bundle.holds.some((row: any) => row.articleId === targets[1]!.articleId), "selector mismatch is HOLD");
    for (const target of targets.slice(2)) assert.ok(bundle.holds.some((row: any) => row.articleId === target.articleId), `${target.articleId} is HOLD`);
    assert.equal(bundle.partialCaptureRecovery.capturedCount, 2, "proposal bundle retains partial coverage status");
    assert.equal(bundle.freshDispatchCount, 3, "partial fresh dispatch count includes completed and failed dispatch intents");
    const recoveryBytes = readFileSync(recoveryPath);
    await validatePartialCaptureProposal({ bundle, recovery, recoveryBytes, manifest, manifestSha256: manifestSha, captureDir,
      currentOperatorSha256: sha256(readFileSync("scripts/fiscal/nas-pending-body-batch.ts")), sources: new Map([[source.id, source]]), fetchDetail });
    const wrongCaptureOperator = structuredClone(recovery); wrongCaptureOperator.captureOperatorSha256 = sha256("unreviewed capture source");
    await assert.rejects(validatePartialCaptureProposal({ bundle, recovery: wrongCaptureOperator, recoveryBytes, manifest, manifestSha256: manifestSha,
      captureDir, currentOperatorSha256: sha256(readFileSync("scripts/fiscal/nas-pending-body-batch.ts")), sources: new Map([[source.id, source]]), fetchDetail }), /exact evidence bytes/u);
    const wrongParser = structuredClone(recovery); wrongParser.recoveryOperatorSha256 = sha256("different parser");
    const wrongParserBytes = Buffer.from(JSON.stringify(wrongParser));
    await assert.rejects(validatePartialCaptureProposal({ bundle, recovery: wrongParser, recoveryBytes: wrongParserBytes, manifest,
      manifestSha256: manifestSha, captureDir, currentOperatorSha256: sha256(readFileSync("scripts/fiscal/nas-pending-body-batch.ts")),
      sources: new Map([[source.id, source]]), fetchDetail }), /operator lineage/u);
    const rogueManifest = structuredClone(manifest); rogueManifest.operatorSha256 = sha256("unreviewed old capture source");
    const rogueManifestBytes = Buffer.from(`${JSON.stringify(rogueManifest)}\n`), rogueManifestSha = sha256(rogueManifestBytes);
    const rogueRecovery = buildPartialCaptureRecovery(rogueManifest, rogueManifestSha, captureDir,
      sha256(readFileSync("scripts/fiscal/nas-pending-body-batch.ts")));
    const rogueRecoveryBytes = Buffer.from(JSON.stringify(rogueRecovery));
    const rogueMarker = { schemaVersion: rogueRecovery.schemaVersion, coverageComplete: false as const, recoverySha256: sha256(rogueRecoveryBytes),
      captureOperatorSha256: rogueRecovery.captureOperatorSha256, recoveryOperatorSha256: rogueRecovery.recoveryOperatorSha256,
      capturedCount: 2, failedCount: 1, failedDispatchCount: 1, dispatchIntentCount: 3, notRequestedCount: 1 };
    const rogueBundle = buildPendingProposalBundle(rogueManifest, rogueManifestSha, rogueRecovery.records,
      { proposals: bundle.proposals, holds: bundle.holds }, rogueMarker);
    await assert.rejects(validatePartialCaptureProposal({ bundle: rogueBundle, recovery: rogueRecovery, recoveryBytes: rogueRecoveryBytes,
      manifest: rogueManifest, manifestSha256: rogueManifestSha, captureDir,
      currentOperatorSha256: sha256(readFileSync("scripts/fiscal/nas-pending-body-batch.ts")), sources: new Map([[source.id, source]]), fetchDetail }),
    /reviewed capture\/recovery operator lineage/u, "a general stale operator SHA is not an authorized partial lineage");

    const rejectRecovery = (value: any, label: string) => assert.throws(() => validatePartialCaptureRecovery({ recovery: value, manifest,
      manifestSha256: manifestSha, captureDir }), /.+/u, label);
    const tamperedHash = structuredClone(recovery); tamperedHash.recordsSha256 = sha256("tampered"); rejectRecovery(tamperedHash, "records hash tamper rejected");
    const duplicate = structuredClone(recovery); duplicate.targets[3] = structuredClone(duplicate.targets[2]); rejectRecovery(duplicate, "duplicate partition target rejected");
    const missingRawPath = path.join(captureDir, recovery.records[0].file), missingRawBackup = `${missingRawPath}.backup`;
    const fs = await import("node:fs"); fs.renameSync(missingRawPath, missingRawBackup);
    try { assert.throws(() => validatePartialCaptureRecovery({ recovery, manifest, manifestSha256: manifestSha, captureDir }), /raw response path|ENOENT/u); }
    finally { fs.renameSync(missingRawBackup, missingRawPath); }
    const notRequestedIntent = path.join(captureDir, `dispatch-intent-${targets[3]!.articleId}.json`);
    writeFileSync(notRequestedIntent, JSON.stringify({ schemaVersion: "nas-pending-body-dispatch-intent.v1", articleId: targets[3]!.articleId,
      sourceId: source.id, method: "GET", url: targets[3]!.url, intentAt: new Date(clock).toISOString() }), { flag: "wx", mode: 0o600 });
    try { assert.throws(() => validatePartialCaptureRecovery({ recovery, manifest, manifestSha256: manifestSha, captureDir }), /not-requested target has contradictory evidence/u); }
    finally { rmSync(notRequestedIntent, { force: true }); }
    const badFailure = path.join(captureDir, `capture-failure-${targets[2]!.articleId}.json`);
    writeFileSync(badFailure, `${readFileSync(badFailure, "utf8")} `);
    rejectRecovery(recovery, "failure file hash tamper rejected");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a fetch timeout before dispatch intent is persisted remains a hard stop", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "nas-pending-pre-dispatch-timeout-"));
  const targetFor = (articleId: string): PendingTarget => ({ articleId, sourceId: source.id,
    url: `${source.config.allowUrlPrefixes[0]}${articleId}.html`, title: "测试标题", publishedAt: "2026-10-21T00:00:00Z",
    revision: 1, contentHash: sha256(`old-${articleId}`), excerpt: null, sourceRowSha256: sha256("source"), rowText: "{}", rowSha256: sha256("{}") });
  const targets = [targetFor("pre_dispatch_timeout"), targetFor("must_not_continue")];
  let fetchCalls = 0;
  try {
    await assert.rejects(capturePendingBodies({ targets, sources: new Map([[source.id, source]]), captureDir: dir, allowed,
      continueAfterTimeout: true, publicUrl: async () => undefined,
      makeFetcher: () => async () => { fetchCalls++; throw new DOMException("DNS lookup timed out", "TimeoutError"); },
      fetchDetail: async (url, _source, _need, options) => options.fetcher(url, { timeoutMs: 20_000, maxBytes: 6 * 1024 * 1024 }),
    }), /lacks complete bounded raw bytes/u);
    assert.equal(fetchCalls, 1, "no subsequent frozen target is attempted after a pre-dispatch timeout");
    assert.equal(existsSync(path.join(dir, `dispatch-intent-${targets[0]!.articleId}.json`)), false,
      "the timeout occurred before the fetcher's beforeDispatch hook persisted intent");
    const failure = JSON.parse(readFileSync(path.join(dir, `capture-failure-${targets[0]!.articleId}.json`), "utf8"));
    assert.equal(failure.intentAt, null);
    assert.equal(failure.errorName, "TimeoutError");
    assert.equal(existsSync(path.join(dir, `dispatch-intent-${targets[1]!.articleId}.json`)), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("timeout hostname pause catches a different source on the same normalized host", () => {
  assert.deepEqual(timeoutPauseReason({ sourceId: "source-b", url: "https://EXAMPLE.gov.cn/article" }, [
    { sourceId: "source-a", hostname: "example.gov.cn", articleId: "source-a-timeout" },
  ]), { reason: "same-host-after-timeout", triggerArticleId: "source-a-timeout" });
  assert.deepEqual(timeoutPauseReason({ sourceId: "source-a", url: "https://elsewhere.gov.cn/article" }, [
    { sourceId: "source-a", hostname: "example.gov.cn", articleId: "source-a-timeout" },
  ]), { reason: "same-source-after-timeout", triggerArticleId: "source-a-timeout" });
  assert.equal(timeoutPauseReason({ sourceId: "source-c", url: "https://other.gov.cn/article" }, [
    { sourceId: "source-a", hostname: "example.gov.cn", articleId: "source-a-timeout" },
  ]), null);
});

test("continue-after-timeout is rejected outside capture mode before any database access", () => {
  assert.throws(() => execFileSync(process.execPath, ["scripts/fiscal/nas-pending-body-batch.ts", "--mode", "offline-parse", "--continue-after-timeout"], {
    encoding: "utf8", stdio: "pipe", env: { ...process.env, COLLECT_ENABLED: "false", MODEL_CALLS_ENABLED: "false",
      JINA_BODY_FALLBACK: "false", FEISHU_CONTENT_PUSH_ENABLED: "false", FEISHU_INTERNAL_ENABLED: "false",
      INDEXNOW_SUBMIT_ENABLED: "false", EMBEDDINGS_ENABLED: "false", OCR_RUN_ENABLED: "false", WORKER_ENABLED: "false",
      ALLOW_PRIVATE_NETWORK_FETCH: "false" },
  }), (error: any) => String(error.stderr).includes("continue-after-timeout is valid only with --mode capture"));
});

test("offline selector uses configured title/date/body rules and turns mismatches into holds", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "nas-pending-offline-"));
  const target: PendingTarget = { articleId: "offline_one", sourceId: source.id,
    url: `${source.config.allowUrlPrefixes[0]}offline_one.html`, title: "财政监督工作动态通知", publishedAt: "2026-10-21T00:00:00+08:00",
    revision: 1, contentHash: sha256("metadata"), excerpt: null, sourceRowSha256: sha256("source"), rowText: "{}", rowSha256: sha256("{}") };
  const html = Buffer.from(`<html><head><meta name="PubDate" content="2026-10-21"></head><body><h2 class="title_con">财政监督工作动态通知</h2><div class="my_doccontent"><p>${"这是用于验证冻结选择器、标题和发布日期一致性的一段公开正文内容。".repeat(12)}</p></div></body></html>`);
  const file = `responses/${target.articleId}.body`;
  const bodyPath = path.join(dir, file);
  const mkdir = await import("node:fs"); mkdir.mkdirSync(path.dirname(bodyPath), { recursive: true });
  writeFileSync(bodyPath, html, { flag: "wx", mode: 0o600 });
  const manifest = buildPendingManifest({ runId: "offline-test", operatorBytes: Buffer.from("operator"), database: "fiscalhot_pending_test",
    snapshot: { database: "fiscalhot_pending_test", capturedAt: "2026-10-22T00:00:00Z", counts: {}, rowsets: {} }, targets: [target] });
  const record = { articleId: target.articleId, sourceId: target.sourceId, url: target.url, method: "GET" as const,
    dispatchedAt: "2026-10-22T00:00:00Z", completedAt: "2026-10-22T00:00:01Z", status: 200, responseUrl: target.url,
    contentType: "text/html; charset=utf-8", contentEncoding: "identity", bytes: html.length, bodySha256: sha256(html), eof: true, file };
  try {
    const parsed = await parsePendingCapture({ manifest, records: [record], captureDir: dir, sources: new Map([[source.id, source]]), fetchDetail });
    assert.equal(parsed.proposals.length, 1);
    assert.equal(parsed.holds.length, 0);
    assert.equal(parsed.proposals[0]?.expectedRowText, "{}");
    const transportDecodedRecord = { ...record, contentEncoding: "gzip", bodyEncoding: "identity" as const,
      bodyRepresentation: "undici-decoded" as const, originContentEncoding: "gzip" };
    const transportDecoded = await parsePendingCapture({ manifest, records: [transportDecodedRecord], captureDir: dir,
      sources: new Map([[source.id, source]]), fetchDetail });
    assert.equal(transportDecoded.proposals.length, 1, "explicit transport-decoded metadata must parse the stored HTML without gunzip");
    assert.equal(transportDecoded.holds.length, 0);
    const ambiguousEncoding = await parsePendingCapture({ manifest, records: [{ ...transportDecodedRecord, bodyEncoding: "gzip" }], captureDir: dir,
      sources: new Map([[source.id, source]]), fetchDetail });
    assert.equal(ambiguousEncoding.proposals.length, 0);
    assert.equal(ambiguousEncoding.holds[0]?.reason, "offline_parse_failed");
    const gzipFile = `responses/${target.articleId}-legacy-gzip.body`;
    const gzipBytes = gzipSync(html);
    writeFileSync(path.join(dir, gzipFile), gzipBytes, { flag: "wx", mode: 0o600 });
    const genuineLegacyGzip = { ...record, file: gzipFile, bytes: gzipBytes.length, bodySha256: sha256(gzipBytes), contentEncoding: "gzip" };
    const legacyGzipParsed = await parsePendingCapture({ manifest, records: [genuineLegacyGzip], captureDir: dir,
      sources: new Map([[source.id, source]]), fetchDetail });
    assert.equal(legacyGzipParsed.proposals.length, 1, "historical gzip wire bytes must still be gunzipped by contentEncoding");
    assert.equal(legacyGzipParsed.holds.length, 0);
    const legacyRecord = { ...record, dispatchedAt: "2026-10-22T00:00:00Z", completedAt: null, networkEvidenceKind: "legacy-capture" as const,
      legacySourceManifestSha256: sha256("legacy source manifest"), legacyInventorySha256: sha256("legacy inventory"),
      legacySourceManifestStartedAtUtc: "2026-10-21T10:00:00Z", legacySourceManifestFinishedAtUtc: "2026-10-21T10:01:00Z" };
    const legacyBundle = buildPendingProposalBundle(manifest, sha256("manifest bytes"), [legacyRecord], parsed);
    assert.equal(legacyBundle.freshDispatchCount, 0);
    assert.equal(legacyBundle.legacyOfflineCaptureCount, 1);
    assert.equal(legacyBundle.historicalNetworkCompliance, "UNPROVEN_HISTORICAL_CADENCE");
    assertPendingProposalBundle(legacyBundle, sha256("manifest bytes"));
    const staleManifest = buildPendingManifest({ runId: "offline-stale", operatorBytes: Buffer.from("operator"), database: manifest.database,
      snapshot: manifest.snapshot, targets: [{ ...target, title: "另一个标题" }] });
    const held = await parsePendingCapture({ manifest: staleManifest, records: [record], captureDir: dir, sources: new Map([[source.id, source]]), fetchDetail });
    assert.equal(held.proposals.length, 0);
    assert.equal(held.holds.length, 1);
    assert.equal(held.holds[0]?.bodySha256, record.bodySha256);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("proposal inputs bind capture hashes/cadence and fresh PG17 mode-600 backup proof", () => {
  const target: PendingTarget = { articleId: "proof_article", sourceId: source.id, url: `${source.config.allowUrlPrefixes[0]}proof.html`,
    title: "测试标题", publishedAt: "2026-10-21T00:00:00Z", revision: 1, contentHash: sha256("old"), excerpt: null,
    sourceRowSha256: sha256("source"), rowText: "{}", rowSha256: sha256("{}") };
  const manifest = buildPendingManifest({ runId: "proof-test", operatorBytes: Buffer.from("operator"), database: "fiscalhot_pending_test",
    snapshot: { database: "fiscalhot_pending_test", capturedAt: "2026-10-22T00:00:00Z", counts: {}, rowsets: { sources: { count: 1, sha256: sha256("sources") } } }, targets: [target] });
  const captures = [{ articleId: target.articleId, sourceId: target.sourceId, url: target.url, method: "GET" as const,
    dispatchedAt: "2026-10-22T00:00:00Z", completedAt: "2026-10-22T00:00:01Z", status: 200, responseUrl: target.url,
    contentType: "text/html", contentEncoding: "identity", bytes: 5, bodySha256: sha256("bytes"), eof: true, file: "responses/a.body" }];
  const proposal = { articleId: target.articleId, expectedRowText: target.rowText, expectedRowSha256: target.rowSha256,
    expectedRevision: target.revision, expectedContentHash: target.contentHash, expectedTitle: target.title, expectedExcerpt: null,
    expectedSourceId: target.sourceId, bodyText: "long enough body text for frozen proposal validation, with useful content.", bodyHtml: "<article>body</article>",
    bodyTextSha256: sha256("long enough body text for frozen proposal validation, with useful content."), bodyHtmlSha256: sha256("<article>body</article>"),
    nextContentHash: sha256("computed below") };
  const proposalResult = { proposals: [proposal as CandidateBodyCasRow], holds: [] as Array<{ articleId: string; reason: string; bodySha256: string | null }> };
  const manifestSha = sha256("exact manifest bytes");
  const bundle = buildPendingProposalBundle(manifest, manifestSha, captures, proposalResult);
  assertPendingProposalBundle(bundle, manifestSha);
  assert.throws(() => buildPendingProposalBundle(manifest, manifestSha, [{ ...captures[0]!, dispatchedAt: "2026-10-22T00:00:00.500Z" },
    { ...captures[0]!, articleId: "other", url: "https://example.invalid/other", dispatchedAt: "2026-10-22T00:00:01Z" }], proposalResult), /cadence/);
  assert.doesNotThrow(() => assertRuntimeSafetyFlags({ COLLECT_ENABLED: "false", MODEL_CALLS_ENABLED: "0" }));
  assert.throws(() => assertRuntimeSafetyFlags({ WORKER_ENABLED: "true" }), /unsafe runtime flags/);
  assert.throws(() => assertRuntimeSafetyFlags({ ALLOW_PRIVATE_NETWORK_FETCH: "true" }), /unsafe runtime flags/);
  assert.doesNotThrow(() => assertDispatchNetworkGuard({ allowPrivateNetworkFetch: false }));
  assert.throws(() => assertDispatchNetworkGuard({ allowPrivateNetworkFetch: true }), /connect-time private-network guard/);

  const dir = mkdtempSync(path.join(os.tmpdir(), "nas-pending-backup-proof-"));
  try {
    const dump = Buffer.from("private custom-format fixture");
    writeFileSync(path.join(dir, "fresh.dump"), dump, { flag: "wx", mode: 0o600 });
    const list = "List of contents\n";
    const proof = { schemaVersion: "nas-pending-body-backup-proof.v1", database: manifest.database,
      snapshotRowsetsSha256: sha256(JSON.stringify(manifest.snapshot.rowsets)), proposalInputSha256: bundle.inputSha256,
      dumpFile: "fresh.dump", dumpBytes: dump.length, dumpSha256: sha256(dump), pgRestoreListSha256: sha256(list),
      latestCaptureCompletedAt: "2026-10-22T00:00:01Z", createdAt: "2026-10-22T00:00:02Z" };
    writeFileSync(path.join(dir, "proof.json"), JSON.stringify(proof), { flag: "wx", mode: 0o600 });
    const stableRowsets = JSON.stringify(manifest.snapshot.rowsets);
    const proofBytes = readFileSync(path.join(dir, "proof.json"));
    assert.equal(proofBytes.length > 0, true);
    // The helper uses canonical sorted-key JSON for rowset binding.
    const canonical = (value: any): string => value && typeof value === "object" ? Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}` : JSON.stringify(value);
    proof.snapshotRowsetsSha256 = sha256(canonical(manifest.snapshot.rowsets));
    writeFileSync(path.join(dir, "proof.json"), JSON.stringify(proof), { mode: 0o600 });
    assert.equal(stableRowsets.length > 0, true);
    assert.doesNotThrow(() => verifyFreshBackupProof(path.join(dir, "proof.json"), manifest, { proposalInputSha256: bundle.inputSha256,
      now: new Date("2026-10-22T00:01:00Z"), pgRestoreList: () => list, pgRestoreVersion: "pg_restore (PostgreSQL) 17.6" }));
    assert.throws(() => verifyFreshBackupProof(path.join(dir, "proof.json"), manifest, { proposalInputSha256: "0".repeat(64),
      now: new Date("2026-10-22T00:01:00Z"), pgRestoreList: () => list, pgRestoreVersion: "pg_restore (PostgreSQL) 17.6" }), /does not bind/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("loopback *_test DB: exact fresh snapshot, CAS stale-second-row rollback, then body-only commit", async (t) => {
  const databaseUrl = process.env.NAS_CANDIDATE_TEST_DATABASE_URL;
  if (!databaseUrl) return t.skip("requires a dedicated loopback *_test database URL");
  const parsed = new URL(databaseUrl);
  const dbName = decodeURIComponent(parsed.pathname.slice(1));
  assert.match(dbName, /^[a-z0-9_]+_(?:test|ci)$/iu);
  assert.ok(["127.0.0.1", "localhost", "::1", "[::1]"].includes(parsed.hostname));
  const sql = postgres(databaseUrl, { max: 1, idle_timeout: 5 });
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`.replace(/[^a-z0-9_]/giu, "");
  const ids = [`pendfix_${suffix}_1`, `pendfix_${suffix}_2`];
  const fnName = `nas_stale_${suffix}`;
  let triggerInstalled = false;
  try {
    await sql.begin(async (tx) => {
      const identity = (await tx`SELECT current_database() AS database, inet_server_addr()::text AS address`)[0];
      assert.equal(identity.database, dbName);
      assert.ok(["127.0.0.1", "::1"].includes(String(identity.address).replace(/\/\d+$/u, "")));
      for (const [index, id] of ids.entries()) {
        const title = `隔离正文CAS样例标题 ${index + 1}`;
        const url = `${source.config.allowUrlPrefixes[0]}${id}.html`;
        const oldHash = sha256(`seed-${id}`);
        await tx`INSERT INTO articles (id, source_id, identity_key, url, title, published_at, discovered_at, timeline_at,
          revision, content_hash, body_status) VALUES (${id}, ${source.id}, ${`url:${url}`}, ${url}, ${title},
          '2026-10-21T00:00:00+08:00', now(), now(), 1, ${oldHash}, 'pending')`;
        await tx`INSERT INTO article_revisions (article_id, revision, content_hash, title, body_text) VALUES (${id}, 1, ${oldHash}, ${title}, NULL)`;
      }
    });
    const snapshotData = await sql.begin(async (tx) => {
      await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`;
      return readPendingSnapshot(tx, ids, async () => undefined, allowed);
    });
    const manifest = buildPendingManifest({ runId: `fixture-${suffix}`, operatorBytes: Buffer.from("test operator"), database: dbName,
      snapshot: snapshotData.snapshot, targets: snapshotData.targets });
    const makeProposal = (target: PendingTarget): CandidateBodyCasRow => {
      const bodyText = `这是一段长度充分的隔离测试正文，用于核验多行CAS的原子回滚与仅正文字段提交。${target.articleId}`;
      const bodyHtml = `<article><p>${bodyText}</p></article>`;
      const nextHash = sha256([target.title.replace(/\s+/gu, " ").trim(), bodyText.replace(/\s+/gu, " ").trim(), ""].join("\u0001"));
      return { articleId: target.articleId, expectedRowText: target.rowText, expectedRowSha256: target.rowSha256,
        expectedRevision: target.revision, expectedContentHash: target.contentHash, expectedTitle: target.title, expectedExcerpt: target.excerpt,
        expectedSourceId: target.sourceId, bodyText, bodyHtml, bodyTextSha256: sha256(bodyText), bodyHtmlSha256: sha256(bodyHtml), nextContentHash: nextHash };
    };
    const proposals = snapshotData.targets.map(makeProposal);
    const fixture = async () => {
      await sql.unsafe(`CREATE FUNCTION ${fnName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF OLD.id = '${ids[0]}' THEN UPDATE articles SET excerpt = 'intentional in-transaction stale row' WHERE id = '${ids[1]}'; END IF;
        RETURN NEW; END $$`);
      await sql.unsafe(`CREATE TRIGGER ${fnName} BEFORE UPDATE ON articles FOR EACH ROW EXECUTE FUNCTION ${fnName}()`);
      triggerInstalled = true;
    };
    await fixture();
    await assert.rejects(applyPendingBodyCas(sql, manifest, proposals, true), /update failed|baseline changed/);
    const afterRollback = await sql`SELECT id, revision::int AS revision, body_status, body_text, body_html, excerpt
      FROM articles WHERE id = ANY(${sql.array(ids, 1009)}) ORDER BY id`;
    assert.equal(afterRollback.length, 2);
    assert.ok(afterRollback.every((row: any) => row.revision === 1 && row.body_status === "pending" && row.body_text === null && row.body_html === null && row.excerpt === null));
    const revisionRows = await sql`SELECT article_id, count(*)::int AS count FROM article_revisions WHERE article_id = ANY(${sql.array(ids, 1009)}) GROUP BY article_id`;
    assert.equal(revisionRows.length, 2);
    assert.ok(revisionRows.every((row: any) => row.count === 1));
    await sql.unsafe(`DROP TRIGGER ${fnName} ON articles`);
    await sql.unsafe(`DROP FUNCTION ${fnName}()`);
    triggerInstalled = false;
    const preflight = await applyPendingBodyCas(sql, manifest, [proposals[0]!], false);
    assert.deepEqual(preflight, []);
    const afterPreflight = await sql`SELECT revision::int AS revision, body_status FROM articles WHERE id = ${ids[0]}`;
    assert.equal(afterPreflight[0]?.revision, 1);
    assert.equal(afterPreflight[0]?.body_status, "pending");
    const committed = await applyPendingBodyCas(sql, manifest, [proposals[0]!], true);
    assert.equal(committed.length, 1);
    const afterCommit = await sql`SELECT to_jsonb(a)::text AS row_text FROM articles a WHERE id = ${ids[0]}`;
    const row = JSON.parse(afterCommit[0]!.row_text);
    const original = JSON.parse(snapshotData.targets[0]!.rowText);
    for (const key of Object.keys(original)) if (!["body_text", "body_html", "body_status", "revision", "content_hash", "updated_at"].includes(key)) {
      assert.deepEqual(row[key], original[key], `non-body article column ${key} must be unchanged`);
    }
    assert.equal(row.body_status, "ok");
    assert.equal(row.revision, 2);
    assert.equal(row.title, original.title);
    assert.equal(row.url, original.url);
    const sourceRow = await sql`SELECT enabled, site_fulltext, syndicate_fulltext FROM sources WHERE id = ${source.id}`;
    assert.deepEqual(sourceRow[0], { enabled: false, site_fulltext: false, syndicate_fulltext: false });
  } finally {
    if (triggerInstalled) {
      try { await sql.unsafe(`DROP TRIGGER ${fnName} ON articles`); } catch { /* fixture cleanup */ }
      try { await sql.unsafe(`DROP FUNCTION ${fnName}()`); } catch { /* fixture cleanup */ }
    }
    await sql`DELETE FROM articles WHERE id = ANY(${sql.array(ids, 1009)})`;
    await sql.end();
  }
});
