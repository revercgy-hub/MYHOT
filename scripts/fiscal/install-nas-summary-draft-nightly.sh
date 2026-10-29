#!/bin/sh
set -eu
umask 077

readonly WORKSPACE=/vol2/1000/docker/fiscalhot-summary-draft-nightly-20261028
readonly NIGHT_LOCK=/vol2/1000/docker/fiscalhot-understand-nightly/state/ollama-understand-nightly.lock
readonly API_CONTAINER=fiscalhot-staging-api-1
readonly APP_CATALOG_SHA256=27af3250bbc472ed20019983093b43336cc1967b9ae3193e6b202da4df27ad3f
readonly BEGIN_MARKER='# BEGIN CODEX NAS SUMMARY DRAFT NIGHTLY v1'
readonly END_MARKER='# END CODEX NAS SUMMARY DRAFT NIGHTLY v1'

mode_arg=prepare-only
candidate=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --install-cron) [ "$mode_arg" = prepare-only ] || { printf 'SUMMARY_DRAFT_INSTALL_FAILED=ARGUMENT_CONFLICT\n' >&2; exit 1; }; mode_arg=install-cron; shift ;;
    --candidate) [ "$#" -ge 2 ] && [ -z "$candidate" ] || { printf 'SUMMARY_DRAFT_INSTALL_FAILED=CANDIDATE_ARGUMENT_INVALID\n' >&2; exit 1; }; candidate=$2; shift 2 ;;
    *) printf 'SUMMARY_DRAFT_INSTALL_FAILED=UNKNOWN_ARGUMENT\n' >&2; exit 1 ;;
  esac
done

