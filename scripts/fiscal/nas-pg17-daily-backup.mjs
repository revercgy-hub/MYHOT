#!/usr/bin/env node
/** Private, local PostgreSQL 17 custom-format backup for the NAS Staging database. */
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { chmod, lstat, mkdir, open, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_OUTPUT_DIR = "/data/pg17-daily-backups";
const RUN_ID = /^pg17daily-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}$/u;
const EXPECTED_DATABASE = "fiscalhot_staging";
const MAX_RESTORE_LIST_BYTES = 64 * 1024 * 1024;

export class BackupError extends Error {
  constructor(stage, code) {
    super(`backup failed at ${stage}`);
    this.name = "BackupError";
    this.stage = stage;
    this.code = code;
  }
}

export function parseDatabaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new BackupError("database_url", "INVALID_DATABASE_URL"); }
  const queryKeys = [...url.searchParams.keys()];
  const sslmode = url.searchParams.get("sslmode");
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hash ||
      queryKeys.some((key) => key !== "sslmode") || queryKeys.filter((key) => key === "sslmode").length > 1 ||
      (sslmode !== null && !["disable", "allow", "prefer", "require", "verify-ca", "verify-full"].includes(sslmode))) {
    throw new BackupError("database_url", "UNSUPPORTED_DATABASE_URL");
  }
  let database;
  let username;
  let password;
  try {
    database = decodeURIComponent(url.pathname.replace(/^\//u, ""));
    username = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch { throw new BackupError("database_url", "INVALID_DATABASE_URL_ENCODING"); }
  const host = url.hostname.replace(/^\[|\]$/gu, "");
  const port = url.port ? Number(url.port) : 5432;
  if (!host || !username || database !== EXPECTED_DATABASE || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new BackupError("database_url", "DATABASE_IDENTITY_REJECTED");
  }
  return { host, port, database, username, password, ...(sslmode ? { sslmode } : {}) };
}

export function makeRunId(now = new Date(), nonce = randomBytes(6).toString("hex")) {
  if (!Number.isFinite(now.getTime()) || !/^[a-f0-9]{12}$/u.test(nonce)) throw new BackupError("run_id", "INVALID_RUN_ID_INPUT");
  const stamp = now.toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}/u, "");
  return `pg17daily-${stamp}-${nonce}`;
}

function assertScheduledWindow(date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  if (values.hour !== 1 || values.minute !== 0) throw new BackupError("schedule", "OUTSIDE_SCHEDULED_SLOT");
}

function shanghaiDate(date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function pgDumpArgs(database, dumpPath) {
  return ["--host", database.host, "--port", String(database.port), "--username", database.username,
    "--dbname", database.database, "--no-password", "--format=custom", "--compress=6", "--no-owner", "--no-privileges", "--file", dumpPath];
}

export function parseCliArgs(args) {
  if (args.length === 0) return false;
  if (args.length === 1 && args[0] === "--manual") return true;
  throw new BackupError("arguments", "UNSUPPORTED_ARGUMENTS");
}

export function normalizeSchemaDdl(schemaBytes) {
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(schemaBytes); }
  catch { throw new BackupError("schema_ddl_fingerprint", "SCHEMA_DDL_UTF8_INVALID"); }
  const lines = text.split("\n");
  const markers = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const content = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (!content.startsWith("\\restrict") && !content.startsWith("\\unrestrict")) continue;
    const match = /^(\\restrict|\\unrestrict) ([A-Za-z0-9_-]{1,256})$/u.exec(content);
    if (!match) throw new BackupError("schema_ddl_fingerprint", "SCHEMA_DDL_RESTRICT_MARKER_INVALID");
    markers.push({ index, command: match[1], token: match[2], crlf: line.endsWith("\r") });
  }
  const restrict = markers.filter((marker) => marker.command === "\\restrict");
  const unrestrict = markers.filter((marker) => marker.command === "\\unrestrict");
  if (restrict.length !== 1 || unrestrict.length !== 1 || restrict[0].token !== unrestrict[0].token ||
      restrict[0].index >= unrestrict[0].index) {
    throw new BackupError("schema_ddl_fingerprint", "SCHEMA_DDL_RESTRICT_PAIR_INVALID");
  }
  for (const marker of markers) {
    lines[marker.index] = `${marker.command} <normalized-key>${marker.crlf ? "\r" : ""}`;
  }
  return Buffer.from(lines.join("\n"), "utf8");
}

function parsePgMajor(output) {
  const match = /\bPostgreSQL\)?\s+(\d+)(?:\.\d+)?/u.exec(output);
  if (!match) throw new BackupError("tool_version", "POSTGRES_TOOL_VERSION_UNREADABLE");
  if (Number(match[1]) !== 17) throw new BackupError("tool_version", "POSTGRES_TOOL_MUST_BE_17");
  return output.trim().slice(0, 80);
}

