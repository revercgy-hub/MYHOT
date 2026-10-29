#!/usr/bin/env node
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
let apiImageId = "UNBOUND";
if (args.length) {
  if (args.length !== 2 || args[0] !== "--api-image-id" || !/^sha256:[a-f0-9]{64}$/u.test(args[1])) {
    console.error("SUMMARY_DRAFT_PREPARE_FAILED=INVALID_API_IMAGE_PIN");
    process.exit(1);
  }
  apiImageId = args[1];
}
const imagePinBound = apiImageId !== "UNBOUND";
const OUTPUT = path.join(ROOT, `.data/fiscal-qa/summary-draft-nightly-candidate-20261029-r6-${imagePinBound ? "bound" : "unbound"}`);
const WORKSPACE = "/vol2/1000/docker/fiscalhot-summary-draft-nightly-20261028";
const OPERATOR = "scripts/fiscal/nas-summary-draft-nightly.ts";
const LAUNCHER = "scripts/fiscal/nas-summary-draft-nightly-launcher.sh";
const INSTALLER = "scripts/fiscal/install-nas-summary-draft-nightly.sh";
const APP_CATALOG_SHA256 = "27af3250bbc472ed20019983093b43336cc1967b9ae3193e6b202da4df27ad3f";
const NODE_SHA256 = "e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb";
const BEGIN = "# BEGIN CODEX NAS SUMMARY DRAFT NIGHTLY v1";
const END = "# END CODEX NAS SUMMARY DRAFT NIGHTLY v1";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const ensurePrivateDir = (dir) => { mkdirSync(dir, { recursive: true, mode: 0o700 }); try { chmodSync(dir, 0o700); } catch {} };
const writePrivate = (file, content) => { writeFileSync(file, content, { flag: "wx", mode: 0o600 }); try { chmodSync(file, 0o600); } catch {} };
const copyPrivate = (from, to) => { copyFileSync(from, to, 0); try { chmodSync(to, 0o600); } catch {} };

