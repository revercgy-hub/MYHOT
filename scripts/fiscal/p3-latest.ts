#!/usr/bin/env node
import { parseArgs } from "node:util";
import type { SourceRow } from "../../packages/backend/src/sources/types.ts";

const args = parseArgs({
  options: {
    "database-url": { type: "string" },
    "source-ids": { type: "string" },
    execute: { type: "boolean", default: false },
  },
  strict: true,
});

function assertTestLoopbackDatabase(value: string | undefined): { url: string; name: string } {
  if (!value) throw new Error("--database-url must explicitly identify a loopback *_test database");
  const parsed = new URL(value);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) ||
      !["127.0.0.1", "::1", "localhost"].includes(parsed.hostname.toLowerCase().replace(/^\[|\]$/gu, ""))) {
    throw new Error("--database-url must use loopback PostgreSQL");
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\//u, ""));
  if (!/^[a-z0-9_]+_test$/iu.test(name)) throw new Error("--database-url must name an explicit *_test database");
  return { url: parsed.toString(), name };
}

function parseSourceIds(value: string | undefined): string[] {
  if (!value) throw new Error("--source-ids must explicitly name 1-4 sources");
  const ids = value.split(",").map((id) => id.trim());
  if (ids.length < 1 || ids.length > 4 || ids.some((id) => !/^[a-z0-9][a-z0-9_-]{0,79}$/iu.test(id)) || new Set(ids).size !== ids.length) {
    throw new Error("--source-ids must contain 1-4 unique valid source IDs");
  }
  return ids;
}

async function main() {
  const database = assertTestLoopbackDatabase(args.values["database-url"]);
  const sourceIds = parseSourceIds(args.values["source-ids"]);

  // Set every side-effect valve before loading backend config, DB or collector modules.
  process.env.DATABASE_URL = database.url;
  process.env.NODE_ENV = "test";
  for (const name of [
    "COLLECT_ENABLED", "MODEL_CALLS_ENABLED", "JINA_BODY_FALLBACK", "FEISHU_CONTENT_PUSH_ENABLED",
    "FEISHU_INTERNAL_ENABLED", "INDEXNOW_SUBMIT_ENABLED", "EMBEDDINGS_ENABLED", "OCR_RUN_ENABLED",
    "ALLOW_PRIVATE_NETWORK_FETCH", "WORKER_ENABLED",
  ]) process.env[name] = "false";
  for (const name of ["EGRESS_PROXY_URL", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]) delete process.env[name];
  process.env.AIHOT_CREDENTIALS_DIR = "/nonexistent-p3-latest-credentials";

  const { sql, closeDb } = await import("../../packages/backend/src/db.ts");
  try {
    const { collectLatestSource } = await import("../../packages/backend/src/sources/collect.ts");
    const { validateWebListPagination, usesWebListPagination } = await import("../../packages/backend/src/sources/web-list-pagination.ts");
    const rows = await sql<{ id: string; kind: SourceRow["kind"]; config: Record<string, any>; cursor: Record<string, any>; enabled: boolean }[]>`
      SELECT id, kind, config, cursor, enabled FROM sources WHERE id IN ${sql(sourceIds)}`;
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const id of sourceIds) {
      const source = byId.get(id);
      if (!source) throw new Error(`unknown source: ${id}`);
      if (source.kind !== "web_list" || !usesWebListPagination(source)) throw new Error(`source ${id} is not a paginated web_list`);
      const errors = validateWebListPagination(source.kind, source.config);
      if (errors.length) throw new Error(`source ${id} has invalid pagination config: ${errors.join(", ")}`);
      const cursor = source.cursor?.webListBackfill;
      if (!cursor || cursor.state !== "active" || cursor.coverage !== "unproven") throw new Error(`source ${id} has no active unproven history cursor`);
    }

    console.log(JSON.stringify({ mode: args.values.execute ? "execute" : "dry-run", database: database.name,
      sourceIds, baseGetsMax: sourceIds.length, serial: true, minIntervalMs: 1_000,
      sources: sourceIds.map((id) => ({ id, enabled: byId.get(id)!.enabled, url: byId.get(id)!.config.url,
        generationId: byId.get(id)!.cursor.webListBackfill.generationId, nextPageIndex: byId.get(id)!.cursor.webListBackfill.nextPageIndex })) }, null, 2));
    if (!args.values.execute) return;

    const results = [];
    for (let index = 0; index < sourceIds.length; index++) {
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, 1_000));
      const result = await collectLatestSource(sourceIds[index]!, { force: true });
      results.push(result);
      console.log(JSON.stringify(result));
      if (result.status === "failed") throw new Error(`latest collection failed for ${result.sourceId}: ${result.error ?? "unknown"}`);
    }
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
