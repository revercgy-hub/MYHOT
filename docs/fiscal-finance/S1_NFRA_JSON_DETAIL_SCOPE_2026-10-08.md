# S1 NFRA category / JSON detail compatibility scope (2026-10-08)

DECISION=APPROVED_SCOPE, subject to the mandatory constraints below. This is an implementation scope decision, not implementation acceptance or source admission. Review baseline: branch `feat/fiscal-finance-hot`, HEAD `4ff4b04ada90a72212b535dc4b741c723de9b98a`. README, AGENTS, PROJECT_PLAN, STATUS, CORE_SOURCE_IMPLEMENTATION_NEXT and relevant SOURCE_MATRIX observations were read, together with the actual JSON mapper, config validator, collector detail loop, HTML detail/extraction paths, selected-body identity checks, attachment diagnostics and HTTP budget contract. STATUS's older code SHA is historical evidence, not the review HEAD. Gate 2 is not reopened. User-directed public GitHub visibility does not enable collection or full-text publication. Paid work remains out of scope.

## Approved configuration contract

Keep the existing JSON and HTML paths unchanged when the new options are absent. Approve only these explicit additions:

- `json_list.categorySelection`: object with exactly `arrayPath`, `categoryIdPath`, `categoryId`, `itemsPath`; this candidate uses `data`, `itemId`, numeric `915`, `docInfoVOList`. Resolve exactly one category by a safe numeric category ID, never its array index. Reject missing/duplicate matches, wrong field types and a non-array row list. Reject combining this mode with root `itemsPath`, `itemsObjectValues`, `jsonKey`, `windowVar` or embedded-HTML modes; no recursive fallback.
- `detail.mode`: new exact value `nfra_json_v1`, supported only on a direct GET `json_list` source with the NFRA category selection. No freely configurable endpoint/template or JSON identity paths are needed: this small adapter fixes the observed endpoint and field mapping. Require the category and source-local `+08:00` offset, nonempty `bodySelector` and finite positive `maxFetches` capped at six. Disallow authoritative metadata replacement, date upgrades, Jina/summary selectors, HTML identity regexes/selectors, PDF/attachment drivers, short-body override and body policies for this mode. Unsupported/malformed combinations must fail validation and fail closed at direct runtime entry.

For the list, require numeric `rptCode === 200`; use `docId` as external ID, first nonempty `docSubtitle` / `docTitle` as title with the existing whitespace normalization, `publishDate` interpreted at +08:00, and `docSummary` as excerpt only (`summaryIsBody=false`). Require safe positive integer IDs and valid title/date for this strict candidate. Reuse the current mapper rather than inventing a new Candidate schema.

Keep the public article URL as `https://www.nfra.gov.cn/cn/view/pages/ItemDetail.html?docId=...&itemId=915`. Saved official `.data/fiscal-central-audit/html/nfsa-2.html:59` directly proves `/cn/view/pages/ItemDetail.html?docId={{x.docId}}&itemId={{x.itemId}}` for `isTitleLink == 0`; the saved news script selects the category and calls `parseItemDocInfoVOList(fd, fd.itemId, 6)`. Construct category itemId from the uniquely selected category, not an absent row field. Permit only observed `isTitleLink=0` candidates; do not follow titleLink alternatives. The API URL must never become the Candidate/article canonical URL. The adapter parses that canonical URL, requires exactly one `docId` and one `itemId`, verifies category 915 and the expected external ID when available, and constructs only `https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=<validated decimal ID>`. No raw template interpolation or arbitrary list-supplied API URL.

## Mandatory identity, body and attachment behavior

Require HTTP 200, JSON MIME, strict valid UTF-8 JSON and numeric `rptCode === 200`, then a plain `data` object. Require `data.docId` equal to the expected canonical/list ID, the normalized first nonempty subtitle/title equal to the original list/stored article title, and a valid `publishDate` on the same source-local calendar day as the original list/stored date. Missing identity, wrong types, malformed date and mismatches decline; do not replace expectations with response metadata to make the comparison pass. Parse `docClob` only as a nonempty HTML string after identity checks. Its inner gb2312 meta cannot change the UTF-8 JSON decoding; the existing outer decoder fix stays unchanged.

