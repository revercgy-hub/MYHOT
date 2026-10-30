import { createHash } from "node:crypto";
import { parse } from "@babel/parser";
import { load } from "cheerio";
import { fromHtml, allowed } from "../../packages/backend/src/sources/web-list.ts";
import type { SourceRow } from "../../packages/backend/src/sources/types.ts";
import { decodeCapturedResponse } from "./nas-candidate-batch.ts";

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

/** Inspect literal declarations without running untrusted publisher JavaScript or matching comments. */
export function declaredMofPages(html: string): { totalPages: number; currentPage: number } {
  const $ = load(html), totals: number[] = [], currents: number[] = [];
  for (const script of $("script:not([src])").toArray()) {
    const type = ($(script).attr("type") ?? "").toLowerCase();
    if (!["", "text/javascript", "application/javascript"].includes(type)) continue;
    const text = $(script).html() ?? "";
    if (!/\b(?:countPage|currentPage)\b/u.test(text)) continue;
    const file = parse(text, { sourceType: "script" });
    for (const statement of file.program.body) {
      if (statement.type !== "VariableDeclaration") continue;
      for (const declaration of statement.declarations) {
        if (declaration.id.type !== "Identifier" || declaration.init?.type !== "NumericLiteral") continue;
        const value = declaration.init.value;
        if (declaration.id.name === "countPage") totals.push(value);
        if (declaration.id.name === "currentPage") currents.push(value);
      }
    }
  }
  if (totals.length !== 1 || currents.length !== 1 || !Number.isSafeInteger(totals[0]) || !Number.isSafeInteger(currents[0]) ||
      totals[0]! < 1 || totals[0]! > 100 || currents[0]! < 0 || currents[0]! >= totals[0]!) throw new Error("Unambiguous bounded publisher page declarations required");
  return { totalPages: totals[0]!, currentPage: currents[0]! };
}

export interface CoverageCapture {
  pass: 1 | 2; pageIndex: number; url: string; observedAt: string;
  status: number; contentType: string; contentEncoding: string; bytes: number; sha256: string;
  eof: boolean; truncated: boolean; body: Buffer;
}
export type CoverageSource = SourceRow & { site_fulltext: boolean; syndicate_fulltext: boolean };

/** Full declared archive, two matching observations; never infer completeness from an old date or cap. */
export function reviewSourceCoverage(input: { source: CoverageSource; anchorAt: string; captures: CoverageCapture[] }) {
  const source = input.source, anchor = Date.parse(input.anchorAt), cutoff = anchor - 90 * 86400000;
  const configured = source.config.pagination as { mode?: string; maxPageIndex?: number } | undefined;
  if (source.kind !== "web_list" || source.enabled !== false || source.site_fulltext !== false || source.syndicate_fulltext !== false ||
      configured?.mode !== "mof_index_v1" || !Number.isSafeInteger(configured.maxPageIndex) || !Number.isFinite(anchor)) throw new Error("Configured disabled MOF pagination source required");
  const pages = input.captures.map(capture => {
    const expected = capture.pageIndex === 0 ? String(source.config.url) : new URL(`index_${capture.pageIndex}.htm`, String(source.config.url)).href;
    if (capture.url !== expected || ![1, 2].includes(capture.pass) || !Number.isSafeInteger(capture.pageIndex) || capture.pageIndex < 0 ||
        capture.status !== 200 || !/^text\/html(?:;|$)/iu.test(capture.contentType) || !capture.eof || capture.truncated ||
        capture.body.length !== capture.bytes || sha(capture.body) !== capture.sha256 || !Number.isFinite(Date.parse(capture.observedAt)) || Date.parse(capture.observedAt) < anchor) throw new Error("Complete exact raw page capture required");
    const html = decodeCapturedResponse(capture.body, capture.contentType, capture.contentEncoding), declaration = declaredMofPages(html);
    if (declaration.currentPage !== capture.pageIndex || declaration.totalPages > configured.maxPageIndex! + 1) throw new Error("Publisher page identity or configured bound mismatch");
    const rows = fromHtml(html, String(source.config.url), source, capture.url).map(row => {
      if (!allowed(row.url, source) || !row.title?.trim() || !row.publishedAt || !Number.isFinite(row.publishedAt.getTime()) || row.publishedAt.getTime() > anchor) throw new Error("Trusted dated listing rows required across the complete archive");
      return { url: row.url, title: row.title, publishedAt: row.publishedAt.toISOString() };
    });
    if (!rows.length || rows.length > 60) throw new Error("Nonempty bounded archive page required");
    return { ...declaration, pass: capture.pass, pageIndex: capture.pageIndex, observedAt: capture.observedAt, rawSha256: capture.sha256,
      decodedSha256: sha(html), fingerprint: sha(JSON.stringify(rows)), rows };
  });
  const total = pages[0]?.totalPages;
  if (!total || pages.length !== total * 2) throw new Error("Both passes must cover every publisher-declared page");
  if (pages.some((page, index) => index > 0 && Date.parse(page.observedAt) < Date.parse(pages[index - 1]!.observedAt)) ||
      Date.parse(pages.at(-1)!.observedAt) - anchor > 30 * 60000) throw new Error("Single bounded chronological observation window required");
  const all = new Map<string, { url: string; title: string; publishedAt: string }>(), fingerprints = new Set<string>();
  for (let i = 0; i < total; i++) {
    const first = pages[i]!, second = pages[total + i]!;
    if (first.pass !== 1 || second.pass !== 2 || first.pageIndex !== i || second.pageIndex !== i || first.totalPages !== total || second.totalPages !== total ||
        first.fingerprint !== second.fingerprint || Date.parse(second.observedAt) < Date.parse(first.observedAt)) throw new Error("Contiguous stable two-pass archive required");
    if (fingerprints.has(first.fingerprint)) throw new Error("Repeated page content cannot prove archive coverage");
    fingerprints.add(first.fingerprint);
    for (const row of first.rows) {
      const previous = all.get(row.url);
      if (previous && JSON.stringify(previous) !== JSON.stringify(row)) throw new Error("Conflicting duplicate article metadata");
      all.set(row.url, row);
    }
  }
  const recent = [...all.values()].filter(row => Date.parse(row.publishedAt) >= cutoff);
  return { format: "fiscal.source-coverage-evidence/v1", status: "VERIFIED_ARCHIVE_WINDOW_SNAPSHOT", sourceId: source.id,
    anchorAt: input.anchorAt, cutoffAt: new Date(cutoff).toISOString(), totalPages: total, observations: pages.length,
    uniqueArticles: all.size, recentArticles: recent.length, pages: pages.map(({ rows, ...page }) => ({ ...page, rowCount: rows.length })),
    recent, sourceAdmitted: false, gate4Passed: false,
    limitations: ["Configured column only, at these two observation passes", "Listing coverage does not prove body quality or ongoing stability", "No source, cursor, publication or selection update"] };
}
