import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import {
  assertLoopbackTestDatabase,
  canonicalScopeSha256,
  continuationDispatchRejection,
  isAllowedContinuationDispatch,
  parseExplicitSourceIds,
  validateContinuationScope,
  type PaginationContinuationScope,
} from "../scripts/fiscal/p3-page-continuation.ts";
import { sha256 } from "../packages/backend/src/lib/ids.ts";
import { gunzipSync } from "node:zlib";
/// <reference path="./helpers/fiscal-page-continuation-transport-preload.ts" />

let fixtureHits = 0;
let fixturePort = 0;
const fixture = http.createServer((_request, response) => {
  fixtureHits++;
  response.writeHead(200, { "content-type": "text/html" }).end("fixture");
});

before(async () => {
  await new Promise<void>((resolve) => fixture.listen(0, "127.0.0.1", resolve));
  fixturePort = (fixture.address() as { port: number }).port;
});
after(async () => {
  await new Promise<void>((resolve, reject) => fixture.close((error) => error ? reject(error) : resolve()));
});

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const QA_DATA_DIR = path.resolve(REPO_ROOT, ".data", "fiscal-qa");
const CLI_PATH = path.join(REPO_ROOT, "scripts", "fiscal", "p3-page-continuation.ts");
const TRANSPORT_PRELOAD_PATH = path.join(REPO_ROOT, "tests", "helpers", "fiscal-page-continuation-transport-preload.ts");

function scopeFixture(databaseName = "fiscal_test"): PaginationContinuationScope {
  const listUrl = "https://fixture.example/dir/";
  const databaseUrl = `postgres://127.0.0.1:5432/${databaseName}`;
  const cursor = { preservedTopLevel: { nested: [1, 2] }, webListBackfill: {
    v: 1, generationId: "generation-test", configHash: "b".repeat(64), anchorAt: "2026-10-16T00:00:00.000Z",
    cutoffAt: "2026-07-18T00:00:00.000Z", nextPageIndex: 2, pagesCommitted: 2, lastPageFingerprint: "prior-page",
    lastPageIdentityHashes: ["a".repeat(64)], state: "active", coverage: "unproven", stopReason: null,
    updatedAt: "2026-10-16T00:00:00.000Z",
  } };
  return {
    v: 2,
    createdAtUtc: "2026-10-16T00:00:00.000Z",
    databaseUrlSha256: sha256(databaseUrl),
    database: { name: databaseName, address: "127.0.0.1", port: 5432, migrations: 35 },
    sourceIds: ["fixture-source"],
    sources: [{ id: "fixture-source", configSha256: "a".repeat(64), adapterConfigHash: "b".repeat(64),
      enabled: false, siteFulltext: false, syndicateFulltext: false, cursor, listUrl, allowUrlPrefixes: [listUrl],
      pageIndices: [2, 3], pageUrls: ["https://fixture.example/dir/index_2.htm", "https://fixture.example/dir/index_3.htm"],
      host: "fixture.example", pathPrefix: "/dir/", maxPageIndex: 8 }],
    limits: { pagesPerSource: 2, perSourceDispatchCap: 2, globalDispatchCap: 2, maxRedirects: 0, urlAllowlist: "frozen_page_urls_only", minDispatchIntervalMs: 1000, activeWaitMs: 1100, maxCapturedResponseBytes: 6_291_456 },
    baselineCounts: { migrations: 35, sources: 1, articles: 0, fetch_runs: 0, revisions: 0, discoveries: 0, analyses: 0, receipts: 0, publications: 0, selected: 0, job_runs: 0 },
  };
}

