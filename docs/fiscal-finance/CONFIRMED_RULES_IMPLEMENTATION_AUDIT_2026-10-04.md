# 已确认规则实施审计（2026-10-04）

## TASK

落实当前已确认的每日检查目标和首次近 90 天回填配置，并审计附件正文失败后的自动精选链路。仅改行业信源配置；不启动采集或处理任务。

## MODEL

Luna High。未调用项目模型或任何 provider。

## FILES_CHANGED

- `industry/sources.json`：只调整已有 12 个信源的 `interval_minutes` 为 `1440`，并在每个 source 的 `_aihot` 配置中设 `initialBackfillMonths: 3`。未增加信源、未改 `enabled`、`site_fulltext` 或 `syndicate_fulltext`。
- `docs/fiscal-finance/CONFIRMED_RULES_IMPLEMENTATION_AUDIT_2026-10-04.md`：本审计。

未改 packages、apps、数据库、Git index 或其他 agent 正在修改的文件。

## TESTS_RUN

- 纯本地 JSON 断言：12 个既有来源各自 `interval_minutes=1440`、`initialBackfillMonths=3`、`enabled=false`、两个全文开关均为 `false`；通过。
- `npm run typecheck`：通过。
- `git diff --check -- industry/sources.json`：通过。
- 未运行 collector、worker、HTTP、数据库读写或真实模型任务。

## RESULT

现有 `_aihot.initialBackfillMonths` 已列入每类 collector 的配置白名单；`collectSource` 仅在 `!source.cursor?.initializedAt` 时读取此值，以 `Date.now() - months * 30 * 86400000` 作为首次回填 cutoff。因此 `3` 对有发布日期的条目表示滚动 90 天。非首次运行不再执行该 cutoff，而是沿用既有 cursor 并对普通列表每轮限制最多 60 条；这一行业值不会裁掉之后的增量。来源配置的 `interval_minutes` 上限允许 1440，正常成功检查会用该间隔更新 `next_fetch_at`。

这只是行业配置，不代表运行中的数据库来源记录已更新或每日调度已启用。12 个源仍全部 `enabled=false`；本轮没有写数据库，也没有触发调度。导入配置后才会把这些值应用于对应数据库 source 行。失败重试仍走现有 collector 策略（常规失败退避上限 360 分钟，预算阻断 15 分钟）；用户没有指定失败策略，本轮未更改。

首次回填有一个严格边界：collector 的过滤条件保留 `publishedAt` 缺失的候选（`!c.publishedAt || c.publishedAt >= cutoff`）。所以本次行业配置将有日期条目的首次回填收敛到 90 天，但不保证所有入库条目都能证明在 90 天内。若规则要求严格仅收有日期且在窗口内的候选，建议由 Root 通过一次 S1 批准最小 opt-in 改动：增加一个经配置校验的 `_aihot` 布尔选项，只对启用该项的行业 source 在首次导入时排除无发布日期条目；保持其他行业旧行为、后续增量和现有数据库数据不变，并用 collector 测试覆盖窗口内、窗口外、缺日期及首次/后续运行。此审计未改通用 collector。

### 附件失败与自动精选现状

- `packages/backend/src/content/extract.ts` 在选定正文提取失败时将文章标为通用 `body_status='unconfirmed'`；失败原因只以结构化 warning 记录。这里没有证据表明系统把“不支持附件”判定为“附件不必要”。目前文章字段也没有区分“附件待解析”的独立状态或附件原始 URL 字段；文章的 URL 仍是文章页 URL。
- `packages/backend/src/jobs/content.ts` 的抽取 job 在返回 `unconfirmed` 后仍排入 analyze。`packages/backend/src/editorial/analyze.ts` 的页面等待条件只针对 `pending`，不会因 `unconfirmed` 阻断；分析输入会使用已有 excerpt（无 excerpt 时仍可读标题）。`processArticle` 随后调用 `publishArticle`。
- `packages/backend/src/publication/publish.ts` 的自动精选判定通过 pool eligibility、模型 `selected` 结果和 source tier；`body_status` 只用于计算正文展示模式，不构成精选阻断条件。来源全文开关关闭时会以摘要正文模式存储，但这并不阻止选中或发布摘要卡片。

因此已确认的产品规则“业务附件无法可靠解析时保留原始 URL、标正文待解析、不进入自动精选”**尚未在此自动处理链中实现**。本轮没有自动精选任何记录，也没有改动那 3 个样本或手工 override/预览路径。建议 Root 对最小跨模块边界做 S1：需要从正文解析结果可靠地区分附件失败、持久保留附件原链接并明确待解析状态，同时让该状态阻断自动精选/发布；显式人工预览或 override 不应被这一自动 gate 错误阻断。不要把通用 `unconfirmed` 一概视为附件失败，也不要把 `unconfirmed` 解释成附件不重要。未获 S1 前不改 apps/packages、不发布、不下载附件或执行 OCR。

## RISKS

- `initialBackfillMonths=3` 对已知发布日期按 30 天月实现为 90 天；缺少发布日期的条目仍可能进入首次回填，需 Root 决定是否要求严格日期证明。
- JSON 中的 1440 分钟只有在配置导入相应 source rows 且来源之后启用时才会运行；本轮保留全部 disabled，不能据此声称每日抓取已经运行或验证。
- 附件待解析及自动精选阻断是已确认但尚未实现的产品规则；当前 `unconfirmed` 流程仍可走分析和精选，须先由 Root 核销 S1 最小边界。

## BLOCKERS

- 不阻塞行业 JSON 配置交由 QA 审核。
- 若需“严格 90 天”（不接纳无发布日期候选）或实现附件待解析/不自动精选，需 Root 的 S1 范围裁决；本轮不自行扩大到通用 packages/apps。

## NEXT

由 QA 对行业 JSON 配置、typecheck 与报告进行复核；Git index 和提交由 QA 独占。Root 决定是否为严格 90 天和附件失败自动保护分别核销最小 S1。Gate 2、来源覆盖、模型验证及真实生产调度状态均不因本报告改变。
