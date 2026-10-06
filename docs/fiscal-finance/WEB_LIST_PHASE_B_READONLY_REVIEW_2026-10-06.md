# Web-list Phase B metadata-only integration review — 2026-10-06

TASK=Read-only review of the frozen metadata transport, pagination helper, config validation, collector continuation, and focused evidence against `S1_WEB_LIST_DETAIL_METADATA_SCOPE_REVIEW_2026-10-06.md`.
MODEL=GPT-6 Luna High.
RESULT=No remaining blocking integration finding in the reviewed Phase B scope. This is not source approval, a coverage claim, or Gate 2 acceptance.
GATE2=NOT_PASSED.

## Contract review

The opt-in remains explicit at `pagination.detailMode="direct_html_metadata_v1"`; the config validator rejects unsupported combinations before collection. The metadata transport requires the shared run budget, clamps each direct HTML request to 20 seconds and the remaining deadline, validates the article directory and same-identity final URL, and returns only configured title/date fields. It does not call legacy `fetchDetail`, summary/body/PDF/Readability/Jina helpers, or expose response HTML. The page and detail requests use the collector's single dispatch budget; the detail target is admitted before transport and cleared in `finally`.

The helper validates pending JSON keys and field/state combinations, recomputes identity/fingerprint/metadata hashes, bounds row and byte counts, rejects unpaired duplicate classifications, and checks the generation's fixed date window when pending rows are resolved or committed. The cursor's page counters and immediately preceding identity hashes are cross-checked, and its cutoff is recomputed from the frozen anchor and configured backfill months. Page URL candidates are filtered through the shared pagination-URL predicate. The collector saves the listing snapshot before detail dispatch, checkpoints each row resolution separately, then commits articles, queue writes, and cursor advancement in one short transaction. Lock-scoped source configuration is rechecked at each checkpoint and before commit; a failed final cursor write rolls back the page transaction while retaining the prior durable resolved snapshot.

The review findings during integration were closed in the current source and focused fixtures: a singleton row could not be classified as a duplicate; a resolved row could not omit its date; resolved/outside-window states now have to agree with the fixed anchor/cutoff and date provenance; a cursor with a changed but valid-looking cutoff is rejected before another dispatch; and generation initialization merges the locked current cursor namespace instead of overwriting it from the earlier source snapshot. The final metadata commit has a dedicated rollback/replay test rather than relying on the Phase A transaction test as a substitute.

## Verification evidence

The current transport focused test passed 10/10 with native exit 0 after the latest helper changes. The Phase B collector/pagination focused suite passed 10/10 with native exit 0 in `phaseb_logs/collector-focused.stdout.log`; its stderr log is empty. The recorded backend and tests typecheck stdout/stderr logs are empty with exit 0 as reported by the owner. The focused cases include pending-window tampering, durable snapshot and per-row checkpoint failures, final article/queue/cursor rollback and replay, concurrent generation initialization, malformed counters, and a tampered cutoff. A separate QA owner reported the safe preview focused suite at 8/8 on a fresh 35-migration test database; I did not rerun that suite.

No official endpoint, production database, worker, model, or source collector was invoked by this review. No source opt-in was added. The saved regional page observations and any synthetic test fixture do not establish date authority, automatic JavaScript pager identity, cross-cycle page stability, 90-day completeness, or Gate 2 passage. `coverage` remains `unproven`; Stage B does not add a completion/reset/incremental protocol.

FILES_CHANGED=`docs/fiscal-finance/WEB_LIST_PHASE_B_READONLY_REVIEW_2026-10-06.md` only for this review; Phase B implementation files remain with their owners.
TESTS_RUN=Own synthetic transport focused 10/10 exit 0. Read owner-provided fresh collector focused logs 10/10 exit 0 and backend/tests typecheck exit 0. QA preview 8/8 is an owner report and was not rerun here.
RISKS=Source-specific selectors/date semantics and trustworthy history remain unproven; raw JavaScript pager behavior and cross-cycle list stability are not automatically established.
BLOCKERS=No blocker found in this narrow Phase B transport/helper integration review. Real source selection/opt-in, 90-day completeness, and Gate 2 remain blocked pending their separate evidence and decisions.
NEXT=QA may proceed with its planned final checkpoint using these current focused results; do not infer source readiness or Gate 2 completion from them.
