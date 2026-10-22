import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { applyCandidateBodyCas, collectFullArticleBaseline, type CandidateBodyCasRow } from "../scripts/fiscal/nas-candidate-body-cas.ts";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const stableContentHash = (title: string, body: string, excerpt: string | null) => sha256(
  [title.replace(/\s+/gu, " ").trim(), body.replace(/\s+/gu, " ").trim(), (excerpt ?? "").replace(/\s+/gu, " ").trim()].join("\u0001"));

test("418-row baseline counts followup articles as a verified subset, not extra rows", () => {
  const newArticles = Array.from({ length: 398 }, (_, id) => ({ id: `article_${id}`, row: `native-${id}` }));
  const pbocArticles = Array.from({ length: 20 }, (_, index) => ({ id: `article_${398 + index}`, row: `native-${398 + index}` }));
  const rowset = { rowsets: { newArticles: { rows: newArticles }, pbocArticles: { rows: pbocArticles },
    followupArticles: { rows: newArticles.slice(0, 16) } } };
  const baseline = collectFullArticleBaseline(rowset);
  assert.equal(baseline.size, 418);
  assert.equal(baseline.get("article_417"), "native-417");
  assert.throws(() => collectFullArticleBaseline({ rowsets: { ...rowset.rowsets,
    followupArticles: { rows: [{ id: "article_0", row: "conflicting-row" }] } } }), /exact subset/);
  assert.throws(() => collectFullArticleBaseline({ rowsets: { ...rowset.rowsets,
    pbocArticles: { rows: [{ id: "article_0", row: "conflicting-row" }] } } }), /conflicting native baseline/);
});

