# S1：固定35局目录内严格正文策略的配置续批规则

**RESULT=APPROVED_SCOPE；STANDING_RULE=CONDITIONAL_CONFIG_ONLY。Gate 2=NOT_PASSED；source admission=NOT_ADMITTED。** 批准本轮宁夏、青海、陕西、贵州四个 disabled 配置使用既有严格正文就绪开关；同时批准下述固定官方目录内的条件续批流程。此裁定没有扩大运行时、采集或来源验收权限。

## 审查依据与结论

只读核对 `AGENTS.md`、README、`PROJECT_PLAN.md` 的用户决定、`REGIONAL_BUREAU_COVERAGE_MATRIX.md` 的35局官方目录范围、原五源批准报告、operator notes、当前四项行业配置、`body-readiness.ts`、jobs/content 与 publication 调用，以及既有 strict-body routing/publication 测试断言。未重复全架构审查，也未运行测试。

用户已经确认逐局覆盖财政部35个地方监管局的新闻动态栏目，并确认附件无法可靠解析时保留原始链接、标注正文待解析、排除自动精选。官方目录只证明机构和域名；不能由目录直接推断栏目、配置或来源通过。既有 helper 精确读取每行 source config 的 JSON 布尔值 `_aihot.requireBodyReadyForAutomaticSelection === true`，没有福建 ID 特例。jobs 和公开投影读当前来源配置；既有行为回归使用合成 strict source ID。因此目录内符合证据条件的新增 disabled 配置启用同一保护属于配置续批，无须新增架构或每四局重复一次 Sol 审查。

本轮保存列表/详情及 raw QA 完成情况以实施方和独立 QA 的逐源报告为准；本审查不代替其字节/hash或正文质量核验，也不把父任务提供的“已验证”状态计作本报告亲自完成的 QA。

## 本轮精确批准范围

仅对以下四个已新增配置加入既有 key 的精确布尔值 `true`：

- `mof-ningxia-supervision-dynamics`（`nx.mof.gov.cn`）。
- `mof-qinghai-supervision-dynamics`（`qh.mof.gov.cn`）。
- `mof-shaanxi-supervision-dynamics`（`sx.mof.gov.cn`，陕西，不是山西 `sn.mof.gov.cn`）。
- `mof-guizhou-supervision-dynamics`（`gz.mof.gov.cn`）。

保留福建、广西、海南、重庆、四川原五项 `true`，实施后的精确 opt-in 集合为九项。四个新项继续 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`，保留现有三个月首次日期约束、1440分钟间隔和各自证据支持的列表/详情规则。当前行业配置总数27不等于27个已验收来源；本裁定也不扩大本轮列表/详情配置变更权限。

## 后续条件续批规则

仅限用户已确认、覆盖矩阵所列的固定35个财政部地方监管局；中央汇总来源、NFRA机构、其他机构、任意新增域名均不在本规则内。未来配置每次须同时满足：

1. 官方目录中的局名与域名映射明确；实际栏目、精确 URL 和列表/详情来源关系由已保存原始响应支持。目录中有域名并不足以满足此条件，不猜 URL、栏目或 selector。
2. 保存的列表与配对详情经过独立离线 QA：raw/hash、标题、日期语义及冲突、列表规则和正文 selector 都有逐源记录，配置/parser fixture 对真实保存结构形成可检查断言。未知、失败、pending、短标题容器和未解析附件如实保留；无需把失败正文包装成 ready。
3. Lead 接受该项配置证据，并与 Luna QA 更新当前精确 source-ID allowlist、配置数量/逐项断言和 operator notes；允许的集合以实际列出的 ID 为准，不能用域名通配或“35局全部自动启用”代替。
4. 来源仍 disabled、两个全文许可仍 false，既有保护语义和其他配置约束保持；只使用现成 `_aihot.requireBodyReadyForAutomaticSelection: true`。配置提交不代表既有数据库 source 行已更新。
5. 使用既有严格正文 routing/publication 回归及适用配置/parser 检查核销软件验证，按仓库要求由实施方/QA完成必要检查；报告将该轮新证据与历史测试区分。

满足以上条件的常规配置可由 Lead/Luna 继续，无需逐批再请 Sol。任一条件不满足，该 source 不得引用本规则完成 opt-in 续批；补证据或针对实际例外作最小范围审查。新 runtime、策略例外、域名/机构范围变化和保护语义调整仍须另行审查。

## 实施和验证边界

本轮 Luna 将 `tests/strict-body-readiness.test.ts` 的精确五 ID 断言更新为九 ID，并更新来源配置/数量、四源 fixture 及 operator notes。后续依条件逐项更新当前精确 allowlist；不新增运行时 source ID 分支。复用已有未就绪 hold、pending 仅抽取、ready 后恢复且旧分析不复活、当前公开投影与同步撤回、精确布尔 manual selection 例外及 false/absent legacy 对照回归。保护加强不表示附件已可解析；不因 opt-in 改动人工样本标签、筛选门槛或全栏噪声结论。

本报告不批准 packages/apps、schema/migrations、手工例外语义、source admission、Gate 2、分页/90日覆盖结论、数据库导入/编辑、worker/scheduler、安全开关、模型/provider、HTTP、附件下载或 actual OCR。人工选择保留原精确布尔例外，不使正文变 ready。真实正文为 `ok` 且 trim 后非空仍只满足软件就绪条件，不代替正文业务质量与来源验收。

**MODEL**：Sol 单次窄范围政策审查；实施和 QA 继续交 Luna。**FILES_CHANGED**：仅本文。**TESTS_RUN**：无；静态读取。未执行网络、数据库、Git或应用操作。**NEXT**：Lead/Luna完成本轮精确九 ID 配置及适用QA，后续按条件续批；来源与 Gate 状态独立保留。
