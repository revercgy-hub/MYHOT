#!/bin/sh
set -eu
umask 077

readonly WORKSPACE=/vol2/1000/docker/fiscalhot-latest-collector
readonly NIGHT_LOCK=/vol2/1000/docker/fiscalhot-understand-nightly/state/ollama-understand-nightly.lock
readonly CATALOG_SHA256=27af3250bbc472ed20019983093b43336cc1967b9ae3193e6b202da4df27ad3f
readonly APP_CATALOG_SHA256=b5287d7f66ab91ed535d23128796f284f39c7c2c60f126082a820e891d5b252a
readonly OPERATOR_SHA256=3ae90e31a08da2db5b77b8a08eb3eea05726210efeea3fde37765a424fc4f7bf
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

mkdir -m 700 "$WORKSPACE"
mkdir -m 700 "$WORKSPACE/source" "$WORKSPACE/source/scripts" "$WORKSPACE/source/scripts/fiscal" "$WORKSPACE/source/industry"
mkdir -m 700 "$WORKSPACE/tools" "$WORKSPACE/state" "$WORKSPACE/results" "$WORKSPACE/logs" "$WORKSPACE/backups"
cp "$candidate/source/scripts/fiscal/nas-candidate-batch.ts" "$WORKSPACE/source/scripts/fiscal/nas-candidate-batch.ts"
cp "$candidate/source/industry/sources.json" "$WORKSPACE/source/industry/sources.json"
cp "$candidate/tools/nas-latest-collector-launcher.sh" "$WORKSPACE/tools/nas-latest-collector-launcher.sh"
for pin in operator.sha256 catalog.sha256 app-catalog.sha256 api-image-id node.sha256 latest-entrypoint.sh; do
  cp "$candidate/tools/$pin" "$WORKSPACE/tools/$pin"
done
cp "$candidate/cron/owned-block.candidate.txt" "$WORKSPACE/tools/owned-block.candidate.txt"
find "$WORKSPACE/source" -type d -exec chmod 700 {} \;
find "$WORKSPACE/source" -type f -exec chmod 600 {} \;
chmod 700 "$WORKSPACE" "$WORKSPACE/tools" "$WORKSPACE/state" "$WORKSPACE/results" "$WORKSPACE/logs" "$WORKSPACE/backups"
chmod 750 "$WORKSPACE/tools/nas-latest-collector-launcher.sh" "$WORKSPACE/tools/latest-entrypoint.sh"
find "$WORKSPACE/tools" -type f ! -name nas-latest-collector-launcher.sh ! -name latest-entrypoint.sh -exec chmod 600 {} \;
printf 'LATEST_COLLECTOR_STAGE=PREPARED_NOT_SCHEDULED\nWORKSPACE=%s\nOPERATOR_SHA256=%s\nCATALOG_SHA256=%s\nAPP_CATALOG_SHA256=%s\nCRON_BLOCK=%s\n' \
  "$WORKSPACE" "$OPERATOR_SHA256" "$CATALOG_SHA256" "$APP_CATALOG_SHA256" "$WORKSPACE/tools/owned-block.candidate.txt"
