# Web-list pagination Phase B 提案：同 run 的直接 HTML 详情续跑 — 2026-10-06

## 状态

`SCOPE_APPROVED_IMPLEMENTATION_PENDING`。独立裁定 [S1_WEB_LIST_DETAIL_METADATA_SCOPE_REVIEW_2026-10-06.md](S1_WEB_LIST_DETAIL_METADATA_SCOPE_REVIEW_2026-10-06.md) 仅批准其中受限的直接 HTML title/date metadata 续做；裸 `<24h` 日期升级未获批准。此状态不授权真实来源启用、真实网络请求或覆盖完成判定。Stage A 仍是离线/loopback 能力，coverage 为 `unproven`；Gate 2 仍 `NOT_PASSED`。不得据此移除任一 source 的 detail、title/date authority、正文保护或既有配置。

## 范围建议

建议仅审查“页内候选需要权威日期/标题时，如何在有界预算内读取直接 HTML 详情并跨 run 续做”。本提案不实现 90 日完成、不设置 `initializedAt`，也不把游标从 backfill 切入增量。即使遍历到配置上限、站点报末页、返回空页或列表日期早于 cutoff，仍不能据此宣称已完整。

首个 Stage B 子集只考虑 `web_list` 的普通 HTTPS HTML 列表和文章 HTML。详情只用于现有规则要求的发布日期、标题（及其有限精度补全）；不在分页 collector 内提取正文或附件。若 source 使用 Jina、mimo/其他 adapter、PDF direct/attachment、需要跨源渲染或无法接入 shared budget 的路径，Stage B 明确拒绝该配置并保留原行为。PDF/Jina 与正文 helper 的跨模块预算暂不纳入最小阶段。

现有 `fetchDetail(url, source, need, options)` 的 options 仅有可注入 `fetcher`；普通 HTML 请求调用 `guardedFetch`，Jina 分支另调 `jinaRead`，body/attachment helper 可能再通过 `PdfFetcher` 请求 PDF。`fetchDetail` 会返回日期、标题、摘要和 body，并可让异常从调用处抛出；但 legacy collector 会在 `catch` 中把 detail 错误作为 best effort 忽略。Stage B 必须走只请求直接 HTML metadata 的显式分支，不能把这些默认吞错语义直接当作“已解析”。

## 配置提案

保留已有严格 `pagination.mode=mof_index_v1`；只在其 opt-in 对象中增加一个可选但必须显式声明的 `detailMode`：

```json
{
  "pagination": {
    "mode": "mof_index_v1",
    "maxPagesPerRun": 2,
    "maxDispatches": 12,
    "maxPageIndex": 45,
    "detailMode": "direct_html_metadata_v1"
  },
  "detail": {
    "maxFetches": 10
  }
}
```

这是 schema 示意，不是来源配置或请求授权。只有出现确切 `detailMode` 才进入 Stage B；缺省沿用 Phase A/legacy 路径。建议校验：

- kind 必须为 `web_list`；列表仍满足 `mof_index_v1` 现有 URL、HTML parser、selector、allow-prefix 和日期配置约束。不得有 adapter、Jina list URL、baseUrl 或 URL rewrite。
- `detail.maxFetches` 必须是显式有限整数 `1..10`，作为**整个 collector run 的详情文章数上限**，不能每页重置。10 取自当前行业配置的既有最大值；全局 HTTP dispatch 上限仍独立且至多 12，redirect hop 只增加 dispatch 计数，不额外增加详情文章数。
- 必须至少存在 detail `publishedAtSelector`/`publishedAtRegex` 或 `titleSelector`/`titleRegex` 中与 source authority 声明一致的规则。`publishedAtAuthoritative=true` 时必须有日期规则且详情结果缺失/无效必须阻止该 article row 完成；`titleAuthoritative=true` 时必须有标题规则且空结果不得静默回退为权威成功。
- Stage B metadata-only 不调用 `need.body`，不返回/写入 `bodyText`、`bodyHtml`、`media`、`bodyStatus`、attachment diagnostic 或 body-confirmation marker。保留 source 当前 body selector/body policy 配置供既有内容 job 使用，但 `pdfDirect`、`attachmentSelector`、`articleSelector`、`attachmentMode`、`attachmentScopeSelector` 与任何 PDF 组合在此 mode 中拒绝。Jina 与 PDF 维持原路径，等待后续单独审查。
- 所有影响列表、detail selector、date/title authority、detail 上限和 pagination 的字段继续计入 generation `configHash`。generation 活跃时任何相关配置变化都冻结为 `config_changed`，pending 行不能在新配置下自动继续或重放。

