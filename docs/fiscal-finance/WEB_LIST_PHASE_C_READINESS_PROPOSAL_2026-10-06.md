# Web-list Phase C readiness proposal — 2026-10-06

## TASK

Prepare the smallest reviewable next stage after Phase B: establish a source-specific evidence admission gate, then separately design how a bounded 90-day traversal could handle ordering, front insertions/page shifts, terminal evidence, completion, ordinary incremental runs, resets, and configuration changes.

This is a proposal only. It does not amend Phase B, authorize a live request, qualify a source, change source configuration, or declare coverage. The controlling evidence and constraints remain the approved [S1 Phase B scope review](S1_WEB_LIST_DETAIL_METADATA_SCOPE_REVIEW_2026-10-06.md), the project plan, the current status record, and the source-specific saved-evidence reports.

## MODEL

GPT-6 Luna High. No project provider or runtime model was called.

## CURRENT EVIDENCE AND LIMITS

The 19 entries in the current source manifest are disabled, have full-text output off, and have no pagination opt-in. S1's manifest audit found 11 entries with a `detail` object and 8 without it. Seven source configurations—福建、北京、上海、河南、湖北、湖南、广东—have a `maxFetches=10` plus a configured direct-HTML publication-date rule; 北京 also declares title/date authority. Those counts describe stored configuration shape only. They do not establish that any source is suitable for Phase C or that its date rule means original publication time.

The saved Batch 6 page-2 evidence for 广西、海南、重庆、四川 and the 四川 page-3 probe are outside the 19-entry manifest source set. Their page order, hashes, candidates, and displayed dates cannot be borrowed as evidence for any of the 19. Likewise, a single saved detail, an existing selector, `countPage`, or a successful Phase B collector test cannot independently qualify a source.

No source is selected as the first Phase C source in this proposal. Eligibility remains **unknown for every source** until a source-specific offline evidence bundle is matched to an exact manifest ID and reviewed. Gate 2 remains `NOT_PASSED`.

## PROPOSED NEXT STEP: OFFLINE EVIDENCE ADMISSION

The smallest next action is an offline inventory and review, with no collector run and no new network access. For each possible source from the exact 19-entry manifest, QA should create or update a source evidence row linking the manifest ID and configuration hash to the saved artifacts that actually belong to it. Each artifact must have a recorded request URL, final URL, observed time, status, byte count, and SHA-256; if any element is missing, mark it unknown instead of inferring it.

An entry can be proposed for a later source-specific S1 review only when its own saved evidence includes:

1. **Identity and list structure.** The exact source ID, configured listing URL and allow-prefix map to saved page bytes. The saved page identifies the target content column rather than a homepage or navigation link; offline fixtures exercise the exact configured parser selectors against those bytes.
2. **Pagination relation.** At least two saved pages from that same listing establish the exact page-URL derivation, page index relation, and candidate URL sets. The evidence records within-page duplicates, cross-page overlap, displayed date ranges, and what the page claims about pagination. A `countPage` value is recorded as an observation, never as proof of reachable or complete history.
3. **Detail and date semantics.** Saved detail bytes belong to list candidates from those pages. A row-level comparison records list title/date, URL path date (diagnostic only), configured detail title/date, visible date, and any other publication field separately. It identifies which field the institution presents as the original publication time, whether list/detail values agree exactly, and whether boundary, midnight, missing, malformed, future, or conflicting cases are represented. No date is manufactured from a URL or fetch time.
4. **Ordering and content boundary.** Across saved adjacent pages, the chosen trusted publication date is checked for newest-to-oldest order and ties; business notices, internal activities, short pages, and known date mismatches are preserved as evidence. A handful of pages cannot establish cross-cycle stability or a whole-column noise rate, so those claims remain unknown.
5. **Configuration and protection review.** The saved artifacts are tested offline against that source's exact proposed list/detail rules and target directory. The review records authority flags and S4/body readiness constraints. A Phase B metadata-only test must not convert a body into ready state or weaken existing S4 behavior.

Missing pages, missing raw hashes, uncertain source identity, unverified page relation, or unresolved date meaning means **not admitted**. It does not authorize a probe to fill the gap; any additional request needs its own bounded approval and manifest before dispatch. Passing this evidence screen would make a source eligible for a later scope decision only; it would not turn on that source or establish Gate 2.

## MINIMUM PHASED DESIGN FOR FUTURE REVIEW

### C0 — Evidence inventory and source-specific admission decision

Build the offline evidence row above for the 19 exact manifest IDs. Select at most one source for a future S1 packet only if its own saved list, adjacent-page, detail, and date-semantics evidence satisfy the packet. If no source qualifies, report that result and leave all 19 disabled. Do not infer a candidate from the 11 configured `detail` objects, the seven direct-date code shapes, Batch 6, or 四川 page 3.

The review output should be a finite source-specific packet: evidence artifact/hash index, parser fixture results, field-by-field date comparison, unresolved risks, and explicit questions for S1. Any new live validation remains a separate authorization decision.

### C1 — Ordering, overlap, and page-shift proof

