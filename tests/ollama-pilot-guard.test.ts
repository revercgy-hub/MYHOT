import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertPilotDatabaseUrl,
  createOllamaPilotFetchGuard,
  OLLAMA_PILOT_CONSTANTS,
  PilotGuardError,
} from "../scripts/fiscal/ollama-pilot-guard.mjs";

const endpoint = `${OLLAMA_PILOT_CONSTANTS.baseUrl}/chat/completions`;
const key = "test-only-local-key";

type PilotRequest = [string, { method: string; headers: Record<string, string>; body: string }];

function request({
  url = endpoint,
  method = "POST",
  auth = `Bearer ${key}`,
  model = OLLAMA_PILOT_CONSTANTS.model,
  max_tokens = 512,
  reasoning_effort = "none",
  stream,
  omitReasoning = false,
}: {
  url?: string;
  method?: string;
  auth?: string;
  model?: string;
  max_tokens?: number;
  reasoning_effort?: string;
  stream?: boolean;
  omitReasoning?: boolean;
} = {}): PilotRequest {
  const body: Record<string, unknown> = { model, max_tokens, reasoning_effort, stream, messages: [{ role: "user", content: "fixture" }] };
  if (omitReasoning) delete body.reasoning_effort;
  return [url, {
    method,
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify(body),
  }];
}

const validResponse = () => new Response(JSON.stringify({
  id: "fixture-id",
  choices: [{ message: { role: "assistant", content: JSON.stringify({ label: "PASS", reason: "fixture" }) }, finish_reason: "stop" }],
  usage: { prompt_tokens: 1, completion_tokens: 1 },
}), { status: 200, headers: { "content-type": "application/json" } });

test("accepts only the approved disposable database URL", () => {
  assert.equal(assertPilotDatabaseUrl("postgres://127.0.0.1:55432/fiscalhot_ollama_pilot_20261026_test").pathname,
    "/fiscalhot_ollama_pilot_20261026_test");
  for (const url of [
    "postgres://127.0.0.1:55432/fiscalhot",
    "postgres://127.0.0.1:55432/fiscalhot_prod",
    "postgres://192.168.3.100:55432/fiscalhot_ollama_pilot_20261026_test",
    "postgres://127.0.0.1:5432/fiscalhot_ollama_pilot_20261026_test",
    "postgres://127.0.0.1:55432/fiscalhot_ollama_pilot_20261026_test?sslmode=require",
  ]) assert.throws(() => assertPilotDatabaseUrl(url), PilotGuardError);
});

test("allows the exact local endpoint and passes an ordinary response through unchanged", async () => {
  const expected = validResponse();
  let hit = 0;
  let redirectMode: string | undefined;
  const fetch = createOllamaPilotFetchGuard({ apiKey: key, nativeFetch: async (_input, init) => { hit += 1; redirectMode = init?.redirect; return expected; } });
  const got = await fetch(...request());
  assert.equal(hit, 1);
  assert.equal(redirectMode, "manual");
  assert.equal(got, expected);
  assert.deepEqual(fetch.stats, { requests: 1, inFlight: 0 });
});

test("rejects cloud or wrong hosts, wrong models, streaming, wrong auth, and missing reasoning guard before fetch", async () => {
  let hit = 0;
  const fetch = createOllamaPilotFetchGuard({ apiKey: key, nativeFetch: async () => { hit += 1; return validResponse(); } });
  for (const args of [
    request({ url: "https://api.openai.com/v1/chat/completions" }),
    request({ url: "http://192.168.3.100:11435/v1/embeddings" }),
    request({ model: "deepseek-chat" }),
    request({ stream: true }),
    request({ auth: "Bearer other-key" }),
    request({ omitReasoning: true }),
  ]) await assert.rejects(fetch(...args), PilotGuardError);
  assert.equal(hit, 0);
});

test("rejects token caps above the original task parameters before fetch", async () => {
  let hit = 0;
  const fetch = createOllamaPilotFetchGuard({ apiKey: key, nativeFetch: async () => { hit += 1; return validResponse(); } });
  await assert.rejects(fetch(...request({ max_tokens: 4096 })), /token cap rejected/u);
  assert.equal(hit, 0);
});