如 Sol 认为额外 `detailMode` 是冗余字段，可另裁定严格的等价显式 opt-in；实施前不能仅根据 `detail.maxFetches>0` 隐式升级旧来源。

## 同 run 预算和详情调用边界

Phase A 已有 `createWebListPaginationBudget(source, pagination)`，并共享一个 120 秒 deadline、abort signal、dispatch 计数、当前 listing page 与已派发 URL 集。`guardedFetch` 在每个 Undici dispatch 前同步调用 `beforeDispatch`；redirect 目标通过既有 SSRF/DNS 检查后再询问 `allowRedirect`。这些能力适合累计计数，但当前分页预算还把首个请求限定为当前 `webListPageUrl`，把 redirect 限定为当前列表页身份；它**现在不能直接接受文章 URL**。

若获批，最小扩展应保持 source-local，不造通用分页 framework：collector 在发详情前登记当前候选 URL；预算必须验证它仍在本 source 的 HTTPS 精确 `allowUrlPrefixes` 下、为当前 pending row 的 identity，且未被本 run 重复派发。每一个列表、详情和允许的 redirect hop 都先由现有 guarded transport 做 SSRF/DNS 校验，再经同一个 `beforeDispatch` 消耗总 dispatch；拒绝的 dispatch 不计数，实际网络失败仍计数。详情请求传入同一个 `runBudget`、signal/deadline 和剩余时间，不能在换页、详情 helper 或下一次 scheduled run 中重置本 run 预算。每次正常详情按 article identity 计入 `detail.maxFetches` 一次；其 redirect hops 增加总 dispatch，但不重复占用“详情文章数”。不加 retry，也不从其它 page 或 source 借预算。

详情 redirect 应保持 HTTPS、source allow-prefix、当前 row 的文章 identity；跨 origin、越出 allow-prefix、换成其他 article/list page、绕回本 run 已派发 URL 或超过 redirect cap，一律在下一 HTTP dispatch 前拒绝。redirect 每一跳只有在被明确允许并实际派发时才消耗预算。由于当前 list validator 要求精确单目录 allow-prefix，若某真实 article URL 不在该允许路径内，就不放宽 prefix 来迁就它。

当前 run 的 120 秒 deadline覆盖列表 fetch、详情 fetch、解析和 checkpoint；每次请求应使用不超过剩余 deadline 的 timeout。detail budget exhaustion 不能在 `fetchDetail` 或 collector 的 best-effort catch 中被吞成成功。未发出的详情记录为 pending 并在后续正常 collector run 继续；网络异常用现有 run failure/partial 表达，不新增自动 retry、job 或 worker。

`providers/receipts.ts` 的 quota 针对 paid-provider attempts，不约束普通 HTML 页面；Jina 单独通过 `paidRequest`/receipt，且当前 `jinaRead()` 不接受 run budget。因此 receipts 不能替代此 dispatch 预算，Jina 此轮不准入。

## 有界 pending page / checkpoint

详情预算可能小于当前页待处理行数。不能照 legacy `.slice()` 或“处理前 N 行后 pageIndex+1”；也不能每次重取一个会移动的 page 后只处理前 N 行，否则尾部行可能永久饥饿。建议 cursor 的 `webListBackfill` namespace 增加可选单个 `pendingPage`，复用现有 `sources.cursor` JSON，不加 migration：

```text
pendingPage = {
  pageIndex,
  fingerprint,
  candidates: [
    { identityHash, url, listTitle, listPublishedAt, state,
      resolvedTitle?, resolvedPublishedAt?, outcome? }
  ]
}
```

边界为至多 60 rows（沿用当前 page item cap）；`url` 最长 2048、title 最长 1000；timestamp 必须是 ISO/null；整份序列化快照另限 256 KiB，超限 fail closed，不截断、不前进。只允许保存直接 HTML parser 实际产生的这组候选元数据与有限的 resolver outcome；不保存 HTML/body、cookies、任意 `raw`、无界 URL 集或 provider response。当前 `fromHtml()` 为普通 HTML 列表产生 `{url,title,publishedAt}`，adapter、Markdown、Docusaurus 等不在本 mode。所有 hash 都是 SHA-256 identity hash；fetch run 只记录本 run 计数和 stop reason。

