import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createPaidScoreComparisonGuard } from "../scripts/fiscal/paid-score-comparison-guard.mjs";
const hash = value => createHash("sha256").update(value).digest("hex");
const system = "frozen rubric", users = Array.from({ length: 10 }, (_, i) => `public article ${i}`), endpoint = "https://api.deepseek.com/v1/chat/completions";
const casePlan = users.map(user => ({ userSha256: hash(user), calls: 2, maxOutputTokensPerCall: 1024, inputTokenConservativeUpperPerCall: Buffer.byteLength(system + user) + 4096 }));
const score = { itemType: "local_practice", dimensions: { sig: 4, nov: 5, cred: 8, reson: 9, act: 7 } };
const request = (user = users[0], overrides = {}) => ({ method: "POST", headers: { authorization: "Bearer fixture" }, signal: AbortSignal.timeout(1000), body: JSON.stringify({ model: "deepseek-flash", messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0, max_tokens: 1024, response_format: { type: "json_object" }, thinking: { type: "disabled" }, ...overrides }) });
const answer = (overrides = {}) => Response.json({ model: "deepseek-flash", choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(score) } }], usage: { prompt_tokens: 20, completion_tokens: 40, total_tokens: 60 }, privateField: "DO_NOT_STORE", ...overrides });
const guard = (nativeFetch, overrides = {}) => createPaidScoreComparisonGuard({ apiKey: "fixture", systemSha256: hash(system), casePlan, pricingVerifiedAt: new Date().toISOString(), beforeDispatch: () => {}, nativeFetch, ...overrides });

test("paid comparison reserves the full batch, persists claims before transport, and permits exactly twenty calls", async () => {
  const claims = []; let calls = 0;
  const fetch = guard(async (_url, init) => { calls++; assert.equal(claims.length, calls); assert.equal(init.redirect, "error"); return answer(); }, { beforeDispatch: row => claims.push(row) });
  assert.ok(fetch.stats.wholeRunMicroCny < 5000000);
  for (const user of users) for (let i = 0; i < 2; i++) assert.equal((await (await fetch(endpoint, request(user))).text()).includes("DO_NOT_STORE"), false);
  assert.equal(calls, 20); assert.equal(fetch.stats.reservedMicroCny, fetch.stats.wholeRunMicroCny);
  await assert.rejects(fetch(endpoint, request()));
});
test("paid comparison rejects price staleness, excessive reservation, input or endpoint drift before transport", async () => {
  assert.throws(() => guard(async () => answer(), { pricingVerifiedAt: "2020-01-01" }));
  assert.throws(() => guard(async () => answer(), { casePlan: casePlan.map(r => ({ ...r, inputTokenConservativeUpperPerCall: 500000 })) }));
  let calls = 0; const fetch = guard(async () => { calls++; return answer(); });
  for (const bad of [request("unapproved"), request(users[0], { max_tokens: 2048 }), request(users[0], { tools: [] }), request(users[0], { thinking: { type: "enabled" } })]) await assert.rejects(fetch(endpoint, bad));
  await assert.rejects(fetch("https://example.com", request())); assert.equal(calls, 0);
  const claimFailure = guard(async () => { calls++; return answer(); }, { beforeDispatch: () => { throw Error("claim exists"); } });
  await assert.rejects(claimFailure(endpoint, request())); assert.equal(calls, 0);
});
test("paid comparison retains failed request reservation and prevents every retry without leaking response errors", async () => {
  for (const native of [async () => { throw Error("PRIVATE_KEY"); }, async () => new Response("PRIVATE_KEY", { status: 429 }),
    async () => answer({ usage: { prompt_tokens: 20, completion_tokens: 1025, total_tokens: 1045 } }),
    async () => answer({ choices: [{ finish_reason: "length", message: { role: "assistant", content: JSON.stringify(score) } }] })]) {
    let calls = 0; const fetch = guard(async (...args) => { calls++; return native(...args); });
    await assert.rejects(fetch(endpoint, request()), error => !error.message.includes("PRIVATE_KEY"));
    await assert.rejects(fetch(endpoint, request(users[1]))); assert.equal(calls, 1); assert.ok(fetch.stats.reservedMicroCny > 0); assert.equal(fetch.stats.halted, true);
  }
});
test("paid comparison rejects parallel dispatches and unexpected thinking output", async () => {
  let release; const wait = new Promise(resolve => { release = resolve; }); const fetch = guard(async () => { await wait; return answer(); });
  const first = fetch(endpoint, request()); await assert.rejects(fetch(endpoint, request(users[1]))); release(); await first;
  const thinking = guard(async () => answer({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(score), reasoning_content: "PRIVATE_THOUGHT" } }] }));
  await assert.rejects(thinking(endpoint, request()), error => !error.message.includes("PRIVATE_THOUGHT"));
});
