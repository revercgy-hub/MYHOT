import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  createPredictions, createPrefilterPacket, createScorePacket, evaluate, makePrepared, prepared, readJson, writeNew,
} from "../scripts/eval-selection-native.ts";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
function rehashPredictions(value: any, transform: (rows: any[]) => any[]) {
  const unsigned = { ...value, predictions: transform(value.predictions) };
  delete unsigned.predictionsSha256;
  return { ...unsigned, predictionsSha256: hash(stable(unsigned)) };
}
const when = "2026-10-22T08:00:00+08:00";
function input(items: Array<{ caseId: string; bodyText: string; sourceTier?: string }>) {
  return {
    format: "fiscal.native-selection.input/v1",
    items: items.map((x) => ({
      caseId: x.caseId, bodySha256: hash(x.bodyText), title: `标题 ${x.caseId}`, originalTitle: null,
      publishedAt: when, discoveredAt: null, sourceName: "测试财政局", sourceKind: "web_list",
      sourceTier: x.sourceTier ?? "T1", firstParty: true, sourceTags: [], fetchesBody: true,
      url: `https://example.invalid/${x.caseId}`, bodyText: x.bodyText,
    })),
  };
}
function prefilterFor(p: ReturnType<typeof prepared>, labels: Record<string, "PASS" | "BLOCK" | "UNKNOWN"> = {}) {
  const packet = createPrefilterPacket(p);
  const value = {
    format: "fiscal.native-selection.prefilter-results/v1", preparedSha256: p.preparedSha256,
    prefilterPacketSha256: packet.packetSha256,
    run: { executionSource: "codex-native-fork-none", nativeModel: "Luna High", nativeSessionId: "prefilter-session", passId: "prefilter", executedAt: when, receiptId: null },
    items: packet.cases.map((c) => ({ caseId: c.caseId, inputSha256: c.inputSha256, bodySha256: c.bodySha256, promptSha256: c.prompt.promptSha256, output: { label: labels[c.caseId] ?? "PASS", reason: "测试依据" } })),
  };
  return { packet, value, bytesSha: hash(JSON.stringify(value)) };
}
function scorePass(scorePacket: ReturnType<typeof createScorePacket>, passId: "score-pass-1" | "score-pass-2", scores: Record<string, number>, session: string = passId) {
  return {
    format: "fiscal.native-selection.score-results/v1", preparedSha256: scorePacket.preparedSha256, scorePacketSha256: scorePacket.packetSha256,
    run: { executionSource: "codex-native-fork-none", nativeModel: "Luna High", nativeSessionId: session, passId, executedAt: when, receiptId: null },
    items: scorePacket.cases.map((c) => ({ caseId: c.caseId, inputSha256: c.inputSha256, bodySha256: c.bodySha256, promptSha256: c.prompt.promptSha256, output: { attentionScore: scores[c.caseId] ?? 0 } })),
  };
}
function fixtureManifest(p: ReturnType<typeof prepared>, split: "development" | "holdout" = "development") {
  return {
    schemaVersion: "p5.gold-metadata-draft/v1", datasetStatus: "DRAFT", formatNote: "fixture",
    candidates: p.cases.map((c, i) => ({
      caseId: c.caseId, eventGroupId: `event-${c.caseId}`, eventGroupStatus: "agent_verified",
      eventGroupVerification: { reviewer: "fixture", method: "fixture exact identity", verifiedAt: when, evidenceSha256: hash("event-evidence") },
      material: { title: c.title, originalTitle: null, publishedAt: c.publishedAt, sourceName: c.sourceName, bodyZh: c.bodyText, bodyOriginal: null },
      sourceFacts: { sourceKind: c.sourceKind, sourceTier: c.sourceTier, firstParty: true, language: "zh" },
      samplingContext: { benchmarkSplit: split, samplingStratum: "fixture", splitStatus: "agent_verified", splitVerification: { reviewer: "fixture", method: "fixture split", verifiedAt: when, evidenceSha256: hash("split-evidence") } },
      evidence: { sourceArticleId: c.caseId, sourceId: "fixture", url: c.url, sourceArtifact: "fixture", contentHash: hash(`content-${i}`), bodySha256: c.bodySha256, bodyReference: null, bodyStatus: "ok" },
      proposal: { decision: null, proposedBy: "fixture", rationale: "fixture only" },
      humanAnnotation: { status: "user_confirmed", decision: i === 0 ? "select" : "reject", confirmedBy: "fixture", confirmedAt: when },
    })),
  };
}

test("prepare freezes body-only inputs and rejects labels or bad body hashes", () => {
  const source = input([{ caseId: "one", bodyText: "测试正文" }]);
  const p = prepared(makePrepared(source, hash(JSON.stringify(source))));
  assert.equal(p.cases.length, 1);
  assert.equal(p.cases[0]!.bodySha256, hash("测试正文"));
  assert.ok(p.cases[0]!.prefilter.promptSha256);
  assert.ok(p.cases[0]!.score.promptSha256);
  assert.throws(() => makePrepared({ ...source, humanAnnotation: { decision: "select" } }, hash("input")), /forbidden field/);
  const bad = structuredClone(source);
  bad.items[0]!.bodySha256 = hash("other");
  assert.throws(() => makePrepared(bad, hash("input")), /body SHA-256 mismatch/);
});

