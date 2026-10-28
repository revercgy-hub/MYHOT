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
    console.error("PG17_BACKUP_PREPARE_FAILED=INVALID_API_IMAGE_PIN");
    process.exit(1);
  }
  apiImageId = args[1];
}
const bound = apiImageId !== "UNBOUND";
const OUTPUT = path.join(ROOT, `.data/fiscal-qa/pg17-daily-backup-candidate-20261029-r2-${bound ? "bound" : "unbound"}`);
const WORKSPACE = "/vol2/1000/docker/fiscalhot-pg17-backup-nightly";
const OPERATOR = "scripts/fiscal/nas-pg17-daily-backup.mjs";
const LAUNCHER = "scripts/fiscal/nas-pg17-daily-backup-launcher.sh";
const INSTALLER = "scripts/fiscal/install-nas-pg17-daily-backup.sh";
const BEGIN = "# BEGIN CODEX_FISCAL_PG17_BACKUP";
const END = "# END CODEX_FISCAL_PG17_BACKUP";
const LOCK = "/vol2/1000/docker/fiscalhot-understand-nightly/state/ollama-understand-nightly.lock";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const ensureDir = (dir) => { mkdirSync(dir, { recursive: true, mode: 0o700 }); chmodSync(dir, 0o700); };
const writePrivate = (file, content) => { writeFileSync(file, content, { flag: "wx", mode: 0o600 }); chmodSync(file, 0o600); };
const copyPrivate = (from, to) => { copyFileSync(from, to); chmodSync(to, 0o600); };

if (existsSync(OUTPUT)) { console.error("PG17_BACKUP_PREPARE_FAILED=CANDIDATE_OUTPUT_ALREADY_EXISTS"); process.exit(1); }
const operator = readFileSync(path.join(ROOT, OPERATOR));
const launcher = readFileSync(path.join(ROOT, LAUNCHER));
const installer = readFileSync(path.join(ROOT, INSTALLER));
const operatorSha = sha(operator);
const launcherSha = sha(launcher);
ensureDir(path.dirname(OUTPUT));
ensureDir(OUTPUT);
for (const dir of ["source/scripts/fiscal", "tools", "cron"]) ensureDir(path.join(OUTPUT, dir));
copyPrivate(path.join(ROOT, OPERATOR), path.join(OUTPUT, "source", OPERATOR));
copyPrivate(path.join(ROOT, LAUNCHER), path.join(OUTPUT, "tools/nas-pg17-daily-backup-launcher.sh"));
copyPrivate(path.join(ROOT, INSTALLER), path.join(OUTPUT, "tools/install-nas-pg17-daily-backup.sh"));
writePrivate(path.join(OUTPUT, "tools/operator.sha256"), `${operatorSha}\n`);
writePrivate(path.join(OUTPUT, "tools/api-image-id"), `${apiImageId}\n`);
const runtime = {
  schemaVersion: "nas-pg17-daily-backup-candidate.v1",
  deploymentState: bound ? "PREPARED_BOUND_NOT_SCHEDULED" : "PREPARED_UNBOUND_NOT_SCHEDULED",
  imagePinBound: bound,
  apiImageId,
  operatorSha256: operatorSha,
  launcherSha256: launcherSha,
  workspace: WORKSPACE,
  backupDir: "/data/pg17-daily-backups",
  database: "fiscalhot_staging",
  postgresMajor: 17,
  schedule: "01:00 Asia/Shanghai",
  sharedLock: LOCK,
  guardrails: { localOnly: true, noSettingsWrites: true, noRetentionDelete: true, noUpload: true, noRetry: true },
};
writePrivate(path.join(OUTPUT, "tools/pg17-backup-manifest.json"), `${JSON.stringify(runtime, null, 2)}\n`);
const runtimeSha = sha(readFileSync(path.join(OUTPUT, "tools/pg17-backup-manifest.json")));
const entrypoint = `#!/bin/sh\nset -eu\ncd '${WORKSPACE}'\ntest "$(sha256sum tools/pg17-backup-manifest.json | cut -c1-64)" = '${runtimeSha}'\ntest "$(sha256sum tools/nas-pg17-daily-backup-launcher.sh | cut -c1-64)" = '${launcherSha}'\nexec /bin/sh tools/nas-pg17-daily-backup-launcher.sh\n`;
writePrivate(path.join(OUTPUT, "tools/pg17-backup-entrypoint.sh"), entrypoint);
const entrypointSha = sha(readFileSync(path.join(OUTPUT, "tools/pg17-backup-entrypoint.sh")));
const job = `0 1 * * * /bin/sh -c 'cd "${WORKSPACE}" && test "$(sha256sum tools/pg17-backup-entrypoint.sh | cut -c1-64)" = "${entrypointSha}" && exec /bin/sh tools/pg17-backup-entrypoint.sh' >> "${WORKSPACE}/logs/cron.log" 2>&1`;
if (Buffer.byteLength(job, "utf8") >= 512) { console.error("PG17_BACKUP_PREPARE_FAILED=CRON_JOB_TOO_LONG"); process.exit(1); }
writePrivate(path.join(OUTPUT, "cron/owned-block.candidate.txt"), `${BEGIN}\nCRON_TZ=Asia/Shanghai\nTZ=Asia/Shanghai\n${job}\n${END}\n`);
const candidate = {
  schemaVersion: runtime.schemaVersion,
  deploymentState: bound ? "LOCAL_PREPARED_BOUND_NOT_INSTALLED" : "LOCAL_PREPARED_UNBOUND_NOT_INSTALLED",
  imagePinBound: bound,
  apiImageId,
  operatorSha256: operatorSha,
  launcherSha256: launcherSha,
  runtimeManifestSha256: runtimeSha,
  entrypointSha256: entrypointSha,
  installerSha256: sha(installer),
  cronJobBytes: Buffer.byteLength(job, "utf8"),
  markerBegin: BEGIN,
  markerEnd: END,
  schedule: runtime.schedule,
  lock: LOCK,
  guardrails: runtime.guardrails,
  cronInstall: "NOT_PERFORMED",
  backupRun: "NOT_PERFORMED",
};
writePrivate(path.join(OUTPUT, "candidate-manifest.json"), `${JSON.stringify(candidate, null, 2)}\n`);
console.log(`PG17_BACKUP_CANDIDATE=${bound ? "BOUND_PREPARED" : "UNBOUND_TEMPLATE_PREPARED"}\nOUTPUT=${OUTPUT}\nOPERATOR_SHA256=${operatorSha}\nLAUNCHER_SHA256=${launcherSha}\nRUNTIME_MANIFEST_SHA256=${runtimeSha}\nENTRYPOINT_SHA256=${entrypointSha}\nCRON_JOB_BYTES=${candidate.cronJobBytes}\nCRON_INSTALL=NOT_PERFORMED\nBACKUP_RUN=NOT_PERFORMED`);
