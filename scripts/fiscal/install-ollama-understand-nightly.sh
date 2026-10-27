#!/bin/sh
set -eu
umask 077
dry_run=0
if [ "$#" -gt 0 ]; then
  [ "$#" -eq 1 ] && [ "$1" = --dry-run ] || { printf 'INSTALL_PREFLIGHT_FAILED=UNKNOWN_ARGUMENT\n' >&2; exit 1; }
  dry_run=1
fi

readonly WORKSPACE=/vol2/1000/docker/fiscalhot-understand-nightly
readonly API_CONTAINER=fiscalhot-staging-api-1
readonly API_IMAGE=sha256:54d1a34f104b665ccdecc60e82f4cb67acf114fb3171b742990464ee6d4c7bc6
readonly POSTGRES_IMAGE=sha256:79bd7c99e923138f136f8009d6bffa66e21e9d4fda5c0c561b00fc9c90cfe537
readonly NODE_SHA256=e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb
readonly BEGIN_MARKER='# BEGIN CODEX OLLAMA UNDERSTAND NIGHTLY v1'
readonly END_MARKER='# END CODEX OLLAMA UNDERSTAND NIGHTLY v1'

fail() { printf 'INSTALL_PREFLIGHT_FAILED=%s\n' "$1" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "MISSING_$1"; }

[ "$(id -u)" -ne 0 ] || fail ROOT_USER_NOT_ALLOWED
[ -d "$WORKSPACE" ] || fail PRIVATE_WORKSPACE_MISSING
[ "$(stat -c '%a' "$WORKSPACE" 2>/dev/null || stat -f '%Lp' "$WORKSPACE")" = 700 ] || fail PRIVATE_WORKSPACE_MODE
[ -x "$WORKSPACE/bin/node" ] || fail PRIVATE_NODE_MISSING
[ -e "$WORKSPACE/source" ] && [ -e "$WORKSPACE/tools" ] || {
  [ ! -e "$WORKSPACE/source" ] && [ ! -e "$WORKSPACE/tools" ] || fail PARTIAL_INSTALL_TREE_REVIEW_REQUIRED
}
[ ! -e "$WORKSPACE/source.next" ] && [ ! -e "$WORKSPACE/tools.next" ] && [ ! -e "$WORKSPACE/source.previous" ] && [ ! -e "$WORKSPACE/tools.previous" ] || fail STALE_INSTALL_TREE_REVIEW_REQUIRED
for dir in state results logs backups; do
  if [ -e "$WORKSPACE/$dir" ]; then
    [ -d "$WORKSPACE/$dir" ] && [ "$(stat -c '%a' "$WORKSPACE/$dir" 2>/dev/null || stat -f '%Lp' "$WORKSPACE/$dir")" = 700 ] || fail PRIVATE_STATE_DIRECTORY_INVALID
  fi
done

need crontab
need flock
need docker
need sha256sum
need date
need awk
need cp
need mv
need chmod
need find
need rm
need env
need cmp
need python3
need stat
need mktemp
need wc
need tr
need sleep
need cut
need grep
need basename
flock_path=$(command -v flock)
sha256sum_path=$(command -v sha256sum)
cut_path=$(command -v cut)

[ "$(date +%z)" = +0800 ] || fail HOST_OFFSET_NOT_SHANGHAI
[ "$(TZ=Asia/Shanghai date +%z)" = +0800 ] || fail SHANGHAI_TZDATA_UNAVAILABLE
[ "$("$WORKSPACE/bin/node" --version 2>/dev/null)" = v24.22.1 ] || fail PRIVATE_NODE_VERSION
[ "$(sha256sum "$WORKSPACE/bin/node" | awk '{print $1}')" = "$NODE_SHA256" ] || fail PRIVATE_NODE_HASH

