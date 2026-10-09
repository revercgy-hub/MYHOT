// Opt-in end-to-end QA for the one-shot P4 CLI. Run only on a fresh *_test database with the
// sanitized environment described in the continuous QA handoff. Provider HTTP is intercepted by
// fiscal-p4-executor-mock-preload.ts, which disables all unmatched network access.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, test } from "node:test";
import { REPO_ROOT } from "@aihot/backend/config";
import { closeDb, sql } from "@aihot/backend/db";
import { PROMPT_VERSIONS } from "@aihot/backend/editorial/analyze";
import { readP4ExecutionContract, type FrozenManifest } from "@aihot/backend/jobs/p4-pilot";

const ids = ["p4prep_treasury_20261008", "p4prep_omo192_20261008"] as const;
const sourceIds = ["mof-treasury-debt-data", "pboc-open-market"] as const;
const sourceNames = ["Treasury QA fixture", "OMO QA fixture"] as const;
const databaseName = new URL(process.env.DATABASE_URL ?? "postgres://invalid/invalid").pathname.slice(1);
const scenario = process.env.P4_EXECUTOR_SCENARIO;
let databaseClosed = false;
const safeSegment = (value: string) => value.replace(/[^A-Za-z0-9_-]/g, "_");
const execFile = fileURLToPath(new URL("../scripts/fiscal/p4-execute.ts", import.meta.url));
const preloadFile = fileURLToPath(new URL("./helpers/fiscal-p4-fake-provider-preload.ts", import.meta.url));
if (process.env.P4_EXECUTOR_INTEGRATION_TEST === "true") {
  // Contract setup reads the selected provider before spawning the guarded child; this parent stays disabled.
  process.env.MODEL_CALLS_ENABLED = "false";
  process.env.DEEPSEEK_BASE_URL = "https://api.deepseek.com";
  process.env.DEEPSEEK_API_KEY = "p4-loopback-mock-only";
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => nested && typeof nested === "object" && !Array.isArray(nested)
    ? Object.fromEntries(Object.entries(nested as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) : nested);
}
function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: REPO_ROOT, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 120_000);
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code) => {
      clearTimeout(timer);
      resolve({ code: timedOut ? -1 : code ?? -1, stdout, stderr: timedOut ? `${stderr}\nchild process exceeded the 120 second test timeout` : stderr });
    });
  });
}
async function closeTestDatabase(): Promise<void> {
  if (databaseClosed) return;
  databaseClosed = true;
  await closeDb();
}
async function seedFixture(): Promise<{ manifestPath: string; manifest: FrozenManifest; contractHash: string; sourceConfigHash: string }> {
  assert.match(databaseName, /^[A-Za-z0-9_-]+_test$/, "the executor fixture must use a disposable *_test database");
  const [migrationCount] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM schema_migrations`;
  assert.equal(migrationCount?.count, 35, "the isolated database must have all 35 migrations applied");
  const sources = await sql<{ id: string }[]>`SELECT id FROM sources`;
  const articles = await sql<{ id: string }[]>`SELECT id FROM articles`;
  assert.equal(sources.length, 0, "use a fresh database; do not reuse existing application sources");
  assert.equal(articles.length, 0, "use a fresh database; do not reuse existing articles");

  const now = new Date("2026-10-08T00:00:00.000Z");
  const fixtures = ids.map((id, index) => {
    const title = `P4 isolated fake fixture ${index + 1}`;
    const url = `https://fixture.invalid/p4/${index + 1}`;
    const bodyText = `Synthetic finance body for isolated QA fixture ${index + 1}. `.repeat(15);
    return { id, sourceId: sourceIds[index]!, title, url, bodyText, contentHash: hash(bodyText) };
  });
  for (let index = 0; index < fixtures.length; index += 1) {
    const row = fixtures[index]!;
    await sql`INSERT INTO sources (id, name, kind, tier, participation_mode, enabled, site_fulltext, syndicate_fulltext, config)
      VALUES (${row.sourceId}, ${sourceNames[index]!}, 'web_list', 'T1', 'editorial', false, false, false, '{}'::jsonb)`;
    await sql`INSERT INTO articles (id, source_id, identity_key, url, title, published_at, discovered_at, timeline_at,
      revision, content_hash, body_text, body_status, media, x_post)
      VALUES (${row.id}, ${row.sourceId}, ${`p4-fixture-${index + 1}`}, ${row.url}, ${row.title}, ${now}, ${now}, ${now},
      1, ${row.contentHash}, ${row.bodyText}, 'ok', '[]'::jsonb, NULL)`;
    await sql`INSERT INTO article_revisions (article_id, revision, content_hash, title, body_text)
      VALUES (${row.id}, 1, ${row.contentHash}, ${row.title}, ${row.bodyText})`;
  }

  const contract = await readP4ExecutionContract();
  const manifestBase: Omit<FrozenManifest, "manifestHash"> = {
    schema: "fiscal-p4-pilot-readiness/v1", mode: "READ_ONLY_DRY_RUN", ready: true,
    database: { name: "fiscalhot_p4_preparation_20261008_test" }, requestedArticleIds: [...ids],
    promptVersions: { ...PROMPT_VERSIONS },
    records: fixtures.map((row, index) => ({
      id: row.id, title: row.title, url: row.url,
      source: { id: row.sourceId, kind: "web_list", tier: "T1" }, revision: 1,
      contentHash: row.contentHash, revisionContentHash: row.contentHash, bodyStatus: "ok", accepted: true,
    })),
  };
  const manifest: FrozenManifest = { ...manifestBase, manifestHash: hash(canonical(manifestBase)) };
  const folder = path.join(REPO_ROOT, ".data", "fiscal-p4-pilot");
  mkdirSync(folder, { recursive: true });
  const manifestPath = path.join(folder, `mock-integration-${safeSegment(databaseName)}-${scenario}.json`);
  assert.equal(existsSync(manifestPath), false, "never overwrite a prior test artifact");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  return { manifestPath, manifest, contractHash: contract.contractHash, sourceConfigHash: contract.sourceConfigHash };
}