test("requires explicit unique source IDs and safe loopback test database names", () => {
  assert.deepEqual(parseExplicitSourceIds("alpha,beta"), ["alpha", "beta"]);
  assert.throws(() => parseExplicitSourceIds("alpha,alpha"), /duplicates/u);
  assert.throws(() => parseExplicitSourceIds("a,b,c,d,e"), /1-4/u);
  assert.deepEqual(assertLoopbackTestDatabase("postgres://127.0.0.1:5544/fiscal_test"), { name: "fiscal_test", address: "127.0.0.1", port: 5544 });
  assert.throws(() => assertLoopbackTestDatabase("postgres://db.example/fiscal_test"), /loopback/u);
  assert.throws(() => assertLoopbackTestDatabase("postgres://127.0.0.1/fiscal"), /_test/u);
});

test("pins the full cursor/config snapshot and rejects stale scope hashes", () => {
  const scope = scopeFixture();
  const digest = canonicalScopeSha256(scope);
  const accepted = validateContinuationScope(scope, digest);
  assert.deepEqual(accepted.sources[0]?.cursor, scope.sources[0]?.cursor);
  const changed = structuredClone(scope);
  (changed.sources[0]!.cursor as any).preservedTopLevel.nested.push(3);
  assert.throws(() => validateContinuationScope(changed, digest), /hash/u);
  const invalidRange = structuredClone(scope);
  invalidRange.sources[0]!.pageIndices = [1, 2];
  assert.throws(() => validateContinuationScope(invalidRange, canonicalScopeSha256(invalidRange)), /cursor|range/u);
  const invalidLimits = structuredClone(scope);
  (invalidLimits.limits as any).globalDispatchCap = 100;
  assert.throws(() => validateContinuationScope(invalidLimits, canonicalScopeSha256(invalidLimits)), /dispatch budgets|database identity|migration/u);
  const previousWideScope = structuredClone(scope);
  (previousWideScope as any).v = 1;
  (previousWideScope.limits as any).perSourceDispatchCap = 12;
  (previousWideScope.limits as any).globalDispatchCap = 48;
  assert.throws(() => validateContinuationScope(previousWideScope, canonicalScopeSha256(previousWideScope)), /schema version/u,
    "previous wide-budget scope versions cannot execute under the tightened runner");
});

test("allows only exact frozen list pages and rejects same-origin metadata/detail URLs", () => {
  const source = scopeFixture().sources[0]!;
  assert.equal(isAllowedContinuationDispatch(source, { origin: "https://fixture.example", path: "/dir/index_2.htm", method: "GET" }), true);
  assert.equal(isAllowedContinuationDispatch(source, { origin: "https://fixture.example", path: "/dir/article.html", method: "GET" }), false);
  assert.equal(isAllowedContinuationDispatch(source, { origin: "https://fixture.example", path: "/dir/index_2.htm?x=1", method: "GET" }), false);
  assert.equal(isAllowedContinuationDispatch(source, { origin: "http://fixture.example", path: "/dir/article.html", method: "GET" }), false);
  assert.equal(isAllowedContinuationDispatch(source, { origin: "https://other.example", path: "/dir/article.html", method: "GET" }), false);
  assert.equal(isAllowedContinuationDispatch(source, { origin: "https://fixture.example", path: "/dir/article.pdf", method: "GET" }), false);
  assert.equal(isAllowedContinuationDispatch(source, { origin: "https://fixture.example", path: "/dir/article.html?download=1", method: "GET" }), false);
  assert.equal(isAllowedContinuationDispatch(source, { origin: "https://fixture.example", path: "/dir/article.html", method: "POST" }), false);
});