test("BLOCK stops before score prompts; PASS and UNKNOWN retain exact source-tier threshold", () => {
  const p = prepared(makePrepared(input([
    { caseId: "block", bodyText: "无关内容" }, { caseId: "unknown", bodyText: "财政监管内容", sourceTier: "T1_5" },
    { caseId: "unscored", bodyText: "其他内容", sourceTier: "T9" },
  ]), hash("body-pack")));
  const pf = prefilterFor(p, { block: "BLOCK", unknown: "UNKNOWN" });
  const packet = createScorePacket(p, pf.value, pf.bytesSha);
  assert.deepEqual(packet.cases.map((x) => x.caseId), ["unknown"]);
  assert.equal(packet.cases[0]!.threshold, 65);
});

test("normalization uses the real pure aggregator, returns null receipts, and rejects missing or mismatched passes", () => {
  const p = prepared(makePrepared(input([{ caseId: "edge", bodyText: "完整正文" }]), hash("body-pack")));
  const pf = prefilterFor(p);
  const scorePacket = createScorePacket(p, pf.value, pf.bytesSha);
  const a = scorePass(scorePacket, "score-pass-1", { edge: 60 }, "fork-a");
  const b = scorePass(scorePacket, "score-pass-2", { edge: 60 }, "fork-b");
  const result = createPredictions(p, pf.value, pf.bytesSha, scorePacket, a, b);
  assert.equal(result.predictions[0]!.selected, true);
  assert.equal(result.predictions[0]!.score, 60);
  assert.equal(result.predictions[0]!.receiptId, null);
  assert.equal(result.executionKind, "native-offline-not-runtime-provider");
  assert.throws(() => createPredictions(p, pf.value, pf.bytesSha, scorePacket, a, { ...b, items: [] }), /case count mismatch/);
  assert.throws(() => createPredictions(p, pf.value, pf.bytesSha, scorePacket, a, { ...b, run: { ...b.run, nativeSessionId: a.run.nativeSessionId } }), /distinct native sessions/);
  assert.throws(() => createPredictions(p, pf.value, pf.bytesSha, scorePacket, { ...a, run: { ...a.run, nativeSessionId: "prefilter-session" } }, b), /prefilter and score passes/);
  const bad = structuredClone(b);
  bad.items[0]!.promptSha256 = hash("wrong prompt");
  assert.throws(() => createPredictions(p, pf.value, pf.bytesSha, scorePacket, a, bad), /identity\/prompt mismatch/);
});

test("strict tier boundary, unknown tier, and blocked gate match production decision behavior", () => {
  const p = prepared(makePrepared(input([
    { caseId: "tier-boundary", bodyText: "财政制度" },
    { caseId: "unknown-tier", bodyText: "财政制度", sourceTier: "T9" },
    { caseId: "blocked", bodyText: "营销材料" },
  ]), hash("body-pack")));
  const pf = prefilterFor(p, { blocked: "BLOCK" });
  const packet = createScorePacket(p, pf.value, pf.bytesSha);
  const a = scorePass(packet, "score-pass-1", { "tier-boundary": 60 }, "fork-a");
  const b = scorePass(packet, "score-pass-2", { "tier-boundary": 59 }, "fork-b");
  const result = createPredictions(p, pf.value, pf.bytesSha, packet, a, b);
  const byId = new Map(result.predictions.map((x) => [x.caseId, x]));
  assert.equal(byId.get("tier-boundary")!.score, 59);
  assert.equal(byId.get("tier-boundary")!.selected, false); // sum 119 < 2 × T1 threshold 120
  assert.equal(byId.get("unknown-tier")!.scores, null);
  assert.equal(byId.get("unknown-tier")!.selected, false);
  assert.equal(byId.get("blocked")!.scores, null);
  assert.equal(byId.get("blocked")!.relevance, "block");
  const tampered = rehashPredictions(result, (items) => items.map((x) => x.caseId === "blocked" ? { ...x, relevance: "pass" } : x));
  assert.throws(() => evaluate(tampered, hash(JSON.stringify(tampered)), fixtureManifest(p), [], hash("[]"), "development"), /prefilter\/relevance mismatch/);
});

test("evaluate validates the explicit seed file and runs sweep only on development", () => {
  const p = prepared(makePrepared(input([{ caseId: "one", bodyText: "测试正文" }, { caseId: "two", bodyText: "另一正文" }]), hash("body-pack")));
  const pf = prefilterFor(p);
  const packet = createScorePacket(p, pf.value, pf.bytesSha);
  const a = scorePass(packet, "score-pass-1", { one: 60, two: 50 }, "fork-a");
  const b = scorePass(packet, "score-pass-2", { one: 60, two: 50 }, "fork-b");
  const predictions = createPredictions(p, pf.value, pf.bytesSha, packet, a, b);
  const gold = fixtureManifest(p);
  const report = evaluate(predictions, hash(JSON.stringify(predictions)), gold, [], hash("[]"), "development");
  assert.equal(report.n, 2);
  assert.equal(report.tp, 1);
  assert.equal(report.tn, 1);
  assert.equal(report.sweep.length, 26);
  assert.equal(report.sweepStatus, "development-only");
  const holdoutGold = fixtureManifest(p, "holdout");
  assert.throws(() => evaluate(predictions, hash(JSON.stringify(predictions)), holdoutGold, ["one"], hash('["one"]'), "holdout"), /not READY_FOR_EVALUATION/);
});

