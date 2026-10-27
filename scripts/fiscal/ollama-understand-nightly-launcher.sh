#!/bin/sh
set -eu
umask 077

readonly WORKSPACE=/vol2/1000/docker/fiscalhot-understand-nightly
readonly API_CONTAINER=fiscalhot-staging-api-1
readonly API_IMAGE=sha256:54d1a34f104b665ccdecc60e82f4cb67acf114fb3171b742990464ee6d4c7bc6
readonly POSTGRES_IMAGE=sha256:79bd7c99e923138f136f8009d6bffa66e21e9d4fda5c0c561b00fc9c90cfe537
readonly DB_NAME=fiscalhot_ollama_understand_20261027_test
readonly GATEWAY_CONFIG=/vol2/1000/docker/ollama-gateway/default.conf
readonly MODEL_NAME=qwen3.5:9b
readonly MODEL_DIGEST=6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7
readonly MIN_WARM_BYTES=4294967296
readonly MIN_COLD_BYTES=18899292650
readonly RESULT_FORMAT=ollama-understand-nightly-launch-result/v1

preserve_pg=0
client_name=
pg_name=
client_created=0
pg_created=0
api_key=
tmpdir=

fail() { printf 'LAUNCHER_FAILED=%s\n' "$1" >&2; exit 1; }
is_sha() { case "$1" in *[!A-Fa-f0-9]*|'') return 1;; esac; [ "${#1}" -eq 64 ]; }
valid_hex_id() { case "$1" in *[!a-fA-F0-9]*|'') return 1;; esac; [ "${#1}" -eq 64 ]; }

cleanup() {
  [ -z "$api_key" ] || unset api_key
  if [ "$client_created" -eq 1 ]; then docker rm -f "$client_name" >/dev/null 2>&1 || true; fi
  if [ "$pg_created" -eq 1 ] && [ "$preserve_pg" -eq 0 ]; then docker rm -f "$pg_name" >/dev/null 2>&1 || true; fi
  [ -z "$tmpdir" ] || rm -rf "$tmpdir"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

run_id=${OLLAMA_PILOT_RUN_ID:-}
deadline=${OLLAMA_PILOT_DEADLINE_EPOCH_MS:-}
result_path=${OLLAMA_PILOT_RESULT_PATH:-}
input_sha=${OLLAMA_PILOT_INPUT_SHA256:-}
manifest_sha=${OLLAMA_PILOT_CODE_MANIFEST_SHA256:-}
wrapper_sha=${OLLAMA_PILOT_WRAPPER_SHA256:-}
launcher_sha=${OLLAMA_PILOT_LAUNCHER_SHA256:-}
case "$run_id" in ollama-understand-development-r1-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]) ;; *) fail RUN_ID_INVALID;; esac
case "$deadline" in ''|*[!0-9]*) fail DEADLINE_INVALID;; esac
is_sha "$input_sha" && is_sha "$manifest_sha" && is_sha "$wrapper_sha" && is_sha "$launcher_sha" || fail HASH_ARGUMENT_INVALID
[ "$(sha256sum "$0" | awk '{print toupper($1)}')" = "$(printf '%s' "$launcher_sha" | tr '[:lower:]' '[:upper:]')" ] || fail LAUNCHER_HASH_MISMATCH
case "$result_path" in "$WORKSPACE/results/"*.result.json) ;; *) fail RESULT_PATH_OUTSIDE_PRIVATE_DIRECTORY;; esac
[ -f "$WORKSPACE/tools/api-image-id" ] && [ "$(cat "$WORKSPACE/tools/api-image-id")" = "$API_IMAGE" ] || fail API_IMAGE_PIN_MISMATCH
[ -f "$WORKSPACE/tools/postgres-image-id" ] && [ "$(cat "$WORKSPACE/tools/postgres-image-id")" = "$POSTGRES_IMAGE" ] || fail POSTGRES_IMAGE_PIN_MISMATCH
[ -f "$WORKSPACE/tools/package-lock.canonical-sha256" ] || fail PACKAGE_LOCK_PIN_MISSING
source_package_lock_sha=$(python3 -c 'import hashlib,json,sys; obj=json.load(open(sys.argv[1],encoding="utf-8")); print(hashlib.sha256(json.dumps(obj,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest())' "$WORKSPACE/source/package-lock.json" 2>/dev/null) || fail FROZEN_PACKAGE_LOCK_INVALID
[ "$source_package_lock_sha" = "$(cat "$WORKSPACE/tools/package-lock.canonical-sha256")" ] || fail FROZEN_PACKAGE_LOCK_CHANGED

