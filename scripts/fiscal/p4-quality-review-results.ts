import { closeSync, openSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { renderP4QualityReview } from "./p4-quality-review.ts";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const RESULTS_SCHEMA = "fiscal-p4-quality-review-results/v1";
const DIMENSIONS = {
  facts: ["accurate", "partially_wrong", "wrong", "unable_to_judge"],
  contentType: ["accurate", "partially_wrong", "wrong", "unable_to_judge"],
  taxonomy: ["accurate", "partially_wrong", "wrong", "unable_to_judge"],
  scoring: ["reasonable", "too_high", "too_low", "unable_to_judge"],
} as const;
type Dimension = keyof typeof DIMENSIONS;
type Identity = {
  articleId: string;
  sourceId: string;
  revision: number;
  contentHash: string;
  analysisId: number;
};
type Review = Identity & {
  reviewer: string | null;
  reviewedAt: string | null;
  dimensions: Record<Dimension, { judgment: string | null; reason: string | null }>;
};

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, any> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function requireNonempty(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function requireRunHash(report: Record<string, any>): string {
  if (typeof report.runHash !== "string" || !/^[a-f\d]{64}$/i.test(report.runHash)) {
    throw new Error("execution report.runHash must be a SHA-256 hex string");
  }
  return report.runHash.toLowerCase();
}

function readIdentities(reportInput: unknown, metadataInput: unknown): { runHash: string; identities: Identity[] } {
  // Reuse the established offline renderer as the authoritative report/metadata contract check.
  // Its output is deliberately discarded; it performs no I/O or side effects.
  renderP4QualityReview(reportInput, metadataInput);
  const report = requireRecord(reportInput, "execution report");
  const metadata = requireRecord(metadataInput, "article/analysis metadata");
  const runHash = requireRunHash(report);
  if (!Array.isArray(report.rows) || !Array.isArray(metadata.articles)) throw new Error("review inputs must contain rows and articles");
  const identities: Identity[] = report.rows.map((raw: unknown, index: number) => {
    const row = requireRecord(raw, `execution report.rows[${index}]`);
    return {
      articleId: requireNonempty(row.id, `execution report.rows[${index}].id`),
      sourceId: requireNonempty(row.sourceId, `execution report.rows[${index}].sourceId`),
      revision: row.revision,
      contentHash: typeof row.contentHash === "string" ? row.contentHash.toLowerCase() : "",
      analysisId: row.analysisId,
    };
  });
  return { runHash, identities };
}

function blankReview(identity: Identity): Review {
  return {
    ...identity,
    reviewer: null,
    reviewedAt: null,
    dimensions: {
      facts: { judgment: null, reason: null },
      contentType: { judgment: null, reason: null },
      taxonomy: { judgment: null, reason: null },
      scoring: { judgment: null, reason: null },
    },
  };
}

export function createP4QualityReviewResultsTemplate(report: unknown, metadata: unknown): Record<string, unknown> {
  const { runHash, identities } = readIdentities(report, metadata);
  return {
    schema: RESULTS_SCHEMA,
    runHash,
    reviews: identities.map(blankReview),
  };
}

function validateIdentity(value: unknown, expected: Identity, index: number): Identity {
  const row = requireRecord(value, `results.reviews[${index}]`);
  const actual: Identity = {
    articleId: requireNonempty(row.articleId, `results.reviews[${index}].articleId`),
    sourceId: requireNonempty(row.sourceId, `results.reviews[${index}].sourceId`),
    revision: row.revision,
    contentHash: typeof row.contentHash === "string" ? row.contentHash.toLowerCase() : "",
    analysisId: row.analysisId,
  };
  if (actual.articleId !== expected.articleId || actual.sourceId !== expected.sourceId
    || actual.revision !== expected.revision || actual.contentHash !== expected.contentHash
    || actual.analysisId !== expected.analysisId) {
    throw new Error(`results.reviews[${index}] identity does not match the execution report and metadata`);
  }
  return actual;
}

function validIsoTimestamp(value: string): boolean {
  const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,3})?(Z|([+-])(\d\d):(\d\d))$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone, , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysByMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysByMonth[month - 1]!) return false;
  if (zone !== "Z") {
    const offsetHour = Number(offsetHourText);
    const offsetMinute = Number(offsetMinuteText);
    if (offsetMinute > 59 || offsetHour > 14 || (offsetHour === 14 && offsetMinute !== 0)) return false;
  }
  return Number.isFinite(Date.parse(value));
}

function validateReview(raw: unknown, expected: Identity, index: number): { review: Review; pending: boolean; issues: Array<Record<string, unknown>> } {
  const row = requireRecord(raw, `results.reviews[${index}]`);
  const identity = validateIdentity(row, expected, index);
  const reviewer = row.reviewer === null ? null : requireNonempty(row.reviewer, `results.reviews[${index}].reviewer`);
  const reviewedAt = row.reviewedAt === null ? null : requireNonempty(row.reviewedAt, `results.reviews[${index}].reviewedAt`);
  if (reviewedAt !== null && !validIsoTimestamp(reviewedAt)) {
    throw new Error(`results.reviews[${index}].reviewedAt must be a valid ISO timestamp with an explicit timezone`);
  }
  const dimensionsInput = requireRecord(row.dimensions, `results.reviews[${index}].dimensions`);
  const dimensions = {} as Review["dimensions"];
  const issues: Array<Record<string, unknown>> = [];
  let dimensionPending = false;
  for (const dimension of Object.keys(DIMENSIONS) as Dimension[]) {
    const value = requireRecord(dimensionsInput[dimension], `results.reviews[${index}].dimensions.${dimension}`);
    const judgment = value.judgment === null ? null : requireNonempty(value.judgment, `results.reviews[${index}].dimensions.${dimension}.judgment`);
    const reason = value.reason === null ? null : requireNonempty(value.reason, `results.reviews[${index}].dimensions.${dimension}.reason`);
    if (judgment !== null && !(DIMENSIONS[dimension] as readonly string[]).includes(judgment)) {
      throw new Error(`results.reviews[${index}].dimensions.${dimension}.judgment is invalid`);
    }
    if (judgment === null) dimensionPending = true;
    const isIssue = judgment !== null && judgment !== "accurate" && judgment !== "reasonable" && judgment !== "unable_to_judge";
    if (isIssue && reason === null) throw new Error(`results.reviews[${index}].dimensions.${dimension}.reason is required for a quality issue`);
    dimensions[dimension] = { judgment, reason };
    if (isIssue) issues.push({ dimension, judgment, reason });
  }
  const pending = reviewer === null || reviewedAt === null || dimensionPending;
  return { review: { ...identity, reviewer, reviewedAt, dimensions }, pending, issues };
}

