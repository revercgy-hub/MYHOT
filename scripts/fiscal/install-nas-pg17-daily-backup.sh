#!/bin/sh
set -eu
umask 077

readonly WORKSPACE=/vol2/1000/docker/fiscalhot-pg17-backup-nightly
readonly NIGHT_WORKSPACE=/vol2/1000/docker/fiscalhot-understand-nightly
readonly API_CONTAINER=fiscalhot-staging-api-1
readonly BEGIN_MARKER='# BEGIN CODEX_FISCAL_PG17_BACKUP'
readonly END_MARKER='# END CODEX_FISCAL_PG17_BACKUP'

mode_arg=prepare-only
candidate=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --install-cron) [ "$mode_arg" = prepare-only ] || { printf 'PG17_BACKUP_INSTALL_FAILED=ARGUMENT_CONFLICT\n' >&2; exit 1; }; mode_arg=install-cron; shift ;;
    --candidate) [ "$#" -ge 2 ] && [ -z "$candidate" ] || { printf 'PG17_BACKUP_INSTALL_FAILED=CANDIDATE_ARGUMENT_INVALID\n' >&2; exit 1; }; candidate=$2; shift 2 ;;
    *) printf 'PG17_BACKUP_INSTALL_FAILED=UNKNOWN_ARGUMENT\n' >&2; exit 1 ;;
  esac