async function startActivityHolder(env: NodeJS.ProcessEnv): Promise<import("node:child_process").ChildProcess> {
  const pg = path.join(REPO_ROOT, ".data", "test-pg", "pgsql", "bin", "psql.exe");
  const holder = spawn(pg, [env.DATABASE_URL!, "-X", "-v", "ON_ERROR_STOP=1", "-c", "SELECT pg_sleep(2)"], {
    cwd: REPO_ROOT, env, windowsHide: true, stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  holder.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 250);
    holder.once("error", (error) => { clearTimeout(timer); reject(error); });
    holder.once("close", (code) => { clearTimeout(timer); reject(new Error(`guard connection ended early (${code}): ${stderr}`)); });
  });
  return holder;
}

async function lowerDailyBudgetAfterNinthAttempt(): Promise<void> {
  await sql.unsafe(`
    CREATE FUNCTION p4_budget_n1_lower_after_nine() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE live_attempts integer;
    BEGIN
      IF NEW.service = 'deepseek' AND NEW.origin = 'live' THEN
        SELECT count(*)::int INTO live_attempts
        FROM receipt_attempts
        WHERE service = NEW.service AND origin = NEW.origin AND started_at > now() - interval '1 day';
        IF live_attempts = 9 THEN
          UPDATE budgets SET per_day = 9 WHERE service = 'deepseek';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$`);
  await sql.unsafe(`
    CREATE TRIGGER p4_budget_n1_lower_after_nine
    AFTER INSERT ON receipt_attempts
    FOR EACH ROW EXECUTE FUNCTION p4_budget_n1_lower_after_nine()`);
}

