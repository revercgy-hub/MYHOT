import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { brotliCompressSync, deflateSync, gzipSync } from "node:zlib";
import postgres from "postgres";
import { applyPendingBodyCas, buildPendingManifest, capturePendingBodies, parsePendingArticleIds,
  parsePendingCapture, readPendingSnapshot, selectRoundRobinPendingTargets, validatePendingTarget,
  verifyFreshBackupProof, buildPendingProposalBundle, assertPendingProposalBundle, assertRuntimeSafetyFlags,
  parseExistingUrlEvidence, assertOnlyExpectedArticleChanges, assertDispatchNetworkGuard, decodePendingCapturedResponse,
  adaptLegacyExecutionDispatch, asLegacyOfflineCaptureRecord, singleReusableLegacyDispatch, type PendingTarget } from "../scripts/fiscal/nas-pending-body-batch.ts";
import { type CandidateBodyCasRow } from "../scripts/fiscal/nas-candidate-body-cas.ts";
import { createBudgetedDetailFetcher, detailConfigIsDirectHtml } from "../scripts/fiscal/nas-candidate-batch.ts";
import { fetchDetail } from "../packages/backend/src/sources/web-list.ts";

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const catalog = JSON.parse(readFileSync("industry/sources.json", "utf8")).sources as Array<Record<string, any>>;
const source = catalog.find((row) => row.id === "mof-beijing-supervision-dynamics")!;
const sourceFor = (id: string) => catalog.find((row) => row.id === id)!;
const allowed = (url: string, row: Record<string, any>) => row.config.allowUrlPrefixes.some((prefix: string) => url.startsWith(prefix));

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

test("legacy-adapt CLI imports complete reviewed scope offline with exact target coverage", () => {
  const inventoryPath = ".data/fiscal-qa/pending-capture-inventory-20261022/inventory.json";
  const inventoryBytes = readFileSync(inventoryPath);
  const inventorySha = sha256(inventoryBytes);
  assert.equal(inventorySha, "a67f047a2e4b90afc7cbcd0b9abe66b9f470dbcaa5da702189b8e5fa06367ee2");
  const inventory = JSON.parse(inventoryBytes.toString("utf8"));
  const prior = readFileSync(".data/fiscal-qa/pending-capture-inventory-20261022/detail-response-exclusions.json");
  const priorEvidence = JSON.parse(prior.toString("utf8"));
  const capturedUrls = new Set(priorEvidence.entries.filter((entry: any) => entry.status === "captured").map((entry: any) => entry.url));
  const rawRecord = inventory.records.find((row: any) => capturedUrls.has(row.exactURL) && catalog.some((candidate) => candidate.id === row.sourceId &&
    candidate.kind === "web_list" && detailConfigIsDirectHtml(candidate)) && singleReusableLegacyDispatch(row,
      { articleId: "test", sourceId: row.sourceId, url: row.exactURL }));
  assert.ok(rawRecord);
  const urlEvidence = priorEvidence.entries.find((row: any) => row.url === rawRecord.exactURL);
  assert.equal(urlEvidence?.status, "captured");
  const dispatch = rawRecord.evidence.responseDispatches[0];
  const sourceBytes = readFileSync(dispatch.responsePath);
  const url = rawRecord.exactURL as string;
  const target: PendingTarget = { articleId: "legacy_cli_article", sourceId: rawRecord.sourceId, url,
    title: "fixture title", publishedAt: "2026-10-21T00:00:00Z", revision: 1, contentHash: sha256("old-body"), excerpt: null,
    sourceRowSha256: sha256("source-row"), rowText: "{}", rowSha256: sha256("{}") };
  const operatorBytes = readFileSync("scripts/fiscal/nas-pending-body-batch.ts");
  const manifest = buildPendingManifest({ runId: "legacy_cli_test", operatorBytes, database: "fiscalhot_staging",
    snapshot: { database: "fiscalhot_staging", capturedAt: "2026-10-22T00:00:00Z", counts: {}, rowsets: {} }, targets: [target],
    selectionStrategy: "source-round-robin-prior-captured-published-desc-id-asc",
    excludedResponseUrlEvidence: { sha256: sha256(prior), entries: priorEvidence.entries }, legacyInventorySha256: inventorySha });
  const temp = mkdtempSync(path.join(os.tmpdir(), "nas-pending-legacy-cli-"));
  const manifestPath = path.join(temp, "manifest.json");
  const outputPath = path.join(temp, "captures.json");
  const captureDir = path.join(temp, "captures");
  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`, { flag: "wx", mode: 0o600 });
  const manifestSha = sha256(readFileSync(manifestPath));
  try {
    const stdout = execFileSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.resolve("scripts/fiscal/nas-pending-body-batch.ts"),
      "--mode=legacy-adapt", `--manifest=${manifestPath}`, `--approval-sha256=${manifestSha}`, `--legacy-evidence=${path.resolve(inventoryPath)}`,
      `--legacy-evidence-sha256=${inventorySha}`, `--capture-dir=${captureDir}`, `--out=${outputPath}`],
      { encoding: "utf8", timeout: 30_000, env: { ...process.env, MODEL_CALLS_ENABLED: "false" } });
    const report = JSON.parse(stdout.trim());
    assert.equal(report.result, "LEGACY_OFFLINE_IMPORT_COMPLETE_NO_NETWORK");
    assert.equal(report.targetCount, 1);
    assert.equal(report.legacyCaptureCount, 1);
    assert.equal(report.coverageComplete, true);
    const output = JSON.parse(readFileSync(outputPath, "utf8"));
    assert.equal(output.records.length, manifest.targets.length);
    assert.deepEqual(output.records.map((row: any) => row.articleId), manifest.targets.map((row) => row.articleId));
    assert.equal(output.records[0].bodySha256, sha256(sourceBytes));
    assert.equal(output.records[0].completedAt, null);
    assert.equal(output.networkCompliance, "UNPROVEN_HISTORICAL_CADENCE");
  } finally { rmSync(temp, { recursive: true, force: true }); }
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
    assert.equal(first.length, 2);
    assert.deepEqual(dispatchAt, [100_000, 101_100]);
    assert.equal(fetchCalls, 2);
    assert.equal(first.every((row) => row.eof && row.status === 200 && row.method === "GET"), true);
    for (const row of first) {
      const bodyFile = path.join(dir, row.file);
      assert.equal(sha256(readFileSync(bodyFile)), row.bodySha256);
      if (process.platform !== "win32") assert.equal((lstatSync(bodyFile).mode & 0o777), 0o600);
      assert.ok(Date.parse(row.completedAt!) >= Date.parse(row.dispatchedAt!));
    }
    const reused = await invoke();
    assert.equal(reused.length, 2);
    assert.equal(fetchCalls, 2, "same exact URLs must reuse immutable captures");
  } finally { rmSync(dir, { recursive: true, force: true }); }
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
