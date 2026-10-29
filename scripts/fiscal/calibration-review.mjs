import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

/** Review an existing development evaluation; never choose or apply a threshold. */
export function calibrationReview(report) {
  if (report.format !== "fiscal.native-selection.evaluation/v1" || report.split !== "development") throw Error("development evaluation required; holdout is not allowed");
  if (!Array.isArray(report.cases) || report.cases.length !== report.n || report.errors !== 0) throw Error("complete error-free evaluation required");
  const ids = new Set(), counts = { tp: 0, fp: 0, fn: 0, tn: 0 }, groups = new Map();
  const errors = [];
  for (const row of report.cases) {
    if (!row.caseId || ids.has(row.caseId) || !["select", "reject"].includes(row.gold) || !["select", "reject"].includes(row.decision)) throw Error("unique decisive cases required");
    ids.add(row.caseId);
    const outcome = row.gold === "select" ? (row.decision === "select" ? "tp" : "fn") : (row.decision === "select" ? "fp" : "tn");
    counts[outcome]++;
    const stratum = row.stratum ?? "unspecified";
    const group = groups.get(stratum) ?? { stratum, tp: 0, fp: 0, fn: 0, tn: 0 };
    group[outcome]++; groups.set(stratum, group);
    if (outcome === "fp" || outcome === "fn") errors.push({ ...row, outcome, reviewStatus: "NEEDS_HUMAN_REVIEW" });
  }
  for (const key of Object.keys(counts)) if (counts[key] !== report[key]) throw Error("confusion matrix mismatch");
  const sweep = report.sweep;
  if (report.sweepStatus !== "development-only" || !Array.isArray(sweep) || !sweep.length) throw Error("development threshold sweep required");
  for (const row of sweep) {
    const expected = { tp: 0, fp: 0, fn: 0, tn: 0 };
    if (!Number.isInteger(row.threshold) || row.threshold < 0 || row.threshold > 100) throw Error("invalid threshold");
    for (const item of report.cases) {
      const selected = item.relevance !== "block" && item.score !== null && item.score >= row.threshold;
      expected[item.gold === "select" ? (selected ? "tp" : "fn") : (selected ? "fp" : "tn")]++;
    }
    for (const key of Object.keys(expected)) if (expected[key] !== row[key]) throw Error("threshold sweep mismatch");
  }
  return { format: "fiscal.calibration-review/v1", split: "development", n: report.n, ...counts,
    strata: [...groups.values()], errors, thresholdComparison: sweep,
    decision: "REVIEW_REQUIRED_NO_THRESHOLD_CHANGE", humanSignoff: null,
    limitations: ["Development-only descriptive comparison", "Consumed holdout must not be reused for tuning", "No evidence for absent source tiers", "Human error signoff and independent validation remain required"] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw Error("usage: node scripts/fiscal/calibration-review.mjs evaluation.json review.json");
  const bytes = readFileSync(input);
  const result = { ...calibrationReview(JSON.parse(bytes)), inputSha256: createHash("sha256").update(bytes).digest("hex") };
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ n: result.n, tp: result.tp, fp: result.fp, fn: result.fn, tn: result.tn, errorsForReview: result.errors.length, decision: result.decision }));
}
