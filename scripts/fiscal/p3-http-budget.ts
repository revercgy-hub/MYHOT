// P3-only HTTP request budget instrumentation for the backend's pinned Undici instance.
// This is deliberately process-local and serial-use: it does not instrument Node's global fetch,
// other Undici copies, workers, or the ALLOW_PRIVATE_NETWORK_FETCH global-dispatcher bypass.
import diagnosticsChannel from "node:diagnostics_channel";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_UNDICI_VERSION = "8.11.2";
let activeBudget = false;
const CHANNELS = [
  "undici:request:create",
  "undici:client:sendHeaders",
  "undici:request:headers",
  "undici:request:error",
] as const;

type DispatchHandler = {
  onResponseError?: (controller: unknown, error: Error) => unknown;
};
type Dispatch = (this: unknown, opts: object, handler: DispatchHandler) => unknown;
type RequestLike = {
  origin?: string | URL;
  method?: string;
  path?: string;
};
type EventRecord = {
  event: string;
  at: string;
  requestId?: number;
  origin?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  error?: string;
};

export type P3HttpBudgetSnapshot = {
  undiciVersion: string;
  maxRequests: number;
  attempted: number;
  rejected: number;
  dispatched: number;
  events: number;
  eventCounts: Record<string, number>;
  diagnosticCallbackErrors: number;
  requests: EventRecord[];
};

export type P3HttpBudget = P3HttpBudgetSnapshot & {
  snapshot(): P3HttpBudgetSnapshot;
  uninstall(): void;
};

function backendRequire(): NodeRequire {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const backendAnchor = resolve(thisDir, "../../packages/backend/src/lib/http-fetch.ts");
  return createRequire(backendAnchor);
}

function safePath(path: unknown): string | undefined {
  if (typeof path !== "string") return undefined;
  // Keep path/query shape useful for source audit while removing query values and fragments.
  const query = path.indexOf("?");
  const fragment = path.indexOf("#");
  const end = [query, fragment].filter((n) => n >= 0).reduce((a, b) => Math.min(a, b), path.length);
  return path.slice(0, end) + (query >= 0 ? "?<redacted>" : "");
}

function safeRecord(fn: () => void, state: { diagnosticCallbackErrors: number }): void {
  try {
    fn();
  } catch {
    // diagnostics_channel callbacks run synchronously inside Undici; never let an observer throw.
    state.diagnosticCallbackErrors++;
  }
}

/**
 * Install a strict request-dispatch cap on only the backend's pinned Undici Agent classes.
 * The cap applies to origin dispatcher calls (one per fetch/redirect hop), not proxy CONNECT
 * internals. Keep the P3 runner serial and use the same backend-resolved Undici import for fetch.
 */
