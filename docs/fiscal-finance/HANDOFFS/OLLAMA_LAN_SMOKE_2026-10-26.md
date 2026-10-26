# Local Ollama chat smoke — 2026-10-26

## Result

Outcome: `LAN_SMOKE_PASS_WITH_CONFIGURATION_REQUIREMENT` — the LAN endpoint and both project-shaped sample tasks worked after disabling reasoning in the request and raising the initial token caps. This parameter remains unconfigured in the project and NAS.

The LAN Ollama gateway accepted five direct, non-streaming chat-completions requests with HTTP 200 using `qwen3.5:9b`: one health request and four calls on the same previously captured project sample (two prefilter attempts and two summary attempts). Calls 1–3 used the initial low output caps and default reasoning behavior; both project outputs exhausted the cap with no final content. The 256-token prefilter cap was below `chatJson`'s 512-token floor; the 512-token summary cap was below the project's 2,048-token setting. Calls 4–5 set the request field `reasoning_effort=none` and used task-sized caps; both completed successfully. The parameter was tested only in these requests and was not added to project or NAS configuration.

Four calls used the same real, previously captured project sample: a 673-character report from the Ministry of Finance Xinjiang Supervision Bureau about an on-site check of education-sector central transfer payments. Its source body SHA-256 is `125de67f41c1f52ce218807c261901e57d9524c1b7f6b9a5f9c84392e749abe9`.

| Request | HTTP | Cap | Latency | Finish | Result |
| --- | ---: | ---: | ---: | --- | --- |
| Health JSON | 200 | 256 tokens | 18.960 s | `stop` | Valid JSON (`ok=true`); cold start expected |
| Prefilter, default reasoning | 200 | 256 tokens | 28.710 s | `length` | Cap exhausted; empty final content; schema failed |
| Summary, default reasoning | 200 | 512 tokens | 57.101 s | `length` | Cap exhausted; empty final content |
| Prefilter, `reasoning_effort=none` | 200 | 512 tokens | 1.747 s | `stop` | Valid project-shaped JSON: `PASS`; reason cites transfer-payment oversight and budget execution checks |
| Summary, `reasoning_effort=none` | 200 | 2,048 tokens | 8.946 s | `stop` | Title and summary parse successfully; 108 completion tokens |

The exchange records retain only a `reasoning_present` boolean and no reasoning text. Calls 1–3 indicate reasoning was present; calls 4–5 do not. Artifacts under the ignored `.data/fiscal-qa/ollama-lan-smoke-20261026/` directory and SHA-256 values: health `exchange-001-health.json` (`B3848DD8246C1E82ECBC7841A17E5747FFED3A5D7493319DE12BE3598B966022`); initial prefilter `exchange-002-prefilter.json` (`8C3347933B7B3F7B5F9589EBCE1A79F4926BF929B80C4A7560504EDF219CED53`); initial summary `exchange-003-summary.json` (`A4802A7BB7D707735CCAD7176B4295E3E857A9DDCC1C59C2FBEC002695DCD879`); repaired prefilter `exchange-004-prefilter-reasoning-none.json` (`0C6ABB9D0D1A484C5B5E5AB69F47B98693AF0A2EE60327CDF747459E93C2CD85`); repaired summary `exchange-005-summary-reasoning-none.json` (`05A46771C077523687611A4494C781370C4B4C2EBBEE1B3CD88DCCC39053CAC2`).

## Scope and QA

The requests used the exact captured prefilter and summary prompts. The prefilter used JSON mode and temperature 0. The summary followed the actual project contract (`json:false`, `parseTranslateOutput` label format), not JSON response mode. The repaired summary used the project's 2,048-token cap but temperature 0 rather than the production call's 0.2. Packet and response hashes, prompt equality, and source-body hashes were independently checked. The repaired prefilter response matched its project schema. I ran the actual `parseTranslateOutput` implementation on the summary response: it returned nonempty `titleZh` and `summaryZh`, with `bodyZh` normalized to an empty string; all three fields satisfy `SummarizeSchema`.

The 151-character, two-sentence summary is supported by the source: it names the on-site check and governing measure, and says the inspection covered budget execution, projects, rural resource allocation, and student aid. It presents idle funds and out-of-scope spending as risks the inspection was tasked to identify, not as confirmed findings; it adds no amount, date, or quantitative result. This is one smoke sample and does not estimate accuracy.

The operator made five calls total, reaching the authorized request cap; no further generation was made. The successful 1.747- and 8.946-second calls used `reasoning_effort=none`, and the summary response reused most prompt tokens from cache; these timings do not establish stable throughput or hardware acceleration. All calls were direct HTTP smoke requests, bypassing application `chatJson`, `paidRequest` receipts, budget accounting, worker execution, and database writes. No project model environment, feature flag, database, source, or runtime configuration was changed. No model download or hardware-performance conclusion was made.

A final read-only Ollama inventory response reported `qwen3.5:9b` with context length `262144`, and both `size` and `size_vram` as `14,604,325,354` bytes. It did not report CPU allocation or measured compute placement, so this is not proof of GPU acceleration.

This smoke does not satisfy model integration, editorial quality, or any fiscal-finance launch gate. Gate 3 remains `CHANGES_REQUIRED`; Gates 4 and 5 remain unpassed. Full call parameters, artifacts, and limitations are recorded here without any API key or private reasoning text.
