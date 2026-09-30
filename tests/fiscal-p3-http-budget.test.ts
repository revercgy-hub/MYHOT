import assert from "node:assert/strict";
import http from "node:http";
import { createRequire } from "node:module";
import { after, before, test } from "node:test";
import { installP3HttpBudget } from "../scripts/fiscal/p3-http-budget.ts";

const requireBackend = createRequire(new URL("../packages/backend/src/lib/http-fetch.ts", import.meta.url));
const backendUndici = requireBackend("undici") as {
  Agent: new () => { close(): Promise<void>; dispatch: unknown };
  ProxyAgent: new (proxyUrl: string) => { close(): Promise<void>; dispatch: unknown };
  fetch(input: string, init: { dispatcher: object; redirect?: "manual" }): Promise<Response>;
};
const serverHits = new Map<string, number>();
let proxyHits = 0;
const server = http.createServer((req, res) => {
  const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
  serverHits.set(path, (serverHits.get(path) ?? 0) + 1);
  if (path === "/start") {
    res.writeHead(302, { location: "/finish" }).end();
  } else if (path === "/error") {
    res.writeHead(502).end("fake upstream error");
  } else {
    res.writeHead(200, { "content-type": "text/plain" }).end("local fixture only");
  }
});
const proxyServer = http.createServer((_req, res) => {
  proxyHits++;
  res.writeHead(200, { "content-type": "text/plain" }).end("local proxy fixture only");
});
let port = 0;
let proxyPort = 0;

before(async () => {
  await Promise.all([
    new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)),
    new Promise<void>((resolve) => proxyServer.listen(0, "127.0.0.1", resolve)),
  ]);
  port = (server.address() as { port: number }).port;
  proxyPort = (proxyServer.address() as { port: number }).port;
});
after(async () => {
  await Promise.all([server, proxyServer].map((activeServer) =>
    new Promise<void>((resolve, reject) => activeServer.close((error) => error ? reject(error) : resolve()))));
});

function localUrl(path: string): string {
  return `http://127.0.0.1:${port}${path}`;
}

async function followOneRedirect(agent: InstanceType<typeof backendUndici.Agent>): Promise<string> {
  const first = await backendUndici.fetch(localUrl("/start"), { dispatcher: agent, redirect: "manual" });
  assert.equal(first.status, 302);
  const location = first.headers.get("location");
  await first.body?.cancel();
  assert.equal(location, "/finish");
  const second = await backendUndici.fetch(new URL(location, localUrl("/start")).toString(), { dispatcher: agent, redirect: "manual" });
  return `${second.status}:${await second.text()}`;
}

test("cap 1 stops the second manual redirect before a second localhost request", async () => {
  serverHits.clear();
  const budget = installP3HttpBudget(1);
  const agent = new backendUndici.Agent();
  try {
    await assert.rejects(followOneRedirect(agent), (error: unknown) => {
      assert(error instanceof TypeError);
      assert.equal((error as TypeError & { cause?: { code?: string } }).cause?.code, "P3_HTTP_BUDGET_EXHAUSTED");
      return true;
    });
    assert.equal(serverHits.get("/start"), 1);
    assert.equal(serverHits.get("/finish") ?? 0, 0);
    const audit = budget.snapshot();
    assert.deepEqual(
      { attempted: audit.attempted, rejected: audit.rejected, dispatched: audit.dispatched },
      { attempted: 2, rejected: 1, dispatched: 1 },
    );
    assert.equal(audit.eventCounts["undici:request:create"], 1);
    assert.equal(audit.eventCounts["undici:client:sendHeaders"], 1);
    assert.equal(audit.eventCounts["undici:request:headers"], 1);
    assert.equal(audit.diagnosticCallbackErrors, 0);
  } finally {
    budget.uninstall();
    await agent.close();
  }
});

test("cap 2 admits both localhost redirect hops", async () => {
  serverHits.clear();
  const budget = installP3HttpBudget(2);
  const agent = new backendUndici.Agent();
  try {
    assert.equal(await followOneRedirect(agent), "200:local fixture only");
    const audit = budget.snapshot();
    assert.deepEqual(
      { attempted: audit.attempted, rejected: audit.rejected, dispatched: audit.dispatched },
      { attempted: 2, rejected: 0, dispatched: 2 },
    );
    assert.equal(serverHits.get("/start"), 1);
    assert.equal(serverHits.get("/finish"), 1);
    assert.equal(audit.eventCounts["undici:request:create"], 2);
    assert.equal(audit.eventCounts["undici:client:sendHeaders"], 2);
    assert(audit.requests.some((event) => event.event === "undici:request:headers" && event.statusCode === 302));
    assert(audit.requests.some((event) => event.event === "undici:request:headers" && event.statusCode === 200));
    assert.equal(audit.diagnosticCallbackErrors, 0);
  } finally {
    budget.uninstall();
    await agent.close();
  }
});

test("backend ProxyAgent is counted once despite its internal Agent delegation", async () => {
  proxyHits = 0;
  const budget = installP3HttpBudget(1);
  const proxy = new backendUndici.ProxyAgent(`http://127.0.0.1:${proxyPort}`);
  try {
    const response = await backendUndici.fetch("http://fixture.invalid/p3-proxy-test", { dispatcher: proxy, redirect: "manual" });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "local proxy fixture only");
    assert.equal(proxyHits, 1);
    assert.deepEqual(
      { attempted: budget.attempted, rejected: budget.rejected, dispatched: budget.dispatched },
      { attempted: 1, rejected: 0, dispatched: 1 },
    );
  } finally {
    budget.uninstall();
    await proxy.close();
  }
});

test("HTTP error status is recorded without changing normal fetch behavior", async () => {
  serverHits.clear();
  const budget = installP3HttpBudget(1);
  const agent = new backendUndici.Agent();
  try {
    const failed = await backendUndici.fetch(localUrl("/error"), { dispatcher: agent, redirect: "manual" });
    assert.equal(failed.status, 502);
    assert.equal(await failed.text(), "fake upstream error");
    const audit = budget.snapshot();
    assert.equal(audit.attempted, 1);
    assert.equal(audit.dispatched, 1);
    assert.equal(audit.rejected, 0);
    assert(audit.requests.some((event) => event.event === "undici:request:headers" && event.statusCode === 502));
  } finally {
    budget.uninstall();
    await agent.close();
  }
});

test("invalid install leaves dispatch prototypes untouched; uninstall removes observers and restores dispatch", async () => {
  const before = Object.getOwnPropertyDescriptor(backendUndici.Agent.prototype, "dispatch");
  assert.throws(() => installP3HttpBudget(0), /positive safe integer/);
  assert.deepEqual(Object.getOwnPropertyDescriptor(backendUndici.Agent.prototype, "dispatch"), before);

  const budget = installP3HttpBudget(1);
  const installed = Object.getOwnPropertyDescriptor(backendUndici.Agent.prototype, "dispatch");
  assert.notDeepEqual(installed, before);
  budget.uninstall();
  assert.deepEqual(Object.getOwnPropertyDescriptor(backendUndici.Agent.prototype, "dispatch"), before);

  const agent = new backendUndici.Agent();
  try {
    const response = await backendUndici.fetch(localUrl("/finish"), { dispatcher: agent, redirect: "manual" });
    assert.equal(response.status, 200);
    await response.text();
    assert.equal(budget.snapshot().attempted, 0, "post-uninstall dispatch must not be counted");
  } finally {
    await agent.close();
  }
});