function childEnv(source, password, sslmode) {
  const env = {
    PATH: source.PATH || "/usr/local/bin:/usr/bin:/bin",
    HOME: source.HOME || "/tmp",
    LANG: source.LANG || "C.UTF-8",
    ...(sslmode ? { PGSSLMODE: sslmode } : {}),
  };
  if (password) env.PGPASSWORD = password;
  return env;
}

function runTool(command, args, env, { timeoutMs = 2 * 60 * 60_000, maxStdout = 1_000_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, shell: false, stdio: ["ignore", "pipe", "ignore"] });
    const chunks = [];
    let size = 0;
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new BackupError("tool", "POSTGRES_TOOL_TIMEOUT"));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxStdout) {
        child.kill("SIGKILL");
        finish(new BackupError("tool", "POSTGRES_TOOL_OUTPUT_LIMIT"));
      } else chunks.push(chunk);
    });
    child.on("error", (error) => finish(new BackupError("tool", error.code === "ENOENT" ? "POSTGRES_TOOL_MISSING" : "POSTGRES_TOOL_START_FAILED")));
    child.on("close", (code) => {
      if (code !== 0) finish(new BackupError("tool", "POSTGRES_TOOL_EXIT_NONZERO"));
      else finish(null, { stdout: Buffer.concat(chunks) });
    });
  });
}

async function ensurePrivateDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new BackupError("private_directory", "BACKUP_DIRECTORY_NOT_REAL_DIRECTORY");
  await chmod(directory, 0o700);
  const after = await stat(directory);
  if (process.platform !== "win32" && (after.mode & 0o777) !== 0o700) throw new BackupError("private_directory", "BACKUP_DIRECTORY_MODE_INVALID");
}

async function writePrivateNew(file, bytes) {
  const handle = await open(file, "wx", 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  await chmod(file, 0o600);
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || (process.platform !== "win32" && (info.mode & 0o777) !== 0o600)) {
    throw new BackupError("private_file", "BACKUP_FILE_MODE_INVALID");
  }
}

async function writePrivateAtomicNew(file, bytes) {
  const partial = `${file}.part`;
  await writePrivateNew(partial, bytes);
  try {
    await lstat(file);
    throw new BackupError("manifest", "MANIFEST_ALREADY_EXISTS");
  } catch (error) {
    if (error instanceof BackupError) throw error;
    if (error?.code !== "ENOENT") throw new BackupError("manifest", "MANIFEST_PATH_UNAVAILABLE");
  }
  await rename(partial, file);
  await chmod(file, 0o600);
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || (process.platform !== "win32" && (info.mode & 0o777) !== 0o600)) {
    throw new BackupError("manifest", "MANIFEST_MODE_INVALID");
  }
}

