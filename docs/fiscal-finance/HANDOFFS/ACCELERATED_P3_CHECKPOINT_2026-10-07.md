# P3 加速恢复检查点（进行中，2026-10-07）

STATUS=IN_PROGRESS
STAGE=P3 source evidence / Gate 2 remediation
GATE=Gate 1 PASSED；Gate 2 NOT_PASSED；来源仍未准入
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=f7c2075382537a96206964ef4196f0666c248967（本检查点开始时实读；文档未提交）
PRIOR_CI_CODE_SHA=cdbb329529f407f25db122510dc042ceca5fd975（本轮之前最近的CI成功代码 SHA）
CURRENT_CODE_SHA=fbccb32a611a963981bf95a84dd00865837f0a88（四局配置提交 `1a3598de60ef52ff882f5b7b511902e737e801b0`、测试夹具提交 `ac07d923300d5ed36256bd4e6e1d541575a59bb4`、监控时限测试维护提交；已推送）
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKTREE=开始检查时干净；本检查点、STATUS 和 HANDOFFS/README 的本轮文档修改尚未提交。共享工作区后续状态以实时 Git 查询为准。

## 恢复结论与范围

本文件将现有 P3/Gate 2 退出条件汇总成可继续执行的清单，不改变正式 Gate、来源准入标准或用户范围。用户已确认首阶段逐一覆盖全国财政部地方监管局各自的新闻动态栏目；财政部中央选登只作补充。现有文档没有依据把这个要求降为一组“核心局”子集：35 个目录机构是待逐项验证的范围，不是已经完成的来源。Gate 2 正式结论仍为 `NOT_PASSED`；只有正式授权的 Gate 2 审查可以更改该结论。

最新已保存响应证据见[福建离线来源审计](../P3_FUJIAN_SAVED_RESPONSE_AUDIT_2026-10-07.md)和[内容编码检查点](P3_CONTENT_ENCODING_CHECKPOINT_2026-10-07.md)。福建保存首屏日期乱序，最早显示日为 2026-08-10；保存脚本指出 `index_1.htm` 候选，但该页未请求。两篇详情中一篇可读，一篇仅有标题容器、正文仍 pending，附近 PDF 未请求。此证据不足以说明 90 日历史覆盖、分页边界或来源准入；不能凭首个旧日期停止翻页。最近代码 SHA `cdbb329...` 的离线解码器测试与 CI 只验证软件，不改变来源状态。

2026-10-07 后续取得 root 对福建 `index_1.htm` 单 GET 及顺序 `index_2.htm`、`index_3.htm` 各一次 GET 的单独核准。独立 QA 重算三份 raw 的字节数/hash、核请求和 response manifest，并用相同列表选择器独立解析四页保存 HTML；40 行 title/URL/日期与 manifest 一致，40 个 URL 唯一、没有页间可见日期重复。每页日期行序均非单调，列表日/路径日不一致数为 4/3/5/2。以 2026-10-07 为观测日、含 2026-07-09 为 90 日窗口起点，四页窗口内候选为 10/8/2/0；第三页样本全部早于边界。四页日期区间有部分交叠，但实际逐条日期没有交集。页面脚本声明 `countPage=50` 不证明其余页面有效或覆盖完整。没有请求详情/附件或执行 collector、数据库写入、worker、模型或 OCR；所有来源仍 disabled。完整请求和逐页结果见[分页观察报告](../P3_PAGINATION_OBSERVATION_2026-10-07.md)，raw/manifest 在 ignored `.data/fiscal-qa/oct07-accelerate-pagination/`。

## Gate 2 剩余退出条件

下表按既有[六项核对清单](../GATE2_ACTION_CHECKLIST.md)、[项目计划](../PROJECT_PLAN.md)和[验收清单](../ACCEPTANCE.md)整理。状态区分有限样本、未核验和待审查；单条详情、parser/fixture 测试或代码测试均不替代来源级证据。