test("one frozen prediction pack can evaluate disjoint development and holdout subsets", () => {
  const p = prepared(makePrepared(input([{ caseId: "dev", bodyText: "开发正文" }, { caseId: "holdout", bodyText: "留出正文" }]), hash("body-pack")));
  const pf = prefilterFor(p);
  const packet = createScorePacket(p, pf.value, pf.bytesSha);
  const a = scorePass(packet, "score-pass-1", { dev: 60, holdout: 60 }, "fork-a");
  const b = scorePass(packet, "score-pass-2", { dev: 60, holdout: 60 }, "fork-b");
  const predictions = createPredictions(p, pf.value, pf.bytesSha, packet, a, b);
  const gold = fixtureManifest(p);
  gold.candidates[1]!.samplingContext.benchmarkSplit = "holdout";
  const devReport = evaluate(predictions, hash(JSON.stringify(predictions)), gold, [], hash("[]"), "development");
  const holdoutReport = evaluate(predictions, hash(JSON.stringify(predictions)), gold, [], hash("[]"), "holdout");
  assert.equal(devReport.n, 1);
  assert.equal(devReport.coverage, 1);
  assert.equal(devReport.sweep.length, 26);
  assert.equal(holdoutReport.n, 1);
  assert.equal(holdoutReport.coverage, 1);
  assert.equal(holdoutReport.sweep.length, 0);
  assert.equal(holdoutReport.sweepStatus, "not-run-on-holdout");
});

test("fresh holdout-only predictions can evaluate against merged Gold and reject missing or unknown cases", () => {
  const p = prepared(makePrepared(input([
    { caseId: "dev", bodyText: "开发正文" }, { caseId: "holdout-a", bodyText: "留出正文甲" }, { caseId: "holdout-b", bodyText: "留出正文乙" },
  ]), hash("body-pack")));
  const pf = prefilterFor(p);
  const packet = createScorePacket(p, pf.value, pf.bytesSha);
  const a = scorePass(packet, "score-pass-1", { dev: 60, "holdout-a": 60, "holdout-b": 50 }, "fork-a");
  const b = scorePass(packet, "score-pass-2", { dev: 60, "holdout-a": 60, "holdout-b": 50 }, "fork-b");
  const fullPredictions = createPredictions(p, pf.value, pf.bytesSha, packet, a, b);
  const gold = fixtureManifest(p);
  gold.candidates[1]!.samplingContext.benchmarkSplit = "holdout";
  gold.candidates[2]!.samplingContext.benchmarkSplit = "holdout";
  const holdoutOnly = rehashPredictions(fullPredictions, (items) => items.filter((x) => x.caseId.startsWith("holdout-")));
  const report = evaluate(holdoutOnly, hash(JSON.stringify(holdoutOnly)), gold, [], hash("[]"), "holdout");
  assert.equal(report.n, 2);
  assert.equal(report.coverage, 1);
  assert.equal(report.sweep.length, 0);
  assert.throws(() => evaluate(holdoutOnly, hash(JSON.stringify(holdoutOnly)), gold, [], hash("[]"), "development"), /does not completely cover development/);
  const withUnknown = rehashPredictions(holdoutOnly, (items) => [{ ...items[0], caseId: "not-in-gold" }, items[1]]);
  assert.throws(() => evaluate(withUnknown, hash(JSON.stringify(withUnknown)), gold, [], hash("[]"), "holdout"), /unknown Gold caseId/);
});

test("data reader rejects symlink escapes and output files are private where POSIX modes apply", (t) => {
  const dataRoot = path.resolve(".data");
  const rel = `native-eval-security-${process.pid}-${Date.now()}`;
  const linkDir = path.join(dataRoot, rel, "escape");
  const outside = mkdtempSync(path.join(os.tmpdir(), "native-eval-outside-"));
  mkdirSync(path.dirname(linkDir), { recursive: true });
  mkdirSync(outside, { recursive: true });
  try {
    try { symlinkSync(outside, linkDir, "junction"); }
    catch (error) { t.skip(`symlink test unavailable: ${String(error)}`); return; }
    assert.throws(() => readJson(path.join(".data", rel, "escape", "secret.json")), /symlink path is not allowed/);
  } finally {
    rmSync(path.join(dataRoot, rel), { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
  const outputRel = path.join(".data", rel, "private.json");
  try {
    const absolute = writeNew(outputRel, { private: true });
    if (process.platform !== "win32") assert.equal(statSync(absolute).mode & 0o777, 0o600);
  } finally { rmSync(path.join(dataRoot, rel), { recursive: true, force: true }); }
});
