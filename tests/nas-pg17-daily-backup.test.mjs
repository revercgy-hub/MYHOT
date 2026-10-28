import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseCliArgs, parseDatabaseUrl, pgDumpArgs, runDailyBackup } from "../scripts/fiscal/nas-pg17-daily-backup.mjs";

const databaseUrl = "postgresql://backup_user:sensitive%21pass@postgres:5432/fiscalhot_staging";
const now = new Date("2026-10-29T17:00:00.000Z");
const runId = "pg17daily-20261029T170000Z-0123456789ab";

test("database URL parser rejects wrong database and unsupported connection options", () => {
  assert.deepEqual(parseDatabaseUrl(databaseUrl), {
    host: "postgres", port: 5432, database: "fiscalhot_staging", username: "backup_user", password: "sensitive!pass",
  });
  assert.throws(() => parseDatabaseUrl("postgres://user:pass@postgres:5432/other_db"), (error) => error.code === "DATABASE_IDENTITY_REJECTED");
  assert.equal(parseDatabaseUrl("postgres://user:pass@postgres:5432/fiscalhot_staging?sslmode=require").sslmode, "require");
  assert.throws(() => parseDatabaseUrl("postgres://user:pass@postgres:5432/fiscalhot_staging?application_name=x"), (error) => error.code === "UNSUPPORTED_DATABASE_URL");
});

test("pg_dump args contain connection identity but never URL or password", () => {
  const database = parseDatabaseUrl(databaseUrl);
  const args = pgDumpArgs(database, "/data/pg17-daily-backups/run/database.dump.part");
  assert.equal(args.includes(databaseUrl), false);
  assert.equal(args.includes(database.password), false);
  assert.deepEqual(args.slice(0, 8), ["--host", "postgres", "--port", "5432", "--username", "backup_user", "--dbname", "fiscalhot_staging"]);
  assert.equal(args.includes("--format=custom"), true);
});

test("verified backup writes a private manifest and checks PG17 archive listing", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nas-pg17-backup-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const outputDir = path.join(root, "pg17-daily-backups");
  const seen = [];
  const runTool = async (command, args, env) => {
    seen.push({ command, args, env });
    if (args[0] === "--version") return { stdout: Buffer.from(`${command} (PostgreSQL) 17.6\n`) };
    if (command === "pg_dump") {
      const file = args[args.indexOf("--file") + 1];
      await writeFile(file, Buffer.from("synthetic custom archive"), { mode: 0o600 });
      return { stdout: Buffer.alloc(0) };
    }
    if (args[0] === "--list") return { stdout: Buffer.from("; Archive created at 2026-10-29\n; PostgreSQL database dump\n") };
    assert.deepEqual(args.slice(0, 3), ["--schema-only", "--file", "-"]);
    return { stdout: Buffer.from("CREATE TABLE sample(id integer);\n") };
  };

  const manifest = await runDailyBackup({ env: { DATABASE_URL: databaseUrl, SAFE_FLAG: "yes" }, now, runId, outputDir, runTool });
  assert.equal(manifest.status, "verified");
  assert.equal(manifest.database, "fiscalhot_staging");
  assert.equal(manifest.scheduledDateAsiaShanghai, "2026-10-30");
  assert.equal(manifest.bytes, Buffer.byteLength("synthetic custom archive"));
  assert.match(manifest.sha256, /^[a-f0-9]{64}$/u);
  assert.match(manifest.pgRestoreListSha256, /^[a-f0-9]{64}$/u);
  assert.match(manifest.schemaDdlSha256, /^[a-f0-9]{64}$/u);
  assert.ok(manifest.schemaDdlBytes > 0);
  assert.equal(JSON.stringify(manifest).includes("sensitive"), false);
  assert.equal(seen.length, 5);
  for (const call of seen) {
    assert.equal(call.env.PGPASSWORD, "sensitive!pass");
    assert.equal(call.env.DATABASE_URL, undefined);
    assert.equal(call.env.SAFE_FLAG, undefined);
    assert.equal(call.args.join(" ").includes("sensitive"), false);
  }
  const runDir = path.join(outputDir, runId);
  const files = await readdir(runDir);
  assert.deepEqual(files.sort(), ["database.dump", "manifest.json"]);
  const manifestStat = await stat(path.join(runDir, "manifest.json"));
  if (process.platform !== "win32") assert.equal(manifestStat.mode & 0o777, 0o600);
  const folderStat = await stat(runDir);
  if (process.platform !== "win32") assert.equal(folderStat.mode & 0o777, 0o700);
  assert.equal((await readFile(path.join(runDir, "manifest.json"), "utf8")).includes("sensitive"), false);
});

