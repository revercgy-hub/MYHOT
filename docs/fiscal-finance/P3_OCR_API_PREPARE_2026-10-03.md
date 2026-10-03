# P3 OCR GitHub API prepare implementation — 2026-10-03

## Scope and status

Implemented the approved preparation profile from [S1_P3_OCT03_IMPLEMENTATION_REVIEW.md](S1_P3_OCT03_IMPLEMENTATION_REVIEW.md). This report records both offline fake-response verification and the single real prepare later authorized by Lead. `OCR_RUN_ENABLED` remains `false`, and no OCR or fixed-page/gold run was attempted.

The prepare command now targets a new ignored batch directory, `.data/fiscal-qa/scan-ocr-poc-20261003/`; the 9/30 and 10/2 failure directories are not changed. It uses only the exact pinned root URL for `tesseract-ocr/tessdata_fast` at commit `87416418657359cb625c412a48b6e1d6d41c29bd`. It requires one unique model and LICENSE regular-file entry from that directory response before constructing either blob URL, then performs at most one request per SHA-derived official Git Blob URL. `download_url`, `git_url`, and other response URLs are never used as request targets. The request cap is three admissions total, sequentially, with redirect mode manual, no redirects accepted, no retry, no fallback, 120 seconds per request, and 240 seconds total including verification and writes.

## Integrity and write behavior

The root directory JSON is capped at 1 MiB and at 1,000 entries. The two required entries must have their exact name and path, `type=file`, a 40-character lowercase Git blob SHA, and positive safe-integer size within the decoded model/license limits. Duplicate, missing, malformed, wrong-path, wrong-type, invalid SHA, or oversized entries stop the batch before blob requests.

Each blob API response is independently capped on the wire at `2 * (4 * ceil(metadataSize / 3)) + 64 KiB`; the decoded limits remain 32 MiB for the model and 1 MiB for LICENSE. The complete response stream is counted through EOF, and any available Content-Length must match the actual wire byte count. The JSON identity (`sha`, `size`, `encoding=base64`) must match the root entry. Base64 accepts only the standard alphabet and padding, with LF/CRLF wrapping at complete quartet boundaries; decoding must produce the expected byte length and re-encode to the same canonical content. The decoded bytes must hash to the API Git blob SHA using a Git blob header containing a real NUL byte, then receive a local SHA-256. LICENSE must contain the Apache License 2.0 identification text.

The tool stages files under exclusive temporary names only after both files validate, renames the model, LICENSE, and provenance record into place, then atomically renames the complete manifest last. On any error it removes temporary/final data files and writes a failure record plus an incomplete, non-runnable manifest. The request log contains only the fixed approved API URLs, status, timestamps, lengths, byte counts, EOF state, and allowlisted error name/message/code/errno/syscall fields. URL and IPv4-like text is redacted in error messages; arbitrary error objects, headers, and environment values are not serialized. The one-shot marker and fixed output-scope check happen before any network admission.

The run-side verifier now accepts only this API transport profile and exact root URL, commit, file paths, root blob identities, SHA-derived blob URLs, three successful request records in order, byte counts, SHA-1/SHA-256 values, and Apache-2.0 license identity. It rejects the old raw-URL profile. The execution lock remains false, so this manifest change does not enable OCR.

## Offline verification

`node --test tests/fiscal-ocr-scan-poc.test.ts` passed **34/34** on the local Windows host. The verified API prepare test used fake responses for exactly three URLs and confirmed no response-supplied `download_url` or `git_url` was requested. Fault fixtures cover pinned metadata and unique file identities, wrong path/type/SHA/size, malformed JSON, Base64 alphabet/padding/line-wrap/canonical checks, response identity and content hash mismatches, Content-Length truncation, body-stream errors, redirect rejection, encoded response cap, invalid Apache license, per-request abort, total deadline, repeat prepare, and output-scope rejection. Every failure fixture checks the incomplete manifest and absence of runnable model/license files where applicable. The fake socket error test confirms a safe error code is retained and an IPv4 address is not logged.

The existing child-process suite still passes on Windows, including the real local PowerShell monitor fixture. That PowerShell-specific test is now skipped on non-Windows hosts; platform-neutral process fault fixtures continue to run there. It is not replaced by Linux evidence.

`npm run typecheck` passed. `git diff --check` passed for the two owned source files (Git printed only line-ending conversion notices). Tests use temporary directories and fake `fetch`; they require no OCR executable, model data, service, or outside network.

