# Web-list 首次回填分页缺口审计（2026-10-06）

## TASK

只读审阅当前 `web_list` collector、配置校验、首次 backfill/date 处理、HTTP 与付费 receipt/budget 边界及相关测试，评估滚动 90 天首次覆盖缺口并给出最小 source-specific opt-in 方案。未改实现、迁移、来源配置或测试；未访问外网、数据库或模型。

## MODEL

离线代码与已有文档审阅；无模型调用。

## 当前支持的行为

- `packages/backend/src/sources/web-list.ts` 的 `fetchListingText()` 只取 `source.config.url`。普通 HTML/Markdown 等来源发起一次列表读取，`fetchWebList()` 将这一份响应交给 parser 后返回候选；没有页码模板、next-link 或分页循环。`previewSource()` 也复用这一单页读取。每页内 parser 会去重 URL，但没有跨页状态。
- `packages/backend/src/sources/collect.ts` 将 `initialBackfillMonths` 转成滚动 cutoff（每月按 30 天），缺省为 12 个月。首轮的 `initialBackfillLimit` 缺省 30，严格日期模式在最终写入前还要求 `decideTimeline()` 得出可信日期且不早于 cutoff。详情补日期仍受 `detail.maxFetches` 独立上限约束。`MAX_ITEMS_PER_RUN=60` 是增量候选条数上限，不是网络请求或页数上限。
- `initialBackfillRequirePublishedAt` 仅改变有界的单页候选筛选，不改变读取页数。严格模式下，可信的窗外列表日期可在详情前被丢弃；若详情日期权威，则候选先进入现有详情预算，最后再依可信详情日期筛选。未解决日期、详情失败或预算未覆盖的行不会入库。这个逻辑不会因此再找下一页补足样本数。
- 当前 web-list 成功后首次运行会设置 `cursor.initializedAt`，即使严格日期筛选后没有记录；没有“首轮回填未完成/页码待续”的 cursor 状态。collector 抛错时不会推进成功 cursor，但现有 `fetch_runs` 状态只有 `running/ok/failed/skipped`，没有部分成功状态。
- `guardedFetch()` 默认每个调用最多跟 5 次重定向、响应 8 MiB、单个调用 20 秒（web-list 通常传 25 秒）。这些是单个请求的限制，不是同一 collector run 的跨页/详情累计 dispatch 上限。已批准的 P3 Undici wrapper 可在特定真实验证中统计 dispatch；生产 web-list collector 当前没有通用 run-level HTTP 请求预算。
- `providers/receipts.ts` 的配额计数服务的付费请求 attempts。Jina listing/detail 可走 Jina receipt；普通来源直连列表和 HTML detail 不经该 paid receipt budget，因此不能把 receipt budget 当成网页请求总上限。
- 对照能力：X 搜索已返回 `pages/truncated/backlog` 并在 `sources.cursor` 保存 `xBacklog`，后续运行可继续读取；这是 X 专用分页语义，不能推断 web-list 已支持或可直接照搬其 cursor 语义。

## 90 天首次覆盖缺口

现有严格模式只在已配置的那一页候选上执行 cutoff。若目标栏目首屏较新，首屏条目可能大多在 90 天内，而窗口内较早内容位于第 2 页及以后；collector 不会请求这些页面。首轮成功仍可写 `initializedAt`，使后续变成增量模式，因此未访问的历史页不会由当前首次回填自动补齐。

页面声明总页数、URL 中的年月、文章路径日期和栏目顺序均不能单独证明历史窗口覆盖完整。来源可能缺日期、日期乱序、置顶或在页面间重复；详情 authoritative 日期也可能替换列表日期。即便实现分页，只有在页序、候选排序与发布日期可信度得到来源级证明时，才可安全地在某页窗口外停止。不能承诺任一固定页数足以完整覆盖 90 天；首次回填的“最多 N 页”只能提供有界尝试。

现有 regional 批次报告记录的保存列表出现分页控件和不同 `countPage`（例如 11 至 45），但没有后续页 collector 证据。该静态观察支持存在分页差距，不证明页面序列规则、每页稳定性或近 90 天覆盖结果。

## 最小 source-specific opt-in 方案草案

以下仅是待评审契约，不是批准的字段名或实现。默认缺省必须继续单页且维持当前语义；仅显式开启的来源分页。避免把通用分页推断施加到所有行业和 RSS/legacy 来源。