docker info >/dev/null 2>&1 || fail DOCKER_ACCESS
[ "$(docker inspect --format '{{.Image}}' "$API_CONTAINER" 2>/dev/null)" = "$API_IMAGE" ] || fail API_IMAGE_OR_CONTAINER_CHANGED
[ "$(docker inspect --format '{{.State.Running}}' "$API_CONTAINER" 2>/dev/null)" = true ] || fail API_CONTAINER_NOT_RUNNING
docker image inspect "$POSTGRES_IMAGE" >/dev/null 2>&1 || fail PINNED_POSTGRES_IMAGE_MISSING
docker image inspect "$API_IMAGE" >/dev/null 2>&1 || fail PINNED_API_IMAGE_MISSING
image_env_flags=$(docker image inspect --format '{{json .Config.Env}}' "$API_IMAGE" | python3 -c '
import json, re, sys
values = json.load(sys.stdin)
names = [item.split("=", 1)[0] for item in values or []]
sensitive = any(re.search(r"(?:API_KEY|DATABASE_URL|BASE_URL|PROXY|TOKEN|SECRET|PASSWORD|CREDENTIAL)$", name, re.I) for name in names)
print(int(not sensitive), int("NODE_OPTIONS" not in names), int("NODE_PATH" not in names))
') || fail API_IMAGE_ENV_METADATA_UNAVAILABLE
set -- $image_env_flags
[ "$#" -eq 3 ] && [ "$1" -eq 1 ] && [ "$2" -eq 1 ] && [ "$3" -eq 1 ] || fail API_IMAGE_HAS_SENSITIVE_OR_NODE_OVERRIDE_ENV
api_image_sensitive_env_absent=1
api_image_node_options_absent=1
api_image_node_path_absent=1

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd -P)
[ -f "$repo_root/scripts/fiscal/ollama-understand-nightly.mjs" ] || fail NIGHTLY_WRAPPER_MISSING
[ -f "$repo_root/scripts/fiscal/ollama-understand-container-pilot.ts" ] || fail PILOT_RUNNER_MISSING
[ -f "$repo_root/.data/fiscal-qa/development150-local-pilot-20261026/inputs-request-only.json" ] || fail REQUEST_ONLY_INPUT_MISSING

