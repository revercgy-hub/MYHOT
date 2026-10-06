# Offline OCR monitor case 1 failure analysis — 2026-10-06

## Finding

The natural-close preflight **failed closed**. The configured sample sleep is 20 ms, but the two saved native samples are 281.6508 ms apart, over the 250 ms acceptance limit. The wrapper records the primary stop as `resource monitor sample overdue`, terminates fake child PID 358552 with SIGTERM, and observes child and monitor close/wait. The 10-second fake workload therefore did not end naturally; case 1 ran for 741 ms, and case 2 and actual OCR did not start.

The thrown validator message, `resource monitor final sample preceded child close check is invalid`, is secondary and its wording is easy to read in the wrong direction. In the wrapper, `lastSampleToCloseMs = childClosedAt - lastSampleAt`, and it throws when that value is negative. Thus the wrapper’s comparison says the last sample timestamp is later than the Node child-close timestamp. The exact signed difference is not persisted, so its magnitude is unknown. This is a relation between timestamps produced by two APIs; the artifact alone does not prove the causal wall-clock ordering of the underlying OS events.

## Saved timeline and clocks

The artifact directory is `.data/fiscal-qa/offline-ocr-preflight-20261006/case1-natural-close/`. Hash and request-budget verification are left to the independent QA owner.

| Evidence | Saved value | What it establishes |
|---|---|---|
| Runner case start | `2026-10-06T08:38:37.946Z` | Summary clock start. |
| One-shot case marker | `2026-10-06T08:38:37.949Z` | Marker was written about 3 ms after the runner start timestamp. |
| READY | acknowledged before child admission; exact elapsed value `null` | The 5 s readiness bound passed, but READY-to-child timing is unavailable. |
| Child / configured workload | PID `358552`; CPU loop target 10,000 ms; fixed buffer 16,777,216 bytes | These are the case configuration and assigned PID, not proof the child completed its workload. |
| Native sample 1 | `2026-10-06T08:38:38.3466731Z`, WorkingSet `74,854,400` bytes | First persisted PowerShell sample. |
| Native sample 2 | `2026-10-06T08:38:38.6283239Z`, WorkingSet `0` bytes | Second persisted PowerShell sample. The value `0` is recorded; its cause is not established. |
| Native sample gap | `281.6508 ms` | Direct subtraction of the two saved UTC sample timestamps; exceeds 250 ms. |
| Native final record | `2026-10-06T08:38:38.6623237Z`; `samples: 2`, `waited: true`, child `exitCode: null` | Written about 33.9998 ms after sample 2. This `exitCode` belongs to the child as queried by PowerShell, not the monitor process. |
| Runner end | 741 ms elapsed; exit code `1` | Case failed well before the fake child's 10 s target. |

The wrapper's Node-side `childStartedAt` is captured with `Date.now()` after spawning the fake child. The PowerShell sample timestamps come from `.NET DateTime.UtcNow`; the Node close timestamp is made with `new Date().toISOString()`. These are UTC wall-clock representations with different precision and APIs. The runner does not save `childStartedAt`, `childClosedAt`, or each sample's Node pipe-arrival time. The wrapper aborts before it copies `monitorFirstSampleDelayMs`, `monitorMaxGapMs`, or `monitorLastSampleToCloseMs` into the runtime summary when the negative tail check throws. Consequently, the saved evidence cannot provide an independent first-sample delay, exact child-start/close times, Node parent handling delay, or tail-gap magnitude. The 741 ms case duration is not a substitute for those measurements.

The raw final row is after sample 2, but the tail validation compares the last *sample row* (sample 2) to Node's child-close timestamp; it does not compare the final PowerShell wait row to child close. Based on the comparison's negative sign, sample 2's timestamp is later than the saved Node close timestamp in the wrapper's calculation. Since the exact `childClosedAt` value is absent and the clocks are not calibrated in the artifact, do not turn that calculated sign into a stronger claim about actual event order.

## Primary stop versus secondary validation

The saved `runtimeLog` gives the primary termination reason: `killed=true`, `killReason="resource monitor sample overdue"`, child `signal="SIGTERM"`, and child `exitCode=null`. It also records `childCloseObserved=true`, `childCloseWaited=true`, `monitorCloseObserved=true`, `monitorCloseWaited=true`, `cleanupTimeout=false`, and `monitorExitCode=0`. The independent process-residue check is QA-owned; this analysis does not repeat it.

