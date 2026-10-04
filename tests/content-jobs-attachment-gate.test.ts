import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { tag } from "./setup.ts";
import { closeDb, sql } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { sweepUnprocessed, requeueFailed } from "@aihot/backend/jobs/content";
import { stopBoss } from "@aihot/backend/jobs/queue";

const SOURCE = `test-attachment-jobs-${tag()}`;
const SUFFIX = tag();
const marker = {
  version: 1 as const, state: "pending_parse" as const, kind: "attachment" as const,
  reason: "pdf_fetch_failed" as const, articleUrl: `https://example.com/attachment-job-${SUFFIX}`,
  attachments: [{ url: `https://example.com/attachment-job-${SUFFIX}.pdf`, title: "Official attachment" }],
};

before(async () => {
  await sql`INSERT INTO sources (id, name, kind, tier, participation_mode, next_fetch_at)
    VALUES (${SOURCE}, 'Attachment gate test', 'rss', 'T1', 'editorial', '2100-01-01')`;
});
after(async () => {
  await stopBoss();
  await closeDb();
});

test("sweeper and failed-job requeue skip attachment holds while raw-null controls still flow", async () => {
  const ordinary = await upsertMaterial({
    sourceId: SOURCE, url: `https://example.com/ordinary-${SUFFIX}`, title: "Ordinary", bodyText: "A complete test body", bodyStatus: "ok", via: "fetch",
  });
  const pending = await upsertMaterial({
    sourceId: SOURCE, url: marker.articleUrl, title: "Pending", bodyText: "A complete test body", bodyStatus: "ok", attachmentDiagnostic: marker, via: "fetch",
  });
  await sql`UPDATE articles SET raw = NULL, created_at = now() - interval '10 minutes', processing_state = 'new', processing_queued_at = NULL
    WHERE id = ${ordinary.articleId}`;
  await sql`UPDATE articles SET created_at = now() - interval '10 minutes', processing_state = 'new', processing_queued_at = NULL
    WHERE id = ${pending.articleId}`;

  const swept = await sweepUnprocessed();
  assert.ok(swept.enqueued >= 1, "the ordinary raw-null row remains eligible");
  const ordinaryJobs = await sql`SELECT 1 FROM pgboss.job WHERE data->>'articleId' = ${ordinary.articleId}`;
  const pendingJobs = await sql`SELECT 1 FROM pgboss.job WHERE data->>'articleId' = ${pending.articleId}`;
  assert.ok(ordinaryJobs.length > 0);
  assert.equal(pendingJobs.length, 0);

  await sql`UPDATE articles SET processing_state = 'failed', processing_queued_at = NULL, discovered_at = now()
    WHERE id IN (${ordinary.articleId}, ${pending.articleId})`;
  const requeued = await requeueFailed(null);
  assert.ok(requeued.requeued >= 1, "raw-null ordinary failures remain eligible for requeue");
  const states = await sql<{ id: string; processing_state: string }[]>`SELECT id, processing_state FROM articles WHERE id IN (${ordinary.articleId}, ${pending.articleId})`;
  assert.equal(states.find((row) => row.id === ordinary.articleId)?.processing_state, "new");
  assert.equal(states.find((row) => row.id === pending.articleId)?.processing_state, "failed");
});
