import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { closeDb } from "../../packages/backend/src/db.ts";
import { executeBoundedP4, readP4ExecutionContract } from "../../packages/backend/src/jobs/p4-pilot.ts";
import { REPO_ROOT } from "../../packages/backend/src/config.ts";

function manifestPath(value: string): string {
  const base = path.resolve(REPO_ROOT, ".data/fiscal-p4-pilot");
  const full = path.resolve(REPO_ROOT, value);
  if (full === base || !full.startsWith(`${base}${path.sep}`) || path.extname(full).toLowerCase() !== ".json") throw new Error("--manifest must be a JSON file inside .data/fiscal-p4-pilot");
  return full;
}

async function main() {
  const { values } = parseArgs({ options: {
    manifest: { type: "string" }, "manifest-hash": { type: "string" }, "contract-hash": { type: "string" },
    "source-config-hash": { type: "string" }, "max-requests": { type: "string" }, "confirm-execute": { type: "boolean", default: false },
    "show-contract": { type: "boolean", default: false }, out: { type: "string" }, help: { type: "boolean", default: false },
  }, strict: true });
  if (values.help) {
    console.log("Usage: node scripts/fiscal/p4-execute.ts --show-contract | --manifest PATH --manifest-hash SHA256 --contract-hash SHA256 --source-config-hash SHA256 --max-requests 10|20 --confirm-execute [--out .data/fiscal-p4-pilot/result.json]");
    return;
  }
  if (values["show-contract"]) {
    console.log(JSON.stringify(await readP4ExecutionContract(), null, 2));
    return;
  }
  if (!values["confirm-execute"]) throw new Error("P4 execution is opt-in; pass --confirm-execute only after the exact manifest, cap, and run have been authorized");
  if (!values.manifest || !values["manifest-hash"] || !values["contract-hash"] || !values["source-config-hash"] || !values["max-requests"]) throw new Error("execution requires manifest, all frozen hashes, and an explicit 10 or 20 request cap");
  if (values["max-requests"] !== "10" && values["max-requests"] !== "20") throw new Error("--max-requests must be 10 or 20");
  const mpath = manifestPath(values.manifest);
  const manifest = JSON.parse(readFileSync(mpath, "utf8"));
  const out = values.out ?? `.data/fiscal-p4-pilot/execution-${Date.now()}.json`;
  const result = await executeBoundedP4({
    manifestPath: mpath, manifest, manifestHash: values["manifest-hash"], contractHash: values["contract-hash"], sourceConfigHash: values["source-config-hash"],
    maxRequests: Number(values["max-requests"]) as 10 | 20, confirmed: true, outputPath: out, startedBy: "explicit-cli",
  });
  console.log(JSON.stringify({ status: "completed", runHash: result.runHash, rows: result.rows, reportPath: path.relative(REPO_ROOT, result.reportPath) }, null, 2));
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "P4 bounded execution failed");
    process.exitCode = 1;
  }).finally(() => closeDb());
}
