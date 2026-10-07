# P3 已保存响应离线审计与内容解码检查点（进行中，2026-10-07）

STATUS=IN_PROGRESS
STAGE=P3 source evidence / Phase C
GATE=Gate 2 NOT_PASSED；福建及其他候选来源均未因本检查点获得准入；覆盖仍 unproven
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=cdbb329529f407f25db122510dc042ceca5fd975（代码提交；本交接文档随后单独提交）
STAGE_CODE_SHA=cdbb329529f407f25db122510dc042ceca5fd975
BASE_SHA=95c0596796ba6b6cdde7766147229b68d3451035
WORKTREE=代码已单独提交并推送；本轮5个文档文件随后以独立提交记录来源审计、项目计划、状态与本交接，未与代码混合暂存。

## 本次范围与结论

本检查点只增加一个本地离线工具：对已保存的 HTTP body 文件做有界读取和单层 `identity`、`gzip`、`br` 或 `deflate` 解码，报告编码前后字节数与 SHA-256；`--text` 才输出严格 UTF-8 文本。输入文件和解码结果默认各不超过 6 MiB，拒绝非普通文件、超限文件、无效限制、叠加或不支持的编码及损坏数据。该工具不发 HTTP 请求、不连接数据库，也不接入 collector 或通用 fetch 路径。

独立源质量审计见[福建已保存响应来源质量回顾审计](../P3_FUJIAN_SAVED_RESPONSE_AUDIT_2026-10-07.md)。它只检查 2026-10-06 已保存的三个 gzip 响应、前一日保存结果、当前 source 配置和解析代码；不表示 2026-10-07 网站状态，也不补证 10 月 6 日 live collector 在 parser 之前的解压后 URL 精确性。

## 福建离线审计对来源工作的影响

保存的福建列表含 10 个唯一 URL，但发布日期并非严格倒序：第 7 行日期为 9 月 22 日，排在第 2 至第 6 行之后；路径日期在 4 行与列表日期不同。首屏最旧日期为 8 月 10 日，保存证据没有更早页面。保存脚本可明确导出相邻页候选 `https://fj.mof.gov.cn/gzdt/caizhengjiancha/index_1.htm`，但没有请求该 URL。未来翻页不能以“遇到首个早于 90 日的行”作为停止条件，也不能据静态 `countPage=50` 声称当前有 50 页。

两个已持久化详情中，一篇正文 1,659 字符且样本内可用；另一篇只有标题容器、状态 pending，旁边 PDF 未请求。后一篇不能计作正文通过。来源仍 `enabled=false`、全文关闭、无 pagination 配置。下一步若要验证分页，最小候选是对精确 `index_1.htm` 做一次新核准的有界只读 HTML GET，仅审查身份、列表行顺序、页间重复和最老日期；不得请求详情或 PDF。10 月 6 日单次运行核准不能复用。该 GET 需要新的 root 请求预算/核准，当前未执行。

## 本机软件验证

代码提交 `cdbb329529f407f25db122510dc042ceca5fd975` 只包含 `scripts/fiscal/p3-content-encoding.ts` 和 `tests/fiscal-p3-content-encoding.test.ts`。Node.js 为 24.16.0。最终冻结版本在新建的 loopback PostgreSQL 数据库 `fiscalhot_oct07_content_encoding_frozen_test` 执行全部 35 项迁移；`npm run typecheck` 退出 0，`npm test` 为 310/310，失败、跳过均为 0。新 decoder 测试覆盖身份/三种压缩格式、gzip 列表候选读取、畸形/截断/叠加编码、unsupported/无效限制、6 MiB 输入/输出上限，以及大文件有界读取和 CLI 失败退出。

环境通过 shell 设置 `COLLECT_ENABLED=false`、`INDEXNOW_SUBMIT_ENABLED=false`、所有 Feishu 开关 false、`JINA_BODY_FALLBACK=false`、`ALLOW_PRIVATE_NETWORK_FETCH=false`、`EMBEDDINGS_ENABLED=false`；npm test 进程的 `MODEL_CALLS_ENABLED=true` 仅用于测试各自启动的 loopback stub。真实 provider 凭证、provider base URL 和既有 credentials 目录从测试进程清除，测试框架使用不存在的 test credentials 目录；`DATABASE_URL` 在其他变量与 base URL 清理后最后设置为上述 `_test` 数据库。项目 provider 实际调用为 0。此验证没有启动应用 worker，也没有发起官方来源、附件、OCR 或外部 provider 请求。

本地 Web production build 退出 0、Web tests 15/15、loopback smoke 30/30 通过。它们运行于最终离线 CLI 文件收尾之前；收尾仅改动独立工具及其测试，Web/runtime 源码没有变化，因此未为相同 Web 内容重复构建和 smoke。另一次 full-test 尝试与 bounded-reader 最后收尾并发，随后主动中断并丢弃结果；不计为通过。上面记录的是最终文件冻结之后、全新的数据库上的完整结果。

GitHub Actions Check workflow 已对代码 SHA `cdbb329529f407f25db122510dc042ceca5fd975` 手动触发，run [37556665439](https://github.com/revercgy-hub/MYHOT/actions/runs/37556665439) 的 Check 与 Docker jobs 均成功。Check job实际执行了 typecheck、Web production build/tests15/15、fresh PostgreSQL migration/seed、built-site smoke及backend tests310项（309通过、0失败、1项Windows-only跳过）；Docker build/start/smoke job也成功。CI 只验证该代码 SHA 的软件检查，不代表真实 provider、来源质量或 Gate 结果。

## 环境与边界

开始与结束只读核对的既有 preview 是 `fiscalhot_preview_test`，数据库在 `127.0.0.1:5432`。35 migrations、3 个 source 全部 disabled 且全文关闭；3 篇人工 article 均为 `body_status=none/revision=1`、正文为空；3 条 publication 未选中且 score 为 null；`fetch_runs`、`analyses`、`receipts`、`selected_ledger`、`job_runs` 均为 0。preview SQL 用 `BEGIN TRANSACTION READ ONLY` 和 `ROLLBACK` 包围。QA 测试行只写入新的 `_test` 数据库。Web/API health 为 200，服务只通过 `127.0.0.1:3000/3001` 使用；没有 55432 listener。没有 `.env`，采集、模型与外部副作用变量名均未在当前进程环境发现。

本轮不改变 source config、数据库迁移、collector、worker 或 provider。源质量审计不补证来源准入、90 日覆盖、跨周期稳定性，也不改变 `Gate 2=NOT_PASSED`、`sourceAdmission=NOT_ADMITTED`、`coverage=unproven`。OCR 仍为 `OCR_DEFERRED_NOT_GATE2_BLOCKER`。

## 下一步

GitHub run 已完成并成功。由 P3 来源负责人准备福建 `index_1.htm` 的新单次请求包和预算申请。继续保持 source disabled、全文关闭、模型/采集/worker 关闭；未取得新核准前不访问该官方 URL。阅读本文件、[保存响应审计](../P3_FUJIAN_SAVED_RESPONSE_AUDIT_2026-10-07.md)、[10 月 6 日有限 collector 检查点](P3_SMALL_COLLECTION_CHECKPOINT_2026-10-06.md)及[来源矩阵](../SOURCE_MATRIX.md)后再接手。

## 声明

这里只记录可由提交、工具输出、只读 SQL 和已保存响应支持的事实。没有执行的分页 GET、详情/PDF、collector、OCR、模型或 Gate 操作均不视为已授权或已完成。
