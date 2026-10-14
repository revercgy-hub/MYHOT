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

const safeLanWebEnv = {
  LOCAL_PREVIEW_ENABLED: "true",
  LOCAL_PREVIEW_LAN_ENABLED: "true",
  NODE_ENV: "development",
  SITE_URL: "http://192.168.3.47:3000",
  API_BASE_URL: "http://127.0.0.1:3001",
  WEB_HOST: "0.0.0.0",
  WEB_PORT: "3000",
  DATABASE_URL: "postgres://postgres@127.0.0.1:5432/fiscalhot_preview_test",
  COLLECT_ENABLED: "false",
  MODEL_CALLS_ENABLED: "false",
  JINA_BODY_FALLBACK: "false",
  INDEXNOW_SUBMIT_ENABLED: "false",
  FEISHU_CONTENT_PUSH_ENABLED: "false",
  FEISHU_INTERNAL_ENABLED: "false",
  ALLOW_PRIVATE_NETWORK_FETCH: "false",
};

test("local preview remains off by default and accepts only loopback server addresses", () => {
  assert.equal(resolveLocalPreviewEnabled({}), false);
  assert.equal(resolveLocalPreviewEnabled(safeWebEnv), true);
  assert.throws(() => resolveLocalPreviewEnabled({ ...safeWebEnv, NODE_ENV: "production" }), /forbidden in production/);
  assert.throws(() => resolveLocalPreviewEnabled({ ...safeWebEnv, SITE_URL: "https://fiscal.example" }), /loopback SITE_URL/);
  assert.throws(() => resolveLocalPreviewEnabled({ ...safeWebEnv, API_BASE_URL: "http://api:3001" }), /loopback API_BASE_URL/);
  assert.throws(() => resolveLocalPreviewEnabled({ ...safeWebEnv, WEB_HOST: "0.0.0.0" }), /loopback WEB_HOST/);
  assert.throws(() => resolveLocalPreviewEnabled({ ...safeWebEnv, SITE_URL: "http://192.168.3.47:3000", WEB_HOST: "0.0.0.0" }), /loopback SITE_URL/);
});