fail() { printf 'SUMMARY_DRAFT_INSTALL_FAILED=%s\n' "$1" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "MISSING_$1"; }
mode() { stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1"; }

[ "$(id -u)" -ne 0 ] || fail ROOT_USER_NOT_ALLOWED
[ -n "$candidate" ] && [ -d "$candidate" ] || fail CANDIDATE_DIRECTORY_REQUIRED
[ "$(mode "$candidate")" = 700 ] || fail CANDIDATE_DIRECTORY_MODE
[ -f "$candidate/candidate-manifest.json" ] && [ -f "$candidate/tools/summary-draft-manifest.json" ] || fail CANDIDATE_MANIFEST_MISSING
[ -f "$candidate/source/scripts/fiscal/nas-summary-draft-nightly.ts" ] || fail OPERATOR_MISSING
[ -f "$candidate/tools/nas-summary-draft-nightly-launcher.sh" ] && [ -f "$candidate/tools/summary-draft-entrypoint.sh" ] || fail LAUNCHER_ENTRYPOINT_MISSING
[ -f "$candidate/tools/api-image-id" ] && [ -f "$candidate/tools/operator.sha256" ] || fail CANDIDATE_PINS_MISSING
[ -f "$candidate/tools/summary-draft-prompt.json" ] || fail PROMPT_ASSET_MISSING

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
need docker
need date

candidate_image=$(cat "$candidate/tools/api-image-id") || fail API_IMAGE_PIN_READ
operator_sha=$(sha256sum "$candidate/source/scripts/fiscal/nas-summary-draft-nightly.ts" | awk '{print $1}')
launcher_sha=$(sha256sum "$candidate/tools/nas-summary-draft-nightly-launcher.sh" | awk '{print $1}')
entrypoint_sha=$(sha256sum "$candidate/tools/summary-draft-entrypoint.sh" | awk '{print $1}')
runtime_manifest_sha=$(sha256sum "$candidate/tools/summary-draft-manifest.json" | awk '{print $1}')
prompt_asset_sha=$(sha256sum "$candidate/tools/summary-draft-prompt.json" | awk '{print $1}')
[ "$(cat "$candidate/tools/operator.sha256")" = "$operator_sha" ] || fail OPERATOR_PIN_MISMATCH

python3 - "$candidate/candidate-manifest.json" "$candidate/tools/summary-draft-manifest.json" "$candidate/tools/summary-draft-prompt.json" "$candidate_image" "$operator_sha" "$launcher_sha" "$entrypoint_sha" "$runtime_manifest_sha" "$APP_CATALOG_SHA256" "$prompt_asset_sha" <<'PY' || fail CANDIDATE_MANIFEST_MISMATCH
import hashlib,json,re,sys
outer=json.load(open(sys.argv[1],encoding="utf-8")); runtime=json.load(open(sys.argv[2],encoding="utf-8"))
asset=json.load(open(sys.argv[3],encoding="utf-8"))
image,operator,launcher,entrypoint,runtime_sha,app,asset_sha=sys.argv[4:]
guards={"fixedSummarySources":20,"maxNightlyArticles":10,"maxProviderCalls":10,"localOnly":True,"noRetry":True}
bound=outer.get("imagePinBound") is True
ok=outer.get("schemaVersion")=="nas-summary-draft-candidate.v2" and runtime.get("schemaVersion")=="nas-summary-draft-candidate.v2"
ok=ok and outer.get("imagePinBound")==runtime.get("imagePinBound") and outer.get("apiImageId")==image and runtime.get("apiImageId")==image
ok=ok and outer.get("operatorSha256")==operator and runtime.get("operatorSha256")==operator
ok=ok and outer.get("launcherSha256")==launcher and runtime.get("launcherSha256")==launcher
ok=ok and outer.get("runtimeManifestSha256")==runtime_sha and outer.get("entrypointSha256")==entrypoint
ok=ok and outer.get("appCatalogSha256")==app and runtime.get("appCatalogSha256")==app
ok=ok and outer.get("promptAssetSha256")==asset_sha and runtime.get("promptAssetSha256")==asset_sha
ok=ok and outer.get("promptVersion")==runtime.get("promptVersion")==asset.get("promptVersion")
ok=ok and outer.get("taxonomySha256")==runtime.get("taxonomySha256")==asset.get("taxonomySha256")
ok=ok and set(asset)=={"format","promptVersion","taxonomySha256","system","systemSha256"}
ok=ok and asset.get("format")=="summary-draft-prompt.v1" and isinstance(asset.get("system"),str) and isinstance(asset.get("promptVersion"),str)
ok=ok and re.fullmatch(r"[a-f0-9]{64}",asset.get("taxonomySha256", "")) is not None and re.fullmatch(r"[a-f0-9]{64}",asset.get("systemSha256", "")) is not None
ok=ok and hashlib.sha256(asset.get("system", "").encode("utf-8")).hexdigest()==asset.get("systemSha256")
ok=ok and asset.get("promptVersion", "").endswith("+taxonomy@"+asset.get("taxonomySha256", ""))
ok=ok and runtime.get("sourceRunIdSemantics")=="date-scoped database-input preparation ID; not a single collector run; each article is selected from current DB state and retains its own row/body hash and raw lineage"
ok=ok and all(outer.get("guardrails",{}).get(k)==v and runtime.get("guardrails",{}).get(k)==v for k,v in guards.items())
ok=ok and ((re.fullmatch(r"sha256:[a-f0-9]{64}",image) is not None) if bound else image=="UNBOUND")
if not ok: raise SystemExit(1)
PY
[ "$(sha256sum "$candidate/tools/summary-draft-manifest.json" | awk '{print $1}')" = "$runtime_manifest_sha" ] || fail RUNTIME_MANIFEST_SHA_MISMATCH
[ "$(sha256sum "$candidate/tools/summary-draft-entrypoint.sh" | awk '{print $1}')" = "$entrypoint_sha" ] || fail ENTRYPOINT_SHA_MISMATCH

[ "$candidate_image" != UNBOUND ] || fail API_IMAGE_PIN_UNBOUND
[ "$(docker inspect --format '{{.Image}}' "$API_CONTAINER" 2>/dev/null)" = "$candidate_image" ] || fail API_IMAGE_PIN_MISMATCH
[ "$(docker inspect --format '{{.State.Running}}' "$API_CONTAINER" 2>/dev/null)" = true ] || fail API_CONTAINER_NOT_RUNNING
[ "$(docker exec "$API_CONTAINER" node --version 2>/dev/null)" = v24.22.1 ] || fail API_NODE_VERSION
[ "$(docker exec "$API_CONTAINER" sha256sum /app/industry/sources.json 2>/dev/null | awk '{print $1}')" = "$APP_CATALOG_SHA256" ] || fail API_CATALOG_DRIFT

api_uid=$(docker exec "$API_CONTAINER" id -u 2>/dev/null) || fail API_RUNTIME_UID_UNAVAILABLE
api_gid=$(docker exec "$API_CONTAINER" id -g 2>/dev/null) || fail API_RUNTIME_GID_UNAVAILABLE
case "$api_uid:$api_gid" in *[!0-9:]*|:*) fail API_RUNTIME_ID_INVALID;; esac
prompt_dir=/data/summary-draft-prompts
prompt_path=$prompt_dir/$prompt_asset_sha.json
prompt_stage=/tmp/.codex-summary-prompt-check.$$.json
prompt_install_stage=$prompt_dir/.prompt-install.$$.tmp
operator_stage=/app/scripts/fiscal/.codex-summary-prompt-check.$(printf '%s' "$operator_sha" | cut -c1-12).$$.ts
cleanup_prompt_check() {
  docker exec --user 0 "$API_CONTAINER" rm -f "$operator_stage" "$prompt_stage" "$prompt_install_stage" >/dev/null 2>&1 || true
}
trap cleanup_prompt_check EXIT
docker cp "$candidate/tools/summary-draft-prompt.json" "$API_CONTAINER:$prompt_stage" >/dev/null || fail PROMPT_ASSET_STAGE_FAILED
docker exec --user 0 "$API_CONTAINER" chown "$api_uid:$api_gid" "$prompt_stage" || fail PROMPT_ASSET_OWNER_FAILED
docker exec --user 0 "$API_CONTAINER" chmod 0600 "$prompt_stage" || fail PROMPT_ASSET_MODE_FAILED
[ "$(docker exec "$API_CONTAINER" sha256sum "$prompt_stage" | awk '{print $1}')" = "$prompt_asset_sha" ] || fail PROMPT_ASSET_STAGE_HASH_MISMATCH
docker cp "$candidate/source/scripts/fiscal/nas-summary-draft-nightly.ts" "$API_CONTAINER:$operator_stage" >/dev/null || fail OPERATOR_VERIFY_STAGE_FAILED
docker exec --user 0 "$API_CONTAINER" chown "$api_uid:$api_gid" "$operator_stage" || fail OPERATOR_VERIFY_OWNER_FAILED
docker exec --user 0 "$API_CONTAINER" chmod 0600 "$operator_stage" || fail OPERATOR_VERIFY_MODE_FAILED
set +e
docker exec --user "$api_uid" "$API_CONTAINER" env AIHOT_APP_ROOT=/app AIHOT_DATA_DIR=/tmp node "$operator_stage" --verify-summary-prompt --summary-prompt "$prompt_stage" --summary-prompt-sha256 "$prompt_asset_sha"
verify_rc=$?
set -e
cleanup_prompt_check || fail PROMPT_VERIFY_TEMP_CLEANUP_FAILED
[ "$verify_rc" -eq 0 ] || fail API_TAXONOMY_OR_PROMPT_VERIFY_FAILED