test("wrong PostgreSQL major leaves a failure record and no verified manifest", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nas-pg17-backup-failure-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const outputDir = path.join(root, "pg17-daily-backups");
  const runTool = async (command, args) => ({ stdout: Buffer.from(args[0] === "--version"
    ? `${command} (PostgreSQL) 16.9\n` : "") });
  await assert.rejects(runDailyBackup({ env: { DATABASE_URL: databaseUrl }, now, runId, outputDir, runTool }), (error) => error.code === "POSTGRES_TOOL_MUST_BE_17");
  const runDir = path.join(outputDir, runId);
  const files = await readdir(runDir);
  assert.deepEqual(files, ["failure.json"]);
  const failure = JSON.parse(await readFile(path.join(runDir, "failure.json"), "utf8"));
  assert.equal(failure.status, "failed");
  assert.equal(failure.code, "POSTGRES_TOOL_MUST_BE_17");
  assert.equal(JSON.stringify(failure).includes("sensitive"), false);
});

test("restore-list failure is retained as a failure and does not create a success manifest", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nas-pg17-backup-list-failure-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const outputDir = path.join(root, "pg17-daily-backups");
  const runTool = async (command, args) => {
    if (args[0] === "--version") return { stdout: Buffer.from(`${command} (PostgreSQL) 17.6\n`) };
    if (command === "pg_dump") {
      await writeFile(args[args.indexOf("--file") + 1], Buffer.from("synthetic custom archive"), { mode: 0o600 });
      return { stdout: Buffer.alloc(0) };
    }
    if (args[0] === "--list") throw new Error("simulated pg_restore failure");
    return { stdout: Buffer.from("CREATE TABLE sample(id integer);\n") };
  };
  await assert.rejects(runDailyBackup({ env: { DATABASE_URL: databaseUrl }, now, runId, outputDir, runTool }), (error) => error.code === "UNEXPECTED_FAILURE");
  const runDir = path.join(outputDir, runId);
  const files = await readdir(runDir);
  assert.deepEqual(files.sort(), ["database.dump.part", "failure.json"]);
  assert.equal(files.includes("manifest.json"), false);
});

test("operator refuses to start outside the 01:00 Asia/Shanghai slot", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nas-pg17-backup-window-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const outputDir = path.join(root, "pg17-daily-backups");
  await assert.rejects(runDailyBackup({ env: { DATABASE_URL: databaseUrl }, now: new Date("2026-10-29T16:59:00.000Z"), runId, outputDir }),
    (error) => error.code === "OUTSIDE_SCHEDULED_SLOT");
});

test("manual mode permits one daytime backup and is recorded in the manifest", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nas-pg17-backup-manual-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const outputDir = path.join(root, "pg17-daily-backups");
  const manualRunId = "pg17daily-20261029T200000Z-0123456789ab";
  const runTool = async (command, args) => {
    if (args[0] === "--version") return { stdout: Buffer.from(`${command} (PostgreSQL) 17.6\n`) };
    if (command === "pg_dump") {
      await writeFile(args[args.indexOf("--file") + 1], Buffer.from("synthetic custom archive"), { mode: 0o600 });
      return { stdout: Buffer.alloc(0) };
    }
    if (args[0] === "--list") return { stdout: Buffer.from("; Archive\n") };
    return { stdout: Buffer.from("CREATE TABLE sample(id integer);\n") };
  };
  const manifest = await runDailyBackup({ env: { DATABASE_URL: databaseUrl }, now: new Date("2026-10-29T20:00:00.000Z"),
    runId: manualRunId, outputDir, runTool, manual: parseCliArgs(["--manual"]) });
  assert.equal(manifest.status, "verified");
  assert.equal(manifest.executionMode, "manual");
  assert.equal(JSON.parse(await readFile(path.join(outputDir, manualRunId, "manifest.json"), "utf8")).executionMode, "manual");
});

test("manual flag is explicit and rejects unknown or repeated arguments", () => {
  assert.equal(parseCliArgs([]), false);
  assert.equal(parseCliArgs(["--manual"]), true);
  assert.throws(() => parseCliArgs(["--force"]), (error) => error.code === "UNSUPPORTED_ARGUMENTS");
  assert.throws(() => parseCliArgs(["--manual", "--manual"]), (error) => error.code === "UNSUPPORTED_ARGUMENTS");
});

test("run ID is never overwritten or reused", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nas-pg17-backup-once-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const outputDir = path.join(root, "pg17-daily-backups");
  const runTool = async (command, args) => {
    if (args[0] === "--version") return { stdout: Buffer.from(`${command} (PostgreSQL) 17.6\n`) };
    if (command === "pg_dump") {
      await writeFile(args[args.indexOf("--file") + 1], Buffer.from("synthetic custom archive"), { mode: 0o600 });
      return { stdout: Buffer.alloc(0) };
    }
    if (args[0] === "--list") return { stdout: Buffer.from("; Archive\n") };
    return { stdout: Buffer.from("CREATE TABLE sample(id integer);\n") };
  };
  await runDailyBackup({ env: { DATABASE_URL: databaseUrl }, now, runId, outputDir, runTool });
  const manifestPath = path.join(outputDir, runId, "manifest.json");
  const before = await readFile(manifestPath);
  await assert.rejects(runDailyBackup({ env: { DATABASE_URL: databaseUrl }, now, runId, outputDir, runTool }),
    (error) => error.code === "UNEXPECTED_FAILURE");
  assert.deepEqual(await readFile(manifestPath), before);
});
