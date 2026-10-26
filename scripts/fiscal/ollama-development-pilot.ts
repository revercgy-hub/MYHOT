import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  assertPilotDatabaseUrl,
  createOllamaPilotFetchGuard,
  OLLAMA_PILOT_CONSTANTS,
} from "./ollama-pilot-guard.mjs";

const INPUT_PATH = ".data/fiscal-qa/development150-local-pilot-20261026/inputs-request-only.json";
const INPUT_SHA256 = "95370FAA035D9322D4BDABB7E109A99BF3F9AE7ACDD411F9F98B233651271517";
const OUTPUT_PATH = ".data/fiscal-qa/development150-local-pilot-20261026/predictions-r1.json";
const ATTEMPT_TAG = "ollama-development-pilot-20261026-r1";
const SUMMARY_IDS = new Set([
  "body-j33dctglguvwqfa4ksqsdlwdf",
  "body-ebtwbnudqgmlkzj60wviji165",
  "body-fn6rshoxnk425y3ui1cxr6mpp",
  "body-ajak9rax7v0lpxc0zy81grskt",
]);
const CAPABILITY_ENV = [
  "PREFILTER_MODEL", "SCORE_MODEL", "UNDERSTAND_MODEL", "SUMMARIZE_MODEL", "STRUCTURE_MODEL",
  "GROUP_MODEL", "GROUP_REVIEW_MODEL", "DIGEST_MODEL", "REPORT_MODEL", "TRANSLATE_MODEL", "MONITOR_MODEL",
];
const PROVIDER_ENV = [
  "ZHIPU_API_KEY", "ZHIPU_BASE_URL", "DEEPSEEK_API_KEY", "DEEPSEEK_BASE_URL",
  "DASHSCOPE_API_KEY", "DASHSCOPE_BASE_URL", "XIAOMI_MIMO_API_KEY", "XIAOMI_MIMO_BASE_URL",
  "OPENAI_API_KEY", "OPENAI_BASE_URL", "ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL",
];
const DISABLED_FEATURE_ENV = [
  "COLLECT_ENABLED", "JINA_BODY_FALLBACK", "FEISHU_CONTENT_PUSH_ENABLED",
  "FEISHU_INTERNAL_ENABLED", "INDEXNOW_SUBMIT_ENABLED", "EMBEDDINGS_ENABLED", "OCR_RUN_ENABLED",
  "WORKER_ENABLED", "ALLOW_PRIVATE_NETWORK_FETCH",
];
const EMPTY_CREDENTIALS_DIR = path.resolve(".data/fiscal-qa/ollama-pilot-empty-credentials-do-not-create");
const PROXY_ENV = ["EGRESS_PROXY_URL", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"];

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function configureProcess(): void {
  if (!process.env.LLM_API_KEY?.trim()) throw new Error("LLM_API_KEY must be injected by the approved local operator");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the dedicated pilot database");
  assertPilotDatabaseUrl(process.env.DATABASE_URL);
  if (existsSync(EMPTY_CREDENTIALS_DIR)) throw new Error("Credential isolation path exists; refusing to load any credentials file");

  for (const name of [...PROVIDER_ENV, ...CAPABILITY_ENV]) delete process.env[name];
  for (const name of PROXY_ENV) delete process.env[name];
  process.env.LLM_BASE_URL = OLLAMA_PILOT_CONSTANTS.baseUrl;
  process.env.LLM_MODEL = OLLAMA_PILOT_CONSTANTS.model;
  process.env.LLM_EXTRA_JSON = JSON.stringify({ reasoning_effort: "none" });
  process.env.LLM_JSON_MODE = "true";
  process.env.LLM_VISION = "false";
  process.env.MODEL_CALLS_ENABLED = "true";
  process.env.AIHOT_CREDENTIALS_DIR = EMPTY_CREDENTIALS_DIR;
  process.env.DATABASE_POOL_MAX = "1";
  for (const name of DISABLED_FEATURE_ENV) process.env[name] = "false";
}

function toAnalyzeInput(input: any): any {
  return {
    ...input,
    publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
    discoveredAt: input.discoveredAt ? new Date(input.discoveredAt) : null,
  };
}

function safeFailure(stage: string, caseId: string, error: unknown): Error {
  const name = error instanceof Error ? error.name : "UnknownError";
  // Do not print provider error text: it may contain a response excerpt or prompt material.
  return new Error(`Pilot stopped at ${stage} for ${caseId} (${name}); inspect the sanitized receipt status only`);
}

async function main(): Promise<void> {
  configureProcess();

  const inputBytes = await readFile(INPUT_PATH);
  if (sha256(inputBytes) !== INPUT_SHA256) throw new Error("Frozen request-only input hash mismatch");
  const frozen = JSON.parse(inputBytes.toString("utf8")) as { sourceSplit: string; cases: Array<{ caseId: string; input: any }> };
  if (frozen.sourceSplit !== "development" || frozen.cases.length !== 12) throw new Error("Frozen development sample shape mismatch");
  const uniqueIds = new Set(frozen.cases.map((row) => row.caseId));
  if (uniqueIds.size !== 12 || frozen.cases.some((row) => row.caseId !== row.input.id)) throw new Error("Frozen sample IDs are inconsistent");
  for (const { input } of frozen.cases) {
    if (input.gold !== undefined || input.label !== undefined || input.stratum !== undefined) throw new Error("Gold data found in request-only input; aborting");
  }
  if ([...SUMMARY_IDS].some((id) => !uniqueIds.has(id))) throw new Error("Frozen summary allowlist is outside the request-only sample");
  if (existsSync(OUTPUT_PATH)) throw new Error("Prediction output already exists; refusing to spend any request budget");

  const originalFetch = globalThis.fetch;
  const fetchGuard = createOllamaPilotFetchGuard({ apiKey: process.env.LLM_API_KEY });
  globalThis.fetch = fetchGuard as typeof fetch;
  let closeDb: (() => Promise<void>) | undefined;
  try {
    const [{ sql, closeDb: closeDatabase }, analyze, writing, llm, models] = await Promise.all([
      import("../../packages/backend/src/db.ts"),
      import("../../packages/backend/src/editorial/analyze.ts"),
      import("../../packages/backend/src/editorial/writing.ts"),
      import("../../packages/backend/src/providers/llm.ts"),
      import("../../packages/backend/src/editorial/models.ts"),
    ]);
    closeDb = closeDatabase;

    if (await models.modelFor("prefilter") !== "default" || await models.modelFor("score") !== "default" || await models.modelFor("summarize") !== "default") {
      throw new Error("Capability model override detected");
    }
    const [modelRows] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM settings WHERE key LIKE 'models.%'`;
    if (modelRows!.count !== 0) throw new Error("Database model override detected");
    const [budgets] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM budgets WHERE service = 'llm'`;
    if (budgets!.count !== 1) throw new Error("Finite llm budget row is missing or duplicated");
    await sql`UPDATE budgets SET per_minute = 40, per_hour = 40, per_day = 40, note = 'isolated 40-request local pilot cap' WHERE service = 'llm'`;
    const [budget] = await sql<{ per_minute: number; per_hour: number; per_day: number }[]>`SELECT per_minute, per_hour, per_day FROM budgets WHERE service = 'llm'`;
    if (budget!.per_minute !== 40 || budget!.per_hour !== 40 || budget!.per_day !== 40) throw new Error("Finite llm budget verification failed");

    const [receiptCounts] = await sql<{ receipts: number; attempts: number }[]>`
      SELECT (SELECT count(*)::int FROM receipts) AS receipts, (SELECT count(*)::int FROM receipt_attempts) AS attempts`;
    if (receiptCounts!.receipts !== 0 || receiptCounts!.attempts !== 0) throw new Error("Pilot database is not empty; refusing receipt reuse");
    const [businessBefore] = await sql<{ sources: number; articles: number; analyses: number; publications: number; fetch_runs: number; job_runs: number; translations: number }[]>`
      SELECT (SELECT count(*)::int FROM sources) AS sources,
             (SELECT count(*)::int FROM articles) AS articles,
             (SELECT count(*)::int FROM analyses) AS analyses,
             (SELECT count(*)::int FROM publications) AS publications,
             (SELECT count(*)::int FROM fetch_runs) AS fetch_runs,
             (SELECT count(*)::int FROM job_runs) AS job_runs,
             (SELECT count(*)::int FROM translations) AS translations`;
    if (Object.values(businessBefore!).some((count) => count !== 0)) {
      throw new Error("Pilot database contains business rows; refusing to run");
    }

    const predictions: any[] = [];
    for (const row of frozen.cases) {
      try {
        const result = await analyze.runAnalysis(toAnalyzeInput(row.input), {
          stages: "selection",
          scoreModel: "default",
          attemptTag: ATTEMPT_TAG,
        });
        const receiptIds = [result.prefilter.receiptId, ...(result.scores?.receiptIds ?? [])];
        await llm.markReceiptsCompleted(receiptIds);
        predictions.push({
          caseId: row.caseId,
          prefilter: { label: result.prefilter.label, reason: result.prefilter.reason, model: result.prefilter.model, receiptId: result.prefilter.receiptId },
          scores: result.scores ? { model: result.scores.model, threshold: result.scores.threshold, values: result.scores.values, receiptIds: result.scores.receiptIds } : null,
          scoreThresholdCandidate: result.scores ? result.scores.values.reduce((sum: number, value: number) => sum + value, 0) >= result.scores.threshold * 2 : null,
          stoppedAfterPrefilter: result.prefilter.label === "BLOCK",
        });
      } catch (error) {
        throw safeFailure("selection", row.caseId, error);
      }
    }

    const summaryResults: any[] = [];
    for (const row of frozen.cases.filter(({ caseId }) => SUMMARY_IDS.has(caseId))) {
      try {
        const article = toAnalyzeInput(row.input);
        const translateInput = writing.translateInputOf(article);
        const raw = await llm.chatJson({
          model: "default",
          purpose: "summarize_article",
          subject: `article:${article.id}@${article.revision}`,
          promptVersion: analyze.PROMPT_VERSIONS.summarize,
          system: "",
          user: writing.buildArticlePrompt(translateInput),
          schema: z.object({ titleZh: z.string(), summaryZh: z.string(), bodyZh: z.string() }),
          json: false,
          parse: writing.parseTranslateOutput,
          temperature: 0.2,
          maxTokens: 2048,
          attemptTag: `${ATTEMPT_TAG}:summary`,
        });
        await llm.markReceiptsCompleted([raw.receiptId]);
        const copy = writing.finalizeCopy(translateInput, { titleZh: raw.data.titleZh, summaryZh: raw.data.summaryZh });
        summaryResults.push({ caseId: row.caseId, model: raw.model, receiptId: raw.receiptId, titleZh: copy.titleZh, summaryZh: copy.summaryZh });
      } catch (error) {
        throw safeFailure("summary", row.caseId, error);
      }
    }

    const [businessAfter] = await sql<{ sources: number; articles: number; analyses: number; publications: number; fetch_runs: number; job_runs: number; translations: number }[]>`
      SELECT (SELECT count(*)::int FROM sources) AS sources,
             (SELECT count(*)::int FROM articles) AS articles,
             (SELECT count(*)::int FROM analyses) AS analyses,
             (SELECT count(*)::int FROM publications) AS publications,
             (SELECT count(*)::int FROM fetch_runs) AS fetch_runs,
             (SELECT count(*)::int FROM job_runs) AS job_runs,
             (SELECT count(*)::int FROM translations) AS translations`;
    const [receiptTotals] = await sql<{ receipts: number; attempts: number; completed: number; failed: number; pending: number; unknown: number }[]>`
      SELECT (SELECT count(*)::int FROM receipts) AS receipts,
             (SELECT count(*)::int FROM receipt_attempts) AS attempts,
             (SELECT count(*)::int FROM receipts WHERE status = 'completed') AS completed,
             (SELECT count(*)::int FROM receipts WHERE status = 'failed') AS failed,
             (SELECT count(*)::int FROM receipts WHERE status = 'pending') AS pending,
             (SELECT count(*)::int FROM receipts WHERE status = 'unknown') AS unknown`;
    if (JSON.stringify(businessBefore) !== JSON.stringify(businessAfter)) throw new Error("Business table counts changed during isolated pilot");
    if (fetchGuard.stats.inFlight !== 0 || fetchGuard.stats.requests > 40 || receiptTotals!.attempts !== fetchGuard.stats.requests || receiptTotals!.receipts !== fetchGuard.stats.requests) {
      throw new Error("Provider calls and receipt attempts do not reconcile within the hard cap");
    }
    if (receiptTotals!.completed !== receiptTotals!.receipts || receiptTotals!.failed !== 0 || receiptTotals!.pending !== 0 || receiptTotals!.unknown !== 0) {
      throw new Error("Pilot receipts are not all completed successfully");
    }

    const output = {
      format: "ollama-local-development-pilot-predictions/v1",
      split: "development",
      sampleSize: 12,
      inputSha256: INPUT_SHA256,
      scope: "prefilter and score-threshold candidates only; four independent summary-route examples; no understand, structure, normalize, or publish stages",
      model: OLLAMA_PILOT_CONSTANTS.model,
      endpoint: OLLAMA_PILOT_CONSTANTS.baseUrl,
      attemptTag: ATTEMPT_TAG,
      requestCap: 40,
      actualProviderRequests: fetchGuard.stats.requests,
      receiptAttempts: receiptTotals!.attempts,
      completedReceipts: receiptTotals!.completed,
      failedReceipts: receiptTotals!.failed,
      pendingReceipts: receiptTotals!.pending,
      unknownReceipts: receiptTotals!.unknown,
      businessRowCountsUnchanged: true,
      selectionStage: predictions,
      summaries: summaryResults,
    };
    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, { flag: "wx" });
    process.stdout.write(`Pilot finished: ${fetchGuard.stats.requests} provider requests; predictions saved to ${OUTPUT_PATH}\n`);
  } finally {
    globalThis.fetch = originalFetch;
    if (closeDb) await closeDb();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown pilot failure";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