test("LAN local preview needs its explicit opt-in and keeps the database, SSR API, and side effects local", () => {
  assert.equal(resolveLocalPreviewEnabled(safeLanWebEnv), true);
  assert.throws(() => resolveLocalPreviewEnabled({ ...safeLanWebEnv, LOCAL_PREVIEW_ENABLED: "false" }), /requires LOCAL_PREVIEW_ENABLED=true/);
  assert.throws(() => resolveLocalPreviewEnabled({ ...safeLanWebEnv, NODE_ENV: "production" }), /forbidden in production/);
  assert.throws(() => resolveLocalPreviewEnabled({ ...safeLanWebEnv, SITE_URL: "http://8.8.8.8:3000" }), /private IPv4 SITE_URL/);
  assert.throws(() => resolveLocalPreviewEnabled({ ...safeLanWebEnv, SITE_URL: "http://192.168.3.47:3001" }), /private IPv4 SITE_URL/);
  assert.throws(() => resolveLocalPreviewEnabled({ ...safeLanWebEnv, SITE_URL: "http://192.168.3.47:3000/path" }), /private IPv4 SITE_URL/);
  assert.throws(() => resolveLocalPreviewEnabled({ ...safeLanWebEnv, API_BASE_URL: "http://192.168.3.47:3001" }), /loopback API_BASE_URL/);
  assert.throws(() => resolveLocalPreviewEnabled({ ...safeLanWebEnv, WEB_HOST: "192.168.3.47" }), /WEB_HOST=0.0.0.0/);
  assert.throws(() => resolveLocalPreviewEnabled({ ...safeLanWebEnv, WEB_PORT: "3002" }), /WEB_PORT=3000/);
  assert.throws(() => resolveLocalPreviewEnabled({ ...safeLanWebEnv, DATABASE_URL: "postgres://postgres@192.168.3.47:5432/fiscalhot_preview_test" }), /exact loopback fiscalhot_preview_test/);
  assert.throws(() => resolveLocalPreviewEnabled({ ...safeLanWebEnv, DEV_AUTH_ROLE: "admin" }), /DEV_AUTH_\*/);
  assert.throws(() => resolveLocalPreviewEnabled({ ...safeLanWebEnv, MODEL_CALLS_ENABLED: "true" }), /MODEL_CALLS_ENABLED=false/);
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
    "local-preview-mof-zhejiang-real-funds",
    "local-preview-mof-zhejiang-transfer-performance",
    "local-preview-mof-zhejiang-fiscal-supervision-202608",
    "local-preview-pboc-omo-189",
    "local-preview-mof-debt-202607",
    "local-preview-mof-xiamen-inclusive-finance",
    "local-preview-mof-fujian-vat-refund-review",
    "local-preview-mof-zhejiang-cpa-law",
    "local-preview-mof-lottery-funds-rules",
    "local-preview-mof-guangxi-accounting-checks",
    "local-preview-mof-hainan-fiscal-management",
    "local-preview-mof-sichuan-budget-monitoring",
    "local-preview-mof-lottery-2025-sales",
    "local-preview-mof-lottery-game-closures",
    "local-preview-pboc-omo-196",
    "local-preview-shanxi-accounting-inspection-2026",
    "local-preview-shanxi-zero-based-budget",
    "local-preview-zhejiang-budget-execution-joint-supervision",
    "local-preview-anhui-special-bonds-2026-batch-9",
    "local-preview-jilin-transfer-payment-performance-loop",
    "local-preview-hunan-state-finance-capital-registration",
    "local-preview-guangdong-central-transfer-supervision",
    "local-preview-dalian-three-guarantees-monitoring",
    "local-preview-xlrwn948i42p6lbi1d1y8eikq",
    "local-preview-swnlrxg3no7zvr7052h992p5x",
    "local-preview-vu1mrn37ph9hriaon9684ea6j",
    "local-preview-e6es8kyasp2l8ad52cgkgx9qp",
    "local-preview-ewiu4lkg7i33olsbgd1x9lcwc",
    "local-preview-fujj4bx366umeljostdaws698",
    "local-preview-j5i5az5u8iuket3cslkxlkgq1",
    "local-preview-gef2vpls83h85b2c83o8fnlmt",
    "local-preview-oywkrh333bn0hxlhfsm7pjm5o",
    "local-preview-kr9s99q6vyucu4m38n7l50qa4",
    "local-preview-ektkjakgwgqg7tuis2mm6pv9w",
    "local-preview-n8nnkqjua32kaswzm5mmbfl0v",
    "local-preview-oiqcqwfsniamp70mzsk5gmpls",
    "local-preview-px2fqcrm4px0xq249n82yi9t4",
    "local-preview-ddnk7nkwwiyhkwl9t3r22x0al",
    "local-preview-vbkawm7m8izokp7k6jttwf05v",
    "local-preview-aosixdekxw78xgtxarnrhcfyi",
    "local-preview-ukqu31m5j0rauy7wu69mhjgrv",
    "local-preview-v6lm8um8188rn6k1vra5fzyzn",
    "local-preview-b0kvpev8vj8jakulbky07v8ob",
    "local-preview-q1ztd2w8qe42q0mlfwnweb5ya",
    "local-preview-w2lu0aoru9j93a0j0pw121ufe",
    "local-preview-wx4k8brv7nyil4l41r8drgy17",
    "local-preview-sxqkd3domfod5qdgkm35gwdys",
    "local-preview-ylutigzgsep8kq0vcg5vrrap0",
    "local-preview-v3mgzkgko9kob778zg8rt4vpo",
    "local-preview-tv2xhdubccz7vup6vb5g2ap92",
    "local-preview-f8bp7vt0h3b1n6qzib5fxlr2x",
    "local-preview-g4si0n85kvecp4lbaqt9hz599",
    "local-preview-cphmuf1hx0eboqeswtiiazu5q",
    "local-preview-luna-cifomaa7avwqodozefwe79hn7",
    "local-preview-luna-inpgk81jtbkc79h4u5nmx6dyl",
    "local-preview-luna-no0f0gyhmml83o386b06t99fp",
    "local-preview-luna-ss2xzkxmn9jv0dc2x5eqle5mz",
    "local-preview-luna-vynkluz0lhfrxo8xkm0iauymb",
    "local-preview-luna-yxh1bxed0k1v3e8wm08dc6bep",
  ];
  assert.equal(allowed.length, 65);
  assert.equal(new Set(allowed).size, allowed.length);
  assert.doesNotThrow(() => assertLocalPreviewIds(allowed, allowed));
  assert.throws(() => assertLocalPreviewIds(["local-preview-unknown"], allowed), /outside the fixed sample allow-list/);
  for (const id of allowed) assert.equal(isLocalPreviewArticleId(id), true, `${id} should receive preview labeling`);
  assert.equal(isLocalPreviewArticleId("local-preview-unknown"), false);
});