建议续跑步骤：

1. 当前 page 首次 fetch/parse/validate 后，在 reserved connection 的短事务中复核 generation/config/page index，并保存完整 `pendingPage`；在此之前不请求详情、不写 article/queue、不增加 `nextPageIndex`。重复运行若已有 pendingPage，先续该 snapshot，不重取列表页。
2. 按原 row 次序处理 snapshot。详情最多取本 run 还剩的 `detail.maxFetches`；每个已验证结果以短 cursor 事务写回该 row 的 resolved metadata，保证 crash 后不重复取已完成 row。普通列表日期可信且不需要升级的 row 可按当前 `decideTimeline()` 规则分类，不应为了凑详情数量去请求不需要的 row。
3. 若详情文章预算、总 dispatch 或 deadline到达而仍有可继续 row，保留 snapshot/resolutions，cursor 页码不变，返回 `coverage=unproven, partial=true`，沿用 `fetch_runs.status=ok` 的正常有界停止模式并明确 stopReason。后续由现有正常入口续跑；不自 enqueue、不新建 worker、不更改 retry interval。
4. 任一必需权威日期/标题无法获得、日期冲突、candidate 不合法或 snapshot 超限，当前 generation 转 `blocked`/needs-review，保留 bounded pending 以供调查；不得把有问题 row 当作已处理，也不得越页。配置变化转 `config_changed`，不得用新配置自动消费旧 snapshot。
5. 只有当该页每一行都已安全分类（在固定 cutoff 外、有效写入候选、或有明确可审计的排除类型），才在一个短页事务中 upsert 所有窗口内有效 rows、`queueProcessing(...,{db:tx})`，清除 `pendingPage`、推进 cursor，并更新 run detail。候选、queue、页 checkpoint 同事务；任何一步失败整页回滚，pending metadata 保留并可重放。继续走现有 `upsertMaterial(...,tx)`、identity、`decideTimeline()` 和 S4 queue/body-readiness 规则。

这使“尚有未处理候选”与“页面已提交”不再混淆。snapshot 只固定**一个待处理页**，不固定未来页，不证明跨页/跨 run 的栏目快照稳定。

## 日期、标题、正文安全

- 复用现有 `DetailNeed`、`fetchDetail()` selector/regex 和 UTC offset 解析，但在 Stage B wrapper 只请求 `date/title`（可选摘要需另审，不是本提案必要条件），`body=false`。不得用 URL 日期、页号、页面抓取时间填补发布日期。
- 保持 legacy authority 规则：`publishedAtAuthoritative` 时列表日期不给最终 timeline 用，详情权威日期缺失/无效即 unresolved；非权威日期仅在缺失或配置要求升级精度时 fetch。已存 source-detail title 不可被列表 title replay 回退，复用当前 `storedTitles` 保护语义；真实日期来源则应读取/保留既存已确认的日期，不能以列表重放覆盖权威结果。
- 同一天的日期精度修正可沿用现有 `<24h` detail refinement 规则；若列表与详情都提供可信日期但相差 `>=24h`，不挑一个假装一致，不写 `originalDate`、第二发布日期或新 schema 字段。标为 `date_conflict_require_review`，保持 pending/blocked，不 checkpoint 此页。最终传给 `upsertMaterial` 的只能是单一已选定的真实 `publishedAt`，让现有 `published_at_claim` 与 `decideTimeline()` 维持现有事实语义。
- 日期早于固定 `cutoffAt` 只可按经批准的可信日期排除候选；日期缺失、不可信、detail 未完成、冲突或前序 unresolved row 都不允许当作已覆盖。Stage B 依旧保持 `coverage="unproven"`，没有 `complete` 状态和 `initializedAt` 写入。
- detail metadata 不构造正文，不将 `body_status` 从 pending/unconfirmed 提升，不清理 S4 attachment/body markers。页事务仍经现有 `queueProcessing`；严格正文 hold、附件待解析 marker 和 publication gate 保持原样。后台正文 job 的 fetch/S4 状态不是这次列表/详情 run budget 的替代品，本 mode 不直接触发正文 helper。

## 当前来源证据：适用性未通过核验

