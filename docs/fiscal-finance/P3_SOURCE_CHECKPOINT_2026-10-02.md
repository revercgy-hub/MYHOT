# P3 官方来源五首页只读检查点（2026-10-02）

STATUS=五个来源首页只读观察完成；Gate 2 仍 NOT_PASSED。
STAGE=P3 本地抓取与正文验证。
GATE=Gate 1 PASSED；Gate 2 NOT_PASSED。

## TASK

按 `industry/sources.json` 当前原始配置，对 `mof-accounting-notices`、`mof-budget-work`、`mof-regional-supervision-dynamics`、`mof-xiamen-supervision-dynamics` 和 `pboc-open-market` 各读取一次官方首页；用仓库 `fromHtml()` 离线解析，和 9/29、9/30 可用快照比较候选容量、顺序、最早/最新列表日期及 URL 增减。最多追加两篇此前记录为 `unconfirmed` 的核心文章详情页只读诊断。全程使用 `scripts/fiscal/p3-http-budget.ts` 对 backend 实际解析的 Undici 做 12 dispatch admission 硬上限；不运行 collector/数据库/worker/模型，不改来源配置与历史正文状态。

## MODEL

GPT-6.1 Sol（本轮离线设计/报告）；实时读取仅为免费官方页面 GET，未调用仓库模型服务。

## FILES_CHANGED

- 新增本文。
- 忽略目录 `.data/fiscal-source-checkpoint-20261002/` 保存执行器、五份首页原始 HTML、两份详情 HTML 和 `evidence.json`。文件均不进入 Git；证据 JSON 包含每项解析候选顺序、标题、原文 URL、UTC/中国日、HTML SHA-256、事件日志及与快照的逐 URL 差分。
- 未改 `industry/sources.json`、`apps/`、`packages/`、schema、数据库或此前报告。

## TESTS_RUN

