#!/bin/sh
set -eu
umask 077

readonly WORKSPACE=/vol2/1000/docker/fiscalhot-pg17-backup-nightly
readonly API_CONTAINER=fiscalhot-staging-api-1
readonly NIGHT_WORKSPACE=/vol2/1000/docker/fiscalhot-understand-nightly
readonly LOCK_FILE=$NIGHT_WORKSPACE/state/ollama-understand-nightly.lock
readonly OPERATOR=$WORKSPACE/source/scripts/fiscal/nas-pg17-daily-backup.mjs
readonly OPERATOR_PIN=$WORKSPACE/tools/operator.sha256
readonly IMAGE_PIN=$WORKSPACE/tools/api-image-id
readonly STATE_DIR=$WORKSPACE/state
readonly LOGS_DIR=$WORKSPACE/logs

fail() { printf 'NAS_PG17_BACKUP=FAILED code=%s\n' "$1" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "MISSING_$1"; }
mode() { stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1"; }

[ "$(id -u)" -ne 0 ] || fail ROOT_USER_NOT_ALLOWED
[ -d "$WORKSPACE" ] && [ "$(mode "$WORKSPACE")" = 700 ] || fail PRIVATE_WORKSPACE_INVALID
[ -d "$WORKSPACE/source" ] && [ "$(mode "$WORKSPACE/source")" = 700 ] || fail PRIVATE_SOURCE_INVALID
[ -d "$WORKSPACE/tools" ] && [ "$(mode "$WORKSPACE/tools")" = 700 ] || fail PRIVATE_TOOLS_INVALID
[ -d "$STATE_DIR" ] && [ "$(mode "$STATE_DIR")" = 700 ] || fail PRIVATE_STATE_INVALID
[ -d "$LOGS_DIR" ] && [ "$(mode "$LOGS_DIR")" = 700 ] || fail PRIVATE_LOGS_INVALID
[ -f "$OPERATOR" ] && [ -f "$OPERATOR_PIN" ] && [ -f "$IMAGE_PIN" ] || fail OPERATOR_OR_PIN_MISSING
[ "$(mode "$OPERATOR_PIN")" = 600 ] && [ "$(mode "$IMAGE_PIN")" = 600 ] || fail PIN_MODE_INVALID
[ -f "$LOCK_FILE" ] && [ "$(mode "$LOCK_FILE")" = 600 ] || fail SHARED_NIGHT_LOCK_INVALID

need sha256sum
need docker
need flock
need date
need cut

[ "$(date +%z)" = +0800 ] || fail HOST_OFFSET_NOT_SHANGHAI
[ "$(TZ=Asia/Shanghai date +%z)" = +0800 ] || fail SHANGHAI_TZDATA_UNAVAILABLE
[ "$(TZ=Asia/Shanghai date +%H%M)" = 0100 ] || fail OUTSIDE_SCHEDULED_SLOT
[ -f "$LOGS_DIR/cron.log" ] && [ "$(mode "$LOGS_DIR/cron.log")" = 600 ] || fail PRIVATE_LOG_INVALID

operator_sha=$(sha256sum "$OPERATOR" | cut -d ' ' -f 1) || fail OPERATOR_HASH_READ
expected_operator_sha=$(cat "$OPERATOR_PIN") || fail OPERATOR_PIN_READ
[ "$operator_sha" = "$expected_operator_sha" ] || fail OPERATOR_HASH_MISMATCH
api_image=$(docker inspect --format '{{.Image}}' "$API_CONTAINER" 2>/dev/null) || fail API_CONTAINER_UNAVAILABLE
expected_image=$(cat "$IMAGE_PIN") || fail API_IMAGE_PIN_READ
case "$expected_image" in sha256:*) image_hex=${expected_image#sha256:};; *) fail API_IMAGE_PIN_INVALID;; esac
case "$image_hex" in *[!a-f0-9]*|'') fail API_IMAGE_PIN_INVALID;; esac
[ "${#image_hex}" -eq 64 ] && [ "$api_image" = "$expected_image" ] || fail API_IMAGE_PIN_MISMATCH
[ "$(docker inspect --format '{{.State.Running}}' "$API_CONTAINER" 2>/dev/null)" = true ] || fail API_CONTAINER_NOT_RUNNING
[ "$(docker exec "$API_CONTAINER" node --version 2>/dev/null)" = v24.22.1 ] || fail API_NODE_VERSION

exec 9<>"$LOCK_FILE"
if ! flock -n 9; then
  printf 'NAS_PG17_BACKUP=SKIPPED_LOCK_BUSY\n'
  exit 0
fi

lock_held=1
remote_operator=
cleanup() {
  if [ -n "$remote_operator" ]; then docker exec --user 0 "$API_CONTAINER" rm -f "$remote_operator" >/dev/null 2>&1 || true; fi
  if [ "${lock_held:-0}" -eq 1 ]; then flock -u 9 >/dev/null 2>&1 || true; exec 9>&- 2>/dev/null || true; fi
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

day=$(TZ=Asia/Shanghai date +%Y%m%d)
once_file=$STATE_DIR/pg17-daily-backup-$day.started
if [ -e "$once_file" ]; then printf 'NAS_PG17_BACKUP=SKIPPED_ALREADY_STARTED day=%s\n' "$day"; exit 0; fi
(set -C; printf '%s\n' "$day" > "$once_file") 2>/dev/null || { printf 'NAS_PG17_BACKUP=SKIPPED_ALREADY_STARTED day=%s\n' "$day"; exit 0; }
chmod 600 "$once_file" || fail ONCE_MARKER_MODE

uid=$(docker exec "$API_CONTAINER" id -u 2>/dev/null) || fail API_RUNTIME_UID_UNAVAILABLE
gid=$(docker exec "$API_CONTAINER" id -g 2>/dev/null) || fail API_RUNTIME_GID_UNAVAILABLE
case "$uid:$gid" in *[!0-9:]*|:*) fail API_RUNTIME_ID_INVALID;; esac
remote_operator=/tmp/codex-pg17-daily-backup.$operator_sha.$$.mjs
docker cp "$OPERATOR" "$API_CONTAINER:$remote_operator" >/dev/null || fail OPERATOR_STAGE_FAILED
docker exec --user 0 "$API_CONTAINER" chown "$uid:$gid" "$remote_operator" || fail OPERATOR_OWNER_FAILED
docker exec --user 0 "$API_CONTAINER" chmod 0600 "$remote_operator" || fail OPERATOR_MODE_FAILED
[ "$(docker exec "$API_CONTAINER" sha256sum "$remote_operator" | cut -d ' ' -f 1)" = "$operator_sha" ] || fail STAGED_OPERATOR_HASH_MISMATCH

if ! docker exec "$API_CONTAINER" node "$remote_operator"; then fail BACKUP_OPERATOR_FAILED; fi
printf 'NAS_PG17_BACKUP=FINISHED image=%s operatorSha256=%s\n' "$api_image" "$operator_sha"