test("runtime dispatch admission consumes exactly the frozen budget and rejects repeats, extra URLs, and redirect hops", () => {
  const scope = scopeFixture();
  const source = scope.sources[0]!;
  const sent = new Set<string>();
  const dispatch = (url: string) => ({ origin: new URL(url).origin, path: new URL(url).pathname, method: "GET" });
  assert.equal(scope.limits.globalDispatchCap, source.pageUrls.length);
  assert.equal(continuationDispatchRejection(scope, source, dispatch(source.pageUrls[0]!), sent), null);
  sent.add(source.pageUrls[0]!);
  assert.equal(continuationDispatchRejection(scope, source, dispatch(source.pageUrls[1]!), sent), null);
  sent.add(source.pageUrls[1]!);
  assert.equal(continuationDispatchRejection(scope, source, dispatch(source.pageUrls[0]!), sent), "duplicate_or_per_source_budget_exhausted", "N+1 repeated dispatch is refused before transport");
  assert.equal(continuationDispatchRejection(scope, source, dispatch("https://fixture.example/dir/article.html"), sent), "outside_frozen_scope");
  assert.equal(continuationDispatchRejection(scope, source, dispatch(source.pageUrls[1]!), new Set([source.pageUrls[0]!]), true), "redirect_forbidden", "redirect to a separately planned page still cannot consume its slot");
});

test("a loopback HTTP page is denied before the fixture server receives a request", async () => {
  const source = scopeFixture().sources[0]!;
  fixtureHits = 0;
  const candidate = `http://127.0.0.1:${fixturePort}/dir/article.html`;
  const allowed = isAllowedContinuationDispatch(source, { origin: new URL(candidate).origin, path: new URL(candidate).pathname, method: "GET" });
  if (allowed) await fetch(candidate);
  assert.equal(allowed, false);
  assert.equal(fixtureHits, 0);
});

test("CLI exits nonzero for stale scope, wrong DB URL, and existing lock or claim without HTTP", () => {
  fixtureHits = 0;
  const base = path.resolve(QA_DATA_DIR, `page-continuation-cli-test-${process.pid}`);
  assert.equal(path.relative(QA_DATA_DIR, base), `page-continuation-cli-test-${process.pid}`);
  mkdirSync(QA_DATA_DIR, { recursive: true });
  mkdirSync(base, { recursive: false });
  const lockDir = path.join(REPO_ROOT, ".data", "fiscal-qa", "locks");
  mkdirSync(lockDir, { recursive: true });
  const run = (scope: PaginationContinuationScope, expectedSha: string, url: string, suffix: string) => {
    const dir = path.join(base, suffix);
    mkdirSync(dir, { recursive: true });
    const scopePath = path.join(dir, "scope.json");
    writeFileSync(scopePath, JSON.stringify(scope));
    const outDir = path.join(dir, "out");
    const result = spawnSync(process.execPath, [CLI_PATH, "--execute", "--scope", scopePath, "--scope-sha", expectedSha, "--out-dir", outDir], {
      cwd: REPO_ROOT, encoding: "utf8", timeout: 15_000,
      env: { ...process.env, P3_TEST_DATABASE_URL: url, DATABASE_URL: url, ALLOW_PRIVATE_NETWORK_FETCH: "true" },
    });
    return { result, outDir };
  };
  try {
    const staleDb = `fiscal_cli_stale_${process.pid}_test`;
    const stale = scopeFixture(staleDb);
    const staleDigest = canonicalScopeSha256(stale);
    (stale.sources[0]!.cursor as any).preservedTopLevel.nested.push(99);
    const staleRun = run(stale, staleDigest, `postgres://127.0.0.1:5432/${staleDb}`, "stale");
    assert.notEqual(staleRun.result.status, 0);
    assert.match(staleRun.result.stderr, /hash|schema/u);

    const wrongDbName = `fiscal_cli_db_${process.pid}_test`;
    const wrongDb = scopeFixture(wrongDbName);
    const wrongDbRun = run(wrongDb, canonicalScopeSha256(wrongDb), `postgres://127.0.0.1:5432/fiscal_cli_other_${process.pid}_test`, "wrong-db");
    assert.notEqual(wrongDbRun.result.status, 0);
    assert.match(wrongDbRun.result.stderr, /exactly match/u);

    const lockDb = `fiscal_cli_lock_${process.pid}_test`;
    const lockScope = scopeFixture(lockDb);
    const lockDigest = canonicalScopeSha256(lockScope);
    const lockPath = path.join(lockDir, `${lockScope.database.name}.pagination.lock`);
    writeFileSync(lockPath, "stale test lock", { flag: "wx" });
    try {
      const locked = run(lockScope, lockDigest, `postgres://127.0.0.1:5432/${lockDb}`, "locked");
      assert.notEqual(locked.result.status, 0);
      assert.match(locked.result.stderr, /lock is held or stale/u);
      assert.equal(fixtureHits, 0);
      assert.equal(existsSync(lockPath), true, "stale DB lock must not be removed automatically");
    } finally { rmSync(lockPath); }

    const claimDb = `fiscal_cli_claim_${process.pid}_test`;
    const claimScope = scopeFixture(claimDb);
    const claimDigest = canonicalScopeSha256(claimScope);
    const claimPath = path.join(lockDir, `${claimScope.database.name}.pagination-${claimDigest}.claim`);
    writeFileSync(claimPath, "existing claim", { flag: "wx" });
    try {
      const claimed = run(claimScope, claimDigest, `postgres://127.0.0.1:5432/${claimDb}`, "claimed");
      assert.notEqual(claimed.result.status, 0);
      assert.match(claimed.result.stderr, /EEXIST|claim/u);
      assert.equal(existsSync(path.join(lockDir, `${claimScope.database.name}.pagination.lock`)), false);
      assert.equal(existsSync(claimPath), true, "scope claim must remain persistent");
    } finally { rmSync(claimPath); }
    assert.equal(fixtureHits, 0);
  } finally {
    const resolvedBase = path.resolve(base);
    assert.ok(resolvedBase.startsWith(`${QA_DATA_DIR}${path.sep}`), "recursive test cleanup must stay inside repo .data/fiscal-qa");
    rmSync(resolvedBase, { recursive: true });
  }
});

