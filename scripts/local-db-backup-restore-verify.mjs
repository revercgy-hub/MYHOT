#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PG_BIN = path.join(ROOT, '.data', 'test-pg', 'pgsql', 'bin');
const RUN_ID_RE = /^[a-z0-9][a-z0-9-]{7,39}$/i;
const SOURCE_DATABASE_RE = /^[a-zA-Z][a-zA-Z0-9_]*_test$/;
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);
const SCHEMA_FINGERPRINT_COVERAGE = [
  'user relations, columns, defaults, constraints, indexes, views, and triggers',
  'user functions/procedures and installed extensions',
];
const SCHEMA_FINGERPRINT_EXCLUDES = ['roles, grants, and user-defined types'];

export function parsePostgresUrl(value, { requireTestDatabase = true } = {}) {
  let url;
  try { url = new URL(value); } catch { throw new Error('DATABASE_URL must be a valid local PostgreSQL URL'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must use PostgreSQL');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/gu, '');
  if (!LOOPBACK.has(host)) throw new Error('DATABASE_URL must use a loopback host');
  if (url.search || url.hash) throw new Error('DATABASE_URL must not include query options or a fragment');
  const database = decodeURIComponent(url.pathname.replace(/^\//u, ''));
  if (!database || database.includes('/')) throw new Error('DATABASE_URL must name one database');
  if (requireTestDatabase && (!database.endsWith('_test') || database.startsWith('myhot_restore_'))) {
    throw new Error('source database must be an existing *_test database, not a restore target');
  }
  if (requireTestDatabase && (!SOURCE_DATABASE_RE.test(database) || Buffer.byteLength(database, 'utf8') > 63)) {
    throw new Error('source database name must be an ASCII PostgreSQL identifier of at most 63 bytes ending in _test');
  }
  const port = url.port ? Number(url.port) : 5432;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DATABASE_URL has an invalid port');
  return {
    protocol: url.protocol,
    host,
    port,
    database,
    username: decodeURIComponent(url.username || ''),
    password: decodeURIComponent(url.password || ''),
  };
}

export function validateRunId(value) {
  if (typeof value !== 'string' || !RUN_ID_RE.test(value)) throw new Error('run-id must be 8–40 ASCII letters, digits, or hyphens');
  return value.toLowerCase();
}

export function buildPlan({ databaseUrl, runId = newRunId(), root = ROOT }) {
  const source = parsePostgresUrl(databaseUrl);
  const id = validateRunId(runId);
  const directory = path.resolve(root, '.data', 'db-backup-restore', id);
  const restoreDatabase = `myhot_restore_${id.replaceAll('-', '_')}_test`;
  if (restoreDatabase.length > 63) throw new Error('run-id produces a PostgreSQL database name longer than 63 characters');
  return {
    schema: 'myhot.local-db-backup-restore-plan.v1',
    mode: 'plan_only',
    runId: id,
    source: { database: source.database, host: source.host, port: source.port },
    restoreDatabase,
    evidenceDirectory: directory,
    backupFile: path.join(directory, 'source.dump'),
    reportFile: path.join(directory, 'verification.json'),
    safety: {
      executeByDefault: false,
      loopbackOnly: true,
      sourceDatabaseMustEndInTest: true,
      restoreDatabaseMustBeAbsent: true,
      overwriteOrDropExistingDatabase: false,
      startOrStopServices: false,
      sourceWrites: false,
      externalNetwork: false,
      schemaFingerprintCoverage: SCHEMA_FINGERPRINT_COVERAGE,
      schemaFingerprintExcludes: SCHEMA_FINGERPRINT_EXCLUDES,
    },
    operations: [
      'read source identity and schema/data fingerprints',
      'create a custom-format pg_dump under the ignored evidence directory',
      'create the unique restore database from template0 if it is absent',
      'restore with pg_restore without --clean or --create',
      'compare source-before, source-after, and restored schema/data fingerprints',
    ],
  };
}

export function normalizePsqlOutput(value) {
  return value.replace(/\r\n/gu, '\n').trimEnd();
}

export function validateToolLocation(binDir, executable) {
  const relative = path.relative(binDir, executable);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('PostgreSQL tool resolves outside PG_BIN_DIR');
  }
  return executable;
}

function newRunId() {
  const timestamp = new Date().toISOString().replace(/[-:.]/gu, '').replace(/Z$/u, 'z').toLowerCase();
  return `${timestamp}-${randomBytes(5).toString('hex')}`;
}

function parseArgs(argv) {
  let execute = false;
  let runId;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--execute') execute = true;
    else if (arg === '--plan') execute = false;
    else if (arg === '--run-id') runId = argv[++index];
    else if (arg === '--help' || arg === '-h') return { help: true };
    else throw new Error(`unknown argument: ${arg}`);
  }
  return { execute, runId };
}

function helpText() {
  return [
    'Usage: node scripts/local-db-backup-restore-verify.mjs [--plan | --execute] [--run-id TOKEN]',
    'Default mode prints a read-only plan. Execution requires DATABASE_URL to identify a loopback *_test source database.',
    'Each execution reserves a new ignored .data run directory and a new *_test restore database; existing targets are never dropped.',
    'Schema fingerprints cover relations/columns/defaults/constraints/indexes/views/triggers/functions/extensions; roles, grants, and user-defined types are excluded.',
  ].join('\n');
}

async function findPgTools(env) {
  const configured = env.PG_BIN_DIR;
  if (configured && !path.isAbsolute(configured)) throw new Error('PG_BIN_DIR must be an absolute directory');
  const binDir = await realpath(path.resolve(configured || DEFAULT_PG_BIN));
  if (!(await stat(binDir)).isDirectory()) throw new Error('PG_BIN_DIR must be a directory');
  const suffix = process.platform === 'win32' ? '.exe' : '';
  const tools = {};
  for (const name of ['pg_dump', 'pg_restore', 'psql', 'createdb']) {
    const candidate = path.join(binDir, `${name}${suffix}`);
    let info;
    try { info = await stat(candidate); } catch { throw new Error(`PostgreSQL tool is missing: ${name}`); }
    if (!info.isFile()) throw new Error(`PostgreSQL tool is not a file: ${name}`);
    tools[name] = validateToolLocation(binDir, await realpath(candidate));
  }
  return { binDir, tools };
}

function childEnv(source, inherited) {
  const env = { ...inherited };
  for (const name of [
    'DATABASE_URL', 'PGSERVICE', 'PGSERVICEFILE', 'PGPASSFILE', 'PGOPTIONS', 'PGHOSTADDR', 'PGHOST', 'PGPORT',
    'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGAPPNAME', 'PGTARGETSESSIONATTRS', 'PGSSLMODE', 'PGCHANNELBINDING',
    'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy',
  ]) delete env[name];
  env.PGHOST = source.host;
  env.PGPORT = String(source.port);
  if (source.username) env.PGUSER = source.username;
  else delete env.PGUSER;
  if (source.password) env.PGPASSWORD = source.password;
  else delete env.PGPASSWORD;
  env.PGTZ = 'UTC';
  env.PGCONNECT_TIMEOUT = '10';
  env.PGSSLMODE = 'disable';
  return env;
}

function runProcess(executable, args, { env, cwd = ROOT, capture = 'text', maxTextBytes = 1_000_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const hash = capture === 'sha256' ? createHash('sha256') : null;
    const stdout = [];
    let stdoutBytes = 0;
    const stderr = [];
    let stderrBytes = 0;
    child.stdout.on('data', (chunk) => {
      if (hash) hash.update(chunk);
      else if (stdoutBytes < maxTextBytes) {
        const allowed = chunk.subarray(0, Math.max(0, maxTextBytes - stdoutBytes));
        stdout.push(allowed);
      }
      stdoutBytes += chunk.length;
    });
    child.stderr.on('data', (chunk) => {
      if (stderrBytes < 32_768) {
        const allowed = chunk.subarray(0, 32_768 - stderrBytes);
        stderr.push(allowed);
      }
      stderrBytes += chunk.length;
    });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      const result = {
        code,
        signal,
        stdoutBytes,
        stdout: hash ? undefined : Buffer.concat(stdout).toString('utf8'),
        stdoutSha256: hash ? hash.digest('hex') : undefined,
        stderr: Buffer.concat(stderr).toString('utf8'),
      };
      if (code === 0) resolve(result);
      else reject(Object.assign(new Error(`${path.basename(executable)} exited with code ${code ?? 'null'}${signal ? ` (${signal})` : ''}: ${result.stderr.trim()}`), { result }));
    });
  });
}

