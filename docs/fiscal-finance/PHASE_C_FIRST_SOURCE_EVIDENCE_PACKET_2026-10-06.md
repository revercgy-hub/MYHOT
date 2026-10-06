# Phase C 首个 pagination-metadata 来源证据包（2026-10-06）

## 结论

**待审候选：`mof-shanghai-supervision-dynamics`。裁定：`EVIDENCE_PACKET_ONLY / NOT_ADMITTED`。** 已有同源保存 page 0，以及一次 Lead 单独核销的 page 1 只读 GET。两页各有 10 个唯一候选，页间 URL 无重叠，显示日期从 page 0 的 2026-09-28→08-28 接到 page 1 的 2026-08-27→07-24；这支持“观察到的一组相邻页”排序与页码身份。它不证明 50 页真实可用、90 日历史覆盖、跨周期稳定或 source 可启用。

没有修改 `industry/sources.json`、代码、数据库或共享索引。来源仍 disabled、full-text 关闭，未启用 pagination/detailMode；没有运行 collector、worker 或模型。此前北京/福建/上海保存证据不借用 Batch 6 或四川材料。

在这三条配置中只挑上海继续核证，是因为上海独有这次已核销的本源 page 1 原始响应；福建、北京在现存本源证据中都没有相邻页响应。北京已知 list/`PubDate` 有六天差异、detail title 前缀也不同；福建保存材料有一个待确认正文与 PDF 邻接问题。这些差异不改变候选选择，也不构成把上海认定可用的理由。

## 来源和配置事实

清单中的唯一上海候选是 `web_list`，列表 URL 为 `https://sh.mof.gov.cn/gzdt/caizhengjiancha/`，`allowUrlPrefixes` 恰为该 HTTPS 目录。当前配置的 `detail.maxFetches=10`，日期规则为 `<meta name="PubDate" content="…">` 正则，UTC offset `+08:00`；`titleSelector/titleRegex`、title/date authoritative flags 和 `upgradeDatePrecision` 均未设置。保留的正文配置是 `.my_doccontent`，没有 `pdfDirect`、附件/envelope selector 或附件模式。配置本身未提供分页 opt-in。

分页 metadata 可以从本源自己的 raw 得到有限证据：保存 page 0 HTML 的脚本声明 `currentPage=0`、`countPage=50`、`nextPage=currentPage+1`，并拼接 `index_<nextPage>.htm`。两个 page 0 raw 分别随 2026-10-04 和 2026-10-05 manifest 保存，均为 12,617 bytes、SHA-256 `cbbd59f4ac4dea453140f497543ed156c2324dee336366a430d57ab97a1eebce`，逐一重算吻合；两次离线解析均为 10 个候选。page 0 静态可见的 pager anchor 只有“首页”，JS 没有被执行。

经独立单次请求实际验证，精确 URL `https://sh.mof.gov.cn/gzdt/caizhengjiancha/index_1.htm` 返回 HTTP 200、`text/html`、final URL 相同；页面脚本声明 `currentPage=1`、`countPage=50`。完整请求事件与响应 raw/hash 在 ignored `.data/fiscal-qa/shanghai-page2-probe-20261006/`；摘要见 [单页探测报告](SHANGHAI_PAGE2_PROBE_2026-10-06.md)。这确认已观察到的 `/index_1.htm` 身份，不确认脚本所报 50 页总数或更深页的连续性。

## 两页列表对比

| 观察 | page 0（原栏目目录） | page 1（一次真实探测） |
|---|---:|---:|
| 已保存 raw bytes / SHA-256 | 12,617 / `cbbd59f4ac4dea453140f497543ed156c2324dee336366a430d57ab97a1eebce` | 12,816 / `b8c5ec2033bbadd10d48b43a29c3e2b9d32a3e9648fe342e2eb9d3bd473adcdc` |
| JS pager state | `currentPage=0`, `countPage=50` | `currentPage=1`, `countPage=50` |
| 候选与精确重复 | 10；0 个页内重复 | 10；0 个页内重复 |
| 可见日期顺序 | 2026-09-28→2026-08-28，降序 | 2026-08-27→2026-07-24，降序 |
| 与另一页 URL 重叠 | 0 | 0 |
| 可见日期与文章路径日期不一致 | 4/10 | 3/10 |

