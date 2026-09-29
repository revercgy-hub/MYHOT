# 官方信源验证矩阵

本矩阵区分“页面结构证据”和“collector 实际运行”。截至 2026-09-29，完成的是只读网页结构核验；没有运行采集 worker，没有启用任何信源，也没有进行模型调用。`industry/sources.json` 当前只配置下列四个有列表与文章结构证据的来源，均为 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`。结构检查不代表生产稳定性，P3 仍需用 collector fixture/受控抓取验收。

状态含义：

- **结构已核验，待 P3**：直接读取了列表与至少一篇文章，确认标题、日期、详情链接及 URL 范围；还未运行项目 collector。
- **待核验**：只找到官方入口/检索结果，或请求受阻；没有足够证据编写 selector，因此不进入 sources.json。

| 首批来源 | 列表页 / 入口 | 页面与结构证据 | 分页、噪声、历史、重复观察 | 当前状态 |
|---|---|---|---|---|
| 财政部预算司 | [工作动态](https://yss.mof.gov.cn/gongzuodongtai/) | Node fetch 直连 HTML 返回 200；本次列表 10 条，`ul.liBox > li`，链接 `a[href]`、标题 `a`、日期 `span`。详情样本 [2026-03-26](https://yss.mof.gov.cn/gongzuodongtai/202603/t20260326_3986132.htm) 返回 200，meta `ArticleTitle` / `PubDate` 和正文可见，列表与详情字段吻合。URL 前缀限定 `/gongzuodongtai/`。日期只有日历日，没有时区。 | 10 个选中条目的 href 唯一。通过 `createPageHTML` 观察到 `index.htm`、`index_1.htm` 等分页；抽查第 2 页有 2023/2022 历史条目，collector 不会自动翻页。列表首页当前最新可见日期为 2026-03-26，距核验日较久，存在新鲜度疑问。样本页含会议、培训等非政策动态，需精选过滤。 | **结构已核验；新鲜度需在 P3 复核**；已配置 disabled `mof-budget-work` |
| 财政部（综合政策发布） | [政策发布入口](https://zhs.mof.gov.cn/zhengcefabu/index.htm) | 标准页 `index_1.htm` 直连 HTML 曾返回 200，列表 DOM 与 MOF 模板一致（`ul.liBox > li` / `a` / `span`），列表中可见日期标题；抽取到的文章链接样本为 `https://zhs.mof.gov.cn/zhengcefabu/202604/t20260429_3988801.htm`。但当前索引 `index.htm` 多次 502/超时，样本文章直连复查也出现 502。 | 已知分页函数 `createPageHTML(50, 1, "index", "htm")`；`index_1.htm` 可读样本所见最新日期仅到 2026-04-29，与本次核验日相隔较久。首页新鲜度未确认；导航噪声、重复项及文章可访问性未完成复验。 | **待核验/新鲜度阻塞**；不配置，需确认首页与文章可稳定读取后再评估 |
| 中国政府网 | [国务院政策文件库](https://sousuo.www.gov.cn/zcwjk/policyDocumentLibrary?t=zhengcelibrary_gw)，[部门文件页](https://www.gov.cn/zhengce/zhengceku/bmwj/home.htm) | Node fetch 的政策文件库 URL 返回 HTTP 200，但只有 958 字节框架，0 个列表 `<li>` / 文章链接，结果由动态应用加载。另一个部门文件页返回 200 并含静态列表（64 个 `<li>`），但可见条目停留在 2026 年 1 月附近，较核验日明显陈旧；未进一步接受文章日期和分页检查。 | 检索应用缺静态结果；部门页有陈旧风险。没有验证可用的最新条目、详情页配对及分页。 | **待核验/列表动态化及新鲜度阻塞**；不配置 |
| 财政部金融司 | [工作动态入口](https://jrs.mof.gov.cn/gongzuodongtai/) | 搜索索引能显示官方页面及条目标题/日期；本轮直连多次 502，未取得可分析的原始 HTML。 | 无法确认列表/文章链接选择器、分页、历史项和重复行为。 | **待核验（直连 502）**；不配置 |
| 财政部会计司 | [工作动态入口](https://kjs.mof.gov.cn/gongzuodongtai/) | 搜索索引能显示官方页面及条目标题/日期；本轮直连多次 502，未取得可分析的原始 HTML。 | 无法确认列表/文章链接选择器、分页、历史项和重复行为。 | **待核验（直连 502）**；不配置 |
| 中国地方政府债券信息公开平台 | [平台域名](https://www.celma.org.cn/) | 财政部官方管理文件曾引用平台域名，但本轮没有验证其当前可访问列表页或详情页。 | 页面路径、数据列表、日期字段、筛选/分页、重复发行项均未知。 | **待核验**；不配置 |
| 中国人民银行 | [中国人民银行](https://www.pbc.gov.cn/) | 可定位官方站点及公开市场操作公告，但尚未核实可供 collector 使用的栏目列表原始 DOM 与详情页配对。 | 需明确稳定列表 URL，检查公告日期字段、分页、栏目噪声和重复发布。 | **待核验**；不配置 |
| 国家金融监督管理总局 | [新闻资讯栏目](https://www.nfra.gov.cn/cn/view/pages/xinwenzixun/xinwenzixun.html) | 官方栏目入口已定位，页面使用动态内容；本轮没有取得可复现的列表 HTML/JSON 结构。 | 页面列表、日期、分页、详情 URL、导航噪声、历史重复均未核验。 | **待核验**；不配置 |
| 福建省财政厅 | [通知公告](https://czt.fujian.gov.cn/zwgk/tzgg/) | Node fetch 直连 HTML 返回 200。静态列表选择器 `div.list_base_date_01[ms-visible="$showStatic(1)"] li` 命中 5 条；其中 `a[href]` 提供标题/链接，`span.bf-pass` 提供日期。详情样本 [2026-09-24](https://czt.fujian.gov.cn/zwgk/tzgg/202609/t20260924_7218055.htm) 返回 200，含 `ArticleTitle`、`PubDate` 与正文。限定 URL 前缀 `/zwgk/tzgg/`。日期仅有年月日，没有时区。 | 当前 5 个候选 href 唯一，但其中 2 条目标为 `.pdf`，worker 对 PDF 的正文提取结果尚未核验，应在 P3 明确排除或验证处理路径。HTML 有 Avalon 动态分页模板，但当前静态返回 5 条；第二页未验证。条目混有考试领证、研究/工作通知及财政现金管理，需精选过滤。详情正文内部时间出现 9 月 21 日，而列表与 meta 发布日为 9 月 24 日，以页面发布日字段为准。 | **结构已核验；PDF 与分页待 P3**；已配置 disabled `fujian-finance-notices` |
| 厦门市财政局 | [地方政府债务栏目](https://cz.xm.gov.cn/zwxx/czsj/dfzxx/) | Node fetch 直连 HTTPS 返回 200，站点元数据确认名称为“厦门市财政局”。列表使用 `div.list_base_date_01 li`；每项含 `a[href]`、`title` 和 `<span>` 日期。详情样本 [2026 年第十六期专项债招标结果公告](https://cz.xm.gov.cn/zwxx/czsj/dfzxx/202609/t20260911_3016829.htm) 返回 200，标题与列表相符，`span.article_time` 为 2026-09-11 16:02。仅允许 `/zwxx/czsj/dfzxx/`。 | 静态 HTML 返回 15 条债务相关条目；可见最新发布日期为 2026-09-11，样本无重复 href。栏目内容包括发行、还本付息、调整用途等；翻页控件/更早历史覆盖未确认，未跑全量重复扫描。日期字段有时分，但未提供时区；配置没有擅加 UTC offset。 | **结构已核验，待 P3**；已配置 disabled `xiamen-finance-debt` |
| 人民银行厦门市分行 | [工作动态](https://xiamen.pbc.gov.cn/xiamen/127699/index.html) | Node fetch 直连 HTTPS 返回 200，页面站点元数据显示“厦门市分行”。原始列表选择器 `td:has(> span.newslist_style)` 经 Cheerio 命中 20 条；每行标题链接在 `a[href]`、日期在 `span.hui12`。详情样本 [2026-09-14 工作动态](https://xiamen.pbc.gov.cn/xiamen/127699/2026091714532820798/index.html) 返回 200，`ArticleTitle` 与 `PubDate=2026-09-14` 和列表吻合。仅允许 `/xiamen/127699/`。 | 首页列出 20 条按时间排列的工作动态；样本 href 不重复。条目有地方金融服务宣传/会议等，需精选过滤。页面有“下一页/尾页”控件但未给静态 `href`，需要 JS 才能翻页；collector 当前只读静态 HTML，暂时只覆盖首页 20 项。日期是日期字符串，无时区。 | **结构已核验，待 P3**；已配置 disabled `pboc-xiamen-work` |
| 厦门证监局 | [中国证监会厦门监管局首页](https://www.csrc.gov.cn/xiamen/) | Node fetch 直连 HTTPS 返回 200；首页有 `div.szyw-lists` 新闻区，7 个 `li`（标题链接与 `span` 日期），详情样本 [投资者保护工作](https://www.csrc.gov.cn/xiamen/c101757/c7658572/content.shtml) 返回 200，含 `ArticleTitle`、`PubDate`。但是 `PubDate` 与首页显示的 MM-DD 存在不一致，且栏目“加载更多”指向 `common_list.shtml`；本轮直连该栏目返回 200 但无文章内容（该站点由 JS/API 加载）。 | 首页新闻区覆盖的条目有限，漏掉标题区独立的最新报道；加载更多非静态 HTML，collector 不能完成分页。详情元日期与主页短日期不匹配，需进一步确认页面缓存/发布日期口径。 | **待核验/分页与日期阻塞**；不配置 |

## 已配置来源字段

| ID | 实际列表 URL | selector（按已读 HTML） | 当前运行设置 |
|---|---|---|---|
| `mof-budget-work` | `https://yss.mof.gov.cn/gongzuodongtai/` | `ul.liBox > li`；link `a[href]`；title `a`；date `span` | `web_list`、T1、`enabled=false`、两种全文转发均 false |
| `fujian-finance-notices` | `https://czt.fujian.gov.cn/zwgk/tzgg/` | `div.list_base_date_01[ms-visible="$showStatic(1)"] li`；link `a[href]`；title `a`；date `span.bf-pass` | `web_list`、T1、`enabled=false`、两种全文转发均 false |
| `xiamen-finance-debt` | `https://cz.xm.gov.cn/zwxx/czsj/dfzxx/` | `div.list_base_date_01 li`；link `a[href]`；title `a`；date `span` | `web_list`、T1、`enabled=false`、两种全文转发均 false |
| `pboc-xiamen-work` | `https://xiamen.pbc.gov.cn/xiamen/127699/index.html` | `td:has(> span.newslist_style)`；link `a[href]`；title `a`；date `span.hui12` | `web_list`、T1、`enabled=false`、两种全文转发均 false |

未配置的来源不会以猜测 selector 的方式占位。所有 source 的 collector 运行、分页完备性、稳定性、去重和噪声率都留待 P3 验收；这份矩阵只记公开页面结构核验结果。

## 详情页正文与日期解析检查

对四条已配置 source 的代表性文章做了只读 HTTP 读取，并以项目 `readable()` 同一 Readability 提取函数作本地可读性检查；只记录长度和元数据，不将公开全文复制到日志或发布内容。四个样本都返回 HTTP 200，正文提取长度分别为财政部预算司 2,272 字符、福建省财政厅 421 字符、厦门市财政局 205 字符、人民银行厦门市分行 1,745 字符，均超过提取器 200 字符下限。该检查证明样本详情页有可提取正文，不代表 collector worker 已通过；P3 才在禁用安全开关控制下做真实 collector 验证。source 配置没有额外设置 `config.detail` / `summarySelector`，避免凭页面猜测详情摘要字段；正文走既有文章内容提取链。`site_fulltext` 和 `syndicate_fulltext` 保持关闭。

2026-09-29T03:36Z 获取的四份列表与详情 HTML 已保存为忽略目录 `.data/fiscal-source-audit/` 离线 fixture，并调用实际 `fromHtml()` 与 `readable()` 纯解析函数复验（不调用 `fetchWebList()` / `collectSource()`；不访问数据库、队列、worker、模型或付费 fallback）。四源分别解析出 10、5、15、20 条候选；标题和日期字段完整；允许 URL 前缀外为 0；各页 href 无重复。福建厅 5 条中 2 条是 PDF 地址。人行厦门静态页面显示“下一页/尾页”但没有 `href`，与需要 JS 的分页观察一致。机器摘要见 ignored 文件 `.data/fiscal-source-audit/offline-parser.json`；这是离线 fixture parser 结果，不是 collector 抓取通过或稳定性验收。

## Gate 1 核销后的单次受限 live preview

2026-09-29T03:43Z 在 Lead 核销 Gate 1 后，使用现有 `admin.previewSource()` 单次读取四个 source；该函数代码注释和实现确认它仅返回候选、不存储。路径复用真实 `fetchWebList()` 的 HTML 列表读取与解析，但没有调用会写入 `fetch_runs`、更新 cursor 或 enqueue 的 `collectSource()` / `scripts/collect.ts`。每源只请求配置列表 URL 一次；`fetchWebList` 的列表请求超时 25 秒、HTTP 非 200 会报错且不重试。本轮四个列表请求均成功（该 API 在成功路径只可能接收 HTTP 200），各页候选数为 10、5、15、20；完整标题/日期率 100%，候选 href 均唯一。没有翻页：每次只解析当前 URL 返回的 HTML，collector 不会跟随页面分页。

随后每源最多请求 3 条后缀为 `.htm` / `.html` / `.shtml` 的非 PDF 详情；单条超时 15 秒、最多 2 MiB、最多 3 次重定向，不重试。福建省财政厅原始返回的 5 条候选里有 2 条 PDF，均从详情抽样中跳过；未尝试任何 PDF。抽样共 12 个 HTML 详情请求，12/12 HTTP 200、12/12 列表与详情日历日期一致，Readability 正文超过 200 字符为 10/12。预算司有一页、厦门债务有一页在 200 字符门槛下，显示采集到记录后仍可能无法确认正文。列表标题与详情标题 11/12 完全相同；人行厦门余下 1 条列表标题以省略号截短，详情题名是其完整展开，核实为同一标题。原始列表该链接的 `title` 属性包含完整标题，但现有 `fromHtml()` 优先取可见链接文本，`web_list` 配置 schema 没有“从属性取标题”的选项，不能单靠本次信源配置改正；本轮不改通用解析器。

本次 preview 使用的是只含免费、受 SSRF 防护的 `guardedFetch()` 公开 HTTP GET 与本地 Readability；URL 不以 Jina 开头，代码路径没有调用 `jinaRead()`、其他付费 provider、receipts、模型、数据库、队列或 worker。启动进程显式将 `COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`INDEXNOW_SUBMIT_ENABLED` 及两个 `FEISHU_*_ENABLED` 设为 false，四条持久 source 仍全部 `enabled=false` 且全文开关关闭。preview 报告与请求摘要保存在 ignored `.data/fiscal-source-audit/collector-preview.json`。这是每源一次受限 preview 的证据，不代表持久 collector/分页/重复/长期稳定性验收；上述弱正文页、PDF、预算司新鲜度和分页限制仍待 P3 解决。

已检查 `parseLooseDate`：它先调用 `Date.parse()`，只有失败时才以默认 `+08:00` offset 解析。当前 Node 运行时为 `Asia/Shanghai`，日期-only 值（如 `2026-09-14`）会被直接解析成 UTC 零点；带时间但无时区的值（如厦门财政 `2026-09-11 16:02`）会被 Node 按运行时本地时区解析成 `2026-09-11T08:02:00Z`。因此 source 的日期-only UTC 时间比北京时间零点晚 8 小时，且无时区时间依赖运行时 `TZ`；它们的中国日历日期不变，但 freshness cutoff 接近边界时可能最多偏移 8 小时。本轮没有新增 `publishedAtUtcOffset`，因为该参数不会覆盖 `Date.parse()` 已接受的这些格式。P3 需用真实 collector 结果复核 cutoff/展示时区是否符合预期。
