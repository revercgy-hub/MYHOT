# S4：无附件 marker 的福建正文失败保护范围审查

## TASK

只读架构及安全范围审查；修复交 Luna High B。本审查不实现保护、不核销软件测试、不批准附件下载或来源启用。

## MODEL

Sol S4；本轮首次新增 Sol 范围审查。没有调用项目模型。

## FILES_CHANGED

仅新增本报告。未改代码、来源配置、共享文档、数据库、Git index 或安全开关。

## TESTS_RUN

未运行软件测试、worker、collector、模型、数据库操作或网络请求。只读核对：根 AGENTS/README；财政金融 PROJECT_PLAN/STATUS、用户决定、原 S1 范围裁定；两个福建新报告；现有 config、selected-body、attachment-diagnostics、extract/materials、jobs、editorial、publication、admin source update 与 seed 实现。另读取已保存的 diagnostic extract-result.json 与 post-diagnostic-review.log，不执行其中 SQL。

实测 HEAD=`437c63e61f1e5b1b7a2053a600c787bff259ab4a`。工作树19-source配置及其他人员改动不在本报告核销范围。

## RESULT

**CURRENT_IMPLEMENTATION=CHANGES_REQUIRED。MINIMAL_REPAIR_SCOPE=APPROVED_SCOPE。Gate 2=NOT_PASSED。** 现有附件 marker 保护不能覆盖本次无 marker 的失败正文；批准下述 source-specific strict-body-ready opt-in 与必要跨模块保护，不批准普遍禁止 legacy 摘要处理。

### 证据与缺口

- [福建诊断](FUJIAN_PENDING_BODY_DIAGNOSTIC_2026-10-06.md)及 ignored 原始结果记录：source=`mof-fujian-supervision-dynamics`，article=`iz0ywgmbpj535zy60telkvyac`，原文 URL=`https://fj.mof.gov.cn/gzdt/caizhengjiancha/202608/t20260817_3995605.htm`。一次 cap1 extract 返回 `unconfirmed/non_article_container`；body_text/body_html 为 null、revision=1、有效 pipeline attachment marker 缺失。9 analyze jobs与1 extract job均created，analyses/receipts/publications/selected/job_runs为0。
- 同一响应的已记录 DOM 为 `.my_doccontent` 内重复标题16字；相邻官方PDF样式链接未请求。不能由链接推断文件可解析、完整或已确定是业务正文。审查收尾时Root转交QA已核验实际excerpt为16字重复title、非空；本审查所读extract-result/post-diagnostic SQL未直接包含excerpt，因此此项归属QA实测交接，不冒充本审查自行SQL验证。可达性及本裁决不依赖excerpt为空，不能将此行称作空excerpt样本。
- [下游审计](FUJIAN_UNCONFIRMED_SELECTION_GUARD_AUDIT_2026-10-06.md)的可达性与代码一致：`jobs/content.ts` extraction callback在unconfirmed后排analyze，route只针对pending先extract；`editorial/analyze.ts#waitsForPage`只等pending。当前直接分析与process gate只认有效marker，body失败本身不拦模型。publisher可采用当前analysis.selected，public selected层与v1 ledger层只识别marker。
- `selected-body.ts` 的 selected容器验证可先返回 `non_article_container`；envelope有选中附件也在PDF请求前返回body失败。单加attachmentSelector不能让标题型容器通过正文验收。原 S1明示普通selector/空正文失败不足以认定附件失败，并故意保留普通unconfirmed和raw-null legacy对照。
- source.disabled与全安全阀false解释本次没有自动执行；它们不证明未来worker开启后的自动精选路径安全。首次collector无article ID的warning仍unknown，本次不能追认其归属。

### 最小方案及替代方案裁定

批准新增严格布尔来源配置，例如 `_aihot.requireBodyReadyForAutomaticSelection`，默认缺省/false。本轮只为上述福建监管局source设true，保留disabled及全文关闭；不重做19-source配置，不默默扩展其他来源。最终key由实现统一并记录。

对该opt-in来源，正文就绪要求 **body_status严格为ok且body_text.trim()非空**；其他状态（pending/unconfirmed/none或异常空值）不能以excerpt、标题、已有analysis、手工标题摘要、translation或模型判断替代。现有有效附件marker仍独立成立，body ok也不能绕过尚未解除的marker。此策略是来源要求完整正文的保守hold，不把普通non_article_container命名为“已确认附件失败”。

该方案直接保护已经存在的无marker失败记录，不依赖重抓、marker补写或历史诊断归属。行业配置本身无法影响jobs/editorial/publication，现有S1 helper只接受附件原因，因此**明确批准最小packages/backend改动**。使用一个实际调用的集中predicate及其publication SQL等价实现，避免各层散落不一致检查；不引入新基础架构。

diagnostic persistence可帮助运维追因，但单独增加reason日志或raw字段不能关闭自动入口，并且不覆盖已有raw-null记录。本轮不要求建立泛正文诊断schema或改附件marker reason枚举。PDF-before-container重分类则改变提取契约，仍需可靠附件关系证据；单独实施既不保护普通无marker失败，也不能为未解析PDF声称正文成功。本轮不批准重排PDF解析流程、扩大selector、whole-page扫描、下载PDF或OCR。

### 必须贯穿的行为

