# P4–P7 执行与准入计划（2026-10-03）

STATUS=P3 进行中；Gate 2 NOT_PASSED；本文件是准备计划，不是阶段验收。
BASE_HEAD=c335c71031becab5d9e7ec1c4dab90d223decd78（计划编写时恢复的代码/文档HEAD）
SCOPE=与P4、P5 Agent的只读dry-run、校验器及文档准备并行；不启模型、worker、采集或新来源请求。

## 当前准入判断

现有证据不支持把 Gate 2 送作“已准备通过”的正式 Sol 审查；暂不消耗正式审查轮次，也不缩减或重定义 Gate 2。若以后需要Sol审阅尚未闭环材料，只能标记为预审/缺口复核，最终Gate结论仍需完整现有标准和正式裁定。

缺口基于 [P3_GATE2_READINESS.md](P3_GATE2_READINESS.md)、[SOURCE_MATRIX.md](SOURCE_MATRIX.md)、[12源下一批核验账目](P3_GATE2_NEXT_BATCH_2026-10-03.md)及最新正文质量检查点：

- 核心和区域历史完整首页批次的实际HTTP dispatch/hop预算分别为unknown；这段历史不能追认通过。预算未知本身不是永久阻塞，后续新批次可用经验证的Undici硬上限、事件和独立快照证明来替代，但不得改写历史结果。
- 还没有覆盖真实轮询间隔、首页滑窗、正常与突发发布、失败退避/恢复的时间分散证据。重复同一URL或一天内重跑不构成跨周期稳定性证明。
- 正文质量还有真实缺口：预算司候选中8篇`pending`、6篇`unconfirmed`；会计司既有失败样本仍未整体结清；厦门债205字假阳性需作为拒收负例保留；福建扫描附件机器正文未确认；领证等栏目噪声需明确处理。此次区域五篇短正文（2项接受最小业务证据、3项拒绝）只关闭该五条的人工判断，其中两条详情日期unknown，同批另有224/259/296字三条未审。
- 财政部监管局汇总页为选登入口，不能声称覆盖全国35局全量；厦门独立源也只是代表性地方源。当前矩阵有12个配置源，全部`enabled=false`且站内/转发全文关闭。

### 提交Sol Gate 2审查前可整理的核验子集

以下仅为现有矩阵里风险最高的候选核验子集，不代表新的Gate标准、范围裁决或URL授权。正式Gate仍由Sol按现有P3计划整体判断，不能因子集样本表现良好而将其他源/缺口视为已过。任何真实请求必须有单独明确核销；已缓存证据足以回答问题时优先离线使用。

1. `mof-accounting-notices`：优先结清固定身份正文与附件型失败的可重复处理结论；不重试9/4旧URL，也不重访已观察的July14页面。July14的两个PDF样式链接已证实处于业务附件区，因此该次`attachments_unprocessed`应保留。
2. `mof-budget-work`：针对8篇pending与6篇unconfirmed先做离线队列/正文状态核账；选择少量已有页面和列表快照说明cursor/backfill及日期/候选窗口，任何新取样另行核销。
3. `xiamen-finance-debt`、`fujian-finance-notices`：保存厦门205字假阳性及福建扫描附件为明确不支持/拒收记录，不把人工PDF复核写成机器正文成功；优先离线评估是否有已缓存可读HTML业务正文。
4. `mof-regional-supervision-dynamics` 与 `mof-xiamen-supervision-dynamics`：既有五条短文结论与未审三条按候选边界处理；配合未来时距足够的首页观察，检验窗口变化。中央汇总继续称“选登”，跨源去重unknown。
5. 如上述之外仍需代表性窗口，再由Root从其余九源矩阵中指定，不自动扩为12源全量复抓；每源都须绑定清晰问题、已有snapshot/精确URL、硬预算和停止条件。

## 阶段顺序与进入条件

