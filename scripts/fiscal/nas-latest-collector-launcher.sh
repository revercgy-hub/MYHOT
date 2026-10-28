#!/bin/sh
set -eu
umask 077

readonly WORKSPACE=/vol2/1000/docker/fiscalhot-latest-collector-20261028
readonly NIGHT_WORKSPACE=/vol2/1000/docker/fiscalhot-understand-nightly
readonly LOCK_FILE=$NIGHT_WORKSPACE/state/ollama-understand-nightly.lock
readonly API_CONTAINER=fiscalhot-staging-api-1
readonly API_IMAGE_PIN=$WORKSPACE/tools/api-image-id
readonly APP_CATALOG_SHA256=27af3250bbc472ed20019983093b43336cc1967b9ae3193e6b202da4df27ad3f
readonly APP_CATALOG_PIN=$WORKSPACE/tools/app-catalog.sha256
readonly MANIFEST=$WORKSPACE/tools/candidate-manifest.json
readonly NODE_SHA256=e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb
readonly CATALOG_SHA256=27af3250bbc472ed20019983093b43336cc1967b9ae3193e6b202da4df27ad3f
readonly SOURCE_ROOT=$WORKSPACE/source
readonly STATE_DIR=$WORKSPACE/state
readonly RESULTS_DIR=$WORKSPACE/results
readonly LOGS_DIR=$WORKSPACE/logs
readonly OPERATOR=$SOURCE_ROOT/scripts/fiscal/nas-candidate-batch.ts
readonly CATALOG=$SOURCE_ROOT/industry/sources.json
readonly OPERATOR_PIN=$WORKSPACE/tools/operator.sha256
readonly CATALOG_PIN=$WORKSPACE/tools/catalog.sha256

