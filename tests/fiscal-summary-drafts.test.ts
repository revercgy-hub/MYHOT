import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { SESSION_COOKIE } from "@aihot/backend/admin/auth";
import { config } from "@aihot/backend/config";
import { getSummaryDraft, reviewSummaryDrafts, SummaryDraftSchema, summaryDraftId, writeSummaryDraft } from "@aihot/backend/admin/summary-drafts";
import { sha256 } from "@aihot/backend/lib/ids";
import { buildApp } from "../apps/api/src/app.ts";
import { acquireSummaryDraftExecutionLock, assertNightWindow, executeRoster, installLocalFetchGuard, parseSummaryDraftRoster, runWithinNightWindow } from "../scripts/fiscal/nas-summary-draft-nightly.ts";
import { tag } from "./setup.ts";

const T = tag();
const app = await buildApp();
const sourceId = `summary-draft-${T}`;
const userName = `summary-draft-admin-${T}`;
const email = `${userName}@example.invalid`;
const token = randomBytes(32).toString("base64url");
const csrf = `summary-draft-csrf-${T}`;
const cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}`;
const adminHeaders = { cookie, "x-csrf-token": csrf, "content-type": "application/json" };
let actor = "";
const bodyText = `原始正文 ${T}：财政部门发布了新的预算执行进展，正文包含可供人工核对的完整事实。`;
const bodyHash = sha256(bodyText);
const articleIds = [`sdapprove${T}`, `sdreject${T}`, `sdstale${T}`, `sdreceipt${T}`];
const artifactIds: string[] = [];
const receiptIds: number[] = [];
const draftShas = new Map<string, string>();
const dataDraftDir = path.join(config.dataDir, "summary-drafts");

async function addDraft(articleId: string, index: number) {
  const [article] = await sql<{ article_row_text: string; source_row_text: string; revision: number; content_hash: string; title: string; url: string; published_at: Date }[]>`
    SELECT to_jsonb(a)::text AS article_row_text,to_jsonb(s)::text AS source_row_text,a.revision,a.content_hash,a.title,a.url,a.published_at
    FROM articles a JOIN sources s ON s.id=a.source_id WHERE a.id=${articleId}`;
  const promptVersion = "test-summary-prompt-v1";
  const user = `Frozen prompt for ${articleId}`;
  const system = "";
  const userHash = sha256(user);
  const model = "qwen3.5:9b";
  const draftId = summaryDraftId({ articleId, revision: article!.revision, bodySha256: bodyHash, promptVersion, userSha256: userHash, model });
  artifactIds.push(draftId);
  const request = { promptVersion, systemHash: sha256(system), userHash, userChars: user.length, temperature: 0.2, maxTokens: 2048 };
  const [receipt] = await sql<{ id: number }[]>`
    INSERT INTO receipts (logical_key,service,model,purpose,subject,status,request,response,attempts,completed_at)
    VALUES (${`summary-draft-test:${T}:${index}`},'llm',${model},'summary-draft',${draftId},'completed',${sql.json(request)},
      ${sql.json({ choices: [{ message: { content: "verified by reviewer" } }] })},1,now()) RETURNING id`;
  receiptIds.push(receipt!.id);
  await sql`INSERT INTO receipt_attempts (receipt_id,attempt,service,model,status,finished_at)
    VALUES (${receipt!.id},1,'llm',${model},'received',now())`;
  const draft = {
    format: "summary-draft.v1" as const, draftId, runId: `collector-${T}`, createdAt: new Date().toISOString(),
    article: { articleId, sourceId, sourceName: "Test summary source", url: article!.url, title: article!.title,
      publishedAt: article!.published_at.toISOString(), revision: article!.revision, contentHash: article!.content_hash,
      bodyText, bodySha256: bodyHash, articleRowSha256: sha256(article!.article_row_text), sourceRowSha256: sha256(article!.source_row_text) },
    prompt: { model: "default" as const, providerModel: model as "qwen3.5:9b", promptVersion, system, user, systemSha256: sha256(system), userSha256: userHash },
    databaseExpectations: { analysisCount: 0 as const, overrideRowSha256: null, publicationRowSha256: null,
      sourceEnabled: false as const, sourceSiteFulltext: false as const, sourceSyndicateFulltext: false as const },
    output: { titleZh: `人工核对标题 ${index}`, summaryZh: `人工核对摘要 ${index}`, selected: false as const,
      score: null, reason: null, category: "fiscal-policy", tags: ["预算管理"] },
    provider: { receiptId: receipt!.id, service: "llm" as const, model: model as "qwen3.5:9b", purpose: "summary-draft" as const, attempts: 1 as const, status: "completed" as const },
  };
  const written = await writeSummaryDraft(draft);
  draftShas.set(draftId, written.draftSha256);
  return draftId;
}

before(async () => {
  await sql`INSERT INTO admin_users (email,display_name) VALUES (${email},${userName})`;
  const [user] = await sql<{ id: number }[]>`SELECT id FROM admin_users WHERE email=${email}`;
  actor = `admin:${user!.id}`;
  await sql`INSERT INTO admin_sessions (id_hash,user_id,csrf_token,expires_at) VALUES (${sha256(token)},${user!.id},${csrf},now()+interval '1 hour')`;
  await sql`INSERT INTO sources (id,name,kind,tier,participation_mode,first_party,enabled,site_fulltext,syndicate_fulltext,next_fetch_at)
    VALUES (${sourceId},'Test summary source','rss','T2','editorial',true,false,false,false,'2100-01-01')`;
  for (const [index, articleId] of articleIds.entries()) {
    const title = `财政预算进展公告 ${index}`;
    const url = `https://example.invalid/summary-draft/${articleId}`;
    const publishedAt = new Date(Date.now() - 60_000);
    const contentHash = sha256(`${title}\u0001${bodyText}`);
    await sql`INSERT INTO articles (id,source_id,identity_key,url,title,language,published_at,discovered_at,timeline_at,revision,content_hash,body_text,body_status)
      VALUES (${articleId},${sourceId},${`identity-${articleId}`},${url},${title},'zh',${publishedAt},now(),${publishedAt},1,${contentHash},${bodyText},'ok')`;
  }
  for (const [index, articleId] of articleIds.entries()) await addDraft(articleId, index);
});