| 维度 | 已有证据（边界） | 仍需满足的退出条件 | 主要可复核记录 |
|---|---|---|---|
| G2-A1 来源与候选身份 | 35 局目录、若干实际栏目与有限详情已在矩阵逐局登记；当前配置有 23 项（22 HTML、1 JSON），全部 disabled 且全文关闭。五个地方局动态配置使用严格正文就绪 opt-in。部分局有 raw、manifest、受限 collector 或详情证据。 | 对用户要求的 35 个地方局逐一确认真实新闻动态入口；对每源核对列表、详情身份、可信日期、正文边界及 host/path allowlist。未知、超时和日期冲突保留为未结。 | [逐局矩阵](../REGIONAL_BUREAU_COVERAGE_MATRIX.md)、[来源矩阵](../SOURCE_MATRIX.md)、[六项清单](../GATE2_ACTION_CHECKLIST.md) |
| G2-A2 首页窗口、栏目与历史 | 多数已观察栏目只有一个时点/单页；Batch6 的广西、海南、重庆、四川第二页各 10 条无首页 URL 重叠，最早显示日 2026-07-29；四川第三页样本到 2026-07-01。福建现有四页共 40 条候选，无 URL/逐条日期重叠，但日期顺序非单调，第三页已早于 90 日边界；只看声明的 50 页数不足。 | 逐源记录可证明的窗口与分页/历史边界；有日期乱序时不能按首个旧日期停止。为用户确认的首次近 90 天目标提供覆盖证据，明确无入口或未知；分页 GET 必须使用新的核准预算。 | [Batch6 分页观察](../BATCH6_PAGINATION_PROBE_2026-10-06.md)、[四川 page3](../SICHUAN_HISTORY_PAGE3_PROBE_2026-10-06.md)、[福建分页观察](../P3_PAGINATION_OBSERVATION_2026-10-07.md) |
| G2-A3 新鲜度、失败恢复与轮询 | 配置目标为每日检查，但来源 disabled，配置未导入运行数据库；既有手工间隔复查只是两个时点，不是 scheduler 运行。失败退避、恢复及滑窗变化仍未知。 | 依照已确认的 daily 检查目标，取得可审的实际轮询/更新与失败恢复证据；不得把 JSON 间隔或单次/两次人工 GET 写成运行通过。任何启用或运行必须先有对应授权与范围。 | [六项清单 G2-A3](../GATE2_ACTION_CHECKLIST.md)、[项目状态](../STATUS.md) |
| G2-A4 日期、一致性、去重与幂等 | 个别固定 URL 有重复抓取/幂等证据；北京、云南、新疆等保留列表日、URL 日或详情日期差异；未实际交叉的样本不能证明跨源去重。 | 对来源级样本确认日期语义和一致性；已有重复样本核验 revision/no-op；只在出现相同事件候选时验证跨源去重。零重叠或字段不明继续标 `unknown`。 | [六项清单 G2-A4](../GATE2_ACTION_CHECKLIST.md)、[逐局矩阵](../REGIONAL_BUREAU_COVERAGE_MATRIX.md)、[来源矩阵](../SOURCE_MATRIX.md) |
| G2-A5 正文质量、内容边界与附件退化 | 北京/福建/上海受限 collector 及多局单篇详情已提供正负样本；福建有 title-only pending 负例。用户规则要求无法可靠解析的业务附件保留 URL、标待解析、不自动精选；FJ source-specific 保护已有软件测试。OCR 已明确延后，不是 Gate 2 blocker。 | 逐源积累足以判断财政业务事实与噪声的正文样本；机器提取、人工转录分开。附件失败状态及自动精选边界按已确认规则可审；不能将人工转录称作机器正文成功。 | [六项清单 G2-A5](../GATE2_ACTION_CHECKLIST.md)、[FJ pending 诊断](../FUJIAN_PENDING_BODY_DIAGNOSTIC_2026-10-06.md)、[OCR 延后决定](OCR_DEFERRED_USER_DECISION_2026-10-06.md) |
| G2-A6 有界执行与审计账目 | 多个新批次有 dispatch cap、manifest/raw/hash 和隔离库 SQL；历史未知仍保留。北京首轮 response hash unknown，上海重复列表 timeout，青岛详情 timeout；这些不是已通过样本。 | 每个新批准批次可核 cap、exact URL/host、dispatch/响应或失败、DB 前后状态与队列边界。旧 unknown 不追认；预算触顶、超时或异常后保留 partial 并停止。 | 各批次报告、manifest 和隔离库记录见[逐局矩阵](../REGIONAL_BUREAU_COVERAGE_MATRIX.md)及[六项清单 G2-A6](../GATE2_ACTION_CHECKLIST.md) |

## 当前已知状态与历史证据解释