fail() { printf 'LATEST_COLLECTOR_FAILED=%s\n' "$1" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "MISSING_$1"; }
mode() { stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1"; }

[ "$(id -u)" -ne 0 ] || fail ROOT_USER_NOT_ALLOWED
[ -d "$WORKSPACE" ] && [ "$(mode "$WORKSPACE")" = 700 ] || fail PRIVATE_WORKSPACE_INVALID
[ -d "$SOURCE_ROOT" ] && [ "$(mode "$SOURCE_ROOT")" = 700 ] || fail PRIVATE_SOURCE_INVALID
[ -d "$WORKSPACE/tools" ] && [ "$(mode "$WORKSPACE/tools")" = 700 ] || fail PRIVATE_TOOLS_INVALID
[ -d "$STATE_DIR" ] && [ "$(mode "$STATE_DIR")" = 700 ] || fail PRIVATE_STATE_INVALID
[ -d "$RESULTS_DIR" ] && [ "$(mode "$RESULTS_DIR")" = 700 ] || fail PRIVATE_RESULTS_INVALID
[ -d "$LOGS_DIR" ] && [ "$(mode "$LOGS_DIR")" = 700 ] || fail PRIVATE_LOGS_INVALID
[ -f "$OPERATOR" ] && [ -f "$OPERATOR_PIN" ] && [ -f "$CATALOG" ] && [ -f "$CATALOG_PIN" ] || fail OPERATOR_CATALOG_OR_PIN_MISSING
[ -f "$API_IMAGE_PIN" ] && [ -f "$APP_CATALOG_PIN" ] && [ -f "$MANIFEST" ] && [ -n "${LATEST_COLLECTOR_MANIFEST_SHA256:-}" ] || fail IMAGE_OR_MANIFEST_PIN_MISSING
[ "$(mode "$API_IMAGE_PIN")" = 600 ] && [ "$(mode "$APP_CATALOG_PIN")" = 600 ] && [ "$(mode "$MANIFEST")" = 600 ] || fail PRIVATE_IMAGE_OR_MANIFEST_MODE
[ -f "$LOCK_FILE" ] && [ "$(mode "$LOCK_FILE")" = 600 ] || fail SHARED_NIGHT_LOCK_INVALID

need sha256sum
need docker
need flock
need date
need cut
need cmp
need cat
need python3

[ "$(date +%z)" = +0800 ] || fail HOST_OFFSET_NOT_SHANGHAI
[ "$(TZ=Asia/Shanghai date +%z)" = +0800 ] || fail SHANGHAI_TZDATA_UNAVAILABLE
[ "$($NIGHT_WORKSPACE/bin/node --version 2>/dev/null)" = v24.22.1 ] || fail PRIVATE_NODE_VERSION
[ "$(sha256sum "$NIGHT_WORKSPACE/bin/node" | cut -d ' ' -f 1)" = "$NODE_SHA256" ] || fail PRIVATE_NODE_HASH

operator_sha=$(sha256sum "$OPERATOR" | cut -d ' ' -f 1) || fail OPERATOR_HASH_READ
expected_operator_sha=$(cat "$OPERATOR_PIN") || fail OPERATOR_PIN_READ
[ "$operator_sha" = "$expected_operator_sha" ] || fail OPERATOR_HASH_MISMATCH
catalog_sha=$(sha256sum "$CATALOG" | cut -d ' ' -f 1) || fail CATALOG_HASH_READ
expected_catalog_sha=$(cat "$CATALOG_PIN") || fail CATALOG_PIN_READ
[ "$catalog_sha" = "$expected_catalog_sha" ] && [ "$catalog_sha" = "$CATALOG_SHA256" ] || fail CATALOG_HASH_MISMATCH
expected_app_catalog_sha=$(cat "$APP_CATALOG_PIN") || fail APP_CATALOG_PIN_READ
[ "$expected_app_catalog_sha" = "$APP_CATALOG_SHA256" ] || fail APP_CATALOG_PIN_MISMATCH
[ "$(sha256sum "$MANIFEST" | cut -d ' ' -f 1)" = "$LATEST_COLLECTOR_MANIFEST_SHA256" ] || fail MANIFEST_HASH_MISMATCH
api_image=$(cat "$API_IMAGE_PIN") || fail API_IMAGE_PIN_READ
case "$api_image" in sha256:*) image_hex=${api_image#sha256:};; *) fail API_IMAGE_PIN_INVALID;; esac
case "$image_hex" in *[!a-f0-9]*|'') fail API_IMAGE_PIN_INVALID;; esac
[ "${#image_hex}" -eq 64 ] || fail API_IMAGE_PIN_INVALID
manifest_api_image=$(python3 - "$MANIFEST" "$operator_sha" "$CATALOG_SHA256" "$APP_CATALOG_SHA256" <<'PY'
import json, re, sys
try:
    with open(sys.argv[1], encoding="utf-8") as f:
        value = json.load(f)
    image = value.get("apiImageId")
    guardrails = value.get("guardrails")
    valid = value.get("schemaVersion") == "nas-latest-collector-candidate.v2" and value.get("imagePinBound") is True
    valid = valid and value.get("approvedCatalogSha256") == "27af3250bbc472ed20019983093b43336cc1967b9ae3193e6b202da4df27ad3f"
    valid = valid and value.get("appCatalogSha256") == sys.argv[4]
    valid = valid and isinstance(image, str) and re.fullmatch(r"sha256:[a-f0-9]{64}", image) is not None
    valid = valid and value.get("operatorSha256") == sys.argv[2] and value.get("catalogSha256") == sys.argv[3]
    expected = {"fixedSources": 46, "summaryDraftSources": 20, "freshnessDays": 7, "listRequests": 46,
                "detailRequests": 30, "totalGets": 76, "maxNewPerSource": 10, "maxNewTotal": 460}
    valid = valid and isinstance(guardrails, dict) and all(guardrails.get(k) == v for k, v in expected.items())
    if not valid:
        raise ValueError()
    print(image)
except Exception:
    raise SystemExit(2)
PY
) || fail IMAGE_MANIFEST_UNBOUND_OR_MISMATCHED
[ "$manifest_api_image" = "$api_image" ] || fail API_IMAGE_MANIFEST_MISMATCH

mode_arg=execute
if [ "$#" -eq 1 ] && [ "$1" = --plan-only ]; then mode_arg=plan-only
elif [ "$#" -ne 0 ]; then fail UNKNOWN_ARGUMENT
fi
slot=$(TZ=Asia/Shanghai date +%H%M)
if [ "$mode_arg" = execute ]; then
  case "$slot" in 0600|1200|1800) ;; *) fail OUTSIDE_SCHEDULED_SLOT;; esac
fi
day=$(TZ=Asia/Shanghai date +%Y%m%d)
run_id="daily-latest-$day-$slot"

# Acquire the exact lock used by the understand nightly schedule before touching
# the API container or creating any run artifact. A busy lock is a no-op.
exec 9<>"$LOCK_FILE"
if ! flock -n 9; then
  printf 'LATEST_COLLECTOR=SKIPPED_LOCK_BUSY runId=%s\n' "$run_id"
  exit 0