tmp=$(mktemp -d "$WORKSPACE/.install.XXXXXX") || fail PRIVATE_TEMP_CREATE
cleanup() { rm -rf "$tmp"; }
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
mkdir -m 700 "$tmp/source" "$tmp/tools" "$tmp/state" "$tmp/results" "$tmp/logs" "$tmp/backups"
cp "$repo_root/package.json" "$tmp/source/package.json"
cp "$repo_root/package-lock.json" "$repo_root/tsconfig.base.json" "$tmp/source/"
repo_package_lock_sha=$(python3 -c 'import hashlib,json,sys; obj=json.load(open(sys.argv[1],encoding="utf-8")); print(hashlib.sha256(json.dumps(obj,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest())' "$tmp/source/package-lock.json" 2>/dev/null) || fail SOURCE_PACKAGE_LOCK_INVALID
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
[ -n "$api_package_lock_sha" ] && [ "$api_package_lock_sha" = "$repo_package_lock_sha" ] || fail API_PACKAGE_LOCK_MISMATCH
printf '%s\n' "$api_package_lock_sha" > "$tmp/tools/package-lock.canonical-sha256"
chmod 600 "$tmp/tools/package-lock.canonical-sha256"
mkdir -p "$tmp/source/packages/backend/src" "$tmp/source/packages/contracts/src" "$tmp/source/industry/prompts" "$tmp/source/database/migrations"
cp "$repo_root/packages/backend/package.json" "$repo_root/packages/backend/tsconfig.json" "$tmp/source/packages/backend/"
cp -R "$repo_root/packages/backend/src/." "$tmp/source/packages/backend/src/"
cp "$repo_root/packages/contracts/package.json" "$repo_root/packages/contracts/tsconfig.json" "$tmp/source/packages/contracts/"
cp -R "$repo_root/packages/contracts/src/." "$tmp/source/packages/contracts/src/"
cp "$repo_root/industry/package.json" "$repo_root/industry/tsconfig.json" "$repo_root"/industry/*.ts "$tmp/source/industry/"
cp "$repo_root"/industry/prompts/*.md "$tmp/source/industry/prompts/"
cp "$repo_root"/database/migrations/*.sql "$tmp/source/database/migrations/"
mkdir -p "$tmp/source/scripts/fiscal" "$tmp/source/.data/fiscal-qa/development150-local-pilot-20261026"
cp "$repo_root/scripts/migrate.ts" "$tmp/source/scripts/migrate.ts"
cp "$repo_root/scripts/fiscal/ollama-understand-container-pilot.ts" "$tmp/source/scripts/fiscal/"
cp "$repo_root/scripts/fiscal/ollama-understand-pilot-guard.mjs" "$repo_root/scripts/fiscal/ollama-understand-pilot-guard.d.mts" "$tmp/source/scripts/fiscal/"
cp "$repo_root/scripts/fiscal/ollama-understand-nightly.mjs" "$tmp/source/scripts/fiscal/"
cp "$repo_root/scripts/fiscal/ollama-understand-nightly.d.mts" "$tmp/source/scripts/fiscal/"
cp "$repo_root/.data/fiscal-qa/development150-local-pilot-20261026/inputs-request-only.json" "$tmp/source/.data/fiscal-qa/development150-local-pilot-20261026/"
cp "$repo_root/scripts/fiscal/ollama-understand-nightly-launcher.sh" "$tmp/tools/ollama-understand-nightly-launcher.sh"
chmod 750 "$tmp/tools/ollama-understand-nightly-launcher.sh"
printf '%s\n' "$API_IMAGE" > "$tmp/tools/api-image-id"
printf '%s\n' "$POSTGRES_IMAGE" > "$tmp/tools/postgres-image-id"
printf '%s\n' "$NODE_SHA256" > "$tmp/tools/node.sha256"
chmod 600 "$tmp/tools/api-image-id" "$tmp/tools/postgres-image-id" "$tmp/tools/node.sha256"

verify_frozen_tree() {
  "$WORKSPACE/bin/node" --input-type=module -e '
    import { createHash } from "node:crypto";
    import { readFile } from "node:fs/promises";
    import path from "node:path";
    import { pathToFileURL } from "node:url";
    const root = path.resolve(process.argv[1]);
    const wrapper = path.join(root, "scripts/fiscal/ollama-understand-nightly.mjs");
    const launcher = process.argv[2];
    const sha = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();
    const [wrapperBytes, launcherBytes] = await Promise.all([readFile(wrapper), readFile(launcher)]);
    const imported = await import(pathToFileURL(wrapper).href);
    const frozen = await imported.verifyFrozenFiles(root, { wrapperPath: wrapper, launcherPath: launcher,
      expectedWrapperSha256: sha(wrapperBytes), expectedLauncherSha256: sha(launcherBytes) });
    process.stdout.write(frozen.codeManifestSha256 + "\n");
  ' "$1" "$2"
}
host_frozen_manifest=$(verify_frozen_tree "$repo_root" "$repo_root/scripts/fiscal/ollama-understand-nightly-launcher.sh") || fail HOST_SOURCE_FREEZE_VERIFICATION_FAILED
staged_frozen_manifest=$(verify_frozen_tree "$tmp/source" "$tmp/tools/ollama-understand-nightly-launcher.sh") || fail STAGED_SOURCE_FREEZE_VERIFICATION_FAILED
[ "$host_frozen_manifest" = "$staged_frozen_manifest" ] || fail BYTE_COPY_MANIFEST_MISMATCH

wrapper_sha=$(sha256sum "$tmp/source/scripts/fiscal/ollama-understand-nightly.mjs" | awk '{print toupper($1)}')
launcher_sha=$(sha256sum "$tmp/tools/ollama-understand-nightly-launcher.sh" | awk '{print toupper($1)}')
write_entrypoint() {
  _entry_file=$1
  _entry_repo=$2
  _entry_launcher=$3
  _entry_state=$4
  _entry_results=$5
  _entry_lock=$6
  _entry_wrapper_sha=$7
  _entry_launcher_sha=$8
  cat > "$_entry_file" <<ENTRYPOINT
#!/bin/sh
set -eu
export OLLAMA_UNDERSTAND_LOCK_HELD=1
export OLLAMA_UNDERSTAND_LOCK_PATH="$_entry_lock"
export OLLAMA_UNDERSTAND_REPO_ROOT="$_entry_repo"
export OLLAMA_UNDERSTAND_LAUNCHER="$_entry_launcher"
export OLLAMA_UNDERSTAND_STATE_PATH="$_entry_state"
export OLLAMA_UNDERSTAND_RESULT_DIR="$_entry_results"
export OLLAMA_UNDERSTAND_WRAPPER_SHA256="$_entry_wrapper_sha"
export OLLAMA_UNDERSTAND_LAUNCHER_SHA256="$_entry_launcher_sha"
exec "$WORKSPACE/bin/node" "$_entry_repo/scripts/fiscal/ollama-understand-nightly.mjs"
ENTRYPOINT
  chmod 750 "$_entry_file"
}
write_entrypoint "$tmp/tools/nightly-entrypoint.sh" "$WORKSPACE/source" "$WORKSPACE/tools/ollama-understand-nightly-launcher.sh" \
  "$WORKSPACE/state/ollama-understand-nightly.state.json" "$WORKSPACE/results" "$WORKSPACE/state/ollama-understand-nightly.lock" \
  "$wrapper_sha" "$launcher_sha"
entrypoint_sha=$(sha256sum "$tmp/tools/nightly-entrypoint.sh" | awk '{print $1}')

# Native lock smoke: the inherited lock fd reaches Node, and a concurrent entrant is rejected.
smoke_lock="$tmp/lock-smoke.lock"
smoke_marker="$tmp/lock-smoke.entered"
: > "$smoke_lock"
chmod 600 "$smoke_lock"
cat > "$tmp/lock-smoke.mjs" <<'NODE'
import { appendFileSync, realpathSync, readdirSync } from "node:fs";
const lock = realpathSync(process.env.OLLAMA_LOCK_SMOKE_PATH);
const inherited = readdirSync("/proc/self/fd").some((fd) => {
  try { return realpathSync("/proc/self/fd/" + fd) === lock; } catch { return false; }
});
if (!inherited) process.exit(31);
appendFileSync(process.env.OLLAMA_LOCK_SMOKE_MARKER, "entered\n", { mode: 0o600 });
await new Promise((resolve) => setTimeout(resolve, 3000));
NODE
cat > "$tmp/lock-smoke-entrypoint.sh" <<ENTRYPOINT
#!/bin/sh
exec "$WORKSPACE/bin/node" "$tmp/lock-smoke.mjs"
ENTRYPOINT
chmod 750 "$tmp/lock-smoke-entrypoint.sh"
OLLAMA_LOCK_SMOKE_PATH="$smoke_lock" OLLAMA_LOCK_SMOKE_MARKER="$smoke_marker" \
  "$flock_path" -n "$smoke_lock" /bin/sh "$tmp/lock-smoke-entrypoint.sh" >/dev/null 2>&1 &
first_lock_pid=$!
sleep 1
[ -f "$smoke_marker" ] || { wait "$first_lock_pid" || true; fail LOCK_FD_NOT_INHERITED_BY_NODE; }
if OLLAMA_LOCK_SMOKE_PATH="$smoke_lock" OLLAMA_LOCK_SMOKE_MARKER="$smoke_marker" \
  "$flock_path" -n "$smoke_lock" /bin/sh "$tmp/lock-smoke-entrypoint.sh" >/dev/null 2>&1; then
  wait "$first_lock_pid" || true
  fail FLOCK_MUTUAL_EXCLUSION_FAILED
fi
wait "$first_lock_pid" || fail LOCK_FD_NODE_SMOKE_FAILED
[ "$(wc -l < "$smoke_marker" | tr -d ' ')" = 1 ] || fail FLOCK_ALLOWED_MULTIPLE_ENTRANTS

# Run the real wrapper under that lock while outside its active window; no state may be written.
shanghai_hour=$(TZ=Asia/Shanghai date +%H)
case "$shanghai_hour" in 02|03|04|05) fail INSTALL_DRY_RUN_UNSAFE_DURING_PILOT_WINDOW;; esac
mkdir -m 700 "$tmp/window-smoke"
: > "$tmp/window-smoke/lock"
chmod 600 "$tmp/window-smoke/lock"
smoke_state="$tmp/window-smoke/state.json"
smoke_results="$tmp/window-smoke/results"
mkdir -m 700 "$smoke_results"
write_entrypoint "$tmp/window-smoke/nightly-entrypoint.sh" "$tmp/source" "$tmp/tools/ollama-understand-nightly-launcher.sh" \
  "$smoke_state" "$smoke_results" "$tmp/window-smoke/lock" "$wrapper_sha" "$launcher_sha"
smoke_output=$("$flock_path" -n "$tmp/window-smoke/lock" /bin/sh "$tmp/window-smoke/nightly-entrypoint.sh") || fail OUTSIDE_WINDOW_WRAPPER_DRY_RUN_FAILED
[ "$smoke_output" = NOOP_OUTSIDE_WINDOW ] || fail OUTSIDE_WINDOW_WRAPPER_DRY_RUN_UNEXPECTED
[ ! -e "$smoke_state" ] || fail OUTSIDE_WINDOW_DRY_RUN_WROTE_STATE

old_cron="$tmp/crontab.old"
new_cron="$tmp/crontab.new"
filtered_cron="$tmp/crontab.filtered"
if ! crontab -l > "$old_cron" 2>/dev/null; then
  [ ! -s "$old_cron" ] || fail USER_CRONTAB_READ_FAILED
  : > "$old_cron"
fi
chmod 600 "$old_cron"
awk -v begin="$BEGIN_MARKER" -v end="$END_MARKER" '
  $0 == begin { if (inside) bad=1; inside=1; begins++; next }
  $0 == end { if (!inside) bad=1; inside=0; ends++; next }
  !inside { print }
  END { if (inside || bad || begins != ends || begins > 1) exit 42 }
' "$old_cron" > "$filtered_cron" || fail USER_CRONTAB_OWNED_BLOCK_INVALID
awk '/nightly-entrypoint\.sh|ollama-understand-nightly\.mjs|OLLAMA_UNDERSTAND_(REPO_ROOT|STATE_PATH)/ { found++ } END { exit found ? 1 : 0 }' "$filtered_cron" || fail DUPLICATE_NIGHTLY_ENTRY_OUTSIDE_OWNED_BLOCK
chmod 600 "$filtered_cron"
cat "$filtered_cron" > "$new_cron"
[ ! -s "$new_cron" ] || printf '\n' >> "$new_cron"
cat >> "$new_cron" <<CRON
$BEGIN_MARKER
CRON_TZ=Asia/Shanghai
TZ=Asia/Shanghai
0 2 * * * /bin/sh -c 'cd "$WORKSPACE" && test "\$("$sha256sum_path" tools/nightly-entrypoint.sh | "$cut_path" -c1-64)" = "$entrypoint_sha" && exec "$flock_path" -n state/ollama-understand-nightly.lock /bin/sh tools/nightly-entrypoint.sh' >> "$WORKSPACE/logs/cron.log" 2>&1
$END_MARKER
CRON
chmod 600 "$new_cron"

if [ "$dry_run" -eq 1 ]; then
  cron_metrics=$(awk -v begin="$BEGIN_MARKER" -v end="$END_MARKER" -v entrypoint="$entrypoint_sha" '
    $0 == begin { inside=1; next }
    $0 == end { inside=0; next }
    inside && $0 ~ /^0 2 \* \* \*/ { jobs++; if (index($0, entrypoint) && index($0, "nightly-entrypoint.sh") && index($0, "sha256sum")) hashes++; if (length($0) < 512) short++ }
    inside && $0 == "TZ=Asia/Shanghai" { tz++ }
    inside && $0 == "CRON_TZ=Asia/Shanghai" { cron_tz++ }
    END { print jobs+0, hashes+0, short+0, tz+0, cron_tz+0 }
  ' "$new_cron")
  set -- $cron_metrics
  cron_bytes=$(awk '$0 ~ /^0 2 \* \* \*/ { print length($0) }' "$new_cron")
  if [ "$#" -ne 5 ] || [ "$1" -ne 1 ] || [ "$2" -ne 1 ] || [ "$3" -ne 1 ] || [ "$4" -ne 1 ] || [ "$5" -ne 1 ] || [ "$cron_bytes" -ge 512 ]; then
    printf 'DRY_RUN_CRON_METRICS jobs=%s hash=%s short=%s timezone=%s cron_timezone=%s bytes=%s\n' "$1" "$2" "$3" "$4" "$5" "$cron_bytes" >&2
    fail DRY_RUN_CRON_CONTENT_INVALID
  fi
  awk 'index($0, "$tmp") || index($0, "$WORKSPACE") { bad++ } END { exit bad ? 1 : 0 }' "$new_cron" || fail DRY_RUN_CRON_HAS_TEMP_REFERENCE
  printf 'INSTALL_DRY_RUN=PASS\nCRON_ENTRY_COUNT=1\nCRON_ENTRY_BYTES=%s\nCRON_TIMEZONE=Asia/Shanghai\nENTRYPOINT_SHA256=%s\nWRAPPER_SHA256=%s\nLAUNCHER_SHA256=%s\nAPI_IMAGE_ID=%s\nPACKAGE_LOCK_CANONICAL_SHA256=%s\nAPI_SOURCE_LOCK_MATCH=1\nAPI_IMAGE_SENSITIVE_ENV_ABSENT=%s\nAPI_IMAGE_NODE_OPTIONS_ABSENT=%s\nAPI_IMAGE_NODE_PATH_ABSENT=%s\nFLOCK_NODE_SMOKE=PASS\nOUTSIDE_WINDOW_NO_STATE_SMOKE=PASS\n' \
    "$cron_bytes" "$entrypoint_sha" "$wrapper_sha" "$launcher_sha" "$API_IMAGE" "$api_package_lock_sha" "$api_image_sensitive_env_absent" "$api_image_node_options_absent" "$api_image_node_path_absent"
  exit 0
