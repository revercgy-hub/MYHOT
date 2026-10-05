# S1 Web-list 分页最小范围裁定 — 2026-10-06

## TASK / MODEL / RESULT

TASK=S1 source-specific 首次回填分页架构审查；只审查、裁定，不实现。
MODEL=GPT6.1SolMedium；未调用项目 provider、模型或 OCR。
RESULT=APPROVED_SCOPE（仅下述阶段 A 的有界、可恢复列表遍历）；阶段 B 的详情分页与覆盖完成判定为 CHANGES_REQUIRED，未放行。
GATE2=NOT_PASSED；这是新的 S1 架构问题，不是 Gate 2 验收。

该分步裁定允许先完成可测的安全基础，不允许把阶段 A 描述为“90 天回填已完成”。**阶段 A 仅用于离线/loopback 能力验证，暂不应用现有 19 个有必要 detail 规则的 source；不得为启用它删除 detail、清除日期/标题权威规则或降低正文保护。**全部 sources、collect、model、OCR、push 开关继续关闭，不导入正式来源表，不运行 worker，不进入 NAS Production，不授权新增真实请求。用户 Gold 阈值、现有失败重试/调度策略不变。S4 正文就绪保护已冻结，本报告不重复审查或修改它；Lead 提供的 257/257 本地结果以及最终 combined SHA `b3546ab9c803b6872eb6b82d68fab8ca87da8520` / CI `37346160222` success（257 项、256 pass、1 Windows-only skip）仅作为交接信息，不是本报告重新执行的验证。

## 代码证据及边界

已读 AGENTS.md、README.md、docs/sources.md、docs/deploy.md、PROJECT_PLAN.md、STATUS.md、WEB_LIST_BACKFILL_GAP_AUDIT_2026-10-06.md、PAGINATION_PROBE_PLAN_2026-10-06.md，并只读检查实际 web-list、collect、config-keys、types、http-fetch、admin/sources、db、jobs/sources、jobs/content、jobs/queue、content/materials、fetch_runs migration 和相关测试。

- `fetchListingText()` 固定读取 `config.url`；`fetchWebList()` 返回一个页面的候选，无分页游标。Jina、mimo adapter 的网络路径不同，不能仅包住初始列表请求便声称全 run 有 cap。
- `collectSource()` 单页成功后设置 `initializedAt`；`initialBackfillMonths=3` 是 90×24 小时过滤窗口，不是页面覆盖。首轮 limit 默认 30、增量 limit 60 都不能作为网络额度或历史完成条件。
- 列表/detail 的 `guardedFetch()` 单次 redirects、timeout、bytes 限制不是累计额度；paid receipt 也不限制普通网页 dispatch。detail best-effort catch 会吞错误，因此未来启用 detail 时不能靠预算异常冒泡证明安全或覆盖。
- `sources.cursor` 和 `fetch_runs.detail` 已是 JSON；fetch_runs 状态限制为 running/ok/failed/skipped，无需新增 partial 枚举或 migration。
- `upsertMaterial(m, db)` 与 `queueProcessing(id, {db})` 已可接收事务；queue enqueue 已支持事务内写入。因此不需要改正文保护、materials 或队列算法来实现页原子 checkpoint。
- `jobs/sources` localConcurrency=8 不能串行化同源；force 与直接 collector 调用也必须受同一个 guard。

另读 A 的 `BATCH6_PAGINATION_PROBE_2026-10-06.md`：四个 page 2 返回 200、各 10 个候选、无 page 1 重叠，支持该四局目录下 `index_1.htm` 的编号公式。该报告记录 6 项列表日/URL 日差异，最老列表日仍在目标 90 天内。Lead 后续告知 QA 已独立核 page2 raw hash/event/candidates 通过；本审查未亲自核 raw，不把该 QA 升级为全局排序证明、日期权威证明或来源通过。北京、福建、上海等没有相同已保存分页证据的来源不能套用此公式。

## 阶段 A：批准的最小可测实现