fi

if [ "$mode_arg" = execute ]; then
  once_file="$STATE_DIR/latest-collector-$day-$slot.started"
  if [ -e "$once_file" ]; then
    printf 'LATEST_COLLECTOR=SKIPPED_SLOT_ALREADY_STARTED runId=%s\n' "$run_id"
    exit 0
  fi
  (set -C; printf '%s\n' "$run_id" > "$once_file") 2>/dev/null || {
    printf 'LATEST_COLLECTOR=SKIPPED_SLOT_ALREADY_STARTED runId=%s\n' "$run_id"
    exit 0
  }
fi

[ "$(docker inspect --format '{{.Image}}' "$API_CONTAINER" 2>/dev/null)" = "$api_image" ] || fail API_IMAGE_PIN_MISMATCH
[ "$(docker inspect --format '{{.State.Running}}' "$API_CONTAINER" 2>/dev/null)" = true ] || fail API_CONTAINER_NOT_RUNNING
[ "$(docker exec "$API_CONTAINER" node --version 2>/dev/null)" = v24.22.1 ] || fail API_NODE_VERSION
[ "$(docker exec "$API_CONTAINER" sha256sum /app/industry/sources.json 2>/dev/null | cut -d ' ' -f 1)" = "$expected_app_catalog_sha" ] || fail API_SOURCE_CATALOG_DRIFT

tmp_sha=$(printf '%s' "$operator_sha" | cut -c1-12)
remote_operator="/tmp/codex-latest-candidate-batch.$tmp_sha.$$.ts"
remote_catalog="/tmp/codex-latest-sources.$(printf '%s' "$catalog_sha" | cut -c1-12).$$.json"
cleanup() {
  docker exec "$API_CONTAINER" rm -f "$remote_operator" "$remote_catalog" >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

# Stage only the exact pinned operator into /tmp. AIHOT_APP_ROOT remains the
# immutable app tree baked into the approved image; no fixed app file is replaced.
docker cp "$OPERATOR" "$API_CONTAINER:$remote_operator" >/dev/null || fail OPERATOR_STAGE_FAILED
api_uid=$(docker exec "$API_CONTAINER" id -u 2>/dev/null) || fail API_RUNTIME_UID_UNAVAILABLE
api_gid=$(docker exec "$API_CONTAINER" id -g 2>/dev/null) || fail API_RUNTIME_GID_UNAVAILABLE
case "$api_uid:$api_gid" in *[!0-9:]*|:*) fail API_RUNTIME_ID_INVALID;; esac
docker exec --user 0 "$API_CONTAINER" chown "$api_uid:$api_gid" "$remote_operator" || fail OPERATOR_STAGE_OWNER_FAILED
docker exec --user 0 "$API_CONTAINER" chmod 0600 "$remote_operator" || fail OPERATOR_STAGE_MODE_FAILED
[ "$(docker exec "$API_CONTAINER" sha256sum "$remote_operator" | cut -d ' ' -f 1)" = "$operator_sha" ] || fail STAGED_OPERATOR_HASH_MISMATCH
docker cp "$CATALOG" "$API_CONTAINER:$remote_catalog" >/dev/null || fail CATALOG_STAGE_FAILED
docker exec --user 0 "$API_CONTAINER" chown "$api_uid:$api_gid" "$remote_catalog" || fail CATALOG_STAGE_OWNER_FAILED
docker exec --user 0 "$API_CONTAINER" chmod 0600 "$remote_catalog" || fail CATALOG_STAGE_MODE_FAILED
[ "$(docker exec "$API_CONTAINER" sha256sum "$remote_catalog" | cut -d ' ' -f 1)" = "$catalog_sha" ] || fail STAGED_CATALOG_HASH_MISMATCH

if [ "$mode_arg" = plan-only ]; then
  docker exec "$API_CONTAINER" env AIHOT_APP_ROOT=/app AIHOT_SOURCE_CATALOG_PATH="$remote_catalog" \
    node "$remote_operator" --preset daily-latest
else
  docker exec "$API_CONTAINER" env AIHOT_APP_ROOT=/app AIHOT_SOURCE_CATALOG_PATH="$remote_catalog" \
    node "$remote_operator" \
    --preset daily-latest --execute --run-id "$run_id"
fi
status=$?
cleanup
trap - EXIT HUP INT TERM
flock -u 9
exec 9>&-
exit "$status"
