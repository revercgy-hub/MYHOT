# Saved-source metadata selector proposal — 2026-10-25

## Scope and result

This repository-only candidate addresses missing detail-page title/date selectors for three existing metadata-only sources, using already saved responses. It changes no parser or application code:

- `mof-policy-release` and `mof-treasury-debt-data`: add `h2.title_con` and the existing-site `<meta name="PubDate">` pattern as detail identity selectors.
- `mof-shanghai-supervision-dynamics`: add `h2.title_con`; preserve its existing `PubDate` parsing.

The catalog remains disabled for all three sources; `site_fulltext` and `syndicate_fulltext` remain false. No new GET, collector run, database write, or NAS catalog synchronization occurred. This is not source admission, full-source quality evidence, or coverage proof. The running NAS app remains d45; the proposed catalog is not in its runtime directory.

## Saved-response evidence

Independent review confirmed six referenced response bodies match their declared raw hashes, response-manifest hashes, HTTP 200 status, complete EOF, and gzip encoding. Parsed titles and Shanghai-local publication dates match the corresponding saved identity fields. The two capture bundles are from `.data/fiscal-qa/bulk-20261012/evidence/` and `.data/fiscal-qa/bulk-collection-20261021/main-body40/attempt-2/`.

| Source | Saved article | Capture path | Raw entity SHA-256 | Capture manifest SHA-256 |
|---|---|---|---|---|
| `mof-policy-release` | `sk4s2i77obfpy1zar4uvv4eup` | `bulk-20261012/evidence/responses/dispatch-037.body` | `84daeeb1298c04b1382ea5039cbf832033359ac6a3353f74e4bc2a8fd1a03a88` | `7879d85c71194a905f727f47ff424a88f7263e41ead5a67f70c8c0c43dd9a7c5` |
| `mof-policy-release` | `u82njd7dy0jxcpufhnivq5ppd` | `bulk-20261012/evidence/responses/dispatch-038.body` | `ff8fe6af6c5b4dab5be24ec13d8e96b1c9abc98a7f3aea58b4bf7e6a50e7928e` | `7879d85c71194a905f727f47ff424a88f7263e41ead5a67f70c8c0c43dd9a7c5` |
| `mof-shanghai-supervision-dynamics` | `sjp6t2vd5ak5cueh9qqgw9uql` | `bulk-collection-20261021/main-body40/attempt-2/responses/dispatch-007.body` | `66d2764204e83f5478d1c217c1446222ffe1caec8a5337cec79c63b458ebbd96` | `574894715c677904a3d428964d86e751f11532e7d35a90996519a3b78c69d7fb` |
| `mof-shanghai-supervision-dynamics` | `iwh7cxamb3vlvtqxjm6vjgpu7` | `bulk-collection-20261021/main-body40/attempt-2/responses/dispatch-032.body` | `c42c4ce968ef116306bfee98837849b3eec7b3ba8c6c84bbed48ac546cdf748a` | `574894715c677904a3d428964d86e751f11532e7d35a90996519a3b78c69d7fb` |
| `mof-treasury-debt-data` | `ak67qgu3edxknnqdy3girv8hl` | `bulk-20261012/evidence/responses/dispatch-012.body` | `eb80fc868fcb01b53eeeaa8ede68f3bb7958114a05f033c1e3b8efd83448a25a` | `7879d85c71194a905f727f47ff424a88f7263e41ead5a67f70c8c0c43dd9a7c5` |
| `mof-treasury-debt-data` | `xvzyzp8buudx99l7ucf12hxt9` | `bulk-20261012/evidence/responses/dispatch-013.body` | `02889bb0ae24293b6fa08afd7c50bdeef4dc25240b87308c82fc0fd954966db8` | `7879d85c71194a905f727f47ff424a88f7263e41ead5a67f70c8c0c43dd9a7c5` |

The separate Shanghai date-conflict case `yid2n8wpfhz6gy5jqzd52tsme` was excluded from this selector proposal and remains a held identity/date conflict (raw SHA-256 `6bae797e0e6df9762f636ed87b142b5fb8f1cdf7560c097a0bf30798fbd9834c`; manifest SHA-256 `b95aeee0239291135ea3a948bbde6eeb0b70c3a8ee791f1b02d3432f12d18573`). The treasury positive fixtures retain their PDF link and verify `attachments_unprocessed` with no body; adding title/date metadata does not resolve or fetch that attachment.

Proposal JSON SHA-256 is `55d4544f03d6b5d82aa125af186c01712048f33f5ecf8e498fabe67a7468e978`; the earlier old-raw replay priority handoff it references is `9326c6c74d8fe70da3fe7bc11c24dc0cc79a3ed420881013735b80ea374b1600`. Independent raw/fixture review report: `.data/fiscal-qa/source-metadata-config-proposal-20261025/independent-raw-fixture-review-final.json`, SHA-256 `bf1e0414e0ad406805cc11dc782992a681e822a3ff9557766ce4eabd475750a6`. It checked five synthetic HTML fixtures; these fixtures test DOM shapes and are not copies of the captured response bodies.

## Software verification

The frozen candidate is commit `647769f181ad439158ba76f13d820ef8c06a31ce`. Source catalog SHA-256: `27af3250bbc472ed20019983093b43336cc1967b9ae3193e6b202da4df27ad3f`. The full source-hash index is `.data/test-pg/source-metadata-20261025-final/source-sha256.json`; the runner results index is `results.json`, SHA-256 `881d3261c12f076567d232d1c18e75ccd533467eb6bbfc05ff652fe069d5f16c`.

Migration, typecheck, npm tests, Web build, and Web22 all exited 0. The npm run reported 485 tests: 484 passed, 0 failed, 1 skipped. The skipped fixed-gzip collector integration test is gated by `P3_PAGE_CONTINUATION_TEST_DATABASE_URL`, which was not configured. The focused selector test passed 7/7. Full npm log SHA-256 is `1902b55f23f42dbaade3f22837ee6b8e9c353fd465ac553e57e2825bea094751`; Web build log SHA-256 `8db6050594b5438a112f52baf313d801c0e1a65beddb50d446ada8e566771be9`; Web22 log SHA-256 `953711c144f53222516adb578c33044e236ca18a490390922f2fa99fc8a408e3`. These software checks do not establish source admission or runtime behavior.

At the prior independently checked Staging snapshot, counts were 418 articles / 650 revisions / 418 discoveries, body status 232 `ok` / 180 `pending` / 6 `unconfirmed`, and 126 publications/overrides; all 48 sources remained off and Gold200 unchanged. This proposal did not query or write Staging, so those are a prior checkpoint, not a new post-change database verification.