After cleanup, the wrapper validates sample/tail timing. Its negative tail calculation throws `resource monitor final sample preceded child close check is invalid`, which is the `summary.json` error string. That later validation error does not replace the earlier watchdog stop reason. The PowerShell monitor process exited 0; the final row's child `exitCode:null` is not an assertion that the monitor itself failed or that the fake child naturally exited 0. The checks `naturalChildExit`, `firstMaxTailGapsAtMost250ms`, and `monitorFinalWaitAndExit` are false in the saved summary.

## What is and is not causal evidence

The source implements each PowerShell sample as refresh/check, WorkingSet read, UTC timestamp creation, JSON serialization, file write and flush, stdout write and flush, followed by `Start-Sleep -Milliseconds 20`. Thus 20 ms is a configured sleep **after** work and flushing, not a guaranteed 20 ms sample-to-sample period. The native loop does not persist timings for those separate operations. A slow flush, CPU scheduling pause, process scheduling delay, or other monitor/host delay could contribute to the 281.6508 ms gap; this run does not distinguish them. The fake CPU loop may compete for scheduling, but no CPU utilization or scheduler counters were collected. The `WorkingSet64=0` sample and 74,854,400-byte observed peak also do not identify the gap's cause.

The watchdog's configured 25 ms interval checks `Date.now() - lastSampleAt > 250` and calls `terminate('resource monitor sample overdue')`. The logged kill reason is consistent with the stale-sample failure and is direct evidence that the wrapper's overdue path fired. The code/artifacts do not retain the exact watchdog tick, monitor sample-to-flush durations, Node event-loop delay, or OS scheduling telemetry. Therefore the precise source of the long interval remains **unknown**; it is not established as a code defect in PowerShell flushing, a CPU bottleneck, or a hardware scheduling problem.

The sampled peak of 74,854,400 bytes is from only two rows and is far below the configured 512 MiB soft-stop line. Since the fake child was stopped after roughly 0.7 s rather than running the planned 10 s, it does not validate sustained-monitor cadence or natural close over the planned interval. It says nothing about Tesseract's memory or runtime.

## Minimal follow-up design (proposal only)

Do not rerun this failed case, lower the 250 ms gate, start case 2, or start OCR on the strength of this analysis. If Root later authorizes a source change, the smallest useful diagnostic improvement is to preserve both the primary watchdog reason and any subsequent validation error as separate fields; persist the Node child start/close timestamps and per-sample Node pipe-receipt monotonic timestamps; and add monitor-side monotonic timestamps or segment durations around sample capture, file flush, console flush, and sleep. This would separate monitor work/flush from parent delivery and host scheduling without changing the acceptance threshold.

Add a source-only/fake-timestamp regression that independently covers (a) sample interval over 250 ms causing the primary overdue stop and (b) a final sample timestamp later than child close causing a secondary tail-order diagnostic with an unambiguous sign. A future explicitly authorized native run, if any, must be a new separately bounded case after the failure is reviewed; this packet does not request or authorize one.

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**: Offline-only causal localization of formal native monitor case 1; no rerun or source change.

**MODEL**: GPT-6 Luna High.

**FILES_CHANGED**: Only this owned analysis report. Hash/budget/PID artifact QA remains with the independent QA owner.

**TESTS_RUN**: None. Read the saved case marker, summary, JSONL, stdout/stderr/exit-code artifacts, runner source and frozen wrapper timing logic. No child, probe, OCR, HTTP, DB or process command was run.

**RESULT**: Case 1 failed its native gap gate at 281.6508 ms; the wrapper's primary stop was `resource monitor sample overdue`. Both closes/waits were observed. The later negative-tail validation reports a last sample timestamp after Node's child-close timestamp in the wrapper's comparison; exact tail delta and underlying event order are not saved. Case 2 and actual OCR remain not run.

**RISKS**: The failure demonstrates this saved monitor path did not meet the configured 250 ms gate on this attempt. One failed short case does not identify whether flushing, CPU work, host scheduling, or another delay caused the gap. No conclusion about sustained cadence or real OCR resources is supported.

**BLOCKERS**: Native preflight remains failed; OCR remains blocked. No automatic retry, case 2, threshold relaxation, or OCR action follows from this report.

**NEXT**: Root reviews this evidence. Any remediation or new execution requires a separate scope decision; QA retains artifact identity, PID and budget verification.
