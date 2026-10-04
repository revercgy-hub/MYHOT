# S1：严格首次窗口与附件自动精选保护范围裁定（2026-10-04）

TASK=S1 最小实现范围审查；不是 Gate 2 正式审查。

MODEL=Sol61 Medium；实现交 Luna High，验证与共享文档核销交 Lead/QA。

BASE_HEAD=ea5d3af0d8241772ea6fac0abcc26386d81c6d36（本轮只读 `git rev-parse HEAD` 实测）。

DECISION=APPROVED_SCOPE / CHANGES_REQUIRED。批准下述最小跨模块实现；当前代码仍有两项缺口，不代表实现核销，更不代表 Gate 2 通过。

## 依据与当前事实

已读仓库 `AGENTS.md`、README、`PROJECT_PLAN.md`、`STATUS.md`、`GATE2_USER_DECISIONS.md`、`CONFIRMED_RULES_IMPLEMENTATION_AUDIT_2026-10-04.md`、现有架构决定，并检查真实 collect/config-keys/detail/extract/materials/jobs/analyze/publication 代码。五项用户决定已经明确，不重新询问。35 个地方监管局尚未逐项独立验证，中央选登不能替代逐局覆盖。

1. `collect.ts` 的首次 cutoff 使用三十天/月，3 月等于滚动 90 天；目前保留无日期候选。cutoff 在 detail 之前，之后 `publishedAtAuthoritative` 能清空日期，detail 也能补入或替换日期；只改前置 filter 不足以保证最终入库符合窗口。`materials.ts` 的 `decideTimeline` 还会将不可信远期日期转为 null。
2. `selected-body.ts` 已有附件拒绝原因及部分附件链接证据；`pdf-body.ts` 的通用 `PdfBodyResult` 仅返回 body/reason，丢失附件证据。`fetchDetail` 和 `extractFromUrl` 只把失败 reason 写 warning；`extractArticleBody` 持久化的仍是通用 `unconfirmed`。
3. extraction job 对 `unconfirmed` 继续排 analyze；`queueProcessing`、直接 `analyzeArticle` 与 `processArticle` 没有附件状态门禁。publisher 的 `isSelectable` 不检查附件状态，已有 analysis 亦可被 republish 重新选中。
4. `publications` 为缓存投影；`selectedCondition` 只检查可见性、selected、release。v1 selected snapshot/changes 直接读历史 ledger，不能仅改新 publisher 后声称旧 selected 出口已安全。
5. `articles.raw` 已是可空 JSONB；现有 `upsertMaterial` 的 unchanged 分支提前返回、普通 revision UPDATE 不更新 raw。因此 marker 不能仅放到新 Candidate.raw 后假定覆盖已有文章，也不能被后续 collector payload 擦掉。

## A：首次 90 天严格日期，批准行业 opt-in

批准增加 `_aihot.initialBackfillRequirePublishedAt: boolean`，默认缺省/false 完全保持 legacy 行为；行业现有 12 个 disabled source 设 true，保留 `initialBackfillMonths=3` 和 `interval_minutes=1440`。`config-keys.ts` 对新 key 做白名单及严格布尔值校验，不能以字符串 truthiness 启用。

严格规则仅作用于 `!cursor.initializedAt` 的首次导入。以一次 run 固定时点计算 rolling 90-day cutoff；最终准备入库的候选必须有有限、可信的实际发布日期且不早于 cutoff。不得用 discoveredAt、今日、URL年月或不可靠 listing date 填造日期。使用与 `decideTimeline` 一致的日期可信边界，保证入库 published_at 不被归一化为 null；不额外发明用户未确认的未来时间政策。

前置筛选只作有界候选预选；允许现有 detail budget 内补齐日期，但在 detail 完成、权威日期规则生效后、store 前必须再执行最终严格筛选。优先保留既有上限和请求预算，不为了补足 30 条扫深页、追加 detail 请求或改变分页。预算耗尽仍缺日期的候选本轮不导入；不保证首次窗口抓全。不需要为此更改后续增量、初始化语义、普通 60 条上限或 source 默认 12 月。日期变为窗外、null、Invalid Date、或者最终不可信都不得绕过最后门禁。

保留原 published_at/backfill/timeline 规则，不删除已有数据库文章，不迁移 cursor、不全库回填或改历史稿日期。仅有配置并不代表数据库 source rows 已导入，亦不代表 daily schedule 已运行。

## B：附件失败待解析，批准可区分的持久状态与自动路径门禁

批准新增一个小型 content helper，集中定义和校验附件诊断及自动门禁，避免每层各自枚举 reason。优先使用现有 `articles.raw` 的专有内部 namespace，例如 `_aihotBodyExtraction`，不增加 body_status 枚举。最小 marker shape 为：`version: 1`、`state: "pending_parse"`、`kind: "attachment"`、`reason`、`articleUrl`、`attachments: [{ url, title }]`。namespace 的最终名称由实现统一确定并在交接中列明。`body_status` 继续是 `unconfirmed`；“正文待解析”由 marker 表达，不能用原有 `pending` 状态触发无限自动重抓。

