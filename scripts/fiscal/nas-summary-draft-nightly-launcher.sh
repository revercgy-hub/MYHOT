#!/bin/sh
set -eu
umask 077

readonly WORKSPACE=/vol2/1000/docker/fiscalhot-summary-draft-nightly-20261028
readonly API_CONTAINER=fiscalhot-staging-api-1
readonly API_IMAGE_PIN=$WORKSPACE/tools/api-image-id
readonly MANIFEST=$WORKSPACE/tools/summary-draft-manifest.json
readonly OPERATOR=$WORKSPACE/source/scripts/fiscal/nas-summary-draft-nightly.ts
readonly OPERATOR_PIN=$WORKSPACE/tools/operator.sha256
readonly NIGHT_WORKSPACE=/vol2/1000/docker/fiscalhot-understand-nightly
readonly LOCK_FILE=$NIGHT_WORKSPACE/state/ollama-understand-nightly.lock
readonly GATEWAY_CONFIG=/vol2/1000/docker/ollama-gateway/default.conf
readonly DATA_DIR=/data
readonly MODEL_NAME=qwen3.5:9b
readonly MODEL_DIGEST=6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7
readonly MIN_WARM_BYTES=4294967296
readonly MIN_COLD_BYTES=18899292650

mode_arg=plan-only
case "$#" in
  0) ;;
  1) [ "$1" = --execute ] || { printf 'SUMMARY_DRAFT_FAILED=UNKNOWN_ARGUMENT\n' >&2; exit 1; }; mode_arg=execute ;;
  *) printf 'SUMMARY_DRAFT_FAILED=UNKNOWN_ARGUMENT\n' >&2; exit 1 ;;
esac

fail() { printf 'SUMMARY_DRAFT_FAILED=%s\n' "$1" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "MISSING_$1"; }
mode() { stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1"; }

[ "$(id -u)" -ne 0 ] || fail ROOT_USER_NOT_ALLOWED
[ -d "$WORKSPACE" ] && [ "$(mode "$WORKSPACE")" = 700 ] || fail WORKSPACE_MODE
[ -d "$WORKSPACE/tools" ] && [ "$(mode "$WORKSPACE/tools")" = 700 ] || fail TOOLS_MODE
[ -d "$WORKSPACE/source" ] && [ "$(mode "$WORKSPACE/source")" = 700 ] || fail SOURCE_MODE
[ -d "$WORKSPACE/state" ] && [ "$(mode "$WORKSPACE/state")" = 700 ] || fail STATE_MODE
[ -d "$WORKSPACE/results" ] && [ "$(mode "$WORKSPACE/results")" = 700 ] || fail RESULTS_MODE
[ -d "$WORKSPACE/logs" ] && [ "$(mode "$WORKSPACE/logs")" = 700 ] || fail LOGS_MODE
[ -f "$LOCK_FILE" ] && [ "$(mode "$LOCK_FILE")" = 600 ] || fail SHARED_LOCK_INVALID
[ -f "$API_IMAGE_PIN" ] && [ "$(mode "$API_IMAGE_PIN")" = 600 ] || fail API_IMAGE_PIN_INVALID
[ -f "$MANIFEST" ] && [ "$(mode "$MANIFEST")" = 600 ] || fail MANIFEST_INVALID
[ -f "$OPERATOR" ] && [ -f "$OPERATOR_PIN" ] && [ "$(mode "$OPERATOR_PIN")" = 600 ] || fail OPERATOR_OR_PIN_MISSING
[ -n "${SUMMARY_DRAFT_MANIFEST_SHA256:-}" ] || fail ENTRYPOINT_MANIFEST_SHA_MISSING
[ "$(sha256sum "$MANIFEST" | awk '{print $1}')" = "$SUMMARY_DRAFT_MANIFEST_SHA256" ] || fail MANIFEST_SHA_MISMATCH

need sha256sum
need docker
need flock
need date
need cut
need python3
need awk
need cat
need fuser

operator_sha=$(sha256sum "$OPERATOR" | awk '{print $1}') || fail OPERATOR_HASH_READ
[ "$operator_sha" = "$(cat "$OPERATOR_PIN")" ] || fail OPERATOR_HASH_MISMATCH
api_image=$(cat "$API_IMAGE_PIN") || fail API_IMAGE_PIN_READ
case "$api_image" in sha256:*) api_hex=${api_image#sha256:};; *) fail API_IMAGE_ID_INVALID;; esac
case "$api_hex" in *[!a-f0-9]*|'') fail API_IMAGE_ID_INVALID;; esac
[ "${#api_hex}" -eq 64 ] || fail API_IMAGE_ID_INVALID
manifest_api_image=$(python3 - "$MANIFEST" "$operator_sha" <<'PY'
import json,re,sys
try:
    value=json.load(open(sys.argv[1],encoding='utf-8'))
    image=value.get('apiImageId')
    guards=value.get('guardrails')
    expected={'fixedSummarySources':20,'maxNightlyArticles':10,'maxProviderCalls':10,'localOnly':True,'noRetry':True}
    ok=value.get('schemaVersion')=='nas-summary-draft-candidate.v1' and value.get('imagePinBound') is True
    ok=ok and value.get('operatorSha256')==sys.argv[2] and isinstance(image,str) and re.fullmatch(r'sha256:[a-f0-9]{64}',image) is not None
    ok=ok and isinstance(guards,dict) and all(guards.get(k)==v for k,v in expected.items())
    if not ok: raise ValueError()
    print(image)
except Exception: raise SystemExit(2)
PY
) || fail IMAGE_MANIFEST_UNBOUND_OR_MISMATCH
[ "$manifest_api_image" = "$api_image" ] || fail IMAGE_MANIFEST_MISMATCH
slot=$(TZ=Asia/Shanghai date +%H%M)
day=$(TZ=Asia/Shanghai date +%Y%m%d)
if [ "$mode_arg" = execute ]; then
  case "$slot" in 02[0-5][0-9]|03[0-5][0-9]|04[0-5][0-9]|05[0-5][0-9]) ;; *) fail OUTSIDE_NIGHT_WINDOW;; esac