本地 `industry/sources.json` 实际有 19 个 source entry，19 个均 `enabled=false`，没有任何 entry 配置 `pagination`。有 11 个 entry 显式带 `config.detail`；另有 8 个无该对象。S1 范围报告把 19 个现有 source 作为不能为 Stage A 删除 detail/权威规则的对象。两条事实均保留：显式 detail 字段的数量不能据此缩小 S1 的保护范围。当前没有 source 获得 Phase A 或 Phase B 的配置准入。

配置中已有的 direct-detail 技术形态包括：

| 现有 source IDs | 当前 detail 配置事实 | 本提案下的结论 |
|---|---|---|
| `mof-fujian-supervision-dynamics`, `mof-beijing-supervision-dynamics`, `mof-shanghai-supervision-dynamics`, `mof-henan-supervision-dynamics`, `mof-hubei-supervision-dynamics`, `mof-hunan-supervision-dynamics`, `mof-guangdong-supervision-dynamics` | `detail.maxFetches` 为 10；均有直接 selector/regex 中的日期规则与 HTML `bodySelector`，北京还声明 `titleAuthoritative`/`publishedAtAuthoritative`。 | 代码层面存在 direct HTML metadata 规则；仍无本提案所需逐源分页、排序、页稳定性和日期一致性核验，不能称为已适用或可启用。北京尤其需要缺日期/冲突 fail-closed fixture。 |
| `mof-finance-notices` | detail 有 article/body/attachment selectors。 | attachment/PDF 组合不在最小 Stage B mode，保持 legacy；不删 attachment/body 规则。 |
| `mof-accounting-notices` | detail 使用 `bodyPolicies`。 | S4/body policy 冻结；此提案不调用或改写 helper，不据此推断日期详情能力。 |
| `pboc-open-market` | `maxFetches=3`、date/body 规则；列表 URL host 是 `pbc.gov.cn`。 | `mof_index_v1` validator 当前限定单子域 `.mof.gov.cn`，本源不匹配此页码 mode，不能套用。 |
| `xiamen-finance-debt` | detail 只有 `bodySelector`。 | 未见 detail date selector/regex 或 `maxFetches`；不能把 body path 当成日期 resolver。 |

S1/BATCH6 保存的 page-2 实证是广西、海南、重庆、四川四个栏目：请求各自的 `index_1.htm`，四次 200、每页 10 个候选、均无与相邻第一页 URL 重叠，并观察到可写出 `index_<n>.htm` 的静态 pager script。四个名称/栏目均不在当前这 19 条 `industry/sources.json` entry 中；因此它们不构成上述任一已配置 source 的分页证据。报告同时记录列表日与 URL 日期多处不一致、首两页最老日期仍在目标 90 天窗内且 countPage 未遍历。不能把该样本转借给福建、北京、上海等域名相近栏目，也不能据此建立发布日期降序保证。若要选首个真实 source，须先有明确 source id、保存的本 source 页证据、列表/详情日期语义复核和单独审查；本提案不点名选用 source。

## 建议的后续实现边界与验收

若之后被 Sol 独立批准，建议限于：

- `packages/backend/src/sources/config-keys.ts`：`detailMode` 和 Stage B 组合的严格校验。
- `packages/backend/src/sources/web-list-pagination.ts`：有界 pendingPage schema/校验、pending row 状态和同 run detail target admission；不得设置完成状态。
- `packages/backend/src/sources/web-list.ts`：`fetchDetail` 增加显式 `runBudget`/受限 fetcher 入口；Stage B mode 禁止 Jina/PDF/body helper，默认/legacy options 完全不变。
- `packages/backend/src/sources/collect.ts`：将当前 page snapshot、共享 detail budget、metadata resolution 与现有 page-level transaction 对接。保留 collector 并发 advisory lock、fixed anchor/cutoff 和 config freeze。
- `tests/web-list-pagination.test.ts` 与 `tests/web-list-pagination-transport.test.ts`：纯 fixture/loopback 及 fresh `_test` DB contract。
- 无需新增 migration：`sources.cursor`、`fetch_runs.detail` 已为 JSON，状态仍限 `running/ok/failed/skipped`。不改 `packages/backend/src/content/materials.ts`、`jobs/content.ts`、receipts、PDF parser、Jina provider、S4/body-readiness、source manifest、调度和 apps。

最低 focused 契约：