marker 写入须保留上游 raw 原值及其他 key；raw=null、object、array、scalar 均需明确保真处理。必要时在这个内部 namespace 中保存 prior raw，不能覆盖或删除来源数据。该内部标记仅由受控提取/材料入口写入及更新，不能将外部 raw 里的任意伪造字段当作解析成功或人工放行证明。保留 article.url 的真实原文入口；附件 URL 仅保存实际检测到并可规范化的 HTTP(S) 原始引用，不凭文章页 URL 拼接不存在的附件。direct PDF 的文章 URL 确为 PDF 时才可兼任真实文件入口。无可可信 URL 时 attachments=[]，不得捏造；安全下载许可仍由既有 allowlist/guardedFetch 决定，保存链接不自动允许下载。

从 selected body/PDF 结果把附件相关证据传到 `extractFromUrl` 与 `fetchDetail`，再传到 direct extraction write 及 Candidate/`upsertMaterial`。须覆盖成功详情预取、失败预取、单篇 extraction 和重复已有 identity；unchanged content hash 也必须持久化新诊断，不能因为没有正文 revision 就丢弃或漏撤旧精选。marker 持久化与撤销受影响的自动 selected 投影应有明确事务/并发一致性边界，不能仅依赖稍后 worker 最终修复。

可靠附件判据包括：显式 `pdfDirect` 解析失败；已选定附件的获取/解析/完整性失败；已配置附件 envelope 的 required/unsupported/ambiguous/unclassified 等拒绝；helper 真实返回 `attachments_unprocessed` 并带附件证据。配置错误、文章网络失败、身份不匹配、一般空正文、短正文、普通 selector 失败本身均不足以判定“附件失败”。附件与业务正文关系 unknown 时如实保留诊断，不把全页导航中的任意 PDF 说成业务附件。已配置必需附件却未能获取可靠文件证据时可记录附件要求未满足及空附件列表，不能将其当正文 ok。

所有已确认由附件要求/附件失败触发的 pending_parse 记录不进入自动 analyze/scoring/writing/grouping-selected 后续链，不进行付费模型调用；`queueProcessing`/extract callback 与 sweeper/requeue 不能反复排入 analyze。直接 `analyzeArticle`/`processArticle` 调用和已存在的 analyze job 同样检查，`attemptTag` 不是绕过该门禁的凭证。返回明确等待/跳过结果及 reason，不制造假 relevance、score、analysis 或通用失败重试循环。

publisher/rebuild 必须独立拒绝这类记录的**自动** selected，即使有旧分析 `selected=true`；reason 不继续作为精选推荐理由展示，正文模式不能变 full。允许保留原始文章、原始 URL 和合规摘要池，不把“禁自动精选”扩大为删除文章或所有出口封禁。有可展示的待解析记录时采用现有 public projection/detail 可承载的简短“正文待解析”标识；先选无需 apps/公开 schema 扩展的方案，不在产品中输出内部 reason 枚举或 raw。

人工路径保持既有语义：显式 `editorial_overrides.fields.selected=true` 可按现有 pool/source tier/visibility 条件进行人工选择；`selected=false` 永不被门禁提升为 true；只有 title/summary/relevance override 不构成附件放行。人工 selected 放行不把附件正文标为 ok、不清理待解析证据、不自动发起模型或下载。既有三条 `body_status=none` 人工预览仍 eligible=true、selected=false、score/reason=null；不能按 unconfirmed/none 或有 override 一概阻断。

只有后续可靠的完整提取成功才能原子解除这个 marker，并按既有 revision/重分析规则恢复自动资格。collector 无正文更新、普通失败、手工改标题摘要或重复 ingest 均不能擦掉 marker；附件诊断出现或解除必须让旧自动精选缓存和 ledger 状态得到一致更新，不能把旧 analysis 当成最新完整正文评分。

## C：旧 selected 路径，必须明确防漏

最小实现应把 marker 转变同步反映到 publisher/selected_state/ledger，已有自动 selected 被阻断时沿用 remove 事件；不得直接改 publications.selected 来绕过 publisher。

同时核查并覆盖 `items.ts` 的 selectedCondition、列表/详情的 selected 字段和推荐理由，以及 `v1.ts` 的 selectedSnapshot/selectedChanges；这些读路径可见旧投影或旧 upsert。批准在统一 publication 层使用同一个附件门禁的 SQL/映射进行当前状态防护，保留显式人工 selected。snapshot 不返回当前被阻断的旧 upsert；changes 不回放当前已阻断文章的旧精选 payload，应通过既有 remove 语义表达必要撤回并保持 seq/watermark/分页一致。不得改写不可变历史 ledger、改变 schemaVersion、静默跳过事件造成游标卡住或让客户端永远保留旧精选。

若实现者证明 marker 与 projection/ledger 事务更新已充分覆盖某读路径，须在 QA 中用先前 selected 的固定记录证明；不能只凭 source disabled、没有生产文章或未启动 worker省略风险。本轮不遍历或修改真实数据库已有记录。

