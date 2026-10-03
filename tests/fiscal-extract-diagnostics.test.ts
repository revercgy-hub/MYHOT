import "./setup.ts";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { after, before, test } from "node:test";
import { config as backendConfig } from "@aihot/backend/config";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { tag } from "./setup.ts";
import { captureExtractBodyDiagnostic, runExtractArticleBodyDiagnostic } from "../scripts/fiscal/p3-extract-diagnostics.ts";

for (const name of ["COLLECT_ENABLED", "MODEL_CALLS_ENABLED", "INDEXNOW_SUBMIT_ENABLED", "FEISHU_CONTENT_PUSH_ENABLED", "FEISHU_INTERNAL_ENABLED", "JINA_BODY_FALLBACK"]) process.env[name] = "false";

const T = tag();
const sourceId = `p3-diagnostic-${T}`;
const shortTable = await readFile(new URL("./fixtures/fiscal-accounting-body/real-short-table.html", import.meta.url), "utf8");
const shortMultip = await readFile(new URL("./fixtures/fiscal-accounting-body/negative-short-multip.html", import.meta.url), "utf8");
const fullParagraph = await readFile(new URL("./fixtures/fiscal-accounting-body/real-nested-paragraph.html", import.meta.url), "utf8");
const pages: Record<string, string> = { "/success": shortTable, "/identity": shortTable, "/short": shortMultip, "/throw": fullParagraph };
const server = http.createServer((req, res) => {
  const body = pages[req.url ?? ""];
  res.writeHead(body ? 200 : 404, { "content-type": "text/html; charset=utf-8" });
  res.end(body ?? "");
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
// This fixture test alone permits the extractor to reach its bound localhost server.
const previousAllowPrivateNetworkFetch = backendConfig.allowPrivateNetworkFetch;
backendConfig.allowPrivateNetworkFetch = true;

const bodyPolicies = [
  { selector: ".my_doccontent > .TRS_Editor:has(table)", minTextChars: 1, table: { requiredHeaderCells: ["序号", "会计师事务所名称", "统一社会信用代码", "注销备案公告日期", "注销备案情形"], minCompleteDataRows: 1 } },
  { selector: ".my_doccontent > .TRS_Editor:has(p + p)", minTextChars: 200 },
];
const config = {
  detail: { bodyPolicies, publishedAtUtcOffset: "+08:00" },
  allowUrlPrefixes: [`${base}/`],
};
const fixtureIdentity = "从事证券服务业务会计师事务所注销备案名单";
const pubAt = new Date("2026-09-04T00:00:00+08:00");

async function insertArticle(suffix: string, path: string, title: string, publishedAt: Date) {
  const id = `p3-diag-${T}-${suffix}`;
  await sql`INSERT INTO articles (id, source_id, identity_key, url, title, published_at, discovered_at, timeline_at, body_status)
    VALUES (${id}, ${sourceId}, ${id}, ${`${base}${path}`}, ${title}, ${publishedAt}, now(), now(), 'pending')`;
  return id;
}

before(async () => {
  await sql`INSERT INTO sources (id, name, kind, config, enabled, site_fulltext, syndicate_fulltext)
    VALUES (${sourceId}, 'P3 extractor diagnostic localhost fixture', 'web_list', ${sql.json(config)}, false, false, false)`;
});

after(async () => {
  await sql`DELETE FROM articles WHERE source_id = ${sourceId}`;
  await sql`DELETE FROM sources WHERE id = ${sourceId}`;
  backendConfig.allowPrivateNetworkFetch = previousAllowPrivateNetworkFetch;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await stopBoss();
  await closeDb();
});

test("same extractArticleBody call captures success, identity failure, and short-body reason without body data", async () => {
  const successId = await insertArticle("success", "/success", fixtureIdentity, pubAt);
  const identityId = await insertArticle("identity", "/identity", "A different expected title", pubAt);
  const shortId = await insertArticle("short", "/short", "财政部工作提示", new Date("2026-10-01T01:00:00Z"));
  const originalWarn = console.warn;
  const forwarded: unknown[][] = [];
  console.warn = (...args: unknown[]) => { forwarded.push(args); };
  try {
    const success = await runExtractArticleBodyDiagnostic(successId);
    const identity = await runExtractArticleBodyDiagnostic(identityId);
    const short = await runExtractArticleBodyDiagnostic(shortId);
    for (const name of ["COLLECT_ENABLED", "MODEL_CALLS_ENABLED", "INDEXNOW_SUBMIT_ENABLED", "FEISHU_CONTENT_PUSH_ENABLED", "FEISHU_INTERNAL_ENABLED", "JINA_BODY_FALLBACK", "ALLOW_PRIVATE_NETWORK_FETCH"]) assert.equal(process.env[name], "false");
    assert.deepEqual(success, { articleId: successId, state: "ok", sourceId: null, failureReason: null });
    assert.deepEqual(identity, { articleId: identityId, state: "unconfirmed", sourceId, failureReason: "identity_mismatch" });
    assert.deepEqual(short, { articleId: shortId, state: "unconfirmed", sourceId, failureReason: "short_body_not_allowed" });
    assert.equal(forwarded.length, 2, "captured warnings still reach the original console.warn");
    const serialized = JSON.stringify([success, identity, short]);
    assert.doesNotMatch(serialized, /河南守正|91410100|PubDate|ArticleTitle|127\.0\.0\.1|headers|credential/i);
    assert.deepEqual(Object.keys(identity).sort(), ["articleId", "failureReason", "sourceId", "state"]);
  } finally {
    console.warn = originalWarn;
  }
});

test("unrelated concurrent warnings do not enter a capture, all warnings pass through, and throw restores console.warn", async () => {
  const articleId = `p3-diag-${T}-isolated`;
  const originalWarn = console.warn;
  const forwarded: unknown[][] = [];
  console.warn = (...args: unknown[]) => { forwarded.push(args); };
  let releaseOutside!: () => void;
  const outsideGate = new Promise<void>((resolve) => { releaseOutside = resolve; });
  const unrelated = (async () => {
    await outsideGate;
    console.warn(JSON.stringify({ level: "warn", msg: "source body selector declined", article: articleId, source: "unrelated", reason: "identity_mismatch", body: "must not be retained" }));
  })();
  const before = console.warn;
  try {
    const resultPromise = captureExtractBodyDiagnostic(articleId, async () => {
      releaseOutside();
      await unrelated;
      console.warn(JSON.stringify({ level: "warn", msg: "source body selector declined", article: articleId, source: "fixture-source", reason: "unexpected-private-reason" }));
      console.warn("ordinary warning", { headers: "secret-shaped test value" });
      throw new Error("fixture exception with private details");
    });
    const result = await resultPromise;
    assert.deepEqual(result, { articleId, state: "threw", sourceId: null, failureReason: null });
    assert.equal(console.warn, before, "the exact prior console.warn function is restored");
    assert.equal(forwarded.length, 3);
    assert.match(String(forwarded[0]?.[0]), /unrelated/);
    assert.match(String(forwarded[1]?.[0]), /unexpected-private-reason/);
    assert.deepEqual(forwarded[2], ["ordinary warning", { headers: "secret-shaped test value" }]);
    assert.doesNotMatch(JSON.stringify(result), /private details|headers|secret-shaped|body/);
  } finally {
    console.warn = originalWarn;
  }
});
