# P4–P7 执行与准入计划（2026-10-03）

## 当前恢复状态与可推进任务（2026-10-08）

本节是当前状态索引，覆盖并取代本文件下方编写于10月3日的旧`STATUS=`、`Gate 2 NOT_PASSED`和“12个source”判断；其余章节保留为历史记录，不回写成当时已知结论。当前branch为`feat/fiscal-finance-hot`，代码HEAD `99c3a9a3a1da91457eb2fdda81b1694d217b0511`；GitHub Check+Docker run [37744820133](https://github.com/revercgy-hub/MYHOT/actions/runs/37744820133) 对该SHA均成功。本地fresh35-migration QA亦通过typecheck、backend322/322、Web build/Web tests15/15和post-code loopback smoke30/30。正式Gate 2现为`PASSED_FOR_BOUNDED_P4_PILOT`，只限[GATE_2_REVIEW.md](GATE_2_REVIEW.md)规定的三个来源中逐篇合格文章，不是全47源准入、无人值守采集或Gate 3/4完成。当前目录47 sources、41 strict-body-ready opt-ins，均disabled且全文关闭。

### 可无付费推进

| 当前工作 | 范围和退出证据 |
|---|---|
| P4有界执行器failure-path QA | 已验证happy、output-exists、429/重复执行、活动会话拒绝及revision/hash/media/source-config/provider五个输入漂移场景；漂移场景fresh 35 migrations各1/1、0 POST。继续核验仍未覆盖的预算N+1/已有receipt组合、配置漂移、结果report最终写失败及receipt/analysis提交故障；不真实调用模型。该软件测试不能替代P4质量评估。 |
| GovCN单页候选兼容与source主线 | `govcn-policy-library`是disabled、summary-only的单页候选；已保存5条JSON列表与1条政策详情pair，focused identity/test与fresh backend/Web QA通过。仍可继续核验保守字段映射、重复/修订保存证据、适配候选是否应单独收窄；不扩大到分页或90日覆盖，不标source admitted。其它必做来源继续做保存证据审查及各自批准的最小工程补证。 |
| P4/P5准备 | 可在不调用provider的前提下复核隔离planner候选、合格负例证据、运行合同与Gold schema。正文正负例的Gold结论需领域人员人工判断；不把dry-run、selector或软件fixture说成内容质量验证。 |
| P7可复用验收准备 | 用已存在安全workflow或fresh隔离库准备测试报告；只有实际待交付代码冻结后才将typecheck/backend/Web/smoke结果绑定其SHA。GitHub `check.yml`的push触发只匹配main，feature branch可由pull request或`workflow_dispatch`运行。 |

### 当前延期与尚未完成的阶段

真实DeepSeek请求和provider额度由用户决定暂不开展，故付费执行deferred、不追问10/20；所有真实模型开关保持关闭。OCR继续按用户决定延期；NAS/production/Staging部署、真实采集和常驻worker均未启动。人工Gold标注尚未完成，Gate 3/4未通过。完整首次90日覆盖仍属于后续P7/Gate 4及P8/P9上线准备，不是已经完成的Gate 2前置；来源主线、历史窗口与长期来源质量都不得按有限样本宣布完成。

STATUS=P3 进行中；Gate 2 NOT_PASSED；本文件是准备/准入计划，不是阶段验收。
BASE_HEAD=c335c71031becab5d9e7ec1c4dab90d223decd78（计划编写时恢复的代码/文档HEAD）
PROJECT_BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c；本轮实现worktree基线 `ROUND_BASE_SHA=ea5d3af0d8241772ea6fac0abcc26386d81c6d36`。
SCOPE=与P4、P5 Agent的只读dry-run、校验器及文档准备并行；不启模型、worker、采集或新来源请求。

## 2026-10-04 当前补充

Sol对P3 Gate 2的严格首次90天发布日期窗口及附件诊断/自动精选防护给出`APPROVED_SCOPE`，只批准最小实现范围，不是Gate 2正式审查或通过。A负责日期规则、附件诊断持久化及自动分析入口；B负责出版/list/detail/v1 selected旧投影防漏。S1已提交为代码SHA `dd3835460d4f6d180209acbe0a48e4b142ea7ac0`；fresh本地全套250/250、typecheck、Web build、Web tests 15/15、重启当前构建后的loopback smoke 28/28及GitHub run 37163791233均通过。本地软件检查不代表Gate2/source通过，production source仍disabled，无新schema/migration。

福建、北京、上海首批各有一次首页/真实工作动态栏目/单篇详情的有限静态观察；北京列表日9/24与详情`PubDate` 9/30不一致，detail title另省略列表题名“财政部”前缀。详情DOM QA见[报告](REGIONAL_BUREAU_BATCH1_DETAIL_QA_2026-10-04.md)。batch2对天津、河北、山西、内蒙古及batch3对辽宁、吉林、黑龙江、山东分别各有一次首页/栏目列表结构观察、没有详情；两批预算各8/8/0且原始HTML hash经离线复核，详见[第二批](REGIONAL_BUREAU_BATCH2_2026-10-04.md)和[第三批](REGIONAL_BUREAU_BATCH3_2026-10-04.md)。厦门是既有有限配置；35局总表目前11局新增有限页面证据，另23局没有这几批的独立栏目观察；这些不构成跨周期、内容准确性或source验收。

## 当前准入判断

现有证据不支持把 Gate 2 送作“已准备通过”的正式 Sol 审查；暂不消耗正式审查轮次，也不缩减或重定义 Gate 2。若以后需要Sol审阅尚未闭环材料，只能标记为预审/缺口复核，最终Gate结论仍需完整现有标准和正式裁定。

缺口基于 [P3_GATE2_READINESS.md](P3_GATE2_READINESS.md)、[SOURCE_MATRIX.md](SOURCE_MATRIX.md)、[12源下一批核验账目](P3_GATE2_NEXT_BATCH_2026-10-03.md)及最新正文质量检查点：

- 核心和区域历史完整首页批次的实际HTTP dispatch/hop预算分别为unknown；这段历史不能追认通过。预算未知本身不是永久阻塞，后续新批次可用经验证的Undici硬上限、事件和独立快照证明来替代，但不得改写历史结果。
- 还没有覆盖真实轮询间隔、首页滑窗、正常与突发发布、失败退避/恢复的时间分散证据。重复同一URL或一天内重跑不构成跨周期稳定性证明。
- 正文质量还有真实缺口：会计司5篇`unconfirmed`、预算司1篇`unconfirmed`及8篇`pending`；失败样本仍未整体结清；厦门债205字假阳性需作为拒收负例保留；福建扫描附件机器正文未确认；已确认无实质业务事实的内部活动排除，新政策、问题发现、监管措施和调研成果纳入，地方一手内容不因传播范围有限而降优先。内容prompt已作文字更新，无真实模型评估或硬过滤器；会议/培训/领证等边界须用人工标注评估。区域五篇短文（2项接受最小业务证据、3项拒绝）只关闭这五条人工判断，其中两条详情日期unknown，同批另有224/259/296字三条未审。
- 用户已确认第一阶段必须逐一覆盖全国财政部各地方监管局的新闻动态栏目，中央选登仅作补充。35个目录/域名仍只是调查候选，并非35个feed或已验证覆盖。现有35行矩阵中，福建/北京/上海有各一篇detail观察；第二/三批8局有一次首页与栏目列表观察但无详情；厦门有既有有限独立来源配置；另23局仍无这些批次的新栏目观察。当前12个行业配置source全部`enabled=false`且站内/转发全文关闭；见[区域监管局覆盖矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)。

### 用户确认的首阶段覆盖范围

2026-10-03用户明确要求首阶段覆盖全国财政部各地方监管局的新闻动态栏目，财政部中央选登只能补充、不能算作逐局覆盖；不增加其他监管机构，也不扩展到各局全部主题栏目。此决定明确产品范围，不改变Gate 2标准，也不证明任何地方局栏目已发现、接入或通过。35个既有目录/域名需逐一映射到实际新闻栏目并核验入口、身份、日期、分页/窗口及正文质量，未核验来源仍算未覆盖。独立矩阵只基于保存的目录证据，不发新网络请求。

以下仅为现有矩阵里风险最高的候选核验子集，不代表新的Gate标准、范围裁决或URL授权。正式Gate仍由Sol按现有P3计划整体判断，不能因子集样本表现良好而将其他源/缺口视为已过。任何真实请求必须有单独明确核销；已缓存证据足以回答问题时优先离线使用。

1. `mof-accounting-notices`：优先结清固定身份正文与附件型失败的可重复处理结论；不重试9/4旧URL，也不重访已观察的July14页面。July14的两个PDF样式链接已证实处于业务附件区，因此该次`attachments_unprocessed`应保留。
2. `mof-budget-work`：针对8篇`pending`与1篇`unconfirmed`先做离线队列/正文状态核账；选择少量已有页面和列表快照说明cursor/backfill及日期/候选窗口，任何新取样另行核销。
3. `xiamen-finance-debt`、`fujian-finance-notices`：保存厦门205字假阳性及福建扫描附件为明确不支持/拒收记录，不把人工PDF复核写成机器正文成功；优先离线评估是否有已缓存可读HTML业务正文。
4. `mof-regional-supervision-dynamics` 与 `mof-xiamen-supervision-dynamics`：既有五条短文结论与未审三条按候选边界处理；福建、北京、上海2026-10-04首批页面/详情证据见[逐局矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)与[详情QA](REGIONAL_BUREAU_BATCH1_DETAIL_QA_2026-10-04.md)，仍需跨周期和其余32局栏目证据。中央汇总继续称“选登”，跨源去重unknown。
5. 如上述之外仍需代表性窗口，再由Root从其余六源矩阵中指定，不自动扩为12源全量复抓；每源都须绑定清晰问题、已有snapshot/精确URL、硬预算和停止条件。

## 阶段顺序与进入条件

| 阶段 | 可准备内容 | 正式执行/退出前条件 | 禁止的过度结论 |
|---|---|---|---|
| P4 模型精选验证 | 当前仅准备无副作用的read-only dry-run pilot工具与离线测试，验证固定ID/revision/hash选集、输入预览、配置摘要、预算预检、运行计划和“实际调用数为零”报告。 | Gate 2由Sol正式通过后另建全新隔离pilot库；只纳入正文已人工确认、固定article ID/revision/content hash的样本；没有P3遗留jobs，不启动泛worker/sweeper/requeue。真实provider身份/模型、密钥来源、预算熔断、receipt及MODEL开关由负责人确认后另行授权。先试小批并逐项复核预筛、双评分、写作、标签分类和聚类，再汇总质量问题。 | dry-run不是真实模型结果；localhost fake provider不是外部provider；HTTP/软件测试不等于内容质量；禁用source并不能隔离旧队列job。不得将样本拒绝/人工预览写成模型通过。 |
| P5 Gold Dataset | 仅准备schema validator、空模板与离线测试；与P4 dry-run数据/worker隔离。现有`industry/gold.example.jsonl`只有两条格式示例，不能当gold。 | P4发现的问题完成记录后，由领域判断者人工标注足够的正负/难例并复核来源正文；按`docs/selection.md`分development与holdout，避免同文/重复泄漏；确认split、分层、判定规则和来源边界。按计划完成评测及独立留出集检查后由Sol作正式Gate 3判断。 | validator通过只证明格式，不证明标签正确；draft样例、模型判断、旧示例都不是人工确认gold；开发集指标不能替代留出评估。 |
| P6 信源扩容 | 仅做候选机构、官方入口、栏目覆盖和可行性调查，形成候选清单及优先级。 | 需完成P5/Gate 3要求，并逐源人工核验官方列表/详情、栏目边界、日期、分页/窗口、重复、正文质量、成本/安全预算和必要性；逐源review后再由负责人批准配置。当前仍是12个已配置disabled source；**尚未调查/配置成25–35个来源**，该数字是计划中的一般信源扩容目标，不等于已完成用户确认的35个财政部地方监管局新闻栏目覆盖。用户逐局新闻栏目覆盖要求在P3/Gate 2范围内单独核验；财政部已识别的35个驻地监管局目录/域名仍只是调查入口候选，不等于35个可用feed，更不等于35个已配置、已验证或enabled来源。 | 候选目录或网站域名不能叫已调查/已配置；35局目录或allowlist不等于35个来源；不得一次性启用或按数量宣称覆盖。 |
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