- 35 局首阶段目标来自已确认的用户范围；中央选登不替代逐局栏目。并非要求为所有局的所有主题栏目建源，但每个地方局目标新闻动态栏目都在范围内。当前矩阵中未核实的入口或栏目仍是缺口。
- 上一个已测试代码 SHA `cdbb329...` 包含 19 项 source 配置；四局配置增量已提交为 `1a3598de60ef52ff882f5b7b511902e737e801b0`；当前为23项（22 HTML、1 JSON），包含五个 strict body-ready opt-in：福建、广西、海南、重庆、四川。全部 `enabled=false`，站内与转发全文均关闭；配置数量不等于准入数量。
- 2026-10-07 四次全新35-migration DB回归过程均保留：前两次在 OCR monitor 合成时限断言上各309/310，细节见历史测试日志；经 root 批准的最小运行时正确性维护仅调整启动时刻锚点和过期分类边界，并恢复原始立即采样回归fixture（无 cap 放宽、skip、实际 OCR）；focused OCR 文件37/37。来源配置及维护冻结后的最终 `fiscalhot_oct07_accelerated_final2_test` 与 `fiscalhot_oct07_accelerated_maintenance_test` 均执行35 migrations、Node24.16 `npm run typecheck` exit0、`npm test` 310/310 exit0。最终代码 SHA `fbccb32a611a963981bf95a84dd00865837f0a88` 已推送。Web build exit0、Web tests15/15、loopback smoke所有路由与MCP initialize检查通过；维护只涉及脚本和测试文件。前一 SHA `ac07d92...` 的 GitHub run [37563773669](https://github.com/revercgy-hub/MYHOT/actions/runs/37563773669) 为 overall failure：Docker job成功；Check中的typecheck、Web build、Web tests、migrate/seed、built-site smoke通过；Linux backend 307通过、2条OCR监控时限测试失败、1个Windows-only skip。修正后最终SHA的 GitHub Check+Docker run [37564353711](https://github.com/revercgy-hub/MYHOT/actions/runs/37564353711) 成功；Check与Docker均通过，Linux backend 310项中309通过、0失败、1 Windows-only skip，Web tests15/15。此前失败记录保留，不把旧SHA结果套用到当前SHA。所有 stdout/stderr 在 ignored `.data/test-pg/oct07_accelerated_*`。
- 按用户决定，首次回填目标是近 90 天，历史保留原发布日期；daily 检查目标已确认。现有配置值仍未导入运行数据库，来源也未启用，所以不能声称已执行这些目标。
- 原始来源细节按 2026-10-07 最新版本读取；较早的 P3 handoffs 是历史证据，不被本文件覆盖。逐局已做页面/详情、当前缺口与失败边界以矩阵及所链接批次报告为准。

## Git、环境与安全边界

本轮开始时 `git status --short --branch` 为 `feat/fiscal-finance-hot...origin/feat/fiscal-finance-hot`，工作树干净；`git log -10` 顶端为文档提交 `f7c2075`，完整 HEAD 为本文件头部记录。此后来源配置、测试夹具和最小时限维护三项提交已推送，最新SHA见文件头；本检查点/STATUS/矩阵更新仍待文档提交。最终本机fresh回归310/310和typecheck通过，Web检查通过；旧SHA `ac07d92` 的CI失败已由最小维护提交处理，最终SHA `fbccb32...` 的run 37564353711 Check与Docker均成功。我的本地执行只读 Git/文档/manifest/raw检查；上述三次HTTP GET为Root授权的来源批次，非本次读取产生。测试操作仅创建全新隔离测试数据库并应用迁移；没有运行 collector、实际 OCR、worker、真实模型或外部 provider。

现有检查点记录 preview 为 loopback 服务、source disabled、全文关闭且无分析/回执/job 记录；本轮没有重新连接或核验，故不把历史 preview 快照写成本轮实时状态。任何未在当前证据中查明的进程、安全开关或数据库状态均为未知。新来源请求、启用、导入、模型或工作队列执行均不是本检查点的授权内容。

## 下一位来源负责人 / QA

先读本交接、[Gate 2 六项清单](../GATE2_ACTION_CHECKLIST.md)、[用户决定](../GATE2_USER_DECISIONS.md)、[逐局覆盖矩阵](../REGIONAL_BUREAU_COVERAGE_MATRIX.md)、[来源矩阵](../SOURCE_MATRIX.md)以及目标批次报告。来源负责人继续填补所有 35 局对应栏目所缺的页面/历史/正文证据，并在任何新 HTTP 前按既有程序取得具体 host/path 与 dispatch budget 审批；不批量运行 collector、不开 source、不启 worker/model。QA 独立核对新批次 manifest/raw/hash、候选身份与报告结论，明确新旧证据差异及来源边界。文档所有权：本检查点、`HANDOFFS/README.md` 与 `STATUS.md` 由当前 handoff owner 更新；来源专项报告由其指定 owner 维护；避免覆盖他人 owned evidence。

## 声明

Gate 2 保持 `NOT_PASSED`，没有宣布任何新来源准入。本文未用代码通过替代来源证据，没有扩大请求预算，也未把未核实字段补成事实。