async function raiseBudgetAfterNinthAttempt(): Promise<void> {
  await sql.unsafe(`
    CREATE FUNCTION p4_budget_up_drift_after_nine() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE live_attempts integer;
    BEGIN
      IF NEW.service = 'deepseek' AND NEW.origin = 'live' THEN
        SELECT count(*)::int INTO live_attempts
        FROM receipt_attempts
        WHERE service = NEW.service AND origin = NEW.origin AND started_at > now() - interval '1 day';
        IF live_attempts = 9 THEN
          UPDATE budgets SET per_minute = 20, per_hour = 20, per_day = 20 WHERE service = 'deepseek';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$`);
  await sql.unsafe(`
    CREATE TRIGGER p4_budget_up_drift_after_nine
    AFTER INSERT ON receipt_attempts
    FOR EACH ROW EXECUTE FUNCTION p4_budget_up_drift_after_nine()`);
}

async function failAnalysisCommitOnReceiptCompletion(): Promise<void> {
  await sql.unsafe(`
    CREATE FUNCTION p4_fail_analysis_commit_on_complete_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.service = 'deepseek' AND NEW.status = 'completed' AND NEW.subject LIKE 'article:p4prep_%' THEN
        RAISE EXCEPTION 'mock analysis completeReceipt transaction failure';
      END IF;
      RETURN NEW;
    END;
    $$`);
  await sql.unsafe(`
    CREATE TRIGGER p4_fail_analysis_commit_on_complete_receipt
    BEFORE UPDATE OF status ON receipts
    FOR EACH ROW EXECUTE FUNCTION p4_fail_analysis_commit_on_complete_receipt()`);
}