### 1. 精确 opt-in schema；默认 legacy 不变

只在 `web_list.config` 增加下述严格对象；缺省保持现有 single-page 路径和初始化行为。其他 kind、null/array、未知键、非整数、字符串数字、非有限值均拒绝。阶段 A 不接受 next-link、任意 template、表达式、JS 执行或隐式猜页。

```json
{
  "pagination": {
    "mode": "mof_index_v1",
    "maxPagesPerRun": 2,
    "maxDispatches": 4,
    "maxPageIndex": 45
  }
}
```

- 三个额度字段必须显式提供；`maxPagesPerRun` 为 1..2、`maxDispatches` 为 1..12、`maxPageIndex` 为 1..100。代码硬上界拒绝超额，不静默 clamp；例值是 schema 展示，不是任何真实源请求授权。maxPageIndex 是最大允许的零基页编号，含该页，不是末页声明。
- `mode` 只认 `mof_index_v1`：page 0 是精确 `source.config.url`；page n≥1 是该目录下 `index_n.htm`。url 必须 HTTPS、无认证信息/query/hash、路径以 `/` 结尾，host 须为显式 MOF 局域名形状（单个局子域 `.mof.gov.cn`）。每个实际源仍须有自己的保存证据和人工核验；域名形状只限制技术范围，不证明来源质量。
- 只允许直接 HTML：parseMode 缺省或 html，须有显式 item/link/title/date selector 或现有 date regex；不接受 adapter、Jina URL、Markdown、Docusaurus、跨源 baseUrl 或 item URL rewrite。页面自身及编号分页 URL 不能成为 article 候选。
- 必须 `_aihot.initialBackfillRequirePublishedAt=true`，现有 months/limit 使用有限正数校验且保持原值。本行业 months=3 仍为固定 90 日；不改其他来源缺省。
- **阶段 A 不执行 detail**：`detail.maxFetches` 仅可缺省/0；`publishedAtAuthoritative=true` 或其他必须依赖详情才能解释列表日期的规则拒绝此 opt-in 组合。可以保留以后正文 job 所需的已有 selector 配置，但分页 collector 不调用其 body/helper/PDF/Jina 路径，也不提高正文确认状态。真实源列表日期可信度未解决前，不批准对该源使用这个最小子集。
- 阶段 A 仅支持未 initialized 的首次 backfill。已有 initializedAt 的来源新增 pagination 时返回显式 needs_review/config_changed，保留已有 cursor 与文章，不能自动清 initializedAt 或悄悄切回 legacy。

### 2. 全 run pre-dispatch 预算

在 `guardedFetch` 传入可选、局部 run-budget 对象；缺省无对象的旧调用不改变。预算须在每次 `undiciFetch` 派发之前同步检查/扣除，不使用响应后计数或仅 diagnostics 的事后统计。先完成 URL/SSRF 校验，随后 consume，再 dispatch；拒绝请求无 dispatch。取消、超时、网络失败的实际派发同样消耗额度。

同 run 所有列表请求和每个 redirect hop 共享同一对象，不因翻页/异常/helper 新建额度。page cap 与 dispatch cap 独立。阶段 A detail dispatch 为零；阶段 B 若不能把所有 detail/attachment/redirect 调用接入同对象，则不允许启用详情分页。不能借 paid receipt 代替这个对象，不改 receipt 规则。

分页列表重定向必须仍在同 HTTPS origin、精确已允许的列表目录内，经现有 SSRF/DNS guard 后才派发；目标改变页身份或绕回已访问页须拒绝。不新增 fallback/retry，不从失败局挪额度。保留现有 per-request bytes/timeout，并给分页 run 固定 120 秒总 deadline（网络、解析、checkpoint），逐请求剩余 deadline 不重置；到期下一 dispatch 前拒绝，取消在途读取。可选 run signal/budget 不影响 legacy。未完整读取/解析的响应不能 checkpoint。

