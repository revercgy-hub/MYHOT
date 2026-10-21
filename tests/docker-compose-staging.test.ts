import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import test from "node:test";

const root = new URL("../", import.meta.url);
const compose = readFileSync(new URL("docker-compose.yml", root), "utf8");
const stagingCompose = readFileSync(new URL("docker-compose.nas-staging.yml", root), "utf8");
const stagingEnv = parseEnv(readFileSync(new URL(".env.nas-staging.example", root), "utf8"));

function serviceBlock(source: string, name: string): string {
  const withSentinel = `${source}\n  __compose_test_end__:\n`;
  const match = withSentinel.match(new RegExp(`^  ${name}:\\r?\\n([\\s\\S]*?)(?=^  [\\w-]+:|^volumes:)`, "m"));
  assert.ok(match, `missing compose service ${name}`);
  return match[1]!;
}

test("staging maps host and container Web to the configured 3221 port", () => {
  assert.equal(stagingEnv.PORT, "3221");
  assert.equal(stagingEnv.WEB_PORT, "3221");
  assert.equal(stagingEnv.SITE_URL, "http://192.168.3.100:3221");
  assert.equal(stagingEnv.STAGING_NOINDEX, "true");
  assert.match(compose, /WEB_PORT: \$\{WEB_PORT:-3000\}/);
  assert.match(compose, /"\$\{PORT:-3000\}:\$\{WEB_PORT:-3000\}"/);
  assert.match(serviceBlock(compose, "web"), /STAGING_NOINDEX: \$\{STAGING_NOINDEX:-false\}/);
  assert.match(serviceBlock(compose, "web"), /TRUST_PROXY: \$\{TRUST_PROXY:-false\}/);
});
test("database and API remain internal and Web does not inherit backend secrets", () => {
  assert.doesNotMatch(serviceBlock(compose, "db"), /^\s+ports:/m);
  assert.doesNotMatch(serviceBlock(compose, "api"), /^\s+ports:/m);
  assert.match(serviceBlock(compose, "setup"), /^    env_file: \.env$/m);
  assert.match(serviceBlock(compose, "api"), /^    env_file: \.env$/m);
  assert.match(serviceBlock(compose, "worker"), /^    env_file: \.env$/m);
  for (const name of ["setup", "api", "worker"]) {
    assert.match(serviceBlock(compose, name), /AIHOT_DATA_DIR: \/data/);
    assert.match(serviceBlock(compose, name), /- data:\/data/);
  }
  const appAnchor = compose.match(/^x-app:[\s\S]*?^services:/m)?.[0] ?? "";
  assert.ok(appAnchor);
  assert.doesNotMatch(appAnchor, /^\s+env_file:/m);
  assert.doesNotMatch(serviceBlock(compose, "web"), /env_file:|DATABASE_URL|POSTGRES_PASSWORD|LLM_API_KEY|ADMIN_PASSWORD/);
  assert.doesNotMatch(serviceBlock(compose, "web"), /AIHOT_DATA_DIR|data:\/data/);
});

test("staging defaults to a unique database/project and keeps external work disabled", () => {
  assert.equal(stagingEnv.COMPOSE_PROJECT_NAME, "fiscalhot-staging");
  assert.match(stagingCompose, /^name: fiscalhot-staging$/m);
  assert.equal(stagingEnv.POSTGRES_DB, "fiscalhot_staging");
  assert.equal(stagingEnv.DEPLOY_SHA, "");
  for (const name of [
    "COLLECT_ENABLED",
    "MODEL_CALLS_ENABLED",
    "FEISHU_CONTENT_PUSH_ENABLED",
    "FEISHU_INTERNAL_ENABLED",
    "INDEXNOW_SUBMIT_ENABLED",
    "JINA_BODY_FALLBACK",
    "OCR_RUN_ENABLED",
    "ALLOW_PRIVATE_NETWORK_FETCH",
    "TRUST_PROXY",
  ]) assert.equal(stagingEnv[name], "false", `${name} must remain explicitly disabled`);
  assert.match(serviceBlock(stagingCompose, "worker"), /^    profiles:\n      - manual-worker$/m);
  for (const name of ["setup", "api", "worker", "web"]) {
    assert.match(serviceBlock(stagingCompose, name), /image: aihot-staging:\$\{DEPLOY_SHA:\?Set DEPLOY_SHA in the deployment \.env\}/);
  }
});