if (process.env.P4_EXECUTOR_INTEGRATION_TEST === "true") {
  after(closeTestDatabase);
  test(`P4 CLI fake-provider integration (${scenario})`, async () => {
    const driftScenarios = ["drift-revision", "drift-hash", "drift-media", "drift-source-config", "drift-provider"];
    const persistenceScenarios = ["persist-analysis-commit", "persist-report-write"];
    assert.ok(scenario === "happy" || scenario === "429" || scenario === "budget-n1" || scenario === "budget-up" || scenario === "budget-up-drift" || scenario === "out-exists" || persistenceScenarios.includes(scenario ?? "") || driftScenarios.includes(scenario ?? ""), "select exactly one isolated fake-provider scenario");
    const seeded = await seedFixture();
    if (scenario === "budget-n1") await lowerDailyBudgetAfterNinthAttempt();
    if (scenario === "budget-up-drift") await raiseBudgetAfterNinthAttempt();
    if (scenario === "persist-analysis-commit") await failAnalysisCommitOnReceiptCompletion();
    const capturePath = path.join(REPO_ROOT, ".data", "fiscal-p4-pilot", `mock-capture-${safeSegment(databaseName)}-${scenario}.json`);
    assert.equal(existsSync(capturePath), false, "never overwrite a prior test capture");
    if (scenario === "drift-revision") {
      await sql`UPDATE articles SET revision = 2 WHERE id = ${ids[0]}`;
    } else if (scenario === "drift-hash") {
      await sql`UPDATE articles SET content_hash = ${hash("changed after manifest freeze")} WHERE id = ${ids[0]}`;
    } else if (scenario === "drift-media") {
      await sql`UPDATE articles SET media = ${sql.json([{ type: "image", url: "https://fixture.invalid/image.png" }])} WHERE id = ${ids[0]}`;
    } else if (scenario === "drift-source-config") {
      await sql`UPDATE sources SET config = ${sql.json({ changedAfterFreeze: true })} WHERE id = ${sourceIds[0]}`;
    }
    await closeTestDatabase(); // The executor has an idle-connection guard; run it after fixture setup exits.
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      P4_FAKE_CAPTURE_PATH: capturePath,
      MODEL_CALLS_ENABLED: "true",
      COLLECT_ENABLED: "false",
      INDEXNOW_SUBMIT_ENABLED: "false",
      FEISHU_CONTENT_PUSH_ENABLED: "false",
      FEISHU_INTERNAL_ENABLED: "false",
      JINA_BODY_FALLBACK: "false",
      PREFILTER_MODEL: "deepseek-flash",
      SCORE_MODEL: "deepseek-flash",
      STRUCTURE_MODEL: "deepseek-flash",
      UNDERSTAND_MODEL: "deepseek-flash",
      SUMMARIZE_MODEL: "deepseek-flash",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      DEEPSEEK_API_KEY: "p4-loopback-mock-only",
    };
    for (const name of ["LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL", "LLM_EXTRA_JSON", "ZHIPU_BASE_URL", "ZHIPU_API_KEY", "DASHSCOPE_BASE_URL", "DASHSCOPE_API_KEY", "XIAOMI_MIMO_BASE_URL", "XIAOMI_MIMO_API_KEY", "EMBEDDING_BASE_URL", "EMBEDDING_API_KEY", "SOCIALDATA_BASE_URL", "SOCIALDATA_API_KEY", "JINA_BASE_URL", "JINA_API_KEY", "DAJIALA_BASE_URL", "DAJIALA_API_KEY", "ARTIFICIAL_ANALYSIS_API_KEY", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy", "EGRESS_PROXY_URL"]) delete env[name];
    const outputPath = `.data/fiscal-p4-pilot/mock-result-${safeSegment(databaseName)}-${scenario}.json`;
    const args = ["--import", pathToFileURL(preloadFile).href, execFile, "--manifest", path.relative(REPO_ROOT, seeded.manifestPath),
      "--manifest-hash", seeded.manifest.manifestHash, "--contract-hash", seeded.contractHash,
      "--source-config-hash", seeded.sourceConfigHash, "--max-requests", scenario === "budget-up" ? "20" : "10", "--confirm-execute",
      "--out", outputPath];
    if (scenario === "persist-report-write") env.P4_FAKE_REPORT_PATH = outputPath;

    if (scenario?.startsWith("drift-")) {
      const driftCapture = `${capturePath}.drift`;
      env.P4_FAKE_CAPTURE_PATH = driftCapture;
      if (scenario === "drift-provider") env.PREFILTER_MODEL = "glm-5.3-flash";
      const rejected = await run(process.execPath, args, env);
      assert.notEqual(rejected.code, 0, `${scenario} must be rejected before paid-provider dispatch`);
      assert.match(rejected.stderr, scenario === "drift-provider" ? /capability model override conflicts/u : /changed|conflicts|unsafe/u);
      const capture = JSON.parse(readFileSync(driftCapture, "utf8")) as { requests: unknown[] };
      assert.equal(capture.requests.length, 0, `${scenario} must produce zero provider POSTs`);
      assert.equal(existsSync(path.resolve(REPO_ROOT, outputPath)), false, "rejected input drift must not create an execution report");
    } else if (scenario === "out-exists") {
      const sentinel = `preserve-existing-report-${databaseName}\n`;
      const reportPath = path.resolve(REPO_ROOT, outputPath);
      assert.equal(existsSync(reportPath), false, "never overwrite an existing report artifact");
      writeFileSync(reportPath, sentinel, { flag: "wx", mode: 0o600 });
      const rejected = await run(process.execPath, args, env);
      assert.notEqual(rejected.code, 0, "an existing report path must be rejected before execution");
      assert.match(rejected.stderr, /output|report|exist|overwrite/i);
      const capture = JSON.parse(readFileSync(capturePath, "utf8")) as { requests: unknown[] };
      assert.equal(capture.requests.length, 0, "existing output must be rejected before any provider POST");
      assert.equal(readFileSync(reportPath, "utf8"), sentinel, "the existing report must remain byte-for-byte unchanged");
      const psql = path.join(REPO_ROOT, ".data", "test-pg", "pgsql", "bin", "psql.exe");
      const verify = await run(psql, [env.DATABASE_URL!, "-X", "-A", "-t", "-F", ",", "-v", "ON_ERROR_STOP=1", "-c",
        "BEGIN READ ONLY; SELECT (SELECT count(*) FROM schema_migrations),(SELECT count(*) FROM articles),(SELECT count(*) FROM analyses),(SELECT count(*) FROM receipts),(SELECT count(*) FROM receipt_attempts),(SELECT count(*) FROM fetch_runs); ROLLBACK;"], env);
      assert.equal(verify.code, 0, verify.stderr);
      assert.match(verify.stdout, /35,2,0,0,0,0/);
    } else if (scenario === "happy") {
      const holder = await startActivityHolder(env);
      const guarded = await run(process.execPath, args, env);
      await new Promise<void>((resolve) => holder.once("close", () => resolve()));
      assert.notEqual(guarded.code, 0, "an unrelated active database session must be rejected");
      assert.match(guarded.stderr, /exclusive database access/);
      const guardCapture = `${capturePath}.guard`;
      // The preload saves one call capture at process exit; this guard run must have dispatched nothing.
      const guardedRequests = JSON.parse(readFileSync(capturePath, "utf8")) as { requests: unknown[] };
      assert.equal(guardedRequests.requests.length, 0);
      writeFileSync(guardCapture, JSON.stringify({ requests: guardedRequests.requests, result: guarded.code }), { flag: "wx", mode: 0o600 });
      assert.equal(existsSync(capturePath), true);
      // A fresh process is required so the guard-only capture cannot be mistaken for the successful run.
      const successCapture = `${capturePath}.success`;
      env.P4_FAKE_CAPTURE_PATH = successCapture;
      env.P4_FAKE_SCENARIO = "happy";
      const successful = await run(process.execPath, args, env);
      assert.equal(successful.code, 0, successful.stderr || successful.stdout);
      const result = JSON.parse(successful.stdout) as { status: string; rows: Array<{ id: string; result: string; receiptIds: number[] }>; reportPath: string };
      assert.equal(result.status, "completed");
      assert.deepEqual(result.rows.map((row) => row.id), [...ids]);
      assert.ok(result.rows.every((row) => row.result === "analyzed" && row.receiptIds.length === 5));
      const capture = JSON.parse(readFileSync(successCapture, "utf8")) as { requests: Array<{ kind: string; path: string; model: string; authMatchesFake: boolean }> };
      assert.equal(capture.requests.length, 10);
      assert.ok(capture.requests.every((request) => request.path === "/chat/completions" && request.model === "deepseek-flash" && request.authMatchesFake));
      assert.deepEqual(capture.requests.map((request) => request.kind), ["prefilter", "score", "score", "structure", "summarize", "prefilter", "score", "score", "structure", "summarize"]);
      const resultPath = path.resolve(REPO_ROOT, result.reportPath);
      const report = JSON.parse(readFileSync(resultPath, "utf8")) as Record<string, unknown>;
      assert.equal(report.publicationWrites, 0);
      assert.equal(report.groupingWrites, 0);
      assert.equal(report.queueWrites, 0);
      assert.equal(report.extractionRequests, 0);
      assert.equal(report.collectionRequests, 0);
      assert.equal(report.workerStarted, false);
      const psql = path.join(REPO_ROOT, ".data", "test-pg", "pgsql", "bin", "psql.exe");
      const verify = await run(psql, [env.DATABASE_URL!, "-X", "-A", "-t", "-F", ",", "-v", "ON_ERROR_STOP=1", "-c",
        "BEGIN READ ONLY; SELECT (SELECT count(*) FROM schema_migrations),(SELECT count(*) FROM articles),(SELECT count(*) FROM analyses),(SELECT count(*) FROM receipts WHERE status='completed'),(SELECT count(*) FROM receipt_attempts WHERE status='received'),(SELECT count(*) FROM fetch_runs),(SELECT count(*) FROM publications),(SELECT count(*) FROM selected_ledger); ROLLBACK;"], env);
      assert.equal(verify.code, 0, verify.stderr);
      assert.match(verify.stdout, /35,2,2,10,10,0,0,0/);
    } else if (scenario === "429") {
      env.P4_FAKE_CAPTURE_PATH = capturePath;
      env.P4_FAKE_SCENARIO = "429";
      const rejected = await run(process.execPath, args, env);
      assert.notEqual(rejected.code, 0);
      const capture = JSON.parse(readFileSync(capturePath, "utf8")) as { requests: Array<{ kind: string }> };
      assert.equal(capture.requests.length, 1, "a 429 must stop before later paid-request attempts");
      assert.equal(capture.requests[0]?.kind, "prefilter");
      const retryCapture = `${capturePath}.retry`;
      env.P4_FAKE_CAPTURE_PATH = retryCapture;
      env.P4_FAKE_SCENARIO = "happy";
      const retried = await run(process.execPath, args, env);
      assert.notEqual(retried.code, 0, "the one-shot executor must refuse a second run after a failed receipt");
      const retryRequests = JSON.parse(readFileSync(retryCapture, "utf8")) as { requests: unknown[] };
      assert.equal(retryRequests.requests.length, 0);
      assert.match(retried.stderr, /no replay\/retry/);
      const psql = path.join(REPO_ROOT, ".data", "test-pg", "pgsql", "bin", "psql.exe");
      const verify = await run(psql, [env.DATABASE_URL!, "-X", "-A", "-t", "-F", ",", "-v", "ON_ERROR_STOP=1", "-c",
        "BEGIN READ ONLY; SELECT (SELECT count(*) FROM schema_migrations),(SELECT count(*) FROM articles),(SELECT count(*) FROM analyses),(SELECT count(*) FROM receipts WHERE status='failed'),(SELECT count(*) FROM receipt_attempts WHERE status='failed'),(SELECT count(*) FROM fetch_runs),(SELECT count(*) FROM publications); ROLLBACK;"], env);
      assert.equal(verify.code, 0, verify.stderr);
      assert.match(verify.stdout, /35,2,0,1,1,0,0/);
    } else if (scenario === "budget-n1") {
      const rejected = await run(process.execPath, args, env);
      assert.notEqual(rejected.code, 0, "the lowered daily receipt budget must stop the bounded run");
      assert.match(rejected.stderr, /Budget for deepseek exhausted \(day\)/u);
      const capture = JSON.parse(readFileSync(capturePath, "utf8")) as { requests: Array<{ kind: string; path: string; model: string; authMatchesFake: boolean }> };
      assert.equal(capture.requests.length, 9, "the tenth attempt must fail the receipt budget check before provider POST");
      assert.deepEqual(capture.requests.map((request) => request.kind), ["prefilter", "score", "score", "structure", "summarize", "prefilter", "score", "score", "structure"]);
      assert.ok(capture.requests.every((request) => request.path === "/chat/completions" && request.model === "deepseek-flash" && request.authMatchesFake));

      const reportPath = path.resolve(REPO_ROOT, outputPath);
      assert.equal(existsSync(reportPath), true, "the executor reserves its report path before the first analysis");
      assert.equal(readFileSync(reportPath, "utf8"), "", "a budget failure before the final write leaves only the empty reserved report");

      const psql = path.join(REPO_ROOT, ".data", "test-pg", "pgsql", "bin", "psql.exe");
      const verify = await run(psql, [env.DATABASE_URL!, "-X", "-A", "-t", "-F", ",", "-v", "ON_ERROR_STOP=1", "-c",
        "BEGIN READ ONLY; SELECT (SELECT count(*) FROM schema_migrations),(SELECT count(*) FROM articles),(SELECT count(*) FROM analyses),(SELECT count(*) FROM receipts WHERE status='completed'),(SELECT count(*) FROM receipts WHERE status='received'),(SELECT count(*) FROM receipts WHERE status IN ('failed','pending','unknown')),(SELECT count(*) FROM receipt_attempts),(SELECT count(*) FROM receipt_attempts WHERE status='received'),(SELECT count(*) FROM receipt_attempts WHERE status IN ('failed','pending','unknown')),(SELECT count(*) FROM fetch_runs),(SELECT count(*) FROM publications),(SELECT count(*) FROM selected_ledger),(SELECT per_day FROM budgets WHERE service='deepseek'); ROLLBACK;"], env);
      assert.equal(verify.code, 0, verify.stderr);
      assert.match(verify.stdout, /35,2,1,5,4,0,9,9,0,0,0,0,9/u);

      const retryCapture = `${capturePath}.retry`;
      const retryOutput = `.data/fiscal-p4-pilot/mock-result-${safeSegment(databaseName)}-${scenario}-retry.json`;
      env.P4_FAKE_CAPTURE_PATH = retryCapture;
      const retryArgs = [...args.slice(0, -2), "--out", retryOutput];
      const retried = await run(process.execPath, retryArgs, env);
      assert.notEqual(retried.code, 0, "the executor must refuse replay after a prior analysis/receipt");
      assert.match(retried.stderr, /no replay\/retry/u);
      const retryRequests = JSON.parse(readFileSync(retryCapture, "utf8")) as { requests: unknown[] };
      assert.equal(retryRequests.requests.length, 0, "replay refusal must happen before any additional provider POST");
      assert.equal(existsSync(path.resolve(REPO_ROOT, retryOutput)), false, "replay refusal must not reserve a second report path");
    } else if (scenario === "budget-up" || scenario === "budget-up-drift") {
      const completed = await run(process.execPath, args, env);
      assert.equal(completed.code, 0, completed.stderr || completed.stdout);
      const result = JSON.parse(completed.stdout) as { status: string; rows: Array<{ id: string; receiptIds: number[] }>; reportPath: string };
      assert.equal(result.status, "completed");
      assert.deepEqual(result.rows.map((row) => row.id), [...ids]);
      assert.ok(result.rows.every((row) => row.receiptIds.length === 5));

      const capture = JSON.parse(readFileSync(capturePath, "utf8")) as { requests: Array<{ kind: string; path: string; model: string; authMatchesFake: boolean }> };
      assert.equal(capture.requests.length, 10, scenario === "budget-up"
        ? "a static CLI cap of 20 still permits only the frozen two-article/five-step execution: 10 POSTs"
        : "raising the receipt budget after attempt nine must not expand the frozen two-article/five-step execution beyond 10 POSTs");
      assert.deepEqual(capture.requests.map((request) => request.kind), ["prefilter", "score", "score", "structure", "summarize", "prefilter", "score", "score", "structure", "summarize"]);
      assert.ok(capture.requests.every((request) => request.path === "/chat/completions" && request.model === "deepseek-flash" && request.authMatchesFake));

      const reportPath = path.resolve(REPO_ROOT, result.reportPath);
      const report = JSON.parse(readFileSync(reportPath, "utf8")) as Record<string, unknown>;
      const executionCap = scenario === "budget-up" ? 20 : 10;
      assert.equal(report.maxRequests, executionCap, "the report must preserve the explicit CLI execution cap");
      const psql = path.join(REPO_ROOT, ".data", "test-pg", "pgsql", "bin", "psql.exe");
      const verify = await run(psql, [env.DATABASE_URL!, "-X", "-A", "-t", "-F", ",", "-v", "ON_ERROR_STOP=1", "-c",
        "BEGIN READ ONLY; SELECT (SELECT count(*) FROM schema_migrations),(SELECT count(*) FROM articles),(SELECT count(*) FROM analyses),(SELECT count(*) FROM receipts WHERE status='completed'),(SELECT count(*) FROM receipt_attempts WHERE status='received'),(SELECT per_minute FROM budgets WHERE service='deepseek'),(SELECT per_hour FROM budgets WHERE service='deepseek'),(SELECT per_day FROM budgets WHERE service='deepseek'),(SELECT count(*) FROM fetch_runs),(SELECT count(*) FROM publications),(SELECT count(*) FROM selected_ledger); ROLLBACK;"], env);
      assert.equal(verify.code, 0, verify.stderr);
      assert.match(verify.stdout, /35,2,2,10,10,20,20,20,0,0,0/u);

      const retryCapture = `${capturePath}.retry`;
      const retryOutput = `.data/fiscal-p4-pilot/mock-result-${safeSegment(databaseName)}-${scenario}-retry.json`;
      env.P4_FAKE_CAPTURE_PATH = retryCapture;
      const retryArgs = [...args.slice(0, -2), "--out", retryOutput];
      const retried = await run(process.execPath, retryArgs, env);
      assert.notEqual(retried.code, 0, "a higher budget must not make an already receipted/analyzed article replayable");
      assert.match(retried.stderr, /no replay\/retry/u);
      const retryRequests = JSON.parse(readFileSync(retryCapture, "utf8")) as { requests: unknown[] };
      assert.equal(retryRequests.requests.length, 0, "receipt replay must be refused before any provider POST even with budget 20");
      assert.equal(existsSync(path.resolve(REPO_ROOT, retryOutput)), false, "replay refusal must not reserve another report path");
    } else {
      const rejected = await run(process.execPath, args, env);
      assert.notEqual(rejected.code, 0, "a persistence fault must fail the bounded execution");
      assert.doesNotMatch(rejected.stdout, /"status"\s*:\s*"completed"/u, "a failed run must not print a successful execution result");
      assert.match(rejected.stderr, scenario === "persist-analysis-commit"
        ? /mock analysis completeReceipt transaction failure/u
        : /mock P4 report write failure/u);

      const expectedRequests = scenario === "persist-analysis-commit" ? 5 : 10;
      const capture = JSON.parse(readFileSync(capturePath, "utf8")) as { requests: Array<{ kind: string; path: string; model: string; authMatchesFake: boolean }> };
      assert.equal(capture.requests.length, expectedRequests, "the fake provider responses must precede the injected persistence failure");
      assert.ok(capture.requests.every((request) => request.path === "/chat/completions" && request.model === "deepseek-flash" && request.authMatchesFake));

      const reportPath = path.resolve(REPO_ROOT, outputPath);
      assert.equal(existsSync(reportPath), true, "the executor reserves its report path before analysis");
      assert.equal(readFileSync(reportPath, "utf8"), "", "failed persistence must not leave a success report");

      const psql = path.join(REPO_ROOT, ".data", "test-pg", "pgsql", "bin", "psql.exe");
      const verify = await run(psql, [env.DATABASE_URL!, "-X", "-A", "-t", "-F", ",", "-v", "ON_ERROR_STOP=1", "-c",
        "BEGIN READ ONLY; SELECT (SELECT count(*) FROM schema_migrations),(SELECT count(*) FROM articles),(SELECT count(*) FROM analyses),(SELECT count(*) FROM receipts WHERE status='completed'),(SELECT count(*) FROM receipts WHERE status='received'),(SELECT count(*) FROM receipts WHERE status IN ('failed','pending','unknown')),(SELECT count(*) FROM receipt_attempts),(SELECT count(*) FROM receipt_attempts WHERE status='received'),(SELECT count(*) FROM receipt_attempts WHERE status IN ('failed','pending','unknown')),(SELECT count(*) FROM fetch_runs),(SELECT count(*) FROM publications),(SELECT count(*) FROM selected_ledger); ROLLBACK;"], env);
      assert.equal(verify.code, 0, verify.stderr);
      assert.match(verify.stdout, scenario === "persist-analysis-commit"
        ? /35,2,0,0,5,0,5,5,0,0,0,0/u
        : /35,2,2,10,0,0,10,10,0,0,0,0/u);

      const retryCapture = `${capturePath}.retry`;
      const retryOutput = `.data/fiscal-p4-pilot/mock-result-${safeSegment(databaseName)}-${scenario}-retry.json`;
      env.P4_FAKE_CAPTURE_PATH = retryCapture;
      const retryArgs = [...args.slice(0, -2), "--out", retryOutput];
      const retried = await run(process.execPath, retryArgs, env);
      assert.notEqual(retried.code, 0, "the executor must refuse to replay after a persistence failure");
      assert.match(retried.stderr, /no replay\/retry/u);
      const retryRequests = JSON.parse(readFileSync(retryCapture, "utf8")) as { requests: unknown[] };
      assert.equal(retryRequests.requests.length, 0, "replay refusal must happen before any additional provider POST");
      assert.equal(existsSync(path.resolve(REPO_ROOT, retryOutput)), false, "replay refusal must not reserve a second report path");
    }
  });
}
