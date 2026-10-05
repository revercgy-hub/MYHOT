// Public and export regressions for the source-specific strict body-ready policy.
// Runs only against the isolated *_test database established by tests/setup.ts; no provider or worker is used.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { updateSource } from "@aihot/backend/admin/sources";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { publishArticle, republishSource } from "@aihot/backend/publication/publish";
import { buildApp } from "../apps/api/src/app.ts";
import { tag } from "./setup.ts";

const T = tag();
const STRICT_SOURCE = `test-strict-body-${T}`;
const LEGACY_SOURCE = `test-legacy-body-${T}`;
const app = await buildApp();
let n = 0;

before(async () => {
  await sql`INSERT INTO sources (id, name, kind, config, tier, participation_mode, first_party, site_fulltext, syndicate_fulltext, enabled, next_fetch_at)
            VALUES (${STRICT_SOURCE}, ${`Strict body test ${T}`}, 'web_list', ${sql.json({})}, 'T1', 'editorial', true, false, false, false, '2100-01-01')`;
  await sql`INSERT INTO sources (id, name, kind, config, tier, participation_mode, first_party, site_fulltext, syndicate_fulltext, enabled, next_fetch_at)
            VALUES (${LEGACY_SOURCE}, ${`Legacy body test ${T}`}, 'rss', ${sql.json({})}, 'T1', 'editorial', true, false, false, false, '2100-01-01')`;
});

after(async () => {
  await app.close();
  await stopBoss();
  await closeDb();
});

const released = () => ({ releasedAt: new Date(Date.now() - 60_000) });

async function get(url: string) {
  const response = await app.inject({ method: "GET", url });
  return { status: response.statusCode, body: response.body };
}

async function unconfirmedArticle(sourceId: string, suffix: string, selected = true) {
  n += 1;
  const title = `合成标题-${T}-${suffix}`;
  const { articleId } = await upsertMaterial({
    sourceId,
    url: `https://example.test/${T}/${suffix}-${n}`,
    title,
    // Mirrors the observed Fujian failure shape without reproducing official text: no body, null raw,
    // and a short synthetic repeated-title excerpt (the recorded observation was 16 characters).
    excerpt: `合成标题${T.slice(0, 5)}合成标题`,
    bodyHtml: null,
    bodyText: null,
    bodyStatus: "unconfirmed",
    raw: null,
    via: "fetch",
    publishedAt: new Date(),
  });
  await sql`INSERT INTO analyses (article_id, input_revision, origin, relevance, category, title_zh, summary_zh, reason_zh, score, selected)
            VALUES (${articleId}, 1, 'rule', 'pass', 'fiscal-policy', ${title}, ${`合成摘要-${T}-${suffix}`}, ${`自动理由不得外泄-${T}-${suffix}`}, 91, ${selected})`;
  return { articleId, title, summary: `合成摘要-${T}-${suffix}` };
}

