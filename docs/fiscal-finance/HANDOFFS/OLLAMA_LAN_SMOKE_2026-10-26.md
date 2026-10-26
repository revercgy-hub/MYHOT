# Local Ollama chat smoke — 2026-10-26

## Result

The LAN Ollama gateway accepted three direct, non-streaming chat-completions requests with HTTP 200 using `qwen3.5:9b`. A short JSON health request returned valid JSON with `finish_reason=stop` in 18.960 seconds (cold start expected). This establishes basic endpoint and response connectivity only.

Two calls used a real, previously captured project sample: a 673-character report from the Ministry of Finance Xinjiang Supervision Bureau about an on-site check of education-sector central transfer payments. Its source body SHA-256 is `125de67f41c1f52ce218807c261901e57d9524c1b7f6b9a5f9c84392e749abe9`.

| Task | HTTP | Cap | Latency | Finish | Result |
| --- | ---: | ---: | ---: | --- | --- |
| Prefilter | 200 | 256 tokens | 28.710 s | `length` | Completion cap exhausted; no final content; project schema not satisfied |
| Article summary | 200 | 512 tokens | 57.101 s | `length` | Completion cap exhausted; no final content; no title/summary output to validate |

Both inference responses indicated reasoning was present, but the exchange records retain only a boolean and contain no reasoning text. The health result is in `exchange-001-health.json`, the prefilter result in `exchange-002-prefilter.json`, and the summary result in `exchange-003-summary.json` under the ignored `.data/fiscal-qa/ollama-lan-smoke-20261026/` directory. Their SHA-256 values are respectively `B3848DD8246C1E82ECBC7841A17E5747FFED3A5D7493319DE12BE3598B966022`, `8C3347933B7B3F7B5F9589EBCE1A79F4926BF929B80C4A7560504EDF219CED53`, and `A4802A7BB7D707735CCAD7176B4295E3E857A9DDCC1C59C2FBEC002695DCD879`.

## Scope and QA

The requests used the exact captured prefilter and summary prompts. The prefilter smoke used JSON mode, temperature 0, non-streaming, and a 256-token cap. The summary follows the actual project contract (`json:false`, `parseTranslateOutput` label format), with temperature 0 and a reduced 512-token cap; the production project call uses temperature 0.2 and up to 2,048 tokens. Packet and response hashes, prompt equality, and source-body hashes were independently checked. The summary output was empty and the prefilter output was empty, so neither supports a content-quality conclusion.

The operator made no retry after the completion caps were reached; the three requests were one health call plus one prefilter and one summary call. These were direct HTTP smoke calls, bypassing application `chatJson`, `paidRequest` receipts, budget accounting, worker execution, and database writes. No project model environment, feature flag, database, source, or runtime configuration was changed. No model download or hardware-performance conclusion was made.

This smoke does not satisfy model integration, editorial quality, or any fiscal-finance launch gate. Gate 3 remains `CHANGES_REQUIRED`; Gates 4 and 5 remain unpassed. Full call parameters, artifacts, and limitations are recorded here without any API key or private reasoning text.
