import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { PROMPT_VERSIONS } from "@aihot/backend/editorial/analyze";
import { validateFrozenP4Manifest, type FrozenManifest } from "@aihot/backend/jobs/p4-pilot";

const ids = ["p4prep_treasury_20261008", "p4prep_omo192_20261008"];
const sourceIds = ["mof-treasury-debt-data", "pboc-open-market"];
const hashes = ["8".repeat(64), "a".repeat(64)];
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => nested && typeof nested === "object" && !Array.isArray(nested)
    ? Object.fromEntries(Object.entries(nested as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) : nested);
}
function fixture(): FrozenManifest {
  return {
    schema: "fiscal-p4-pilot-readiness/v1", mode: "READ_ONLY_DRY_RUN", ready: true, database: { name: "fiscalhot_p4_preparation_test" },
    requestedArticleIds: [...ids], promptVersions: { ...PROMPT_VERSIONS }, manifestHash: "",
    records: ids.map((id, i) => ({
      id, title: `标题 ${i}`, url: `https://example.gov.cn/${i}`, source: { id: sourceIds[i]!, kind: "web_list", tier: "T1" }, revision: 1,
      contentHash: hashes[i]!, revisionContentHash: hashes[i]!, bodyStatus: "ok", accepted: true,
    })),
  };
}
function freeze(m: FrozenManifest): FrozenManifest {
  const { manifestHash: _old, ...body } = m;
  const manifestHash = createHash("sha256").update(canonical(body)).digest("hex");
  return { ...body, manifestHash };
}

test("bounded executor accepts only the exact approved, ordered two-article manifest and explicit caps", () => {
  const manifest = freeze(fixture());
  assert.deepEqual(validateFrozenP4Manifest(manifest, manifest.manifestHash, 10).map((row) => row.id), ids);
  assert.deepEqual(validateFrozenP4Manifest(manifest, manifest.manifestHash, 20).map((row) => row.source.id), sourceIds);
  for (const limit of [undefined, 0, 5, 11, 100]) assert.throws(() => validateFrozenP4Manifest(manifest, manifest.manifestHash, limit as never));
  assert.throws(() => validateFrozenP4Manifest(manifest, "0".repeat(64), 10), /invalid or changed/);
});

test("bounded executor rejects changed order, source, prompt set, or non-ready content before a provider can be selected", () => {
  const mutations = [
    (m: FrozenManifest) => { m.requestedArticleIds.reverse(); },
    (m: FrozenManifest) => { m.records[0]!.source.id = "xiamen-finance-debt"; },
    (m: FrozenManifest) => { m.promptVersions.prefilter = "changed"; },
    (m: FrozenManifest) => { m.records[1]!.bodyStatus = "unconfirmed"; },
    (m: FrozenManifest) => { m.records[0]!.accepted = false; },
    (m: FrozenManifest) => { m.records[0]!.contentHash = "bad"; },
  ];
  for (const mutate of mutations) {
    const changed = fixture();
    mutate(changed);
    const manifest = freeze(changed);
    assert.throws(() => validateFrozenP4Manifest(manifest, manifest.manifestHash, 10));
  }
});