test("strict body opt-in gates current reads and republishes an end-cursor removal; manual selection stays safe", async () => {
  const item = await unconfirmedArticle(STRICT_SOURCE, "toggle");
  const legacy = await unconfirmedArticle(LEGACY_SOURCE, "legacy");
  await publishArticle(item.articleId, released());
  await publishArticle(legacy.articleId, released());

  const beforePool = JSON.parse((await get("/api/site/pool?channel=all")).body) as { items: Array<{ id: string; selected: boolean; reason: string | null }> };
  assert.ok(beforePool.items.some((row) => row.id === item.articleId && row.selected), "strict source behaves as legacy before opt-in");
  const beforeFeed = (await get("/feed.xml")).body;
  assert.ok(beforeFeed.includes(legacy.articleId), "legacy false/absent flag retains selected summary RSS");
  assert.ok(beforeFeed.includes(legacy.summary), "legacy RSS keeps its summary when full-text permission is false");

  const beforeSnapshot = JSON.parse((await get("/api/v1/selected/snapshot?fields=default&limit=1000")).body) as {
    cursor: string;
    items: Array<{ id: string; reason?: string | null }>;
  };
  assert.ok(beforeSnapshot.items.some((row) => row.id === item.articleId));
  const [storedSource] = await sql<{ updated_at: Date; config: Record<string, unknown> }[]>`SELECT updated_at, config FROM sources WHERE id = ${STRICT_SOURCE}`;
  const nextConfig = { ...storedSource!.config, _aihot: { requireBodyReadyForAutomaticSelection: true } };
  await updateSource(STRICT_SOURCE, { patch: { config: nextConfig }, version: storedSource!.updated_at.toISOString(), reason: "strict-body regression" }, "test");
  const [queued] = await sql<{ value: { status: string } }[]>`SELECT value FROM settings WHERE key = ${`republish.source:${STRICT_SOURCE}`}`;
  assert.equal(queued?.value.status, "queued", "changing the effective body policy queues source republication");

  // Live reads must apply current source config before the asynchronous republish has run.
  const pool = JSON.parse((await get("/api/site/pool?channel=all")).body) as { items: Array<{ id: string; selected: boolean; reason: string | null; summary: string | null }> };
  const heldPoolItem = pool.items.find((row) => row.id === item.articleId);
  assert.ok(heldPoolItem, "an editorial page remains available in the pool");
  assert.equal(heldPoolItem.selected, false);
  assert.equal(heldPoolItem.reason, null);
  assert.match(heldPoolItem.summary ?? "", /正文待解析/);
  const detail = JSON.parse((await get(`/api/site/items/${item.articleId}`)).body) as { selected: boolean; reason: string | null; body: unknown; summary: string | null };
  assert.equal(detail.selected, false);
  assert.equal(detail.reason, null);
  assert.equal(detail.body, null, "unconfirmed body is not exported from item detail");
  assert.match(detail.summary ?? "", /正文待解析/);
  const selectedItems = JSON.parse((await get("/api/v1/items?mode=selected&window=7d")).body) as { items: Array<{ id: string }> };
  assert.ok(!selectedItems.items.some((row) => row.id === item.articleId));
  for (const fields of ["default", "minimal"] as const) {
    const snapshot = JSON.parse((await get(`/api/v1/selected/snapshot?fields=${fields}&limit=1000`)).body) as { items: Array<{ id: string }> };
    assert.ok(!snapshot.items.some((row) => row.id === item.articleId), `${fields} snapshot omits the currently held item`);
  }
  assert.ok(!(await get("/feed.xml")).body.includes(item.articleId), "strict hold is hidden from selected RSS");

  const [lastBeforeRepublish] = await sql<{ seq: number; op: string }[]>`SELECT seq, op FROM selected_ledger WHERE article_id = ${item.articleId} ORDER BY seq DESC LIMIT 1`;
  const republished = await republishSource(STRICT_SOURCE);
  assert.ok(republished.reduced >= 1);
  const [lastAfterRepublish] = await sql<{ seq: number; op: string }[]>`SELECT seq, op FROM selected_ledger WHERE article_id = ${item.articleId} ORDER BY seq DESC LIMIT 1`;
  assert.equal(lastAfterRepublish?.op, "remove", "republish appends a real removal event");
  assert.ok(Number(lastAfterRepublish?.seq) > Number(lastBeforeRepublish?.seq), "the removal has a new ledger sequence");
  const changes = JSON.parse((await get(`/api/v1/selected/changes?cursor=${encodeURIComponent(beforeSnapshot.cursor)}&limit=100`)).body) as {
    cursor: string;
    changes: Array<{ op: string; id?: string; item?: { id: string; reason?: string | null } }>;
  };
  const itemChanges = changes.changes.filter((change) => change.id === item.articleId || change.item?.id === item.articleId);
  assert.ok(itemChanges.some((change) => change.op === "remove"), "a client at its previous end cursor receives a removal");
  assert.ok(!itemChanges.some((change) => change.op === "upsert" && change.item?.reason === `自动理由不得外泄-${T}-toggle`), "stale automatic reason is never exported");

  // The sole exception is an exact JSON boolean manual selection. It publishes as a safe summary,
  // without an automatic reason, body text, or full-text permission.
  await sql`INSERT INTO editorial_overrides (article_id, fields, updated_by)
            VALUES (${item.articleId}, ${sql.json({ selected: true })}, 'test')
            ON CONFLICT (article_id) DO UPDATE SET fields = EXCLUDED.fields, updated_by = EXCLUDED.updated_by, updated_at = now()`;
  await publishArticle(item.articleId, released());
  const manual = JSON.parse((await get(`/api/site/items/${item.articleId}`)).body) as { selected: boolean; reason: string | null; body: unknown; summary: string | null };
  assert.equal(manual.selected, true);
  assert.equal(manual.reason, null);
  const [manualProjection] = await sql<{ body_mode: string }[]>`SELECT body_mode FROM publications WHERE article_id = ${item.articleId}`;
  assert.equal(manualProjection?.body_mode, "summary");
  assert.equal(manual.body, null);
  assert.match(manual.summary ?? "", /正文待解析/);
  const manualChanges = JSON.parse((await get(`/api/v1/selected/changes?cursor=${encodeURIComponent(changes.cursor ?? beforeSnapshot.cursor)}&limit=100`)).body) as {
    changes: Array<{ op: string; id?: string; item?: { id: string; reason?: string | null; summary?: string | null } }>;
  };
  const manualUpsert = manualChanges.changes.find((change) => change.op === "upsert" && change.item?.id === item.articleId);
  assert.ok(manualUpsert, "manual selection is recorded as a selected upsert");
  assert.equal(manualUpsert.item?.reason, null, "manual selection carries no old automatic reason");
  assert.match(manualUpsert.item?.summary ?? "", /正文待解析/);
  for (const fields of ["default", "minimal"] as const) {
    const snapshot = JSON.parse((await get(`/api/v1/selected/snapshot?fields=${fields}&limit=1000`)).body) as {
      items: Array<Record<string, unknown> & { id: string }>;
    };
    const manualItem = snapshot.items.find((row) => row.id === item.articleId);
    assert.ok(manualItem, `${fields} snapshot admits the exact-boolean manual selection`);
    if (fields === "default") {
      assert.equal(manualItem.reason, null);
      assert.match(String(manualItem.summary ?? ""), /正文待解析/);
    } else {
      assert.ok(!Object.hasOwn(manualItem, "reason"), "minimal projection keeps its existing omission of reason");
      assert.ok(!Object.hasOwn(manualItem, "summary"), "minimal projection keeps its existing omission of summary");
    }
  }

  const [strictRow] = await sql<{ site_fulltext: boolean; syndicate_fulltext: boolean }[]>`SELECT site_fulltext, syndicate_fulltext FROM sources WHERE id = ${STRICT_SOURCE}`;
  assert.deepEqual(strictRow, { site_fulltext: false, syndicate_fulltext: false });
});