Before any completion state exists, a separately approved algorithm must prove that a traversal did not skip rows when the site inserts or moves entries at the front of an offset-paginated list. The Phase B pending snapshot protects one captured page while its detail rows resume; it does not stabilize later page numbers or protect the gap between two pages fetched on different runs.

Candidate design for S1 to assess:

- Derive the source's order only from the trusted publication field established in C0. Validate non-increasing dates within a page and at every adjacent-page boundary; keep a deterministic tie policy. Any order reversal, unexplained date conflict, or untrusted row stops the generation without advancing a completeness frontier.
- Persist a bounded frontier made from identities already supported by the existing identity function. On a later run, reread from the leading edge and continue until the old durable frontier is found with the expected adjacent-page overlap; rows already committed are idempotent discoveries, not reasons to skip unseen rows.
- Detect duplicate identities within/across pages, but merge only when their listing metadata agrees. A shifted page, missing frontier, unexpected overlap, or no progress within the authorized page budget leaves coverage `unproven` and the run partial/blocked for review. Do not keep crawling without a bound.
- If a source can arbitrarily reorder old items, rewrite dates, or omit entries from offset pages, bounded overlap cannot prove completeness. That source must remain ineligible for a complete claim unless S1 approves a source-specific alternative backed by observed site behavior.

This is a design candidate, not an approved algorithm. No new cursor field, overlap size, tie-break rule, page reread budget, or source opt-in is authorized by this document.

### C2 — Window boundary, true end, and any 90-day claim

Keep Phase B's exact trusted-date rule: the window is fixed once; a row exactly at cutoff remains in scope; only a trusted date strictly earlier than cutoff can be classified outside the window. A page-count claim, empty response, 404, max-page cap, network failure, or reaching the page budget is not a terminal proof.

A future completion rule must require all of the following in one reviewable proof chain:

- all pages needed to reach the boundary were traversed without gaps and with C1's validated order/overlap;
- every in-scope candidate is durably resolved or safely excluded, with no pending, malformed, failed, or unknown-date row;
- the first wholly older-than-cutoff page, or a source-specific true-end signal, was captured and validated, so an in-scope candidate cannot follow it under the admitted ordering contract;
- the page/article/queue/cursor result and the completion marker are committed atomically, while preserving the original fixed anchor/cutoff and the `coverage=unproven` behavior until this new contract receives approval.

If the archive ends before the requested window, the system must not label a full 90-day history complete merely because it reached an apparent end. S1 must decide whether that case is `available_history_short`, blocked/incomplete, or another explicit state and what evidence proves the channel's true beginning. This proposal adds no state value or schema.

### C3 — Completion and ordinary incremental collection

Completion and incremental polling are separate contracts. After a generation is accepted, a normal scheduled run would need to inspect the current leading pages, identify new and changed rows, and converge across front insertions without re-running the historical 90-day sweep. It must preserve exact source identity and date semantics, avoid revising a stored trusted date from weaker list data, and keep S4/body readiness unchanged. Changes that move an existing article between pages must not hide it or create an artificial new identity.

S1 must define which durable watermark/frontier supports this mode, how many leading pages are rechecked under one shared budget, how edits/deletions/date corrections are treated, and how a crash between article writes and watermark movement is recovered. Until those details are approved, no implementation should switch a completed generation into incremental mode or write `initializedAt`.

### C4 — Reset and configuration drift stay human-reviewed

Phase B already fails closed on a changed config hash and preserves its pending generation. Keep that behavior. A changed selector, date authority, listing URL, page formula, or lookback length must not silently replay an old pending page or replace the fixed window.

Before any reset exists, an operator-facing procedure must state what evidence is retained, how a new generation is distinguished from the old one, what cursor namespaces must survive, and how already committed articles remain idempotent. No automatic reset, new UI/API, migration, worker, or provider path is proposed here. If no existing supported manual action can safely express review and reset, the source remains blocked until a separately approved mechanism exists.

## REVIEWABLE TEST PLAN (NOT RUN)

Tests should be designed after C0 source admission and before code changes. They should use saved-byte fixtures or clearly synthetic HTML and a fresh isolated `_test` database only when persistence semantics require it; no official endpoint, worker, provider, model, or preview database is part of this proposal.

