# S1：四局 disabled 配置的既有严格正文策略 opt-in 范围

**RESULT=APPROVED_SCOPE。Gate 2=NOT_PASSED；source admission=NOT_ADMITTED。** 本裁定仅批准广西、海南、重庆、四川四个新增行业来源配置使用既有严格正文就绪开关，不批准新增运行时架构或扩大来源启用范围。

## 审查依据

只读核对 `AGENTS.md`、README、财政金融 `PROJECT_PLAN.md`、2026-10-06 S4 范围报告与 operator notes，以及现有正文就绪 helper、jobs、editorial、events、publication 调用和两个 strict-body 测试文件、source-rules 配置断言。项目计划已记录用户决定：附件无法可靠解析时保留原始 URL、标注正文待解析并排除自动精选。原 S4 仅允许福建 opt-in 的限制是当时变更范围，本报告为下述四项单独扩展配置范围，不追认其他来源。

`packages/backend/src/content/body-readiness.ts` 根据来源 config 的 `_aihot.requireBodyReadyForAutomaticSelection === true` 判定；没有福建 source ID 分支。正文要求 `body_status === "ok"` 且 JavaScript trim 后文本非空。SQL helper 使用精确 JSONB 布尔值和对应空白集合；队列与公开投影从各行来源 config 读取。已有 routing/publication 测试使用合成 strict source ID，证明保护按配置生效而非福建 ID 特例。因此本次无需改 `packages/` 或 `apps/`。

## 最小批准范围

- 仅为 `mof-guangxi-supervision-dynamics`、`mof-hainan-supervision-dynamics`、`mof-chongqing-supervision-dynamics`、`mof-sichuan-supervision-dynamics` 四个新增 `industry/sources.json` 配置增加 `_aihot.requireBodyReadyForAutomaticSelection: true`。保留原福建 true，精确 opt-in 集合为上述四项加福建，共五项；其他已有来源维持原值。
- 四项继续 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`。保留既有首次三个月日期要求、1440 分钟配置，以及各 source 自己证据支持的列表/详情规则。本裁定不审定这些规则的真实来源质量。
- Luna 更新 `tests/strict-body-readiness.test.ts` 中原唯一福建断言为精确五 ID 集合，更新 `tests/source-rules.test.ts` 的来源数量及逐 source `_aihot` 期望；配合新增四局配置/parser fixture 测试。优先复用既有严格正文行为回归，不复制保护实现或创建新抽象。
- Luna 更新 `STRICT_BODY_POLICY_OPERATOR_NOTES_2026-10-06.md` 的当前批准范围/配置状态，链接本报告并保留原 S4 历史范围。注明 JSON 提交不等于已导入数据库，并将本轮测试证据与既有 S4 测试证据区分。

## 验证与限制

实现方须跑既有 `strict-body-readiness.test.ts` 和 `strict-body-readiness-publication.test.ts`，验证未就绪正文 hold、pending 仅走既有抽取路线、ready 恢复且旧分析不复活、公开精选与同步撤回、精确布尔 manual selection 例外，以及 false/absent legacy 对照。配置断言须锁定五个 opt-in ID、全部 disabled 与全文关闭，防止默默扩展。按仓库要求由 QA 完成适用软件检查。本报告未运行测试，不核销软件通过。

不批准修改 packages/apps、schema/migrations、保护语义、精选门槛、分页/source admission、正式或 preview DB、worker/scheduler、安全开关、模型/provider、OCR/附件下载或真实 HTTP。manual selection 现有例外不改变，不以此例外宣称正文 ready。本文只是配置范围批准，不是 Gate 2、来源验收、90 日覆盖或生产 rollout 批准。

**MODEL**：Sol 单次窄范围审查；实施和 QA 继续交 Luna。**FILES_CHANGED**：仅本报告。**TESTS_RUN**：无；仅静态阅读。未执行网络、DB、Git 或应用操作。