done
fail() { printf 'PG17_BACKUP_INSTALL_FAILED=%s\n' "$1" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "MISSING_$1"; }
mode() { stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1"; }

[ "$(id -u)" -ne 0 ] || fail ROOT_USER_NOT_ALLOWED
[ -n "$candidate" ] && [ -d "$candidate" ] || fail CANDIDATE_REQUIRED
[ "$(mode "$candidate")" = 700 ] || fail CANDIDATE_MODE_INVALID
for file in candidate-manifest.json tools/pg17-backup-manifest.json tools/operator.sha256 tools/api-image-id tools/nas-pg17-daily-backup-launcher.sh tools/pg17-backup-entrypoint.sh source/scripts/fiscal/nas-pg17-daily-backup.mjs cron/owned-block.candidate.txt; do
  [ -f "$candidate/$file" ] || fail CANDIDATE_FILE_MISSING
done
need sha256sum
need python3
need stat
need chmod
need cp
need mkdir
need crontab
need awk
need cmp
need mktemp
need date

candidate_image=$(cat "$candidate/tools/api-image-id") || fail IMAGE_PIN_READ
operator_sha=$(sha256sum "$candidate/source/scripts/fiscal/nas-pg17-daily-backup.mjs" | awk '{print $1}')
launcher_sha=$(sha256sum "$candidate/tools/nas-pg17-daily-backup-launcher.sh" | awk '{print $1}')
entrypoint_sha=$(sha256sum "$candidate/tools/pg17-backup-entrypoint.sh" | awk '{print $1}')
runtime_sha=$(sha256sum "$candidate/tools/pg17-backup-manifest.json" | awk '{print $1}')
[ "$(cat "$candidate/tools/operator.sha256")" = "$operator_sha" ] || fail OPERATOR_PIN_MISMATCH
python3 - "$candidate/candidate-manifest.json" "$candidate/tools/pg17-backup-manifest.json" "$candidate_image" "$operator_sha" "$launcher_sha" "$entrypoint_sha" "$runtime_sha" <<'PY' || fail CANDIDATE_MANIFEST_MISMATCH
import json,re,sys
outer=json.load(open(sys.argv[1],encoding="utf-8")); runtime=json.load(open(sys.argv[2],encoding="utf-8"))
image,operator,launcher,entrypoint,runtime_sha=sys.argv[3:]
guards={"localOnly":True,"noSettingsWrites":True,"noRetentionDelete":True,"noUpload":True,"noRetry":True}
bound=outer.get("imagePinBound") is True
valid=outer.get("schemaVersion")=="nas-pg17-daily-backup-candidate.v1" and runtime.get("schemaVersion")=="nas-pg17-daily-backup-candidate.v1"
valid=valid and outer.get("imagePinBound")==runtime.get("imagePinBound") and outer.get("apiImageId")==image and runtime.get("apiImageId")==image
valid=valid and outer.get("operatorSha256")==operator and runtime.get("operatorSha256")==operator and outer.get("launcherSha256")==launcher and runtime.get("launcherSha256")==launcher
valid=valid and outer.get("entrypointSha256")==entrypoint and outer.get("runtimeManifestSha256")==runtime_sha
valid=valid and outer.get("markerBegin")=="# BEGIN CODEX_FISCAL_PG17_BACKUP" and outer.get("markerEnd")=="# END CODEX_FISCAL_PG17_BACKUP"
valid=valid and all(outer.get("guardrails",{}).get(k)==v and runtime.get("guardrails",{}).get(k)==v for k,v in guards.items())
valid=valid and ((re.fullmatch(r"sha256:[a-f0-9]{64}",image) is not None) if bound else image=="UNBOUND")
if not valid: raise SystemExit(1)
PY
[ "$(sha256sum "$candidate/tools/pg17-backup-entrypoint.sh" | awk '{print $1}')" = "$entrypoint_sha" ] || fail ENTRYPOINT_HASH_MISMATCH

if [ "$mode_arg" = prepare-only ]; then
  printf 'PG17_BACKUP_INSTALLER=PREPARE_ONLY_PASS\nAPI_IMAGE_PIN=%s\nOPERATOR_SHA256=%s\nLAUNCHER_SHA256=%s\nENTRYPOINT_SHA256=%s\nCRON_INSTALL=NOT_PERFORMED\n' "$candidate_image" "$operator_sha" "$launcher_sha" "$entrypoint_sha"
  exit 0
fi

[ "$candidate_image" != UNBOUND ] || fail API_IMAGE_PIN_UNBOUND
[ ! -e "$WORKSPACE" ] || fail TARGET_EXISTS_REVIEW_REQUIRED
[ -f "$NIGHT_WORKSPACE/state/ollama-understand-nightly.lock" ] && [ "$(mode "$NIGHT_WORKSPACE/state/ollama-understand-nightly.lock")" = 600 ] || fail SHARED_LOCK_INVALID
need docker
[ "$(docker inspect --format '{{.Image}}' "$API_CONTAINER" 2>/dev/null)" = "$candidate_image" ] || fail API_IMAGE_PIN_MISMATCH
[ "$(docker inspect --format '{{.State.Running}}' "$API_CONTAINER" 2>/dev/null)" = true ] || fail API_CONTAINER_NOT_RUNNING
[ "$(docker exec "$API_CONTAINER" node --version 2>/dev/null)" = v24.22.1 ] || fail API_NODE_VERSION

for dir in "$WORKSPACE" "$WORKSPACE/source" "$WORKSPACE/source/scripts" "$WORKSPACE/source/scripts/fiscal" "$WORKSPACE/tools" "$WORKSPACE/state" "$WORKSPACE/logs" "$WORKSPACE/backups"; do
  mkdir -m 700 "$dir" 2>/dev/null || [ -d "$dir" ] || fail WORKSPACE_DIRECTORY_CREATE_FAILED
  chmod 700 "$dir"
done
for file in tools/operator.sha256 tools/api-image-id tools/pg17-backup-manifest.json tools/nas-pg17-daily-backup-launcher.sh tools/pg17-backup-entrypoint.sh source/scripts/fiscal/nas-pg17-daily-backup.mjs; do
  cp "$candidate/$file" "$WORKSPACE/$file"
done
cp "$candidate/cron/owned-block.candidate.txt" "$WORKSPACE/tools/owned-block.candidate.txt"
chmod 600 "$WORKSPACE/tools/operator.sha256" "$WORKSPACE/tools/api-image-id" "$WORKSPACE/tools/pg17-backup-manifest.json" "$WORKSPACE/source/scripts/fiscal/nas-pg17-daily-backup.mjs" "$WORKSPACE/tools/owned-block.candidate.txt"
chmod 750 "$WORKSPACE/tools/nas-pg17-daily-backup-launcher.sh" "$WORKSPACE/tools/pg17-backup-entrypoint.sh"
[ -f "$WORKSPACE/logs/cron.log" ] || : > "$WORKSPACE/logs/cron.log"
chmod 600 "$WORKSPACE/logs/cron.log"

tmp=$(mktemp "$WORKSPACE/.crontab.XXXXXX") || fail CRONTAB_TEMP_CREATE
if ! crontab -l > "$tmp" 2>/dev/null; then [ ! -s "$tmp" ] || fail CRONTAB_READ_FAILED; : > "$tmp"; fi
chmod 600 "$tmp"
before="$WORKSPACE/backups/crontab.preinstall.$(date -u +%Y%m%dT%H%M%SZ).$$.txt"
cp "$tmp" "$before"; chmod 600 "$before"
filtered="$tmp.filtered"
awk -v begin="$BEGIN_MARKER" -v end="$END_MARKER" '
  $0==begin {if(inside)bad=1;inside=1;begins++;next}
  $0==end {if(!inside)bad=1;inside=0;ends++;next}
  !inside {print}
  END {if(inside||bad||begins!=ends||begins>1)exit 42}
' "$tmp" > "$filtered" || fail OWNED_CRON_BLOCK_INVALID
awk '/pg17-backup-entrypoint\.sh|nas-pg17-daily-backup-launcher\.sh/ {found++} END {exit found?1:0}' "$filtered" || fail DUPLICATE_JOB_OUTSIDE_OWNED_BLOCK
chmod 600 "$filtered"
cat "$filtered" > "$tmp.new"
[ ! -s "$tmp.new" ] || printf '\n' >> "$tmp.new"
cat "$candidate/cron/owned-block.candidate.txt" >> "$tmp.new"
chmod 600 "$tmp.new"
cron_bytes=$(awk '$0 ~ /^0 1 \* \* \*/ {print length($0)}' "$tmp.new")
[ -n "$cron_bytes" ] && [ "$cron_bytes" -lt 512 ] || fail CRON_ENTRY_INVALID
crontab "$tmp.new" || fail CRONTAB_INSTALL_FAILED_BACKUP_RETAINED
readback="$tmp.readback"
if ! crontab -l > "$readback" 2>/dev/null || ! cmp -s "$tmp.new" "$readback"; then
  if crontab "$tmp"; then fail CRONTAB_READBACK_MISMATCH_OLD_CRONTAB_RESTORED; fi
  fail CRONTAB_READBACK_MISMATCH_ROLLBACK_FAILED
fi
rm -f "$tmp" "$filtered" "$tmp.new" "$readback"
printf 'PG17_BACKUP_INSTALL=INSTALLED\nCRON_ENTRY_BYTES=%s\nCRON_BACKUP=%s\nENTRYPOINT_SHA256=%s\n' "$cron_bytes" "$before" "$entrypoint_sha"