export function validateP4QualityReviewResults(reportInput: unknown, metadataInput: unknown, resultsInput: unknown): Record<string, unknown> {
  const { runHash, identities } = readIdentities(reportInput, metadataInput);
  const results = requireRecord(resultsInput, "results");
  if (results.schema !== RESULTS_SCHEMA) throw new Error(`results.schema must be ${RESULTS_SCHEMA}`);
  if (typeof results.runHash !== "string" || results.runHash.toLowerCase() !== runHash) throw new Error("results.runHash does not match the execution report");
  if (!Array.isArray(results.reviews)) throw new Error("results.reviews must be an array");
  const expectedById = new Map(identities.map((identity) => [identity.articleId, identity]));
  const seen = new Set<string>();
  const validated = results.reviews.map((raw: unknown, index: number) => {
    const row = requireRecord(raw, `results.reviews[${index}]`);
    const articleId = requireNonempty(row.articleId, `results.reviews[${index}].articleId`);
    if (seen.has(articleId)) throw new Error("results contain duplicate articleId values");
    seen.add(articleId);
    const expected = expectedById.get(articleId);
    if (!expected) throw new Error(`results.reviews[${index}] article is absent from the execution report`);
    return validateReview(raw, expected, index);
  });
  if (results.reviews.length !== identities.length) throw new Error("results must contain the same article rows as the execution report");
  for (const identity of identities) if (!seen.has(identity.articleId)) throw new Error("results are missing an execution report article");

  const incompleteCount = validated.filter((entry) => entry.pending).length;
  const status = incompleteCount ? "DRAFT_INCOMPLETE" : "REVIEW_COMPLETE";
  return {
    schema: "fiscal-p4-quality-issue-ledger/v1",
    status,
    runHash,
    pendingReviewCount: incompleteCount,
    systemClustering: "NOT_RUN",
    reviews: validated.map(({ review }) => review),
    qualityIssues: status === "REVIEW_COMPLETE" ? validated.flatMap(({ review, issues }) => issues.map((issue) => ({
      runHash,
      articleId: review.articleId,
      sourceId: review.sourceId,
      revision: review.revision,
      contentHash: review.contentHash,
      analysisId: review.analysisId,
      reviewer: review.reviewer,
      reviewedAt: review.reviewedAt,
      ...issue,
    }))) : [],
  };
}

function readJson(inputPath: string, label: string): unknown {
  try { return JSON.parse(readFileSync(path.resolve(inputPath), "utf8")) as unknown; }
  catch { throw new Error(`${label} JSON is invalid or cannot be read`); }
}

function writeExclusive(outputPath: string, value: unknown): void {
  const fd = openSync(path.resolve(outputPath), "wx", 0o600);
  try { writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8" }); }
  finally { closeSync(fd); }
}

function main(argv: string[]): number {
  const { values, positionals } = parseArgs({
    options: { out: { type: "string" }, help: { type: "boolean", default: false } },
    allowPositionals: true,
    strict: true,
    args: argv,
  });
  if (values.help) {
    console.log("Usage: node scripts/fiscal/p4-quality-review-results.ts template <execution-report.json> <article-analysis-metadata.json> [--out results.json]\n       node scripts/fiscal/p4-quality-review-results.ts validate <execution-report.json> <article-analysis-metadata.json> <filled-results.json> [--out issue-ledger.json]");
    return 0;
  }
  const [mode, reportPath, metadataPath, resultsPath, extra] = positionals;
  if (extra !== undefined) throw new Error("too many arguments");
  if (mode === "template" && reportPath && metadataPath && !resultsPath) {
    const template = createP4QualityReviewResultsTemplate(readJson(reportPath, "execution report"), readJson(metadataPath, "article/analysis metadata"));
    if (values.out) writeExclusive(values.out, template); else process.stdout.write(`${JSON.stringify(template, null, 2)}\n`);
    return 0;
  }
  if (mode === "validate" && reportPath && metadataPath && resultsPath) {
    const ledger = validateP4QualityReviewResults(
      readJson(reportPath, "execution report"),
      readJson(metadataPath, "article/analysis metadata"),
      readJson(resultsPath, "review results"),
    );
    if (values.out) writeExclusive(values.out, ledger); else process.stdout.write(`${JSON.stringify(ledger, null, 2)}\n`);
    return 0;
  }
  throw new Error("provide template <execution-report.json> <article-analysis-metadata.json> or validate <execution-report.json> <article-analysis-metadata.json> <filled-results.json>");
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_FILE)) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    console.error(error instanceof Error ? error.message : "P4 quality review results failed");
    process.exitCode = 2;
  }
}
