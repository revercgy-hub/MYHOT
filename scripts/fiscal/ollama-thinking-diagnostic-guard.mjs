import { createHash } from "node:crypto";
import { DimensionScoreSchema } from "../../packages/backend/src/editorial/dimension-score.ts";

const ENDPOINT = "http://192.168.3.100:11435/v1/chat/completions";
const MAX_CALLS = 8;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const sha = (value) => createHash("sha256").update(value).digest("hex");
const hex = (value) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
export class ThinkingDiagnosticGuardError extends Error {}
const fail = (message) => { throw new ThinkingDiagnosticGuardError(message); };

/** Separate, development-only protocol. The existing no-thinking pilot guard is unchanged. */
export function createThinkingDiagnosticGuard({ apiKey, expectedModel, systemSha256, userSha256s, nativeFetch = globalThis.fetch.bind(globalThis) }) {
  if (!apiKey || !/^fiscalhot-diag-qwen35-9b-think-ctx32768-\d{8}:latest$/u.test(expectedModel ?? "") ||
      !hex(systemSha256) || !Array.isArray(userSha256s) || userSha256s.length !== 4 ||
      userSha256s.some(value => !hex(value)) || new Set(userSha256s).size !== 4) fail("Exact four-case local thinking diagnostic scope required");
  const allowed = new Map(userSha256s.map(hash => [hash, 0]));
  let requests = 0, inFlight = 0, finalResponses = 0, reasoningOmitted = 0;
  const began = Date.now();
  const guarded = async (input, init = {}) => {
    if (typeof input !== "string" || input !== ENDPOINT || init.method !== "POST" || typeof init.body !== "string") fail("Diagnostic endpoint or method rejected");
    const headers = new Headers(init.headers);
    if (headers.get("authorization") !== `Bearer ${apiKey}`) fail("Diagnostic authorization rejected");
    let body;
    try { body = JSON.parse(init.body); } catch { fail("Diagnostic request JSON rejected"); }
    if (!body || typeof body !== "object" || Array.isArray(body)) fail("Diagnostic request object required");
    const keys = ["model", "messages", "temperature", "max_tokens", "response_format", "reasoning_effort", "top_p", "presence_penalty"];
    if (Object.keys(body).some(key => !keys.includes(key)) || body.model !== expectedModel || body.reasoning_effort !== "low" ||
        body.temperature !== 1 || body.top_p !== 0.95 || body.presence_penalty !== 1.5 || body.max_tokens !== 4096 ||
        body.response_format?.type !== "json_object" || Object.keys(body.response_format).length !== 1 ||
        !Array.isArray(body.messages) || body.messages.length !== 2 || body.messages[0]?.role !== "system" || body.messages[1]?.role !== "user" ||
        body.messages.some(message => typeof message.content !== "string" || Object.keys(message).some(key => !["role", "content"].includes(key)))) fail("Diagnostic model, sampling or output budget rejected");
    const [system, user] = body.messages.map(message => message.content), userHash = sha(user);
    if (sha(system) !== systemSha256 || !allowed.has(userHash) || allowed.get(userHash) >= 2 ||
        Buffer.byteLength(system) + Buffer.byteLength(user) + 4096 + 4096 > 32768) fail("Diagnostic input scope or context budget rejected");
    if (requests >= MAX_CALLS || inFlight !== 0 || Date.now() - began >= 30 * 60000) fail("Diagnostic request, concurrency or time budget exhausted");
    requests += 1; inFlight += 1; allowed.set(userHash, allowed.get(userHash) + 1);
    try {
      let response;
      try { response = await nativeFetch(input, { ...init, redirect: "manual" }); }
      catch { fail("Local thinking diagnostic transport failed; response suppressed"); }
      if (!response.ok) return new Response(JSON.stringify({ error: "Local diagnostic provider error body suppressed" }), {
        status: response.status, headers: { "content-type": "application/json" },
      });
      if (!/application\/json/iu.test(response.headers.get("content-type") ?? "")) fail("Diagnostic non-JSON response suppressed");
      const reader = response.body?.getReader();
      if (!reader) fail("Diagnostic empty response suppressed");
      const chunks = []; let bytes = 0;
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) { await reader.cancel(); fail("Diagnostic response byte budget exceeded"); }
        chunks.push(Buffer.from(next.value));
      }
      let raw, score;
      try {
        raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (raw.model !== expectedModel || !Array.isArray(raw.choices) || raw.choices.length !== 1 || raw.choices[0].finish_reason !== "stop" ||
            raw.choices[0].message?.role !== "assistant" || typeof raw.choices[0].message.content !== "string") fail("Invalid final answer");
        score = DimensionScoreSchema.parse(JSON.parse(raw.choices[0].message.content));
      } catch { fail("Diagnostic final answer is incomplete or invalid; response suppressed"); }
      const usage = raw.usage;
      if (!usage || ["prompt_tokens", "completion_tokens", "total_tokens"].some(key => !Number.isSafeInteger(usage[key]) || usage[key] < 0) ||
          usage.prompt_tokens < 1 || usage.completion_tokens > 4096 || usage.total_tokens !== usage.prompt_tokens + usage.completion_tokens ||
          usage.total_tokens > 32768) fail("Diagnostic response token accounting rejected");
      if (Object.keys(raw.choices[0].message).some(key => /thinking|reasoning|analysis/iu.test(key))) reasoningOmitted += 1;
      // Construct a fresh whitelist: no thought text, unknown fields, preamble or raw body reaches receipts.
      const safe = { object: "chat.completion", model: expectedModel,
        choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(score) }, finish_reason: "stop" }],
        usage: { prompt_tokens: usage.prompt_tokens, completion_tokens: usage.completion_tokens, total_tokens: usage.total_tokens } };
      finalResponses += 1;
      return new Response(JSON.stringify(safe), { status: 200, headers: { "content-type": "application/json" } });
    } catch (error) {
      if (error instanceof ThinkingDiagnosticGuardError) throw error;
      fail("Diagnostic response processing failed; body suppressed");
    } finally { inFlight -= 1; }
  };
  Object.defineProperty(guarded, "stats", { get: () => ({ requests, inFlight, finalResponses, reasoningOmitted }) });
  return guarded;
}
