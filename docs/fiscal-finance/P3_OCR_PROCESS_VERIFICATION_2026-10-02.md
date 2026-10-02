# P3 OCR process verification — 2026-10-02

## Scope and result

This verification covers the bounded OCR proof-of-concept process wrapper and its local fault fixtures. It does not authorize or report an OCR run. `OCR_RUN_ENABLED` remains `false`; no invoice images were opened, no Tesseract OCR was run, and the production/source configuration was not changed. The process checks establish only the exercised single-child paths described below; they do not establish hard RSS enforcement, process-tree termination, or sandboxing.

Changed files:

- `scripts/fiscal/ocr-scan-poc.ts`
- `tests/fiscal-ocr-scan-poc.test.ts`
- this report

The run path validates model and license bytes against the prepared manifest before it can proceed. Validation covers the pinned commit, exact model/license URLs, model and license byte counts and SHA-256 hashes, the Apache-2.0 identity/text, and complete/runnable state. The run lock remains closed regardless of manifest validity.

## Process verification

The Windows monitor now starts before the child and must emit `READY` before the child is spawned. The parent then supplies the child's exact PID to the monitor. The startup limit is five seconds and the page/experiment deadlines include monitor startup. The monitor samples that PID's `WorkingSet64` and flushes records containing that PID; the parent fails closed when no first sample arrives or the latest sample becomes older than 250 ms. It waits for both child and monitor close. Error and termination paths preserve the first failure reason.

The real Windows PowerShell monitor was exercised with a bounded fake child. In the latest test run the child exited naturally with code 0; the monitor recorded the same PID and a wait record. The first sample arrived at 72 ms, maximum observed sample/edge gap was 162 ms, and the final sample was at 162 ms, within the 250 ms rule for this fixture. This is one local fake-child observation, not evidence from Tesseract.

Additional local fixtures verified that:

- page and total deadlines kill the exact fake-child PID and wait for its close event (deadline monitoring used the injected monitor fixture);
- stderr overflow and combined text/TSV file overflow terminate the child and wait, including a post-close output-cap check;
- monitor early exit, nonzero failure, and missing samples fail closed and do not report success;
- a monitor that fails before `READY` prevents child launch;
- an injected soft WorkingSet threshold records the exact PID, requests termination, and waits. This is a simulated soft-line test, not a measurement or proof that a real process exceeded 512 MiB.

The environment passed to the child is a small allowlist of runtime necessities, with seven Windows-added identity variables blanked. Monitoring and termination target one captured PID. No process-tree kill guarantee is made. The 512 MiB WorkingSet value remains a soft line.

## Data preparation evidence

The single preparation batch approved by `S1_P3_OCT02_SCOPE_REVIEW.md` was attempted once in `.data/fiscal-qa/scan-ocr-poc-20261002`, using the approved fixed commit `87416418657359cb625c412a48b6e1d6d41c29bd`, the exact pinned model and license URLs, a maximum of two requests, 120 seconds per request, and 240 seconds total. There was no retry and no redirect follow.

Only the model request was made. It returned HTTP 200 with `Content-Length: 2,469,156`, but the response terminated after 16,384 bytes at 70,722 ms (`TypeError: terminated`; `eofComplete=false`). The artifact retains the request and partial-byte-count evidence in `prepare-failure.json` and the incomplete manifest. The partial response chunk was not saved as a model file. The license URL was not requested, so no license bytes or hash were obtained; no model hash was computed. The new manifest says `status: incomplete`, `trainedDataComplete: false`, `runnable: false`, and `modelSha256: null`. The new `tessdata` directory is empty. The old `.data/fiscal-qa/scan-ocr-poc` directory remains present and was not replaced.

No retry, second preparation, OCR run, or lock change followed this failed request.

## Validation

- `node --test tests/fiscal-ocr-scan-poc.test.ts` — 17/17 passed.
- `npm run typecheck` — passed.
- `git diff --check -- scripts/fiscal/ocr-scan-poc.ts tests/fiscal-ocr-scan-poc.test.ts` — passed (Git emitted only line-ending conversion notices).
- `COLLECT_ENABLED`, `MODEL_CALLS_ENABLED`, `INDEXNOW_SUBMIT_ENABLED`, `FEISHU_ENABLED`, `FEISHU_SEND_ENABLED`, and `FEISHU_BOT_ENABLED` were unset. `OCR_RUN_ENABLED` is false in source.

## Remaining gate

OCR remains blocked: the model and license are not both present and verified, and the run switch is closed. Real Tesseract WorkingSet behavior, sustained native monitor cadence under an OCR workload, model/license identity from complete files, and end-to-end OCR output remain unverified. These results must not be described as a completed OCR or resource-limit acceptance.
