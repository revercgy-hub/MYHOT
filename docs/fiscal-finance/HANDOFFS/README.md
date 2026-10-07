# 阶段任务交接制度

## 最新阶段状态

最新检查点为 [2026-10-07 P3 已保存响应离线审计与内容解码](P3_CONTENT_ENCODING_CHECKPOINT_2026-10-07.md)：Gate 2 仍 `NOT_PASSED`，19 个 source 继续 disabled/全文关闭。福建保存列表有乱序日期，不能假设遇到首个 90 日外条目即可停止翻页；审计只从保存脚本导出 `index_1.htm` 候选，没有发送请求。任何后续分页 GET 都需新请求预算，10 月 6 日的一次性核准不可复用。最终代码 SHA `cdbb329529f407f25db122510dc042ceca5fd975` 为独立本地有界离线内容解码器；Node24.16.0 fresh 35-migration `npm test` 310/310、typecheck 通过。Web build/tests15/15 和 loopback smoke30/30 通过；GitHub Actions Check run [37556665439](https://github.com/revercgy-hub/MYHOT/actions/runs/37556665439) 对该 SHA 的 Check 与 Docker jobs 均成功。本结果不表示 source admission、90 日覆盖或 Gate 2 通过。审计细节、preview 不变核验、环境边界及后续 owner 见上述检查点与[福建保存响应来源质量回顾审计](../P3_FUJIAN_SAVED_RESPONSE_AUDIT_2026-10-07.md)。

当前财政金融站阶段为 **P3 进行中 / Gate 2 未通过**，Phase C source evidence preparation 为 `IN_PROGRESS`。最新用户决定记录在[OCR延后决策交接](OCR_DEFERRED_USER_DECISION_2026-10-06.md)：本地OCR监控状态为`OCR_DEFERRED_NOT_GATE2_BLOCKER`，从当前主线退出；native monitor case1失败、case2与actual OCR未运行的报告继续作为历史证据保留。下一项恢复工作为HTML/JSON/text-PDF来源准入与小规模验证。扫描附件无法可靠解析时保留原文链接、标注正文待解析、不进入自动精选；API OCR仅未来按既有provider预算与receipt按需评估，本次未启用API/模型。此前来源检查点见 [S1_PHASE_C_SOURCE_EVIDENCE_CHECKPOINT_2026-10-06.md](S1_PHASE_C_SOURCE_EVIDENCE_CHECKPOINT_2026-10-06.md)：上海仍为 `EVIDENCE_PACKET_ONLY / NOT_ADMITTED`；QA独立复核两页列表和一条详情的raw/hash、请求manifest与日期对照，没有提出来源准入；19项source仍全部disabled、全文关闭。该检查点旧tested code SHA为 `c7a027491b809f91edec42c3abeaee017e901ba9`，fresh backend 303/303、typecheck、Web build/tests15/15、loopback smoke30/30和CI run37438292607均通过。当前软件验证以本段上方的2026-10-07 P3检查点为准；这些软件测试不代表source pass、90日覆盖或Gate 2通过。区域证据与逐局矩阵见[区域覆盖矩阵](../REGIONAL_BUREAU_COVERAGE_MATRIX.md)、[来源矩阵](../SOURCE_MATRIX.md)；既有Phase A/B handoffs保留为历史记录，不覆盖。

2026-10-06 福建有限 legacy collector 单次运行已完成，状态`PARTIAL_LIMITED_SAMPLE`。3/12次GET dispatch、两条允许的文章URL写入隔离库；一条正文ok、一条pending。live listing为gzip，运行时guard未证明解压后候选在parser边界的精确校验，后续offline canary不能追溯补证。测试库cursor只代表一次运行，queue仅created且未消费；Gate 2仍`NOT_PASSED`、source `NOT_ADMITTED`、coverage `unproven`。preview前后只读计数相同。完整有限结果与hash/version限制见[P3福建小规模采集检查点](P3_SMALL_COLLECTION_CHECKPOINT_2026-10-06.md)和[请求包](../P3_NEXT_SMALL_COLLECTION_PACKET_2026-10-06.md)。

每个阶段结束时，负责人在此目录新建一份独立交接书。交接书必须能让没有本轮上下文的新会话复核状态、继续工作；不得用聊天摘要替代文件。未满足阶段退出条件时，只写检查点或未完成记录，不得写“阶段完成”，不得把任务交给下一阶段。

## 命名与职责

- 完成阶段：`P<n>_COMPLETED_HANDOFF_YYYY-MM-DD.md`；Gate 使用 `GATE_<n>_HANDOFF_YYYY-MM-DD.md`。
- 阶段中检查点：`P<n>_CHECKPOINT_YYYY-MM-DD.md`，标题和状态都写明“进行中/未完成”。
- P0、P1 已有历史完成证据时，可使用合并交接 `P0_P1_COMPLETED_HANDOFF.md`，分别写明各阶段证据和边界。
- 阶段负责人维护本阶段交接书；下一阶段负责人接手后，先阅读交接书及其链接的原始证据，再按文件所有权修改。不得覆盖其他 Agent 明确独占的文件。

## 完成阶段的通过条件

1. 对照 `docs/fiscal-finance/PROJECT_PLAN.md` 写出该阶段的退出条件，并逐项给出证据路径或可复核命令；没有通过就保留为 `IN_PROGRESS` 或 `BLOCKED`。
2. Gate 状态只引用正式 Gate 记录。不得依据源数量、候选解析、单项测试或本地预览自行宣布 Gate 通过。
3. P3 每个来源逐项记录：source ID、真实官方入口、配置/启停及全文开关、已检查列表/详情样本数、标题和日期结果、URL allowlist、分页范围、噪声/历史/重复观察、collector/数据库/正文实际验证范围、结果文件及其边界。覆盖没有证据的项目明确写“未核验”。
4. 验证记录须说明测试库/环境、命令、退出状态与实际结果，分清静态 parser 检查、preview、collector 写库、正文队列和人工内容预览；CI 必须记录其实际 tested SHA 和 workflow/run，不能把旧 SHA 的 CI 说成当前 HEAD 已通过。
5. 记录 Git 分支、交接时 HEAD、阶段代码 SHA（如与 HEAD 不同，说明原因）、基线 SHA 和工作树状态。SHA 取自 Git 命令输出，不推测未来提交 SHA。
6. 写明安全开关、运行服务/worker、数据库和数据是否改变；未查明时标成“未知”，不要推断。
7. 写清已完成、未完成、阻塞与风险；明确下一批 Agent 的建议角色、可读证据、待办范围和文件所有权。未授权的后续操作不得写成已执行。

## 必需交接字段

复制下方模板作为新文件。阶段负责人可加内容，但应保留状态、Gate、Git、证据、环境、安全、边界、下一 Agent 和未猜测声明。

```markdown
# <阶段/Gate> 交接：<完成/检查点>（YYYY-MM-DD）

STATUS=COMPLETED | IN_PROGRESS | BLOCKED
STAGE=<阶段>
GATE=<正式结果或 NOT_PASSED / NOT_ASSESSED>
BRANCH=<git branch --show-current>
HANDOFF_HEAD=<git rev-parse HEAD>
STAGE_CODE_SHA=<阶段代码SHA；若无独立代码变更，写 N/A>
BASE_SHA=<已知阶段基线>
WORKTREE=<干净 / 有未提交改动；列明文件，不推测>

## 阶段退出条件与结论
逐项列条件、结果、证据；解释为何可交接或为何仍未完成。

## 完成内容与可复核证据
路径、命令、测试环境、退出状态、摘要；区分配置、静态解析、preview、写库、正文和线上/CI证据。

## 来源逐项记录（适用于信源阶段）
每源写 ID、真实入口、enabled/fulltext、安全开关、列表/详情覆盖、标题日期、URL、分页、噪声历史重复、collector/正文验证、证据路径及限制；未核验项写明。

## 环境与安全边界
数据库/数据、服务地址、worker、网络/模型/付费调用和所有安全阀的证据。

## 未完成项、风险与阻塞
明确尚缺什么证据，影响哪个退出条件；未知事实写“未知”。

## 下一批 Agent
角色/顺序、建议任务、先读文件、可改文件、独占文件、禁止范围、完成后需交付的证据。

## 声明
没有由记录支持的事实不作猜测；本交接未提及的行为不视为已验证。
```

## 操作边界

- 阶段交接本身不会授权越 Gate 操作。遵守计划中“Gate 1 前不真实模型、Gate 2 前不大规模采集、Gate 4 前不进 NAS Production”等限制。
- 每阶段的下一 Agent 分配按当前工作比例和文件冲突安排；并行任务须标记唯一文件所有权和依赖，存在共享依赖时先完成前置阶段再交接。
- 新证据到来后追加修订记录和日期；保留历史状态，不静默改写已报告的测试范围、Gate 结果或 SHA。
- 不把目录清单当栏目验证、不把候选解析当 collector 验证、不把摘要长度当正文质量、不把本地 mock 当真实模型、不把旧 CI 当新代码验证。