export function installP3HttpBudget(maxRequests: number): P3HttpBudget {
  if (activeBudget) throw new Error("A P3 HTTP budget is already installed in this process");
  if (!Number.isSafeInteger(maxRequests) || maxRequests < 1) {
    throw new RangeError("maxRequests must be a positive safe integer");
  }

  const requireBackend = backendRequire();
  const undici = requireBackend("undici") as {
    Agent: { prototype: Record<string, unknown> };
    ProxyAgent: { prototype: Record<string, unknown> };
  };
  const version = String((requireBackend("undici/package.json") as { version?: unknown }).version ?? "");
  const backendPackagePath = resolve(dirname(fileURLToPath(import.meta.url)), "../../packages/backend/package.json");
  const backendPackage = requireBackend(backendPackagePath) as { dependencies?: Record<string, string> };
  const declaredVersion = backendPackage.dependencies?.undici;
  if (version !== EXPECTED_UNDICI_VERSION || declaredVersion !== EXPECTED_UNDICI_VERSION) {
    throw new Error(`Unsupported backend Undici version: loaded=${version}, declared=${declaredVersion}; expected=${EXPECTED_UNDICI_VERSION}`);
  }

  const prototypes = [undici.Agent.prototype, undici.ProxyAgent.prototype];
  if (prototypes[0] === prototypes[1]) throw new Error("Agent and ProxyAgent prototypes unexpectedly alias");
  const dispatchDescriptors = prototypes.map((prototype) => Object.getOwnPropertyDescriptor(prototype, "dispatch"));
  if (typeof prototypes[0].dispatch !== "function" || typeof prototypes[1].dispatch !== "function") {
    throw new Error("Backend Undici Agent dispatch methods are unavailable");
  }
  if (dispatchDescriptors.some((descriptor) => descriptor && (!descriptor.configurable || !descriptor.writable))) {
    throw new Error("Backend Undici dispatch methods cannot be safely instrumented");
  }
  for (const name of CHANNELS) {
    const channel = diagnosticsChannel.channel(name);
    if (typeof channel.subscribe !== "function" || typeof channel.unsubscribe !== "function") {
      throw new Error(`diagnostics_channel subscription unavailable: ${name}`);
    }
  }

  const originals = prototypes.map((prototype) => prototype.dispatch as Dispatch);
  const state: P3HttpBudgetSnapshot = {
    undiciVersion: version,
    maxRequests,
    attempted: 0,
    rejected: 0,
    dispatched: 0,
    events: 0,
    eventCounts: Object.fromEntries(CHANNELS.map((name) => [name, 0])),
    diagnosticCallbackErrors: 0,
    requests: [],
  };
  const requestIds = new WeakMap<object, number>();
  let nextRequestId = 1;
  let proxyDelegationDepth = 0;
  let installed = false;
  const wrappers: Dispatch[] = [];

  const subscribers = CHANNELS.map((eventName) => {
    const callback = (message: unknown) => safeRecord(() => {
      state.events++;
      state.eventCounts[eventName] = (state.eventCounts[eventName] ?? 0) + 1;
      if (!message || typeof message !== "object") return;
      const data = message as { request?: RequestLike; response?: { statusCode?: number }; error?: unknown };
      const request = data.request;
      let requestId: number | undefined;
      if (request && typeof request === "object") {
        requestId = requestIds.get(request as object);
        if (!requestId) {
          requestId = nextRequestId++;
          requestIds.set(request as object, requestId);
        }
      }
      const record: EventRecord = {
        event: eventName,
        at: new Date().toISOString(),
        ...(requestId ? { requestId } : {}),
        ...(request?.origin ? { origin: String(request.origin) } : {}),
        ...(request?.method ? { method: request.method } : {}),
        ...(request?.path ? { path: safePath(request.path) } : {}),
        ...(typeof data.response?.statusCode === "number" ? { statusCode: data.response.statusCode } : {}),
        ...(data.error ? { error: errorLabel(data.error) } : {}),
      };
      state.requests.push(record);
    }, state);
    return { eventName, callback };
  });

  const agentDispatch = originals[0]!;
  const proxyDispatch = originals[1]!;
  wrappers.push(function (this: unknown, opts: object, handler: DispatchHandler): unknown {
    if (proxyDelegationDepth > 0) return Reflect.apply(agentDispatch, this, [opts, handler]);
    return dispatchWithBudget(agentDispatch, this, opts, handler, state);
  });
  wrappers.push(function (this: unknown, opts: object, handler: DispatchHandler): unknown {
    proxyDelegationDepth++;
    try {
      return dispatchWithBudget(proxyDispatch, this, opts, handler, state);
    } finally {
      proxyDelegationDepth--;
    }
  });

  try {
    for (let i = 0; i < prototypes.length; i++) {
      Object.defineProperty(prototypes[i], "dispatch", {
        configurable: true,
        enumerable: false,
        writable: true,
        value: wrappers[i],
      });
    }
    for (const { eventName, callback } of subscribers) diagnosticsChannel.subscribe(eventName, callback);
    installed = true;
    activeBudget = true;
  } catch (error) {
    for (let i = 0; i < prototypes.length; i++) restoreDescriptor(prototypes[i]!, dispatchDescriptors[i]);
    for (const { eventName, callback } of subscribers) diagnosticsChannel.unsubscribe(eventName, callback);
    throw new Error("Could not install P3 HTTP budget; no network run is safe", { cause: error });
  }

  const snapshot = (): P3HttpBudgetSnapshot => ({
    undiciVersion: state.undiciVersion,
    maxRequests: state.maxRequests,
    attempted: state.attempted,
    rejected: state.rejected,
    dispatched: state.dispatched,
    events: state.events,
    eventCounts: { ...state.eventCounts },
    diagnosticCallbackErrors: state.diagnosticCallbackErrors,
    requests: state.requests.map((record) => ({ ...record })),
  });
  const uninstall = () => {
    if (!installed) return;
    installed = false;
    activeBudget = false;
    for (const { eventName, callback } of subscribers) diagnosticsChannel.unsubscribe(eventName, callback);
    for (let i = 0; i < prototypes.length; i++) restoreDescriptor(prototypes[i]!, dispatchDescriptors[i]);
  };
  return Object.assign(state, { snapshot, uninstall });
}

function dispatchWithBudget(
  original: Dispatch,
  receiver: unknown,
  opts: object,
  handler: DispatchHandler,
  state: P3HttpBudgetSnapshot,
): unknown {
  state.attempted++;
  if (state.dispatched >= state.maxRequests) {
    state.rejected++;
    const error = Object.assign(new Error(`P3 HTTP request budget exhausted (${state.maxRequests})`), { code: "P3_HTTP_BUDGET_EXHAUSTED" });
    if (typeof handler?.onResponseError === "function") {
      handler.onResponseError(null, error);
      return false;
    }
    // Throw only at the guarded dispatch boundary, before the original dispatcher can send.
    throw error;
  }
  state.dispatched++;
  return Reflect.apply(original, receiver, [opts, handler]);
}

function errorLabel(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as Error & { code?: unknown }).code;
    return `${error.name}${code ? `[${String(code)}]` : ""}`;
  }
  return typeof error === "string" ? "NonErrorString" : "NonErrorValue";
}

function restoreDescriptor(prototype: Record<string, unknown>, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) Object.defineProperty(prototype, "dispatch", descriptor);
  else delete prototype.dispatch;
}
