# Phase C 恢复安全检查点（2026-10-06）

STATUS=IN_PROGRESS
STAGE=S1 Phase C evidence preparation
GATE=Gate 2 NOT_PASSED；Phase A/B的受限实现范围已分别批准，来源仍未准入，覆盖未完成
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=290f55cafe8f42289c9efb7b76a9ae5c92e6ae0a
STAGE_CODE_SHA=N/A（本轮没有代码变更；最近已测试代码仍为 b85f4e21f049571c4fc67ccb8553b8ea2f0a0b88）
BASE_SHA=290f55cafe8f42289c9efb7b76a9ae5c92e6ae0a（本轮恢复时的分支 HEAD）
WORKTREE=本轮开始时 tracked files clean；结束时本检查点、STATUS、PROJECT_PLAN为本轮文档改动；同时存在其他owner的新文档 `PHASE_C_BODY_GAP_REMEDIATION_2026-10-06.md`、`OFFLINE_OCR_VALIDATION_SCOPE_PACKET_2026-10-06.md`、`PHASE_C_FIRST_SOURCE_EVIDENCE_PACKET_2026-10-06.md`、`SHANGHAI_PAGE2_PROBE_2026-10-06.md`、`S1_OFFLINE_OCR_SINGLE_PAGE_SCOPE_REVIEW_2026-10-06.md`，不属于本交接所有权。`.data/`内安全runner、日志及既有PG配置均为Git忽略内容。

## 恢复与只读核验

- `git branch --show-current` 为 `feat/fiscal-finance-hot`；恢复前 `git rev-parse HEAD` 为 `290f55cafe8f42289c9efb7b76a9ae5c92e6ae0a`。`origin` fetch/push均为 `https://github.com/revercgy-hub/MYHOT.git`；`upstream` 指向 `KKKKhazix/AIHOT`。本轮没有修改代码、Git index或远端。
- 既有 EDB PostgreSQL 17.11 cluster `.data/test-pg/cluster` 起初停止。使用现存 `.data/test-pg/pgsql/bin/pg_ctl.exe` 恢复同一 cluster；日志显示此前非正常关闭后自动WAL恢复完成。只在该忽略目录的 `postgresql.conf` 将监听地址收紧为 `127.0.0.1`，未删除、移动、重建或改写数据目录。当前本轮进程只监听 `127.0.0.1:5432`；没有触碰55432。
- 对既有 `fiscalhot_preview_test` 执行只读事务检查：35 migrations；3 sources均disabled且站内/RSS全文均false；3 articles均 `body_status=none/revision=1`，`body_text/body_html`为空；3 publications；`analyses`、`receipts`、`fetch_runs`、`selected_ledger`、`job_runs`均为0。SQL以 `BEGIN READ ONLY` 开始并 `ROLLBACK` 结束，没有创建正式库或改业务数据。
- `.env` 不存在，指定的 `no-real-credentials` 目录不存在；当前进程环境中没有发现名字匹配provider key/token/secret/password/credential的变量。没有读取或输出任何秘密值。系统环境中存在代理变量名；变量值未读取。API/Web恢复脚本将数据库固定到上述loopback preview库，并显式设置本地运行开关，未启动worker。
- 最终监听仅有 API `127.0.0.1:3001`、Web `127.0.0.1:3000`、PostgreSQL `127.0.0.1:5432`。GET `/api/health` 为200且db=ok；Web `/`、`/all`、`/api/site/pool` 为200，预览页面带 `X-Robots-Tag: noindex, nofollow`。最后一次 `node scripts/smoke.ts --base http://127.0.0.1:3000` 完成30/30；该次只验证本机页面/API，不重跑full suite、CI或官方来源请求。

## 安全边界和证据限制

API/Web runner显式设置 `COLLECT_ENABLED=false`、`MODEL_CALLS_ENABLED=false`、`JINA_ENABLED=false`、`JINA_BODY_FALLBACK=false`、`COLLECT_SKIP_JINA=true`、`FEISHU_CONTENT_PUSH_ENABLED=false`、`FEISHU_INTERNAL_ENABLED=false`、`INDEXNOW_SUBMIT_ENABLED=false`、`OCR_RUN_ENABLED=false`、`ALLOW_PRIVATE_NETWORK_FETCH=false`、`EMBEDDINGS_ENABLED=false`；`AIHOT_CREDENTIALS_DIR`指向不存在的测试目录。未运行worker、采集、模型、OCR或外部通知。

Lead报告Phase C目前仍是证据准备：上海来源的一次受限GET由A记录在独立证据包中：page 1列出10个候选、与保存page 0无URL重叠；证据包仍为`EVIDENCE_PACKET_ONLY / NOT_ADMITTED`，尚待合并审阅。该观察没有准入来源，不改配置、preview DB或Gate状态。B-owned正文缺口文档和离线OCR范围包是并行文档，不属于本检查点；Sol对OCR范围的只读审查不等于运行授权，OCR未运行。

Phase B最近验证代码保持 `b85f4e21f049571c4fc67ccb8553b8ea2f0a0b88`；其 fresh 296/296、typecheck、Web build/tests、CI run 37412301808及既有 smoke 30/30沿用原交接记录，本轮未重复。Gate 2继续 `NOT_PASSED`，19个来源仍disabled、全文关闭；Phase C仍 `IN_PROGRESS`，未作source admission、coverage、completion、incremental或reset结论。

## 本轮文件与下一步

**TASK**：恢复并只读核验本地预览安全环境，记录Phase C证据准备现状。

**MODEL**：GPT-6 Luna High；本轮未调用项目provider/model。

**FILES_CHANGED**：本文件，以及共享 `STATUS.md`、`PROJECT_PLAN.md` 中的当前状态段。没有代码、来源配置、数据库迁移、矩阵或他人owned文档改动。

**TESTS_RUN**：未运行 `npm test`、typecheck、build或CI。服务恢复后GET health/page/pool并运行一次本地smoke，30/30通过。只读SQL见上文。

**RESULT**：本地安全预览已恢复并可复核；Phase C证据准备仍进行中，A/B来源证据材料尚待合并审阅。本checkpoint不代表阶段完成或source通过。

**RISKS**：系统代理变量名存在但未检查值；恢复服务脚本清理凭证类变量并将运行开关显式设为false，服务流量仅为loopback。来源候选观察不能替代来源专属日期/历史/正文质量审查。

**BLOCKERS**：来源证据包和S1范围裁定未完成；Gate 2仍`NOT_PASSED`。OCR执行未批准、未运行。

**NEXT**：按A/B各自文件所有权完成离线证据包，lead合并检查来源准入门槛；只在范围、证据与Git docs diff清楚后更新矩阵并另写handoff。新增请求、OCR、source opt-in、数据库改动和Gate变更均需其各自明确授权。

## 声明

只陈述本次可见命令、数据库只读查询和负责人明确传达的进度；没有由记录支持的事实不作猜测。本检查点未提及的行为不视为已验证。
