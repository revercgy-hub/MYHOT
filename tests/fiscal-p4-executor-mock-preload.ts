// Child-process preload for the opted-in P4 executor integration test. No request can leave the
// process: this MockAgent only permits the exact official DeepSeek path and blocks every other host.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRequire = createRequire(new URL("../packages/backend/src/lib/http-fetch.ts", import.meta.url));
// Keep the pinned Undici MockAgent's callback overload local to this test-only transport adapter.
const { MockAgent, setGlobalDispatcher } = backendRequire("undici") as {
  MockAgent: new () => any;
  setGlobalDispatcher: (dispatcher: unknown) => void;
};
const agent = new MockAgent();
agent.disableNetConnect();
const pool = agent.get("https://api.deepseek.com");
const requests: Array<{ kind: string; path: string; model: string; authMatchesFake: boolean; bodyType?: string }> = [];
const plannedKinds = ["prefilter", "score", "score", "structure", "summarize", "prefilter", "score", "score", "structure", "summarize"];

async function requestText(body: unknown): Promise<string> {
  if (typeof body === "string") return body;
  if (Buffer.isBuffer(body)) return body.toString("utf8");
  if (body && typeof body === "object" && Symbol.asyncIterator in body) {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array | string>) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks).toString("utf8");
  }
  return String(body ?? "");
}

function answerFor(kind: string): unknown {
  if (kind === "prefilter") return { label: "PASS", reason: "isolated fake-provider QA" };
  if (kind === "score") return { attentionScore: 0 };
  if (kind === "structure") return { category: "government-debt", tags: [], subjects: [], fact: null };
  return "title_zh: 隔离测试标题\nsummary_zh: 仅用于本地假服务集成测试。";
}
for (let index = 0; index < 10; index += 1) {
  pool.intercept({ path: "/chat/completions", method: "POST" }).reply(async (options: { body?: unknown; headers?: Record<string, unknown>; path?: string }) => {
    let body: { model?: string; messages?: Array<{ role: string; content: unknown }> };
    try {
      body = JSON.parse(await requestText(options.body)) as typeof body;
    } catch {
      requests.push({ kind: "unparsed", path: options.path ?? "", model: "", authMatchesFake: false, bodyType: typeof options.body });
      return { statusCode: 500, data: "mock request body was not JSON" };
    }
    const kind = plannedKinds[requests.length] ?? "unexpected";
    requests.push({ kind, path: options.path ?? "/chat/completions", model: String(body.model ?? ""), authMatchesFake: options.headers?.authorization === "Bearer p4-loopback-mock-only" });
    if (process.env.P4_FAKE_SCENARIO === "429") return { statusCode: 429, data: JSON.stringify({ error: { message: "mock rate limit" } }), responseOptions: { headers: { "content-type": "application/json" } } };
    const content = answerFor(kind);
    const payload = { id: `mock-p4-${index + 1}`, model: "deepseek-flash", choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } };
    return { statusCode: 200, data: JSON.stringify(payload), responseOptions: { headers: { "content-type": "application/json" } } };
  });
}
setGlobalDispatcher(agent);
const capturePath = process.env.P4_FAKE_CAPTURE_PATH;
if (!capturePath) throw new Error("P4 fake provider capture path is required");
process.on("exit", () => {
  const resolved = path.resolve(capturePath);
  const root = path.resolve(fileURLToPath(new URL("../.data/fiscal-p4-pilot/", import.meta.url)));
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("P4 fake provider capture must stay inside ignored .data/fiscal-p4-pilot");
  writeFileSync(resolved, `${JSON.stringify({ requests }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
});
