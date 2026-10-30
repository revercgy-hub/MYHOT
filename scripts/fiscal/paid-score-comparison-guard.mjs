import { createHash } from "node:crypto";
import { DimensionScoreSchema } from "../../packages/backend/src/editorial/dimension-score.ts";

const ENDPOINT = "https://api.deepseek.com/v1/chat/completions";
const hash = value => createHash("sha256").update(value).digest("hex");
const hex = value => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const fail = message => { throw new Error(`Paid comparison: ${message}`); };

/** One approved development batch. Every failed dispatch closes the guard; reservations are never released. */
export function createPaidScoreComparisonGuard({ apiKey, systemSha256, casePlan, pricingVerifiedAt,
  beforeDispatch, nativeFetch = globalThis.fetch.bind(globalThis), now = Date.now }) {
  const verified = Date.parse(pricingVerifiedAt);
  if (!apiKey || !hex(systemSha256) || !Array.isArray(casePlan) || casePlan.length !== 10 ||
      typeof beforeDispatch !== "function" || !Number.isFinite(verified) || verified > now() || now() - verified > 4 * 3600000) fail("approved scope or fresh pricing required");
  const allowed = new Map();
  let wholeRunMicroCny = 0;
  for (const row of casePlan) {
    if (!hex(row.userSha256) || allowed.has(row.userSha256) || row.calls !== 2 || row.maxOutputTokensPerCall !== 1024 ||
        !Number.isSafeInteger(row.inputTokenConservativeUpperPerCall) || row.inputTokenConservativeUpperPerCall < 4096) fail("invalid ten-case reservation");
    const microCny = row.inputTokenConservativeUpperPerCall * 2 + 1024 * 8;
    wholeRunMicroCny += microCny * 2;
    allowed.set(row.userSha256, { ...row, microCny, callsMade: 0 });
  }
  if (wholeRunMicroCny > 5000000) fail("whole-run reservation exceeds 5 CNY");
  let requests = 0, inFlight = 0, halted = false, reservedMicroCny = 0;
  const started = now();
  const guarded = async (input, init = {}) => {
    if (halted || inFlight || requests >= 20 || now() - started > 3600000 || now() - verified > 4 * 3600000) fail("closed, concurrent or exhausted batch");
    if (input !== ENDPOINT || init.method !== "POST" || typeof init.body !== "string" || !init.signal) fail("endpoint, method or timeout rejected");
    if (new Headers(init.headers).get("authorization") !== `Bearer ${apiKey}`) fail("credential mismatch");
    let body;
    try { body = JSON.parse(init.body); } catch { fail("request JSON rejected"); }
    const keys = ["model", "messages", "temperature", "max_tokens", "response_format", "thinking"];
    if (!body || Object.keys(body).some(key => !keys.includes(key)) || body.model !== "deepseek-flash" || body.temperature !== 0 ||
        body.max_tokens !== 1024 || body.response_format?.type !== "json_object" || Object.keys(body.response_format).length !== 1 ||
        body.thinking?.type !== "disabled" || Object.keys(body.thinking).length !== 1 || !Array.isArray(body.messages) || body.messages.length !== 2 ||
        body.messages[0]?.role !== "system" || body.messages[1]?.role !== "user" || body.messages.some(m => typeof m.content !== "string" || Object.keys(m).some(k => !["role", "content"].includes(k)))) fail("model, sampling or output scope rejected");
    const [system, user] = body.messages.map(m => m.content), userSha256 = hash(user), row = allowed.get(userSha256);
    if (hash(system) !== systemSha256 || !row || row.callsMade >= 2 ||
        Buffer.byteLength(system) + Buffer.byteLength(user) + 4096 !== row.inputTokenConservativeUpperPerCall) fail("frozen input differs");
    if (reservedMicroCny + row.microCny > wholeRunMicroCny) fail("reservation exhausted");
    // Synchronous durable claim must succeed before the transport can run.
    beforeDispatch({ request: requests + 1, userSha256, round: row.callsMade + 1, reservedMicroCny: row.microCny });
    requests++; row.callsMade++; reservedMicroCny += row.microCny; inFlight++;
    try {
      const response = await nativeFetch(input, { ...init, redirect: "error" });
      if (!response.ok || !/application\/json/iu.test(response.headers.get("content-type") ?? "")) fail("provider response rejected; body suppressed");
      const reader = response.body?.getReader(); if (!reader) fail("empty response");
      const chunks = []; let size = 0;
      for (;;) {
        const next = await reader.read(); if (next.done) break;
        size += next.value.byteLength;
        if (size > 1024 * 1024) { await reader.cancel(); fail("response byte cap exceeded"); }
        chunks.push(Buffer.from(next.value));
      }
      const raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!["deepseek-flash", "deepseek-v4.1-flash-1017", "DeepSeek-V4.1-Flash-1017"].includes(raw.model) ||
          !Array.isArray(raw.choices) || raw.choices.length !== 1 || raw.choices[0].finish_reason !== "stop" ||
          raw.choices[0].message?.role !== "assistant" || raw.choices[0].message.reasoning_content || raw.choices[0].message.tool_calls) fail("unexpected model, reasoning, tools or incomplete final answer");
      const score = DimensionScoreSchema.parse(JSON.parse(raw.choices[0].message.content)), usage = raw.usage;
      if (!usage || ["prompt_tokens", "completion_tokens", "total_tokens"].some(k => !Number.isSafeInteger(usage[k]) || usage[k] < 0) ||
          usage.prompt_tokens > row.inputTokenConservativeUpperPerCall || usage.completion_tokens > 1024 ||
          usage.total_tokens !== usage.prompt_tokens + usage.completion_tokens) fail("usage exceeds reserved bounds");
      const safe = { model: raw.model, choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(score) } }],
        usage: Object.fromEntries(["prompt_tokens", "completion_tokens", "total_tokens"].map(k => [k, usage[k]])) };
      if (typeof raw.id === "string" && /^[A-Za-z0-9_.:-]{1,200}$/u.test(raw.id)) safe.id = raw.id;
      return Response.json(safe);
    } catch { halted = true; fail("dispatch failed or response invalid; no retry, reservation retained"); }
    finally { inFlight--; }
  };
  Object.defineProperty(guarded, "stats", { get: () => ({ requests, inFlight, halted, wholeRunMicroCny, reservedMicroCny }) });
  return guarded;
}