if [ "$mode_arg" = prepare-only ]; then
  printf 'SUMMARY_DRAFT_INSTALLER=PREPARE_ONLY_PASS\nAPI_IMAGE_PIN=%s\nOPERATOR_SHA256=%s\nLAUNCHER_SHA256=%s\nPROMPT_ASSET_SHA256=%s\nPROMPT_VERSION=%s\nTAXONOMY_SHA256=%s\nENTRYPOINT_SHA256=%s\nTAXONOMY_RUNTIME_VERIFY=PASS\nCRON_INSTALL=NOT_PERFORMED\n' \
    "$candidate_image" "$operator_sha" "$launcher_sha" "$prompt_asset_sha" "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1],encoding="utf-8"))["promptVersion"])' "$candidate/tools/summary-draft-prompt.json")" "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1],encoding="utf-8"))["taxonomySha256"])' "$candidate/tools/summary-draft-prompt.json")" "$entrypoint_sha"
  exit 0
fi

[ -f "$NIGHT_LOCK" ] && [ "$(mode "$NIGHT_LOCK")" = 600 ] || fail SHARED_LOCK_INVALID
docker exec --user 0 "$API_CONTAINER" mkdir -p "$prompt_dir" || fail PROMPT_DIRECTORY_CREATE_FAILED
docker exec --user 0 "$API_CONTAINER" chown "$api_uid:$api_gid" "$prompt_dir" || fail PROMPT_DIRECTORY_OWNER_FAILED
docker exec --user 0 "$API_CONTAINER" chmod 0700 "$prompt_dir" || fail PROMPT_DIRECTORY_MODE_FAILED

