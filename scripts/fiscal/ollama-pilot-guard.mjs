const EXPECTED_DB = "fiscalhot_ollama_pilot_20261026_test";
const EXPECTED_HOSTS = new Set(["127.0.0.1", "localhost"]);
const EXPECTED_PORT = "55432";
const LOCAL_BASE_URL = "http://192.168.3.100:11435/v1";
const LOCAL_MODEL = "qwen3.5:9b";
const ALLOWED_TOKEN_CAPS = new Set([512, 1024, 2048]);

export class PilotGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = "PilotGuardError";
  }
}

/** Only the named disposable PostgreSQL database on the approved loopback port is accepted. */
export function assertPilotDatabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new PilotGuardError("DATABASE_URL is not a valid URL");
  }
  const database = url.pathname.replace(/^\//u, "");
  if (!/^postgres(?:ql)?:$/iu.test(url.protocol) || !EXPECTED_HOSTS.has(url.hostname) || url.port !== EXPECTED_PORT || database !== EXPECTED_DB || url.search || url.hash) {
    throw new PilotGuardError("DATABASE_URL must target only the approved loopback *_test database");
  }
  return url;
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

const THINKING_KEY = /^(?:thinking|reasoning|reasoning_content|reasoning_text|analysis|analysis_content|thought|thoughts|internal_reasoning)$/iu;
const THINKING_TAG = /<\/?(?:think|thinking|analysis|reasoning)(?:\s[^>]*)?>/iu;

function hasThinkingField(value) {
  if (!value || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value)) {
    if (THINKING_KEY.test(key) && nonEmpty(child)) return true;
    if (hasThinkingField(child)) return true;
  }
  return false;
}

function responseThinkingDetected(parsed, requestBody) {
  if (hasThinkingField(parsed)) return true;
  const content = parsed?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return false;
  if (THINKING_TAG.test(content)) return true;
  if (requestBody.response_format?.type === "json_object") {
    try {
      const answer = JSON.parse(content);
      if (hasThinkingField(answer)) return true;
    } catch {
      // The project's receipt path retains the raw response before parsing. Fail closed here so
      // malformed JSON (which may contain a reasoning preamble) cannot be stored there.
      return true;
    }
  }
  // The project's plain-text summary parser accepts preambles and label fallbacks. Require the
  // response to start with a canonical field so an untagged reasoning preamble cannot be stored
  // in the raw response receipt before parseTranslateOutput runs.
  if (!requestBody.response_format && requestBody.max_tokens === 2048) {
    const firstLine = content.split(/\r?\n/u).map((line) => line.trim()).find(Boolean) ?? "";
    if (!/^(?:title_zh|summary_zh|body_zh)\s*[:：]/iu.test(firstLine)) return true;
  }
  return false;
}

/**
 * A transparent success-path fetch wrapper for chatJson. It permits only one serialized request
 * to the exact LAN Ollama endpoint. Its only mutation is on HTTP errors: preserve status, suppress
 * the provider's raw error body, and let chatJson create its normal ProviderRejectedError receipt.
 */
export function createOllamaPilotFetchGuard({
  apiKey,
  nativeFetch = globalThis.fetch.bind(globalThis),
  maxRequests = 40,
  maxInFlight = 1,
  expectedBaseUrl = LOCAL_BASE_URL,
  expectedModel = LOCAL_MODEL,
} = {}) {
  if (!apiKey || typeof apiKey !== "string") throw new PilotGuardError("LLM_API_KEY must be injected into the test process");
  const endpoint = new URL(`${expectedBaseUrl.replace(/\/$/u, "")}/chat/completions`);
  if (endpoint.protocol !== "http:" || endpoint.hostname !== "192.168.3.100" || endpoint.port !== "11435" || endpoint.pathname !== "/v1/chat/completions") {
    throw new PilotGuardError("The approved local chat endpoint is invalid");
  }
  if (maxRequests !== 40 || maxInFlight !== 1) throw new PilotGuardError("Pilot request and concurrency limits are fixed at 40 and 1");

  let requests = 0;
  let inFlight = 0;
  const guardedFetch = async (input, init = {}) => {
    let url;
    try {
      url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url);
    } catch {
      throw new PilotGuardError("Outbound request URL rejected");
    }
    if (url.href !== endpoint.href) throw new PilotGuardError("Outbound request host or path rejected");
    if ((init.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase() !== "POST") throw new PilotGuardError("Outbound request method rejected");
    if (headerValue(init.headers ?? (input instanceof Request ? input.headers : undefined), "authorization") !== `Bearer ${apiKey}`) {
      throw new PilotGuardError("Outbound request authorization rejected");
    }
    if (typeof init.body !== "string") throw new PilotGuardError("Outbound request body rejected");

    let body;
    try {
      body = JSON.parse(init.body);
    } catch {
      throw new PilotGuardError("Outbound request body is not JSON");
    }
    if (body?.model !== expectedModel) throw new PilotGuardError("Outbound request model rejected");
    if (body?.stream === true) throw new PilotGuardError("Streaming requests are disabled for this pilot");
    if (!ALLOWED_TOKEN_CAPS.has(body?.max_tokens) || body.max_tokens > 2048) throw new PilotGuardError("Outbound request token cap rejected");
    if (body?.reasoning_effort !== "none") throw new PilotGuardError("Reasoning must be disabled for this pilot");
    if (requests >= maxRequests) throw new PilotGuardError("Pilot HTTP request cap reached");
    if (inFlight >= maxInFlight) throw new PilotGuardError("Concurrent provider requests are disabled for this pilot");

    requests += 1;
    inFlight += 1;
    try {
      // A LAN gateway redirect must not turn into an unguarded cloud request.
      const response = await nativeFetch(input, { ...init, redirect: "manual" });
      if (!response.ok) {
        const requestId = response.headers.get("x-request-id");
        return new Response(JSON.stringify({ error: "Local provider error body suppressed" }), {
          status: response.status,
          statusText: response.statusText,
          headers: {
            "content-type": "application/json",
            ...(requestId ? { "x-request-id": requestId } : {}),
          },
        });
      }

      let parsed;
      try {
        parsed = await response.clone().json();
      } catch {
        throw new PilotGuardError("Local provider returned a non-JSON success response; body suppressed");
      }
      if (responseThinkingDetected(parsed, body)) throw new PilotGuardError("Local provider response blocked: unexpected reasoning field detected");
      return response;
    } finally {
      inFlight -= 1;
    }
  };
  Object.defineProperty(guardedFetch, "stats", { get: () => ({ requests, inFlight }) });
  return guardedFetch;
}

export const OLLAMA_PILOT_CONSTANTS = Object.freeze({
  database: EXPECTED_DB,
  databaseHost: "127.0.0.1",
  databasePort: EXPECTED_PORT,
  baseUrl: LOCAL_BASE_URL,
  model: LOCAL_MODEL,
  requestCap: 40,
  concurrency: 1,
  tokenCaps: Object.freeze([...ALLOWED_TOKEN_CAPS].sort((a, b) => a - b)),
});
