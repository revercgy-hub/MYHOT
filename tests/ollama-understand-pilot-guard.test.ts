import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertUnderstandPilotDatabaseUrl,
  assertUnderstandPilotRuntimeIdentity,
  createUnderstandPilotFetchGuard,
  UNDERSTAND_PILOT_CONSTANTS,
  UnderstandPilotGuardError,
} from "../scripts/fiscal/ollama-understand-pilot-guard.mjs";

const endpoint = `${UNDERSTAND_PILOT_CONSTANTS.baseUrl}/chat/completions`;
const key = "test-only-local-key";
const structure = { category: null, tags: [], subjects: [], fact: null };
const understand = { itemType: "policy", authorRole: "principal", tags: [], editorialJudgment: "依据正文信息", titleZh: "测试标题", summaryZh: "测试摘要" };
type PilotRequest = [string, { method: string; headers: Record<string, string>; body: string }];

function request({
  index = 0,
  url = endpoint,
  auth = `Bearer ${key}`,
  max_tokens = index % 2 === 0 ? 800 : 16_384,
  reasoning_effort = "none",
  stream,
}: {
  index?: number;
  url?: string;
  auth?: string;
  max_tokens?: number;
  reasoning_effort?: string;
  stream?: boolean;
} = {}): PilotRequest {
  const body = {
    model: UNDERSTAND_PILOT_CONSTANTS.model,
    max_tokens,
    reasoning_effort,
    stream,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: "fixture" }],
  };
  return [url, { method: "POST", headers: { authorization: auth, "content-type": "application/json" }, body: JSON.stringify(body) }];
}

function validResponse(index: number): Response {
  const content = JSON.stringify(index % 2 === 0 ? structure : understand);
  return new Response(JSON.stringify({
    id: `fixture-${index}`,
    choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 2, completion_tokens: 2 },
  }), { status: 200, headers: { "content-type": "application/json" } });
}

test("accepts only the isolated NAS loopback test database", () => {
  assert.equal(assertUnderstandPilotDatabaseUrl("postgres://postgres@127.0.0.1:55433/fiscalhot_ollama_understand_20261027_test").pathname,
    "/fiscalhot_ollama_understand_20261027_test");
  for (const url of [
    "postgres://postgres@127.0.0.1:55432/fiscalhot_ollama_understand_20261027_test",
    "postgres://postgres@127.0.0.1:55433/fiscalhot_staging",
    "postgres://postgres@192.168.3.100:55433/fiscalhot_ollama_understand_20261027_test",
    "postgres://postgres@127.0.0.1:5432/fiscalhot_ollama_understand_20261027_test",
    "postgres://user:secret@127.0.0.1:55433/fiscalhot_ollama_understand_20261027_test",
    "postgres://postgres@127.0.0.1:55433/fiscalhot_ollama_understand_20261027_test?sslmode=require",
  ]) assert.throws(() => assertUnderstandPilotDatabaseUrl(url), UnderstandPilotGuardError);
});

test("requires Docker identity marker, generated hostname, and exact container ID", () => {
  const id = "a".repeat(64);
  assert.deepEqual(assertUnderstandPilotRuntimeIdentity({
    dockerEnvExists: true, hostname: "fiscal-understand-test-1027", expectedContainerId: id, markerContainerId: id,
  }), { hostname: "fiscal-understand-test-1027", containerId: id });
  for (const bad of [
    { dockerEnvExists: false, hostname: "fiscal-understand-test-1027", expectedContainerId: id, markerContainerId: id },
    { dockerEnvExists: true, hostname: "api", expectedContainerId: id, markerContainerId: id },
    { dockerEnvExists: true, hostname: "fiscal-understand-test-1027", expectedContainerId: "fake", markerContainerId: id },
    { dockerEnvExists: true, hostname: "fiscal-understand-test-1027", expectedContainerId: id, markerContainerId: "b".repeat(64) },
  ]) assert.throws(() => assertUnderstandPilotRuntimeIdentity(bad), UnderstandPilotGuardError);
});

test("passes only the actual serial structure and understand token caps to the exact LAN endpoint", async () => {
  let hits = 0;
  let redirect: string | undefined;
  const guard = createUnderstandPilotFetchGuard({
    apiKey: key,
    nativeFetch: async (_input, init) => { redirect = init?.redirect; return validResponse(hits++); },
  });
  for (let i = 0; i < UNDERSTAND_PILOT_CONSTANTS.expectedCalls; i += 1) {
    const expected = validResponse(i);
    const [url, init] = request({ index: i });
    const got = await guard(url, init);
    assert.equal(got.status, 200);
    await got.arrayBuffer();
    assert.notEqual(expected, got);
  }
  assert.equal(hits, 8);
  assert.equal(redirect, "manual");
  assert.equal(guard.stats.requests, 8);
  assert.equal(guard.stats.inFlight, 0);
  assert.equal(guard.stats.requestCap, 12);
  assert.equal(guard.stats.expectedCalls, 8);
  assert.equal(guard.stats.requestStartedAtEpochMs.length, 8);
  await assert.rejects(guard(...request({ index: 8 })), /stage or token cap rejected/u);
});