fi

exec 9<>"$LOCK_FILE"
if ! flock -n 9; then
  printf 'SUMMARY_DRAFT=SKIPPED_LOCK_BUSY\n'
  exit 0
fi
lock_held=1
lock_inode=$(stat -Lc '%d:%i' "$LOCK_FILE" 2>/dev/null || stat -f '%d:%i' "$LOCK_FILE")
api_key=
remote_operator=
run_log=
cleanup() {
  rc=$?
  [ -z "$api_key" ] || unset api_key
  unset LLM_API_KEY DATABASE_URL
  if [ -n "$remote_operator" ]; then docker exec --user 0 "$API_CONTAINER" rm -f "$remote_operator" >/dev/null 2>&1 || true; fi
  if [ "$lock_held" -eq 1 ]; then flock -u 9 >/dev/null 2>&1 || true; exec 9>&- 2>/dev/null || true; fi
  if [ "$lock_held" -eq 1 ]; then
    lock_held=0
    if [ "$(stat -Lc '%d:%i' "$LOCK_FILE" 2>/dev/null || stat -f '%d:%i' "$LOCK_FILE")" = "$lock_inode" ] && ! fuser "$LOCK_FILE" >/dev/null 2>&1 && flock -n "$LOCK_FILE" -c 'exit 0' && ! fuser "$LOCK_FILE" >/dev/null 2>&1; then
      [ -z "$run_log" ] || printf 'LOCK_RELEASE_PROOF=PASS sameInode=%s noHolder=1 foregroundAcquireRelease=PASS\n' "$lock_inode" >> "$run_log"
    else
      [ -z "$run_log" ] || printf 'LOCK_RELEASE_PROOF=FAIL\n' >> "$run_log"
      rc=1
    fi
  fi
  [ -z "$run_log" ] || chmod 600 "$run_log" 2>/dev/null || true
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

[ "$(docker inspect --format '{{.Image}}' "$API_CONTAINER" 2>/dev/null)" = "$api_image" ] || fail API_IMAGE_PIN_MISMATCH
[ "$(docker inspect --format '{{.State.Running}}' "$API_CONTAINER" 2>/dev/null)" = true ] || fail API_CONTAINER_NOT_RUNNING
[ "$(docker exec "$API_CONTAINER" node --version 2>/dev/null)" = v24.22.1 ] || fail API_NODE_VERSION
[ "$(docker exec "$API_CONTAINER" sha256sum /app/industry/sources.json 2>/dev/null | cut -d ' ' -f 1)" = "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1],encoding="utf-8"))["appCatalogSha256"])' "$MANIFEST")" ] || fail API_CATALOG_PIN_MISMATCH

# Prove docker exec inherits a host process environment value before handling the real key.
LLM_API_KEY=codex-nonsecret-env-probe-20261028
SUMMARY_DRAFT_PROBE_EXPECTED=$LLM_API_KEY
export LLM_API_KEY SUMMARY_DRAFT_PROBE_EXPECTED
docker exec --env LLM_API_KEY --env SUMMARY_DRAFT_PROBE_EXPECTED "$API_CONTAINER" sh -c '[ "$LLM_API_KEY" = "$SUMMARY_DRAFT_PROBE_EXPECTED" ]' || fail DOCKER_EXEC_ENV_INHERITANCE_FAILED
unset LLM_API_KEY SUMMARY_DRAFT_PROBE_EXPECTED

database_url=$(docker exec "$API_CONTAINER" printenv DATABASE_URL 2>/dev/null) || fail API_DATABASE_URL_UNAVAILABLE
[ -n "$database_url" ] || fail API_DATABASE_URL_UNAVAILABLE
DATABASE_URL=$database_url
export DATABASE_URL
unset database_url
docker exec --env DATABASE_URL "$API_CONTAINER" sh -c 'test -n "$DATABASE_URL"' || fail DATABASE_URL_INHERITANCE_FAILED

if [ "$mode_arg" = execute ]; then
  mem_kb=$(awk '/^MemAvailable:/ {print $2; found=1} END {if (!found) exit 1}' /proc/meminfo) || fail MEMINFO_UNAVAILABLE
  case "$mem_kb" in ''|*[!0-9]*) fail MEMINFO_INVALID;; esac
  mem_bytes=$((mem_kb * 1024))
  [ "$mem_bytes" -ge "$MIN_WARM_BYTES" ] || fail NAS_MEM_AVAILABLE_BELOW_GATE
  api_key=$(python3 - "$GATEWAY_CONFIG" <<'PY'
import pathlib,re,sys
text=pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
text='\n'.join(line for line in text.splitlines() if not line.lstrip().startswith('#'))
patterns=[r'(?i)\bBearer\s+([A-Za-z0-9._~+/=-]{16,4096})',r'(?im)^\s*(?:OLLAMA_API_KEY|LLM_API_KEY|API_KEY)\s*=\s*["\']?([A-Za-z0-9._~+/=-]{16,4096})']
found=[]
for pattern in patterns: found.extend(re.findall(pattern,text))
found=list(dict.fromkeys(found))
if len(found)!=1: raise SystemExit(2)
sys.stdout.write(found[0]+'\n')
PY
) || fail LOCAL_OLLAMA_KEY_UNAVAILABLE
  [ -n "$api_key" ] || fail LOCAL_OLLAMA_KEY_UNAVAILABLE
  export LLM_API_KEY=$api_key
  model_digest=$(printf '%s\n' "$api_key" | python3 -c '
import json,sys,urllib.request
key=sys.stdin.readline().rstrip("\r\n")
request=urllib.request.Request("http://192.168.3.100:11435/api/tags",headers={"Authorization":"Bearer "+key},method="GET")
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args): return None
try:
 with urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect).open(request,timeout=8) as response: payload=json.load(response)
 matches=[m for m in payload.get("models",[]) if m.get("name")=="qwen3.5:9b" or m.get("model")=="qwen3.5:9b"]
 if len(matches)!=1 or matches[0].get("digest")!="6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7": raise ValueError()
 def category(value):
  if value is None:return "null"
  if value is False:return "false"
  if value=="":return "empty"
  if value=="local":return "local"
  raise ValueError()
 for prefix in ("remote","cloud"):
  markers={category(v) for k,v in matches[0].items() if k.lower().startswith(prefix)}
  if markers-{"null","false","empty","local"}:raise ValueError()
 print(matches[0]["digest"])