1. 没有明确 `detailMode` 时 Phase A/legacy 测试和 fetch 次数完全不变；非 HTML/Jina/PDF/attachment/跨 prefix 组合在任何 dispatch 前拒绝。
2. 单 run 两页共用一个 `detail.maxFetches` counter 和一个 runBudget；详情预算每 run 只补充新 budget，page 切换不 reset。所有 list/detail/redirect dispatch 与 admission 数吻合；redirect/重复 URL/预算耗尽都在未授权下一 dispatch 前拒绝。
3. 页面大于本次 detail 额度时，cursor pending 保留完整有界 snapshot 和已解析 row；下一 run 不再抓该列表页、不重复已成功 detail、不跳过末尾 row。任何 pending 超长、重复身份、乱序 pending index 或配置变化均失败关闭。
4. authoritative date/title 缺失、detail fetch error/timeout、两个可信日期相差至少 24 小时、detail budget exhausted，都不推进页 index；网络正常但预算到顶可显式 partial 续跑，语义冲突转 blocked/needs_review。固定 anchor/cutoff 跨 run 不变。
5. fault 注入覆盖 pending snapshot 写入后、单条 resolved metadata 保存后、整页 commit 中 queue 前/后/cursor 前：未完成页不得漏行；文章、queue、page cursor 最终原子一致。已有 detail title/date replay 不被 list metadata 回退。
6. Stage B metadata-only 不写 body bytes/body status/attachment marker；`queueProcessing` 仍触发原有 S4/body-readiness hold。检查 `originalDate` 等字段不被新增，日期冲突只留下有界待审原因。
7. 所有成功运行的 run detail 保留实际 pages、detail candidates used、dispatches、pending rows、coverage=`unproven`。页 cap/maxPageIndex/countPage/empty/404 不产生 `initializedAt` 或 complete。无 migration、worker、模型、真实源请求。

## 尚未解决、不可偷渡为本阶段目标

1. 单个 pendingPage snapshot 仅防同一页在多 run 详情续做时发生漂移；它不解决首页前插、页码整体平移、跨页 move/duplicate、清理历史期间的漏项。需要另行设计 overlap reread/稳定 watermark 或保存更广覆盖状态，并用源级实证裁定 bounded 状态。
2. 日期早于 cutoff 的安全停止仍要求该 source 全局文章按最终可信日期新到旧的可复核契约、整页所有候选最终日期严格早于 cutoff、无置顶/乱序/缺日期/冲突/未处理行。列表遇见一条旧文、countPage、maxPageIndex、空响应、404 均不足以证明结束。
3. 哪个最终状态、何时在一次事务内写 `initializedAt`、如何证明完整 90 日窗口与栏目范围、完成后如何转增量、显式 reset 怎样审计，都留给未来 S1 裁定。Stage B 在这前面只提供详情续做，不宣称 coverage。
4. config_hash 变更后的 pending 数据保留、人工查看/放弃/重建 generation 的操作接口和跨 run 可变源的最终一致性都尚未定义；本提案不加 reset API。
5. `detail.maxFetches` 的既有语义是 legacy collector 内按候选详情 fetch 计数，现有校验未对其做整数/上界验证。Stage B 新 mode 需明确新增校验与 `1..10` 硬值，不得借此改变不带 pagination 的 legacy 配置行为。

## 交接

TASK=撰写最小直接 HTML metadata 详情续跑提案，仅文档
MODEL=Luna High B 子代理；没有调用项目 provider、模型、DB、worker 或外网
FILES_CHANGED=仅 `docs/fiscal-finance/WEB_LIST_PAGINATION_PHASE_B_PROPOSAL_2026-10-06.md`
TESTS_RUN=只读检查 S1、Phase A 报告、source manifest、collector、web-list detail、guardedFetch、queue/body readiness、materials、Jina/PDF/receipt 代码；未运行测试、迁移、DB 或 HTTP
RESULT=PROPOSED_NEEDS_S1_REVIEW
RISKS=阶段 A 及本提案均不证明来源通过、90 日覆盖或 Stage B 完成；现有 page-2 来源与 source manifest 不匹配
BLOCKERS=Stage B 实施须 Sol 独立裁定；需另做 source-specific 页面/日期/详情证据
NEXT=由 Sol review 本提案后决定是否再写实现范围；当前维持 Stage A offline/loopback、全来源 disabled、Gate2 NOT_PASSED
