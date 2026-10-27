const EXPECTED_DB = "fiscalhot_ollama_understand_20261027_test";
const EXPECTED_HOST = "127.0.0.1";
const EXPECTED_PORT = "55433";
const LOCAL_BASE_URL = "http://192.168.3.100:11435/v1";
const LOCAL_MODEL = "qwen3.5:9b";
const REQUEST_CAP = 12;
const EXPECTED_TOKEN_SEQUENCE = Object.freeze([800, 16_384, 800, 16_384, 800, 16_384, 800, 16_384]);
const REASONING_KEYS = /^(?:thinking|reasoning|reasoning_content|reasoning_text|analysis|analysis_content|thought|thoughts|internal_reasoning)$/iu;
const THINKING_TAG = /<\/?(?:think|thinking|analysis|reasoning)(?:\s[^>]*)?>/iu;
const STRUCTURE_KEYS = new Set(["category", "tags", "subjects", "fact"]);
const FACT_KEYS = new Set(["title", "subject", "action", "object", "occurredAt"]);
const UNDERSTAND_KEYS = new Set(["itemType", "authorRole", "tags", "editorialJudgment", "titleZh", "summaryZh"]);

export class UnderstandPilotGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnderstandPilotGuardError";
  }
}

export function assertUnderstandPilotDatabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new UnderstandPilotGuardError("DATABASE_URL is not a valid URL");
  }
  const database = url.pathname.replace(/^\//u, "");
  if (!/^postgres(?:ql)?:$/iu.test(url.protocol) || url.hostname !== EXPECTED_HOST || url.port !== EXPECTED_PORT || database !== EXPECTED_DB || url.search || url.hash || url.username !== "postgres" || url.password) {
    throw new UnderstandPilotGuardError("DATABASE_URL must target only the approved loopback understanding *_test database");
  }
  return url;
}

export function assertUnderstandPilotRuntimeIdentity({ dockerEnvExists, hostname, expectedContainerId, markerContainerId }) {
  const id = typeof expectedContainerId === "string" ? expectedContainerId.toLowerCase() : "";
  if (!dockerEnvExists || !/^fiscal-understand-[a-z0-9-]{6,40}$/iu.test(hostname ?? "") || !/^[a-f0-9]{64}$/u.test(id) || markerContainerId?.trim().toLowerCase() !== id) {
    throw new UnderstandPilotGuardError("Expected isolated NAS understanding client container identity is missing or inconsistent");
  }
  return { hostname, containerId: id };
}

function headerValue(headers, key) {
  try {
    return new Headers(headers).get(key);
  } catch {
    return null;
  }
}

function nonEmpty(value) {
  if (value === null || value === undefined || value === false || value === 0) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function hasReasoningField(value) {
  if (!value || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value)) {
    if (REASONING_KEYS.test(key) && nonEmpty(child)) return true;
    if (hasReasoningField(child)) return true;
  }
  return false;
}

function hasOnlyKeys(value, keys) {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => keys.has(key));
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validStagePayload(content, maxTokens) {
  if (typeof content !== "string" || THINKING_TAG.test(content)) return false;
  let value;
  try {
    value = JSON.parse(content);
  } catch {
    return false;
  }
  if (maxTokens === 800) {
    if (!hasOnlyKeys(value, STRUCTURE_KEYS)) return false;
    if (!(value.category === null || typeof value.category === "string") || !isStringArray(value.tags) || !isStringArray(value.subjects)) return false;
    if (value.fact === null || value.fact === undefined) return true;
    return hasOnlyKeys(value.fact, FACT_KEYS) && Object.values(value.fact).every((item) => item === null || typeof item === "string");
  }
  if (maxTokens === 16_384) {
    return hasOnlyKeys(value, UNDERSTAND_KEYS)
      && typeof value.itemType === "string"
      && typeof value.authorRole === "string"
      && isStringArray(value.tags)
      && typeof value.editorialJudgment === "string"
      && typeof value.titleZh === "string"
      && typeof value.summaryZh === "string";
  }
  return false;
}