Refactor only the selected-body implementation necessary to reuse its container uniqueness, structured-content, sanitization, attachment scan, empty/length checks after structured JSON identity succeeds. Keep the ordinary HTML entry's existing HTML identity requirement. A dedicated internally validated JSON driver may enter the shared selection core; do not add a user/config `skipIdentity`, inject fake ArticleTitle/PubDate metadata, or accept the expected identity as a response identity. Prefer one helper owning JSON validation and invoking the shared private body core so callers cannot forge a prevalidated identity. Do not use `pdfAttachmentsPrevalidated` to suppress attachments. `.Section0` is an offline fixture candidate, not a proven production layout.

The saved pair has a critical list/detail asymmetry: list `docFileUrl=/chinese/OFFICE/DOC/1273452.doc` and `pdfFileUrl=/chinese/OFFICE/PDF/1273452.pdf` are nonempty, while the detail fields are null and `attachmentInfoVOList=[]`. Their attachment semantics remain unverified. Capture the list-side evidence as a pipeline-owned pending diagnostic during mapping, before prefetch, because existing JSON raw persists only externalId and delayed extraction otherwise loses those facts. Detail null/empty values cannot clear list evidence. For this actual pair the public result must remain body null and attachment `pending_parse` (`attachments_unprocessed`), with no `ok` body/hash and no clearing of an existing pending marker. A successfully selected 1,199-character candidate may be inspected internally, but cannot establish body readiness. Use existing `createAttachmentDiagnostic` and reserved-key provenance helpers, allowing an empty URL list for this explicit unverified attachment state; do not invent/download guessed attachment URLs. Missing or malformed attachment fields must not be treated as verified absence. This scope approves no classification that declares the actual pair attachment-free, and no new attachment download/OCR behavior.

Both `fetchDetail` prefetch and delayed `extractFromUrl` / `extractArticleBody` must call this same JSON driver, retain canonical URL for links/sanitization/diagnostics, pass the original title/date and ID expectations, and disable generic Readability/Jina/HTML fallback after any explicit-mode failure. Delayed extraction can recover the decimal ID from the strict canonical URL and cross-check existing `raw.externalId` when present; do not introduce migrations. Preserve existing attachment diagnostic persistence and strict automatic-selection holds.

## HTTP budget and file boundary

The current collector's `detail.maxFetches` counts logical calls; default `fetchDetail` does not itself share a run-wide dispatch budget. That alone is insufficient for this opt-in. Approve source-local budget plumbing for NFRA only: one list plus at most six detail dispatches, shared 120-second deadline including parsing/checkpoints, list timeout at most 25 seconds, detail timeout at most 20 seconds, detail maxBytes at most 1 MiB, no retry and no redirects (`maxRedirects=0`). Deduplicate repeated doc IDs before detail dispatch; duplicates do not yield additional requests. Budget admission must use existing `GuardedFetchRunBudget.beforeDispatch` and signal; production requests still use guardedFetch with DNS/SSRF checks. Delayed extraction gets one detail dispatch and a 20-second operation deadline. Restrict HTTPS, exact `www.nfra.gov.cn`, standard port, no userinfo/fragment, exact list endpoint and its observed itemId=914/pageSize=6 query, exact API detail path and sole decimal docId query. Validate before dispatch and validate final URL identity. No dynamic browser or framework transport.

Permitted implementation files (not changed by this review):

| File | Narrow responsibility |
|---|---|
| `packages/backend/src/sources/json-list.ts` | Exact category selection and opt-in list validation; bounded transport options |
| `packages/backend/src/sources/config-keys.ts` | Recognize and validate the two explicit options and incompatible combinations |
| `packages/backend/src/content/nfra-json-detail.ts` (new) | Fixed transport, strict structured identity, attachment-pending and shared body-driver contract |
| `packages/backend/src/content/selected-body.ts` | Private shared selection core plus validated JSON entry; default HTML identity unchanged |
| `packages/backend/src/sources/web-list.ts` | Early explicit-mode delegation from fetchDetail; ordinary paths untouched |
| `packages/backend/src/sources/collect.ts` | NFRA-only bounded list/detail budget and expectation propagation |
| `packages/backend/src/content/extract.ts` | Same driver for delayed extraction, fail-closed diagnostic and no fallback |
| `industry/sources.json` | One exact disabled candidate only after canonical-path evidence and validator pass |
| `tests/nfra-json-detail.test.ts`, `tests/fixtures/nfra-json-detail/` | Exact saved raw and offline contracts |
| Existing source-count / exact strict-ID tests | Add only the one approved ID and expected count |
| SOURCE_MATRIX / implementation-next / STATUS | Evidence/status updates, no admission claim |

