import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { createThinkingDiagnosticGuard } from "../scripts/fiscal/ollama-thinking-diagnostic-guard.mjs";

const hash = s => createHash("sha256").update(s).digest("hex"), model = "fiscalhot-diag-qwen35-9b-think-ctx32768-20261030:latest";
const users = ["case-a", "case-b", "case-c", "case-d"], url = "http://192.168.3.100:11435/v1/chat/completions";
const score = { itemType: "local_practice", dimensions: { sig: 4, nov: 5, cred: 8, reson: 9, act: 7 } };
const request = (user = users[0], overrides = {}) => ({ method: "POST", headers: { Authorization: "Bearer fixture" }, body: JSON.stringify({
  model, messages: [{ role: "system", content: "frozen-system" }, { role: "user", content: user }], temperature: 1, top_p: 0.95,
  presence_penalty: 1.5, max_tokens: 4096, response_format: { type: "json_object" }, reasoning_effort: "low", ...overrides,
}) });
const response = (overrides = {}) => Response.json({ model, choices: [{ finish_reason: "stop", message: {
  role: "assistant", content: JSON.stringify(score), reasoning: "PRIVATE_TRACE_NOT_FOR_STORAGE",
} }], usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 }, unknown: "PRIVATE_TRACE_NOT_FOR_STORAGE", ...overrides });
const guard = nativeFetch => createThinkingDiagnosticGuard({ apiKey: "fixture", expectedModel: model, systemSha256: hash("frozen-system"), userSha256s: users.map(hash), nativeFetch });

test("thinking diagnostic stores only validated final axes and numeric usage before receipt handling", async () => {
  const fetch = guard(async (_url, init) => { assert.equal(init.redirect, "manual"); return response(); });
  const res = await fetch(url, request()), text = await res.text();
  assert.equal(text.includes("PRIVATE_TRACE_NOT_FOR_STORAGE"), false);
  assert.deepEqual(JSON.parse(JSON.parse(text).choices[0].message.content), score);
  assert.deepEqual(fetch.stats, { requests: 1, inFlight: 0, finalResponses: 1, reasoningOmitted: 1 });
});

test("thinking diagnostic rejects scope drift and permits only two planned calls per frozen input", async () => {
  let calls = 0; const fetch = guard(async () => { calls += 1; return response(); });
  for (const bad of [request("unapproved"), request(users[0], { model: "cloud-model" }), request(users[0], { max_tokens: 8192 }),
    request(users[0], { reasoning_effort: "none" }), request(users[0], { tools: [] })]) await assert.rejects(fetch(url, bad));
  await assert.rejects(fetch("https://example.org/v1/chat/completions", request()));
  assert.equal(calls, 0);
  for (const user of users) { await fetch(url, request(user)); await fetch(url, request(user)); }
  await assert.rejects(fetch(url, request())); assert.equal(calls, 8);
});

test("thought-bearing malformed or truncated final output never reaches raw receipts", async () => {
  for (const bad of [response({ choices: [{ finish_reason: "length", message: { role: "assistant", content: JSON.stringify(score), reasoning: "PRIVATE_TRACE" } }] }),
    response({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: "PRIVATE_TRACE" } }] }),
    response({ usage: { prompt_tokens: 100, completion_tokens: 4097, total_tokens: 4197 } })]) {
    await assert.rejects(guard(async () => bad)(url, request()), error => !error.message.includes("PRIVATE_TRACE"));
  }
  const fetch = guard(async () => new Response("PRIVATE_TRACE", { status: 500 }));
  assert.equal((await (await fetch(url, request())).text()).includes("PRIVATE_TRACE"), false);
  const stream = new ReadableStream({ start(controller) { controller.error(new Error("PRIVATE_TRACE")); } });
  await assert.rejects(guard(async () => new Response(stream, { headers: { "content-type": "application/json" } }))(url, request()), error => !error.message.includes("PRIVATE_TRACE"));
});

test("thinking diagnostic cannot run concurrent calls", async () => {
  let release; const pending = new Promise(resolve => { release = resolve; });
  const fetch = guard(async () => { await pending; return response(); });
  const first = fetch(url, request());
  await assert.rejects(fetch(url, request(users[1])), /concurrency/u); release(); await first;
});