function connectionArgs(database) {
  return ['-X', '-q', '-A', '-t', '-w', '-v', 'ON_ERROR_STOP=1', '-h', database.host, '-p', String(database.port),
    ...(database.username ? ['-U', database.username] : []), '-d', database.database];
}

function schemaSql() {
  return `SELECT jsonb_build_object(
    'relations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'schema', n.nspname, 'name', c.relname, 'kind', c.relkind,
        'columns', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'name', a.attname, 'type', format_type(a.atttypid, a.atttypmod), 'notNull', a.attnotnull,
          'default', pg_get_expr(d.adbin, d.adrelid), 'identity', a.attidentity, 'generated', a.attgenerated
        ) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
          WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped), '[]'::jsonb),
        'constraints', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'name', con.conname, 'kind', con.contype, 'definition', pg_get_constraintdef(con.oid, true)
        ) ORDER BY con.conname) FROM pg_constraint con WHERE con.conrelid = c.oid), '[]'::jsonb),
        'indexes', COALESCE((SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY ix.relname)
          FROM pg_index i JOIN pg_class ix ON ix.oid = i.indexrelid WHERE i.indrelid = c.oid), '[]'::jsonb),
        'sequence', (SELECT jsonb_build_object('start', s.seqstart, 'increment', s.seqincrement, 'min', s.seqmin,
          'max', s.seqmax, 'cache', s.seqcache, 'cycle', s.seqcycle) FROM pg_sequence s WHERE s.seqrelid = c.oid),
        'viewDefinition', CASE WHEN c.relkind IN ('v', 'm') THEN pg_get_viewdef(c.oid, true) ELSE NULL END,
        'triggers', COALESCE((SELECT jsonb_agg(pg_get_triggerdef(t.oid, true) ORDER BY t.tgname)
          FROM pg_trigger t WHERE t.tgrelid = c.oid AND NOT t.tgisinternal), '[]'::jsonb)
      ) ORDER BY n.nspname, c.relname)
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p', 'v', 'm', 'S')
        AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname !~ '^pg_toast'
    ), '[]'::jsonb),
    'functions', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'identity', p.oid::regprocedure::text, 'definition', pg_get_functiondef(p.oid)
    ) ORDER BY p.oid::regprocedure::text)
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname !~ '^pg_toast' AND p.prokind IN ('f', 'p')), '[]'::jsonb),
    'extensions', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', extname, 'version', extversion) ORDER BY extname)
      FROM pg_extension), '[]'::jsonb)
  )::text;`;
}