| 阶段 | 可准备内容 | 正式执行/退出前条件 | 禁止的过度结论 |
|---|---|---|---|
| P4 模型精选验证 | 当前仅准备无副作用的read-only dry-run pilot工具与离线测试，验证固定ID/revision/hash选集、输入预览、配置摘要、预算预检、运行计划和“实际调用数为零”报告。 | Gate 2由Sol正式通过后另建全新隔离pilot库；只纳入正文已人工确认、固定article ID/revision/content hash的样本；没有P3遗留jobs，不启动泛worker/sweeper/requeue。真实provider身份/模型、密钥来源、预算熔断、receipt及MODEL开关由负责人确认后另行授权。先试小批并逐项复核预筛、双评分、写作、标签分类和聚类，再汇总质量问题。 | dry-run不是真实模型结果；localhost fake provider不是外部provider；HTTP/软件测试不等于内容质量；禁用source并不能隔离旧队列job。不得将样本拒绝/人工预览写成模型通过。 |
| P5 Gold Dataset | 仅准备schema validator、空模板与离线测试；与P4 dry-run数据/worker隔离。现有`industry/gold.example.jsonl`只有两条格式示例，不能当gold。 | P4发现的问题完成记录后，由领域判断者人工标注足够的正负/难例并复核来源正文；按`docs/selection.md`分development与holdout，避免同文/重复泄漏；确认split、分层、判定规则和来源边界。按计划完成评测及独立留出集检查后由Sol作正式Gate 3判断。 | validator通过只证明格式，不证明标签正确；draft样例、模型判断、旧示例都不是人工确认gold；开发集指标不能替代留出评估。 |
| P6 信源扩容 | 仅做候选机构、官方入口、栏目覆盖和可行性调查，形成候选清单及优先级。 | 需完成P5/Gate 3要求，并逐源人工核验官方列表/详情、栏目边界、日期、分页/窗口、重复、正文质量、成本/安全预算和必要性；逐源review后再由负责人批准配置。当前仍是12个已配置disabled source；**尚未调查/配置成25–35个来源**，该数字是计划目标，不是当前状态。财政部已识别的35个驻地监管局目录/域名只是机构入口或allowlist候选，不等于35个可用feed，更不等于35个已配置、已验证或enabled来源。 | 候选目录或网站域名不能叫已调查/已配置；35局目录或allowlist不等于35个来源；不得一次性启用或按数量宣称覆盖。 |
| P7 本地验收 | 复用仓库既有命令，不另建重复验收harness；当前CI绿色只覆盖具体tested SHA的软件检查。 | P4–P6实现冻结后，对实际待交付代码SHA做新鲜本地验证：空隔离`_test`库35 migrations，`npm run typecheck`、`npm test`、`npm run build -w @aihot/web`、`node --test apps/web/tests/*.test.ts`；启动实际loopback preview，检查页面并运行`node scripts/smoke.ts --base http://localhost:3000`。复核启动配置、安全开关、DB状态、进程/worker边界；逐项给出日志、exit status和SHA。若生产要依赖PDF正文，按P3裁定最迟在P7/Gate 4验证Linux兼容性。之后由Sol正式审查Gate 4。 | 当前CI green不等于完整P7，不等于项目Gate 4；历史CI不验证当前HEAD；预览通过不验证真实provider、真实来源覆盖、NAS资源隔离或生产恢复。 |

## P4真实provider缺口与安全要求

恢复核验只读检查了配置是否存在，没有读取或展示key值：仓库没有`.env`；本轮QA shell的`MODEL_CALLS_ENABLED`未设置，`LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`均不存在。`.env.example`列有DeepSeek兼容端点模板及其他provider示例，但它不是实际部署配置，也没有可用凭据。故目前没有可核验的真实provider配置/密钥，P4真实模型调用尚不可执行；此前localhost测试stub只用于软件测试，不代表provider连通、模型身份、token成本或调用回执。

Gate 2通过前保持模型真实开关关闭。Gate通过后仍需由负责人在不向聊天/日志输出secret的方式下配置和核验provider endpoint/model/key存在性、支持能力、预算限制与receipt路径；先对固定、正文确认的最小样本做批准范围的调用，记录逻辑请求、计数、成本、失败及输出校验。没有明确授权不打开`MODEL_CALLS_ENABLED`，不启worker，不向外部provider发送资料。所有付费调用继续经过项目预算与receipt实现。

## 当前运行与来源边界

本轮QA shell的`MODEL_CALLS_ENABLED`实际为**未设置**，不是显式false；`.env`不存在，`LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`均未设置。当前API/Web/PostgreSQL preview分别只监听`127.0.0.1:3001/3000/5432`，preview数据库以只读SQL核对；未发现应用worker。已有preview由专用启动脚本启动，启动时安全开关值见对应运行证据；这些证据不等于当前shell所有开关显式false。本轮没有启用新worker、不写preview DB、不触网。环境变化后应重新实测，不凭本文件推断未来状态。P4/P5 Agent只可在各自owner范围准备dry-run/validator测试与报告；来源/行业配置、正文、seed和production安全开关不属于准备代码的权限。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：规划Gate 2至Gate 4的准入和阶段退出条件，并提供正式Gate 2审查输入与P4 provider缺口。

**MODEL**：Luna High。

**FILES_CHANGED**：新增本文；未修改行业源配置、应用/后端运行代码、数据库、测试数据或环境变量。

**TESTS_RUN**：只读检查`AGENTS.md`、README、customize/sources/selection/deploy、`PROJECT_PLAN.md`、`STATUS.md`、P3 readiness/source matrix/next-batch、gold示例与`eval-selection`；核对git HEAD/状态、`.env`与provider环境变量存在性，并按进程名/脚本命令匹配确认无本仓库应用worker/API/Web进程。未运行任何模型、采集、worker或新网络请求。

**RESULT**：Gate 2不具备提交正式通过审查的证据；当前可先补齐现有P3缺口，再由Root安排Sol正式判定。P4真实provider尚未配置。P6的25–35来源仍是未来目标；P7/Gate 4须做针对完整待交付状态的新验收。

**RISKS**：环境flag在QA shell中未设置，项目config默认值可能不是关闭；本轮仅因`.env`缺失且无应用进程而未观察到当前调用。没有依据声称所有机器环境flag都显式false。配置检查只是本机当前时点的存在性观察；不验证任何真实provider凭据有效性/余额。既有source批次与正文结论的范围限制见链接报告，不能由此计划扩大。

**BLOCKERS**：Gate 2仍NOT_PASSED；无真实provider env配置/凭据；尚无人工确认的完整gold集；P6扩源和P7验收未执行。

**NEXT**：P4/P5 Agent在获准文件范围完成只读dry-run/validator准备；QA按AGENTS做fresh隔离回归；由Root先审P3未满足项并安排正式Sol Gate 2裁定。通过前保持所有运行安全阀关闭。之后记录新的交接点，不回填未执行阶段为完成。