test("non-boolean or unrelated editorial overrides cannot release an automatic hold; grouped safe members remain", async () => {
  const strictItems = [
    await unconfirmedArticle(STRICT_SOURCE, "string-true"),
    await unconfirmedArticle(STRICT_SOURCE, "title-summary-relevance"),
  ];
  const legacyItem = await unconfirmedArticle(LEGACY_SOURCE, "group-safe", false);
  await sql`UPDATE sources SET config = ${sql.json({ _aihot: { requireBodyReadyForAutomaticSelection: true } })} WHERE id = ${STRICT_SOURCE}`;

  await sql`INSERT INTO editorial_overrides (article_id, fields, updated_by)
            VALUES (${strictItems[0]!.articleId}, ${sql.json({ selected: "true" })}, 'test'),
                   (${strictItems[1]!.articleId}, ${sql.json({ title: `人工标题-${T}`, summary: `人工摘要-${T}`, relevance: 'pass' })}, 'test')`;
  for (const item of strictItems) await publishArticle(item.articleId, released());
  await publishArticle(legacyItem.articleId, released());
  const [notManual] = await sql<{ selected: boolean; reason: string | null; body_mode: string }[]>`
    SELECT p.selected, p.reason, p.body_mode FROM publications p WHERE p.article_id = ${strictItems[0]!.articleId}`;
  const [textOverride] = await sql<{ selected: boolean; reason: string | null; body_mode: string }[]>`
    SELECT p.selected, p.reason, p.body_mode FROM publications p WHERE p.article_id = ${strictItems[1]!.articleId}`;
  assert.equal(notManual?.selected, false, "string true is not the exact JSON boolean exception");
  assert.equal(textOverride?.selected, false, "title, summary, and relevance overrides cannot release automatic selection");
  assert.equal(notManual?.reason, null);
  assert.equal(textOverride?.reason, null);
  assert.equal(notManual?.body_mode, "summary");
  assert.equal(textOverride?.body_mode, "summary");

  const publicId = randomUUID();
  const [story] = await sql<{ id: number }[]>`INSERT INTO stories (public_id, title, first_report_at, latest_at)
            VALUES (${publicId}, ${`Group body guard ${T}`}, now(), now()) RETURNING id`;
  const [fact] = await sql<{ id: number }[]>`INSERT INTO facts (public_id, story_id, title)
            VALUES (${`fact-${publicId}`}, ${story!.id}, ${`Fact body guard ${T}`}) RETURNING id`;
  await sql`INSERT INTO fact_articles (fact_id, article_id, role) VALUES
            (${fact!.id}, ${strictItems[0]!.articleId}, 'report'),
            (${fact!.id}, ${legacyItem.articleId}, 'report')`;
  await sql`UPDATE publications SET fact_id = ${fact!.id}, story_id = ${story!.id}
            WHERE article_id = ANY(${[strictItems[0]!.articleId, legacyItem.articleId]})`;
  const storyPage = JSON.parse((await get(`/api/site/stories/${publicId}`)).body) as { reportCount: number; timeline: Array<{ id: string }> };
  assert.ok(storyPage.timeline.some((report) => report.id === legacyItem.articleId), "safe legacy report remains in the group");
  assert.ok(!storyPage.timeline.some((report) => report.id === strictItems[0]!.articleId), "strict-held member is omitted from public group expansion");
});