1. **路由与模型入口。** strict pending允许既有预算内首次extract；不直接analyze。strict unconfirmed/none/ok-but-empty进入明确等待状态，禁止自动analyze及不断extract重试。`queueProcessing`的显式step/attemptTag、extract callback及耗尽重试分支、已有queued analyze、`processArticle`与直接`analyzeArticle`都不得绕过。sweeper/requeue应跳过hold并保持准确计数，不能每轮把它选满后再空排队。等待不生成假analysis/receipt，不以needsBody引发失败页无限抓取。
2. **publisher独立保护。** publish/rebuild/republish读取实际source.config和当前article状态；即使已存在高分selected=true分析，也不自动selected，且不给自动推荐reason、不展示完整正文。原URL与原始文章保留，可沿既有合规摘要池/detail表示“正文待解析”；无需新公开字段或UI。不得制造relevance、正文或新模型输出来使其eligible。
3. **统一公开读取与历史ledger。** ITEM_COLUMNS/API_ITEM_COLUMNS、selectedCondition、列表/detail/feed/MCP所用publication层及v1 selectedSnapshot/selectedChanges都使用当前hold。部分查询只有publication别名，须用关联article/source查询；不可误用cached source字段或缺失join。旧自动selected投影被hold后，不显示selected/自动reason/full正文；snapshot不返回旧upsert；changes按既有remove语义前进cursor，保留seq/watermark分页与minimal/default字段语义。不得改写历史ledger或仅过滤事件导致客户端保留旧精选。
4. **人工例外。** 只有 `editorial_overrides.fields.selected === true` 的JSON boolean可按既有eligibility/tier/visibility/release规则人工精选；false、字符串true、仅title/summary/relevance/score override不放行。人工selected不解除body hold或attachment marker、不放行自动模型、不把正文改ok、不自动下载；reason/正文状态仍按hold显示。
5. **投影及同步边界。** 持久正文状态从可用到hold或从hold到真实ok变化时，对已有publication/selected_state用既有publisher在正确事务边界同步，撤回用新增remove，恢复仍要求当前revision的新analysis；不直接改publications.selected，不沿用旧评分自动恢复。可复用现有 `syncAttachmentDiagnosticPublication` 的实际publisher调用或最小通用同步helper，不扩大材料框架。
6. **opt-in配置变更。** `admin/sources.ts#updateSource`目前PUBLICATION_FIELDS不包含config。批准仅在此opt-in有效值改变时接入既有republish-source机制；立即public读gate挡住旧投影，随后publisher生成真正remove让已读到末尾cursor的客户端收到撤回。只把未读旧upsert映射remove不足以通知这种客户端。模型worker开启前需完成相应配置同步/republish核验，不新增scheduler。seed现为ON CONFLICT DO NOTHING，修改industry JSON不会更新已有DB source；本轮不自动改写真实隔离库或正式库，部署/导入核销应明确实际生效配置。

### 允许与禁止文件范围

允许按实际需要改 `industry/sources.json` 的该source opt-in；`packages/backend/src/sources/config-keys.ts`严格布尔校验；一个集中content guard/helper；`jobs/content.ts`、`editorial/input.ts`/`analyze.ts`；`publication/publish.ts`/`items.ts`/`v1.ts`/`detail.ts`及必要SourceFacts加载；`content/extract.ts`/`materials.ts`仅状态变化与publisher事务同步；`admin/sources.ts`仅opt-in变化的现有republish触发。允许对应focused离线/隔离测试及专属实现报告。

不批准migration、apps路由/UI/API合同扩展、正文status枚举变更、普通RSS/summary-only兼容破坏、selection门槛修改、下载/PDF/OCR/新parser、来源扩容或泛数据库回填。不按source ID硬编码通用backend分支。其他财政来源如要新增opt-in，应逐一明确其正文要求；本轮不能默认推定。

### 最关键验收

- 用本次FJ形状的fixture（unconfirmed、body空、raw无marker）及非空excerpt变体、空excerpt变体证明结果相同。strict true与false/缺省、字符串非法值、pending、none、ok-empty、ok真实非空组成小型行为矩阵；legacy raw-null unconfirmed/RSS summary-only和既有none人工预览保持原行为。
- local stub计数验证所有直接/队列入口、attemptTag、extract callback及耗尽重试、sweep/requeue，无真实provider；hold无模型请求、receipt、analysis、selected通知/group后续，pending只走既有首次extract，失败无循环。已有valid attachment marker测试继续通过。
- 先创建当前高分analysis与已发布selected/ledger，然后使其strict hold；验证publisher/rebuild、所有publication selected出口与detail/pool中的selected/reason/body模式、v1 default/minimal snapshot/changes及分页撤回，原文URL保留。
- exact人工true恢复允许精选但模型仍零；false/字符串true/只有文字override不放行。真实正文成功产生新revision，旧selected analysis不自动复活；新的合法analysis才可恢复自动selected。
- 专门覆盖source从false/缺省改true：即时读gate生效、既有republish真正追加remove，持末尾cursor的客户端收到撤回；反向变更沿现有明确配置权限处理，不破坏其他source字段republish。
- 同步状态写入与旧投影/ledger验证使用fresh `_test`库及localhost fixtures；不重抓福建，不请求附件，不碰保留真实诊断库。实现后由QA按AGENTS完成必要整体验证，本报告不代替其结果。

## RISKS

strict来源的失败HTML即使能靠RSS摘要理解，也会保守等待正文；这是明确opt-in的代价，不能推广到整个AIHOT框架。当前PDF是否可靠/业务完整仍unknown。来源配置未导入既有DB与异步republish未消费时，不能宣称客户端撤回已完成。现有软件252/252回归不能证明本新增guard，需实现后的针对性行为证据。

## BLOCKERS

现代码缺少无marker strict-body hold，实现与QA尚未完成。福建单篇仍unconfirmed，来源覆盖/跨周期/附件正文与其他Gate 2要求仍未闭环；Gate 2=NOT_PASSED。

## NEXT

Root交Luna High B按本范围实施，QA核销关键行为及必要完整回归，最后由Root决定code提交与CI。所有来源继续disabled、安全阀关闭；本审查不批准执行新网络请求、真实模型或生产数据变更。