if (existsSync(OUTPUT)) { console.error("SUMMARY_DRAFT_PREPARE_FAILED=CANDIDATE_OUTPUT_ALREADY_EXISTS"); process.exit(1); }
const operatorBytes = readFileSync(path.join(ROOT, OPERATOR));
const launcherBytes = readFileSync(path.join(ROOT, LAUNCHER));
const installerBytes = readFileSync(path.join(ROOT, INSTALLER));
const operatorSha = sha(operatorBytes);
const launcherSha = sha(launcherBytes);
ensurePrivateDir(path.dirname(OUTPUT));
ensurePrivateDir(OUTPUT);
for (const dir of ["source/scripts/fiscal", "tools", "cron"]) ensurePrivateDir(path.join(OUTPUT, dir));
copyPrivate(path.join(ROOT, OPERATOR), path.join(OUTPUT, "source", OPERATOR));
copyPrivate(path.join(ROOT, LAUNCHER), path.join(OUTPUT, "tools/nas-summary-draft-nightly-launcher.sh"));
copyPrivate(path.join(ROOT, INSTALLER), path.join(OUTPUT, "tools/install-nas-summary-draft-nightly.sh"));
writePrivate(path.join(OUTPUT, "tools/api-image-id"), `${apiImageId}\n`);
writePrivate(path.join(OUTPUT, "tools/operator.sha256"), `${operatorSha}\n`);
const runtimeManifest = {
  schemaVersion: "nas-summary-draft-candidate.v1",
  deploymentState: imagePinBound ? "PREPARED_BOUND_NOT_SCHEDULED" : "PREPARED_UNBOUND_NOT_SCHEDULED",
  imagePinBound,
  apiImageId,
  operatorSha256: operatorSha,
  launcherSha256: launcherSha,
  appCatalogSha256: APP_CATALOG_SHA256,
  nodeSha256: NODE_SHA256,
  workspace: WORKSPACE,
  dataDir: "/data",
  sharedLock: "/vol2/1000/docker/fiscalhot-understand-nightly/state/ollama-understand-nightly.lock",
  schedule: "03:30 Asia/Shanghai",
  sourceRunIdSemantics: "date-scoped database-input preparation ID; not a single collector run; each article is selected from current DB state and retains its own row/body hash and raw lineage",
  guardrails: { fixedSummarySources: 20, maxNightlyArticles: 10, maxProviderCalls: 10, localOnly: true, noRetry: true },
};
writePrivate(path.join(OUTPUT, "tools/summary-draft-manifest.json"), `${JSON.stringify(runtimeManifest, null, 2)}\n`);
const runtimeManifestSha = sha(readFileSync(path.join(OUTPUT, "tools/summary-draft-manifest.json")));
const entrypoint = `#!/bin/sh\nset -eu\ncd '${WORKSPACE}'\ntest "$(sha256sum tools/summary-draft-manifest.json | cut -c1-64)" = '${runtimeManifestSha}'\nexport SUMMARY_DRAFT_MANIFEST_SHA256='${runtimeManifestSha}'\ntest "$(sha256sum tools/nas-summary-draft-nightly-launcher.sh | cut -c1-64)" = '${launcherSha}'\nexec /bin/sh tools/nas-summary-draft-nightly-launcher.sh --execute\n`;
writePrivate(path.join(OUTPUT, "tools/summary-draft-entrypoint.sh"), entrypoint);
const entrypointSha = sha(readFileSync(path.join(OUTPUT, "tools/summary-draft-entrypoint.sh")));
const job = `30 3 * * * /bin/sh -c 'cd "${WORKSPACE}" && test "$(sha256sum tools/summary-draft-entrypoint.sh | cut -c1-64)" = "${entrypointSha}" && exec /bin/sh tools/summary-draft-entrypoint.sh' >> "${WORKSPACE}/logs/cron.log" 2>&1`;
if (Buffer.byteLength(job, "utf8") >= 512) { console.error("SUMMARY_DRAFT_PREPARE_FAILED=CRON_JOB_LINE_TOO_LONG"); process.exit(1); }
writePrivate(path.join(OUTPUT, "cron/owned-block.candidate.txt"), `${BEGIN}\nCRON_TZ=Asia/Shanghai\nTZ=Asia/Shanghai\n${job}\n${END}\n`);
const candidateManifest = {
  schemaVersion: "nas-summary-draft-candidate.v1",
  deploymentState: imagePinBound ? "LOCAL_PREPARED_BOUND_NOT_INSTALLED" : "LOCAL_PREPARED_UNBOUND_NOT_INSTALLED",
  imagePinBound,
  apiImageId,
  operatorSha256: operatorSha,
  launcherSha256: launcherSha,
  runtimeManifestSha256: runtimeManifestSha,
  entrypointSha256: entrypointSha,
  appCatalogSha256: APP_CATALOG_SHA256,
  installerSha256: sha(installerBytes),
  cronJobBytes: Buffer.byteLength(job, "utf8"),
  guardrails: runtimeManifest.guardrails,
  schedule: runtimeManifest.schedule,
  lock: runtimeManifest.sharedLock,
  cronInstall: "NOT_PERFORMED",
  modelCalls: "NOT_PERFORMED",
};
writePrivate(path.join(OUTPUT, "candidate-manifest.json"), `${JSON.stringify(candidateManifest, null, 2)}\n`);
console.log(`SUMMARY_DRAFT_CANDIDATE=${imagePinBound ? "BOUND_PREPARED" : "UNBOUND_TEMPLATE_PREPARED"}\nOUTPUT=${OUTPUT}\nOPERATOR_SHA256=${operatorSha}\nLAUNCHER_SHA256=${launcherSha}\nRUNTIME_MANIFEST_SHA256=${runtimeManifestSha}\nENTRYPOINT_SHA256=${entrypointSha}\nCRON_JOB_BYTES=${candidateManifest.cronJobBytes}\nCRON_INSTALL=NOT_PERFORMED\nMODEL_CALLS=NOT_PERFORMED`);