## One authorized real prepare

After Lead核销 on the exact tested code SHA `9bfa0d1a91dcc765b9870ecf5cb25b9958c9f651`, the fixed CLI command `node scripts/fiscal/ocr-scan-poc.ts prepare` ran once. The new batch completed in 2,911 ms with exactly three sequential HTTP 200 requests and no retry/fallback:

| # | Request | HTTP bytes | Content-Length | EOF | Elapsed |
|---|---|---:|---:|---|---:|
| 1 | Pinned root Contents metadata | 136,046 | 136,046 | complete | 917 ms |
| 2 | Model Git Blob SHA `388bac276d033d06e5ed5ba7a7ad14ae58f97dab` | 3,402,253 | absent | complete | 1,580 ms |
| 3 | LICENSE Git Blob SHA `d645695673349e3947e8e5ae42332d0ac3164cd7` | 15,951 | absent | complete | 357 ms |

Total observed HTTP body bytes were 3,554,250. Blob responses had no Content-Length header; their streams reached EOF, their JSON blob `size` and Base64-decoded byte lengths matched the pinned root metadata, and the independently calculated Git blob SHA-1 values matched both the root entries and API responses. The model file is 2,469,156 decoded bytes with SHA-256 `A5FCB6F0DB1E1D6D8522F39DB4E848F05984669172E584E8D76B6B3141E1F730`. LICENSE is 11,358 decoded bytes with SHA-256 `CFC7749B96F63BD31C3C42B5C471BF756814053E847C10F3EB003417BC523D30`; its content passed the Apache-2.0 identification check. `Get-FileHash` and `git hash-object` independently reproduced the saved SHA-256 and Git blob SHA-1 values.

The new manifest is `status=complete`, `trainedDataComplete=true`, `runnable=true`, and records the exact repository, commit, Contents root, paths, blob SHAs, sizes, local SHA-256s, license identity, and three request records. The `.data/fiscal-qa/scan-ocr-poc-20261003/` directory contains the model, LICENSE, attempt marker, `upstream.json`, and `manifest.json`; no OCR `run.json` exists. The old 9/30 and 10/2 directories remain present. This successful prepare validates this real API response/transfer path, not Tesseract execution or model quality.

The OCR execution lock remains false. No Tesseract, invoice image, gold record, business endpoint, collector, database, or publication path was touched. The earlier terminated raw downloads remain failures and are not attributed to a specific network layer. Sustained native Tesseract monitor evidence and a separate execution review remain outstanding; this data preparation does not authorize OCR.

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：按 10/3 S1 实现固定 commit 的 GitHub Contents + Git Blob 离线准备路径，并验证请求、身份、字节边界及失败关闭行为。

**MODEL**：Luna High。

**FILES_CHANGED**：`scripts/fiscal/ocr-scan-poc.ts`、`tests/fiscal-ocr-scan-poc.test.ts`、本文档。没有改 apps、backend、industry/source config、schema、共享 QA/index/status 或旧失败数据。

**TESTS_RUN**：Windows `node --test tests/fiscal-ocr-scan-poc.test.ts` 34/34 PASS；`npm run typecheck` PASS；owned-source `git diff --check` PASS。没有真实网络请求、prepare、OCR、Tesseract 数据访问、采集或数据库调用。

**RESULT**：离线 happy path 与拒绝矩阵均通过。Lead 核销后对 SHA `9bfa0d1a91dcc765b9870ecf5cb25b9958c9f651` 执行唯一一次真实 prepare：三次固定 API 请求全为 HTTP 200，model 2,469,156 decoded bytes、LICENSE 11,358 bytes，Git blob SHA-1、SHA-256、EOF 与许可检查均匹配；manifest complete/runnable。没有 OCR。`OCR_RUN_ENABLED=false` 保持不变。

**RISKS**：真实 GitHub JSON 字段及大 Base64 blob 响应尚未验证；Base64 会扩大线上响应；Git blob hash 核对不代表上游签名或模型质量证明。

**BLOCKERS**：训练数据与许可证已在批准批次完整取得；OCR 执行仍为 CHANGES_REQUIRED，Gate 2 未通过。

**NEXT**：保持 OCR 执行锁关闭；由 Lead 单独裁定任何后续监控/执行工作。不得把此次数据取得写成 OCR/gold 结果或执行授权。
