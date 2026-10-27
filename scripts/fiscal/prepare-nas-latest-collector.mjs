#!/usr/bin/env node
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUTPUT = path.join(ROOT, ".data/fiscal-qa/nas-latest-collector-candidate-20261027");
const WORKSPACE = "/vol2/1000/docker/fiscalhot-latest-collector";
const OPERATOR = "scripts/fiscal/nas-candidate-batch.ts";
const OPERATOR_SHA256 = "3ae90e31a08da2db5b77b8a08eb3eea05726210efeea3fde37765a424fc4f7bf";
const LAUNCHER = "scripts/fiscal/nas-latest-collector-launcher.sh";
const INSTALLER = "scripts/fiscal/install-nas-latest-collector.sh";
const CATALOG = "industry/sources.json";
const CATALOG_SHA256 = "27af3250bbc472ed20019983093b43336cc1967b9ae3193e6b202da4df27ad3f";
const APP_CATALOG_SHA256 = "b5287d7f66ab91ed535d23128796f284f39c7c2c60f126082a820e891d5b252a";
const API_IMAGE = "sha256:54d1a34f104b665ccdecc60e82f4cb67acf114fb3171b742990464ee6d4c7bc6";
const NODE_SHA256 = "e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb";
const BEGIN = "# BEGIN CODEX NAS LATEST COLLECTOR v1";
const END = "# END CODEX NAS LATEST COLLECTOR v1";

function sha(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function ensurePrivateDir(dir) { mkdirSync(dir, { recursive: true, mode: 0o700 }); try { chmodSync(dir, 0o700); } catch {} }
function writePrivate(file, content) { writeFileSync(file, content, { mode: 0o600, flag: "wx" }); try { chmodSync(file, 0o600); } catch {} }
function copyPrivate(from, to) { copyFileSync(from, to, 0); try { chmodSync(to, 0o600); } catch {} }
function fail(reason) { console.error(`LATEST_COLLECTOR_PREPARE_FAILED=${reason}`); process.exit(1); }

if (process.argv.length !== 2) fail("NO_ARGUMENTS_ACCEPTED");
if (existsSync(OUTPUT)) fail("CANDIDATE_OUTPUT_ALREADY_EXISTS");
const operatorBytes = readFileSync(path.join(ROOT, OPERATOR));
const launcherBytes = readFileSync(path.join(ROOT, LAUNCHER));
const installerBytes = readFileSync(path.join(ROOT, INSTALLER));
const catalogBytes = readFileSync(path.join(ROOT, CATALOG));
if (sha(catalogBytes) !== CATALOG_SHA256) fail("APPROVED_CATALOG_HASH_MISMATCH");
if (sha(operatorBytes) !== OPERATOR_SHA256) fail("FROZEN_OPERATOR_HASH_MISMATCH");

ensurePrivateDir(path.dirname(OUTPUT));
ensurePrivateDir(OUTPUT);
for (const dir of ["source/scripts/fiscal", "source/industry", "tools", "cron"]) ensurePrivateDir(path.join(OUTPUT, dir));
copyPrivate(path.join(ROOT, OPERATOR), path.join(OUTPUT, "source", OPERATOR));
copyPrivate(path.join(ROOT, LAUNCHER), path.join(OUTPUT, "tools/nas-latest-collector-launcher.sh"));
copyPrivate(path.join(ROOT, INSTALLER), path.join(OUTPUT, "tools/install-nas-latest-collector.sh"));
copyPrivate(path.join(ROOT, CATALOG), path.join(OUTPUT, "source", CATALOG));

const operatorSha = sha(operatorBytes);
const launcherSha = sha(launcherBytes);
writePrivate(path.join(OUTPUT, "tools/operator.sha256"), `${operatorSha}\n`);
writePrivate(path.join(OUTPUT, "tools/catalog.sha256"), `${CATALOG_SHA256}\n`);
writePrivate(path.join(OUTPUT, "tools/app-catalog.sha256"), `${APP_CATALOG_SHA256}\n`);
writePrivate(path.join(OUTPUT, "tools/api-image-id"), `${API_IMAGE}\n`);
writePrivate(path.join(OUTPUT, "tools/node.sha256"), `${NODE_SHA256}\n`);

const entrypoint = `#!/bin/sh\nset -eu\ncd '${WORKSPACE}'\ntest "$(sha256sum tools/nas-latest-collector-launcher.sh | cut -c1-64)" = '${launcherSha}'\nexec /bin/sh tools/nas-latest-collector-launcher.sh\n`;
const entrypointPath = path.join(OUTPUT, "tools/latest-entrypoint.sh");
writePrivate(entrypointPath, entrypoint);
const entrypointSha = sha(readFileSync(entrypointPath));
const job = `0 6,12,18 * * * /bin/sh -c 'cd "${WORKSPACE}" && test "$(sha256sum tools/latest-entrypoint.sh | cut -c1-64)" = "${entrypointSha}" && exec /bin/sh tools/latest-entrypoint.sh' >> "${WORKSPACE}/logs/cron.log" 2>&1`;
if (Buffer.byteLength(job, "utf8") >= 512) fail("CRON_JOB_LINE_TOO_LONG");
writePrivate(path.join(OUTPUT, "cron/owned-block.candidate.txt"), `${BEGIN}\nCRON_TZ=Asia/Shanghai\nTZ=Asia/Shanghai\n${job}\n${END}\n`);

const manifest = {
  schemaVersion: "nas-latest-collector-candidate.v1", workspace: WORKSPACE,
  deploymentState: "LOCAL_PREPARED_NOT_INSTALLED", schedule: "06:00,12:00,18:00 Asia/Shanghai",
  lock: "/vol2/1000/docker/fiscalhot-understand-nightly/state/ollama-understand-nightly.lock",
  apiImage: API_IMAGE, nodeSha256: NODE_SHA256, approvedCatalogSha256: CATALOG_SHA256,
  appImageCatalogSha256: APP_CATALOG_SHA256, operatorSha256: operatorSha, launcherSha256: launcherSha,
  entrypointSha256: entrypointSha, cronJobBytes: Buffer.byteLength(job, "utf8"),
  installerSha256: sha(installerBytes),
  guardrails: { listRequests: 20, detailRequests: 30, totalGets: 50, serial: true,
    sourceFlags: false, globalCollect: false, modelCalls: false, worker: false,
    automaticSummary: false, selection: false, publication: false, planOnlyPerformed: false },
};
writePrivate(path.join(OUTPUT, "candidate-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`LATEST_COLLECTOR_CANDIDATE=PREPARED\nOUTPUT=${OUTPUT}\nOPERATOR_SHA256=${operatorSha}\nLAUNCHER_SHA256=${launcherSha}\nENTRYPOINT_SHA256=${entrypointSha}\nCRON_JOB_BYTES=${manifest.cronJobBytes}\nCRON_INSTALL=NOT_PERFORMED\nCOLLECTION=NOT_PERFORMED`);