| Contract | Reviewable test evidence |
| --- | --- |
| Source admission | Fixture manifest binds exact source ID/config hash to the saved listing, adjacent page, and detail raws; wrong-source or hash-mismatched bytes cannot satisfy admission. Date comparison output preserves list, URL token, and detail fields separately. |
| Sorting | Within-page and cross-page trusted date inversion; equal-time ties; detail/list conflict less than 24 hours; missing/invalid/future dates. Inversion or unresolved conflict cannot advance the frontier. |
| Front insertion / page shift | Insert a new leading row between partial runs; shift an existing item across an offset boundary; duplicate an item on adjacent pages; mutate an earlier page so the prior frontier is absent. Assert replay reaches the durable frontier or halts unproven, never silently commits a gap. |
| 90-day boundary | Exact cutoff remains included; strictly older trusted dates are excluded; page containing mixed in/out-of-window candidates is fully resolved; an older page with any newer date breaks order proof; all rows in-window cannot stop solely because of `countPage`, empty page, 404, or `maxPageIndex`. |
| True end | Exercise only a source-specific end signal already supported by saved evidence; an unexplained empty/404 and an archive ending inside the lookback window must remain incomplete/unknown until S1's state rule says otherwise. |
| Atomic completion | Inject a database trigger at the final completion/cursor update; prove article, queue, cursor, and marker roll back together, then replay from durable evidence without repeating completed details. |
| Incremental transition | Following a valid completion fixture, add a new leading item, edit a title/date, and move a row across a page boundary. Assert bounded leading-page reads, idempotent identity, stored-date protection, and atomic watermark recovery. |
| Reset/config drift | Mutate each relevant config category mid-generation and after completion. Assert no auto-reset or stale replay, old generation/evidence remains inspectable, and unrelated cursor namespaces survive any later approved reset action. |
| S4/body isolation | Assert metadata-only results do not write body text/HTML, body status, attachment diagnostics, or readiness signals; queue behavior retains existing body hold. |

This plan specifies expected evidence, not implementation details. S1 must approve any new cursor/state semantics, overlap protocol, terminal proof, incremental watermark, or reset operation before those tests become executable requirements.

## PRECISE QUESTIONS FOR A FUTURE S1

1. What minimum source-owned saved evidence and sample count makes one of the 19 entries eligible for a source-specific Phase C decision? Does admission require at least two adjacent pages and details for every observed date-mismatch class, and what cross-cycle evidence is needed?
2. What ordering field is authoritative when a page's visible date, configured detail date, and URL token disagree? The URL token remains diagnostic only; what exact list/detail equality policy applies when detail is not authoritative?
3. Can the source's observed page mechanics support a bounded frontier-overlap algorithm that proves no skipped items under front insertion? What minimum overlap/tie/duplicate conditions are sufficient, and what must happen when the prior frontier is missing?
4. Is a wholly pre-cutoff page sufficient for a 90-day coverage claim after ordering and overlap are proven, or must the crawler also prove the actual terminal page? Which source-specific signal can establish true end, given that `countPage`, empty, 404, and caps alone are insufficient?
5. If the true archive begins inside the requested 90-day window, what explicit state and public/internal wording accurately distinguishes complete available history from a complete 90-day window?
6. What exact transaction sets `initializedAt`/completion state, and which cursor fields are required? Can existing JSON cursor state carry this safely without schema migration, while retaining fail-closed unknown-key and size limits?
7. What is the post-completion incremental contract: leading pages revisited per run, watermark identity, title/date corrections, moved/deleted items, and recovery after article commit but before watermark commit?
8. What human-reviewed reset path is permitted after config drift? What prior cursor evidence is retained, who authorizes a new generation, and how are unrelated cursor namespaces protected? If current admin/API paths are insufficient, should the source stay disabled until a separately scoped interface is approved?
9. Which source-specific test and request caps are allowed if saved evidence cannot answer these questions? This proposal authorizes none.

## NON-GOALS AND CURRENT SAFETY

No source is enabled or selected. No `industry/sources.json`, config, code, UI/API, migration/schema, worker, provider, publication, or S4 file changes are proposed. No real request, source import, database write, model run, or Gate 2 status change is authorized. Existing Phase B's `coverage=unproven`, no-`initializedAt`, fail-closed config-change behavior remains the only implemented behavior until a future S1 decision.

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**: Draft a source-evidence-first Phase C readiness proposal and reviewable test plan; design only.

**MODEL**: GPT-6 Luna High. No project model/provider call.

**FILES_CHANGED**: Only this new proposal. No shared matrix, status, code, source configuration, or test files changed.

**TESTS_RUN**: Read-only review of `AGENTS.md`, `README.md`, `docs/sources.md`, `PROJECT_PLAN.md`, current `STATUS.md`, the approved Phase B S1 decision, the Phase B implementation/transport reports, the Phase B proposal, `SOURCE_MATRIX.md`, Batch 6 page-2 and detail reports, and the current regional coverage matrix. No test, typecheck, database, collector, worker, preview, or network command was run.

**RESULT**: `PROPOSED_NOT_APPROVED`. The immediate next step is an offline evidence admission matrix for the exact 19 manifest IDs. No source currently qualifies on the basis of configuration shape or unrelated Batch 6/Sichuan evidence.

**RISKS**: Offset pagination can shift between runs; bounded single-page snapshots do not prove a contiguous historical traversal. Date-field meaning and a reliable terminal signal remain source-specific unknowns. A numeric 90-day lookback is not by itself coverage evidence.

**BLOCKERS**: No source-specific Phase C evidence admission and no S1 approval for ordering/frontier proof, terminal/coverage state, `initializedAt`, incremental transition, or reset/config-drift handling. Gate 2 remains `NOT_PASSED`.

**NEXT**: QA may review this proposal. If approved for preparation, build the offline evidence inventory for the exact 19 manifest IDs and return a source-specific packet; obtain a new S1 ruling before any new runtime state, source opt-in, reset path, or real request.