Reuse `http-fetch.ts`, URL guards and attachment diagnostic primitives without changing their general behavior. Any new generalized config, schema/apps change, pagination engine, browser adapter, generic JSON identity bypass, new attachment policy or wider HTTP authority is CHANGES_REQUIRED outside this scope.

## Disabled candidate and validation requirements

Approve exact candidate ID `nfra-regulatory-dynamics` for category 915 only: enabled=false, T1/editorial, interval_minutes=1440, `_aihot.initialBackfillMonths=3`, `_aihot.initialBackfillRequirePublishedAt=true`, `_aihot.requireBodyReadyForAutomaticSelection=true`, site_fulltext=false, syndicate_fulltext=false, summaryIsBody=false, maxFetches=6. List URL is the saved `SelectItemAndDocByItemPId?itemId=914&pageSize=6`. Catalog then becomes 48 sources / 42 exact strict IDs if the current 47/41 baseline is unchanged. Do not seed or run this source. Configuration is a disabled UNADMITTED candidate, not completion of collection capability.

Required offline fixtures: copy actual list/detail raw bytes; record and verify SHA-256 `a45ad64cf1313e75850616e77a2e1cf65036008e7b1e51e915c07c3d5c914600` and `b6e46388f904c8c8fead84cc66997b0a11dc4eca79e02fd03de1556fa7fc2af7`. Use raw UTF-8 facts, not the stale mojibake manifest-derived title. Test shuffled seven categories still selects 915/six rows; absent/duplicate categories, invalid arrays and config combinations fail. Test exact docId=1273452/title/date identity, UTF-8 zero replacement characters and inner-meta non-reinterpretation. Negative identity cases: missing/wrong ID, conflicting canonical/raw ID, mismatched/missing title/date, invalid calendar, bad status/MIME/JSON/rptCode/docClob. Test selection core rejects duplicate/missing `.Section0`, empty/navigation/link-only/short content and unsanitized scripts; synthetic attachment-free cases only establish helper behavior and must be labeled synthetic.

The exact saved pair must return pending attachment/body null. Test nonempty or malformed attachment fields and HTML attachment links remain pending without fetching. Test prefetch and delayed paths yield equal outcomes and preserve canonical URL/expected identity; pending markers cannot be cleared or promoted. Test host/path/query/userinfo/port/ID rejection before dispatch, redirect refusal, maxBytes/timeout/deadline/exhaustion, no retry/fallback and duplicate-ID dispatch counts. Use injected transport or exact-origin interception without external HTTP; no production flag relaxation. Run typecheck and focused NFRA/config/source-rules/strict/selected-body/HTML metadata/PDF/attachment diagnostics regressions. Wider repo-required fresh isolated DB/backend/web/CI checks belong to implementation QA, not this read-only review; no test execution is claimed here.

One category snapshot and one JSON detail pair prove neither all categories/layouts nor complete near-90-day history, pagination, revisions/dedupe across time, noise, attachment semantics, sustained stability or source admission. NFRA remains source-mainline work and UNADMITTED. Gate 2's existing bounded P4 pilot is unchanged; this scope authorizes no model/provider/publication/worker/collector/live HTTP.

## Eight-field handoff

**TASK**: S1 minimum NFRA compatibility scope review, without implementation or Gate 2 rereview.

**MODEL**: Current delegated review agent; no project model/provider/key/paid requests.

**FILES_CHANGED**: Only `docs/fiscal-finance/S1_NFRA_JSON_DETAIL_SCOPE_2026-10-08.md`.

**TESTS_RUN**: None; read-only code/evidence inspection and local HEAD verification.

**RESULT**: APPROVED_SCOPE for the bounded explicit adapter and one disabled strict candidate, subject to every mandatory constraint; broader changes are CHANGES_REQUIRED.

**RISKS**: Actual pair has unresolved attachment fields; body readiness must remain blocked. One `.Section0` layout cannot prove general quality or history coverage.

**BLOCKERS**: Implementation and offline/independent QA remain; list/detail attachment semantics are unverified. Canonical pathname is verified from saved official template. No network or paid authorization is implied.

**NEXT**: Implement only approved files/options offline, preserve pending attachment outcome, then independent QA against this contract; no HTTP, DB writes, secrets or commit in this review.