/** Only exact serial chatJson calls for structure/understand are allowed through this guard. */
export function createUnderstandPilotFetchGuard({
  apiKey,
  nativeFetch = globalThis.fetch.bind(globalThis),
  expectedBaseUrl = LOCAL_BASE_URL,
  expectedModel = LOCAL_MODEL,
  deadlineEpochMs = null,
  now = () => Date.now(),
} = {}) {
  if (!apiKey || typeof apiKey !== "string") throw new UnderstandPilotGuardError("LLM_API_KEY must be injected into the isolated test process");
  const endpoint = new URL(`${expectedBaseUrl.replace(/\/$/u, "")}/chat/completions`);
  if (endpoint.protocol !== "http:" || endpoint.hostname !== "192.168.3.100" || endpoint.port !== "11435" || endpoint.pathname !== "/v1/chat/completions") {
    throw new UnderstandPilotGuardError("The approved local chat endpoint is invalid");
  }
  if (deadlineEpochMs !== null && (!Number.isSafeInteger(deadlineEpochMs) || deadlineEpochMs <= 0)) {
    throw new UnderstandPilotGuardError("The scheduled request deadline is invalid");
  }

  let requests = 0;
  let inFlight = 0;
  const requestStartedAtEpochMs = [];
  const guardedFetch = async (input, init = {}) => {
    let url;
    try {
      url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url);
    } catch {
      throw new UnderstandPilotGuardError("Outbound request URL rejected");
    }
    if (url.href !== endpoint.href) throw new UnderstandPilotGuardError("Outbound request host or path rejected");
    const method = init.method ?? (input instanceof Request ? input.method : "GET");
    if (method.toUpperCase() !== "POST") throw new UnderstandPilotGuardError("Outbound request method rejected");
    if (headerValue(init.headers ?? (input instanceof Request ? input.headers : undefined), "authorization") !== `Bearer ${apiKey}`) {
      throw new UnderstandPilotGuardError("Outbound request authorization rejected");
    }
    if (typeof init.body !== "string") throw new UnderstandPilotGuardError("Outbound request body rejected");

    let body;
    try {
      body = JSON.parse(init.body);
    } catch {
      throw new UnderstandPilotGuardError("Outbound request body is not JSON");
    }
    if (body?.model !== expectedModel) throw new UnderstandPilotGuardError("Outbound request model rejected");
    if (body?.stream === true) throw new UnderstandPilotGuardError("Streaming requests are disabled for this pilot");
    if (body?.reasoning_effort !== "none") throw new UnderstandPilotGuardError("Reasoning must be disabled for this pilot");
    if (body?.max_tokens !== EXPECTED_TOKEN_SEQUENCE[requests]) throw new UnderstandPilotGuardError("Outbound request stage or token cap rejected");
    if (body?.response_format?.type !== "json_object") throw new UnderstandPilotGuardError("JSON mode is required for this pilot");
    if (requests >= REQUEST_CAP) throw new UnderstandPilotGuardError("Pilot HTTP request cap reached");
    if (inFlight !== 0) throw new UnderstandPilotGuardError("Concurrent provider requests are disabled for this pilot");

    const stageTimeoutMs = body.max_tokens === 800 ? 120_000 : 180_000;
    const requestStartedAt = now();
    if (deadlineEpochMs !== null && requestStartedAt + stageTimeoutMs > deadlineEpochMs) {
      throw new UnderstandPilotGuardError("The night window does not have enough time for this request");
    }

    requests += 1;
    inFlight += 1;
    requestStartedAtEpochMs.push(requestStartedAt);
    try {
      const deadlineSignal = deadlineEpochMs === null ? undefined : AbortSignal.timeout(Math.max(1, deadlineEpochMs - requestStartedAt));
      const signal = deadlineSignal ? (init.signal ? AbortSignal.any([init.signal, deadlineSignal]) : deadlineSignal) : init.signal;
      const response = await nativeFetch(input, { ...init, redirect: "manual", ...(signal ? { signal } : {}) });
      if (!response.ok) {
        const requestId = response.headers.get("x-request-id");
        return new Response(JSON.stringify({ error: "Local provider error body suppressed" }), {
          status: response.status,
          statusText: response.statusText,
          headers: { "content-type": "application/json", ...(requestId ? { "x-request-id": requestId } : {}) },
        });
      }

      let parsed;
      try {
        const length = Number(response.headers.get("content-length") ?? 0);
        if (length > 2_000_000) throw new Error("oversize");
        parsed = await response.clone().json();
      } catch {
        throw new UnderstandPilotGuardError("Local provider success response rejected before receipt storage");
      }
      const message = parsed?.choices?.[0]?.message;
      const choice = parsed?.choices?.[0];
      const responseKeys = new Set(["id", "object", "created", "model", "choices", "usage", "system_fingerprint", "service_tier"]);
      const choiceKeys = new Set(["index", "finish_reason", "message", "logprobs"]);
      const messageKeys = new Set(["role", "content"]);
      if (!hasOnlyKeys(parsed, responseKeys) || !Array.isArray(parsed.choices) || parsed.choices.length !== 1
        || !hasOnlyKeys(choice, choiceKeys) || choice.finish_reason !== "stop" || !hasOnlyKeys(message, messageKeys) || message.role !== "assistant"
        || hasReasoningField(parsed) || !validStagePayload(message?.content, body.max_tokens)) {
        throw new UnderstandPilotGuardError("Local provider response blocked before receipt storage");
      }
      return response;
    } finally {
      inFlight -= 1;
    }
  };
  Object.defineProperty(guardedFetch, "stats", { get: () => ({ requests, inFlight, requestCap: REQUEST_CAP, expectedCalls: EXPECTED_TOKEN_SEQUENCE.length, requestStartedAtEpochMs: [...requestStartedAtEpochMs] }) });
  return guardedFetch;
}

export const UNDERSTAND_PILOT_CONSTANTS = Object.freeze({
  database: EXPECTED_DB,
  databaseHost: EXPECTED_HOST,
  databasePort: EXPECTED_PORT,
  baseUrl: LOCAL_BASE_URL,
  model: LOCAL_MODEL,
  requestCap: REQUEST_CAP,
  concurrency: 1,
  stageTokenCaps: Object.freeze({ structure: 800, understand: 16_384 }),
  stageTimeoutMs: Object.freeze({ structure: 120_000, understand: 180_000 }),
  expectedCalls: EXPECTED_TOKEN_SEQUENCE.length,
});