fi

# Keep the exact previous user crontab privately before replacing only our owned marker block.
for dir in state results logs backups; do
  [ -d "$WORKSPACE/$dir" ] || mkdir -m 700 "$WORKSPACE/$dir"
  [ "$(stat -c '%a' "$WORKSPACE/$dir" 2>/dev/null || stat -f '%Lp' "$WORKSPACE/$dir")" = 700 ] || fail PRIVATE_STATE_DIRECTORY_MODE
done
if [ ! -e "$WORKSPACE/state/ollama-understand-nightly.lock" ]; then
  : > "$WORKSPACE/state/ollama-understand-nightly.lock"
  chmod 600 "$WORKSPACE/state/ollama-understand-nightly.lock"
fi
[ -f "$WORKSPACE/state/ollama-understand-nightly.lock" ] && [ "$(stat -c '%a' "$WORKSPACE/state/ollama-understand-nightly.lock" 2>/dev/null || stat -f '%Lp' "$WORKSPACE/state/ollama-understand-nightly.lock")" = 600 ] || fail PRIVATE_LOCK_FILE_MODE
if [ ! -e "$WORKSPACE/logs/cron.log" ]; then
  : > "$WORKSPACE/logs/cron.log"
  chmod 600 "$WORKSPACE/logs/cron.log"
