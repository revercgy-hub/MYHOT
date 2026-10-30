#!/usr/bin/env node
/**
 * Offline adapter for genuinely native Luna High runs. It prepares the site's real prompts,
 * validates recorded native responses, and delegates the deterministic gate to normalizeAnalysis.
 * It never calls runAnalysis/chatJson, opens a database, creates provider receipts, or starts workers.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, lstatSync, realpathSync, chmodSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { PREFILTER_SYSTEM } from "@aihot/backend/editorial/writing";
import { buildPrefilterRequest, boundedPrefilterLabel } from "../packages/backend/src/editorial/prefilter-input.ts";
import { SCORE_CALLS, SCORE_SYSTEM, ScoreSchema, buildScoreInput, normalizeAnalysis, PROMPT_VERSIONS, type AnalysisRun, type AnalyzeInputArticle } from "@aihot/backend/editorial/analyze";
import { validateManifest } from "./fiscal/gold-dataset.ts";
import { SELECTION } from "@aihot/industry/selection";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_ROOT = path.join(REPO_ROOT, ".data");
const FORMAT = "fiscal.native-selection";
const PREFILTER_SCHEMA = z.object({ label: z.enum(["PASS", "BLOCK", "UNKNOWN"]), reason: z.string().max(200) }).strict();
const RUN_META = z.object({
  executionSource: z.literal("codex-native-fork-none"),
  nativeModel: z.literal("Luna High"),
  nativeSessionId: z.string().trim().min(1).max(200),
  passId: z.string().trim().min(1).max(200),
  executedAt: z.string().datetime({ offset: true }),
  receiptId: z.null(),
}).strict();

type Tier = "T1" | "T1_5" | "T2" | string;
interface BodyItem {
  caseId: string;
  bodySha256: string;
  title: string;
  originalTitle: string | null;
  publishedAt: string | null;
  discoveredAt: string | null;
  sourceName: string;
  sourceKind: string;
  sourceTier: Tier;
  firstParty: boolean;
  sourceTags: string[];
  fetchesBody: boolean;
  url: string;
  bodyText: string;
}
interface PromptCase extends BodyItem {
  inputSha256: string;
  threshold: number | null;
  prefilter: { system: string; user: string; systemPromptSha256: string; userPromptSha256: string; promptSha256: string; inputPartial?: boolean; promptVersion?: string };
  score: { system: string; user: string; systemPromptSha256: string; userPromptSha256: string; promptSha256: string };
}

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
function digest(value: unknown): string { return sha256(stable(value)); }
function within(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return !!rel && rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}
function rejectSymlinkComponents(target: string): void {
  const rel = path.relative(DATA_ROOT, target);
  let current = DATA_ROOT;
  try { if (lstatSync(current).isSymbolicLink()) throw new Error(".data root must not be a symlink"); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  for (const component of rel.split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    try { if (lstatSync(current).isSymbolicLink()) throw new Error(`symlink path is not allowed: ${current}`); }
    catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") break; throw e; }
  }
}
function insideData(target: string, forWrite = false): string {
  const resolved = path.isAbsolute(target) ? path.resolve(target) : path.resolve(REPO_ROOT, target);
  if (!within(DATA_ROOT, resolved)) throw new Error(`path must be inside ${DATA_ROOT}`);
  rejectSymlinkComponents(resolved);
  const dataReal = realpathSync(DATA_ROOT), repoReal = realpathSync(REPO_ROOT);
  if (!within(repoReal, dataReal)) throw new Error(".data root must resolve inside the repository");
  if (forWrite) {
    const parent = path.dirname(resolved);
    try {
      const parentReal = realpathSync(parent);
      if (!within(dataReal, parentReal)) throw new Error("output directory resolves outside .data");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  } else {
    const targetReal = realpathSync(resolved);
    if (!within(dataReal, targetReal)) throw new Error("input file resolves outside .data");
  }
  return resolved;
}
export function readJson(target: string): { value: unknown; bytes: Buffer; path: string } {
  const resolved = insideData(target);
  if (!lstatSync(resolved).isFile()) throw new Error("input must be a regular file");
  const bytes = readFileSync(resolved);
  return { value: JSON.parse(bytes.toString("utf8")), bytes, path: resolved };
}
export function writeNew(target: string, value: unknown): string {
  const resolved = insideData(target, true);
  mkdirSync(path.dirname(resolved), { recursive: true, mode: 0o700 });
  insideData(target, true);
  writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  chmodSync(resolved, 0o600);
  return resolved;
}
function assertNoHumanOrOutcomeFields(value: unknown, field = "$"): void {
  if (Array.isArray(value)) { value.forEach((v, i) => assertNoHumanOrOutcomeFields(v, `${field}[${i}]`)); return; }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (/^(gold|human(annotation|decision|label)?|decision|selected|score|scores|seed|split|benchmark(split)?|proposal|rationale|confidence|event(group)?|sampling(context|stratum)?)$/i.test(key)) {
      throw new Error(`blind input contains forbidden field ${field}.${key}`);
    }
    assertNoHumanOrOutcomeFields(nested, `${field}.${key}`);
  }
}
function assertNoGoldLabels(value: unknown, field = "$"): void {
  if (Array.isArray(value)) { value.forEach((v, i) => assertNoGoldLabels(v, `${field}[${i}]`)); return; }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (/^(gold|humanAnnotation|humanDecision|humanLabel)$/i.test(key)) throw new Error(`prediction file contains forbidden label field ${field}.${key}`);
    assertNoGoldLabels(nested, `${field}.${key}`);
  }
}
function parseBodyInput(value: unknown): { format: string; items: BodyItem[] } {
  assertNoHumanOrOutcomeFields(value);
  const root = z.object({ format: z.literal(`${FORMAT}.input/v1`), items: z.array(z.object({
    caseId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/),
    bodySha256: z.string().regex(/^[a-f0-9]{64}$/i),
    title: z.string().trim().min(1), originalTitle: z.string().nullable(),
    publishedAt: z.string().datetime({ offset: true }).nullable(), discoveredAt: z.string().datetime({ offset: true }).nullable(),
    sourceName: z.string().trim().min(1), sourceKind: z.string().trim().min(1), sourceTier: z.string().trim().min(1),
    firstParty: z.boolean(), sourceTags: z.array(z.string()).default([]), fetchesBody: z.boolean(),
    url: z.string().url().refine((v) => /^https?:$/.test(new URL(v).protocol)), bodyText: z.string().min(1).refine((v) => v.trim().length > 0),
  }).strict()).min(1) }).strict().parse(value);
  const ids = new Set<string>();
  for (const item of root.items) {
    if (ids.has(item.caseId)) throw new Error(`duplicate caseId ${item.caseId}`);
    ids.add(item.caseId);
    if (sha256(item.bodyText) !== item.bodySha256.toLowerCase()) throw new Error(`body SHA-256 mismatch for ${item.caseId}`);
  }
  return root;
}
function toAnalyzeInput(i: BodyItem): AnalyzeInputArticle {
  return {
    id: i.caseId, revision: 1, title: i.originalTitle || i.title, url: i.url, author: null,
    publishedAt: i.publishedAt ? new Date(i.publishedAt) : null,
    discoveredAt: i.discoveredAt ? new Date(i.discoveredAt) : null,
    bodyText: i.bodyText, excerpt: null, bodyStatus: "ok", xPost: null, media: [],
    source: { name: i.sourceName, kind: i.sourceKind, tier: i.sourceTier, firstParty: i.firstParty, tags: i.sourceTags, fetchesBody: i.fetchesBody },
  };
}
function promptPair(system: string, user: string) {
  const systemPromptSha256 = sha256(system), userPromptSha256 = sha256(user);
  return { system, user, systemPromptSha256, userPromptSha256, promptSha256: sha256(`${system}\n\n${user}`) };
}
function makePrepared(input: unknown, inputSha256: string) {
  const parsed = parseBodyInput(input);
  const cases: PromptCase[] = parsed.items.map((item) => {
    const article = toAnalyzeInput(item);
    const request = buildPrefilterRequest(article, PREFILTER_SYSTEM, PROMPT_VERSIONS.prefilter);
    const prefilter = { ...promptPair(request.system, request.user), inputPartial: request.partial, promptVersion: request.promptVersion };
    const score = promptPair(SCORE_SYSTEM, buildScoreInput(article));
    return { ...item, inputSha256: digest(item), threshold: SELECTION.thresholds[item.sourceTier] ?? null, prefilter, score };
  });
  const unsigned = {
    format: `${FORMAT}.prepared/v1`, createdAt: new Date().toISOString(), inputSha256,
    promptVersions: { prefilter: PROMPT_VERSIONS.prefilter, score: PROMPT_VERSIONS.score },
    promptSystemSha256: { prefilter: sha256(PREFILTER_SYSTEM), score: sha256(SCORE_SYSTEM) },
    selectionRules: { scoreCalls: SCORE_CALLS, thresholds: SELECTION.thresholds, aggregator: "@aihot/backend/editorial/analyze.normalizeAnalysis" },
    caseCount: cases.length, cases,
  };
  return { ...unsigned, preparedSha256: digest(unsigned) };
}
function prepared(value: unknown): ReturnType<typeof makePrepared> {
  const p = value as ReturnType<typeof makePrepared>;
  if (p.format !== `${FORMAT}.prepared/v1` || !Array.isArray(p.cases) || typeof p.preparedSha256 !== "string") throw new Error("invalid prepared packet");
  const { preparedSha256, ...unsigned } = p;
  if (digest(unsigned) !== preparedSha256) throw new Error("prepared packet hash mismatch");
  if (p.promptVersions?.prefilter !== PROMPT_VERSIONS.prefilter || p.promptVersions?.score !== PROMPT_VERSIONS.score
    || p.promptSystemSha256?.prefilter !== sha256(PREFILTER_SYSTEM) || p.promptSystemSha256?.score !== sha256(SCORE_SYSTEM)) {
    throw new Error("frozen prompts changed since prepare");
  }
  if (p.selectionRules?.scoreCalls !== SCORE_CALLS || stable(p.selectionRules?.thresholds) !== stable(SELECTION.thresholds)) throw new Error("frozen selection rules changed since prepare");
  for (const c of p.cases) if (c.threshold !== (SELECTION.thresholds[c.sourceTier] ?? null)) throw new Error(`frozen tier threshold changed for ${c.caseId}`);
  return p as ReturnType<typeof makePrepared>;
}
function validateRun(value: unknown, label: string) {
  const meta = RUN_META.parse((value as { run?: unknown })?.run);
  if (meta.passId !== label) throw new Error(`${label} result has wrong passId`);
  return meta;
}
function parsePrefilter(value: unknown, packet: ReturnType<typeof prepared>, prefilterPacketSha256: string) {
  const root = z.object({ format: z.literal(`${FORMAT}.prefilter-results/v1`), preparedSha256: z.string(), prefilterPacketSha256: z.string(), run: RUN_META, items: z.array(z.object({ caseId: z.string(), inputSha256: z.string(), bodySha256: z.string(), promptSha256: z.string(), output: PREFILTER_SCHEMA }).strict()) }).strict().parse(value);
  if (root.preparedSha256 !== packet.preparedSha256) throw new Error("prefilter result preparedSha256 mismatch");
  if (root.prefilterPacketSha256 !== prefilterPacketSha256) throw new Error("prefilter result packet SHA-256 mismatch");
  validateRun(root, "prefilter");
  if (root.items.length !== packet.cases.length) throw new Error("prefilter result case count mismatch");
  const byId = new Map(root.items.map((x) => [x.caseId, x]));
  if (byId.size !== root.items.length) throw new Error("duplicate prefilter result caseId");
  for (const c of packet.cases) {
    const got = byId.get(c.caseId);
    if (!got || got.inputSha256 !== c.inputSha256 || got.bodySha256 !== c.bodySha256 || got.promptSha256 !== c.prefilter.promptSha256) throw new Error(`prefilter result identity/prompt mismatch for ${c.caseId}`);
  }
  return root;
}
function createPrefilterPacket(p: ReturnType<typeof prepared>) {
  const cases = p.cases.map((c) => ({ caseId: c.caseId, inputSha256: c.inputSha256, bodySha256: c.bodySha256, prompt: c.prefilter }));
  const unsigned = { format: `${FORMAT}.prefilter-packet/v1`, preparedSha256: p.preparedSha256, promptVersion: p.promptVersions.prefilter, cases };
  return { ...unsigned, packetSha256: digest(unsigned) };
}
function createScorePacket(p: ReturnType<typeof prepared>, prefilterValue: unknown, prefilterBytesSha: string) {
  const prefilter = parsePrefilter(prefilterValue, p, createPrefilterPacket(p).packetSha256);
  const byId = new Map(prefilter.items.map((i) => [i.caseId, i]));
  const cases = p.cases.filter((c) => boundedPrefilterLabel(byId.get(c.caseId)!.output.label, Boolean(c.prefilter.inputPartial)) !== "BLOCK" && c.threshold !== null).map((c) => ({
    caseId: c.caseId, inputSha256: c.inputSha256, bodySha256: c.bodySha256, threshold: c.threshold, prompt: c.score,
  }));
  const unsigned = {
    format: `${FORMAT}.score-packet/v1`, preparedSha256: p.preparedSha256,
    prefilterResultsSha256: prefilterBytesSha, promptVersion: p.promptVersions.score, cases,
  };
  return { ...unsigned, packetSha256: digest(unsigned) };
}
function parseScoreResults(value: unknown, p: ReturnType<typeof prepared>, scorePacket: ReturnType<typeof createScorePacket>, pass: "score-pass-1" | "score-pass-2") {
  const root = z.object({ format: z.literal(`${FORMAT}.score-results/v1`), preparedSha256: z.string(), scorePacketSha256: z.string(), run: RUN_META, items: z.array(z.object({ caseId: z.string(), inputSha256: z.string(), bodySha256: z.string(), promptSha256: z.string(), output: z.object({ attentionScore: ScoreSchema.shape.attentionScore }).strict() }).strict()) }).strict().parse(value);
  if (root.preparedSha256 !== p.preparedSha256 || root.scorePacketSha256 !== scorePacket.packetSha256) throw new Error(`${pass} packet hash mismatch`);
  const meta = validateRun(root, pass);
  if (root.items.length !== scorePacket.cases.length) throw new Error(`${pass} case count mismatch`);
  const byId = new Map(root.items.map((x) => [x.caseId, x]));
  if (byId.size !== root.items.length) throw new Error(`duplicate ${pass} caseId`);
  for (const c of scorePacket.cases) {
    const got = byId.get(c.caseId);
    const preparedCase = p.cases.find((x) => x.caseId === c.caseId)!;
    if (!got || got.inputSha256 !== c.inputSha256 || got.bodySha256 !== c.bodySha256 || got.promptSha256 !== c.prompt.promptSha256 || got.inputSha256 !== preparedCase.inputSha256) throw new Error(`${pass} identity/prompt mismatch for ${c.caseId}`);
    ScoreSchema.parse(got.output);
  }
  return { meta, byId };
}
function createPredictions(p: ReturnType<typeof prepared>, prefilterValue: unknown, prefilterBytesSha: string, scorePacket: ReturnType<typeof createScorePacket>, score1Value: unknown, score2Value: unknown, score1BytesSha = digest(score1Value), score2BytesSha = digest(score2Value)) {
  const prefilter = parsePrefilter(prefilterValue, p, createPrefilterPacket(p).packetSha256);
  const first = parseScoreResults(score1Value, p, scorePacket, "score-pass-1");
  const second = parseScoreResults(score2Value, p, scorePacket, "score-pass-2");
  if (first.meta.nativeSessionId === second.meta.nativeSessionId || first.meta.passId === second.meta.passId) throw new Error("two score passes must have distinct native sessions and pass IDs");
  if (prefilter.run.nativeSessionId === first.meta.nativeSessionId || prefilter.run.nativeSessionId === second.meta.nativeSessionId) throw new Error("prefilter and score passes must use distinct native sessions");
  const preById = new Map(prefilter.items.map((x) => [x.caseId, x]));
  const scoreIds = new Set(scorePacket.cases.map((x) => x.caseId));
  const predictions = p.cases.map((c) => {
    const pf = preById.get(c.caseId)!;
    const gate = boundedPrefilterLabel(pf.output.label, Boolean(c.prefilter.inputPartial));
    const scoreExpected = gate !== "BLOCK" && c.threshold !== null;
    if (scoreExpected !== scoreIds.has(c.caseId)) throw new Error(`gate/score packet mismatch for ${c.caseId}`);
    const v1 = first.byId.get(c.caseId)?.output.attentionScore;
    const v2 = second.byId.get(c.caseId)?.output.attentionScore;
    if (scoreExpected && (v1 === undefined || v2 === undefined)) throw new Error(`missing second score or score for ${c.caseId}`);
    const scores = scoreExpected ? [ScoreSchema.parse({ attentionScore: v1 }).attentionScore, ScoreSchema.parse({ attentionScore: v2 }).attentionScore] : null;
    const run = {
      prefilter: { label: gate, reason: pf.output.reason, model: "Luna High", reused: false },
      scores: scores ? { model: "Luna High", threshold: c.threshold!, values: scores, receiptIds: [], reused: false } : null,
      writing: null, structure: null,
    } as unknown as AnalysisRun;
    const out = normalizeAnalysis(run);
    return {
      caseId: c.caseId, bodySha256: c.bodySha256, inputSha256: c.inputSha256,
      promptSha256: { prefilter: c.prefilter.promptSha256, score: c.score.promptSha256 },
      prefilterLabel: gate, scores, threshold: c.threshold, score: out.score,
      relevance: out.relevance, selected: out.selected, decision: out.selected ? "select" : "reject",
      receiptId: null,
    };
  });
  const unsigned = {
    format: `${FORMAT}.predictions/v1`, createdAt: new Date().toISOString(), preparedSha256: p.preparedSha256,
    prefilterResultsSha256: prefilterBytesSha, scorePacketSha256: scorePacket.packetSha256,
    prefilterRun: { ...prefilter.run, resultSha256: prefilterBytesSha },
    scorePasses: [first.meta, second.meta].map((m, i) => ({ executionSource: m.executionSource, nativeModel: m.nativeModel, nativeSessionId: m.nativeSessionId, passId: m.passId, executedAt: m.executedAt, resultSha256: i === 0 ? score1BytesSha : score2BytesSha, receiptId: null })),
    count: predictions.length, selectionMethod: "@aihot/backend/editorial/analyze.normalizeAnalysis",
    executionKind: "native-offline-not-runtime-provider", predictions,
  };
  return { ...unsigned, predictionsSha256: digest(unsigned) };
}
function evaluate(predictionsValue: unknown, predictionBytesSha256: string, manifestValue: unknown, seedValue: unknown, seedBytesSha256: string, split: "development" | "holdout") {
  assertNoGoldLabels(predictionsValue);
  const predictions = z.object({ format: z.literal(`${FORMAT}.predictions/v1`), predictions: z.array(z.object({
    caseId: z.string(), bodySha256: z.string(), inputSha256: z.string(),
    promptSha256: z.object({ prefilter: z.string(), score: z.string() }).strict(),
    prefilterLabel: z.enum(["PASS", "BLOCK", "UNKNOWN"]), scores: z.array(z.number().int().min(0).max(100)).length(2).nullable(),
    threshold: z.number().nullable(), score: z.number().int().min(0).max(100).nullable(),
    selected: z.boolean(), decision: z.enum(["select", "reject"]), relevance: z.enum(["block", "pass"]), receiptId: z.null(),
  }).strict()).min(1), executionKind: z.literal("native-offline-not-runtime-provider") }).passthrough().parse(predictionsValue);
  const { predictionsSha256, ...unsignedPredictions } = predictionsValue as Record<string, unknown>;
  if (typeof predictionsSha256 !== "string" || digest(unsignedPredictions) !== predictionsSha256) throw new Error("predictions hash mismatch");
  const seedIds = z.array(z.string().min(1)).parse(seedValue);
  const seedSet = new Set(seedIds);
  if (seedSet.size !== seedIds.length) throw new Error("seed file contains duplicate case IDs");
  const validation = validateManifest(manifestValue, { caseIds: seedIds, fileSha256: seedBytesSha256 });
  if (validation.status !== "READY_FOR_EVALUATION") throw new Error(`Gold manifest is not READY_FOR_EVALUATION (${validation.status}; ${validation.issues.length} issues)`);
  const manifest = manifestValue as { candidates: Array<any> };
  const allRows = manifest.candidates;
  const rows = allRows.filter((c) => c.samplingContext.benchmarkSplit === split);
  if (!rows.length) throw new Error(`Gold manifest has no ${split} rows`);
  const predById = new Map(predictions.predictions.map((x) => [x.caseId, x]));
  if (predById.size !== predictions.predictions.length) throw new Error("duplicate prediction caseId");
  const goldById = new Map(allRows.map((r) => [r.caseId, r]));
  if (predictions.predictions.some((r) => !goldById.has(r.caseId))) throw new Error("prediction contains unknown Gold caseId");
  if (rows.some((r) => !predById.has(r.caseId))) throw new Error(`prediction case set does not completely cover ${split} split`);
  for (const p of predictions.predictions) {
    const r = goldById.get(p.caseId)!;
    if (r.evidence.bodySha256 !== p.bodySha256) throw new Error(`body hash mismatch for ${r.caseId}`);
    const expectedThreshold = SELECTION.thresholds[r.sourceFacts.sourceTier ?? ""] ?? null;
    if (p.threshold !== expectedThreshold) throw new Error(`source-tier threshold mismatch for ${r.caseId}`);
    const expectedScore = p.scores ? Math.floor((p.scores[0]! + p.scores[1]!) / 2) : null;
    if (p.score !== expectedScore) throw new Error(`score mean mismatch for ${r.caseId}`);
    if (p.relevance !== (p.prefilterLabel === "BLOCK" ? "block" : "pass")) throw new Error(`prefilter/relevance mismatch for ${r.caseId}`);
    const expectedSelected = p.prefilterLabel !== "BLOCK" && expectedThreshold !== null && !!p.scores && (p.scores[0]! + p.scores[1]!) >= expectedThreshold * 2;
    if (p.selected !== expectedSelected || p.decision !== (expectedSelected ? "select" : "reject")) throw new Error(`deterministic selection mismatch for ${r.caseId}`);
  }
  if (split === "holdout" && rows.some((r) => seedSet.has(r.caseId))) throw new Error("a preference seed is present in holdout");
  let tp = 0, fp = 0, fn = 0, tn = 0, either = 0, errors = 0;
  const cases: Array<Record<string, unknown>> = [];
  for (const r of rows) {
    const p = predById.get(r.caseId)!;
    const gold = r.humanAnnotation.decision as "select" | "reject" | "either";
    if (gold === "either") either++;
    else if (p.decision === "select" && gold === "select") tp++;
    else if (p.decision === "select") fp++;
    else if (gold === "select") fn++;
    else tn++;
    cases.push({ caseId: r.caseId, title: r.material.title, stratum: r.samplingContext.samplingStratum, gold, decision: p.decision, score: p.score, threshold: p.threshold, relevance: p.relevance ?? (p.prefilterLabel === "BLOCK" ? "block" : "pass"), bodySha256: p.bodySha256 });
  }
  const n = tp + fp + fn + tn;
  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = tp + fn ? tp / (tp + fn) : null;
  const f1 = precision !== null && recall !== null && precision + recall ? 2 * precision * recall / (precision + recall) : null;
  const sweep = split === "development" ? Array.from({ length: 26 }, (_, i) => 40 + i * 2).map((t) => {
    let a = 0, b = 0, c = 0, d = 0;
    for (const r of rows) {
      const p = predById.get(r.caseId)!;
      const gold = r.humanAnnotation.decision;
      if (gold === "either") continue;
      const selected = p.prefilterLabel !== "BLOCK" && p.score !== null && p.score >= t;
      if (selected && gold === "select") a++; else if (selected) b++; else if (gold === "select") c++; else d++;
    }
    const pr = a + b ? a / (a + b) : null, re = a + c ? a / (a + c) : null;
    return { threshold: t, tp: a, fp: b, fn: c, tn: d, accuracy: a + b + c + d ? (a + d) / (a + b + c + d) : null, precision: pr, recall: re, f1: pr !== null && re !== null && pr + re ? 2 * pr * re / (pr + re) : null };
  }) : [];
  const evaluation = {
    format: `${FORMAT}.evaluation/v1`, createdAt: new Date().toISOString(), evaluationKind: "native-offline-not-runtime-provider",
    split, predictionFileSha256: predictionBytesSha256, predictionsSha256: (predictionsValue as { predictionsSha256?: string }).predictionsSha256 ?? null,
    goldManifestSha256: sha256(stable(manifestValue)), seedCaseIdsSha256: seedBytesSha256,
    n: rows.length, decisive: n, either, errors, tp, fp, fn, tn,
    coverage: rows.length ? rows.filter((r) => predById.has(r.caseId)).length / rows.length : 0,
    decisiveLabelCoverage: rows.length !== either ? n / (rows.length - either) : null,
    accuracy: n ? (tp + tn) / n : null, precision, recall, f1,
    fixedThresholdDecisionsPreserved: true, sweep: split === "development" ? sweep : [],
    sweepStatus: split === "development" ? "development-only" : "not-run-on-holdout", cases,
  };
  const selectBenchSweep = sweep.map((row) => ({ t: row.threshold, acc: row.accuracy === null ? null : Number(row.accuracy.toFixed(3)), P: row.precision === null ? null : Number(row.precision.toFixed(3)), R: row.recall === null ? null : Number(row.recall.toFixed(3)), F1: row.f1 === null ? null : Number(row.f1.toFixed(3)), sel: rows.length ? Number(((row.tp + row.fp) / Math.max(1, row.tp + row.fp + row.fn + row.tn)).toFixed(3)) : 0 }));
  const selectBenchCases = cases.map((c) => ({
    caseId: c.caseId, title: c.title, stratum: c.stratum, gold: c.gold, decision: c.decision,
    score: c.score, relevance: c.relevance, category: null, reason: null, receiptId: null, error: null,
  }));
  const selectBenchReport = {
    meta: { split, n: rows.length, seed: null, promptVersion: `${PROMPT_VERSIONS.prefilter}+${PROMPT_VERSIONS.score}`, executionKind: "native-offline-not-runtime-provider", receiptIds: "none" },
    models: { "native-luna-high-offline": { summary: {
      model: "native-luna-high-offline", n: rows.length, decisive: n, either, errors,
      tp, fp, fn, tn, accuracy: evaluation.accuracy === null ? 0 : Number(evaluation.accuracy.toFixed(3)),
      precision: precision === null ? 0 : Number(precision.toFixed(3)), recall: recall === null ? 0 : Number(recall.toFixed(3)),
      f1: f1 === null ? 0 : Number(f1.toFixed(3)), selectedRate: n ? Number(((tp + fp) / n).toFixed(3)) : 0,
      goldSelectRate: n ? Number(((tp + fn) / n).toFixed(3)) : 0,
      executionKind: "native-offline-not-runtime-provider", providerReceipts: 0,
      predictionFileSha256: predictionBytesSha256, goldManifestSha256: evaluation.goldManifestSha256, seedCaseIdsSha256: seedBytesSha256,
    }, sweep: selectBenchSweep, cases: selectBenchCases } },
  };
  return { ...evaluation, selectBenchReport };
}

function args(argv: string[]) {
  const [command, ...tail] = argv;
  const values: Record<string, string> = {};
  for (let i = 0; i < tail.length; i++) {
    const key = tail[i]!;
    if (!key.startsWith("--") || !tail[i + 1] || tail[i + 1]!.startsWith("--")) throw new Error(`expected --name value near ${key}`);
    values[key.slice(2)] = tail[++i]!;
  }
  return { command, values };
}
function required(v: Record<string, string>, name: string): string { if (!v[name]) throw new Error(`missing --${name}`); return v[name]!; }
function main(argv: string[]): number {
  try {
    const { command, values } = args(argv);
    if (command === "prepare") {
      const input = readJson(required(values, "input"));
      const result = makePrepared(input.value, sha256(input.bytes));
      const preparedPath = writeNew(required(values, "out"), result);
      const packet = createPrefilterPacket(result);
      const packetPath = writeNew(required(values, "prefilter-out"), packet);
      console.log(JSON.stringify({ status: "prepared", preparedPath, preparedSha256: result.preparedSha256, prefilterPacketPath: packetPath, prefilterPacketSha256: packet.packetSha256, count: result.caseCount }));
      return 0;
    }
    if (command === "prepare-scores") {
      const pFile = readJson(required(values, "prepared")), pfFile = readJson(required(values, "prefilter"));
      const p = prepared(pFile.value), packet = createScorePacket(p, pfFile.value, sha256(pfFile.bytes));
      const scorePath = writeNew(required(values, "out"), packet);
      console.log(JSON.stringify({ status: "score-packet-ready", scorePath, packetSha256: packet.packetSha256, count: packet.cases.length }));
      return 0;
    }
    if (command === "normalize") {
      const pFile = readJson(required(values, "prepared")), pfFile = readJson(required(values, "prefilter")), sFile = readJson(required(values, "score-packet"));
      const aFile = readJson(required(values, "score-pass-1")), bFile = readJson(required(values, "score-pass-2"));
      const p = prepared(pFile.value), scorePacket = sFile.value as ReturnType<typeof createScorePacket>;
      if (scorePacket.prefilterResultsSha256 !== sha256(pfFile.bytes)) throw new Error("score packet was not prepared from this frozen prefilter result");
      const expectedScorePacket = createScorePacket(p, pfFile.value, sha256(pfFile.bytes));
      if (stable(scorePacket) !== stable(expectedScorePacket)) throw new Error("score packet hash/content mismatch");
      const predictions = createPredictions(p, pfFile.value, sha256(pfFile.bytes), scorePacket, aFile.value, bFile.value, sha256(aFile.bytes), sha256(bFile.bytes));
      const target = writeNew(required(values, "out"), predictions);
      console.log(JSON.stringify({ status: "normalized", target, predictionsSha256: predictions.predictionsSha256, count: predictions.count, receiptIdsCreated: 0, databaseWrites: 0 }));
      return 0;
    }
    if (command === "evaluate") {
      const pFile = readJson(required(values, "predictions")), gFile = readJson(required(values, "gold")), seedFile = readJson(required(values, "seed-case-ids"));
      const split = required(values, "split");
      if (split !== "development" && split !== "holdout") throw new Error("--split must be development or holdout");
      const report = evaluate(pFile.value, sha256(pFile.bytes), gFile.value, seedFile.value, sha256(seedFile.bytes), split);
      const target = writeNew(required(values, "out"), report);
      console.log(JSON.stringify({ status: "evaluated", target, split, n: report.n, accuracy: report.accuracy, precision: report.precision, recall: report.recall, f1: report.f1, sweepStatus: report.sweepStatus }));
      return 0;
    }
    throw new Error("Usage: eval-selection-native.ts prepare|prepare-scores|normalize|evaluate --help");
  } catch (error) {
    console.error(String(error));
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) process.exitCode = main(process.argv.slice(2));

export { createPredictions, createPrefilterPacket, createScorePacket, evaluate, makePrepared, parseBodyInput, prepared };
