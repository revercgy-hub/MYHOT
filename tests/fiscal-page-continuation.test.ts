import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { after, before, test } from "node:test";
import {
  assertLoopbackTestDatabase,
  canonicalScopeSha256,
  isAllowedContinuationDispatch,
  parseExplicitSourceIds,
  validateContinuationScope,
  type PaginationContinuationScope,
} from "../scripts/fiscal/p3-page-continuation.ts";
import { sha256 } from "../packages/backend/src/lib/ids.ts";

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
    v: 1,
    createdAtUtc: "2026-10-16T00:00:00.000Z",
    databaseUrlSha256: sha256(databaseUrl),
    database: { name: databaseName, address: "127.0.0.1", port: 5432, migrations: 35 },
    sourceIds: ["fixture-source"],
    sources: [{ id: "fixture-source", configSha256: "a".repeat(64), adapterConfigHash: "b".repeat(64),
      enabled: false, siteFulltext: false, syndicateFulltext: false, cursor, listUrl, allowUrlPrefixes: [listUrl],
      pageIndices: [2, 3], pageUrls: ["https://fixture.example/dir/index_2.htm", "https://fixture.example/dir/index_3.htm"],
      host: "fixture.example", pathPrefix: "/dir/", maxPageIndex: 8 }],
    limits: { pagesPerSource: 2, perSourceDispatchCap: 12, globalDispatchCap: 48, minDispatchIntervalMs: 1000, activeWaitMs: 1100, maxCapturedResponseBytes: 6_291_456 },
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
  assert.throws(() => validateContinuationScope(invalidLimits, canonicalScopeSha256(invalidLimits)), /database identity|migration/u);
});

test("allows only exact frozen list pages and same-origin HTML metadata paths", () => {
  const source = scopeFixture().sources[0]!;
  assert.equal(isAllowedContinuationDispatch(source, { origin: "https://fixture.example", path: "/dir/index_2.htm", method: "GET" }), true);
  assert.equal(isAllowedContinuationDispatch(source, { origin: "https://fixture.example", path: "/dir/article.html", method: "GET" }), false);
  assert.equal(isAllowedContinuationDispatch(source, { origin: "https://fixture.example", path: "/dir/article.html", method: "GET" }, new Set(["https://fixture.example/dir/article.html"])), true);
  assert.equal(isAllowedContinuationDispatch(source, { origin: "http://fixture.example", path: "/dir/article.html", method: "GET" }), false);
  assert.equal(isAllowedContinuationDispatch(source, { origin: "https://other.example", path: "/dir/article.html", method: "GET" }), false);
  assert.equal(isAllowedContinuationDispatch(source, { origin: "https://fixture.example", path: "/dir/article.pdf", method: "GET" }), false);
  assert.equal(isAllowedContinuationDispatch(source, { origin: "https://fixture.example", path: "/dir/article.html?download=1", method: "GET" }), false);
  assert.equal(isAllowedContinuationDispatch(source, { origin: "https://fixture.example", path: "/dir/article.html", method: "POST" }), false);
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