test("blocks wrong hosts, credentials, model, cap, reasoning settings and stream before network access", async () => {
  let hits = 0;
  const guard = createUnderstandPilotFetchGuard({ apiKey: key, nativeFetch: async () => { hits += 1; return validResponse(0); } });
  for (const [url, init] of [
    request({ url: "https://api.openai.com/v1/chat/completions" }),
    request({ auth: "Bearer other-key" }),
    request({ max_tokens: 1024 }),
    request({ reasoning_effort: "low" }),
    request({ stream: true }),
  ]) await assert.rejects(guard(url, init), UnderstandPilotGuardError);
  assert.equal(hits, 0);
});

test("blocks reasoning fields, tagged thinking, untagged preambles, malformed and extra-key JSON before receipt storage", async () => {
  const responses = [
    { choices: [{ message: { content: JSON.stringify(structure), reasoning_content: "private chain" } }] },
    { choices: [{ message: { content: `{"category":null,"tags":[],"subjects":[],"fact":null,"thinking":"secret"}` } }] },
    { choices: [{ message: { content: JSON.stringify({ ...structure, category: "<think>unfinished" }) } }] },
    { choices: [{ message: { content: `preamble\n${JSON.stringify(structure)}` } }] },
    { choices: [{ message: { content: "{ broken json" } }] },
    { choices: [{ message: { content: JSON.stringify({ ...understand, private_note: "secret" }) } }] },
  ];
  for (const responseBody of responses) {
    const guard = createUnderstandPilotFetchGuard({ apiKey: key, nativeFetch: async () => new Response(JSON.stringify(responseBody), { status: 200 }) });
    const [url, init] = request();
    await assert.rejects(guard(url, init), (error) => {
      assert.ok(error instanceof UnderstandPilotGuardError);
      assert.doesNotMatch(error.message, /private chain|secret|unfinished/u);
      return true;
    });
  }
});

test("suppresses HTTP error bodies while preserving status for chatJson", async () => {
  const guard = createUnderstandPilotFetchGuard({
    apiKey: key,
    nativeFetch: async () => new Response("raw provider diagnostic", { status: 429, statusText: "Too Many Requests" }),
  });
  const response = await guard(...request());
  const text = await response.text();
  assert.equal(response.status, 429);
  assert.match(text, /body suppressed/u);
  assert.doesNotMatch(text, /raw provider diagnostic/u);
});

test("rejects overlapping requests before a second provider call", async () => {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  const guard = createUnderstandPilotFetchGuard({ apiKey: key, nativeFetch: async () => { await held; return validResponse(0); } });
  const first = guard(...request({ index: 0 }));
  await assert.rejects(guard(...request({ index: 1 })), /Concurrent provider requests/u);
  release();
  await first;
  assert.equal(guard.stats.requests, 1);
});

test("scheduled deadline refuses a request without its full stage timeout remaining", async () => {
  let hits = 0;
  const now = 1_000_000;
  const guard = createUnderstandPilotFetchGuard({
    apiKey: key,
    now: () => now,
    deadlineEpochMs: now + UNDERSTAND_PILOT_CONSTANTS.stageTimeoutMs.structure - 1,
    nativeFetch: async () => { hits += 1; return validResponse(0); },
  });
  await assert.rejects(guard(...request({ index: 0 })), /enough time for this request/u);
  assert.equal(hits, 0);
  assert.equal(guard.stats.requests, 0);
});

test("deadline abort is combined with the stage timeout signal without replacing it", async () => {
  const controller = new AbortController();
  const now = 1_000_000;
  let combinedSignal: AbortSignal | undefined;
  const guard = createUnderstandPilotFetchGuard({
    apiKey: key,
    now: () => now,
    deadlineEpochMs: now + UNDERSTAND_PILOT_CONSTANTS.stageTimeoutMs.structure,
    nativeFetch: async (_input, init) => {
      combinedSignal = init?.signal as AbortSignal;
      assert.notEqual(combinedSignal, controller.signal);
      controller.abort();
      assert.equal(combinedSignal.aborted, true);
      return validResponse(0);
    },
  });
  const [url, init] = request({ index: 0 });
  const withTimeout = { ...init, signal: controller.signal };
  await guard(url, withTimeout);
  assert.equal(guard.stats.requests, 1);
  assert.deepEqual(guard.stats.requestStartedAtEpochMs, [now]);
});
