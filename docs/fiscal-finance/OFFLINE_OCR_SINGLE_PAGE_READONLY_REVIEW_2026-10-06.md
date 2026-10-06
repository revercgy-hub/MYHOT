# Offline single-page OCR read-only contract review — 2026-10-06

## Scope and result

**TASK**: Read-only integration review of `scripts/fiscal/offline-xiamen-ocr.ts`, the changed process wrapper in `scripts/fiscal/ocr-scan-poc.ts`, and focused tests against [the approved single-page scope](S1_OFFLINE_OCR_SINGLE_PAGE_SCOPE_REVIEW_2026-10-06.md).

**MODEL**: GPT-6 Luna High.

**RESULT**: The four initial source-review findings were corrected in the frozen snapshot: workspace/reparse containment, marker ordering, failure-path output-cap auditing, and the 120,000-character text limit. I found no remaining source-contract blocker to Lead review of the implementation/preflight evidence. This is not approval to run formal monitor preflight or OCR. `OFFLINE_XIAMEN_OCR_ENABLED` remains `false`.

## Read-only findings and corrections observed

- The dedicated entry uses a separate closed permit, fixed Xiamen input/Tesseract/model/license identities, fixed arguments and budgets, a fixed ignored output directory, and rejects CLI overrides. The entry does not pass arbitrary child command/arguments or monitor substitutions; the five-page lock is unchanged by this review.
- The output parent and workspace artifacts are checked through `realpath` against the workspace and canonical fixed paths. The new output directory is created exclusively and checked again after creation. The attempt marker is created with `wx` after fixed-file/hash validation and before the bounded Tesseract `--version` child or OCR child. A version failure therefore remains a consumed one-shot batch; the only pre-marker child is the bounded `git check-ignore` admission query.
- The monitor JSONL is directed to the new single-page directory. The wrapper bounds monitor stdout/stderr, lines and samples, checks matching live/flushed samples, exact child/monitor close and wait evidence, and reserves cleanup within the absolute total deadline. It checks all regular files in the output directory during execution and after close. The entry reserves space for failure diagnostics and performs an explicit final audit on failures; an over-cap failure is recorded as failure rather than treated as a successful result.
- The entry checks the closed TXT text against the 120,000-character ceiling after close. Its candidate report carries all 14 page-1 reference/candidate/status/missing/mismatch rows. Reference values are not inserted as candidates; the split maturity fields remain missing while the combined maturity cell is retained among raw source-box candidates. Candidate normalization is described separately from preserved candidate text. The entry contains no DB, Gold, article, publication, or body-status writes.
- The two focused test files include fixed-profile and closed-permit checks, an independent candidate fixture covering match/mismatch/missing and all 14 page-numbered fields, the character-limit boundary, lifecycle/cleanup and output-cap cases. Those tests and typecheck were run by the implementation owner; I inspected their source but did not execute them.

## Validation boundary

**FILES_CHANGED**: Only this owned review report.

**TESTS_RUN**: None by this reviewer. The owner reported 41/41 focused native tests and `tsc` exit 0. The owner also reported short native Windows monitor timings; those do not constitute the formal 10-second natural-exit and low-line stop preflights. No OCR, formal preflight, HTTP, DB, collector, worker, or model operation was performed here.

**RISKS / BLOCKERS**: Actual OCR latency, memory use, sample cadence and stop behavior remain unmeasured. The 512 MiB WorkingSet limit and file-size watchers are sampled soft-stop/acceptance lines, not hard OS guarantees. The resulting OCR artifact would be candidate-only and would not establish body readiness, source admission, Gate 2, or downstream correctness.

**NEXT**: Lead may independently review the frozen code and the owner/QA evidence for the two approved monitor preflights. Actual single-page OCR still requires its separate explicit one-time execution checkoff; keep the permit closed until then.
