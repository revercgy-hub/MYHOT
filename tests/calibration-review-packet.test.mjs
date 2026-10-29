import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { buildReviewPacket } from "../scripts/fiscal/calibration-review-packet.mjs";
const bodyText = "财政部门公布预算执行数据。";
const bodySha256 = createHash("sha256").update(bodyText).digest("hex");
const row = { caseId: "case-a", title: "预算执行", sourceName: "财政部门", publishedAt: "2026-10-29", url: "https://example.gov.cn/a",
  bodyText, bodySha256, gold: "reject", selected: true, score: 80, threshold: 60 };
test("human packet binds original body and leaves every decision pending without exposing prior labels or scores", () => {
  const packet = buildReviewPacket({ cases: [row] }, [row.caseId], [row.caseId]);
  assert.equal(packet.cases[0].bodyText, bodyText);
  assert.equal(packet.cases[0].bodySha256, bodySha256);
  assert.equal(packet.cases[0].humanAnnotation.decision, null);
  for (const key of ["gold", "selected", "score", "threshold"]) assert.equal(key in packet.cases[0], false);
});
test("human packet rejects changed body, duplicate or unknown identities and unsafe URLs", () => {
  assert.throws(() => buildReviewPacket({ cases: [{ ...row, bodyText: "改写正文" }] }, [row.caseId], [row.caseId]), /hash/u);
  assert.throws(() => buildReviewPacket({ cases: [row] }, [row.caseId, row.caseId]), /unique/u);
  assert.throws(() => buildReviewPacket({ cases: [row, row] }, [row.caseId], [row.caseId]), /duplicate/u);
  assert.throws(() => buildReviewPacket({ cases: [row] }, ["unknown"], ["unknown"]), /missing/u);
  assert.throws(() => buildReviewPacket({ cases: [{ ...row, url: "file:///private" }] }, [row.caseId], [row.caseId]), /URL/u);
  assert.throws(() => buildReviewPacket({ cases: [row] }, [row.caseId], []), /development scope/u);
});