### 3. 保守停止：阶段 A 永远不宣称 complete

每个 generation 固定 anchorAt 与 cutoffAt，后续 run 不滚动 cutoff；可信发布时间仍用现有 `decideTimeline()`，不从 URL、页序或抓取时间造日期。物料 discovery 时间保持实际发现时间，所有首次回填仍明确 `backfill=first-import`，保留原发布日期。

阶段 A **不实现任何日期完成停止**。页 cap/dispatch cap 是可续跑 partial；达到 maxPageIndex、空页、重复页、404、pager 变化、无法判断日期等为 blocked/needs_review，不设置 initializedAt。少数旧日期、整页最旧日期、站点 countPage 都不构成完成。只有后续阶段 B 获批的终止契约才可 complete。

页内每个有效 article row 必须完整处理或明确分类；不得先 `.slice(limit)` 后跳到下一页。本最小子集只接收一整页候选数不超过 `min(initialBackfillLimit,60)` 的页面；若本 run 剩余候选额度不够整页，则保留当前页未处理，partial 后退出。单页超过额度直接 blocked，不能跳页或无界扩限。缺失/不可信日期的有效 article row 保留该页为 needs_review，不把它当窗口外；可确认的窗外项可排除，但不用于 complete。导航/噪声分类与缺日期分类须区分。

跨页按现有 identity 去重、幂等 upsert；保留已有 detail 标题和权威日期保护，不因重放列表回退。页指纹（归一化 identity 序列）至少比较前一个已提交页；重复整页/无新 identity 的页停为 needs_review，不无界翻页。窗口内个别重复文章正常去重。

### 4. JSON cursor / 原子 checkpoint / 并发

只新增命名空间，不覆盖 RSS/X 或其他 cursor 键：

```text
cursor.webListBackfill = {
  v:1, generationId, configHash, anchorAt, cutoffAt,
  nextPageIndex, pagesCommitted, lastPageFingerprint,
  state:"active"|"blocked"|"config_changed",
  coverage:"unproven", stopReason, updatedAt
}
```

generation 创建先持久化，避免首个请求失败后 cutoff 每轮漂移；nextPageIndex 初始为 0。不要将 complete、initializedAt、90-day covered 写入阶段 A。JSON 不存 raw HTML、正文、无限 URL set 或日期猜测。跨 run 页面可能移动，因此阶段 A 只证明遍历过的样本，不能据稳定页码声称没有漏项。

每页先在事务外 fetch/parse/验证，然后一个短事务内：`SELECT source FOR UPDATE` → 重核 configHash、generation 和期望 nextPage → `upsertMaterial(...,tx)` → `queueProcessing(...,{db:tx})` → 写 cursor nextPage+1 与本 run 累计计数/detail。所有候选与 checkpoint 同 commit；中间异常全部 rollback。以前成功页已提交不回滚，失败页下次从同一页重放。队列与文章一起提交，不因 crash 后 upsert 为 unchanged 而漏掉 enqueue。无需修改 materials、jobs/content 或正文保护代码，只在 collector 使用现有事务参数。

分页 run 使用专属 reserved DB connection 上 session advisory try-lock，稳定 key 含 sourceId；所有分页 collector 入口（force、job、direct）先 lock，再重新 loadSource。碰撞可保守串行化，不能漏锁。锁失败返回 skipped/concurrent，无网络/无 cursor 推进。finally unlock 后 release；进程退出连接关闭释放锁。网络阶段不持有 source row lock/长事务；页 checkpoint 事务用同一个 reserved connection。已安装 postgres 类型明确支持 reserve/ReservedSql.begin/release，可复用，不新增锁表/迁移。generation/config mismatch 必须在 commit 前拒绝，不能用仅 pg-boss singleton 或进程内 mutex 代替跨进程 guard。

### 5. partial 与现有 fetch_runs 状态兼容

正常有界读取并成功 checkpoint 的 run 使用 `status=ok`，但 detail 必须显式包含：