## 允许文件与禁止扩大

允许按必要程度改：

- `industry/sources.json`（仅新增首次严格日期 opt-in；12 源继续 disabled/fulltext 关闭）。
- `packages/backend/src/sources/config-keys.ts`、`collect.ts`、`web-list.ts`。
- `packages/backend/src/content/selected-body.ts`、`pdf-body.ts`、`extract.ts`、`materials.ts`，及一个实际使用的附件诊断 helper；Candidate 复用 MaterialInput，不无故创建新抽象。
- `packages/backend/src/jobs/content.ts`、`editorial/input.ts`/`analyze.ts`（仅必要门禁与加载字段）。
- `packages/backend/src/publication/publish.ts`、`items.ts`、`v1.ts`、`detail.ts` 及现有 rules/helper 必要点；读出口仍统一从 publication 层读取。
- 现有 collection/source-rules/body extraction/analyze/publication 测试与少量固定离线 fixture，以及专属实现/QA交接文档。

不批准 migration、apps UI/API 扩展、公开合同扩展、框架重构、新调度器、OCR、附件格式新 parser、来源扩容或选择阈值变更。若现有 raw 方案确有不能可靠表示的并发/保真障碍，实现者先提交最小替代 shape/受影响读写入口、向后兼容和 rollback 说明给 Lead/S1；迁移只能追加可空列/默认安全的增量，不自改既有 CHECK、不自动迁移/删除历史数据。本次没有批准执行该替代 migration。

## 核销所需测试与证据

下面是实现后的验证要求；本审查自身没有运行软件测试、网络、数据库、worker或模型。

1. 固定时钟 collector fixture：cutoff 内/边界/外、无日期/Invalid Date/不可信远期；detail 补入有效日期、权威日期清空或换成窗外；detail budget 耗尽；首次 opt-in 排除而缺省/false保留旧行为；非首次 opt-in 仍保持增量；旧记录数量、发布日期与 cursor 不被改写。明确记录候选预选上限及无法保证抓全。
2. source config 校验：true/false 可用、字符串/数字/null拒绝；12 源 opt-in/3 月/1440/disabled/fulltext false；通用默认 12 月与其他行业行为不变。
3. 本地附件 fixture：成功 PDF、扫描/空页/parse failed、required 缺附件、unsupported XLSX、ambiguous、显式 direct PDF、attachments_unprocessed；附件链接/原文 URL 如实保留；普通身份/selector/网络失败未被整体归为附件。保存链接不增加任何下载请求。
4. marker 保真：null/object/array/scalar raw、已有 namespace、同 identity/content hash 不变、其他来源 discovery、普通无正文 revision、成功解除及相互并发；外部 raw 无法伪造解除/override。附件失败不被标题摘要更新擦除。
5. 各自动入口用 local stub/计数证明 pending_parse 无 analyze/model receipt/selected通知 job；已有 queued analyze、attemptTag、sweep/requeue亦不绕过。保留一般 unconfirmed 的 legacy处理与预算/receipt逻辑。
6. 先构造 analysis.selected=true/已公开 publication/旧 ledger upsert，再标附件待解析，证明 publisher 自动selected=false、remove一致；首页/RSS/API/MCP所用统一读取与 snapshot/changes/minimal/default/分页/水位不泄露旧 selected payload或reason。明确人工 selected=true/false、仅title覆盖以及3条none预览的回归证据。
7. 实现完按仓库规定做 fresh 隔离 `_test`/`_ci` 全量验证：typecheck、迁移、backend tests、web build/tests及可行的loopback smoke。测试provider只指向本地假服务；副作用开关保持关闭，无真实模型/官方网络请求，记录实际 SHA、计数和日志；不将配置/软件测试误写成来源运行验收。

## Lead 核销与阶段边界

Lead 先以本文批准范围派 Luna High 做实现；QA复核实际 diff、配置键和最终 marker shape、首次最终日期门禁、全部自动入口、旧selected ledger防漏、手工路径与fresh结果。超出允许文件、所需schema/apps变化或无法覆盖旧出口时返回 CHANGES_REQUIRED，不凭实现完成自判 Gate 2。

安全阀继续关闭：COLLECT/MODEL/JINA/FEISHU/INDEXNOW及既有私网保护；所有source disabled，全文本许可关闭。source disabled只是环境约束，不能作为队列/publication产品门禁的替代。保留全部付费receipt、预算熔断及未知receipt恢复规则。

完成本S1只消除两项已确认规则的实现缺口。35局独立栏目/入口/质量、跨周期及正文证据仍待既定受限验证；没有授权新网络批次、正式Gate2通过、真实P4模型、worker、P6扩容或NAS部署。共享 STATUS/PLAN/decision/index/提交由Lead/QA独占，本审查不修改它们。

FILES_CHANGED=仅本新增文档。

TESTS_RUN=只读文件与代码核查、HEAD核对；未运行软件测试/DB/网络。

RESULT=APPROVED_SCOPE；当前实现 CHANGES_REQUIRED，Gate 2 仍 NOT_PASSED。