- `node --test tests/fiscal-p3-http-budget.test.ts`：5/5 通过。均为本机 localhost fixture，覆盖 cap 1 的第 N+1 dispatch 拦截、两次 redirect hop 计数、ProxyAgent 不双计、502 状态记录以及卸载还原。此项只验证测试中的本地流量。
- 五个官方列表首页各一次 `guardedFetch`，列表响应均 HTTP 200；不重试、不分页。保存内容由仓库实际 `fromHtml()` 解析。
- 对两篇 `mof-accounting-notices` 已知 `unconfirmed` URL 各一次只读 `guardedFetch`。用实际 `readable()`、页面 `ArticleTitle`/`PubDate`、`.TRS_Editor`、表格和附件链接作本地检查；未触及数据存储。
- 安全开关显式为 false：`COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`JINA_BODY_FALLBACK`、`INDEXNOW_SUBMIT_ENABLED`、`FEISHU_CONTENT_PUSH_ENABLED`、`FEISHU_INTERNAL_ENABLED`、`ALLOW_PRIVATE_NETWORK_FETCH`；`EGRESS_PROXY_URL` 为空。没有 worker、模型、付费 fallback 或发布。

## RESULT

五份首页都从各自配置中的同一 `sourceUrl` 读取。当前完整 parser 候选数、按 parser 输出顺序的最早/最新中国日期及对照如下。候选 URL 均在当前 source 的 allow prefix 内；实际 URL、标题、日期和序号保存在 ignored 证据中。

| 来源 | 本次 HTTP / 字节 / 首页 SHA-256 | 当前候选、顺序日期范围 | 与先前快照比较 |
|---|---|---|---|
| 会计司工作通知 | 200 / 14,233 / `9ff0b1085b26aeb9f7dfd2a7d25aa738233fa06423c3c7822f3060ca678280c7` | 10 项，首页最新在前；列表日 2026-09-30 至 2026-08-14 | 对 9/30 collector 保存的 accepted article 集合 9/10 URL 相同，新进 9/30 征求会计科目修订稿，退出 8/3 名单；对 9/29 原始 HTML parser 只命中5项，本次与其5/5重合、另有5项不在旧快照。9/30 collector 集合不是原始首页 HTML，且旧 9/29 首页快照本身只有5个 parser 项，差分边界见风险。 |
| 预算司工作动态 | 200 / 12,368 / `4456c71613c83c0de91a7d3285f93f617c3ddf8b2ef04ffdf89d9a2b1810b148` | 10 项，首页最新在前；2026-03-26 至 2023-07-24 | 对 9/30 collector accepted 集合 10/10 exact URL 重合、无新进/退出；对 9/29 原始列表 HTML 10/10 完全重合。首页最旧项已超过三年；它说明列表当前窗口静态偏旧，不证明发布频率或以后不会滑窗。 |
| 财政部各地监管局动态（汇总） | 200 / 21,332 / `f8071c91812cfa74dc70b5e373f37abaea058e7a70cf828968c66f7bd5e15a35` | 8 项，2026-09-30 至 2026-09-22 | 对 9/30 原始首页 5/8 exact URL 重合：新增3项（陕西、内蒙古、较早新疆稿），退出3项（重庆、安徽、山东）；对 9/29 原始首页 4/7 重合：新进4项、退出3项。两日间观测到首页窗口变动。 |
| 财政部厦门监管局工作动态 | 200 / 12,797 / `927b4f055efb98202737d410dd65be029ab21e57d866c9e4ff744a537e07f89e` | 10 项，2026-09-29 至 2026-09-01 | 对 9/30 和 9/29 两份原始首页均为10/10 exact URL 重合，顺序、最早/最新日一致。本次首页内容与相邻快照复读，不表示长期稳定。 |
| 人民银行公开市场业务公告 | 200 / 40,079 / `fe16e2da27948d98b63dee28239f5d53895acacdd24a124e461b34864178aa4d` | 20 项，2026-09-30 至 2026-09-04 | 对 9/30 原始首页20/20重合；对9/29首页19/20重合，新进第192号公告、退出9/3第173号公告，列表日期范围向前推进一天。 |

首页数据的排序按各源 parser 原样顺序记录，没有按日期重新排序。会计司两个首页项的 span 日期为 9/30，即使 URL 路径中一个显示 9/29；这里使用的是当前配置 selector 解析出的发布日期，不用 URL 推日期。中央汇总来源出现的厦门稿链接是 `http://xm.mof.gov.cn/...3997966.htm`；厦门自身首页同事项窗口没有同 URL，因此这两个配置当前窗口未见 exact URL 相交。本轮未对跨源 identity/DB 判重做实测。

预算计数：Undici 8.11.2 backend `Agent`/`ProxyAgent` dispatcher admission `maxRequests=12`；实际 `attempted=7 / dispatched=7 / rejected=0`。7个 request ID 各有一条 `undici:request:create`、`undici:client:sendHeaders` 和 `undici:request:headers`，合计21个真实诊断事件；5个列表和2个详情最终状态全为200、无 redirect；`request:error=0`，diagnostic callback errors=0。没有把函数调用数当作 HTTP 事件数。本工具范围只覆盖 backend 本地解析的 Undici 8.11.2 Agent/ProxyAgent dispatch；它不覆盖 Node global fetch、其他 Undici 副本、worker、任意自定义 dispatcher、`ALLOW_PRIVATE_NETWORK_FETCH` 全局 dispatcher 旁路或 proxy CONNECT 内部流量。本轮无代理且私网旁路显式关闭；历史 core/regional 批次仍分别保持原报告中的计数 unknown，不能由本轮追认。

只读详情诊断选择了此前 core batch 列为 unconfirmed、且仓库忽略证据没有同 URL 原始文件的两篇会计司公告：