after(async () => {
  for (const id of artifactIds) await rm(path.join(dataDraftDir, `${id}.json`), { force: true });
  await sql`DELETE FROM audit_log WHERE actor=${actor} OR subject LIKE ${`summary-draft:%${T}%`}`;
  await sql`DELETE FROM articles WHERE id=ANY(${sql.array(articleIds)})`;
  await sql`DELETE FROM sources WHERE id=${sourceId}`;
  await sql`DELETE FROM receipts WHERE id=ANY(${sql.array(receiptIds)}::bigint[])`;
  await sql`DELETE FROM admin_sessions WHERE id_hash=${sha256(token)}`;
  await sql`DELETE FROM admin_users WHERE email=${email}`;
  await app.close();
  await closeDb();
});

test("nightly summary roster is strict, capped, and plan-only makes no provider attempts", async () => {
  const roster = parseSummaryDraftRoster({ schemaVersion: "summary-draft-roster.v1", sourceRunId: `collector-${T}`,
    anchorAt: "2026-10-28T19:00:00.000Z", articleIds: [articleIds[0]] });
  assert.equal(roster.articleIds.length, 1);
  const plan = await executeRoster({ roster, execute: false, now: new Date("2026-10-28T12:00:00.000Z") });
  assert.equal(plan.providerCalls, 0);
  assert.deepEqual(plan.results, [{ articleId: articleIds[0], status: "plan-only" }]);
  assert.throws(() => parseSummaryDraftRoster({ schemaVersion: "summary-draft-roster.v1", sourceRunId: `collector-${T}`,
    anchorAt: "2026-10-28T19:00:00.000Z", articleIds: Array.from({ length: 11 }, (_, i) => `row-${i}`) }), /10/u);
  assert.throws(() => parseSummaryDraftRoster({ schemaVersion: "summary-draft-roster.v1", sourceRunId: `collector-${T}`,
    anchorAt: "2026-10-28T19:00:00.000Z", articleIds: [articleIds[0], articleIds[0]] }), /duplicate/u);
  assert.doesNotThrow(() => assertNightWindow(new Date("2026-10-28T18:30:00.000Z")));
  assert.throws(() => assertNightWindow(new Date("2026-10-28T06:00:00.000Z")), /02:00/u);
  assert.throws(() => assertNightWindow(new Date("2026-10-28T22:00:00.000Z")), /02:00/u);
});

test("generic summary draft format accepts a bounded provider model and rejects provenance drift", async () => {
  const { draftSha256: _draftSha256, status: _status, reviewer: _reviewer, reviewedAt: _reviewedAt, ...saved } = await getSummaryDraft(artifactIds[0]!);
  const alternate = structuredClone(saved);
  alternate.prompt.providerModel = "local/other-model:1";
  alternate.provider.model = "local/other-model:1";
  assert.equal(SummaryDraftSchema.safeParse(alternate).success, true);
  alternate.provider.model = "qwen3.5:9b";
  assert.equal(SummaryDraftSchema.safeParse(alternate).success, false);
  alternate.prompt.providerModel = " ";
  alternate.provider.model = " ";
  assert.equal(SummaryDraftSchema.safeParse(alternate).success, false);
});

