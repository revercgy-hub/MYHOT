import { createRequire, syncBuiltinESMExports } from "node:module";
import dns from "node:dns/promises";
import diagnosticsChannel from "node:diagnostics_channel";
import { appendFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const FIXTURE_HOST = "fiscal-fixture.mof.gov.cn";
const originalLookup = dns.lookup.bind(dns);
dns.lookup = (async (hostname: string, options?: unknown) => {
  if (String(hostname).toLowerCase() === FIXTURE_HOST) {
    const row = { address: "93.184.216.34", family: 4 };
    return (typeof options === "object" && options !== null && "all" in options && options.all)
      ? [row]
      : row;
  }
  return (originalLookup as (...args: unknown[]) => Promise<unknown>)(hostname, options);
}) as typeof dns.lookup;
syncBuiltinESMExports();

const requireBackend = createRequire(new URL("../../packages/backend/src/lib/http-fetch.ts", import.meta.url));
const { Agent, MockAgent, ProxyAgent } = requireBackend("undici") as {
  Agent: { prototype: { dispatch: (...args: any[]) => unknown } };
  ProxyAgent: { prototype: { dispatch: (...args: any[]) => unknown } };
  MockAgent: new () => {
    disableNetConnect(): void;
    get(origin: string): { intercept(options: { path: string | RegExp; method: string }): { reply(status: number, body: Buffer | string, options?: { headers?: Record<string, string>; data?: unknown }): unknown } };
    dispatch(options: unknown, handler: unknown): unknown;
  };
};

const mockAgent = new MockAgent();
mockAgent.disableNetConnect();
const originalAgentDispatch = Agent.prototype.dispatch;
const internalAgent = Object.getOwnPropertySymbols(mockAgent)
  .map((symbol) => (mockAgent as unknown as Record<symbol, unknown>)[symbol])
  .find((value): value is object => typeof value === "object" && value !== null &&
    typeof (value as { dispatch?: unknown }).dispatch === "function");
if (!internalAgent) throw new Error("MockAgent internal Agent was not found");
// Keep MockAgent's private pool dispatch out of the CLI's outbound-request budget. The public
// backend Agent dispatch is still guarded; this private Agent can only reach the disabled-network
// MockAgent pool, which has no real network fallback.
Object.defineProperty(internalAgent, "dispatch", { configurable: true, writable: true, value: originalAgentDispatch });
const mode = process.env.P3_CONTINUATION_FIXTURE_MODE ?? "success";
const listing = (page: number): string => {
  const title = `Fixture fiscal update ${page}`;
  return `<!doctype html><html><body><ul><li><a href="./article-${page}.html" title="${title}">${title}</a><time datetime="2026-10-17">2026-10-17</time></li></ul></body></html>`;
};

for (const page of [2, 3]) {
  const path = `/dir/index_${page}.htm`;
  const redirect = mode === "redirect" && page === 2;
  const failed = mode === "failure" && page === 2;
  mockAgent.get(`https://${FIXTURE_HOST}`).intercept({ path, method: "GET" }).reply(
    redirect ? 302 : failed ? 503 : 200,
    redirect ? "" : failed ? "synthetic fixture failure" : gzipSync(Buffer.from(listing(page), "utf8")),
    { headers: redirect ? { location: "/dir/index_3.htm" } : failed
      ? { "content-type": "text/plain; charset=utf-8" }
      : { "content-type": "text/html; charset=utf-8", "content-encoding": "gzip" } },
  );
}

const controlledDispatch = function (this: unknown, options: unknown, handler: unknown) {
  const request = options as { origin?: string; path?: string; method?: string };
  const logPath = process.env.P3_CONTINUATION_TRANSPORT_LOG;
  if (logPath) appendFileSync(logPath, `${JSON.stringify({ origin: request.origin, path: request.path, method: request.method })}\n`);
  const diagnosticRequest = { origin: String(request.origin ?? ""), path: String(request.path ?? ""), method: String(request.method ?? "") };
  diagnosticsChannel.channel("undici:request:create").publish({ request: diagnosticRequest });
  const forward = handler as Record<string, (...args: any[]) => unknown>;
  // fetch() supplies its higher-level handler interface (onResponseStart/Data/End), not the
  // low-level DispatcherHandler callbacks. Preserve all fetch state/methods while translating
  // only the MockAgent response callbacks into the diagnostics consumed by the real CLI capture.
  const controlledHandler = Object.assign(Object.create(Object.getPrototypeOf(handler)), handler) as Record<string, (...args: any[]) => unknown>;
  const originalResponseStart = forward.onResponseStart;
  if (originalResponseStart) controlledHandler.onResponseStart = function (this: unknown, controller: any, statusCode: number, headers: unknown, statusText: string) {
    const rawHeaders = Array.isArray(controller?.rawHeaders) ? controller.rawHeaders : headers;
    diagnosticsChannel.channel("undici:request:headers").publish({ request: diagnosticRequest,
      response: { statusCode, headers: rawHeaders } });
    return Reflect.apply(originalResponseStart, this, [controller, statusCode, headers, statusText]);
  };
  const originalResponseData = forward.onResponseData;
  if (originalResponseData) controlledHandler.onResponseData = function (this: unknown, controller: unknown, chunk: Buffer) {
    diagnosticsChannel.channel("undici:request:bodyChunkReceived").publish({ request: diagnosticRequest, chunk });
    return Reflect.apply(originalResponseData, this, [controller, chunk]);
  };
  const originalResponseEnd = forward.onResponseEnd;
  if (originalResponseEnd) controlledHandler.onResponseEnd = function (this: unknown, controller: unknown) {
    diagnosticsChannel.channel("undici:request:trailers").publish({ request: diagnosticRequest });
    return Reflect.apply(originalResponseEnd, this, [controller]);
  };
  const originalResponseError = forward.onResponseError;
  if (originalResponseError) controlledHandler.onResponseError = function (this: unknown, controller: unknown, error: Error) {
    diagnosticsChannel.channel("undici:request:error").publish({ request: diagnosticRequest, error });
    return Reflect.apply(originalResponseError, this, [controller, error]);
  };
  return mockAgent.dispatch(options, controlledHandler);
};
Object.defineProperty(Agent.prototype, "dispatch", { configurable: true, writable: true, value: controlledDispatch });
Object.defineProperty(ProxyAgent.prototype, "dispatch", { configurable: true, writable: true, value: controlledDispatch });