write_resource_skip() {
  reason=$1
  checked=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  temp_result="$result_path.tmp"
  printf '{"format":"%s","runId":"%s","status":"SKIPPED_RESOURCE","reason":"%s","preflightOnly":true,"providerRequestsStarted":0,"actualProviderRequests":0,"containersCreated":0,"inputSha256":"%s","codeManifestSha256":"%s","wrapperSha256":"%s","launcherSha256":"%s","checkedAt":"%s"}\n' \
    "$RESULT_FORMAT" "$run_id" "$reason" "$input_sha" "$manifest_sha" "$wrapper_sha" "$launcher_sha" "$checked" > "$temp_result"
  chmod 600 "$temp_result"
  mv "$temp_result" "$result_path"
  exit 75
}

mem_kb=$(awk '/^MemAvailable:/ {print $2; found=1} END {if (!found) exit 1}' /proc/meminfo) || fail MEMINFO_UNAVAILABLE
case "$mem_kb" in ''|*[!0-9]*) fail MEMINFO_INVALID;; esac
mem_bytes=$((mem_kb * 1024))
[ "$mem_bytes" -ge "$MIN_WARM_BYTES" ] || write_resource_skip NAS_MEM_AVAILABLE_BELOW_GATE

docker info >/dev/null 2>&1 || fail DOCKER_ACCESS
[ "$(docker inspect --format '{{.Image}}' "$API_CONTAINER" 2>/dev/null)" = "$API_IMAGE" ] || fail API_IMAGE_OR_CONTAINER_CHANGED
[ "$(docker inspect --format '{{.State.Running}}' "$API_CONTAINER" 2>/dev/null)" = true ] || fail API_CONTAINER_NOT_RUNNING
docker image inspect "$API_IMAGE" >/dev/null 2>&1 || fail API_IMAGE_MISSING
docker image inspect "$POSTGRES_IMAGE" >/dev/null 2>&1 || fail POSTGRES_IMAGE_MISSING
docker inspect --format '{{json .Mounts}}' "$API_CONTAINER" | python3 -c '
import json, sys
mounts = json.load(sys.stdin)
targets = [m.get("Destination", "") for m in mounts or []]
raise SystemExit(1 if any(t == "/app" or "/app/package-lock.json".startswith(t.rstrip("/") + "/") or t == "/app/package-lock.json" for t in targets) else 0)
' || fail API_PACKAGE_LOCK_MOUNTED_NOT_IMAGE_VERIFIABLE
api_package_lock_sha=$(docker cp "$API_CONTAINER:/app/package-lock.json" - 2>/dev/null | python3 -c '
import hashlib, json, sys, tarfile
try:
    with tarfile.open(fileobj=sys.stdin.buffer, mode="r|*") as archive:
        for member in archive:
            if member.isfile() and member.name.rsplit("/", 1)[-1] == "package-lock.json":
                obj = json.load(archive.extractfile(member))
                canonical = json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
                print(hashlib.sha256(canonical).hexdigest())
                raise SystemExit(0)
except Exception:
    pass
raise SystemExit(2)
' 2>/dev/null)
[ "$api_package_lock_sha" = "$(cat "$WORKSPACE/tools/package-lock.canonical-sha256")" ] || fail API_PACKAGE_LOCK_MISMATCH
if docker image inspect --format '{{json .Config.Env}}' "$API_IMAGE" | python3 -c '
import json, re, sys
values = json.load(sys.stdin)
for item in values or []:
    name = item.split("=", 1)[0]
    if re.search(r"(?:API_KEY|DATABASE_URL|BASE_URL|PROXY|TOKEN|SECRET|PASSWORD|CREDENTIAL|NODE_OPTIONS|NODE_PATH)$", name, re.I):
        raise SystemExit(1)
'; then :; else fail IMAGE_SENSITIVE_OR_NODE_OVERRIDE_ENV_PRESENT; fi

# Read the gateway credential into a short-lived process and retain it only in launcher memory.
api_key=$(python3 - "$GATEWAY_CONFIG" <<'PY'
import pathlib, re, sys
text = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
text = "\n".join(line for line in text.splitlines() if not line.lstrip().startswith("#"))
patterns = [r"(?i)\bBearer\s+([A-Za-z0-9._~+/=-]{16,4096})", r"(?im)^\s*(?:OLLAMA_API_KEY|LLM_API_KEY|API_KEY)\s*=\s*[\"']?([A-Za-z0-9._~+/=-]{16,4096})"]
found = []
for pattern in patterns:
    found.extend(re.findall(pattern, text))
found = list(dict.fromkeys(found))
if len(found) != 1:
    raise SystemExit(2)
sys.stdout.write(found[0] + "\n")
PY
) || fail GATEWAY_CREDENTIAL_NOT_AVAILABLE
[ -n "$api_key" ] || fail GATEWAY_CREDENTIAL_NOT_AVAILABLE

# Pin the installed local model digest before any pilot container or provider request.
model_digest=$(printf '%s\n' "$api_key" | python3 -c '
import json, sys, urllib.request
key = sys.stdin.readline().rstrip("\r\n")
request = urllib.request.Request("http://192.168.3.100:11435/api/tags", headers={"Authorization": "Bearer " + key}, method="GET")
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None
try:
    with urllib.request.build_opener(NoRedirect).open(request, timeout=8) as response:
        payload = json.load(response)
    matches = [m for m in payload.get("models", []) if m.get("name") == "qwen3.5:9b" or m.get("model") == "qwen3.5:9b"]
    if len(matches) != 1:
        raise ValueError()
    model = matches[0]
    if model.get("digest") != "6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7":
        raise ValueError()
    def category(value):
        if value is None: return "null"
        if value is False: return "false"
        if value == "": return "empty"
        if value == "local": return "local"
        raise ValueError()
    remote = sorted({category(v) for k, v in model.items() if k.lower().startswith("remote")})
    cloud = sorted({category(v) for k, v in model.items() if k.lower().startswith("cloud")})
    print(model["digest"] + " " + (",".join(remote) if remote else "absent") + " " + (",".join(cloud) if cloud else "absent"))
except Exception:
    raise SystemExit(3)
') || fail MODEL_TAG_PROVENANCE_UNAVAILABLE_OR_MISMATCHED
set -- $model_digest
[ "$#" -eq 3 ] || fail MODEL_TAG_PROVENANCE_METADATA_INVALID
model_digest=$1
model_remote_status=$2
model_cloud_status=$3
[ "$model_digest" = "$MODEL_DIGEST" ] || fail MODEL_TAG_PROVENANCE_MISMATCHED

# One authenticated metadata GET only. Never emit the gateway response or credential.
model_loaded=$(printf '%s\n' "$api_key" | python3 -c '
import json, sys, urllib.request
key = sys.stdin.readline().rstrip("\r\n")
request = urllib.request.Request("http://192.168.3.100:11435/api/ps", headers={"Authorization": "Bearer " + key}, method="GET")
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None
try:
    with urllib.request.build_opener(NoRedirect).open(request, timeout=8) as response:
        payload = json.load(response)
    models = payload.get("models", [])
    match = [m for m in models if m.get("name") == "qwen3.5:9b" or m.get("model") == "qwen3.5:9b"]
    if len(match) > 1:
        raise ValueError()
    print("1" if match else "0")
except Exception:
    raise SystemExit(3)
') || fail OLLAMA_PS_METADATA_UNAVAILABLE
case "$model_loaded" in 0|1) ;; *) fail OLLAMA_PS_METADATA_INVALID;; esac
if [ "$model_loaded" -eq 0 ] && [ "$mem_bytes" -lt "$MIN_COLD_BYTES" ]; then
  unset api_key
  api_key=
  write_resource_skip MODEL_RESIDENT_MEMORY_BELOW_GATE
fi

# Inspect the API's network namespace table through host procfs; do not exec a process in the API container.
api_pid=$(docker inspect --format '{{.State.Pid}}' "$API_CONTAINER" 2>/dev/null) || fail API_PID_METADATA_UNAVAILABLE
case "$api_pid" in ''|*[!0-9]*|0) fail API_PID_METADATA_INVALID;; esac
[ -r "/proc/$api_pid/net/tcp" ] && [ -r "/proc/$api_pid/net/tcp6" ] || fail API_NETNS_PROCFS_UNAVAILABLE
if awk '$2 ~ /:D889$/ && $4 == "0A" { found=1 } END { exit found ? 0 : 1 }' "/proc/$api_pid/net/tcp" "/proc/$api_pid/net/tcp6"; then
  unset api_key
  api_key=
  write_resource_skip PILOT_DB_PORT_BUSY