if docker exec --user 0 "$API_CONTAINER" sh -c '[ -e "$1" ] || [ -L "$1" ]' sh "$prompt_path"; then
  docker exec --user 0 "$API_CONTAINER" sh -c '[ -f "$1" ] && [ ! -L "$1" ]' sh "$prompt_path" || fail PROMPT_ASSET_PATH_UNSAFE
  [ "$(docker exec --user 0 "$API_CONTAINER" stat -c '%a' "$prompt_path")" = 600 ] || fail PROMPT_ASSET_MODE_MISMATCH
  [ "$(docker exec "$API_CONTAINER" sha256sum "$prompt_path" | awk '{print $1}')" = "$prompt_asset_sha" ] || fail PROMPT_ASSET_EXISTING_HASH_MISMATCH
else
  docker cp "$candidate/tools/summary-draft-prompt.json" "$API_CONTAINER:$prompt_install_stage" >/dev/null || fail PROMPT_ASSET_INSTALL_FAILED
  docker exec --user 0 "$API_CONTAINER" chown "$api_uid:$api_gid" "$prompt_install_stage" || fail PROMPT_ASSET_OWNER_FAILED
  docker exec --user 0 "$API_CONTAINER" chmod 0600 "$prompt_install_stage" || fail PROMPT_ASSET_MODE_FAILED
  [ "$(docker exec "$API_CONTAINER" sha256sum "$prompt_install_stage" | awk '{print $1}')" = "$prompt_asset_sha" ] || fail PROMPT_ASSET_INSTALLED_HASH_MISMATCH
  docker exec --user 0 "$API_CONTAINER" ln "$prompt_install_stage" "$prompt_path" || fail PROMPT_ASSET_INSTALL_RACE
  docker exec --user 0 "$API_CONTAINER" rm -f "$prompt_install_stage" || fail PROMPT_ASSET_INSTALL_STAGE_CLEANUP_FAILED
  [ "$(docker exec "$API_CONTAINER" sha256sum "$prompt_path" | awk '{print $1}')" = "$prompt_asset_sha" ] || fail PROMPT_ASSET_INSTALLED_HASH_MISMATCH
fi

for dir in "$WORKSPACE" "$WORKSPACE/tools" "$WORKSPACE/source" "$WORKSPACE/source/scripts" "$WORKSPACE/source/scripts/fiscal" "$WORKSPACE/state" "$WORKSPACE/results" "$WORKSPACE/logs" "$WORKSPACE/backups"; do
  mkdir -m 700 "$dir" 2>/dev/null || [ -d "$dir" ] || fail WORKSPACE_DIRECTORY_CREATE_FAILED
  chmod 700 "$dir"