fi
[ -f "$WORKSPACE/logs/cron.log" ] && [ "$(stat -c '%a' "$WORKSPACE/logs/cron.log" 2>/dev/null || stat -f '%Lp' "$WORKSPACE/logs/cron.log")" = 600 ] || fail PRIVATE_LOG_FILE_MODE
chmod 700 "$WORKSPACE"
backup="$WORKSPACE/backups/crontab.preinstall.$(date -u +%Y%m%dT%H%M%SZ).$$.txt"
[ ! -e "$backup" ] || fail CRONTAB_BACKUP_ALREADY_EXISTS
cp "$old_cron" "$backup"
chmod 600 "$backup"

if [ -d "$WORKSPACE/source" ]; then
  existing_frozen_manifest=$(verify_frozen_tree "$WORKSPACE/source" "$WORKSPACE/tools/ollama-understand-nightly-launcher.sh") || fail EXISTING_SOURCE_FREEZE_VERIFICATION_FAILED
  [ "$existing_frozen_manifest" = "$host_frozen_manifest" ] || fail EXISTING_SOURCE_FREEZE_MISMATCH
else
  mv "$tmp/source" "$WORKSPACE/source"
fi
if [ -d "$WORKSPACE/tools" ]; then
  for name in api-image-id postgres-image-id node.sha256 package-lock.canonical-sha256 ollama-understand-nightly-launcher.sh; do
    [ -f "$WORKSPACE/tools/$name" ] && cmp -s "$tmp/tools/$name" "$WORKSPACE/tools/$name" || fail EXISTING_TOOL_PIN_MISMATCH
  done
  find "$WORKSPACE/tools" -mindepth 1 -maxdepth 1 ! -type f -print -quit | grep -q . && fail UNKNOWN_TOOL_PATH
  for path in "$WORKSPACE/tools"/*; do
    [ -f "$path" ] || continue
    name=$(basename "$path")
    case "$name" in
      api-image-id|postgres-image-id|node.sha256|package-lock.canonical-sha256|ollama-understand-nightly-launcher.sh|nightly-entrypoint.sh) ;;
      *) fail UNKNOWN_TOOL_FILE ;;
    esac
  done
  if [ -e "$WORKSPACE/tools/nightly-entrypoint.sh" ]; then
    [ -f "$WORKSPACE/tools/nightly-entrypoint.sh" ] && [ "$(sha256sum "$WORKSPACE/tools/nightly-entrypoint.sh" | awk '{print $1}')" = "$entrypoint_sha" ] || fail EXISTING_ENTRYPOINT_HASH_MISMATCH
  else
    cp "$tmp/tools/nightly-entrypoint.sh" "$WORKSPACE/tools/nightly-entrypoint.sh"
  fi
else
  mv "$tmp/tools" "$WORKSPACE/tools"
fi
chmod 700 "$WORKSPACE/source" "$WORKSPACE/tools"
find "$WORKSPACE/source" -type d -exec chmod 700 {} \;
find "$WORKSPACE/source" -type f -exec chmod 600 {} \;
chmod 750 "$WORKSPACE/tools/ollama-understand-nightly-launcher.sh"
chmod 750 "$WORKSPACE/tools/nightly-entrypoint.sh"
chmod 750 "$WORKSPACE/bin/node"

if ! crontab "$new_cron"; then
  fail USER_CRONTAB_INSTALL_FAILED_BACKUP_RETAINED
fi
readback="$tmp/crontab.readback"
if ! crontab -l > "$readback" 2>/dev/null || ! cmp -s "$new_cron" "$readback"; then
  if crontab "$old_cron"; then
    fail CRONTAB_READBACK_MISMATCH_OLD_CRONTAB_RESTORED
  else
    fail CRONTAB_READBACK_MISMATCH_ROLLBACK_FAILED
  fi
fi
awk -v begin="$BEGIN_MARKER" -v end="$END_MARKER" '
  $0 == begin { begins++; inside=1; next }
  $0 == end { ends++; inside=0; next }
  inside && $0 == "TZ=Asia/Shanghai" { tz++ }
  inside && $0 == "CRON_TZ=Asia/Shanghai" { cron_tz++ }
  inside && $0 ~ /^0 2 \* \* \*/ { jobs++ }
  END { if (begins != 1 || ends != 1 || tz != 1 || cron_tz != 1 || jobs != 1) exit 1 }
