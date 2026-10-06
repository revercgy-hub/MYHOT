import "./setup.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPendingWebListPage, createPendingWebListPage, webListMetadataSnapshotHash, type PendingWebListPage } from "@aihot/backend/sources/web-list-pagination";
import type { Candidate, SourceRow } from "@aihot/backend/sources/types";

const BASE = "https://gx.mof.gov.cn/gzdt/caizhengjiancha/";
const WINDOW = { anchorAt: "2026-10-06T00:00:00.000Z", cutoffAt: "2026-07-08T00:00:00.000Z" };

function source(): SourceRow {
  return {
    id: "metadata-window-fixture",
    kind: "web_list",
    config: {
      url: BASE,
      allowUrlPrefixes: [BASE],
      detail: { maxFetches: 2, titleSelector: "h1", publishedAtSelector: "time.published", publishedAtAuthoritative: true },
    },
    cursor: null,
  } as unknown as SourceRow;
}

function candidate(date: string): Candidate {
  return { url: `${BASE}2026/10/window.htm`, title: "Synthetic metadata window candidate", publishedAt: new Date(date) };
}

function classifiedPage(state: "resolved" | "excluded", date: string, outcome?: "outside_window"): PendingWebListPage {
  const fixture = source();
  const page = createPendingWebListPage(fixture, 0, [candidate("2026-10-01T00:00:00.000Z")]);
  page.candidates[0] = state === "resolved"
    ? { ...page.candidates[0]!, state, resolvedTitle: page.candidates[0]!.listTitle, titleSource: "list", resolvedPublishedAt: date, dateSource: "configured_rule" }
    : { ...page.candidates[0]!, state, outcome: outcome!, resolvedPublishedAt: date, dateSource: "configured_rule" };
  page.metadataHash = webListMetadataSnapshotHash(page.candidates);
  return page;
}

test("pending metadata state classifications must agree with the fixed trusted date window", () => {
  const fixture = source();
  const validOutside = classifiedPage("excluded", "2026-06-01T00:00:00.000Z", "outside_window");
  assert.doesNotThrow(() => assertPendingWebListPage(validOutside, fixture, 0, true, WINDOW));

  const forgedOutside = classifiedPage("excluded", "2026-10-01T00:00:00.000Z", "outside_window");
  assert.throws(() => assertPendingWebListPage(forgedOutside, fixture, 0, true, WINDOW), /invalid pending metadata page/);

  const validResolved = classifiedPage("resolved", "2026-10-01T00:00:00.000Z");
  assert.doesNotThrow(() => assertPendingWebListPage(validResolved, fixture, 0, true, WINDOW));

  const forgedFuture = classifiedPage("resolved", "2099-01-01T00:00:00.000Z");
  assert.throws(() => assertPendingWebListPage(forgedFuture, fixture, 0, true, WINDOW), /invalid pending metadata page/);
});