done
for name in api-image-id operator.sha256 summary-draft-manifest.json summary-draft-prompt.json; do
  cp "$candidate/tools/$name" "$WORKSPACE/tools/$name"
  chmod 600 "$WORKSPACE/tools/$name"
done
cp "$candidate/source/scripts/fiscal/nas-summary-draft-nightly.ts" "$WORKSPACE/source/scripts/fiscal/nas-summary-draft-nightly.ts"
cp "$candidate/tools/nas-summary-draft-nightly-launcher.sh" "$WORKSPACE/tools/nas-summary-draft-nightly-launcher.sh"
cp "$candidate/tools/summary-draft-entrypoint.sh" "$WORKSPACE/tools/summary-draft-entrypoint.sh"
chmod 600 "$WORKSPACE/source/scripts/fiscal/nas-summary-draft-nightly.ts"
chmod 750 "$WORKSPACE/tools/nas-summary-draft-nightly-launcher.sh" "$WORKSPACE/tools/summary-draft-entrypoint.sh"
for dir in "$WORKSPACE/source" "$WORKSPACE/source/scripts" "$WORKSPACE/source/scripts/fiscal"; do chmod 700 "$dir"; done

tmp=$(mktemp "$WORKSPACE/.crontab.XXXXXX") || fail CRONTAB_TEMP_CREATE
before="$WORKSPACE/backups/crontab.pre-summary-draft.$(date -u +%Y%m%dT%H%M%SZ).$$.txt"
filtered="$tmp.filtered"
if ! crontab -l > "$tmp" 2>/dev/null; then [ ! -s "$tmp" ] || fail CRONTAB_READ_FAILED; : > "$tmp"; fi
chmod 600 "$tmp"
cp "$tmp" "$before"
chmod 600 "$before"
awk -v begin="$BEGIN_MARKER" -v end="$END_MARKER" '
  $0==begin {if(inside)bad=1;inside=1;begins++;next}
  $0==end {if(!inside)bad=1;inside=0;ends++;next}
  !inside {print}
  END {if(inside||bad||begins!=ends||begins>1)exit 42}
' "$tmp" > "$filtered" || fail OWNED_CRON_BLOCK_INVALID
awk '/summary-draft-entrypoint\.sh|nas-summary-draft-nightly-launcher\.sh/ {found++} END {exit found?1:0}' "$filtered" || fail DUPLICATE_SUMMARY_JOB_OUTSIDE_BLOCK
chmod 600 "$filtered"
cat "$filtered" > "$tmp.new"
[ ! -s "$tmp.new" ] || printf '\n' >> "$tmp.new"
cat "$candidate/cron/owned-block.candidate.txt" >> "$tmp.new"
chmod 600 "$tmp.new"
cron_bytes=$(awk '$0 ~ /^30 3 \* \* \*/ {print length($0)}' "$tmp.new")
[ -n "$cron_bytes" ] && [ "$cron_bytes" -lt 512 ] || fail CRON_LINE_INVALID
if ! crontab "$tmp.new"; then fail CRONTAB_INSTALL_FAILED_BACKUP_RETAINED; fi
readback="$tmp.readback"
if ! crontab -l > "$readback" 2>/dev/null || ! cmp -s "$tmp.new" "$readback"; then
  if crontab "$tmp"; then fail CRONTAB_READBACK_MISMATCH_OLD_CRONTAB_RESTORED; fi
  fail CRONTAB_READBACK_MISMATCH_ROLLBACK_FAILED
fi
chmod 600 "$WORKSPACE/logs/cron.log" 2>/dev/null || :
touch "$WORKSPACE/logs/cron.log"
chmod 600 "$WORKSPACE/logs/cron.log"
rm -f "$tmp" "$filtered" "$tmp.new" "$readback"
printf 'SUMMARY_DRAFT_INSTALL=INSTALLED\nCRON_ENTRY_BYTES=%s\nCRON_BACKUP=%s\nENTRYPOINT_SHA256=%s\nFIRST_RUN_NEXT_0330=1\n' "$cron_bytes" "$before" "$entrypoint_sha"