| URL（固定详情） | HTTP / 原始 SHA-256 | 身份和正文观察 |
|---|---|---|
| `.../202609/t20260920_3997803.htm` | 200 / `1252e4d2c98ce440b82cc9bde220fe993874e115f1d301d61886917adf7f6213` | `ArticleTitle` 与列表题名相同，`PubDate=2026-09-20 16:08:00` 对应中国日9/20；Readability=null。正文容器 `.TRS_Editor` 只有题名24字，公告提供 `.xlsx` 附件链接，HTML 未见 PDF。正文数据可能在附件中，但本轮不获取附件。 |
| `.../202609/t20260904_3996714.htm` | 200 / `2fbb88da586ac84a94f1bb49ac2ada2b19b81332973c8ca3afc64f7860b319a6` | `ArticleTitle` 与列表题名相同，`PubDate=2026-09-04 15:31:00` 对应中国日9/4；Readability=null。`.TRS_Editor` 有323字、1个表格（2个 `tr`），是当前抽取器门槛以下的结构化名单页面，不能据此说原文为空。 |

以上只是新增 HTML 响应与解析诊断；未再次调用 `extractArticleBody`、未修改任何旧数据库的 `body_status`/revision，也未请求正文以外的附件。详情的 `readable=null` 表示当前 Readability helper 未产出至少200字正文，不代表官方页面 HTTP 失败。

### 会计司正文 selector 的最小配置建议

离线读取现有 `config-keys.ts`、`selected-body.ts`、`web-list.ts` 后确认，来源配置已支持 `detail.bodySelector` 和显式 `detail.allowShortBody`，collector/extractor 会复用同一 selector、标题与本地日身份核对；selector 缺失/不唯一、无结构化内容、身份不匹配都会拒绝入库。对本轮两份原始详情 HTML 用同一纯函数做离线演练：

```json
"detail": {
  "bodySelector": ".TRS_Editor:has(table)",
  "allowShortBody": true,
  "publishedAtUtcOffset": "+08:00"
}
```

这个精确 selector 在 `t20260904_3996714.htm` 唯一命中表格正文，按既有 table-cell 保留函数得到180字正文，题名和 `PubDate` 中国日都吻合；在 `t20260920_3997803.htm` 不命中（返回 `selector_not_unique`），避免把只含24字题名的 `.TRS_Editor` 当正文。后一篇的 `.xlsx` 附件留在页面之外，不能标作正文或推定其表格内容；本轮也未请求该附件。

建议把它作为**行业来源配置候选**供单独 S1 审查，不在本检查点直接改 `industry/sources.json`。`allowShortBody=true` 会接受所有唯一匹配表格、即使短于200字；`:has(table)` 可能误选装饰/目录表格，标题和日期一致也不能证明表格行完整。需先用更多会计司详情的 ignored/既存原始样本验证唯一性、表格语义和正文完整边界，再由后续独占变更加 fixture 覆盖“短表格可收、题名+XLSX fail-closed、无表页拒绝、标题/日期不符拒绝”；仍不能使 XLSX 内容进入正文。如果附件自动读取确为后续业务需求，应另提附件类型与 fail-closed 方案，不能为通过当前 HTML selector 放宽附件处理。

## RISKS

- 9/30 core 两源本轮历史 collector 没有保存原始首页 HTML。其10/2对照集合来自 `.data/fiscal-qa/core-batch-20260930/result.json` 的第二轮 accepted articles；报告记载该集合由实际配置首页 collector 返回，但这不是能重新跑 `fromHtml()` 的9/30原始页面。对会计司，9/29页面原始 parser 只解析5项，且旧 preview 只保存代表性输出；因此无法证明完整两日页面的逐 URL 增减。会计司当前 parser容量10大于早期9/29 raw parser的5，也不应将其余差额都称作新增发布。
- 预算司10条跨日候选均重合，但最旧2023-07-24；这不能证明栏目按固定周期增加文章，预算历史首页也不能代替跨页检查。
- 地方监管局汇总页容量为8，且出现日期新于URL路径的陕西条目和相对旧快照的候选轮换。当前页只覆盖实际 selector 命中的公开选登候选，不等于覆盖全部35个监管局。厦门工作动态包含党建学习、会议及一般工作活动；候选入库样本不等于后续精选相关性通过。
- OMO 的 9/29→9/30差分与此前报告一致；本次与9/30原始快照复读，不能增加额外的跨日更新证据。
- 详情只诊断两个已知 unconfirmed 样本；不请求 XLSX、不审附件字段，未解决全文正文自动提取需求。Readability 的结果不能映射成 DB 的新状态。
- 12 dispatch 硬上限已按 helper admission 证实且本批7个真实 hop全部可见；helper 范围不等价于进程所有网络路径。历史批次预算问题仍未解决。