test("night cutoff aborts an in-flight call and prevents another dispatch", async () => {
  const start = new Date("2026-10-27T21:59:59.950Z"); // 05:59:59.950 Asia/Shanghai
  let fakeNow = start;
  const dispatched: string[] = [];
  const results = await runWithinNightWindow({ items: ["first", "second"], startedAt: start, now: () => fakeNow,
    dispatch: async (item, timeoutMs) => {
      dispatched.push(item);
      assert.ok(timeoutMs > 0 && timeoutMs <= 50);
      fakeNow = new Date("2026-10-27T22:00:00.000Z");
      const signal = AbortSignal.timeout(timeoutMs);
      await new Promise<void>((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted at night cutoff")), { once: true });
      });
    } });
  assert.deepEqual(dispatched, ["first"]);
  assert.deepEqual(results.map((row) => row.status), ["HOLD", "HOLD_night_window_closed"]);
});

test("database advisory lock excludes a concurrent operator and releases cleanly", async () => {
  const release = await acquireSummaryDraftExecutionLock();
  assert.equal(typeof release, "function");
  assert.equal(await acquireSummaryDraftExecutionLock(), null);
  await release!();
  const afterRelease = await acquireSummaryDraftExecutionLock();
  assert.equal(typeof afterRelease, "function");
  await afterRelease!();
});

test("local provider guard rejects redirects before a second loopback endpoint receives the body", async () => {
  let secondRequests = 0;
  const second = createServer((_request, response) => { secondRequests += 1; response.end("unexpected"); });
  await new Promise<void>((resolve) => second.listen(0, "127.0.0.1", resolve));
  const secondAddress = second.address();
  assert.ok(secondAddress && typeof secondAddress !== "string");
  const first = createServer((_request, response) => {
    response.writeHead(302, { location: `http://127.0.0.1:${secondAddress.port}/capture` }); response.end();
  });
  await new Promise<void>((resolve) => first.listen(0, "127.0.0.1", resolve));
  const firstAddress = first.address();
  assert.ok(firstAddress && typeof firstAddress !== "string");
  const previousKey = process.env.LLM_API_KEY;
  process.env.LLM_API_KEY = "local-test-key";
  const restore = installLocalFetchGuard({ baseUrl: `http://127.0.0.1:${firstAddress.port}/v1` });
  try {
    await assert.rejects(fetch(`http://127.0.0.1:${firstAddress.port}/v1/chat/completions`, {
      method: "POST", headers: { authorization: "Bearer local-test-key" }, body: "private prompt payload",
    }));
    assert.equal(secondRequests, 0);
  } finally {
    restore();
    if (previousKey === undefined) delete process.env.LLM_API_KEY; else process.env.LLM_API_KEY = previousKey;
    await new Promise<void>((resolve) => first.close(() => resolve()));
    await new Promise<void>((resolve) => second.close(() => resolve()));
  }
});

test("local provider guard aborts an in-flight request at the absolute night deadline", async () => {
  const previousKey = process.env.LLM_API_KEY;
  process.env.LLM_API_KEY = "local-test-key";
  const observed: { signal?: AbortSignal } = {};
  const fakeFetch: typeof fetch = async (_input, init) => {
    observed.signal = init?.signal ?? undefined;
    return await new Promise<Response>((_resolve, reject) => {
      observed.signal?.addEventListener("abort", () => reject(new Error("deadline abort")), { once: true });
    });
  };
  const restore = installLocalFetchGuard({ fetchImpl: fakeFetch, baseUrl: "http://127.0.0.1:11435/v1", deadlineAt: Date.now() + 25 });
  try {
    await assert.rejects(fetch("http://127.0.0.1:11435/v1/chat/completions", {
      method: "POST", headers: { authorization: "Bearer local-test-key" }, body: "private prompt payload",
      signal: AbortSignal.timeout(2_000),
    }), /deadline abort/u);
    assert.ok(observed.signal?.aborted);
  } finally {
    restore();
    if (previousKey === undefined) delete process.env.LLM_API_KEY; else process.env.LLM_API_KEY = previousKey;
  }
});