test("blocks non-empty reasoning fields without returning or retaining their text", async () => {
  const chain = "private hidden reasoning text";
  const fetch = createOllamaPilotFetchGuard({ apiKey: key, nativeFetch: async () => new Response(JSON.stringify({
    choices: [{ message: { content: "{\"label\":\"PASS\",\"reason\":\"fixture\"}", reasoning_content: chain } }],
  }), { status: 200, headers: { "content-type": "application/json" } }) });
  await assert.rejects(fetch(...request()), (error) => {
    assert.ok(error instanceof PilotGuardError);
    assert.doesNotMatch(error.message, /private hidden reasoning text/u);
    return true;
  });
});

test("blocks tagged thinking in otherwise successful text content", async () => {
  for (const content of ["<think>private chain</think>title_zh: title\\nsummary_zh: summary", "<think>private chain without a close tag"]) {
    const fetch = createOllamaPilotFetchGuard({ apiKey: key, nativeFetch: async () => new Response(JSON.stringify({
      choices: [{ message: { content } }],
    }), { status: 200, headers: { "content-type": "application/json" } }) });
    await assert.rejects(fetch(...request({ max_tokens: 2048, reasoning_effort: "none" })), /reasoning field detected/u);
  }
});

test("blocks untagged plain-text reasoning preambles before a summary receipt can retain them", async () => {
  const preamble = "I will reason through the source before drafting.\\ntitle_zh: 标题\\nsummary_zh: 摘要";
  const fetch = createOllamaPilotFetchGuard({ apiKey: key, nativeFetch: async () => new Response(JSON.stringify({
    choices: [{ message: { content: preamble } }],
  }), { status: 200, headers: { "content-type": "application/json" } }) });
  await assert.rejects(fetch(...request({ max_tokens: 2048 })), (error) => {
    assert.ok(error instanceof PilotGuardError);
    assert.doesNotMatch(error.message, /reason through the source/u);
    return true;
  });
});

test("blocks malformed JSON-mode content before chatJson can retain it as a raw receipt", async () => {
  const raw = "reasoning preamble followed by broken JSON {\"label\":\"PASS\"";
  const fetch = createOllamaPilotFetchGuard({ apiKey: key, nativeFetch: async () => new Response(JSON.stringify({
    choices: [{ message: { content: raw } }],
  }), { status: 200, headers: { "content-type": "application/json" } }) });
  const [url, init] = request();
  init.body = JSON.stringify({ ...JSON.parse(init.body), response_format: { type: "json_object" } });
  await assert.rejects(fetch(url, init), (error) => {
    assert.ok(error instanceof PilotGuardError);
    assert.doesNotMatch(error.message, /reasoning preamble/u);
    return true;
  });
});

test("preserves non-2xx status while suppressing the raw provider body", async () => {
  const secretLikeError = "raw provider diagnostic must not enter a receipt";
  const fetch = createOllamaPilotFetchGuard({ apiKey: key, nativeFetch: async () => new Response(secretLikeError, { status: 429, statusText: "Too Many Requests" }) });
  const response = await fetch(...request());
  const body = await response.text();
  assert.equal(response.status, 429);
  assert.equal(response.statusText, "Too Many Requests");
  assert.match(body, /body suppressed/u);
  assert.doesNotMatch(body, /raw provider diagnostic/u);
});

test("rejects overlapping requests and enforces the hard 40-request cap", async () => {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  const fetch = createOllamaPilotFetchGuard({ apiKey: key, nativeFetch: async () => { await held; return validResponse(); } });
  const first = fetch(...request());
  await assert.rejects(fetch(...request()), /Concurrent provider requests/u);
  release();
  await first;

  const serial = createOllamaPilotFetchGuard({ apiKey: key, nativeFetch: async () => validResponse() });
  for (let i = 0; i < 40; i += 1) await serial(...request());
  assert.equal(serial.stats.requests, 40);
  await assert.rejects(serial(...request()), /request cap reached/u);
});