## BLOCKERS

Gate 2 仍未通过。正文完整性/附件提取、会计司跨日原始首页差分、预算司跨周期 freshness、监管局汇总覆盖及候选噪声、OMO长期更新频率仍需证据。全部 source 继续 `enabled=false`、站内及 RSS 全文关闭；本轮未改变配置。

## NEXT

先复核本轮 raw HTML 与 `evidence.json` 记录；后续若继续查来源，保持显式 helper cap 和事件落盘。会计司应取得下一日期完整原始首页快照再做 parser 到 parser 的逐项差分。正文路线先围绕 XLSX 附件与短表格页面提出最小、只读的 extraction diagnosis；在确认范围前不接 worker、不改存量正文状态。继续保持 Gate 2 NOT_PASSED 和来源关闭；是否需要数据库级 collector 实测，应先另提隔离库及额外预算方案。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：五个现有财政金融官方来源各读取一次全首页，保存原始页面/hash，以项目 parser 与可用 9/29、9/30 快照比较；预算上限12个 backend Undici dispatch；最多只读诊断两篇既知 unconfirmed core 详情。

**MODEL**：GPT-6.1 Sol；模型服务、worker、OCR、付费 fallback 均未调用。

**FILES_CHANGED**：仅新增本文作为 tracked 文件；忽略目录 `.data/fiscal-source-checkpoint-20261002/` 含脚本、原始 HTML 和机器证据。没有 source/config/code/schema/database 改动。

**TESTS_RUN**：P3 HTTP budget localhost 测试5/5通过；真实来源页面只读 GET 7次/7 dispatch，7组 create/sendHeaders/status 事件完整，全部200；项目 parser 离线解析五首页。

**RESULT**：来源首页候选容量依次10、10、8、10、20；具体跨日新增/退出及两个未确认正文诊断见上文。`.TRS_Editor:has(table)` 是有两份详情快照支持的最小行业配置候选，仍待更多页面及独立 S1 范围审查。12 cap使用7、拒绝0；来源/模型/发布状态未变。

**RISKS**：此处的快照和样本均有限；尤其会计司9/30没有留原始HTML，不能做严格双日原始页面差分。dispatcher监测范围不覆盖所有可能的网络入口。

**BLOCKERS**：Gate 2 NOT_PASSED；核心正文自动化、原始跨日差分与各源跨周期/噪声证据不足。

**NEXT**：复核ignored HTML/事件证据；下一批补全会计司跨日 raw parser 对照及短正文/附件证据，再决定是否需要经 Lead 另行批准的隔离 collector/DB 实测。

## 2026-10-02 selector 范围复核追加

随后 S1 对 `.TRS_Editor:has(table)` 判为 `CHANGES_REQUIRED`，并仅批准跨类型离线验证 selector union；详情和配置范围见 [正式 S1 审查](S1_P3_OCT02_SCOPE_REVIEW.md)。独立验证报告 [P3_ACCOUNTING_BODY_FIX_2026-10-02.md](P3_ACCOUNTING_BODY_FIX_2026-10-02.md) 用实际 helper 检查了注销表、题名+XLSX、473字无表嵌套TRS三类缓存，以及短多段和装饰表格两个身份正确的正文负例。S1 union 会接受后两类短噪声；更收窄的五列/段落 CSS 仍会接受五格装饰表。因此本轮停止行业配置变更，`industry/sources.json` 保持原样；不得将此前推荐句解读为本源配置已验证或已落地。测试6/6通过是候选行为复现和负例风险证据，不是 selector 安全验收。Gate 2 继续 `NOT_PASSED`。
