import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertUnderstandPilotDatabaseUrl,
  assertUnderstandPilotRuntimeIdentity,
  createUnderstandPilotFetchGuard,
  UNDERSTAND_PILOT_CONSTANTS,
} from "./ollama-understand-pilot-guard.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const INPUT_RELATIVE_PATH = ".data/fiscal-qa/development150-local-pilot-20261026/inputs-request-only.json";
const INPUT_SHA256 = "95370FAA035D9322D4BDABB7E109A99BF3F9AE7ACDD411F9F98B233651271517";
const OUTPUT_RELATIVE_PATH = ".data/fiscal-qa/development-understand-container-20261027/predictions-r1.json";
const EMPTY_CREDENTIALS_DIR = path.resolve(REPO_ROOT, ".data/fiscal-qa/ollama-understand-empty-credentials-do-not-create");
const CONTAINER_MARKER_PATH = "/run/ollama-understand-pilot/container-id";
const ATTEMPT_TAG = "ollama-understand-container-pilot-20261027-r1";
const CASES = [
  { id: "body-xkm1grgd10aj3ua4nwg5gfofd", title: "财政部关于中国福利彩票发行管理中心停止销售“联合销售15选5”等9款游戏的审批意见", inputSha256: "8BF8AB8815F43EF674BBC463296FBC3AA636A048F7DABBE38E42AC26604CCE1B", bodySha256: "2FF690CBE17DC2F480F9A0FD3FB14441FA6EB8C5AFDA50339ACAE1D756C7155B" },
  { id: "body-ebtwbnudqgmlkzj60wviji165", title: "福建省财政厅 中国人民银行福建省分行关于2026年第十一期福建省省级国库现金管理商业银行定期存款招标结果的公告", inputSha256: "3F97D5522F2057B3AE52D2E0EE6E08F270C41D7BFE5BD2CAF8833E9E5C245993", bodySha256: "13D0315D40C9BC690A3C47D7BBF155CBDBAC7FC6DF49753C76F51592AF334452" },
  { id: "body-fn6rshoxnk425y3ui1cxr6mpp", title: "省直考区关于领取2026年度全国会计专业技术初级资格证书的通知", inputSha256: "2668AD3C5865B169F22D34853F4600EC437A8B6F9B9DB8038570D3F1B9C251D3", bodySha256: "C45CF48DA8FB58E95D1765E8D9D88388731270717D63C83B6125CBBE09A8A339" },
  { id: "body-j33dctglguvwqfa4ksqsdlwdf", title: "财政部关于印发《彩票市场调控资金管理办法》的通知", inputSha256: "059E3C2D4607FCD0E7A0A8365BCAB7BD2A42191619E430DD8E1E183350221466", bodySha256: "2EB40BBC46DF54E9B0548BD64E033EAF9616BE6147F1232DF3A56555B6275EAB" },
] as const;

