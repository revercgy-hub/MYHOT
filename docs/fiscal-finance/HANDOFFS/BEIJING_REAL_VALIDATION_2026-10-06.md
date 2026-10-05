# P3 检查点交接：区域来源、安全选择保护与分页范围（2026-10-06）

STATUS=IN_PROGRESS
STAGE=P3 / Gate 2 remediation
GATE=Gate 1 PASSED；Gate 2 NOT_PASSED
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=接手者运行 `git rev-parse HEAD`；文档不引用自己的提交SHA
ROUND_BASE_SHA=437c63e61f1e5b1b7a2053a600c787bff259ab4a
CHECKPOINT_CODE_SHA=b3546ab9c803b6872eb6b82d68fab8ca87da8520
CI=GitHub Check run [37346160222](https://github.com/revercgy-hub/MYHOT/actions/runs/37346160222)，最终代码SHA success
WORKTREE=代码提交已完成；接手时用 `git status --short` 核验当前实时状态。当前阶段共享文档检查点提交后，Git应干净并与`origin/feat/fiscal-finance-hot`一致。`.data/` ignored证据不入Git。

## 当前代码和软件QA

两项代码提交形成最终测试SHA：

- `aaeab85` `feat(sources): add disabled regional bureau feeds`：河南、湖北、湖南、广东四条disabled配置，8份列表/详情synthetic fixtures、source总数断言和parser contract test。
- `b3546ab9c803b6872eb6b82d68fab8ca87da8520` `fix(selection): require confirmed bodies for automatic selection`：S4 source-specific body-ready hold、FJ strict opt-in及focused回归。

Industry JSON共有19项来源（18 HTML、1 JSON），`enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`；唯一strict body-ready opt-in为福建来源，来源仍disabled且未写入/更新任何正式数据库。无新增migration/schema/apps。

最终本机fresh数据库 `fiscalhot_oct06_final_retry_test` 完成35 migrations；Node 24 `npm test` 257/257、typecheck通过、Web build通过、Web tests 15/15通过。运行环境MODEL_CALLS_ENABLED=true只为localhost fake providers；signals对localhost fake embedding局部启用，global EMBEDDINGS_ENABLED=false；provider keys/base URLs清空，credentials目录不存在，其余真实COLLECT/JINA/FEISHU/INDEXNOW/private/OCR flags false。项目provider调用0。Preview loopback API/Web服务恢复到当前代码，API health/Web首页200，smoke 29/29；preview DB前后均为3个disabled sources/articles/publications，body为空，analyses/receipts/fetch_runs/selected_ledger/job_runs均0，无worker。最终CI Linux backend 257 tests、256 pass、0 fail、1 Windows-only skip；CI Web tests 15/15，其余检查和Docker smoke成功。CI只验证代码SHA，不是Gate 2或来源覆盖结论。

S4针对性fresh DB `fiscalhot_oct06_bodyready_final_test` 执行35 migrations，两个focused文件合计5/5通过。对strict opt-in来源，自动分析与精选释放要求body状态严格为`ok`且trim后非空；仍可见安全摘要pool/detail与hold状态，manual exact-boolean selected例外仅发布安全摘要。实现覆盖直调/队列/重试及public/export的当前source hold、实际remove游标、admin config republish边界，并保留legacy RSS summary行为。详见[operator notes](../STRICT_BODY_POLICY_OPERATOR_NOTES_2026-10-06.md)。该保护不改source业务验收结论。

## 已核销的真实来源证据

所有网络观察都由固定URL、P3 Undici 8.11.2 hard cap与报告中的manifest时间核验；本交接不新增请求。具体单源SQL/manifest/raw路径见各报告与ignored `.data/fiscal-qa/`。

- Batch5–9尝试19局，18局有工作动态列表首屏，甘肃主页超时且未跟栏目；区域四局首篇详情组的15次额外detail请求为14个HTTP200已独立核raw hash、青岛一次20秒timeout。浙江监管工作页9项列表及首篇详情另见其报告；只代表有限样本。
- 北京、福建、上海各在fresh隔离库按受限预算collector。北京10篇新增、指定一篇显式抽取后body pending→ok/revision1→2，repeat list found10/created0/revised0。首轮11个response body hash unknown，后续不得追认。福建10篇新增，9 body ok/1 pending；pending行cap1诊断为unconfirmed/non_article_container，配置body selector只有重复标题16字符，selector外邻接PDF未请求；单篇显式extract后未再次下载，首轮warning不追溯归因。上海10篇body ok；repeat list一次timeout后partial停止、未重试。各数据库均无worker、模型结果或公开选择业务副作用。
- 真实区域样本的日期冲突照实保留：云南列表/URL日9/18，详情PubDate/可见日9/24；新疆列表/PubDate/可见日9/24，URL路径日7/17。不能凭URL改写发布日期。
- Batch6四局分页probe直接读取已保存列表JavaScript推导的`index_1.htm`各一次，4/4/0 dispatch、12事件、均HTTP200精确目标。QA独立复核page1/page2 raw与SHA；每页10唯一候选、与首页0重叠。显示日期范围为广西8/11–9/7、海南8/17–9/8、重庆9/2–9/21、四川7/29–9/1；6个显示日与URL日差异，最早7/29，仍未覆盖截至10/06的90日界限7/08。详情见[probe报告](../BATCH6_PAGINATION_PROBE_2026-10-06.md)。这不是全历史或90日覆盖。

区域逐局当前映射、配置状态和分批证据见[覆盖矩阵](../REGIONAL_BUREAU_COVERAGE_MATRIX.md)及[source matrix](../SOURCE_MATRIX.md)。不要把中央选登、目录域名、page2样本、synthetic collector测试或有限body `ok`提升为source pass。

## 下一阶段：受限分页能力方案

S1裁定[scope review](../S1_WEB_LIST_PAGINATION_SCOPE_REVIEW_2026-10-06.md)批准`mof_index_v1`阶段A的离线/loopback分页能力验证，仅批准实现范围：显式source-local opt-in、页数/dispatch hard caps、固定deadline、同origin安全、跨页事务/checkpoint、失败partial/不初始化及并发保护等契约。默认web-list legacy一页行为必须保留。阶段A不得应用当前19个带详情规则的sources，不得删除detail/日期权威规则；不做实际官方请求、source导入、生产source启用或worker运行。阶段B详情分页和覆盖完成判定尚未放行。无migration/apps；无需先假定要改数据库schema。

配套[web-list gap audit](../WEB_LIST_BACKFILL_GAP_AUDIT_2026-10-06.md)、[page2 probe plan](../PAGINATION_PROBE_PLAN_2026-10-06.md)、[下一批配置准备度](../NEXT_BATCH6_CONFIG_READINESS_2026-10-06.md)和[A的分页探测计划](../PAGINATION_PROBE_PLAN_2026-10-06.md)仅是离线规划。项目provider调用0；执行参与方为Luna High agents。接手者按Root指定分工实现与focused tests；通过后对合并代码进行fresh回归与一次CI，仍不把S1批准范围等同Gate 2通过。

## 仍未完成

- Gate 2仍`NOT_PASSED`。35局目标栏目的完整范围、更多详情边界、历史/90日窗口、日期可信度、噪声率、重复更新和跨周期稳定性未闭环。
- S1阶段A实现和验证尚未开始；当前19来源不适用已批准的分页子集，不能宣称回填/90日complete。
- 北京首轮response hash unknown；上海repeat与青岛detail timeout保留partial；甘肃目标列表未观察；FJ pending诊断旁PDF未请求；云南/新疆日期差异未裁定。
- P4真实provider验证、Gold Dataset人工标注、P6/P7、Gate 4及后续部署阶段仍未完成。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：交接本轮source QA、S4代码回归与S1 web-list分页准备边界。
**MODEL**：Luna High；项目provider调用0。
**FILES_CHANGED**：本交接及对应shared QA docs；代码已在上述两个code commit。
**TESTS_RUN**：fresh full 257/257、typecheck、Web build、Web tests15/15、smoke29/29；CI run37346160222 Linux 257/256/0/1。docs-only阶段没有重跑软件检查。
**RESULT**：combined code SHA已push且CI success；当前文档提交之后重新读取HEAD并核对origin等价。Gate 2仍NOT_PASSED。
**RISKS**：sample coverage有限，真实页面超时/hash缺口和日期差异不能追认。
**BLOCKERS**：Gate 2来源级历史/时间/质量证据仍缺；S1阶段A尚未实现。
**NEXT**：按S1裁定完成离线/loopback阶段A和focused tests，不对现有19源启用分页；保留disabled/no-worker边界。另行补齐逐局来源证据，再安排Gate 2审查。
