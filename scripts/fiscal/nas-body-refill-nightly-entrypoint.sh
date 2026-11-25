#!/bin/sh
# Nightly body refill for the fiscal-hot staging stack.
#
# The collector fetches only a bounded number of detail pages per source per window, so the overflow
# stays body_status='pending' and never reaches the analyser, which only reads rows that already have
# a body. This job drains that queue every morning before the analysis task runs.
#
# Everything is append-only logging; nothing here publishes, judges or calls a model.
set -eu

WORKSPACE="/vol2/1000/docker/fiscalhot-body-refill-nightly"
CONTAINER="fiscalhot-staging-api-1"
LIMIT="${REFILL_LIMIT:-150}"
LOG="$WORKSPACE/logs/cron.log"

stamp() { TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M:%S'; }
say() { printf '%s %s\n' "$(stamp)" "$*" >>"$LOG"; }
fail() { say "REFILL_FAILED=$1"; exit 1; }

say "START limit=$LIMIT"

# The stack must be up; a stopped container would make docker cp and exec fail in confusing ways.
running=$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || echo "missing")
[ "$running" = "true" ] || fail "CONTAINER_NOT_RUNNING($running)"

SRC="$WORKSPACE/tools/pending-refill.mjs"
[ -f "$SRC" ] || fail "SCRIPT_MISSING"

docker cp "$SRC" "$CONTAINER:/app/.wb-refill.mjs" >/dev/null 2>&1 || fail "COPY_FAILED"
# docker cp keeps the source mode (0700 owned by codex); the container runs as node, so relax it.
docker exec -u root "$CONTAINER" chmod 644 /app/.wb-refill.mjs >/dev/null 2>&1 || fail "CHMOD_FAILED"

# Hard cap so a hung upstream cannot hold the window open indefinitely.
out=$(timeout 1800 docker exec -w /app "$CONTAINER" node /app/.wb-refill.mjs --limit="$LIMIT" 2>&1) || {
  say "OUTPUT=$(printf '%s' "$out" | tail -c 800)"
  fail "EXEC_FAILED"
}

summary=$(printf '%s\n' "$out" | grep '"finished"' | tail -1)
[ -n "$summary" ] || { say "OUTPUT=$(printf '%s' "$out" | tail -c 800)"; fail "NO_SUMMARY"; }

say "RESULT=$summary"

# Second pass: announcements whose body collapsed to "相关附件：x.pdf" get the PDF text layer appended.
# This is advisory — a failure here must not fail the whole window, the refill above already succeeded.
PDF_SRC="$WORKSPACE/tools/pdf-attachment-body.mjs"
if [ -f "$PDF_SRC" ]; then
  if docker cp "$PDF_SRC" "$CONTAINER:/app/.wb-pdfbody.mjs" >/dev/null 2>&1 \
     && docker exec -u root "$CONTAINER" chmod 644 /app/.wb-pdfbody.mjs >/dev/null 2>&1; then
    pdfout=$(timeout 1200 docker exec -w /app "$CONTAINER" node /app/.wb-pdfbody.mjs --limit=40 2>&1) || pdfout=""
    if [ -n "$pdfout" ]; then
      pdfsum=$(printf '%s\n' "$pdfout" | grep -oE '"(total|recovered)": *[0-9]+' | tr '\n' ' ')
      say "PDF_RESULT=${pdfsum:-no_summary}"
    else
      say "PDF_RESULT=no_output"
    fi
  else
    say "PDF_RESULT=copy_failed"
  fi
else
  say "PDF_RESULT=script_missing"
fi

say "FINISHED"
