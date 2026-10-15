#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const snapshotPath = resolve(root, ".data/fiscal-qa/pending-audit-20261016/live-snapshot.json");
const captureManifestPath = resolve(root, ".data/fiscal-qa/attachment-html-pending-20261014/evidence/manifest.json");
const outputPath = resolve(root, ".data/fiscal-qa/pending-audit-20261016/offline-replay-results.json");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function isPathInside(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function verifyCaptureBinding(article, capture, evidenceDirectory, read = readFileSync) {
  if (!article || !capture || article.id !== capture.articleId || article.source_id !== capture.sourceId || article.url !== capture.url || article.title !== capture.title) {
    return { ok: false, reason: "article_identity_mismatch" };
  }
  if (article.body_status !== "pending") return { ok: false, reason: "article_not_pending" };
  if (capture.status !== 200 || capture.finalUrl !== article.url || !/^text\/html\b/i.test(capture.contentType ?? "")) {
    return { ok: false, reason: "capture_not_exact_html_200" };
  }
  if (typeof capture.rawFile !== "string" || !capture.rawFile || typeof capture.rawSha256 !== "string" || !Number.isSafeInteger(capture.bytes)) {
    return { ok: false, reason: "capture_binding_incomplete" };
  }
  const rawPath = resolve(evidenceDirectory, capture.rawFile);
  if (!isPathInside(evidenceDirectory, rawPath)) return { ok: false, reason: "capture_path_escapes_evidence_directory" };
  if (!existsSync(rawPath)) return { ok: false, reason: "capture_raw_missing" };
  const raw = read(rawPath);
  if (raw.length !== capture.bytes || hash(raw) !== capture.rawSha256) return { ok: false, reason: "capture_raw_hash_or_length_mismatch" };
  return { ok: true, rawPath, raw, rawSha256: hash(raw), bytes: raw.length };
}

export function detailDriverClass(source) {
  if (!source || source.enabled !== false || source.site_fulltext !== false || source.syndicate_fulltext !== false) return "source_flags_not_closed";
  const config = source.config ?? {};
  const detail = config.detail;
  if (!detail || typeof detail !== "object") return "no_detail_driver";
  if (detail.pdfDirect === true) return "direct_pdf_only";
  if (detail.mode === "nfra_json_v1") return "nfra_json_detail";
  if (detail.bodySelector || Array.isArray(detail.bodyPolicies) || detail.attachmentSelector || detail.attachmentScopeSelector) return "configured_detail";
  return "detail_identity_only_no_body_selector";
}

async function main() {
  if (!existsSync(snapshotPath) || !existsSync(captureManifestPath)) throw new Error("frozen live snapshot or saved capture manifest is missing");
  if (existsSync(outputPath)) throw new Error("output already exists; refusing to overwrite one-shot audit evidence");
  const snapshotBytes = readFileSync(snapshotPath);
  const captureManifestBytes = readFileSync(captureManifestPath);
  const snapshot = JSON.parse(snapshotBytes);
  const captureManifest = JSON.parse(captureManifestBytes);
  const catalogBytes = readFileSync(resolve(root, "industry/sources.json"));
  const catalog = JSON.parse(catalogBytes);
  const byArticle = new Map(snapshot.articles.map((article) => [article.id, article]));
  const sourceById = new Map(catalog.sources.map((source) => [source.id, source]));
  const evidenceDirectory = resolve(root, ".data/fiscal-qa/attachment-html-pending-20261014/evidence");
  const captureRows = captureManifest.results ?? [];
  const pendingRows = snapshot.articles.filter((article) => article.body_status === "pending");
  const { extractConfiguredHtmlBody } = await import(pathToFileURL(resolve(root, "packages/backend/src/content/pdf-body.ts")));
  const replay = [];

  for (const capture of captureRows) {
    const article = byArticle.get(capture.articleId);
    if (!article) continue;
    const bound = verifyCaptureBinding(article, capture, evidenceDirectory);
    const currentSource = sourceById.get(article.source_id);
    const sourceSnapshot = snapshot.sources.find((source) => source.id === article.source_id);
    const currentDriver = detailDriverClass({ ...currentSource, enabled: sourceSnapshot?.enabled, site_fulltext: sourceSnapshot?.site_fulltext, syndicate_fulltext: sourceSnapshot?.syndicate_fulltext });
    const entry = {
      articleId: article.id,
      sourceId: article.source_id,
      url: article.url,
      title: article.title,
      bodyStatusAtSnapshot: article.body_status,
      revisionAtSnapshot: article.revision,
      contentHashAtSnapshot: article.content_hash,
      currentCatalogDriver: currentDriver,
      databaseConfigMatchesCatalog: canonicalJson(sourceSnapshot?.config) === canonicalJson(currentSource?.config),
      capturePath: capture.rawFile,
      captureSha256: capture.rawSha256,
      captureBytes: capture.bytes,
      binding: bound.ok ? "PASS" : bound.reason,
    };
    if (!bound.ok || !currentSource || currentDriver !== "configured_detail") {
      replay.push(entry);
      continue;
    }

    let html;
    try {
      html = bound.raw.subarray(0, 3).toString("hex") === "1f8b08" ? gunzipSync(bound.raw).toString("utf8") : bound.raw.toString("utf8");
    } catch {
      entry.replay = "raw_decode_failed";
      replay.push(entry);
      continue;
    }
    let blockedFetchCalls = 0;
    const denyFetch = async () => {
      blockedFetchCalls += 1;
      throw new Error("offline replay: attachment/network fetch denied");
    };
    try {
      const detail = currentSource.config.detail;
      const config = { ...detail, publishedAtUtcOffset: detail.publishedAtUtcOffset ?? currentSource.config.publishedAtUtcOffset };
      const result = await extractConfiguredHtmlBody(
        html,
        capture.finalUrl,
        config,
        { title: article.title, publishedAt: article.published_at ? new Date(article.published_at) : null },
        currentSource.config.allowUrlPrefixes ?? [],
        denyFetch,
      );
      const bodyText = result.body?.text ?? "";
      entry.replay = result.body ? "body_candidate" : "parser_declined";
      entry.parserReason = result.reason ?? null;
      entry.bodyChars = bodyText.length;
      entry.bodyTextSha256 = bodyText ? hash(Buffer.from(bodyText)) : null;
      entry.blockedFetchCalls = blockedFetchCalls;
      entry.discoveredAttachments = result.attachments ?? [];
      entry.databaseWrite = false;
      entry.externalHttp = false;
    } catch (error) {
      entry.replay = "offline_parser_error";
      entry.parserError = String(error?.message ?? error).slice(0, 300);
      entry.blockedFetchCalls = blockedFetchCalls;
      entry.databaseWrite = false;
      entry.externalHttp = false;
    }
    replay.push(entry);
  }

  const seen = new Set(replay.map((item) => item.articleId));
  const pendingWithoutThisCapture = pendingRows.filter((article) => !seen.has(article.id)).map((article) => {
    const currentSource = sourceById.get(article.source_id);
    const sourceSnapshot = snapshot.sources.find((source) => source.id === article.source_id);
    return {
      articleId: article.id,
      sourceId: article.source_id,
      url: article.url,
      title: article.title,
      bodyStatusAtSnapshot: article.body_status,
      revisionAtSnapshot: article.revision,
      contentHashAtSnapshot: article.content_hash,
      currentCatalogDriver: detailDriverClass({ ...currentSource, enabled: sourceSnapshot?.enabled, site_fulltext: sourceSnapshot?.site_fulltext, syndicate_fulltext: sourceSnapshot?.syndicate_fulltext }),
      databaseConfigMatchesCatalog: canonicalJson(sourceSnapshot?.config) === canonicalJson(currentSource?.config),
      savedDetailCapture: false,
      nextAction: "needs_new_exact_detail_capture_or_source_specific_resolution",
    };
  });
  const unconfirmed = snapshot.articles.filter((article) => article.body_status === "unconfirmed").map((article) => ({
    articleId: article.id,
    sourceId: article.source_id,
    url: article.url,
    title: article.title,
    bodyStatus: article.body_status,
    rawDiagnosticKeys: article.raw && typeof article.raw === "object" ? Object.keys(article.raw).filter((key) => key.startsWith("_aihotBodyExtraction")) : [],
    diagnostic: article.raw?._aihotBodyExtraction ?? null,
    retryDisposition: "exclude_from_pending_batch; require changed parser/policy or new identity evidence",
  }));

  const bodyCandidates = replay.filter((item) => item.bodyStatusAtSnapshot === "pending" && item.replay === "body_candidate");
  const report = {
    schema: "fiscal.pending-body-offline-audit.v1",
    generatedAtUtc: new Date().toISOString(),
    inputs: {
      database: snapshot.database,
      snapshotPath: ".data/fiscal-qa/pending-audit-20261016/live-snapshot.json",
      snapshotSha256: hash(snapshotBytes),
      captureManifestPath: ".data/fiscal-qa/attachment-html-pending-20261014/evidence/manifest.json",
      captureManifestSha256: hash(captureManifestBytes),
      currentCatalogSha256: hash(catalogBytes),
    },
    scope: { totalArticles: snapshot.counts.articles, pending: pendingRows.length, unconfirmed: unconfirmed.length, exactSavedCaptureRowsConsidered: replay.length },
    safety: { databaseConnections: 0, databaseWrites: 0, externalHttpDispatches: 0, attachmentFetchImplementation: "deny-stub", providerCalls: 0, workerStarted: false, sourceConfigChanges: 0 },
    summary: {
      capturesBoundToPendingRows: replay.filter((item) => item.binding === "PASS" && item.bodyStatusAtSnapshot === "pending").length,
      offlineParserBodyCandidates: bodyCandidates.length,
      offlineParserDeclines: replay.filter((item) => item.replay === "parser_declined").length,
      offlineParserErrors: replay.filter((item) => item.replay === "offline_parser_error" || item.replay === "raw_decode_failed").length,
      pendingWithoutThisCapture: pendingWithoutThisCapture.length,
      unconfirmedExcludedFromRetry: unconfirmed.length,
      configDriftSources: [...new Set([...replay, ...pendingWithoutThisCapture].filter((item) => item.databaseConfigMatchesCatalog === false).map((item) => item.sourceId))].sort(),
    },
    savedCaptureReplays: replay,
    pendingWithoutThisCapture,
    unconfirmed,
  };
  const bytes = JSON.stringify(report, null, 2) + "\n";
  writeFileSync(outputPath, bytes, { flag: "wx" });
  console.log(JSON.stringify({ result: "OFFLINE_PENDING_AUDIT_SAVED_NO_DB_NO_NETWORK", path: ".data/fiscal-qa/pending-audit-20261016/offline-replay-results.json", sha256: hash(Buffer.from(bytes)), summary: report.summary }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