function relationSql(relation) {
  const schema = quoteIdentifier(relation.schema);
  const name = quoteIdentifier(relation.name);
  const label = `${quoteLiteral(relation.schema)}::text AS schema_name, ${quoteLiteral(relation.name)}::text AS relation_name`;
  if (relation.kind === 'S') return `SELECT ${label}, jsonb_build_object('lastValue', last_value, 'isCalled', is_called)::text AS row_json FROM ${schema}.${name}`;
  return `SELECT ${label}, to_jsonb(t)::text AS row_json FROM ${schema}.${name} AS t`;
}

function quoteIdentifier(value) { return `"${String(value).replaceAll('"', '""')}"`; }
function quoteLiteral(value) { return `'${String(value).replaceAll("'", "''")}'`; }

async function snapshot(database, tools, env) {
  const schemaResult = await runProcess(tools.psql, [...connectionArgs(database), '-c', schemaSql()], { env });
  const schemaText = normalizePsqlOutput(schemaResult.stdout);
  let catalog;
  try { catalog = JSON.parse(schemaText); } catch { throw new Error('database catalog fingerprint query returned invalid JSON'); }
  const relations = catalog.relations.filter((relation) => ['r', 'p', 'm', 'S'].includes(relation.kind));
  const countQueries = relations.filter((relation) => relation.kind !== 'S').map((relation) =>
    `SELECT ${quoteLiteral(relation.schema)}::text AS schema_name, ${quoteLiteral(relation.name)}::text AS relation_name, count(*)::bigint AS row_count FROM ${quoteIdentifier(relation.schema)}.${quoteIdentifier(relation.name)}`);
  const countQuery = countQueries.length
    ? `SELECT COALESCE(jsonb_agg(jsonb_build_object('schema', x.schema_name, 'table', x.relation_name, 'rows', x.row_count::text) ORDER BY x.schema_name, x.relation_name), '[]'::jsonb)::text FROM (${countQueries.join(' UNION ALL ')}) AS x;`
    : `SELECT '[]'::jsonb::text;`;
  const countResult = await runProcess(tools.psql, [...connectionArgs(database), '-c', countQuery], { env });
  const tableCounts = normalizePsqlOutput(countResult.stdout);

  const dataSql = relations.length
    ? `SELECT jsonb_build_array(x.schema_name, x.relation_name, x.row_json)::text FROM (${relations.map(relationSql).join(' UNION ALL ')}) AS x ORDER BY x.schema_name, x.relation_name, x.row_json;`
    : `SELECT '' WHERE false;`;
  const dataResult = await runProcess(tools.psql, [...connectionArgs(database), '-c', dataSql], { env, capture: 'sha256' });
  return {
    schemaSha256: createHash('sha256').update(schemaText).digest('hex'),
    rowsSha256: dataResult.stdoutSha256,
    tableCounts: JSON.parse(tableCounts),
    relationCount: catalog.relations.length,
  };
}