const PROVIDER_AND_CAPABILITY_ENV = [
  "ZHIPU_API_KEY", "ZHIPU_BASE_URL", "DEEPSEEK_API_KEY", "DEEPSEEK_BASE_URL", "DASHSCOPE_API_KEY", "DASHSCOPE_BASE_URL",
  "XIAOMI_MIMO_API_KEY", "XIAOMI_MIMO_BASE_URL", "OPENAI_API_KEY", "OPENAI_BASE_URL", "ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL",
  "EMBEDDING_API_KEY", "EMBEDDING_BASE_URL", "EMBEDDING_MODEL", "SOCIALDATA_API_KEY", "SOCIALDATA_BASE_URL",
  "JINA_API_KEY", "JINA_BASE_URL", "DAJIALA_API_KEY", "DAJIALA_BASE_URL", "ARTIFICIAL_ANALYSIS_API_KEY",
  "PREFILTER_MODEL", "SCORE_MODEL", "UNDERSTAND_MODEL", "SUMMARIZE_MODEL", "STRUCTURE_MODEL", "GROUP_MODEL",
  "GROUP_REVIEW_MODEL", "DIGEST_MODEL", "REPORT_MODEL", "TRANSLATE_MODEL", "MONITOR_MODEL",
];
const PROXY_ENV = ["EGRESS_PROXY_URL", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"];
const DISABLED_FLAGS: Record<string, string> = {
  COLLECT_ENABLED: "false",
  FEISHU_CONTENT_PUSH_ENABLED: "false",
  FEISHU_INTERNAL_ENABLED: "false",
  INDEXNOW_SUBMIT_ENABLED: "false",
  JINA_BODY_FALLBACK: "false",
  ALLOW_PRIVATE_NETWORK_FETCH: "false",
  EMBEDDINGS_ENABLED: "false",
  OCR_RUN_ENABLED: "false",
  WORKER_ENABLED: "false",
};

type FrozenInput = {
  id: string;
  revision: number;
  title: string;
  url: string;
  author: string | null;
  publishedAt: string | null;
  discoveredAt: string | null;
  bodyText: string | null;
  excerpt: string | null;
  bodyStatus: string;
  xPost: Record<string, unknown> | null;
  media: Array<Record<string, unknown>>;
  source: { name: string; kind: string; tier: string; firstParty: boolean; tags?: string[]; fetchesBody?: boolean };
  [key: string]: unknown;
};

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function configureProcess(): { apiKey: string; databaseUrl: string; containerId: string; hostname: string } {
  if (process.env.NODE_OPTIONS || process.env.NODE_PATH) throw new Error("Unexpected Node preload or module path configuration");
  const apiKey = process.env.LLM_API_KEY?.trim();
  const databaseUrl = process.env.DATABASE_URL;
  const containerId = process.env.OLLAMA_PILOT_CONTAINER_ID ?? "";
  if (!apiKey) throw new Error("LLM_API_KEY must be injected by the isolated local operator");
  if (!databaseUrl) throw new Error("DATABASE_URL is required for the dedicated understanding test database");
  assertUnderstandPilotDatabaseUrl(databaseUrl);

  if (!existsSync("/.dockerenv")) throw new Error("The isolated NAS client container marker is missing");
  const hostname = os.hostname();
  for (const name of Object.keys(process.env)) {
    if (name !== "LLM_API_KEY" && name !== "LLM_BASE_URL" && name !== "LLM_MODEL" && !["DATABASE_URL", "OLLAMA_PILOT_CONTAINER_ID"].includes(name)
      && /(?:API_KEY|BASE_URL)$/u.test(name)) delete process.env[name];
  }
  for (const name of PROVIDER_AND_CAPABILITY_ENV) delete process.env[name];
  for (const name of PROXY_ENV) delete process.env[name];
  for (const name of Object.keys(process.env)) if (/^FEISHU_.*_ENABLED$/u.test(name)) process.env[name] = "false";
  Object.assign(process.env, DISABLED_FLAGS);
  process.env.LLM_API_KEY = apiKey;
  process.env.DATABASE_URL = databaseUrl;
  process.env.LLM_BASE_URL = UNDERSTAND_PILOT_CONSTANTS.baseUrl;
  process.env.LLM_MODEL = UNDERSTAND_PILOT_CONSTANTS.model;
  process.env.LLM_EXTRA_JSON = JSON.stringify({ reasoning_effort: "none" });
  process.env.LLM_JSON_MODE = "true";
  process.env.LLM_VISION = "false";
  process.env.MODEL_CALLS_ENABLED = "true";
  process.env.AIHOT_CREDENTIALS_DIR = EMPTY_CREDENTIALS_DIR;
  process.env.DATABASE_POOL_MAX = "1";
  return { apiKey, databaseUrl, containerId, hostname };
}

async function readContainerMarker(): Promise<string> {
  try {
    return (await readFile(CONTAINER_MARKER_PATH, "utf8")).trim();
  } catch {
    throw new Error("The isolated NAS client container identity marker is missing");
  }
}

function toAnalyzeInput(input: FrozenInput): Record<string, unknown> {
  const { gold: _gold, label: _label, stratum: _stratum, ...requestOnly } = input;
  return {
    ...requestOnly,
    publishedAt: requestOnly.publishedAt ? new Date(requestOnly.publishedAt as string) : null,
    discoveredAt: requestOnly.discoveredAt ? new Date(requestOnly.discoveredAt as string) : null,
  };
}

function safeFailure(stage: string, caseId: string, error: unknown): Error {
  const name = error instanceof Error ? error.name : "UnknownError";
  return new Error(`Understanding pilot stopped at ${stage} for ${caseId} (${name}); inspect sanitized receipt status only`);
}

async function main(): Promise<void> {
  const processConfig = configureProcess();
  assertUnderstandPilotRuntimeIdentity({
    dockerEnvExists: existsSync("/.dockerenv"),
    hostname: processConfig.hostname,
    expectedContainerId: processConfig.containerId,
    markerContainerId: await readContainerMarker(),
  });
  if (existsSync(EMPTY_CREDENTIALS_DIR)) throw new Error("Credential isolation path exists; refusing to load credentials files");

  const inputPath = path.join(REPO_ROOT, INPUT_RELATIVE_PATH);
  const outputPath = path.join(REPO_ROOT, OUTPUT_RELATIVE_PATH);
  if (existsSync(outputPath)) throw new Error("Understanding output already exists; refusing to spend any request budget");
  const inputBytes = await readFile(inputPath);
  if (sha256(inputBytes) !== INPUT_SHA256) throw new Error("Frozen request-only input hash mismatch");
  const frozen = JSON.parse(inputBytes.toString("utf8")) as { sourceSplit?: string; cases?: Array<{ caseId: string; inputSha256?: string; input: FrozenInput }> };
  if (frozen.sourceSplit !== "development" || !Array.isArray(frozen.cases)) throw new Error("Frozen development input shape mismatch");
  const byId = new Map(frozen.cases.map((row) => [row.caseId, row]));
  const selected = CASES.map((expected) => {
    const row = byId.get(expected.id);
    if (!row || row.input.id !== expected.id || row.input.title !== expected.title) throw new Error("Frozen sample identity mismatch");
    if (row.inputSha256 !== expected.inputSha256) throw new Error("Frozen sample request-object hash mismatch");
    if (row.input.gold !== undefined || row.input.label !== undefined || row.input.stratum !== undefined) throw new Error("Gold data found in request-only input; aborting");
    if (row.input.bodyStatus !== "ok" || !row.input.bodyText?.trim() || row.input.media.length !== 0 || row.input.xPost) throw new Error("Pilot sample is not eligible for the text-only route");
    if (sha256(row.input.bodyText) !== expected.bodySha256) throw new Error("Frozen sample body hash mismatch");
    return { expected, article: toAnalyzeInput(row.input) };
  });

  const originalFetch = globalThis.fetch;
  const fetchGuard = createUnderstandPilotFetchGuard({ apiKey: processConfig.apiKey });
  globalThis.fetch = fetchGuard as typeof fetch;
  let closeDb: (() => Promise<void>) | undefined;
  try {
    const [{ sql, closeDb: closeDatabase }, analyze, llm, models] = await Promise.all([
      import("../../packages/backend/src/db.ts"),
      import("../../packages/backend/src/editorial/analyze.ts"),
      import("../../packages/backend/src/providers/llm.ts"),
      import("../../packages/backend/src/editorial/models.ts"),
    ]);
    closeDb = closeDatabase;

    if (await models.modelFor("structure") !== "default" || await models.modelFor("understand") !== "default") throw new Error("Structure or understanding capability model override detected");
    const [modelRows] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM settings WHERE key LIKE 'models.%'`;
    if (modelRows!.count !== 0) throw new Error("Database capability model override detected");

    const [identity] = await sql<{ database: string; server_port: number }[]>`SELECT current_database() AS database, inet_server_port() AS server_port`;
    if (identity!.database !== UNDERSTAND_PILOT_CONSTANTS.database || identity!.server_port !== Number(UNDERSTAND_PILOT_CONSTANTS.databasePort)) throw new Error("Connected database identity differs from the dedicated test database");

    const [initialReceipts] = await sql<{ receipts: number; attempts: number }[]>`
      SELECT (SELECT count(*)::int FROM receipts) AS receipts, (SELECT count(*)::int FROM receipt_attempts) AS attempts`;
    if (initialReceipts!.receipts !== 0 || initialReceipts!.attempts !== 0) throw new Error("Pilot database contains prior receipts or attempts; refusing reuse");
    const [businessBefore] = await sql<{ sources: number; articles: number; analyses: number; publications: number; fetch_runs: number; job_runs: number; translations: number }[]>`
      SELECT (SELECT count(*)::int FROM sources) AS sources,
             (SELECT count(*)::int FROM articles) AS articles,
             (SELECT count(*)::int FROM analyses) AS analyses,
             (SELECT count(*)::int FROM publications) AS publications,
             (SELECT count(*)::int FROM fetch_runs) AS fetch_runs,
             (SELECT count(*)::int FROM job_runs) AS job_runs,
             (SELECT count(*)::int FROM translations) AS translations`;
    if (Object.values(businessBefore!).some((count) => count !== 0)) throw new Error("Pilot database contains business rows; refusing to run");

    const [budgetRows] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM budgets WHERE service = 'llm'`;
    if (budgetRows!.count !== 1) throw new Error("Finite llm budget row is missing or duplicated");
    await sql`UPDATE budgets SET per_minute = 12, per_hour = 12, per_day = 12, note = 'isolated 12-request understanding pilot cap' WHERE service = 'llm'`;
    const [budget] = await sql<{ per_minute: number; per_hour: number; per_day: number }[]>`SELECT per_minute, per_hour, per_day FROM budgets WHERE service = 'llm'`;
    if (budget!.per_minute !== 12 || budget!.per_hour !== 12 || budget!.per_day !== 12) throw new Error("Finite llm budget verification failed");

    const results: Array<Record<string, unknown>> = [];
    let callIndex = 0;
    for (const sample of selected) {
      const opts = { attemptTag: ATTEMPT_TAG } as never;
      let stage = "structure";
      try {
        const structure = await analyze.runStructure(sample.article as never, opts);
        callIndex += 1;
        if (structure.reused || structure.model !== "default") throw new Error("Unexpected reused or non-default structure result");
        await llm.markReceiptsCompleted([structure.receiptId]);

        stage = "understand";
        const writing = await analyze.runUnderstand(sample.article as never, opts);
        callIndex += 1;
        if (!writing) throw new Error("Understanding route returned no writing result");
        if (writing.reused || writing.model !== "default" || writing.kind !== "understand") throw new Error("Unexpected reused or non-default understanding result");
        await llm.markReceiptsCompleted(writing.receiptIds);
        results.push({
          caseId: sample.expected.id,
          inputSha256: sample.expected.inputSha256,
          bodySha256: sample.expected.bodySha256,
          structure: { model: structure.model, category: structure.category, tags: structure.tags, subjects: structure.subjects, fact: structure.fact, receiptId: structure.receiptId },
          understanding: {
            model: writing.model, titleZh: writing.titleZh, summaryZh: writing.summaryZh, reasonZh: writing.reasonZh,
            tags: writing.tags, itemType: writing.itemType, authorRole: writing.authorRole, identityGuard: writing.identityGuard,
            receiptIds: writing.receiptIds,
          },
        });
      } catch (error) {
        throw safeFailure(stage, sample.expected.id, error);
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
    if (JSON.stringify(businessBefore) !== JSON.stringify(businessAfter)) throw new Error("Business table counts changed during isolated understanding pilot");
    if (callIndex !== 8 || fetchGuard.stats.requests !== callIndex || fetchGuard.stats.inFlight !== 0 || receiptTotals!.attempts !== callIndex || receiptTotals!.receipts !== callIndex) {
      throw new Error("Provider calls, stages and receipt attempts do not reconcile");
    }
    if (receiptTotals!.completed !== callIndex || receiptTotals!.failed !== 0 || receiptTotals!.pending !== 0 || receiptTotals!.unknown !== 0) {
      throw new Error("Pilot receipts are not all completed successfully");
    }

    const output = {
      format: "ollama-local-development-understand-pilot/v1",
      split: "development",
      scope: "four fixed request-only samples; direct runStructure then runUnderstand component calls; no prefilter, scoring, runAnalysis, normalizeAnalysis, selection or publication",
      inputPath: INPUT_RELATIVE_PATH,
      inputSha256: INPUT_SHA256,
      model: UNDERSTAND_PILOT_CONSTANTS.model,
      endpoint: UNDERSTAND_PILOT_CONSTANTS.baseUrl,
      attemptTag: ATTEMPT_TAG,
      requestCap: UNDERSTAND_PILOT_CONSTANTS.requestCap,
      actualProviderRequests: fetchGuard.stats.requests,
      runtimeContainerId: processConfig.containerId,
      runtimeHostname: processConfig.hostname,
      receiptAttempts: receiptTotals!.attempts,
      completedReceipts: receiptTotals!.completed,
      failedReceipts: receiptTotals!.failed,
      pendingReceipts: receiptTotals!.pending,
      unknownReceipts: receiptTotals!.unknown,
      businessRowCountsUnchanged: true,
      sampleCount: selected.length,
      callsPerSample: ["structure", "understand"],
      promptVersions: analyze.PROMPT_VERSIONS,
      results,
    };
    const outputPath = path.join(REPO_ROOT, OUTPUT_RELATIVE_PATH);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { flag: "wx" });
    process.stdout.write(`Understanding pilot finished: ${fetchGuard.stats.requests} provider requests; results saved to ${OUTPUT_RELATIVE_PATH}\n`);
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