async function sha256File(file) {
  const { createReadStream } = await import("node:fs");
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

function safeFailure(error, fallbackStage) {
  return error instanceof BackupError
    ? { stage: error.stage, code: error.code }
    : { stage: fallbackStage, code: "UNEXPECTED_FAILURE" };
}

export async function runDailyBackup(options = {}) {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const manual = options.manual === true;
  if (options.manual !== undefined && typeof options.manual !== "boolean") throw new BackupError("arguments", "INVALID_MANUAL_MODE");
  const executionMode = manual ? "manual" : "scheduled";
  const runId = options.runId ?? makeRunId(now, options.nonce);
  if (!RUN_ID.test(runId)) throw new BackupError("run_id", "INVALID_RUN_ID");
  const outputDir = options.outputDir ?? DEFAULT_OUTPUT_DIR;
  const runDir = path.join(outputDir, runId);
  const dumpPart = path.join(runDir, "database.dump.part");
  const dumpFinal = path.join(runDir, "database.dump");
  const invoke = options.runTool ?? runTool;
  let stage = "private_directory";
  let runDirCreated = false;
  try {
    if (!manual) assertScheduledWindow(now);
    await ensurePrivateDirectory(outputDir);
    await mkdir(runDir, { mode: 0o700 });
    runDirCreated = true;
    await chmod(runDir, 0o700);
    const runDirInfo = await stat(runDir);
    if (!runDirInfo.isDirectory() || (process.platform !== "win32" && (runDirInfo.mode & 0o777) !== 0o700)) throw new BackupError("private_directory", "RUN_DIRECTORY_MODE_INVALID");

    stage = "database_url";
    const database = parseDatabaseUrl(env.DATABASE_URL ?? "");
    const childEnvironment = childEnv(env, database.password, database.sslmode);
    stage = "pg_dump_version";
    const dumpVersion = parsePgMajor((await invoke(options.pgDump ?? "pg_dump", ["--version"], childEnvironment)).stdout.toString("utf8"));
    stage = "pg_restore_version";
    const restoreVersion = parsePgMajor((await invoke(options.pgRestore ?? "pg_restore", ["--version"], childEnvironment)).stdout.toString("utf8"));

    stage = "pg_dump";
    await invoke(options.pgDump ?? "pg_dump", pgDumpArgs(database, dumpPart), childEnvironment);
    const dumpInfo = await lstat(dumpPart);
    if (!dumpInfo.isFile() || dumpInfo.isSymbolicLink() || dumpInfo.size < 1) throw new BackupError("pg_dump", "DUMP_FILE_INVALID");
    await chmod(dumpPart, 0o600);

    stage = "pg_restore_list";
    const list = await invoke(options.pgRestore ?? "pg_restore", ["--list", dumpPart], childEnvironment,
      { maxStdout: MAX_RESTORE_LIST_BYTES, timeoutMs: 30_000 });
    const listText = list.stdout.toString("utf8");
    if (!listText.trimStart().startsWith(";")) throw new BackupError("pg_restore_list", "RESTORE_LIST_INVALID");

    stage = "schema_ddl_fingerprint";
    const schemaDdl = await invoke(options.pgRestore ?? "pg_restore", ["--schema-only", "--file", "-", dumpPart], childEnvironment,
      { maxStdout: MAX_RESTORE_LIST_BYTES, timeoutMs: 30_000 });
    if (schemaDdl.stdout.length === 0) throw new BackupError("schema_ddl_fingerprint", "SCHEMA_DDL_EMPTY");
    const normalizedSchemaDdl = normalizeSchemaDdl(schemaDdl.stdout);
    const schemaDdlSha256 = createHash("sha256").update(schemaDdl.stdout).digest("hex");
    const normalizedSchemaDdlSha256 = createHash("sha256").update(normalizedSchemaDdl).digest("hex");
    await writePrivateNew(path.join(runDir, "schema.ddl.sql"), schemaDdl.stdout);

    stage = "backup_hash";
    const dumpSha256 = await sha256File(dumpPart);
    const restoreListSha256 = createHash("sha256").update(list.stdout).digest("hex");
    await rename(dumpPart, dumpFinal);
    await chmod(dumpFinal, 0o600);
    const finalInfo = await lstat(dumpFinal);
    if (!finalInfo.isFile() || finalInfo.isSymbolicLink() || (process.platform !== "win32" && (finalInfo.mode & 0o777) !== 0o600) || finalInfo.size !== dumpInfo.size) {
      throw new BackupError("backup_hash", "FINAL_DUMP_INVALID");
    }

    stage = "manifest";
    const manifest = {
      schemaVersion: "nas-pg17-daily-backup.v1",
      status: "verified",
      executionMode,
      runId,
      createdAt: now.toISOString(),
      scheduledDateAsiaShanghai: shanghaiDate(now),
      database: database.database,
      format: "pg_dump custom",
      pgDumpVersion: dumpVersion,
      pgRestoreVersion: restoreVersion,
      dumpFile: "database.dump",
      bytes: finalInfo.size,
      sha256: dumpSha256,
      pgRestoreListSha256: restoreListSha256,
      schemaDdlFile: "schema.ddl.sql",
      schemaDdlBytes: schemaDdl.stdout.length,
      schemaDdlSha256,
      normalizedSchemaAlgorithm: "pg17-restrict-key-pair-v1",
      normalizedSchemaDdlSha256,
    };
    await writePrivateAtomicNew(path.join(runDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
  } catch (error) {
    if (runDirCreated) {
      const failure = { schemaVersion: "nas-pg17-daily-backup-failure.v1", status: "failed", runId,
        at: now.toISOString(), executionMode, ...safeFailure(error, stage) };
      await writePrivateNew(path.join(runDir, "failure.json"), `${JSON.stringify(failure, null, 2)}\n`).catch(() => {});
    }
    throw error instanceof BackupError ? error : new BackupError(stage, "UNEXPECTED_FAILURE");
  }
}

async function main() {
  process.umask(0o077);
  try {
    if (process.platform !== "linux") throw new BackupError("startup", "LINUX_CONTAINER_REQUIRED");
    const manual = parseCliArgs(process.argv.slice(2));
    const result = await runDailyBackup({ manual });
    process.stdout.write(`NAS_PG17_BACKUP=VERIFIED runId=${result.runId} bytes=${result.bytes} sha256=${result.sha256}\n`);
  } catch (error) {
    const details = safeFailure(error, "startup");
    process.stderr.write(`NAS_PG17_BACKUP=FAILED stage=${details.stage} code=${details.code}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
