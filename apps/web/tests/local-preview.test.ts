import assert from "node:assert/strict";
import test from "node:test";
import { isLocalPreviewArticleId, resolveLocalPreviewEnabled } from "../app/lib/local-preview.server.ts";
import { assertLocalPreviewIds, prepareLocalPreviewSeedEnvironment } from "../../../scripts/lib/local-preview-safety.ts";

const safeWebEnv = {
  LOCAL_PREVIEW_ENABLED: "true",
  NODE_ENV: "development",
  SITE_URL: "http://127.0.0.1:3000",
  API_BASE_URL: "http://127.0.0.1:3001",
  WEB_HOST: "127.0.0.1",
};

test("local preview remains off by default and accepts only loopback server addresses", () => {
  assert.equal(resolveLocalPreviewEnabled({}), false);
  assert.equal(resolveLocalPreviewEnabled(safeWebEnv), true);
  assert.throws(() => resolveLocalPreviewEnabled({ ...safeWebEnv, NODE_ENV: "production" }), /forbidden in production/);
  assert.throws(() => resolveLocalPreviewEnabled({ ...safeWebEnv, SITE_URL: "https://fiscal.example" }), /loopback SITE_URL/);
  assert.throws(() => resolveLocalPreviewEnabled({ ...safeWebEnv, API_BASE_URL: "http://api:3001" }), /loopback API_BASE_URL/);
  assert.throws(() => resolveLocalPreviewEnabled({ ...safeWebEnv, WEB_HOST: "0.0.0.0" }), /loopback WEB_HOST/);
});

test("local preview seed fills unset safe flags and accepts only the isolated loopback test DB", () => {
  const env: Record<string, string | undefined> = { DATABASE_URL: "postgres://postgres@127.0.0.1:5432/fiscalhot_preview_test" };
  const result = prepareLocalPreviewSeedEnvironment(env);
  assert.equal(result.database, "fiscalhot_preview_test");
  assert.ok(Object.values(result.safetyFlags).every((flag) => flag === "false"));
  assert.equal(env.COLLECT_ENABLED, "false");
  assert.equal(env.MODEL_CALLS_ENABLED, "false");
  assert.equal(env.FEISHU_CONTENT_PUSH_ENABLED, "false");
  assert.equal(env.FEISHU_INTERNAL_ENABLED, "false");

  for (const DATABASE_URL of [
    "postgres://postgres@127.0.0.1:5432/fiscalhot_test",
    "postgres://postgres@localhost:5432/fiscalhot_preview_test",
    "postgres://postgres@127.0.0.1:5433/fiscalhot_preview_test",
    "postgres://user:pass@127.0.0.1:5432/fiscalhot_preview_test",
    "postgres://postgres:password@127.0.0.1:5432/fiscalhot_preview_test",
    "postgres://postgres@127.0.0.1:5432/fiscalhot_preview_test?sslmode=require",
  ]) {
    assert.throws(() => prepareLocalPreviewSeedEnvironment({ DATABASE_URL }), /only accepts postgres@127\.0\.0\.1:5432\/fiscalhot_preview_test/);
  }
});

test("local preview seed refuses production, development auth and any enabled side-effect flag", () => {
  const base = { DATABASE_URL: "postgres://postgres@127.0.0.1:5432/fiscalhot_preview_test" };
  assert.throws(() => prepareLocalPreviewSeedEnvironment({ ...base, NODE_ENV: "production" }), /forbidden in production/);
  assert.throws(() => prepareLocalPreviewSeedEnvironment({ ...base, DEV_AUTH_ROLE: "admin" }), /DEV_AUTH_\*/);
  assert.throws(() => prepareLocalPreviewSeedEnvironment({ ...base, COLLECT_ENABLED: "true" }), /COLLECT_ENABLED=false/);
  assert.throws(() => prepareLocalPreviewSeedEnvironment({ ...base, MODEL_CALLS_ENABLED: "true" }), /MODEL_CALLS_ENABLED=false/);
  assert.throws(() => prepareLocalPreviewSeedEnvironment({ ...base, FEISHU_EXTRA_ENABLED: "true" }), /FEISHU_EXTRA_ENABLED=false/);
});

test("local preview namespace requires an exact sample allow-list", () => {
  const allowed = [
    "local-preview-pboc-omo-191",
    "local-preview-mof-budget-qa",
    "local-preview-pboc-xiamen-payment",
    "local-preview-pboc-omo-192",
    "local-preview-mof-debt-202608",
    "local-preview-mof-xiamen-capital-review",
  ];
  assert.doesNotThrow(() => assertLocalPreviewIds(allowed, allowed));
  assert.throws(() => assertLocalPreviewIds(["local-preview-unknown"], allowed), /outside the fixed sample allow-list/);
  for (const id of allowed) assert.equal(isLocalPreviewArticleId(id), true, `${id} should receive preview labeling`);
  assert.equal(isLocalPreviewArticleId("local-preview-unknown"), false);
});