1. **显式分页描述与校验。** 由 Sol 决定采用受限 URL 模板（例如配置已验证的页码参数/文件名模板）还是 selector 抽取 next link。首个实现宜选可确定性枚举的模式，支持的分页 token、起始页、递增方式、同源/allow-prefix 要求和结束规则均写入白名单校验；不接受任意脚本、表达式、完整任意 URL 或隐式页面猜测。若保存页面只证明 `index_n.htm` 模式而不证明排序/边界，应把它作为候选模板，不作为已验证契约。
2. **两个独立而明确的上界。** 配置 source-specific `maxPages`，并在 collector 一次运行范围内增加硬 `maxDispatches`（或等价的共享 request budget）。页数限制只管列表页；dispatch 限制须在每次网络派发前计数，涵盖列表页、detail 请求和可发生的重定向 hop，不能把 `detail.maxFetches`、60 候选或单次 `guardedFetch` 的 redirects/timeout 当成累计上限。触顶时在下一请求发出前停止；不隐式 retry，也不以扩大详情预算“凑足”窗口。预算计算及与既有 P3 wrapper 的生产边界需要 Sol 架构裁定。
3. **日期停止条件保持保守。** 每次 run 固定同一 `runAt` 与现有 cutoff。候选只能用被配置并核验的发布日期字段；保留 `decideTimeline()` 的可信度判断，不从 URL、抓取时间或序号制造发布日期。只有在 source-specific 证据证明页面按真实发布日期新到旧排序，且当前页用于停止判断的日期覆盖足够、可信时，才可把“本页最旧可信日期早于 cutoff”作为停止信号。若有缺失/无效日期、乱序或 detail authoritative 会改变日期而无法判定，继续到硬页数/dispatch 上限并明确标记部分结果，不能推断已覆盖 90 天。是否允许低于窗口候选/缺日期条目被纳入候选以供 detail 解析，仍遵守现有严格过滤和详情预算规则。
4. **幂等与可续跑 cursor。** 复用现有文章 identity/URL upsert 和 revision 判定；跨页候选在本 run 去重，并让重复页重放不重复创建/不回退权威 detail title/date。分页 cursor 应记录明确的 backfill generation、下一个确定页标识、固定 cutoff/runAt 以及是否完成；只有完整结束条件达成才设置 `initializedAt`/backfill complete。页请求失败或预算耗尽不得把未访问页面记为完成。Sol 需决定页数据、upsert 与 cursor 逐页原子提交的边界，崩溃后可能重放当前页但不可跳过页面；还需决定 force/调度并发如何锁定同源回填。无需预先设计新 migration：先核实 `sources.cursor` JSONB 能否承载兼容的 opt-in state，再由架构评估是否足够。
5. **可观察的失败/部分结果。** 当前 `fetch_runs` CHECK 只允许 `running/ok/failed/skipped`，run detail 可记录 JSON。最小方案可考虑把未达完整停止条件的结果写成 `failed` 并保留已成功页/cursor，再由专属 cursor 表达可恢复 partial；或由 Sol 决定兼容地加可见 partial 状态/监控。如果某页网络、解析、host/redirect 校验失败，默认 fail closed：记录准确页/错误/已处理计数，不继续猜页、不推进 complete；是否保留本轮此前已安全 upsert 的记录需在 transaction/cursor 策略中明示。不得因部分失败导致游标跳过剩余历史，也不得声称 source 通过。
6. **配置默认与 preview 隔离。** 分页字段应只影响 collector，只有独立配置显式开启才多发请求。`previewSource()` 是真实 fetch 路径，必须共享分页和累计 cap，或保持单页只读并清楚呈现它并不代表分页 collector 预览；不能绕过上限。legacy 与非 opt-in web-list 行为继续一页。

## 需要 Sol 架构裁定

- opt-in 的确切配置 schema：模板枚举还是 next-link selector；是否需要分页方向、页数 hard cap，以及怎样证明栏目页按可信发布日期排序。
- “完成”定义：已看到一页首个可靠窗外日期是否足够，还是必须到明确末页/最大页；有未知日期或 detail 权威日期时如何保守处理。任何选择都不能把 90 天完整性作为默认保证。
- run-level 总 dispatch budget 是否由 collector 注入/复用 Undici instrumentation，及它如何与 redirects、`detail.maxFetches`、Jina receipts 和每来源/整批额度计数协同。
- partial 数据提交和 cursor checkpoint 的原子性、首次初始化何时发生、部分失败状态在 admin/fetch_runs 中如何呈现、force 与定时任务并发如何避免重复推进/跳页。
- 首轮分页是否跨多个调度 run 可续读，配置变化/来源 URL 更改时如何使回填 generation 失效；preview 是否执行分页。
- 是否坚持无需迁移而扩展 JSON cursor/`fetch_runs.detail`，或某项需求确需 schema 变化。此审阅没有批准 migration。

## TESTS_RUN

只读检查 `web-list.ts`、`collect.ts`、`config-keys.ts`、`http-fetch.ts`、`providers/receipts.ts`、`jobs/sources.ts`、fetch_runs migration、source-rules/collection/sources 测试和既有 S1/Batch 6 报告；未运行软件测试、DB、网络、worker 或模型。

## RESULT

已证实当前 `web_list` 是单配置 URL、单页采集；`initialBackfillMonths=3` 是日期过滤窗口，不是翻页指令。90 天首次回填只能覆盖首屏候选中的符合条件项，且当前 cursor 会在单页 run 成功后初始化。多页方案应 source-specific opt-in、默认仍单页，并须配合累计硬 dispatch 上限、保守可信日期停止、可幂等续读的 cursor 与显式 partial 语义；方案尚需 Sol 裁定，本文不授权实现。

## RISKS

即使实现有界分页，也不保证真实栏目在给定页数/请求预算内覆盖整个 90 天窗口；非新到旧顺序、缺日期、日期冲突、置顶与后续详情权威规则均会影响停止判断。现有 per-request 8 MiB/redirect/timeout、`maxFetches` 和 paid receipts 均不构成 collector-run 全局 HTTP cap。

## BLOCKERS

无代码 blocker；后续任何实现前需先有明确架构决定与 source-specific 静态分页证据。不得据此改动来源配置或宣称真实来源覆盖通过。

## NEXT

由 Lead/Sol 定义 opt-in schema、run-level dispatch/cursor/partial 契约；获批后再单独实现与纯 fixture/loopback 测试。默认行为保持单页。