```text
detail.webListBackfill = {
  v:1, generationId, coverage:"unproven", partial:true,
  stopReason, nextPageIndex, pagesFetched, pagesCommitted,
  dispatchesUsed, maxDispatches, created, revised,
  rowsUndated, rowsOutsideWindow
}
```

这是“本 run 成功、回填仍 partial”，沿用 X 的 ok+truncated 模式；不是完成。达到配置 safety cap 且无法继续、日期/配置冲突、重复/无效页用 `failed` + 同一 detail + 精确 error，保留此前页 checkpoint。纯并发/paused 跳过用 skipped。不得新增 status=partial（CHECK 不支持），不得只在 error 写 partial 而丢掉已提交计数。初始化 lastOkAt/health 表示 run 结果，不得被使用为 coverage 证据。正常 cap partial 不触发额外重试或自 enqueue；网络失败沿用现有策略，不改重试间隔。下一 run 仅在另行获准实际运行后由现有调度/手动入口启动。

### 6. 配置变化及 preview

configHash 用稳定 canonical 序列覆盖 source kind/url/base、pagination 全部字段、列表 selector/date/timezone、allow/deny/noise、detail 和 backfill 日期/limit规则；禁止用会自行变化的 cursor/updated_at 作 hash。任何影响采集语义的变更在下一请求前/每页 commit 前发现后冻结 generation 为 config_changed；不自动续用旧页码、不自动从头大抓、不删除已有文章。阶段 A 不增加 reset API；确需重启应由后续独立审查确定显式操作。

preview 仍只取 page 0，不读/写 backfill cursor，不取 detail、不分页，不创建初始化。opt-in preview 有独立的同样 pre-dispatch cap（含 redirects），响应增加 backend 元数据 `previewMode=single_page`、`paginationExecuted=false`、`coverage=unproven`；不得声称它预览了完整 collector 结果。保留 legacy 返回字段，apps 无需改动。未授权真实 preview 网络。

## 阶段 B：CHANGES_REQUIRED，另行审查前不得实现/启用

以下是后续最小设计要求，不是本次实现放行：

1. 详情需要同 run budget 透传所有路径，包括 HTML、Jina、PDF fetcher 与 redirect；冻结 S4 helper 可复用但不改判定。budget exhaustion 不能被 best-effort catch 吞成完整成功。detail.maxFetches 始终是整个 run 的独立上限，不能每页重置。未解决日期/详情余额不足必须有有界 pending row/snapshot 或停页方案；禁止推进后永久丢掉未处理行。
2. 日期提前终止至少要求该源有可复核的全局按真实发布时间降序契约、无无法解释的置顶/乱序，且用于边界的**整页所有 article rows 的最终可信日期都严格早于 cutoff（即该页最大日期也早于 cutoff）**。任何缺日期、无效/冲突日期、未完成权威详情、先前 unresolved row 均禁止 complete。最旧一条早于 cutoff 无论如何不够。
3. 显式末页需来源级可验证终止标识、页身份及范围一致性；maxPageIndex/countPage/空响应/404 不单独构成末页证明。即使证明遍历至末页，存在未解决行也只能 exhausted_with_gaps/partial，不能 initialized。完整目标窗口及 source 范围的确认与“站点留存列表已经遍历”分开验收。
4. 必须说明可变页面跨 run 的快照/重叠重放机制和 bounded pending 状态、配置 reset 审计，以及何时一次性设置 initializedAt。当前两页观察不足以解决这些问题，因此阶段 A 不自动转入增量模式。

## 文件允许范围与测试关键契约

阶段 A 允许必要代码仅限：