async function sha256File(filename) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

function sanitizeError(error, secret) {
  let message = String(error?.message ?? error).slice(0, 2000);
  if (secret) message = message.replaceAll(secret, '[redacted]');
  return message.replace(/postgres(?:ql)?:\/\/[^\s]+/giu, '[connection redacted]');
}

async function writeEvidence(reportPath, report) {
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}

async function executePlan(plan, source, pgTools, inheritedEnv) {
  const baseDir = path.dirname(plan.evidenceDirectory);
  await mkdir(baseDir, { recursive: true });
  // This non-recursive mkdir is the one-time run lock. Never reuse or repair a prior run directory.
  await mkdir(plan.evidenceDirectory);
  const env = childEnv(source, inheritedEnv);
  let phase = 'tool-versions';
  const report = {
    schema: 'myhot.local-db-backup-restore-result.v1',
    runId: plan.runId,
    result: 'IN_PROGRESS',
    source: plan.source,
    restoreDatabase: plan.restoreDatabase,
    schemaFingerprintCoverage: SCHEMA_FINGERPRINT_COVERAGE,
    schemaFingerprintExcludes: SCHEMA_FINGERPRINT_EXCLUDES,
    evidenceDirectory: plan.evidenceDirectory,
    backupFile: plan.backupFile,
    network: 'loopback-postgresql-only',
    sourceWrites: 0,
    databaseDrops: 0,
    serviceStartsOrStops: 0,
  };
  try {
    const versions = {};
    for (const name of ['pg_dump', 'pg_restore', 'psql', 'createdb']) {
      const result = await runProcess(pgTools.tools[name], ['--version'], { env });
      versions[name] = normalizePsqlOutput(result.stdout);
    }
    const toolMajor = Number(/PostgreSQL\)?\s+(\d+)/u.exec(versions.pg_dump)?.[1]);
    const restoreMajor = Number(/PostgreSQL\)?\s+(\d+)/u.exec(versions.pg_restore)?.[1]);
    if (!toolMajor || toolMajor !== restoreMajor) throw new Error('pg_dump and pg_restore major versions must match');
    report.toolVersions = versions;
    phase = 'source-identity';
    const identityResult = await runProcess(pgTools.tools.psql, [...connectionArgs(source), '-F', '\t', '-c',
      `SELECT current_database(), COALESCE(host(inet_server_addr()), ''), current_setting('server_version_num');`], { env });
    const identity = normalizePsqlOutput(identityResult.stdout).split('\t');
    const serverMajor = Math.floor(Number(identity[2]) / 10000);
    if (identity[0] !== source.database) throw new Error('connected source database identity does not match DATABASE_URL');
    if (!LOOPBACK.has((identity[1] || '').toLowerCase()) && identity[1] !== '') throw new Error('connected PostgreSQL server address is not loopback');
    if (!serverMajor || toolMajor !== serverMajor) throw new Error('PostgreSQL client major version must match the local server major version');

    phase = 'target-preflight';
    const targetCheck = await runProcess(pgTools.tools.psql, [...connectionArgs(source), '-c',
      `SELECT count(*) FROM pg_database WHERE datname = ${quoteLiteral(plan.restoreDatabase)};`], { env });
    if (Number(normalizePsqlOutput(targetCheck.stdout)) !== 0) throw new Error('restore database already exists; refusing to overwrite');

    phase = 'source-before-fingerprint';
    const sourceBefore = await snapshot(source, pgTools.tools, env);
    phase = 'custom-dump';
    await runProcess(pgTools.tools.pg_dump, ['--no-password', '--format=custom', '--no-owner', '--no-acl', '--file', plan.backupFile,
      '-h', source.host, '-p', String(source.port), ...(source.username ? ['-U', source.username] : []), source.database], { env });
    const backupInfo = await stat(plan.backupFile);
    if (!backupInfo.isFile() || backupInfo.size === 0) throw new Error('pg_dump did not create a non-empty custom archive');
    report.backup = { format: 'custom', bytes: backupInfo.size, sha256: await sha256File(plan.backupFile) };

    phase = 'create-restore-database';
    await runProcess(pgTools.tools.createdb, ['-w', '-h', source.host, '-p', String(source.port),
      ...(source.username ? ['-U', source.username] : []), '-T', 'template0', plan.restoreDatabase], { env });
    phase = 'restore';
    await runProcess(pgTools.tools.pg_restore, ['--no-password', '--exit-on-error', '--no-owner', '--no-acl', '-h', source.host, '-p', String(source.port),
      ...(source.username ? ['-U', source.username] : []), '-d', plan.restoreDatabase, plan.backupFile], { env });

    phase = 'source-after-fingerprint';
    const sourceAfter = await snapshot(source, pgTools.tools, env);
    phase = 'restore-fingerprint';
    const target = { ...source, database: plan.restoreDatabase };
    const restored = await snapshot(target, pgTools.tools, env);
    report.fingerprints = { sourceBefore, sourceAfter, restored };
    if (JSON.stringify(sourceBefore) !== JSON.stringify(sourceAfter)) {
      throw new Error('source changed during the dump/restore window; verification is inconclusive and was not retried');
    }
    if (sourceAfter.schemaSha256 !== restored.schemaSha256 || sourceAfter.rowsSha256 !== restored.rowsSha256 ||
        JSON.stringify(sourceAfter.tableCounts) !== JSON.stringify(restored.tableCounts)) {
      throw new Error('restored schema, row fingerprints, or table counts differ from the stable source');
    }
    report.result = 'PASS';
    report.completedAtUtc = new Date().toISOString();
    report.requiredInterpretation = 'local synthetic/test database verification only; not NAS or production acceptance';
    await writeEvidence(plan.reportFile, report);
    return report;
  } catch (error) {
    report.result = 'FAIL';
    report.failedPhase = phase;
    report.error = sanitizeError(error, source.password);
    report.completedAtUtc = new Date().toISOString();
    report.requiredInterpretation = 'failure is preserved; no retry, target cleanup, or source write was attempted';
    try { await writeEvidence(plan.reportFile, report); } catch (writeError) {
      report.evidenceWriteError = sanitizeError(writeError, source.password);
    }
    throw Object.assign(new Error(report.error), { report });
  }
}

async function main(argv, env = process.env) {
  const options = parseArgs(argv);
  if (options.help) { process.stdout.write(`${helpText()}\n`); return; }
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required; .env is never read');
  const plan = buildPlan({ databaseUrl: env.DATABASE_URL, runId: options.runId });
  if (!options.execute) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }
  const pgTools = await findPgTools(env);
  const source = parsePostgresUrl(env.DATABASE_URL);
  const report = await executePlan(plan, source, pgTools, env);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

const calledAsScript = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (calledAsScript) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${String(error?.message ?? error)}\n`);
    process.exitCode = 1;
  });
}