' "$readback" || {
  if crontab "$old_cron"; then fail CRONTAB_BLOCK_VALIDATION_FAILED_OLD_CRONTAB_RESTORED; fi
  fail CRONTAB_BLOCK_VALIDATION_FAILED_ROLLBACK_FAILED
}
readback_entrypoint_sha=$(awk -v begin="$BEGIN_MARKER" -v end="$END_MARKER" -v expected="$entrypoint_sha" '
  $0 == begin { inside=1; next }
  $0 == end { inside=0; next }
  inside && /^0 2 \* \* \*/ && index($0, expected) && index($0, "nightly-entrypoint.sh") && index($0, "sha256sum") && length($0) < 512 { found++; print expected }
  END { if (found != 1) exit 1 }
' "$readback") || fail CRONTAB_ENTRYPOINT_READBACK_INVALID
readback_cron_bytes=$(awk '$0 ~ /^0 2 \* \* \*/ { print length($0) }' "$readback")
printf 'INSTALL_RESULT=INSTALLED_USER_CRON\nCRON_TIMEZONE=Asia/Shanghai\nCRON_ENTRY_BYTES=%s\nENTRYPOINT_SHA256=%s\nREADBACK_EXACT=1\nNONOWNED_ENTRIES_PRESERVED=1\nWORKSPACE=%s\nNODE_VERSION=%s\nNODE_SHA256=%s\nBACKUP=%s\n' \
  "$readback_cron_bytes" "$readback_entrypoint_sha" "$WORKSPACE" "$($WORKSPACE/bin/node --version)" "$NODE_SHA256" "$backup"
