import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { config } from "../packages/backend/src/config.ts";
import { promptText } from "../packages/backend/src/editorial/prompts.ts";
import { sha256, stableJson } from "../packages/backend/src/lib/ids.ts";
import {
  consumeSummaryDraftCallOnce, extractFiscalRelevanceRules, loadSummaryDraftPromptAsset, normalizeSummaryDraftTags,
  renderSummaryDraftPromptAsset, SummaryDraftModelOutputSchema, type SummaryDraftModelOutput,
} from "../scripts/fiscal/nas-summary-draft-nightly.ts";

const block: SummaryDraftModelOutput = SummaryDraftModelOutputSchema.parse({ relevance: "BLOCK", reason: "正文仅为干部理论学习，没有财政业务事实。", titleZh: "", summaryZh: "", category: null, tags: [] });
const pass: SummaryDraftModelOutput = SummaryDraftModelOutputSchema.parse({ relevance: "PASS", reason: "正文包含具体预算执行监管事实。", titleZh: "财政部门开展预算执行核验",
  summaryZh: "财政部门对预算执行开展核验并公布发现的问题。", category: "local-practice", tags: ["地方实践", "预算管理", "财政"] });
const unknown: SummaryDraftModelOutput = SummaryDraftModelOutputSchema.parse({ relevance: "UNKNOWN", reason: "标题未说明活动结果，正文信息仍需人工判断。", titleZh: "财政部门开展预算执行核验",
  summaryZh: "财政部门对预算执行开展核验并公布发现的问题。", category: "local-practice", tags: ["地方实践", "预算管理", "财政"] });

test("summary prompt asset reuses the unchanged fiscal prefilter rules and binds the taxonomy", () => {
  const prefilter = promptText("prefilter");
  assert.equal(Buffer.byteLength(prefilter), 3314);
  assert.equal(sha256(prefilter), "57c60e71ace2cec9c390468ae51ca400a9e0d929271fc1aae098a8ac4443c74e");
  const rules = extractFiscalRelevanceRules();
  const asset = renderSummaryDraftPromptAsset();
  assert.ok(rules.startsWith("PASS："));
  assert.ok(rules.includes("活动形式本身不决定标签"));
  assert.ok(asset.system.includes(rules));
  assert.ok(asset.system.includes("党建") && rules.includes("培训"));
  assert.equal(asset.systemSha256, sha256(asset.system));
  assert.ok(asset.promptVersion.endsWith(`+taxonomy@${asset.taxonomySha256}`));
});

test("classifier output accepts valid fiscal taxonomy, canonicalizes known synonyms, and holds invalid labels", () => {
  assert.equal(SummaryDraftModelOutputSchema.safeParse(pass).success, true);
  assert.equal(SummaryDraftModelOutputSchema.safeParse(unknown).success, true);
  assert.equal(SummaryDraftModelOutputSchema.safeParse(block).success, true);
  assert.deepEqual(normalizeSummaryDraftTags(pass.tags), ["地方实践", "预算管理", "财政收支"]);
  assert.equal(SummaryDraftModelOutputSchema.safeParse({ ...pass, category: "not-a-category" }).success, false);
  assert.equal(SummaryDraftModelOutputSchema.safeParse({ ...pass, tags: ["地方实践", "发明标签"] }).success, false);
  assert.equal(SummaryDraftModelOutputSchema.safeParse({ ...pass, tags: ["预算管理", "地方实践"] }).success, false);
  assert.equal(SummaryDraftModelOutputSchema.safeParse({ ...block, reason: "" }).success, false);
});

test("one provider response records a reasoned BLOCK without writing a draft; UNKNOWN remains a draft for review", async () => {
  let calls = 0, completed: number[] = [], writes = 0;
  const held = await consumeSummaryDraftCallOnce({
    call: async () => { calls += 1; return { data: block, receiptId: 7101, reused: false }; },
    completeReceipt: async (id) => { completed.push(id); },
    createDraft: async () => { throw new Error("BLOCK must not create a draft"); },
    writeDraft: async () => { writes += 1; },
  });
  assert.deepEqual(held, { status: "HOLD_relevance_block", reason: block.reason, receiptId: 7101, relevance: "BLOCK" });
  assert.equal(calls, 1);
  assert.deepEqual(completed, [7101]);
  assert.equal(writes, 0);

  const reviewRows: unknown[] = [];
  const drafted = await consumeSummaryDraftCallOnce({
    call: async () => { calls += 1; return { data: unknown, receiptId: 7102, reused: false }; },
    completeReceipt: async (id) => { completed.push(id); },
    createDraft: async (output) => ({ relevance: output.relevance, category: output.category, tags: normalizeSummaryDraftTags(output.tags) }),
    writeDraft: async (draft) => { writes += 1; reviewRows.push(draft); },
  });
  assert.equal(calls, 2);
  assert.equal(writes, 1);
  assert.equal((drafted as any).status, "draft");
  assert.equal((drafted as any).relevance, "UNKNOWN");
  assert.equal((reviewRows[0] as any).relevance, "UNKNOWN");
  assert.deepEqual(completed, [7101, 7102]);
});

test("prompt asset verification checks raw file hash and runtime taxonomy without accessing the prompt source tree", async () => {
  const directory = path.join(config.dataDir, `summary-prompt-asset-test-${randomBytes(4).toString("hex")}`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, "prompt.json");
  try {
    const asset = renderSummaryDraftPromptAsset();
    const bytes = Buffer.from(`${stableJson(asset)}\n`);
    await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
    const verified = await loadSummaryDraftPromptAsset({ file, expectedSha256: sha256(bytes) });
    assert.equal(verified.systemSha256, asset.systemSha256);
    await assert.rejects(loadSummaryDraftPromptAsset({ file, expectedSha256: "0".repeat(64) }), /SHA-256 mismatch/u);
    const badSystemBytes = Buffer.from(`${stableJson({ ...asset, system: `${asset.system} ` })}\n`);
    await writeFile(file, badSystemBytes);
    await assert.rejects(loadSummaryDraftPromptAsset({ file, expectedSha256: sha256(badSystemBytes) }), /hash or taxonomy binding mismatch/u);
    const badTaxonomy = { ...asset, taxonomySha256: "0".repeat(64) };
    const badTaxonomyBytes = Buffer.from(`${stableJson(badTaxonomy)}\n`);
    await writeFile(file, badTaxonomyBytes);
    await assert.rejects(loadSummaryDraftPromptAsset({ file, expectedSha256: sha256(badTaxonomyBytes) }), /hash or taxonomy binding mismatch/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
