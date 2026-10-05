# 福建唯一待确认正文诊断（2026-10-06）

## TASK

只针对福建隔离库中唯一一条待确认正文执行一次、严格限流的显式抽取诊断，捕获本次 helper 的精确失败原因并查看同一响应的本地 DOM。该任务没有重复 collector，也没有下载页面中引用的 PDF。

## MODEL

Luna High B；Node v24.16.0、pinned Undici 8.11.2。`extractArticleBody(articleId, false)` 关闭 Jina。未调用模型、worker、OCR、embeddings 或推送。

## FILES_CHANGED

新增本报告。ignored evidence 目录为 `.data/fiscal-qa/fujian-pending-diagnostic-20261006/`，包含一次性 runner、canary、抽取结果、gzip 原始响应、诊断 stdout 与只读 SQL。runner `.data/test-pg/fujian-pending-diagnostic.mjs` SHA-256：`CD7446FCA647075D0297FB88E4556848535EA4F9505D7941515A722183FAE25C`。没有修改 selector、配置、backend、schema、共享文档或 Git index。

## TESTS_RUN

- Node 24 syntax check 通过；本地 canary 对 36 个已知字节校验 SHA-256 成功：`c2d0e4783624795d6c59ffd1267a501584517b9a8600e8880bb01fecb836a925`。
- 只读 preflight 确认 `fiscalhot_oct05_fujian_live_test` 中该来源 `body_status='pending'` 恰好 1 行：`iz0ywgmbpj535zy60telkvyac`，精确 URL 为 `https://fj.mof.gov.cn/gzdt/caizhengjiancha/202608/t20260817_3995605.htm`，title 为“财政部福建监管局：2025年度单位决算”，`published_at=2026-08-17 00:00 +08`，revision 1，无正文、无有效附件诊断 marker。库含 35 migrations 和一条 disabled 来源。
- 获批抽取阶段只发一个固定 HTTPS GET：attempted/dispatched/rejected `1/1/0`，HTTP 200，无 redirect、重试、其他 host/path 或超限响应。wire payload 4,391 bytes，SHA-256 `9ef4fad6dfe3e82b130222e41ededf5917a0adcbe9e655d0ccd9c9c5dd14a9c2`。压缩响应保存在 ignored `pending-article-response.html.gz`；离线 gunzip 后为 12,147 bytes。未读取第二个公开 URL。
- `scripts/fiscal/p3-extract-diagnostics.ts` 的诊断 observer 绑定这一 article ID，捕获本次调用的状态 `unconfirmed`、reason `non_article_container`。
- 最终只读 SQL 在 `post-diagnostic-review.log`：10 篇文章、10 个唯一 URL；9 篇 body ok、目标 1 篇 unconfirmed；总计 10 条 revision row，目标仍 revision 1、body 为空。队列保持 9 个 `content.analyze` 和 1 个 `content.extract-body` job，均 `created`；analysis、receipt、publication、selected、job_run 均为 0。

## RESULT

目标 metadata 保持 title、发布日期、URL 和 revision 1。抽取失败后正文状态从 `pending` 转成安全的 `unconfirmed`，正文/HTML 仍为空，无附件 marker。队列项未被处理。

离线检查此次保存的同一响应显示页面唯一 `.my_doccontent` 是一个嵌套 `.TRS_Editor`，其中只有重复文章标题文本，共 16 个字符，没有段落、表格、列表、引用等可作为正文的结构。当前 extractor 以 `non_article_container` 拒绝它，与观测到的 DOM 一致。页面正文区域之外另有一个官方 PDF 链接 `./P020260817468208993554.pdf`；本次没有请求它，当前来源配置只有 `.my_doccontent` body selector，没有 `attachmentSelector` 或 `pdfDirect`。

本次 reason 由带 article ID 的 helper observer 捕获。此前 collector stderr 的 `non_article_container` warning 没有 article ID，因此仍无法确认它是否对应本篇；本次诊断不能倒推或改写此前 warning 的归属。

## RISKS

当前文章网页只显示标题型容器，实际业务正文可能需要读取 PDF 附件；本次并未验证 PDF 是否可读、与页面身份一致或适合作为正文。当前 config 安全地不接受该 HTML title-only 内容，且没有 attachment marker。不要把这个单篇结果外推到福建其他页面。

## BLOCKERS

该文章没有通过正文验收；福建库仍有 1 篇 `unconfirmed`。原先没有 article ID 的 warning 依然没有耐久归属证据。Gate 2 仍未通过。

## NEXT

先由 QA/Lead review 本次 response hash、DOM 摘要、marker 和队列计数。最小后续项是单独评审该来源的 PDF 是否可作为正文、身份校验范围以及是否需要专属配置；此记录没有批准下载 PDF 或改动任何配置/代码。保留测试库与 ignored 原始响应，不重跑该文章。
