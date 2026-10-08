# 阶段任务交接制度

## 最新阶段状态

最新来源/QA交接是[2026-10-08连续P3恢复检查点](CONTINUOUS_P3_HANDOFF_2026-10-07.md)，当前代码SHA `edd0644ddcdee42de03eb21ad4704108f08000a5`、46来源/40 strict IDs、fresh 35-migration全套QA及同SHA CI run37709884742通过。正式Gate状态由[2026-10-08 Gate 2审查](../GATE_2_REVIEW.md)确定为`PASSED_FOR_BOUNDED_P4_PILOT`，仅限三个source中逐篇合格的固定小样；不等于46源准入、35局持续运行或无人值守采集。厦门财债`xiamen-finance-debt`仍`NOT_ADMITTED`。详见[STATUS](../STATUS.md)、[连续P3交接](CONTINUOUS_P3_HANDOFF_2026-10-07.md)和[正式review](../GATE_2_REVIEW.md)。

最新检查点为[2026-10-07新四局配置与QA](NEXT_BUREAU_CHECKPOINT_2026-10-07.md)：配置SHA `e3791c2744c285c7967cb1c6597da3187817889b` 本机fresh full QA通过但CI run37573322451保留OCR deadline分类失败；获准的最小确定性维护SHA `d4fd46ded57cd899793e819a3b49ff8bf6e72e4f` 后续fresh backend QA及CI run [37574033213](https://github.com/revercgy-hub/MYHOT/actions/runs/37574033213) 均通过。checkpoint区分宁夏/青海page2双成功GET与后来一次宁夏首页超时尝试。Gate 2仍 `NOT_PASSED`，不代表来源准入或90日覆盖。

最新交接为 [2026-10-07 P3 加速恢复检查点](ACCELERATED_P3_CHECKPOINT_2026-10-07.md)：Gate 2 仍 `NOT_PASSED`。它逐项汇总现有六维退出条件及未结证据；用户确认的 35 局逐一新闻动态栏目仍是覆盖范围，中央选登只能补充。未把有限核心源样本或软件测试解释为 Gate 通过。来源请求、启用或运行目标仍须各自遵守原有核准与安全边界。

本检查点承接的最近技术/来源证据仍见 [2026-10-07 P3 已保存响应离线审计与内容解码](P3_CONTENT_ENCODING_CHECKPOINT_2026-10-07.md)：19 个 source 继续 disabled/全文关闭。福建保存列表日期乱序，保存脚本导出 `index_1.htm` 候选但没有发送请求；任何分页 GET 都需新预算，10 月 6 日一次性核准不可复用。代码 SHA `cdbb329529f407f25db122510dc042ceca5fd975` 为本地有界离线内容解码器；Node24.16.0 fresh 35-migration `npm test` 310/310、typecheck 通过。Web build/tests15/15、loopback smoke30/30 及 GitHub Actions run [37556665439](https://github.com/revercgy-hub/MYHOT/actions/runs/37556665439) 均只说明该代码 SHA 的软件验证，不代表 source admission、90 日覆盖或 Gate 2 通过。审计细节见该检查点及[福建保存响应来源质量回顾审计](../P3_FUJIAN_SAVED_RESPONSE_AUDIT_2026-10-07.md)。

2026-10-07 后续经独立核验，福建 `index_1.htm`、`index_2.htm`、`index_3.htm` 三次请求均为核准的一次性精确 GET，raw/hash 与 manifest 相符；四页逐页共 40 个列表候选、无 URL 或可见日期重复，但日期顺序非单调，90 天范围仍未证明覆盖完整。详情、collector/DB、worker、模型和 OCR 均未运行。逐页日期、分页、请求和 QA 边界见[福建分页观察报告](../P3_PAGINATION_OBSERVATION_2026-10-07.md)及[加速恢复检查点](ACCELERATED_P3_CHECKPOINT_2026-10-07.md)。

当前项目状态为P3来源主线继续、Gate 2仅通过上述有界P4 pilot门槛；Phase C source evidence preparation继续进行。最新用户决定记录在[OCR延后决策交接](OCR_DEFERRED_USER_DECISION_2026-10-06.md)：本地OCR监控状态为`OCR_DEFERRED_NOT_GATE2_BLOCKER`，从当前主线退出；native monitor case1失败、case2与actual OCR未运行的报告继续作为历史证据保留。扫描附件无法可靠解析时保留原文链接、标注正文待解析、不进入自动精选；API OCR仅未来按既有provider预算与receipt按需评估。此前来源检查点及其当时未通过的Gate状态均作为历史保留，不覆盖为当前结论。区域证据与逐局矩阵见[区域覆盖矩阵](../REGIONAL_BUREAU_COVERAGE_MATRIX.md)、[来源矩阵](../SOURCE_MATRIX.md)；既有Phase A/B handoffs保留为历史记录，不覆盖。

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


最新代码 SHA fbccb32a611a963981bf95a84dd00865837f0a88（23个 disabled source，五个严格正文opt-in）本机fresh Node24 35-migration backend310/310、typecheck及Web检查通过；GitHub Check+Docker run[37564353711](https://github.com/revercgy-hub/MYHOT/actions/runs/37564353711)成功，Linux backend 309通过/0失败/1 Windows-only skip。前一 SHA 的两项OCR monitor timing CI failure、最小测试正确性修复和完整QA历史见[加速恢复检查点](ACCELERATED_P3_CHECKPOINT_2026-10-07.md)。Gate 2仍NOT_PASSED，source admission仍未批准。

最新交接为[2026-10-07 连续 P3 配置与验证](CONTINUOUS_P3_HANDOFF_2026-10-07.md)：代码SHA `2e2a021ae5a5eaa614a758724480dc8b266f33e3`含46项disabled/fulltext-off source（45 HTML、1 JSON）和精确28个strict body-ready opt-ins；fresh 35-migration本地全套QA通过，GitHub Check+Docker run[37611936804](https://github.com/revercgy-hub/MYHOT/actions/runs/37611936804)成功。有限列表/详情配对和软件测试不证明来源准入、90日覆盖或Gate 2；Gate 2仍`NOT_PASSED`。后续独立source evidence与门槛按状态页、来源矩阵及Gate 2清单继续。