跨页边界接续为 2026-08-28→2026-08-27。页 1 的第四行是 “财政部上海监管局2025年度单位决算”，URL 指向 `.pdf`，但该 source 未配置 PDF 正文路径。其余详情 body/S4 状态不能从列表 HTML 外推。页 0/1 的空交集只适用于这两个保存快照。

## 日期、身份和 S4 边界

一条已有配对详情是 `https://sh.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260923_3998015.htm`：列表标题与详情 `h2` 标题相同；列表显示日为 2026-09-23，详情 `PubDate` 是 2026-09-23 15:09 +08。之前的真实 collector 记录保留列表日 `2026-09-23T00:00:00+08:00`，未把详情时间写作权威日期。这是同一日，不是同一精确时间戳；若按当前 Phase B 精确 equality 检查，两值相差 15 小时 9 分，不能称 exact-equal。单条样本也不能证明 `PubDate` 总是原始发布日期。

源码路径进一步限定日期请求：普通 collector 的 `need.date` 为 `!candidate.publishedAt || d.upgradeDatePrecision === true`（`collect.ts`）；分页 metadata 的 `needsDate` 要求详情日期权威、列表日期缺失，或 `upgradeDatePrecision === true`（`web-list-pagination.ts`）。上海配置没有 `upgradeDatePrecision`，因此有列表日的候选默认不会为 `PubDate` 发 metadata 详情请求。若之后有人显式请求精度提升，则现有样本需要先裁定“列表日 vs 精确时刻”的来源语义；同日不能绕过精确冲突规则。

元数据路径只接受直接 HTML；source 的 `.my_doccontent` 正文 selector 继续受 S4 身份与正文就绪保护。当前没有 PDF selector/direct-PDF 配置，而 page 1 已有一个 PDF 候选；metadata-only 成功、列表解析成功或其它 10 条已入库 body 状态均不能解除该行正文 hold，也不能证明整页业务内容完整。

URL 身份方面，page 1 的 10 个链接都在 `https://sh.mof.gov.cn/gzdt/caizhengjiancha/` 前缀，使用无 credentials/query/fragment 的 HTTPS；页间 URL 无重叠。`index_1.htm` 本身位于目录前缀内，必须作为分页列表身份处理，不能误当文章 detail URL。页内 PDF 链接也在前缀内，因此单靠 allow-prefix 不足以区分文章 HTML、PDF 与 numbered listing alias。

## 为什么现在仍不能准入

- `countPage=50` 是 raw script 的自报 pager 值；只真实读取了 page 0 和 page 1。未证明末页、页数真实性、缺页/重复页、内容移动或深层历史。
- 两个 page 0 snapshot 内容相同只能说明这两个时点的同一保存页面相同。上海 2026-10-05 的重复列表 collector 在 dispatch 后约 25 秒超时，已按 `PARTIAL / NOT_PASSED` 保留，不能算成功幂等复核。
- 日期 regex 语义没有被证明为原始发布日期；当前无 authority 声明。已知列表日午夜与详情 PubDate 精确时刻不相等。`upgradeDatePrecision` 仍缺来源语义审查和 S1 处理决定。
- page 1 含 PDF 候选，source 没有 PDF 正文配置；普通 HTML body selector 不足以声明其正文 ready。通用元数据页流程不改变 body/S4 状态。
- 10/04 与 10/05 的既有 collector/detail 记录是局部操作事实；不构成分页 metadata continuation、90 日历史或 Gate 2 通过。

## SINGLE_DETAIL_REQUEST_RESULT

此前提出的单详情 GET 已由 Lead 另行核销并独立完成；它使用新的 one-shot marker 和独立预算，不续用 page 1 请求预算。目标是下列 page 1 第 8 行：列表显示日靠近 source 当前 three-month boundary，且不同于 URL 日期 token。