except Exception: raise SystemExit(2)
') || fail LOCAL_OLLAMA_MODEL_PIN_MISMATCH
  [ "$model_digest" = "$MODEL_DIGEST" ] || fail LOCAL_OLLAMA_MODEL_PIN_MISMATCH
  model_loaded=$(printf '%s\n' "$api_key" | python3 -c '
import json,sys,urllib.request
key=sys.stdin.readline().rstrip("\r\n")
request=urllib.request.Request("http://192.168.3.100:11435/api/ps",headers={"Authorization":"Bearer "+key},method="GET")
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args): return None
try:
 with urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect).open(request,timeout=8) as response: payload=json.load(response)
 matches=[m for m in payload.get("models",[]) if m.get("name")=="qwen3.5:9b" or m.get("model")=="qwen3.5:9b"]
 if len(matches)>1: raise ValueError()
 print("1" if matches else "0")
except Exception: raise SystemExit(2)
') || fail LOCAL_OLLAMA_PS_UNAVAILABLE
  case "$model_loaded" in 0|1) ;; *) fail LOCAL_OLLAMA_PS_UNAVAILABLE;; esac
  if [ "$model_loaded" -eq 0 ] && [ "$mem_bytes" -lt "$MIN_COLD_BYTES" ]; then fail MODEL_RESIDENT_MEMORY_BELOW_GATE; fi