test("candidate body CAS validates and appends one or multiple native revisions inside transaction", async (t) => {
  await assert.rejects(applyCandidateBodyCas({} as never, []), /requires 1–150/);
  const databaseUrl = process.env.NAS_CANDIDATE_TEST_DATABASE_URL;
  if (!databaseUrl) return t.skip("requires a dedicated loopback *_test database URL");
  const url = new URL(databaseUrl);
  const database = decodeURIComponent(url.pathname.slice(1));
  assert.equal(database, "fiscalhot_nas_candidate_test", "only the pre-provisioned disposable test DB is allowed");
  assert.match(database, /^[a-z0-9_]+_(?:test|ci)$/iu);
  assert.ok(["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname), "test DB must be loopback only");

  const sql = postgres(databaseUrl, { max: 1, idle_timeout: 5 });
  const rollbackMarker = "CAS_TEST_ROLLBACK_EXPECTED";
  try {
    await assert.rejects(sql.begin(async (tx) => {
      const identity = (await tx`SELECT current_database() AS database, inet_server_addr()::text AS address`)[0];
      assert.equal(identity.database, database);
      assert.ok(["127.0.0.1", "::1"].includes(String(identity.address).replace(/\/\d+$/u, "")));
      const source = (await tx`SELECT id FROM sources WHERE id = 'mof-budget-work'`)[0];
      assert.ok(source, "fixture source must already exist");
      const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`.replace(/[^a-z0-9_]/giu, "");
      const fixtureIds = [1, 2, 3].map((n) => `casfix_${suffix}_${n}`);
      for (const [index, id] of fixtureIds.entries()) {
        const title = `隔离回归正文更新样例 ${index + 1}`;
        const identityKey = `url:https://example.invalid/${id}`;
        const url = `https://example.invalid/${id}`;
        await tx`INSERT INTO articles (id, source_id, identity_key, url, title, published_at, discovered_at, timeline_at,
          revision, content_hash, body_status) VALUES (${id}, 'mof-budget-work', ${identityKey}, ${url}, ${title},
          '2026-10-20T00:00:00Z', now(), now(), 1, ${sha256(`seed${index}`)}, 'pending')`;
        await tx`INSERT INTO article_revisions (article_id, revision, content_hash, title, body_text)
          VALUES (${id}, 1, ${sha256(`seed${index}`)}, ${title}, NULL)`;
      }
      const native = await tx`SELECT id, to_jsonb(a)::text AS row_text, source_id, revision, content_hash,
        title, excerpt FROM articles a WHERE id = ANY(${tx.array(fixtureIds, 1009)}) ORDER BY id`;
      const proposals: CandidateBodyCasRow[] = native.map((row: any, index: number) => {
        const bodyText = `这是隔离数据库中用于验证精确行比较与事务回滚的正文文本，第${index + 1}项。`.repeat(2);
        const bodyHtml = `<article><p>${bodyText}</p></article>`;
        const nextHash = stableContentHash(row.title, bodyText, row.excerpt);
        return { articleId: row.id, expectedRowText: row.row_text, expectedRowSha256: sha256(row.row_text),
          expectedRevision: Number(row.revision), expectedContentHash: row.content_hash,
          expectedTitle: row.title, expectedExcerpt: row.excerpt, expectedSourceId: row.source_id,
          bodyText, bodyHtml, bodyTextSha256: sha256(bodyText), bodyHtmlSha256: sha256(bodyHtml), nextContentHash: nextHash };
      });
      const one = await applyCandidateBodyCas(tx, proposals.slice(0, 1));
      assert.equal(one.length, 1);
      assert.equal(one[0]?.revision, 2);
      const many = await applyCandidateBodyCas(tx, proposals.slice(1));
      assert.equal(many.length, 2);
      assert.ok(many.every((row) => row.revision === 2));
      const finalRows = await tx`SELECT id, revision::int AS revision, body_status, content_hash,
        body_text, body_html FROM articles WHERE id = ANY(${tx.array(fixtureIds, 1009)}) ORDER BY id`;
      assert.equal(finalRows.length, 3);
      assert.ok(finalRows.every((row: any) => row.revision === 2 && row.body_status === "ok" && !!row.body_text && !!row.body_html));
      const revisionCounts = await tx`SELECT article_id, count(*)::int AS count FROM article_revisions
        WHERE article_id = ANY(${tx.array(fixtureIds, 1009)}) GROUP BY article_id`;
      assert.equal(revisionCounts.length, 3);
      assert.ok(revisionCounts.every((row: any) => row.count === 2));
      throw new Error(rollbackMarker);
    }), new RegExp(rollbackMarker));

    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`.replace(/[^a-z0-9_]/giu, "");
    const rollbackIds = [1, 2].map((n) => `casfail_${suffix}_${n}`);
    await sql.begin(async (tx) => {
      for (const [index, id] of rollbackIds.entries()) {
        const title = `跨行CAS回滚故障样例 ${index + 1}`;
        const originalHash = sha256(`rollback-seed-${index}`);
        await tx`INSERT INTO articles (id, source_id, identity_key, url, title, published_at, discovered_at, timeline_at,
          revision, content_hash, body_status) VALUES (${id}, 'mof-budget-work', ${`url:https://example.invalid/${id}`},
          ${`https://example.invalid/${id}`}, ${title}, '2026-10-20T00:00:00Z', now(), now(), 1, ${originalHash}, 'pending')`;
        await tx`INSERT INTO article_revisions (article_id, revision, content_hash, title, body_text)
          VALUES (${id}, 1, ${originalHash}, ${title}, NULL)`;
      }
    });
    try {
      const before = await sql`SELECT id, to_jsonb(a)::text AS row_text, source_id, revision, content_hash, title, excerpt
        FROM articles a WHERE id = ANY(${sql.array(rollbackIds, 1009)}) ORDER BY id`;
      const rollbackProposals: CandidateBodyCasRow[] = before.map((row: any, index: number) => {
        const bodyText = `第二目标CAS失配时，第一条更新也必须由PostgreSQL事务整体回滚，这是测试正文第${index + 1}条。`;
        const bodyHtml = `<article><p>${bodyText}</p></article>`;
        return { articleId: row.id, expectedRowText: row.row_text, expectedRowSha256: sha256(row.row_text),
          expectedRevision: Number(row.revision), expectedContentHash: row.content_hash, expectedTitle: row.title,
          expectedExcerpt: row.excerpt, expectedSourceId: row.source_id, bodyText, bodyHtml,
          bodyTextSha256: sha256(bodyText), bodyHtmlSha256: sha256(bodyHtml),
          nextContentHash: stableContentHash(row.title, bodyText, row.excerpt) };
      });
      await assert.rejects(sql.begin((tx) => applyCandidateBodyCas(tx, [rollbackProposals[0]!,
        { ...rollbackProposals[1]!, expectedSourceId: "deliberately-stale-source" }])), /baseline changed/);
      const after = await sql`SELECT id, revision::int AS revision, body_status, body_text, body_html
        FROM articles WHERE id = ANY(${sql.array(rollbackIds, 1009)}) ORDER BY id`;
      const revisionsAfter = await sql`SELECT article_id, count(*)::int AS count FROM article_revisions
        WHERE article_id = ANY(${sql.array(rollbackIds, 1009)}) GROUP BY article_id`;
      assert.equal(after.length, 2);
      assert.ok(after.every((row: any) => row.revision === 1 && row.body_status === "pending" && row.body_text === null && row.body_html === null));
      assert.equal(revisionsAfter.length, 2);
      assert.ok(revisionsAfter.every((row: any) => row.count === 1));
    } finally {
      await sql`DELETE FROM articles WHERE id = ANY(${sql.array(rollbackIds, 1009)})`;
    }
  } finally { await sql.end(); }
}
);
