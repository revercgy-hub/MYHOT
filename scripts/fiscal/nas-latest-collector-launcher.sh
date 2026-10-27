#!/bin/sh
set -eu
umask 077

readonly WORKSPACE=/vol2/1000/docker/fiscalhot-latest-collector
readonly NIGHT_WORKSPACE=/vol2/1000/docker/fiscalhot-understand-nightly
readonly LOCK_FILE=$NIGHT_WORKSPACE/state/ollama-understand-nightly.lock
readonly API_CONTAINER=fiscalhot-staging-api-1
readonly API_IMAGE=sha256:54d1a34f104b665ccdecc60e82f4cb67acf114fb3171b742990464ee6d4c7bc6
readonly APP_CATALOG_SHA256=b5287d7f66ab91ed535d23128796f284f39c7c2c60f126082a820e891d5b252a
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
[ -f "$LOCK_FILE" ] && [ "$(mode "$LOCK_FILE")" = 600 ] || fail SHARED_NIGHT_LOCK_INVALID

need sha256sum
need docker
need flock
need date
need cut
need cmp
need cat

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

[ "$(docker inspect --format '{{.Image}}' "$API_CONTAINER" 2>/dev/null)" = "$API_IMAGE" ] || fail API_IMAGE_PIN_MISMATCH
[ "$(docker inspect --format '{{.State.Running}}' "$API_CONTAINER" 2>/dev/null)" = true ] || fail API_CONTAINER_NOT_RUNNING
[ "$(docker exec "$API_CONTAINER" node --version 2>/dev/null)" = v24.22.1 ] || fail API_NODE_VERSION
[ "$(docker exec "$API_CONTAINER" sha256sum /app/industry/sources.json 2>/dev/null | cut -d ' ' -f 1)" = "$APP_CATALOG_SHA256" ] || fail API_SOURCE_CATALOG_DRIFT

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