test("execute captures and decodes fixed gzip pages, commits through the collector, and leaves jobs unstarted",
  { skip: !process.env.P3_PAGE_CONTINUATION_TEST_DATABASE_URL }, async () => {
  const databaseUrl = process.env.P3_PAGE_CONTINUATION_TEST_DATABASE_URL ?? "";
  const databaseIdentity = assertLoopbackTestDatabase(databaseUrl);
  assert.equal(databaseIdentity.name.endsWith("_test"), true);
  process.env.DATABASE_URL = databaseUrl;
  process.env.P3_TEST_DATABASE_URL = databaseUrl;
  const { sql, closeDb } = await import("../packages/backend/src/db.ts");
  const { newWebListBackfillCursor } = await import("../packages/backend/src/sources/web-list-pagination.ts");
  try {
    const [{ count: migrationCount }] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM schema_migrations`;
    const [{ count: sourceCount }] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM sources`;
    const [{ count: articleCount }] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM articles`;
    const [{ present: hasPgBossJobs }] = await sql<{ present: boolean }[]>`SELECT to_regclass('pgboss.job') IS NOT NULL AS present`;
    const [{ count: jobCount }] = hasPgBossJobs
      ? await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM pgboss.job`
      : [{ count: 0 }];
    assert.equal(Number(migrationCount), 35, "execute runs only against the fresh 35-migration test database");
    assert.equal(Number(sourceCount), 0, "use a fresh database; refuse to write when sources already exist");
    assert.equal(Number(articleCount), 0, "use a fresh database; refuse to write when articles already exist");
    assert.equal(Number(jobCount), 0, "use a fresh database; refuse to write when pgboss jobs already exist");
  } catch (error) {
    await closeDb();
    throw error;
  }

  const evidenceRoot = path.resolve(process.env.P3_PAGE_CONTINUATION_EVIDENCE_DIR ??
    path.join(QA_DATA_DIR, `page-continuation-execute-${process.pid}`));
  assert.ok(evidenceRoot.startsWith(`${QA_DATA_DIR}${path.sep}`), "evidence must remain under .data/fiscal-qa");
  mkdirSync(evidenceRoot, { recursive: false });
  const sourceIds = [`p3-continuation-${process.pid}`, `p3-continuation-failure-${process.pid}`, `p3-continuation-redirect-${process.pid}`];
  const listUrl = "https://fiscal-fixture.mof.gov.cn/dir/";
  const config: Record<string, any> = {
    url: listUrl,
    allowUrlPrefixes: [listUrl],
    itemSelector: "li",
    linkSelector: "a",
    titleSelector: "a",
    publishedAtSelector: "time",
    publishedAtUtcOffset: "+08:00",
    pagination: { mode: "mof_index_v1", maxPagesPerRun: 2, maxDispatches: 2, maxPageIndex: 8 },
    _aihot: { initialBackfillRequirePublishedAt: true },
  };
  const source = { id: sourceIds[0]!, name: "Synthetic pagination fixture", kind: "web_list" as const,
    config, cursor: {} as Record<string, unknown> };
  const sourceCursors = new Map(sourceIds.map((sourceId) => {
    const newCursor = newWebListBackfillCursor(source as never);
    return [sourceId, { webListBackfill: { ...newCursor,
      nextPageIndex: 2, pagesCommitted: 2, lastPageFingerprint: "c".repeat(64), lastPageIdentityHashes: ["a".repeat(64)] } }];
  }));
  for (const sourceId of sourceIds) {
    await sql`INSERT INTO sources (id, name, kind, config, tier, first_party, participation_mode, interval_minutes,
      enabled, site_fulltext, syndicate_fulltext, cursor, next_fetch_at)
      VALUES (${sourceId}, ${source.name}, 'web_list', ${sql.json(config)}, 'T1', false, 'editorial', 1440,
        false, false, false, ${sql.json(sourceCursors.get(sourceId) as never)}, '2100-01-01')`;
  }

  const run = (args: string[], mode = "success", preloadPath = TRANSPORT_PRELOAD_PATH) => {
    const outDirIndex = args.indexOf("--out-dir");
    const outDir = outDirIndex >= 0 ? args[outDirIndex + 1]! : "unknown-output";
    const transportLogPath = path.join(evidenceRoot, `${path.basename(outDir)}-${mode}-transport.jsonl`);
    return spawnSync(process.execPath,
    ["--import", pathToFileURL(preloadPath).href, CLI_PATH, ...args], {
      cwd: REPO_ROOT, encoding: "utf8", timeout: 120_000, windowsHide: true,
      env: { ...process.env, DATABASE_URL: databaseUrl, P3_TEST_DATABASE_URL: databaseUrl,
        P3_CONTINUATION_TRANSPORT_LOG: transportLogPath,
        P3_CONTINUATION_FIXTURE_MODE: mode, ALLOW_PRIVATE_NETWORK_FETCH: "false", COLLECT_ENABLED: "false",
        MODEL_CALLS_ENABLED: "false", INDEXNOW_SUBMIT_ENABLED: "false", JINA_BODY_FALLBACK: "false" },
    });
  };
  const freezeScope = (sourceId: string, prefix: string) => {
    const planDir = path.join(evidenceRoot, `${prefix}-plan`);
    const planned = run(["--database-url", databaseUrl, "--source-ids", sourceId, "--out-dir", planDir]);
    assert.equal(planned.status, 0, planned.stderr || planned.stdout);
    const plan = JSON.parse(planned.stdout) as { scopeSha256: string; scopePath: string };
    const frozen = JSON.parse(readFileSync(plan.scopePath, "utf8"));
    assert.equal(canonicalScopeSha256(frozen), plan.scopeSha256);
    return { plan, frozen };
  };

  try {
    const { plan, frozen } = freezeScope(sourceIds[0]!, "success");
    assert.deepEqual([frozen.limits.perSourceDispatchCap, frozen.limits.globalDispatchCap, frozen.limits.maxRedirects, frozen.limits.urlAllowlist], [2, 2, 0, "frozen_page_urls_only"]);
    const executionDir = path.join(evidenceRoot, "success-execution");
    const executed = run(["--execute", "--scope", plan.scopePath, "--scope-sha", plan.scopeSha256,
      "--out-dir", executionDir]);
    assert.equal(executed.status, 0, executed.stderr || executed.stdout);
    const manifest = JSON.parse(readFileSync(path.join(executionDir, "manifest.json"), "utf8")) as any;
    assert.equal(manifest.result, "bounded_continuation_complete");
    assert.deepEqual(manifest.scopeSha256, plan.scopeSha256);
    assert.equal(manifest.failure, null);
    assert.deepEqual(manifest.safetyViolations, []);
    assert.deepEqual(manifest.responseCaptures.map((row: any) => [row.path, row.statusCode, row.headers["content-encoding"]]), [
      ["/dir/index_2.htm", 200, "gzip"], ["/dir/index_3.htm", 200, "gzip"],
    ]);
    const transportLog = readFileSync(path.join(evidenceRoot, "success-execution-success-transport.jsonl"), "utf8")
      .trim().split("\n").map((line) => JSON.parse(line));
    assert.deepEqual(transportLog.map((row: any) => [row.origin, row.path, row.method]), [
      ["https://fiscal-fixture.mof.gov.cn", "/dir/index_2.htm", "GET"], ["https://fiscal-fixture.mof.gov.cn", "/dir/index_3.htm", "GET"],
    ], "all child-process HTTP dispatches are handled by the fixed fixture transport");
    for (const capture of manifest.responseCaptures as Array<any>) {
      const wire = readFileSync(path.join(executionDir, capture.rawFile));
      assert.equal(sha256(wire), capture.sha256, "manifest hash matches the complete captured wire bytes");
      assert.deepEqual([...wire.subarray(0, 2)], [0x1f, 0x8b], "capture stores compressed wire bytes");
      assert.match(gunzipSync(wire).toString("utf8"), /Fixture fiscal update/u);
    }
    const sourceRun = manifest.sourceRuns[0];
    assert.deepEqual([sourceRun.sourceId, sourceRun.result.status, sourceRun.result.created, sourceRun.dispatchesUsed,
      sourceRun.cursorValid, sourceRun.flags.enabled, sourceRun.flags.siteFulltext, sourceRun.flags.syndicateFulltext],
      [sourceIds[0], "ok", 2, 2, true, false, false, false]);
    assert.deepEqual(manifest.pageAudits[0].pages.map((page: any) => [page.candidateCount, page.candidateUrls.length, page.auditError]), [
      [1, 1, null], [1, 1, null],
    ], "the executor decodes captured gzip before auditing parsed candidates");
    assert.deepEqual(frozen.sources[0].pageIndices, [2, 3]);
    const [persistedSource] = await sql<{ cursor: Record<string, any> }[]>`
      SELECT id, cursor FROM sources WHERE id = ${sourceIds[0]}`;
    assert.deepEqual([persistedSource.cursor.webListBackfill.nextPageIndex, persistedSource.cursor.webListBackfill.pagesCommitted,
      persistedSource.cursor.webListBackfill.coverage], [4, 4, "unproven"]);
    const articles = await sql<{ url: string; body_status: string; body_text: string | null }[]>`
      SELECT url, body_status, body_text FROM articles WHERE source_id = ${sourceIds[0]} ORDER BY url`;
    assert.equal(articles.length, 2);
    assert.ok(articles.every((article) => article.body_status === "pending" && article.body_text === null));
    assert.ok(manifest.queueJobs.length > 0);
    assert.ok(manifest.queueJobs.every((job: any) => job.state === "created" && job.started_on === null));
    assert.equal(manifest.queueJobs.reduce((count: number, job: any) => count + Number(job.count), 0), 2);
    assert.equal(manifest.interpretation.workerStarted, false);
    assert.equal(manifest.interpretation.jobsConsumed, false);

    const { plan: failedPlan } = freezeScope(sourceIds[1]!, "transport-failure");
    const failureDir = path.join(evidenceRoot, "transport-failure-execution");
    const failed = run(["--execute", "--scope", failedPlan.scopePath, "--scope-sha", failedPlan.scopeSha256,
      "--out-dir", failureDir], "failure");
    assert.notEqual(failed.status, 0, "a failed source execution must return a nonzero exit status");
    const failureManifest = JSON.parse(readFileSync(path.join(failureDir, "manifest.json"), "utf8")) as any;
    assert.equal(failureManifest.result, "partial_or_failed");
    assert.ok(failureManifest.responseCaptures.some((row: any) => row.statusCode === 503));
    assert.ok(failureManifest.safetyViolations.includes("source_run_or_flags_violation"));
    assert.ok(failureManifest.safetyViolations.includes("non_html_or_non_200_response"));
    const [failedSource] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${sourceIds[1]}`;
    assert.equal(failedSource!.cursor.webListBackfill.nextPageIndex, 2, "failed page fetch does not advance the collector cursor");

    const { plan: redirectPlan } = freezeScope(sourceIds[2]!, "redirect");
    const redirectDir = path.join(evidenceRoot, "redirect-execution");
    const redirected = run(["--execute", "--scope", redirectPlan.scopePath, "--scope-sha", redirectPlan.scopeSha256,
      "--out-dir", redirectDir], "redirect");
    assert.notEqual(redirected.status, 0, "a redirect response must fail bounded execution");
    const redirectManifest = JSON.parse(readFileSync(path.join(redirectDir, "manifest.json"), "utf8")) as any;
    const redirectTransport = readFileSync(path.join(evidenceRoot, "redirect-execution-redirect-transport.jsonl"), "utf8")
      .trim().split("\n").map((line) => JSON.parse(line));
    assert.deepEqual(redirectTransport.map((row: any) => [row.path, row.method]), [["/dir/index_2.htm", "GET"]],
      "a 302 pointing at the other planned page causes no second HTTP dispatch");
    assert.deepEqual(redirectManifest.responseCaptures.map((row: any) => row.statusCode), [302]);
    assert.ok(redirectManifest.safetyViolations.includes("non_html_or_non_200_response"));
    assert.ok(redirectManifest.safetyViolations.includes("redirect_forbidden"));
    const [redirectSource] = await sql<{ cursor: Record<string, any> }[]>`SELECT cursor FROM sources WHERE id = ${sourceIds[2]}`;
    assert.equal(redirectSource!.cursor.webListBackfill.nextPageIndex, 2, "redirect response does not advance the cursor");

    writeFileSync(path.join(evidenceRoot, "fixture-assertions.json"), `${JSON.stringify({
      database: databaseIdentity,
      databaseUrlSha256: sha256(databaseUrl),
      scopeSha256: plan.scopeSha256,
      successExitCode: executed.status,
      successArticles: articles.length,
      successJobsCreatedUnstarted: manifest.queueJobs.reduce((count: number, job: any) => count + Number(job.count), 0),
      successWireCaptures: manifest.responseCaptures.map((row: any) => ({ path: row.path, sha256: row.sha256, encoding: row.headers["content-encoding"] })),
      failureExitCode: failed.status,
      failureStatusCode: failureManifest.responseCaptures.find((row: any) => row.statusCode === 503)?.statusCode,
      fixtureOnlyTransport: true,
      controlledHttpDispatches: transportLog,
      unmatchedNetworkEnabled: false,
    }, null, 2)}\n`);
  } finally {
    await closeDb();
  }
});
