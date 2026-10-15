import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPlan,
  normalizePsqlOutput,
  parsePostgresUrl,
  validateRunId,
  validateToolLocation,
} from '../local-db-backup-restore-verify.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = path.join(ROOT, 'scripts', 'local-db-backup-restore-verify.mjs');

test('accepts only local PostgreSQL *_test source databases and never returns credentials', () => {
  const parsed = parsePostgresUrl('postgres://tester:sensitive-pass@127.0.0.1:5432/synthetic_source_test');
  assert.deepEqual({ host: parsed.host, port: parsed.port, database: parsed.database }, {
    host: '127.0.0.1', port: 5432, database: 'synthetic_source_test',
  });
  const plan = buildPlan({
    databaseUrl: 'postgres://tester:sensitive-pass@localhost/synthetic_source_test',
    runId: 'test-run-0001',
    root: 'D:/isolated',
  });
  assert.equal(plan.restoreDatabase, 'myhot_restore_test_run_0001_test');
  assert.equal(plan.backupFile, path.join('D:/isolated', '.data', 'db-backup-restore', 'test-run-0001', 'source.dump'));
  assert.equal(JSON.stringify(plan).includes('sensitive-pass'), false);
  assert.equal(plan.safety.executeByDefault, false);
  assert.equal(plan.safety.overwriteOrDropExistingDatabase, false);
  assert.deepEqual(plan.safety.schemaFingerprintExcludes, ['roles, grants, and user-defined types']);
});

test('rejects remote hosts, unsafe source names, URL query options, and ambiguous path tokens', () => {
  for (const url of [
    'postgres://user@db.example.com:5432/app_test',
    'postgres://user@127.0.0.1:5432/app',
    'postgres://user@127.0.0.1:5432/myhot_restore_old_test',
    'postgres://user@127.0.0.1:5432/bad-name_test',
    'postgres://user@127.0.0.1:5432/7starts_test',
    `postgres://user@127.0.0.1:5432/${'a'.repeat(59)}_test`,
    'postgres://user@127.0.0.1:5432/nämé_test',
    'postgres://user@127.0.0.1:5432/app_test?sslmode=require',
  ]) assert.throws(() => parsePostgresUrl(url));
  for (const id of ['short', '../escape-123', 'with space-123', 'a'.repeat(41)]) assert.throws(() => validateRunId(id));
  assert.throws(() => buildPlan({ databaseUrl: 'postgres://user@192.168.1.5/app_test', runId: 'test-run-0001' }));
});

test('validates tool paths, and normalizes only line endings and trailing whitespace', () => {
  assert.equal(validateToolLocation('D:/pg/bin', 'D:/pg/bin/psql.exe'), 'D:/pg/bin/psql.exe');
  assert.throws(() => validateToolLocation('D:/pg/bin', 'D:/other/psql.exe'), /outside PG_BIN_DIR/u);
  assert.equal(normalizePsqlOutput('catalog\r\nrows\r\n\n'), 'catalog\nrows');
});

test('default CLI mode prints a read-only plan and omits DATABASE_URL credentials', () => {
  const result = spawnSync(process.execPath, [SCRIPT, '--plan', '--run-id', 'test-run-0002'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: 'postgres://tester:sensitive-pass@127.0.0.1:5432/synthetic_source_test' },
  });
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.mode, 'plan_only');
  assert.equal(plan.runId, 'test-run-0002');
  assert.equal(result.stdout.includes('sensitive-pass'), false);
  assert.equal(plan.restoreDatabase, 'myhot_restore_test_run_0002_test');
});

test('execution requires an explicit flag and validates the database before touching PostgreSQL', () => {
  const result = spawnSync(process.execPath, [SCRIPT, '--execute', '--run-id', 'test-run-0003'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: 'postgres://tester@db.example.com:5432/synthetic_source_test' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /loopback host/u);
});