fi

suffix=${run_id#ollama-understand-development-r1-}
client_name="fiscalhot-understand-${suffix}-client"
pg_name="fiscalhot-understand-${suffix}-pg"
if docker container inspect "$client_name" >/dev/null 2>&1 || docker container inspect "$pg_name" >/dev/null 2>&1; then
  fail OWNED_CONTAINER_NAME_ALREADY_EXISTS
fi

result_dir=$(dirname "$result_path")
mkdir -p "$result_dir"
chmod 700 "$result_dir"
tmpdir=$(mktemp -d "$WORKSPACE/.run-${suffix}.XXXXXX") || fail PRIVATE_TEMP_CREATE
chmod 700 "$tmpdir"

docker create --name "$pg_name" --network "container:$API_CONTAINER" \
  --memory=512m --cpus=1 --pids-limit=128 \
  --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=256m \
  --env POSTGRES_DB="$DB_NAME" --env POSTGRES_HOST_AUTH_METHOD=trust \
  "$POSTGRES_IMAGE" -c listen_addresses=127.0.0.1 -p 55433 >/dev/null || fail PG_CONTAINER_CREATE_FAILED
pg_created=1
docker create --name "$client_name" --hostname "fiscal-understand-$suffix" \
  --network "container:$API_CONTAINER" --memory=768m --cpus=2 --pids-limit=128 \
  --workdir /app --entrypoint /bin/sh "$API_IMAGE" -c 'while :; do sleep 3600; done' >/dev/null || fail CLIENT_CONTAINER_CREATE_FAILED
client_created=1

docker start "$pg_name" >/dev/null || fail PG_CONTAINER_START_FAILED
docker start "$client_name" >/dev/null || fail CLIENT_CONTAINER_START_FAILED
client_id=$(docker inspect --format '{{.Id}}' "$client_name")
pg_id=$(docker inspect --format '{{.Id}}' "$pg_name")
valid_hex_id "$client_id" && valid_hex_id "$pg_id" || fail CONTAINER_ID_INVALID
docker exec "$client_name" sh -c 'test -z "$(find /app -type f -name ".env*" -print -quit 2>/dev/null)" && mkdir -p /run/ollama-understand-pilot' || fail CLIENT_ENV_FILE_PRESENT_OR_RUNTIME_INVALID
printf '%s\n' "$client_id" | docker exec -i "$client_name" sh -c 'cat > /run/ollama-understand-pilot/container-id' || fail CLIENT_MARKER_WRITE_FAILED

# Copy the allowlisted private tree into the client writable layer; no host bind mounts.
docker cp "$WORKSPACE/source/." "$client_name:/app/" >/dev/null || fail CLIENT_SOURCE_COPY_FAILED
docker exec "$client_name" sh -c 'test ! -e /app/.data/fiscal-qa/development-understand-container-20261027/predictions-r1.json' || fail CLIENT_OUTPUT_ALREADY_EXISTS

ready=0
n=0
while [ "$n" -lt 45 ]; do
  if docker exec "$pg_name" pg_isready -h 127.0.0.1 -p 55433 -U postgres -d "$DB_NAME" >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
  n=$((n + 1))
done
[ "$ready" -eq 1 ] || fail PG_READY_TIMEOUT

db_url="postgres://postgres@127.0.0.1:55433/$DB_NAME"
docker exec "$client_name" env DATABASE_URL="$db_url" /usr/local/bin/node /app/scripts/migrate.ts >/dev/null || fail ISOLATED_DATABASE_MIGRATION_FAILED

# Preserve the isolated PG after this point until all artifacts are durable and verified.
preserve_pg=1
set +e
printf '%s\n' "$api_key" | docker exec -i "$client_name" env \
  OLLAMA_PILOT_API_KEY_STDIN=1 OLLAMA_PILOT_CONTAINER_ID="$client_id" \
  OLLAMA_PILOT_DEADLINE_EPOCH_MS="$deadline" DATABASE_URL="$db_url" \
  /usr/local/bin/node /app/scripts/fiscal/ollama-understand-container-pilot.ts
runner_rc=$?
set -e
unset api_key
api_key=
[ "$runner_rc" -eq 0 ] || fail PILOT_RUN_FAILED_PRESERVE_DATABASE

prediction_in_client=/app/.data/fiscal-qa/development-understand-container-20261027/predictions-r1.json
prediction_host="$result_dir/${run_id}.predictions.json"
evidence_host="$result_dir/${run_id}.receipt-evidence.json"
dump_host="$result_dir/${run_id}.pg_dump"
docker cp "$client_name:$prediction_in_client" "$prediction_host" >/dev/null || fail PREDICTIONS_EXPORT_FAILED_PRESERVE_DATABASE

# Safe projection only: omit request, response, headers, usage, cost, and error payloads.
docker exec "$pg_name" psql -X -qAt -U postgres -d "$DB_NAME" -c \
  "SELECT jsonb_pretty(jsonb_build_object('format','ollama-understand-receipt-evidence/v1','receipts',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'service',service,'model',model,'purpose',purpose,'status',status,'attempts',attempts,'createdAt',created_at,'completedAt',completed_at) ORDER BY id),'[]'::jsonb) FROM receipts),'attempts',(SELECT COALESCE(jsonb_agg(jsonb_build_object('receiptId',receipt_id,'attempt',attempt,'service',service,'model',model,'status',status,'startedAt',started_at,'finishedAt',finished_at,'latencyMs',latency_ms) ORDER BY id),'[]'::jsonb) FROM receipt_attempts)))" \
  > "$evidence_host" || fail RECEIPT_EVIDENCE_EXPORT_FAILED_PRESERVE_DATABASE
docker exec "$pg_name" pg_dump -U postgres -d "$DB_NAME" > "$dump_host" || fail PG_DUMP_EXPORT_FAILED_PRESERVE_DATABASE

chmod 600 "$prediction_host" "$evidence_host" "$dump_host"
[ -s "$prediction_host" ] && [ -s "$evidence_host" ] && [ -s "$dump_host" ] || fail ARTIFACT_EMPTY_PRESERVE_DATABASE
prediction_sha=$(sha256sum "$prediction_host" | awk '{print toupper($1)}')
evidence_sha=$(sha256sum "$evidence_host" | awk '{print toupper($1)}')
dump_sha=$(sha256sum "$dump_host" | awk '{print toupper($1)}')
is_sha "$prediction_sha" && is_sha "$evidence_sha" && is_sha "$dump_sha" || fail ARTIFACT_HASH_INVALID_PRESERVE_DATABASE

receipt_counts=$(docker exec "$pg_name" psql -X -qAt -U postgres -d "$DB_NAME" -c \
  "SELECT (SELECT count(*) FROM receipts)||':'||(SELECT count(*) FROM receipt_attempts)||':'||(SELECT count(*) FROM receipts WHERE status='completed')||':'||(SELECT count(*) FROM receipts WHERE status IN ('failed','pending','unknown'))") || fail RECEIPT_COUNTS_UNAVAILABLE_PRESERVE_DATABASE
[ "$receipt_counts" = 8:8:8:0 ] || fail RECEIPT_COUNTS_MISMATCH_PRESERVE_DATABASE

request_times=$(python3 - "$prediction_host" "$deadline" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as handle:
    obj = json.load(handle)
times = obj.get("requestStartedAtEpochMs")
deadline = int(sys.argv[2])
if not isinstance(times, list) or len(times) != 8 or any(not isinstance(x, int) or x <= 0 or x >= deadline for x in times) or any(times[i] < times[i-1] for i in range(1, len(times))):
    raise SystemExit(2)
print(",".join(str(x) for x in times))
PY
) || fail REQUEST_TIME_EVIDENCE_INVALID_PRESERVE_DATABASE

finished=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
sidecar_tmp="$result_path.tmp"
printf '{"format":"%s","runId":"%s","status":"COMPLETED","inputSha256":"%s","codeManifestSha256":"%s","wrapperSha256":"%s","launcherSha256":"%s","model":"qwen3.5:9b","modelDigest":"%s","modelRemoteMarkerStatus":"%s","modelCloudMarkerStatus":"%s","apiImageId":"%s","packageLockMatch":true,"sourcePackageLockCanonicalSha256":"%s","apiPackageLockCanonicalSha256":"%s","imageSensitiveEnvAbsent":true,"imageNodeOptionsAbsent":true,"imageNodePathAbsent":true,"actualProviderRequests":8,"receiptAttempts":8,"completedReceipts":8,"failedReceipts":0,"pendingReceipts":0,"unknownReceipts":0,"businessRowCountsUnchanged":true,"requestStartedAtEpochMs":[%s],"predictionsPath":"%s","predictionsSha256":"%s","receiptEvidencePath":"%s","receiptEvidenceSha256":"%s","pgDumpPath":"%s","pgDumpSha256":"%s","clientContainerId":"%s","pgContainerId":"%s","finishedAt":"%s"}\n' \
  "$RESULT_FORMAT" "$run_id" "$input_sha" "$manifest_sha" "$wrapper_sha" "$launcher_sha" "$MODEL_DIGEST" "$model_remote_status" "$model_cloud_status" "$API_IMAGE" "$source_package_lock_sha" "$api_package_lock_sha" "$request_times" \
  "$prediction_host" "$prediction_sha" "$evidence_host" "$evidence_sha" "$dump_host" "$dump_sha" "$client_id" "$pg_id" "$finished" > "$sidecar_tmp"
chmod 600 "$sidecar_tmp"
mv "$sidecar_tmp" "$result_path"

# Only named job containers are removed after successful artifact verification.
preserve_pg=0
docker rm -f "$client_name" >/dev/null
client_created=0
docker rm -f "$pg_name" >/dev/null
pg_created=0
printf 'LAUNCHER_RESULT=COMPLETED\nPROVIDER_REQUESTS=8\nPREDICTIONS_SHA256=%s\nRECEIPT_EVIDENCE_SHA256=%s\nPG_DUMP_SHA256=%s\n' \
  "$prediction_sha" "$evidence_sha" "$dump_sha"
