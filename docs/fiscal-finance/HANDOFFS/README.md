# 阶段任务交接制度

## 最新阶段状态

当前财政金融站阶段为 **P3 进行中 / Gate 2 未通过**；P4/P5仍仅有准备，未运行真实模型或人工Gold评测。最新状态见 [2026-10-04 Gate 2 remediation checkpoint](GATE2_REMEDIATION_2026-10-04.md)：S1代码SHA `dd3835460d4f6d180209acbe0a48e4b142ea7ac0` 已提交，fresh本地完整测试250/250、typecheck、Web build、Web tests 15/15、重启当前构建后的loopback smoke 28/28，以及GitHub run 37163791233均通过。软件绿不代表Gate 2通过、来源配置已运行或P4准入。区域观察的最新汇总与矩阵见[逐局矩阵](../REGIONAL_BUREAU_COVERAGE_MATRIX.md)；三局详情和配置准备见[批次1详情QA](../REGIONAL_BUREAU_BATCH1_DETAIL_QA_2026-10-04.md)、[批次1配置准备审阅](../REGIONAL_BUREAU_BATCH1_CONFIG_READINESS_2026-10-04.md)，批次2/3只有首页及栏目列表观察、没有详情，见[batch 2](../REGIONAL_BUREAU_BATCH2_2026-10-04.md)和[batch 3](../REGIONAL_BUREAU_BATCH3_2026-10-04.md)。下一项工程任务是建立三局disabled配置和saved-fixture测试，集成验证北京detail metadata更新后下次extract使用新identity；未完成前不称source ready/pass。后续P4/P7准入见[P4–P7执行计划](../P4_P7_EXECUTION_PLAN.md)。此前P3正文质量检查点、诊断检查点和各S1旧报告均保留为历史，不覆盖。

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
