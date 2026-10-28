#!/bin/sh
set -eu
umask 077

readonly WORKSPACE=/vol2/1000/docker/fiscalhot-latest-collector-20261028
readonly NIGHT_LOCK=/vol2/1000/docker/fiscalhot-understand-nightly/state/ollama-understand-nightly.lock
readonly CATALOG_SHA256=27af3250bbc472ed20019983093b43336cc1967b9ae3193e6b202da4df27ad3f
readonly APP_CATALOG_SHA256=27af3250bbc472ed20019983093b43336cc1967b9ae3193e6b202da4df27ad3f
readonly OPERATOR_SHA256=ed5216a0c56fb270e903e84507a905d62ceda354a9fdbca7ebf939c2b0296442
readonly BEGIN_MARKER='# BEGIN CODEX NAS LATEST COLLECTOR v1'
readonly END_MARKER='# END CODEX NAS LATEST COLLECTOR v1'

fail() { printf 'LATEST_COLLECTOR_INSTALL_FAILED=%s\n' "$1" >&2; exit 1; }
mode() { stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1"; }

[ "$#" -eq 2 ] && [ "$1" = --prepare-only ] || fail USE_ONLY_PREPARE_ONLY
[ "$(id -u)" -ne 0 ] || fail ROOT_USER_NOT_ALLOWED
candidate=$(CDPATH= cd -- "$2" && pwd -P) || fail CANDIDATE_PATH_INVALID
[ -d "$candidate" ] || fail LOCAL_CANDIDATE_MISSING
[ "$(mode "$candidate")" = 700 ] || fail CANDIDATE_DIRECTORY_MODE

need() { command -v "$1" >/dev/null 2>&1 || fail "MISSING_$1"; }
need sha256sum
need cp
need mkdir
need chmod
need stat
need date
need find
need awk
need cat

[ "$(date +%z)" = +0800 ] || fail HOST_OFFSET_NOT_SHANGHAI
[ -f "$NIGHT_LOCK" ] && [ "$(mode "$NIGHT_LOCK")" = 600 ] || fail SHARED_NIGHT_LOCK_INVALID
[ ! -e "$WORKSPACE" ] || fail TARGET_ALREADY_EXISTS_REVIEW_REQUIRED
[ "$(sha256sum "$candidate/source/scripts/fiscal/nas-candidate-batch.ts" | awk '{print $1}')" = "$OPERATOR_SHA256" ] || fail OPERATOR_HASH_MISMATCH
[ "$(sha256sum "$candidate/source/industry/sources.json" | awk '{print $1}')" = "$CATALOG_SHA256" ] || fail CATALOG_HASH_MISMATCH
[ "$(cat "$candidate/tools/operator.sha256")" = "$OPERATOR_SHA256" ] || fail OPERATOR_PIN_MISMATCH
[ "$(cat "$candidate/tools/app-catalog.sha256")" = "$APP_CATALOG_SHA256" ] || fail APP_CATALOG_PIN_MISMATCH
candidate_image=$(cat "$candidate/tools/api-image-id") || fail API_IMAGE_PIN_READ
[ "$(sha256sum "$candidate/tools/candidate-manifest.json" | awk '{print $1}')" = "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1],encoding="utf-8"))["runtimeManifestSha256"])' "$candidate/candidate-manifest.json")" ] || fail RUNTIME_MANIFEST_HASH_MISMATCH
python3 - "$candidate/candidate-manifest.json" "$candidate/tools/candidate-manifest.json" "$candidate_image" "$OPERATOR_SHA256" "$CATALOG_SHA256" "$APP_CATALOG_SHA256" <<'PY' || fail CANDIDATE_MANIFEST_MISMATCH
import json, re, sys
with open(sys.argv[1], encoding="utf-8") as f: outer=json.load(f)
with open(sys.argv[2], encoding="utf-8") as f: runtime=json.load(f)
image, operator_sha, catalog_sha, app_sha=sys.argv[3:7]
bound=outer.get("imagePinBound") is True
valid=outer.get("schemaVersion")=="nas-latest-collector-candidate.v2" and runtime.get("schemaVersion")=="nas-latest-collector-candidate.v2"
valid=valid and outer.get("apiImageId")==image and runtime.get("apiImageId")==image
valid=valid and outer.get("operatorSha256")==operator_sha and runtime.get("operatorSha256")==operator_sha
valid=valid and outer.get("catalogSha256")==catalog_sha and runtime.get("catalogSha256")==catalog_sha
valid=valid and outer.get("appCatalogSha256")==app_sha and runtime.get("appCatalogSha256")==app_sha
valid=valid and outer.get("imagePinBound")==runtime.get("imagePinBound")
expected_guardrails={"fixedSources":46,"summaryDraftSources":20,"freshnessDays":7,"listRequests":46,"detailRequests":30,"totalGets":76,"maxNewPerSource":10,"maxNewTotal":460}
valid=valid and all(outer.get("guardrails",{}).get(k)==v and runtime.get("guardrails",{}).get(k)==v for k,v in expected_guardrails.items())
valid=valid and ((re.fullmatch(r"sha256:[a-f0-9]{64}",image) is not None) if bound else image=="UNBOUND")
if not valid: raise SystemExit(1)
PY

mkdir -m 700 "$WORKSPACE"
mkdir -m 700 "$WORKSPACE/source" "$WORKSPACE/source/scripts" "$WORKSPACE/source/scripts/fiscal" "$WORKSPACE/source/industry"
mkdir -m 700 "$WORKSPACE/tools" "$WORKSPACE/state" "$WORKSPACE/results" "$WORKSPACE/logs" "$WORKSPACE/backups"
cp "$candidate/source/scripts/fiscal/nas-candidate-batch.ts" "$WORKSPACE/source/scripts/fiscal/nas-candidate-batch.ts"
cp "$candidate/source/industry/sources.json" "$WORKSPACE/source/industry/sources.json"
cp "$candidate/tools/nas-latest-collector-launcher.sh" "$WORKSPACE/tools/nas-latest-collector-launcher.sh"
for pin in operator.sha256 catalog.sha256 app-catalog.sha256 api-image-id candidate-manifest.json node.sha256 latest-entrypoint.sh; do
  cp "$candidate/tools/$pin" "$WORKSPACE/tools/$pin"
done
cp "$candidate/cron/owned-block.candidate.txt" "$WORKSPACE/tools/owned-block.candidate.txt"
find "$WORKSPACE/source" -type d -exec chmod 700 {} \;
find "$WORKSPACE/source" -type f -exec chmod 600 {} \;
chmod 700 "$WORKSPACE" "$WORKSPACE/tools" "$WORKSPACE/state" "$WORKSPACE/results" "$WORKSPACE/logs" "$WORKSPACE/backups"
chmod 750 "$WORKSPACE/tools/nas-latest-collector-launcher.sh" "$WORKSPACE/tools/latest-entrypoint.sh"
find "$WORKSPACE/tools" -type f ! -name nas-latest-collector-launcher.sh ! -name latest-entrypoint.sh -exec chmod 600 {} \;
printf 'LATEST_COLLECTOR_STAGE=PREPARED_NOT_SCHEDULED\nIMAGE_PIN=%s\nWORKSPACE=%s\nOPERATOR_SHA256=%s\nCATALOG_SHA256=%s\nAPP_CATALOG_SHA256=%s\nCRON_BLOCK=%s\n' \
  "$candidate_image" "$WORKSPACE" "$OPERATOR_SHA256" "$CATALOG_SHA256" "$APP_CATALOG_SHA256" "$WORKSPACE/tools/owned-block.candidate.txt"