test("private summary draft API enforces admin/CSRF and publishes approved summaries to the public pool without body or selection", async () => {
  const noAuth = await app.inject({ method: "GET", url: "/api/admin/summary-drafts" });
  assert.equal(noAuth.statusCode, 401);
  const noCsrf = await app.inject({ method: "POST", url: "/api/admin/summary-drafts/review", headers: { cookie, "content-type": "application/json" }, payload: { items: [] } });
  assert.equal(noCsrf.statusCode, 403);
  const listed = await app.inject({ method: "GET", url: "/api/admin/summary-drafts?status=pending", headers: adminHeaders });
  assert.equal(listed.statusCode, 200);
  assert.equal((listed.json() as any).total >= 3, true);
  const draftId = artifactIds[0]!;
  const detail = await app.inject({ method: "GET", url: `/api/admin/summary-drafts/${draftId}`, headers: adminHeaders });
  assert.equal(detail.statusCode, 200);
  assert.equal((detail.json() as any).article.bodyText, bodyText);
  assert.equal((detail.json() as any).output.selected, false);

  const staleId = artifactIds[2]!;
  await sql`UPDATE articles SET body_text=${bodyText + " 改动"},revision=revision+1 WHERE id=${articleIds[2]}`;
  await sql`UPDATE receipts SET status='unknown' WHERE id=${receiptIds[3]}`;
  await sql`UPDATE receipt_attempts SET status='unknown',finished_at=now() WHERE receipt_id=${receiptIds[3]}`;
  const response = await app.inject({ method: "POST", url: "/api/admin/summary-drafts/review", headers: { ...adminHeaders, "idempotency-key": `summary-review-${T}` },
    payload: { items: [
      { draftId: artifactIds[0], decision: "approve", expectedDraftSha256: draftShas.get(artifactIds[0]!) },
      { draftId: artifactIds[1], decision: "reject", expectedDraftSha256: draftShas.get(artifactIds[1]!) },
      { draftId: staleId, decision: "approve", expectedDraftSha256: draftShas.get(staleId) },
      { draftId: artifactIds[3], decision: "reject", expectedDraftSha256: draftShas.get(artifactIds[3]!) },
    ] } });
  assert.equal(response.statusCode, 200);
  const result = response.json() as any;
  assert.equal(result.appliedCount, 2);
  assert.equal(result.failedCount, 2);
  assert.deepEqual(result.items.map((item: any) => item.status), ["approved", "rejected", "failed", "failed"]);
  assert.equal(result.items[3]?.error, "provider receipt evidence mismatch");
  const [projection] = await sql<{ visibility: string; body_mode: string; eligible: boolean; selected: boolean; score: number | null; reason: string | null; indexable: boolean; syndicate: boolean }[]>`
    SELECT visibility,body_mode,eligible,selected,score,reason,indexable,syndicate FROM publications WHERE article_id=${articleIds[0]}`;
  assert.deepEqual(projection, { visibility: "public", body_mode: "summary", eligible: true, selected: false, score: null, reason: null, indexable: false, syndicate: false });
  const publicPool = await app.inject({ method: "GET", url: "/api/site/pool?channel=all" });
  assert.equal(publicPool.statusCode, 200);
  const publicItem = (publicPool.json() as any).items.find((item: any) => item.id === articleIds[0]);
  assert.ok(publicItem);
  assert.equal(publicItem.selected, false);
  assert.equal(publicItem.score, null);
  assert.equal(JSON.stringify(publicItem).includes(bodyText), false);
  const publicDetail = await app.inject({ method: "GET", url: `/api/site/items/${articleIds[0]}` });
  assert.equal(publicDetail.statusCode, 200);
  assert.equal(publicDetail.json().selected, false);
  assert.equal(publicDetail.json().readingMode, "full");
  assert.equal(publicDetail.json().body, null);
  assert.equal(publicDetail.body.includes(bodyText), false);
  const rejected = await sql`SELECT count(*)::int AS n FROM publications WHERE article_id=${articleIds[1]}`;
  const stale = await sql`SELECT count(*)::int AS n FROM publications WHERE article_id=${articleIds[2]}`;
  const unknown = await sql`SELECT count(*)::int AS n FROM publications WHERE article_id=${articleIds[3]}`;
  assert.equal(rejected[0]?.n, 0);
  assert.equal(stale[0]?.n, 0);
  assert.equal(unknown[0]?.n, 0);
  assert.equal((await getSummaryDraft(artifactIds[3]!)).status, "pending");
  assert.equal((await getSummaryDraft(artifactIds[0]!)).status, "approved");
  assert.equal((await getSummaryDraft(artifactIds[1]!)).status, "rejected");

  const replay = await app.inject({ method: "POST", url: "/api/admin/summary-drafts/review", headers: { ...adminHeaders, "idempotency-key": `summary-review-${T}` },
    payload: { items: [
      { draftId: artifactIds[0], decision: "approve", expectedDraftSha256: draftShas.get(artifactIds[0]!) },
      { draftId: artifactIds[1], decision: "reject", expectedDraftSha256: draftShas.get(artifactIds[1]!) },
      { draftId: staleId, decision: "approve", expectedDraftSha256: draftShas.get(staleId) },
      { draftId: artifactIds[3], decision: "reject", expectedDraftSha256: draftShas.get(artifactIds[3]!) },
    ] } });
  assert.equal(replay.statusCode, 200);
  assert.equal((replay.json() as any).replayed, true);
  assert.equal((replay.json() as any).appliedCount, 2);
});