fi

# Freeze the database-input scope for this preparation attempt. This is not a collector
# run ID: each selected article remains bound to its own DB row/body hash and raw lineage.
source_run_id="summary-draft-scope-$day"

if [ "$mode_arg" = execute ]; then
  once_file="$WORKSPACE/state/summary-draft-$day.started"
  if [ -e "$once_file" ]; then printf 'SUMMARY_DRAFT=SKIPPED_ALREADY_STARTED runId=summary-draft-$day\n'; exit 0; fi
  (set -C; printf 'summary-draft-%s\n' "$day" > "$once_file") 2>/dev/null || { printf 'SUMMARY_DRAFT=SKIPPED_ALREADY_STARTED runId=summary-draft-%s\n' "$day"; exit 0; }
  chmod 600 "$once_file"
fi

if [ "$mode_arg" = execute ]; then run_id="summary-draft-$day-$slot"; else run_id="summary-draft-plan-$day-$slot-$$"; fi
roster_file="$DATA_DIR/summary-draft-rosters/$run_id.roster.json"
run_log="$WORKSPACE/logs/$run_id.log"
[ ! -e "$run_log" ] || fail RUN_LOG_ALREADY_EXISTS
touch "$run_log"
chmod 600 "$run_log"
tmp_sha=$(printf '%s' "$operator_sha" | cut -c1-12)
remote_operator="/app/scripts/fiscal/.codex-summary-draft.$tmp_sha.$$.ts"
docker cp "$OPERATOR" "$API_CONTAINER:$remote_operator" >/dev/null || fail OPERATOR_STAGE_FAILED
api_uid=$(docker exec "$API_CONTAINER" id -u 2>/dev/null) || fail API_RUNTIME_UID_UNAVAILABLE
api_gid=$(docker exec "$API_CONTAINER" id -g 2>/dev/null) || fail API_RUNTIME_GID_UNAVAILABLE
case "$api_uid:$api_gid" in *[!0-9:]*|:*) fail API_RUNTIME_ID_INVALID;; esac
docker exec --user 0 "$API_CONTAINER" chown "$api_uid:$api_gid" "$remote_operator" || fail OPERATOR_STAGE_OWNER_FAILED
docker exec --user 0 "$API_CONTAINER" chmod 0600 "$remote_operator" || fail OPERATOR_STAGE_MODE_FAILED
[ "$(docker exec "$API_CONTAINER" sha256sum "$remote_operator" | cut -d ' ' -f 1)" = "$operator_sha" ] || fail STAGED_OPERATOR_HASH_MISMATCH

exec_operator() {
  docker exec --env DATABASE_URL --env LLM_API_KEY "$API_CONTAINER" env \
    AIHOT_APP_ROOT=/app AIHOT_DATA_DIR="$DATA_DIR" DATABASE_POOL_MAX=1 MODEL_CALLS_ENABLED=false \
    node "$remote_operator" "$@"
}

set +e
exec_operator --prepare-roster --source-run-id "$source_run_id" --out "$roster_file" >> "$run_log" 2>&1
prepare_rc=$?
set -e
[ "$prepare_rc" -eq 0 ] || fail ROSTER_PREPARE_FAILED
roster_sha=$(docker exec "$API_CONTAINER" sha256sum "$roster_file" | cut -d ' ' -f 1) || fail ROSTER_HASH_READ
set +e
exec_operator --roster "$roster_file" --roster-sha256 "$roster_sha" --run-id "$run_id" >> "$run_log" 2>&1
plan_rc=$?
set -e
[ "$plan_rc" -eq 0 ] || fail PLAN_ONLY_FAILED
if [ "$mode_arg" = execute ]; then
  set +e
  exec_operator --roster "$roster_file" --roster-sha256 "$roster_sha" --run-id "$run_id" --execute >> "$run_log" 2>&1
  execute_rc=$?
  set -e
  [ "$execute_rc" -eq 0 ] || fail SUMMARY_EXECUTION_FAILED_NO_RETRY
  printf 'SUMMARY_DRAFT=COMPLETED runId=%s sourceRunId=%s rosterSha256=%s\n' "$run_id" "$source_run_id" "$roster_sha"
else
  printf 'SUMMARY_DRAFT=PLAN_ONLY runId=%s sourceRunId=%s rosterSha256=%s\n' "$run_id" "$source_run_id" "$roster_sha"
fi