- exact URL：`https://sh.mof.gov.cn/gzdt/caizhengjiancha/202607/t20260728_3994403.htm`
- `shanghai-page1.html` raw 第 214 行标题 `上海监管局：强化监管主责 严守征管底线 因地制宜做好中央财政收入监管工作`、显示日 `2026-07-31`，href `./202607/t20260728_3994403.htm`；path token `2026-07-28` 只作诊断。
- 现有 `fromHtml` 在 page 1 上解析 10 个候选；目标 title/date/URL 与列表行对应。`identityKeyForUrl` 输出 `url:https://sh.mof.gov.cn/gzdt/caizhengjiancha/202607/t20260728_3994403.htm`。它是 source prefix 下的 HTTPS `.htm` 文章 URL，没有 query/fragment。
- HTTP 200 HTML 详情与最终 URL 一致，18,945 bytes，SHA-256 `b5b98612935674920813e045fb707d8cd55719008110d60aaa0e518d8f1037d3`。实际 dispatch `1/1`，无 redirect/retry。完整字段及结构见 [单详情日期核验报告](SHANGHAI_DATE_CONFLICT_DETAIL_2026-10-06.md)；raw 和 manifest 在新的 ignored `.data/fiscal-qa/shanghai-date-conflict-detail-20261006/`。
- 配置的 `PubDate` regex 读取 `2026-07-31 08:17:00` +08，parsed ISO `2026-07-31T00:17:00.000Z`。HTML 可见时间栏明标 `发布日期：2026年07月31日`，详情标题与列表一致；URL token 比页面标注日早三天。此页面支持同日列表值，但配置 detail instant 比 list midnight 晚 8 小时 17 分，非 exact-equal。

页面明示“发布日期”属于有用的本页 source evidence；单篇不能证明 `PubDate` 对来源全体表示 original first-publication date，也没有提供可核对的更新时间历史，所以 source-wide 原始日期语义仍 `UNKNOWN`。请求没有改变 metadata path、authority 或 `upgradeDatePrecision`。它不自动裁决 source admission；列表日精度策略、PDF 行与 S4 body hold、深层历史/末页/跨周期证据仍需审阅，不能 source opt-in 或宣称 complete/reset/incremental。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：先从 19 条 manifest source 中选择最多一个来源，检查本源已保存的分页 metadata 准入证据，并按 Lead 核销预算完成单一上海 page 1 只读探测；不改变源配置或运行状态。

**MODEL**：GPT-6 Luna High；未调用项目 provider/model。

**FILES_CHANGED**：新增本证据包、[上海单页探测报告](SHANGHAI_PAGE2_PROBE_2026-10-06.md)及[单详情日期核验报告](SHANGHAI_DATE_CONFLICT_DETAIL_2026-10-06.md)。两次单请求各有独立 ignored probe 目录、runner、one-shot marker、manifest 和 raw；没有改配置、代码、DB 或 Git index。

**TESTS_RUN**：两个 ignored runner 的 `node --check` 均通过；离线核验 page raws/hash、manifest URL/hash、候选重复/重叠、source selector、project URL identity 和详情字段。使用 guarded transport、pinned Undici 的 P3 budget 分别完成已核销的 page 1 list 与 exact detail GET，每个独立为 1/1 dispatch、HTTP 200、0 redirect/retry。未运行软件测试、DB、collector、worker 或模型。

**RESULT**：同源保存 HTML 与一次 page 1 GET 确认了观察页的 `currentPage=0/1` 及 `/index_1.htm` 身份；随后独立单详情 GET 观察到页面“发布日期”日为 7/31、detail `PubDate` 精确时刻为 7/31 08:17 +08、URL token 为 7/28。候选仍为 `NOT_ADMITTED`，不是 source opt-in、90 日覆盖、完整性或 Gate 2 通过。

**RISKS**：只观察两页；自报 50 页没有被端到端核实。3/10 page 1 行的展示日与 URL 日期不同，另有 1 个 PDF。Shanghai detail date 规则默认不会为有列表日期的 metadata candidate 发请求；显式升级时存在同日但精确时间不同的冲突。之前的 repeat timeout 仍是失败记录。

**BLOCKERS**：详情 `PubDate` 原始发布日期语义、精确时间与列表日期策略、PDF/S4 正文边界、历史末页/覆盖和跨周期稳定性仍未知或未裁定；Gate 2 保持 `NOT_PASSED`。

**NEXT**：由 QA 按单详情报告核验 raw hash、URL identity、字段来源与独立预算，再决定是否更新 admission matrix。仍保持 source disabled；任何 config/opt-in/complete/reset/incremental 或新的真实请求需另行明确 S1 核销。
