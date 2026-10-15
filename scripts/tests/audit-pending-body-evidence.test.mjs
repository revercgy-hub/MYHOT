import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { canonicalJson, detailDriverClass, isPathInside, verifyCaptureBinding } from "../audit-pending-body-evidence.mjs";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("capture binding requires exact pending identity, exact HTML URL, and raw hash", () => {
  const dir = mkdtempSync(join(tmpdir(), "pending-audit-"));
  try {
    const bytes = Buffer.from("<html>frozen response</html>");
    mkdirSync(join(dir, "responses"));
    writeFileSync(join(dir, "responses", "one.html"), bytes);
    const article = { id: "a1", source_id: "s1", url: "https://official.example/doc/1", title: "Exact title", body_status: "pending" };
    const capture = { articleId: "a1", sourceId: "s1", url: article.url, title: article.title, status: 200, finalUrl: article.url, contentType: "text/html; charset=utf-8", rawFile: "responses/one.html", rawSha256: sha(bytes), bytes: bytes.length };
    assert.equal(verifyCaptureBinding(article, capture, dir).ok, true);
    assert.equal(verifyCaptureBinding({ ...article, title: "Drifted title" }, capture, dir).reason, "article_identity_mismatch");
    assert.equal(verifyCaptureBinding({ ...article, body_status: "unconfirmed" }, capture, dir).reason, "article_not_pending");
    assert.equal(verifyCaptureBinding(article, { ...capture, rawSha256: "0".repeat(64) }, dir).reason, "capture_raw_hash_or_length_mismatch");
    assert.equal(verifyCaptureBinding(article, { ...capture, finalUrl: "https://other.example/doc/1" }, dir).reason, "capture_not_exact_html_200");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("capture file path cannot escape its evidence directory", () => {
  const dir = mkdtempSync(join(tmpdir(), "pending-audit-path-"));
  try {
    assert.equal(isPathInside(dir, join(dir, "responses", "one.html")), true);
    assert.equal(isPathInside(dir, join(dir, "..", "outside.html")), false);
    const article = { id: "a1", source_id: "s1", url: "https://official.example/doc/1", title: "Exact title", body_status: "pending" };
    const capture = { articleId: "a1", sourceId: "s1", url: article.url, title: article.title, status: 200, finalUrl: article.url, contentType: "text/html", rawFile: "../outside.html", rawSha256: "0".repeat(64), bytes: 1 };
    assert.equal(verifyCaptureBinding(article, capture, dir).reason, "capture_path_escapes_evidence_directory");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("source driver classification fails closed for enabled or non-detail sources", () => {
  assert.equal(detailDriverClass({ enabled: false, site_fulltext: false, syndicate_fulltext: false, config: { detail: { bodySelector: "#content" } } }), "configured_detail");
  assert.equal(detailDriverClass({ enabled: true, site_fulltext: false, syndicate_fulltext: false, config: { detail: { bodySelector: "#content" } } }), "source_flags_not_closed");
  assert.equal(detailDriverClass({ enabled: false, site_fulltext: false, syndicate_fulltext: false, config: {} }), "no_detail_driver");
  assert.equal(detailDriverClass({ enabled: false, site_fulltext: false, syndicate_fulltext: false, config: { detail: { pdfDirect: true } } }), "direct_pdf_only");
});

test("canonical config comparison ignores object key order but preserves real differences", () => {
  const dbConfig = { url: "https://example.test", _aihot: { initialBackfillMonths: 3 }, itemSelector: "article" };
  const catalogConfig = { itemSelector: "article", _aihot: { initialBackfillMonths: 3 }, url: "https://example.test" };
  assert.equal(canonicalJson(dbConfig), canonicalJson(catalogConfig));
  assert.notEqual(canonicalJson(dbConfig), canonicalJson({ ...catalogConfig, detail: { bodySelector: "#content" } }));
});