- `packages/backend/src/sources/config-keys.ts`：严格 schema/组合校验。
- `packages/backend/src/sources/web-list.ts`：可选列表 URL/budget 注入，保持旧导出默认行为；不改 frozen 正文/detail helper 判定。
- `packages/backend/src/sources/collect.ts`：显式分支、页处理、事务、JSON checkpoint、guard、detail 记录。
- `packages/backend/src/lib/http-fetch.ts`：可选 run budget/deadline/redirect target 校验，旧调用行为不变。
- 可新增一个 source-local `packages/backend/src/sources/web-list-pagination.ts`，承载 mode/schema/cursor/URL/停止规划；不建立通用分页 framework 或全局 dispatcher monkey-patch。
- `packages/backend/src/admin/sources.ts`：仅 preview 的单页边界/元数据。`types.ts` 仅在确需 typed result 时最小补充。
- 对应 sources/source-rules/collection 测试或独立 `tests/web-list-pagination.test.ts`、transport 测试；`docs/sources.md` 的精确行为说明由实施 owner 更新。

不允许改 industry/sources.json 启用/批量加 opt-in，不改 apps、schema/migrations、jobs 调度/重试、providers、选分门槛、正文/PDF/OCR/公开发布层。真实 probe runner/P3 wrapper 不变。本文 owner 只写本报告。

实施至少验证以下行为契约（纯 fixture/loopback、fresh `_test` 库；本审查没有运行）：

1. 缺 pagination 时 legacy web_list 一页且原初始化；RSS/X/JSON 行为不变；所有非法类型/字段/组合在网络前拒绝。
2. 0→index_1.htm 公式、base/导航排除、同源 redirect 校验；预算=1 的 302 在第二 dispatch 前拒绝，实际服务请求数与 admission 数吻合；拒绝/失败不重置预算，总 deadline 不随页重启。
3. 两页窗口内成功仍 partial、无 initializedAt；cutoff/anchor 跨 run 相同；只见一个旧日期、乱序/缺日期/重复页/空页/404 不能 complete。
4. 单页候选超额不 slice 后跳页；run 剩余额度不足不推进该页；跨页重复不重复创建，已有权威 title/date 不回退。
5. crash/fault 注入覆盖物料后、queue 后、cursor 前：当前页全 rollback 或全 commit，下次重放不丢文章/队列/计数；前一页已提交可保留。failed run detail 与实际提交计数一致。
6. 两个独立连接同时 force/direct/job 调同源：只有一方有 dispatch，另一方 skipped；异常释放锁；不同 source 可运行而不共享额度。
7. config 在 fetch 后 commit 前变化：cursor/文章/队列不提交该页；已有 initialized 源新增 opt-in 不自动 reset；JSON 其他命名空间保留。
8. preview 永远 page0、detail=0、cursor/DB 无写、metadata 明确非分页；preview redirect 也受自己的 cap。

实施 owner 完成这些必要 focused 测试后再按 AGENTS 对最终代码执行所需检查。本文仅 docs review，无代码变化，不为它启动 DB/软件全回归或网络。

## 交接

FILES_CHANGED=docs/fiscal-finance/S1_WEB_LIST_PAGINATION_SCOPE_REVIEW_2026-10-06.md（唯一 owned 文件）
TESTS_RUN=只读代码/文档与已安装 postgres 类型审阅；未运行软件测试、Git、数据库、HTTP、collector、worker、OCR 或项目 provider。
RISKS=阶段 A 永远 coverage unproven；动态页序/日期语义/详情缺口仍可能漏项；safe bounded traversal 不是 90 天完整覆盖。
BLOCKERS=阶段 A 离线/loopback 实现无架构 blocker；现有19源不适用阶段 A，真实 source opt-in、详情分页、完成初始化与历史完整性尚未放行。已获知 page2 独立 QA 通过，仍不能代替日期权威/全局排序证据。
NEXT=Lead 可直接分派 Luna High：仅按 schema/预算/页事务/guard/preview 文件范围实现阶段 A，并完成上述八组离线/loopback 契约验证；industry/sources.json 不改，不将任何现有19源迁入这个子集，不删除 detail，不扩大实际抓取。阶段 B 先提供有界 pending/详情预算/终止与配置重启具体方案再由 Sol 裁定；Gate 2 继续 NOT_PASSED。
