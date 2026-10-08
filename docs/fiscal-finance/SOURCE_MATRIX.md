# 官方信源验证矩阵

本矩阵区分页面结构、只读 preview 与隔离数据库验证。原九个 HTML 来源的 `previewSource` 和一个 JSON 来源的 `fetchJsonList` 是早期 dry-run 阶段，并不代表采集器写库。随后三源在隔离 `_test` 数据库做30篇backfill两轮验证，最新正文汇总29 `ok`、1 `unconfirmed`、0 `pending`，30个 `content.extract-body` jobs未消费，详见 `P3_INGEST_VALIDATION.md`。另对 `pboc-open-market` 第191号和第192号分别完成单篇受控两轮验证；9/30又以第192号提供一次跨日首页变化证据，分别见 [P3_OMO_VALIDATION.md](P3_OMO_VALIDATION.md) 与 [P3_OMO_FRESHNESS_2026-09-30.md](P3_OMO_FRESHNESS_2026-09-30.md)。区域两源已完成固定URL隔离写入/正文核验，以及两页相邻历史页只读验证，详见 [P3_REGIONAL_COLLECTOR_VALIDATION.md](P3_REGIONAL_COLLECTOR_VALIDATION.md)、[P3_REGIONAL_BODY_VALIDATION.md](P3_REGIONAL_BODY_VALIDATION.md) 与 [P3_REGIONAL_PAGING_VALIDATION.md](P3_REGIONAL_PAGING_VALIDATION.md)。这些证据均有明确单篇/单日/分页边界，不自动构成来源整体稳定或 Gate 2。当前工作树 `industry/sources.json` 有32个来源（31个HTML、1个JSON），全部 `enabled=false`，两项全文许可均关闭；地方监管局配置中精确14个 strict body-ready opt-in ID。新增大连、宁波、深圳、青岛、甘肃五项的配置和严格ID回归尚处同一待冻结工作批次，未运行最终full QA或CI；preview数据库仍仅有原3条disabled source，JSON尚未seed入库。新保存证据及限制见[P3剩余来源缺口](P3_REMAINING_SOURCE_GAPS_2026-10-07.md)和[逐局覆盖矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)。Gate 2仍 `NOT_PASSED`。

## P3 新增：财政部各地监管局动态（2026-09-29）

用户新增全国财政部各地监管局新闻动态覆盖要求。本轮在原十个来源基础上新增两个 disabled `web_list` 配置；没有新增监管局实体或主题页。完整官方入口、原始快照说明、35局目录清单及配置边界见[来源调查记录](REGIONAL_SUPERVISION_SOURCES.md)。目录显示35个局，但只有以下中央选登栏目及厦门局栏目经过本轮实际 HTML/parser 检查；不能将目录核对说成35局栏目核验。

| source ID | 实际候选页与配置解析 | 本轮有限验证 | 边界 |
|---|---|---|---|
| `mof-regional-supervision-dynamics` | 财政部“财政新闻”列表 `https://www.mof.gov.cn/zhengwuxinxi/caizhengxinwen/index.htm`；selector `ul.xwfb_listbox > li:has(a[title*='监管局'])`，标题读 `a[title]`，日期读同项 `span`；35个已核目录域名用于 HTTP allowlist。 | 初次保存首页25项筛7项；固定广西URL隔离collector两轮 `1/1/0 → 1/0/0`、正文 `ok/rev2` 1,720字。分页快照首页/第2页8/7、跨页URL重复0、北京历史正文1,832字。新全首页隔离批次完整配置两轮 `8/8/8/0 → 8/8/0/0`；8篇正文均 `ok/rev2`。 | 机器批次只抓首页，已声明20页，本轮仅核相邻页。厦门短正文、长期freshness、深页重复及其他局覆盖仍待核；中央栏目为选登非35局全量。与厦门当前首页三种候选比较无匹配；两源候选 `identityKey` overlap 0，因此跨源去重实测为unknown。批次预定28 hop上限，但 dispatch hook 未观测到请求；过程至少25次guarded fetch，重定向总hop未知，不能记预算通过。福建独立栏目两次502。见 [分页报告](P3_REGIONAL_PAGING_VALIDATION.md)、[全首页批次报告](P3_REGIONAL_BATCH_2026-09-30.md)；原始HTML/hash在ignored `.data/fiscal-regional-batch-20260930/` 与 `.data/fiscal-regional-paging-validation/`。 |
| `mof-xiamen-supervision-dynamics` | 厦门监管局“工作动态” `https://xm.mof.gov.cn/caizhengjiancha/index.htm`；`ul.liBox > li`，标题读链接`title`（缺失回退文本）、日期同项`span`，URL限制栏目路径。 | 固定普惠金融URL两轮 `1/1/0 → 1/0/0`，正文 `ok/rev2` 1,935字。分页快照当前/历史页10/10、跨页URL重复0，历史正文1,979字。新全首页批次完整配置两轮 `10/10/10/0 → 10/10/0/0`；10篇正文均 `ok/rev2`。 | 页面声明10页但只核过相邻历史页，collector仍只抓首页；短正文需逐篇复核、未与详情PubDate逐条对照，长期freshness、深页重复及噪声率未验。与中央候选集本次无相同identityKey，跨源collector去重结果unknown。共用regional batch报告：HTTP硬预算28 hop无法证明（至少25个guarded fetch调用、实际redirect hop未知）；不记预算PASS，不推断长期稳定。原始HTML/hash在ignored `.data/fiscal-regional-batch-20260930/` 与 `.data/fiscal-regional-paging-validation/`。 |

福建监管局列表/详情有界请求两次均为 HTTP 502，虽中央财政新闻快照选登一篇福建局稿件，本轮没有足够本地列表快照证据来配置福建独立源。中央更专用的“全国财政新闻联播 > 财政部”栏目本次快照陈旧，未采用。全国35局目录仅用于确认官方机构域名和中央来源的链接 allowlist，不推断其它33个局已有可用动态栏目。新增两源均为 T1、每360分钟、`enabled=false`、站内/RSS全文均关闭；具体来源与限制见[来源调查记录](REGIONAL_SUPERVISION_SOURCES.md)。Gate 2 仍未通过，本轮没有开启 worker、模型或大规模采集。

状态含义：

- **结构已核验，待 P3**：直接读取了列表与至少一篇文章，确认标题、日期、详情链接及 URL 范围；还未运行项目 collector。
- **待核验**：只找到官方入口/检索结果，或请求受阻；没有足够证据编写 selector，因此不进入 sources.json。

| 首批来源 | 列表页 / 入口 | 页面与结构证据 | 分页、噪声、历史、重复观察 | 当前状态 |
|---|---|---|---|---|
| 财政部预算司 | [工作动态](https://yss.mof.gov.cn/gongzuodongtai/) | Node fetch 直连 HTML 返回 200；当前配置首页10条，`ul.liBox > li`，链接 `a[href]`、标题 `a`、日期 `span`。固定详情样本 [2026-03-26](https://yss.mof.gov.cn/gongzuodongtai/202603/t20260326_3986132.htm) 元数据及正文可见，列表与详情字段吻合。完整配置隔离库两轮 `10/1/1/0 → 10/10/9/0`（found/accepted/created/revised），实际第二轮补入首页的9篇更早文章；正文尝试范围与待核数见批次报告。 | 日期新到旧为2026-03-26至2023-07-24，第二页有2023/2022历史项。首轮12个月窗口只留1条，第二轮因cursor初始化读取更多旧文；不能把首轮上限当成所有后续同步限制。会议等栏目噪声、长期更新/首页滑窗、页间深度仍待审。P3批次HTTP hop预算没有被工具证实。 | **结构与完整首页两轮候选已核验；来源稳定性/正文质量仍待 P3/Gate 2**；disabled `mof-budget-work` |
| 财政部（综合政策发布） | [政策发布](https://zhs.mof.gov.cn/zhengcefabu/) | Node `guardedFetch` 直连 HTTP 200，14,521 字节；实际 `ul.liBox > li` 命中 10 篇，标题为链接文本/`title`、日期为 `span`。最新条目为《中华人民共和国财政部公告2026年第24号》（2026-08-26），详情 HTTP 200，`ArticleTitle` 与列表一致、`PubDate=2026-08-26 10:22:00`，Readability 4,024 字符。10 个列表候选链接唯一。 | 页面有 `createPageHTML(50, 0, "index", "htm")` 分页脚本；当前配置仅读首页。首页日期截至 2026-08-26，已有约 34 天的新鲜度间隔；栏目含彩票等综合财政内容，需精选。 | **结构与一次性 collector preview 已核验；禁用待 P3/Gate 2**；已配置 disabled `mof-policy-release` |
| 中国政府网 | [国务院政策文件库](https://sousuo.www.gov.cn/zcwjk/policyDocumentLibrary?t=zhengcelibrary_gw)，[部门文件页](https://www.gov.cn/zhengce/zhengceku/bmwj/home.htm) | 政策文件库两类查询参数均 HTTP 200，但响应只有 974 字节 JS 壳，无列表/详情链接。静态部门文件页 HTTP 200、32,713 字节，`ul` 中 64 项，抽出的部门文件列表候选 38 个详情链接；首页最新可见文件日期为 2026-02-02。样本详情 `https://www.gov.cn/zhengce/zhengceku/202602/content_7056817.htm` HTTP 200，标题完整。 | 当前静态部门页约落后核验日 8 个月；未确认分页、去重和适合作财政金融持续源的当前内容。动态政策库未返回可供当前 collector 解析的静态列表。 | **待核验：动态列表能力和静态页新鲜度阻塞；不配置** |
| 财政部金融司 | [工作通知](https://jrs.mof.gov.cn/gongzuotongzhi/) | Node `guardedFetch` HTTP 200，12,929 字节，`ul.liBox > li` 命中 10 篇；最新为《关于公布2026年中央财政支持普惠金融发展示范区名单等有关事项的通知》（2026-07-16）。详情 HTTP 200，列表/`ArticleTitle` 完全一致、`PubDate=2026-07-16 16:09:00`，Readability 1,493 字符。单次 `previewSource` 返回 10 候选。 | 页面采用 `createPageHTML(21, 0, "index", "htm")`，仅核验首页，没有跟页；最新可见条目为 7 月 16 日，需复核新鲜度。工作动态页最新日期仅至 6 月 8 日，故本次选择内容更明确的工作通知栏目。 | **结构与一次性 collector preview 已核验；禁用待 P3/Gate 2**；已配置 disabled `mof-finance-notices` |
| 财政部会计司 | [工作通知](https://kjs.mof.gov.cn/gongzuotongzhi/) | Node `guardedFetch` HTTP 200，14,018字节；当前 parser命中10篇。最新征求意见函列表 `span=2026-09-22`、详情 `PubDate` 与正文发布日期同为9/22，UTC `2026-09-21T16:00:00Z`按+08:00为9/22，文书落款9/17；既有固定正文473字符。完整配置隔离批次两轮 `10/10/10/0 → 10/10/0/0`。本批受限抽正文中会计司10篇有5 `ok`、5 `unconfirmed`，详细URL见报告，失败原因unknown。 | 一天间复读不证明跨周期freshness。仅5/10首页候选可与9/29完整旧快照精确比对，其余旧输出为代表样本不能还原完整10项。噪声率、历史重复和更多正文待审；机器 `ok` 不是字段完整性验收。计数hook失效导致本批HTTP hop总数unknown，预算不能PASS。原日期差异为UTC日/URL误读，已纠正。 | **结构与整页两轮候选已核验；来源稳定性/正文完整性仍待 P3/Gate 2**；disabled `mof-accounting-notices` |
| 中国地方政府债券信息公开平台 | [平台首页](https://www.celma.org.cn/)，[发行结果栏目](https://www.celma.org.cn/fxjg/index.jhtml)，[发行安排栏目](https://www.celma.org.cn/dfzfxjh/index.jhtml) | 平台首页 HTTP 200、51,168 字节，官方站名可见且确有债券信息入口。发行结果及发行安排栏目直连均 HTTP 200、73,642 字节，返回相同通用模板；其中 114 个 `<li>` 是导航/选项，不含可解析发行文章链接。首页能直接链接到“2026年10月江西省债券发行安排公开”详情 `https://www.celma.org.cn/dfzfxjh/70535.jhtml`（HTTP 200），但未找到与之配套的静态栏目列表行/发布日期。 | 栏目由模板内脚本呈现筛选/数据，通用列表响应缺真实行；详情页可访问但普通列表 collector 无法发现候选。已找到的交易/报告链接横跨平台与财政部子站，不能据首页混合链接拼成稳定的发行结果 selector。 | **待核验：列表以动态数据呈现、无稳定 HTML 候选；不配置** |
| 中国人民银行 | [公开市场业务交易公告](https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/index.html) | 官方主页及栏目 HTTP 200；静态栏目 40,079 字节，`tr:has(font.newslist_style)` 命中 20 条，链接含标题及 `title` 属性，`span.hui12` 为日期。列表最新为 2026-09-29 第191号。第[191号详情](https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/2026092908461628271/index.html) HTTP 200、`ArticleTitle` 与列表一致、`PubDate=2026-09-29`。配置启用 `titleAttribute=title` 后，一次 `previewSource` 返回 20 候选且标题完整；`+08:00` 解析得到上海日历日 2026-09-29。 | 首页候选为逐日逆回购操作公告，href 唯一且栏目 URL 可限制在 `/zhengcehuobisi/125207/125213/125431/125475/`；未实测栏目分页。第191号正文容器约 162 字，低于 Readability 200 字阈值，所以 `readable()` 为 `null`、preview 显示 0；这不是页面无正文。按 AD-009 将 `#zoom` 作为唯一正文容器、显式启用 `allowShortBody` 后，以本地快照运行共享 `extractSelectedBody` 得到 174 字文本、1 张表格，核对到 7 天、1.40%、905 亿元和 6,985 亿元；题名与 `PubDate=2026-09-29` 均匹配。此项是离线 helper 验证，不是 collector/worker 运行。相邻[第190号详情](https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/2026092808454683233/index.html)正文容器约 204 字，Readability 为 210，显示日常公告在门槛附近波动。保留原门槛，source 继续 disabled。只读 HTML 证据见忽略目录 `.data/fiscal-central-audit/html/pboc-omo-detail.html`、`pboc-omo-detail-190.html` 和 `inspect-omo-second.json`。 | **列表与详情结构已核验；共享短正文 helper 离线验证通过，仍禁用待质量复核**；已配置 disabled `pboc-open-market` |
| 财政部国库司（统计数据） | [统计数据](https://zwgls.mof.gov.cn/tjsj/) | Node `guardedFetch` HTTP 200，12,330 字节；`ul.liBox > li` 命中 10 条，最新为《2026年8月地方政府债券发行和债务余额情况》（列表日 2026-09-24）。详情 HTTP 200，`ArticleTitle` 一致、`PubDate=2026-09-24 14:52:00`，Readability 1,021 字符。一次 `previewSource` 解析 10 个候选，最新候选日期在 `+08:00` 下保持 9 月 24 日。 | 首页 `createPageHTML(3, 0, "index", "htm")`；直接检查 `index_1.htm` HTTP 200、再有 10 条，最新为 2025 年 10 月；第二页含 PDF 和中央政府收支统计等异类条目，当前配置仅读首页。分页/旧页混有附件与宽口径收支数据，保持 disabled，后续需噪声与正文边界验收。 | **结构与一次性 collector preview 已核验；禁用待 P3/Gate 2**；已配置 disabled `mof-treasury-debt-data` |
| 厦门证监局 | [监管工作首页](https://www.csrc.gov.cn/xiamen/)，[动态列表壳](https://www.csrc.gov.cn/xiamen/c101757/common_list.shtml?channelid=ffe0f9a9de42484cb218be2fd18116d0) | 首页 HTTP 200、`div.szyw-lists li` 7 条，最新静态新闻日期 2026-09-15；“加载更多”列表壳 HTTP 200 但无静态列表。官方 `common_list.js` 指向 API。page1 JSON HTTP 200、`data.total=399`、20 条，page2 HTTP 200、20 条；两页 URL 无重叠。JSON 项含 `title`、`content`、`url`、`publishedTime`（epoch 毫秒）、`publishedTimeStr`。按当前 `json_list` 配置调用真实 `fetchJsonList()`，page1 得到 20 候选，首条 allow 前缀内、摘要 944 字；详情 HTTP 200，`ArticleTitle` 一致、`PubDate=2026-09-28 14:31:07`、Readability 951 字。 | 首条 `publishedTime=1790548212000` 的绝对瞬时为 2026-09-27T22:30:12Z；`publishedTimeStr=2026-09-28 14:30:12` 按 `+08:00` 是 2026-09-28T06:30:12Z，两种字段相差 8 小时；配置使用字符串和显式 offset，不使用 epoch。另一条 `c7658572` 的 API/首页列表日为 2026-09-15，详情 meta `PubDate=2026-09-23 17:33:09`；选择列表公布日作为原始候选发布时间，因为 API 时间串与首页显示一致，详情 `PubDate`/生成时间含义未知；该API字符串样本与正文可见日均9/15，当前source映射未读详情元数据。详见 [P3_DATE_COVERAGE_AUDIT.md](P3_DATE_COVERAGE_AUDIT.md)。page2 回溯至 2024-12-09；collector 不自动跟页，固定 page1 只覆盖最新 20 条，需在 P3 判断间隔是否足以避免漏项。 | **结构与一次性 `fetchJsonList` 预览已核验；详情生成元数据语义和分页限制待 P3**；已配置 disabled `xiamen-csrc-regulatory-work` |
| 国家金融监督管理总局 | [新闻资讯栏目](https://www.nfra.gov.cn/cn/view/pages/xinwenzixun/xinwenzixun.html) | 官方新闻页和 `ItemDetail.html?docId=...&itemId=...` 都 HTTP 200，但列表 HTML 是 JS 壳。读取页面自带官方脚本后，确认列表通过 GET `/cbircweb/DocInfo/SelectItemAndDocByItemPId?itemId=914&pageSize=6` 获取 JSON，`rptCode=200`，响应嵌套分类和各分类 `docInfoVOList`；其中“监管动态”日期至 2026-09-28。官方 `ItemDetail.js` 明确还会 GET `/cbircweb/DocInfo/SelectByDocId?docId=...`。示例详情 HTML 本身 `ArticleTitle`/`PubDate` 为空，内容由客户端加载；JSON 详情接口返回数据，但它不是当前普通 `web_list`/HTML 详情解析链。 | API list 只有分类子数组和不一致的外链/站内 `docId` URL，不能用当前 `json_list` 的静态单数组模板可靠表达该响应；P3 还需核详情 JSON 编码及正文字段与既有安全/内容流程的兼容性。未试图增加通用 JSON 详情能力或外部 adapter。 | **待核验：有官方动态 JSON，但需适配器/详情链能力；不配置** |
| 福建省财政厅 | [通知公告](https://czt.fujian.gov.cn/zwgk/tzgg/) | 列表 200；当前配置 selector `div.list_base_date_01[ms-visible="$showStatic(1)"] li` 命中首页静态 5 条，最新 2026-09-29；详情 200，`ArticleTitle`/`PubDate` 和 `span.article_time` 可用。 | HTML 共见 22 个 `div.list_base_date_01` 区块、108 条记录，以 `$showStatic(1/6/11…)` 分页组预渲染；当前 source 锁定第一页 5 条，不会扫旧档。首页有 2 个 PDF，范围请求确认 `206 application/pdf`；通用 `denyUrlPrefixes` 只按 `startsWith`，不能按扩展名过滤。继续保持 disabled，PDF 不送付费 fallback。 | **结构已核验；分页覆盖和PDF需P3规则**；已配置 disabled `fujian-finance-notices` |
| 厦门市财政局 | [地方政府债务](https://cz.xm.gov.cn/zwxx/czsj/dfzxx/) | 列表 200、`div.list_base_date_01 li` 命中 15 条；覆盖 2026-05-08 至 2026-09-11。详情 `https://cz.xm.gov.cn/zwxx/czsj/dfzxx/202609/t20260911_3016829.htm` 200，标题/链接吻合。Readability 205 字曾被标 `ok`，DB正文复核发现仅标题/日期、“扫一扫”提示及页尾，无招标结果。`.Custom_UnionStyle` 唯一命中26字；共享helper返回 `attachments_unprocessed`，唯一PDF位于此容器外。disabled source 当前仅配置 `detail.bodySelector='.Custom_UnionStyle'`，不设short opt-in/PDF路径。 | 首页未见分页href，当前静态页15条；固定样本隔离双轮首轮创建、次轮判重，只证明URL幂等，不验证其余候选或长期覆盖。 | **列表单条双轮完成；正文质量假阳性阻塞Gate 2，保持disabled**；已配置 disabled `xiamen-finance-debt` |
| 人民银行厦门市分行 | [工作动态](https://xiamen.pbc.gov.cn/xiamen/127699/index.html) | 首页 200，`td:has(> span.newslist_style)` 命中 20 条；详情 200，`ArticleTitle`、`PubDate` 与页面吻合。使用已落地的 `titleAttribute=title` 后，2026-09-11 “手册……正式发…”候选读取完整 `title` 属性。正文抽样 518 至 1,745 字。 | 首页显示 663 条、34 页；下一页 onclick 给出静态地址 `/xiamen/127699/17318-2.html`，该页直连 HTTP 200 且同 selector 命中 20 条、无 page1 href 重复。本 collector 仍只请求配置首页。列表内链接正文附件不是单独候选。 | **结构与第二页抽查已核验，collector仍只读首页**；已配置 disabled `pboc-xiamen-work` |

## 已配置来源字段

| ID | 实际列表 URL | selector（按已读 HTML） | 当前运行设置 |
|---|---|---|---|
| `mof-budget-work` | `https://yss.mof.gov.cn/gongzuodongtai/` | `ul.liBox > li`；link `a[href]`；title `a`；date `span` | `web_list`、T1、`enabled=false`、两种全文转发均 false |
| `fujian-finance-notices` | `https://czt.fujian.gov.cn/zwgk/tzgg/` | `div.list_base_date_01[ms-visible="$showStatic(1)"] li`；link `a[href]`；title `a`；date `span.bf-pass` | `web_list`、T1、`enabled=false`、两种全文转发均 false |
| `xiamen-finance-debt` | `https://cz.xm.gov.cn/zwxx/czsj/dfzxx/` | `div.list_base_date_01 li`；link `a[href]`；title `a`；date `span`；detail bodySelector `.Custom_UnionStyle` | `web_list`、T1、`enabled=false`、两种全文转发均 false |
| `pboc-xiamen-work` | `https://xiamen.pbc.gov.cn/xiamen/127699/index.html` | `td:has(> span.newslist_style)`；link `a[href]`；title `a`；date `span.hui12` | `web_list`、T1、`enabled=false`、两种全文转发均 false |
| `mof-policy-release` | `https://zhs.mof.gov.cn/zhengcefabu/` | `ul.liBox > li`；link/title `a`；date `span`；UTC offset `+08:00` | `web_list`、T1、`enabled=false`、两种全文转发均 false |
| `mof-finance-notices` | `https://jrs.mof.gov.cn/gongzuotongzhi/` | `ul.liBox > li`；link/title `a`；date `span`；UTC offset `+08:00` | `web_list`、T1、`enabled=false`、两种全文转发均 false |
| `mof-accounting-notices` | `https://kjs.mof.gov.cn/gongzuotongzhi/` | `ul.liBox > li`；link/title `a`；date `span`；UTC offset `+08:00` | `web_list`、T1、`enabled=false`、两种全文转发均 false |
| `pboc-open-market` | `https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/index.html` | `tr:has(font.newslist_style)`；link/title `a`，`titleAttribute=title`；date `span.hui12`；UTC offset `+08:00` | `web_list`、T1、`enabled=false`、两种全文转发均 false |
| `mof-treasury-debt-data` | `https://zwgls.mof.gov.cn/tjsj/` | `ul.liBox > li`；link/title `a`；date `span`；UTC offset `+08:00` | `web_list`、T1、`enabled=false`、两种全文转发均 false |
| `xiamen-csrc-regulatory-work` | `https://www.csrc.gov.cn/searchList/ffe0f9a9de42484cb218be2fd18116d0?...&page=1` | `itemsPath=data.results`；title `title`；date `publishedTimeStr` + `publishedAtUtcOffset=+08:00`；URL `https:{raw:url}`；`content` 为摘要 | `json_list`、T1、`enabled=false`、两种全文转发均 false |

未配置的来源不会以猜测 selector 的方式占位。中国政府网、地方债平台、金融监管总局仍因上表列明的结构或 collector 能力阻塞而未配置；厦门证监局 source 虽已配置但保持 disabled，日期元数据冲突与分页限制仍待 P3。所有 source 的长期分页完备性、稳定性、去重和噪声率都留待 P3 验收；这份矩阵只记公开页面结构和一次性只读 preview 结果。

## 详情页正文与日期解析检查

对四条已配置 source 的代表性文章做了只读 HTTP 读取，并以项目 `readable()` 同一 Readability 提取函数作本地可读性检查；只记录长度和元数据，不将公开全文复制到日志或发布内容。四个样本都返回 HTTP 200，正文提取长度分别为财政部预算司 2,272 字符、福建省财政厅 421 字符、厦门市财政局 205 字符、人民银行厦门市分行 1,745 字符，均超过提取器 200 字符下限。该检查证明样本详情页有可提取正文，不代表 collector worker 已通过；P3 才在禁用安全开关控制下做真实 collector 验证。source 配置没有额外设置 `config.detail` / `summarySelector`，避免凭页面猜测详情摘要字段；正文走既有文章内容提取链。`site_fulltext` 和 `syndicate_fulltext` 保持关闭。

2026-09-29T03:36Z 获取的四份列表与详情 HTML 已保存为忽略目录 `.data/fiscal-source-audit/` 离线 fixture，并调用实际 `fromHtml()` 与 `readable()` 纯解析函数复验（不调用 `fetchWebList()` / `collectSource()`；不访问数据库、队列、worker、模型或付费 fallback）。四源分别解析出 10、5、15、20 条候选；标题和日期字段完整；允许 URL 前缀外为 0；各页 href 无重复。福建厅 5 条中 2 条是 PDF 地址。人行厦门静态页面显示“下一页/尾页”但没有 `href`，与需要 JS 的分页观察一致。机器摘要见 ignored 文件 `.data/fiscal-source-audit/offline-parser.json`；这是离线 fixture parser 结果，不是 collector 抓取通过或稳定性验收。

## Gate 1 核销后的单次受限 live preview

2026-09-29T03:43Z 在 Lead 核销 Gate 1 后，使用现有 `admin.previewSource()` 单次读取四个 source；该函数代码注释和实现确认它仅返回候选、不存储。路径复用真实 `fetchWebList()` 的 HTML 列表读取与解析，但没有调用会写入 `fetch_runs`、更新 cursor 或 enqueue 的 `collectSource()` / `scripts/collect.ts`。每源只请求配置列表 URL 一次；`fetchWebList` 的列表请求超时 25 秒、HTTP 非 200 会报错且不重试。本轮四个列表请求均成功（该 API 在成功路径只可能接收 HTTP 200），各页候选数为 10、5、15、20；完整标题/日期率 100%，候选 href 均唯一。没有翻页：每次只解析当前 URL 返回的 HTML，collector 不会跟随页面分页。

随后每源最多请求 3 条后缀为 `.htm` / `.html` / `.shtml` 的非 PDF 详情；单条超时 15 秒、最多 2 MiB、最多 3 次重定向，不重试。福建省财政厅原始返回的 5 条候选里有 2 条 PDF，均从详情抽样中跳过；未尝试任何 PDF。抽样共 12 个 HTML 详情请求，12/12 HTTP 200、12/12 列表与详情日历日期一致，Readability 正文超过 200 字符为 10/12。预算司有一页、厦门债务有一页在 200 字符门槛下，显示采集到记录后仍可能无法确认正文。列表标题与详情标题 11/12 完全相同；人行厦门余下 1 条列表标题以省略号截短，详情题名是其完整展开，核实为同一标题。原始列表该链接的 `title` 属性包含完整标题，但现有 `fromHtml()` 优先取可见链接文本，`web_list` 配置 schema 没有“从属性取标题”的选项，不能单靠本次信源配置改正；本轮不改通用解析器。

本次 preview 使用的是只含免费、受 SSRF 防护的 `guardedFetch()` 公开 HTTP GET 与本地 Readability；URL 不以 Jina 开头，代码路径没有调用 `jinaRead()`、其他付费 provider、receipts、模型、数据库、队列或 worker。启动进程显式将 `COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`INDEXNOW_SUBMIT_ENABLED` 及两个 `FEISHU_*_ENABLED` 设为 false，十条持久 source 仍全部 `enabled=false` 且全文开关关闭。preview 报告与请求摘要保存在 ignored `.data/fiscal-source-audit/collector-preview.json`。这是每源一次受限 preview 的证据，不代表持久 collector/分页/重复/长期稳定性验收；上述弱正文页、PDF、预算司新鲜度和分页限制仍待 P3 解决。

Gate 1 后 collector 已实现 `publishedAtUtcOffset` 的墙钟时间解析；十条 source 均明确配置 `+08:00`，日期-only `2026-09-29` 解析为上海零点对应的 UTC 时间 `2026-09-28T16:00:00Z`，有时分的 `2026-09-29 09:56` 按同一 offset 解释，不依赖 Node 的本地 `TZ`。其中 PBOC 公开市场、人行厦门和国库司统计单次 preview 已复核日历日期，其他来源还需在 P3 验证实际 collector 的 freshness cutoff 与展示。


## 中央信源一次性 preview 和日期/正文检查

2026-09-29 对九个已配置 HTML source 各调用至少一次 `admin.previewSource()`；人行厦门为确认 `titleAttribute` 对截断项有效额外预览一次。九源候选数依序为预算司 10、福建厅 5、厦门财政 15、人行厦门 20、财政部综合 10、金融司 10、会计司 10、人民银行公开市场 20、国库司统计 10；标题/日期均被当前 selector 解析。厦门证监局 JSON source 另单次调用 `fetchJsonList()`，解析 20 条，首条 China-local day 为 2026-09-28；所有候选均在明确 allow 前缀内。请求均为单次免费 HTTP GET，超时有界，未跟页、不重试、不执行 `collectSource()`、数据库写入、队列、worker、模型或 Jina。摘要证据保存在忽略目录 `.data/fiscal-central-audit/collector-preview-once.json`。

从每个 HTML source 的首条候选各抽一条详情（HTML GET 单次、有界、跳过 PDF）核验：九条均 HTTP 200，标题均匹配，Readability 长度依次为 2,272、629、205、1,745、4,024、1,493、473、0、1,021 字符。厦门证监局 JSON 首条再抽一条详情 HTTP 200，列表与 `ArticleTitle` 一致，Readability 951 字。人民银行公开市场第191号公告的列表、`ArticleTitle`、`PubDate` 相符；补充检查正文容器约 162 字，低于 Readability 的 200 字符阈值，所以提取返回 `null`、preview 显示 0，并非官方页面没有正文。相邻第190号公告正文容器约 204 字，Readability 为 210，显示例行公告正好在阈值附近波动；不降低既有阈值，来源保持 disabled。会计司此前的“列表9/21、详情9/22”已由 [P3_DATE_COVERAGE_AUDIT.md](P3_DATE_COVERAGE_AUDIT.md)更正：列表span、详情PubDate及可见发布日期均为9/22；不再作为日期冲突。厦门财政详情日期字段带“时间：”前缀，本次只读样本脚本未将其规范化比较；既有矩阵曾记录其详情日期同为 9 月 11 日，不据这次未规范化比较判定为差异。人民银行厦门启用 `titleAttribute=title` 后，preview 标题保持完整；十源 `+08:00` 已配置，preview 日期按中国本地日解释。机器样本摘要保存在忽略目录 `.data/fiscal-central-audit/verified-samples.json`，不包含页面正文。

## P3 三源隔离数据库真实 collector 两轮验证

2026-09-29 在独立 `fiscalhot_ingest_test` 数据库上，对财政部综合政策、财政部金融司、财政部国库司统计逐源各执行两次 `scripts/collect.ts <source-id>`。数据库内暂时导入仓库配置后启用三行；每源原列表页实际返回 10 条，source 配置和全文许可未更改。每次运行只发一条免费列表 GET；无详情请求、翻页、worker、API、Jina、模型或通知。`COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`JINA_BODY_FALLBACK`、IndexNow 与飞书开关全程 false。

| Source ID | P3 第 1 轮 | P3 第 2 轮 | 存储发布时间范围（上海日历日） | freshness 提醒 |
|---|---:|---:|---|---|
| `mof-policy-release` | 10 found / 10 new / 0 revised | 10 / 0 / 0 | 2026-05-09 — 2026-08-26 | 截至 9 月 29 日，列表最新项已约 34 天；不视作每日更新源，P3 需复核栏目活跃度 |
| `mof-finance-notices` | 10 / 10 / 0 | 10 / 0 / 0 | 2025-12-12 — 2026-07-16 | 截至 9 月 29 日，最新项约 75 天；新鲜度风险较高，需检查备用栏目或降低实际更新频率预期 |
| `mof-treasury-debt-data` | 10 / 10 / 0 | 10 / 0 / 0 | 2025-12-30 — 2026-09-24 | 最新条目约 5 天，仍需后续周期验证 |

三源共 6 次运行均 `status=ok`；SQL 核实 30 篇文章各有唯一 URL 与 identity key，30 篇均为首导入 backfill；三源均保持 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`。第二轮均未创建或修订条目。该次入库后所有文章均为 `body_status=pending`；队列中有 30 个未消费 `content.extract-body` job，无分析 job，`receipts=0`。隔离 DB 和机器核验输出保存在 Git 忽略目录 `.data/fiscal-qa/`。这是当时的 ingest 快照。之后曾先验证 6 篇（5 `ok`、1 `unconfirmed`、24 `pending`），再扩展验证完整 30 篇；这两个均为历史阶段。最新单篇复验将一篇从 rev1 `unconfirmed` 更新为 rev2 `ok`、正文 1,454 字；其余 SQL 汇总为 29 `ok`、1 `unconfirmed`、0 `pending`。队列仍有 30 个未消费 job、无分析 job，`receipts=0`。fresh 全回归完成并通过，Gate 2 未通过。
## P3 OMO 第191号受限 collector 两轮验证（2026-09-29）

在独立 `fiscalhot_omo_test` 库中仅 seed `pboc-open-market`，静态 source 配置始终 disabled，隔离库配置也在验证后恢复。将 allow 前缀临时收窄到第191号唯一详情 URL，并把 backfill/maxFetches 限为 1。两轮实际结果为：首轮 `found=1/created=1/revised=0`、一次详情读取；第二轮 `found=1/created=0/revised=0`、详情读取 0。两次列表 fetch run 均成功。详情 URL 为 <https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/2026092908461628271/index.html>，标题与列表相符；列表日及 `PubDate` 为 2026-09-29，落库 UTC 为 `2026-09-28T16:00:00Z`。正文 174 字、1 表，`body_status=ok`；表格中的 7 天、1.40%、905 亿元等字段保留，原文句子“同时，开展了6985亿元隔夜逆回购操作。”按来源原句记录，不作额外解释。第二轮 URL 判重且正文哈希、revision 不变。

本次不是批量或持续性验证：未翻页、未尝试其他候选或 PDF；没有启动应用 worker/模型/Jina/OCR/通知，所有运行开关 false，`receipts=0`、`lb_models=0`。现有 `queueProcessing` 留下 1 个未消费 `content.analyze:created` job；没有 `content.extract-body` job。来源仍 disabled。完整边界、隔离与调用次数见 [P3_OMO_VALIDATION.md](P3_OMO_VALIDATION.md)。

## P3 另外三源单篇固定 URL 两轮验证（2026-09-29）

在独立 `fiscalhot_local_sources_test` 库中，对预算司、人民银行厦门市分行、厦门市财政局各限制到一条固定列表候选，逐源运行两轮 collector。每源第一轮 `found=1/created=1/revised=0` 并提取一条详情，第二轮 `found=1/created=0/revised=0`；共 6 次成功 fetch runs、3 个待消费 `content.extract-body:created` jobs，没有 `content.analyze`、receipt 或模型账单。验证后数据库源配置恢复仓库配置，所有 source 仍 disabled。精确页面和过程见 [P3_LOCAL_SOURCE_VALIDATION.md](P3_LOCAL_SOURCE_VALIDATION.md)。

| Source | 固定样本（原链接） | 首轮正文结果 | 边界 |
|---|---|---|---|
| `mof-budget-work` | [《财政部有关负责人就2026年中央预算公开答记者问》](https://yss.mof.gov.cn/gongzuodongtai/202603/t20260326_3986132.htm)，列表/详情日 2026-03-26 | 2,272 字，`ok` | 仅一条固定URL；列表首页最新项较旧，未验证其余首页候选、分页或跨周期新鲜度。 |
| `pboc-xiamen-work` | [《人民银行厦门市分行：支付护航投洽会 便利服务迎嘉宾》](https://xiamen.pbc.gov.cn/xiamen/127699/2026091714532820798/index.html)，列表日 2026-09-14 | 1,745 字，`ok` | 仅一条固定URL；不代表首页20项或34页覆盖，也不证明长期稳定。 |
| `xiamen-finance-debt` | [《2026年厦门市政府专项债券（十六期）招标结果公告》](https://cz.xm.gov.cn/zwxx/czsj/dfzxx/202609/t20260911_3016829.htm)，列表/详情日 2026-09-11 | 初始 Readability 205 字曾标 `ok`，但 DB正文检查确认只有标题/日期、扫码提示及页尾，没有招标结果，属质量假阳性。唯一 `.Custom_UnionStyle` 实测26字，`extractSelectedBody` 返回 `attachments_unprocessed`；唯一 PDF 位于该正文区之外。随后对 [第十六期 PDF](https://cz.xm.gov.cn/zwxx/czsj/dfzxx/202609/P020260911578215495483.pdf) 进行一次受限解析：HTTP 200、`application/pdf`、457,111 字节、无重定向；严格解析返回 `pdf_page_no_text`。 | 正文完整性仍不通过，是当前 Gate 2 阻塞。诊断只说明至少一页没有可用文字层；解析器没有返回页数、layout 或表格字段，不能据此推断整份文件都是扫描件或招标结果。来源保持 disabled，当前仅配置 `detail.bodySelector='.Custom_UnionStyle'`；不降低200字门槛、不配置 `allowShortBody`、不把该 PDF 标作正文。详见 [P3_XIAMEN_DEBT_PDF_VALIDATION.md](P3_XIAMEN_DEBT_PDF_VALIDATION.md)。 |

这三源的小样仅验证固定URL入库和同URL第二轮判重，不代表栏目整体可用、首页其余候选完整、分页覆盖或周期新鲜度通过。厦门财政的列表幂等结果不能覆盖正文不完整风险。验证期间无 worker、模型、Jina、OCR、付费回退或推送；三源开关关闭状态在验证后恢复。

## P3 日期口径与栏目新鲜度复核（2026-09-29）

本次共发出 8 次免费、只读官方 GET，每请求 12 秒超时、不重试；没有调用数据库、队列、worker、模型、Jina 或付费服务。具体响应摘要保存在忽略目录 `.data/fiscal-central-audit/p3-date-freshness-20260929.json`；此前取得的本地 HTML/JSON 快照见该 JSON 的 `priorLocalSnapshots`。

- **财政部会计司**：列表页 [工作通知](https://kjs.mof.gov.cn/gongzuotongzhi/) 返回 200。该样本原始列表 `<span>` 是 2026-09-22；文章 URL 路径含 `t20260921`，当前 parser 输出 `2026-09-21T16:00:00Z`，即中国时区 2026-09-22 00:00。详情 `PubDate` 为 2026-09-22 14:39，正文可见发布日期也是 9/22；函件落款 9/17 是文书日期。旧记录把 URL 路径日或 UTC 日期部分误作列表日，现已更正。首页分页脚本为 `createPageHTML(50, 0, ...)`；实际 GET [index_1.htm](https://kjs.mof.gov.cn/gongzuotongzhi/index_1.htm) 返回 200，样本日期从 2026-07-24 到 2026-05-08，与首页样本日期段不重叠。只抽查了这两页。
- **厦门证监局**：文章 [详情](https://www.csrc.gov.cn/xiamen/c101757/c7658572/content.shtml) 正文可见“日期：2026-09-15 来源：厦门证监局”；API page1 的 `publishedTimeStr=2026-09-15 12:43:00` 与 `publishedTime=1789418580000` epoch 一致，厦门监管工作首页此前也显示 9 月 15 日。当前配置仅读取该字符串并按 `+08:00` 解析，得到 9/15；未映射详情 `PubDate`。详情 `PubDate` 与页面生成时间同为 2026-09-23 17:33:09，其业务含义未知，不能据此断言更新日。API 当前报告总数 399，page1 20 项，page2 的结构/范围已由此前证据记录；本轮没有请求额外历史页。
- **财政部综合政策发布**：本次列表页返回 200，最新可见日期 2026-08-26；列表生成脚本表明支持分页，但本轮没有请求旧页。该栏目约一个月没有更新，仍应按栏目实际节奏审查，不作为每日发布源。
- **财政部金融司工作通知**：本次首页返回 200，最新日期 2026-07-16；脚本含 `createPageHTML(21, 0, ...)`，本轮不据此推断每页数量。实际请求 [index_1.htm](https://jrs.mof.gov.cn/gongzuotongzhi/index_1.htm) 返回 200，日期从 2025-12-12 回溯至 2024-12-10，两页日期在 2025-12-12 边界重合；本次未逐项比对标题/URL，不能据日期断言无重复。页面样本显示该栏目发布间隔较长，需据其主题价值和未来周期观察评估 freshness；不据此改 source 配置。

本次只检查会计司及金融司各两页、财政部综合政策首页、厦门证监局一条详情与 API 首页；没有检查更多历史分页、跨周期更新或全量重复率。后续离线复核确认会计司当前映射读取列表所示中国日期；厦门证监局 `PubDate`/生成元数据的业务语义仍未确认。详见 [P3_DATE_COVERAGE_AUDIT.md](P3_DATE_COVERAGE_AUDIT.md)。
## P3 分页 URL 去重与 PDF 文本层能力（2026-09-29）

### 两页跨页候选比较

复用已保存的首页 HTML，并对两个官方 `index_1.htm` 各作一次免费 GET；随后用当前 `industry/sources.json` 配置调用 `packages/backend/src/sources/web-list.ts` 的实际 `fromHtml()` 与 `allowed()`，不是手写 selector 或正则替代 collector 解析。两源每页均解析 10 项，40/40 候选 URL 均在来源 allow 前缀内。

| 来源 | 首页快照 | 第 2 页快照 | 页内解析 | 两页精确 URL 重复 | 标题重复但 URL 不同 |
|---|---|---|---:|---:|---|
| 财政部金融司工作通知 | `.data/fiscal-central-audit/html/mof-finance-2.html` | `.data/fiscal-central-audit/html/mof-finance-index-1.html` | 10 + 10 | 0 | 1 组：“关于修订金融企业财务快报有关事项的通知”，2025 与 2024 两个不同 href |
| 财政部会计司工作通知 | `.data/fiscal-central-audit/html/mof-accounting-2.html` | `.data/fiscal-central-audit/html/mof-accounting-index-1.html` | 10 + 10 | 0 | 2 组：备案异常名单、注销备案名单，均为不同月份/不同 href |

重复判断以精确 URL 为准；同标题异 URL 是历史周期中不同候选，不能仅按标题折叠。当前 `fromHtml()` 的去重集合只在单页解析时创建，collector 不会自动请求下一页。本次仅检查每源两页，未验证更深历史页面、分页全覆盖或全历史重复率。

### 两份官方 PDF 附件

金融司《2026年中央财政支持普惠金融发展示范区绩效考核情况的公示》详情 HTML 中实际列有附件链接 `./P020260608599408762517.pdf`；福建厅通知公告首页已有候选《福建省财政厅 中国人民银行福建省分行关于2026年第十一期福建省省级国库现金管理商业银行定期存款招标结果的公告》，href 指向 PDF。各对一个页面内实际列出的官方附件作了单次有界 GET，没有尝试站外或猜测链接。

| 样本 | 结果 | 只读抽取检查 | 处理含义 |
|---|---|---|---|
| 财政部金融司公示附件，`.data/fiscal-central-audit/pdf/mof-finance-performance.pdf` | 200；`application/pdf`；签名 `%PDF-1.7`；66,740 bytes；1 页；非加密 | `pypdf` 与 `pdfplumber` 均抽到 281 字；`pdfplumber` 识别 6 行 × 4 列表格，列头为“档次/地区、第一档、第二档、第三档”，公示主题词可检出 | 这是能提取文本的直接 PDF 样本，支持后续做有上限的文本解析 PoC；不证明 HTML 文章内嵌附件可被现有正文流程访问 |
| 福建省财政厅国库现金管理招标结果 PDF，`.data/fiscal-central-audit/pdf/fujian-cash-management-result.pdf` | 200；`application/pdf`；签名 `%PDF-1.4`；178,333 bytes；4 页；非加密 | 四页 `pypdf`、`pdfplumber` 文本均为 0 字符；每页有图像对象，未识别出表格 | 是扫描件；需要 OCR 才可能转正文。本轮不做 OCR，不据此永久排除福建源；当前 HTML 正文抽取流程无法验证这份附件 |

上表的 `pypdf`、`pdfplumber` 记录属于最初只读样本检查阶段；它们不代表当前项目解析器。PDF 附件和早期提取摘要位于 Git 忽略的 `.data/fiscal-central-audit/pdf/`，不得提交官方 PDF。

### PDF.js 离线 PoC 与运行边界

Mozilla PDF.js 官方 Node 示例导入 `pdfjs-dist/legacy/build/pdf.mjs` 的 `getDocument()`，并从 `PDFDocumentProxy.numPages` 取页数、逐页调用 `PDFPageProxy.getTextContent()`。项目现已新增 `pdfjs-dist@6.3.289` 用于离线文本 PoC；官方 FAQ 将 legacy Node.js 22+ 标为 Mostly、自动测试 Limited。Windows Node 24 已对真实样本通过实测；Ubuntu `Check` CI（run `36589569943`，tested SHA `dafe938`）的通用 `npm test`、typecheck、web build、web tests 与 smoke 已通过，但CI未解析此官方 PDF 样本，不能据此声称真实PDF在Linux通过。PDF.js 仓库标注 Apache-2.0。参见[官方 Node 示例](https://github.com/mozilla/pdf.js/blob/master/examples/node/getinfo.mjs)、[官方兼容性 FAQ](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions)、[API 的 `getTextContent`](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html) 与[许可证](https://github.com/mozilla/pdf.js/blob/master/LICENSE)。

生产 PDF 路线尚未完成：财政部金融司 disabled 配置已按 AD-010 选择已验证的文章外壳、正文区和附件区；三份本地 HTML 的 envelope helper 核验覆盖一份单 PDF 公示、一份无附件完整通知和一份 RAR 快报拒绝；单篇真实 HTML+PDF 路径在 Windows 隔离库通过。Ubuntu CI仅证明通用测试/构建兼容，未解析真实PDF样本。NAS硬RSS、PDF真实样本Linux运行、运行隔离与生产持续性尚待验证；目前不启用 source、OCR 或付费 fallback。

### AD-009 本轮状态

| 项目 | 已验证状态 | 边界 |
|---|---|---|
| A：所选 HTML 正文 | `pboc-open-market` 使用实证唯一容器 `#zoom` 和显式 `allowShortBody=true`；离线 helper 检查后，又在隔离 `fiscalhot_omo_test` 对第191号完成受限 collector 两轮：1 条入库，第二轮 0 revised、0 详情重复读取；输出 174 字、1 张表，题名/日期和关键操作量符合本地快照。`tests/selected-body.test.ts` 4/4 通过。 | 仅一个指定 URL 的单篇样本；未检查另外 19 个首页候选、翻页或长期更新。source 仍 `enabled=false` 且两项全文开关 false；留有 1 个未消费 `content.analyze:created` job。 |
| B：直接 PDF 文本 PoC | Windows Node 24 + `pdfjs-dist@6.3.289` 离线解析金融司 1 页样本，19 个定位文本行；布局按列锚点与行区间还原 6×4 表格的四个业务行，并经原 PDF 视觉复核。福建厅 4 页样本逐页视觉检查为同一公告，helper 因扫描页返回 `pdf_page_no_text`。渲染证据保存在忽略目录 `.data/fiscal-central-audit/rendered/`。 | 未做 OCR；解析器仍是只接收调用方已有 bytes 的离线模块。 |
| AD-010：财政部金融司 HTML envelope | `mof-finance-notices` 的 `articleSelector=.box_content`、`bodySelector=.my_doccontent`、精确附件区 selector 与 `attachmentMode=optional` 已加入 disabled 配置；三份本地快照经 `extractSelectedArticleEnvelope` 核验。另在隔离库对一篇历史 unconfirmed 文章进行单篇 HTML+PDF 验证：title 相同、正文 hash 变化，rev1/0字到rev2/1,454字；19 条 PDF 坐标行按 X/Y 恢复表格值，计划单列市为“厦门市”（“市”在同列下一 span）。 | 只证明该单篇路径；source 未启用，临时 SQL 验证配置已恢复。30 篇最新 SQL 为29 `ok`、1 `unconfirmed`、0 `pending`，仍有30个未消费 extract-body 任务；fresh全回归及Ubuntu通用CI已通过，但真实PDF未在Linux解析。更多附件正反样本、NAS和资源限制待验证。 |
| 生产附件链路 | 单篇 HTML+PDF 组合已有隔离库证据；Linux CI的一般构建/测试已通过，但未在Linux解析官方PDF样本；其他来源/附件类型、NAS容器RSS和运行隔离尚未验收。 | 生产路线③尚未全面验收。十个 source 均保持 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`；Gate 2 未通过。 |

来源配置更新后的最新 fresh 回归在 fiscalhot_pagecopy_test 完成 35 项 migrations，npm test 156/156、typecheck、来源 whitelist 和厦门财政保存 HTML selector focused 检查均通过。其后对第十六期 PDF 的一次 guarded GET 收到 200 / `application/pdf` / 457,111 字节，严格解析为 `pdf_page_no_text`；失败结果未提供页数或字段，因此附件正文仍未核实。它验证代码/配置兼容性，不弥补 Gate 2 的栏目覆盖或 PDF 正文完整性证据；十个来源仍 disabled。详见 [P3_XIAMEN_DEBT_PDF_VALIDATION.md](P3_XIAMEN_DEBT_PDF_VALIDATION.md)。

## P3 区域来源历史分页与正文抽查（2026-09-30）

只读验证报告：[P3_REGIONAL_PAGING_VALIDATION.md](P3_REGIONAL_PAGING_VALIDATION.md)。实际保存中央选登及厦门局首页、各自 `index_1.htm`，再各取一篇历史详情，共6次 `guardedFetch`，6次均200；所有运行安全开关false，未操作数据库、collector、worker、模型、Jina、发布或preview。原始HTML、请求hash和结构化机器结果保存在Git ignored `.data/fiscal-regional-paging-validation/`。

| 来源 | 当前首页 / 第2页候选 | URL跨页重复 | 历史详情正文 | 边界 |
|---|---:|---:|---|---|
| `mof-regional-supervision-dynamics` | 8 / 7 | 0 | 北京监管局稿：题名一致、列表日与`PubDate`同为2026-09-16，正文1,832字、SHA-256见报告和机器证据 | 网站脚本声明20页；只核相邻两页，不代表35局全量；collector仍仅读configured home URL |
| `mof-xiamen-supervision-dynamics` | 10 / 10 | 0 | 厦门监管局稿：题名一致、列表日与`PubDate`同为2026-09-04，正文1,979字、SHA-256见报告和机器证据 | 网站脚本声明10页；只核相邻两页，collector仍只读首页；日期顺序不单调 |

中央首页相对前一保存快照从7条变8条，新增厦门局《激活财政科学管理“源动力”跑出预算监管提质“加速度”》。与本次厦门当前首页候选比较，exact URL、同host/path和标题匹配均0；本次未对该候选请求详情，也未做跨源collector去重实测，因此不能称其为已发现的重复项。跨日/跨页一次样本不证明长期freshness、深层历史完整或更广覆盖；本次报告没有新增分页实现。

## P3 区域两源完整首页批次（2026-09-30）

报告：[P3_REGIONAL_BATCH_2026-09-30.md](P3_REGIONAL_BATCH_2026-09-30.md)。该隔离批次使用两条来源完整配置、各两轮真实 collector：中央首页 `8/8/8/0 → 8/8/0/0`，厦门首页 `10/10/10/0 → 10/10/0/0`（`found/accepted/created/revised`）；18篇正文全为 `ok/rev2`，正文hash和SQL审计见报告。中央8篇正文可见日期与列表日一致；厦门10篇均解析出列表日，但正文未载明明确发布日期，且5篇正文仅223–379字，须保留逐篇人工复核候选。20个 `content.extract-body` jobs 均 `created/retry0`、未消费；分析、收据、publication均0。

批次跨源候选 `identityKey` overlap 0，因此没有同候选可供实测跨源 collector 去重；运行时结果为 `unknown`。只抓首页；中央声明20页、厦门10页，历史、深页和长周期稳定性未验证。请求预算预设28 HTTP hops，但 Undici dispatch hook未触发；报告可核到至少25次 guarded fetch调用，collector与正文调用的redirect hop无法回溯。硬上限没有得到证明，预算状态不是PASS；所有网络请求已停止、没有重跑。批次只支持报告范围内首页入库和逐篇正文结果，不等同来源整体稳定或 Gate 2通过。

## P3 会计司与预算司完整首页批次（2026-09-30）

报告：[P3_CORE_BATCH_2026-09-30.md](P3_CORE_BATCH_2026-09-30.md)。新隔离库按当前完整配置运行两轮首页 collector。会计司 `found/accepted/created/revised=10/10/10/0 → 10/10/0/0`；预算司工作动态为 `10/1/1/0 → 10/10/9/0`，第二轮在首导入 cursor 建立后实际补入9篇旧文，不能把12个月理解为永久同步范围。数据库共20篇，四轮状态均`ok`；本批共尝试12篇正文，6篇`ok`、6篇`unconfirmed`，其余8篇`pending`未请求。6个`unconfirmed`的 helper 原因未留存，只能记`unknown`；`ok`不等于逐字段/完整性验收。20个提取job均`created/retry0`未消费，analyses/receipts/job_runs均0。来源结束后恢复disabled、全文关闭。

HTTP计数 hook `Agent.prototype.dispatch` 未命中、日志为空，真实 hop总数`unknown`，不能证明预定≤20上限；发现 hook 失败后无追加网络请求或重跑。9/29完整旧快照显示预算司候选和当前导入10/10重合；会计司旧完整快照可复核5/10 URL，另5条因旧preview仅保存代表样本而不能完整差分。预算司第二轮旧文导入是真实观察，但长期发布速度、滑窗、噪声质量、更多正文仍未知，不构成来源或预算通过。隔离样本详情与ignored执行证据见报告。

## P3 OMO 公告跨日更新抽查（2026-09-30）

报告：[P3_OMO_FRESHNESS_2026-09-30.md](P3_OMO_FRESHNESS_2026-09-30.md)。同一 `fromHtml()` parser 对9/29保存首页和9/30真实首页各解析20项；新第192号进入窗口，旧第172号移出窗口。第192号官方详情HTTP200，`ArticleTitle`与`PubDate=2026-09-30`符合首页。fresh隔离库 `fiscalhot_omo_freshness_test` 35 migrations；source仍disabled/fulltext=false，临时固定URL allowlist/backfill=1。两轮collector均成功：`1/1/0 → 1/0/0`。数据库中唯一文章`body_status=ok`、135字、1个完整表格，`#zoom`短正文配置保留期限/投标量/中标量、7天、两格0亿元，以及正文原句“同时，开展了8335亿元隔夜逆回购操作。”该公告不含利率数据，未补写利率。`extractArticleBody`显式单次调用结果为`skipped`，因为首轮collector已入库`ok`正文，没有第二次详情网络请求。

此轮计划最多20个HTTP hop；collector不记录每次实际重定向数，故实际网络hop数未知，不能把调用预算说成实际GET数。脚本末尾检查错误导致退出非零：独立记录中的 `ledgers.analyses=1`统计的是一个 `content.analyze` `created/retry0` job；最终SQL核实 `analyses`表0行、receipts及model记录0，没有启动worker。此次没有重跑。ignored证据在 `.data/omo-freshness-20260930/`，本地临时PG绑定127.0.0.1:55432且已停止。只证明一个跨日变化及一个固定URL两轮幂等，不证明长期更新稳定性、深页覆盖或全部公告正文正确，不构成Gate 2通过。

## Gate 2 依赖与核验结论（2026-09-30）

Gate 2证据就绪审计见 [P3_GATE2_READINESS.md](P3_GATE2_READINESS.md)，阶段依赖范围审查见 [ARCHITECTURE_PHASE_DEPENDENCIES.md](ARCHITECTURE_PHASE_DEPENDENCIES.md)。GPT-6.1 Sol的`DECISION=APPROVED`仅表示相应文件定义的范围获得批准；`GATE_2=NOT_PASSED`。原S1确认Gate 2不是通用分页/OCR或NAS完成验收的硬前置，也没有批准业务管线。新提案 [P3_SCAN_BODY_PROPOSAL.md](P3_SCAN_BODY_PROPOSAL.md) 已由 GPT-6.1 Sol 在 [S1_SCAN_OCR_POC_REVIEW.md](S1_SCAN_OCR_POC_REVIEW.md) 批准一次固定五张图的本机 OCR PoC及最多三次官方语言文件请求；没有批准 OCR worker/collector 集成、通用 OCR、NAS 安装或改变 Gate 2。当前没有 OCR 输出或语言文件结果。P3仍须以实测首页容量、最旧候选/排序、常规与突发更新、轮询/失败退避和可能滑出窗口的风险证明覆盖要求。重要业务PDF正文缺口依旧属于P3来源样本质量问题。真实PDF Linux集成在P7/Gate4前补验证，NAS RSS硬限制/隔离和连续运行在P8/P9/Gate5前验证。已知失败不改写成通过。

S1还核实 `source.enabled=false` 不能隔离已排队处理任务：`unconfirmed`可继续进入analyze，`ok`文章调用extractor会跳过。因此P4不得复用存在遗留jobs的P3数据库启动泛worker。正式Gate2通过后另建隔离pilot库，逐条固定完整文章ID/revision/content hash和人工正文检查；未确认附件、partial HTML与已知正文假阳性不送模型。所有12个已配置source仍disabled、全文关闭；Gate2保持NOT_PASSED。

## P3 日期口径与预算司首页覆盖审计（2026-09-30）

详细复核见 [P3_DATE_COVERAGE_AUDIT.md](P3_DATE_COVERAGE_AUDIT.md)。离线使用保存的官方列表快照、当前 `fromHtml()` 与配置复算，没有新增官网请求、数据库写入或运行测试。

- 会计司原始列表 `span=2026-09-22`，parser `2026-09-21T16:00:00Z` 对应中国时间 9/22；详情 `PubDate` 与可见发布日期也是 9/22。URL 路径的 9/21 和 UTC 日期切片导致旧记录误报一天差异；函件落款 9/17 是文书日期。当前配置无日期映射错误。
- 厦门证监 API 的 `publishedTimeStr=2026-09-15 12:43:00` 与 epoch 和正文可见日同为 9/15；配置读取该字符串并加 `+08:00`。详情 `PubDate` 与页面生成时间同为 9/23，但业务语义未知，当前未使用这些字段。
- 预算司保存首页快照经当前 parser 得 10 项、10 个唯一 URL，日期新到旧从 2026-03-26 到 2023-07-24。默认首次导入近12个月、最多30条的条件套用于此快照时，仅一条在时间窗内；这是代码与单次快照的条件推算，不是新 collector 结果。单快照不能推断发布频率、突发量、周期稳定性或以后是否滑出首页。

此日期纠正不消除 Gate 2 的覆盖/正文风险，也不证明来源周期稳定性。

## P3 核心业务 PDF 人工事实复核（2026-09-30）

详细证据和Lead裁定分别见 [P3_CORE_BODY_RESOLUTION.md](P3_CORE_BODY_RESOLUTION.md)、[P3_FUJIAN_TRANSCRIPTION_REVIEW.md](P3_FUJIAN_TRANSCRIPTION_REVIEW.md) 与 [P3_XIAMEN_MANUAL_REVIEW.md](P3_XIAMEN_MANUAL_REVIEW.md)。Lead接受 `P3 manual_sample_evidence=ACCEPTED`，仅表示下列图像字段人工转录有来源哈希且经第二位Luna独立核对：

- 福建省2026年第十一期国库现金管理 PDF：4页/23行，机构名、额度、利率、预计利息、合计、期限及日期双核无差异；23行额度和利息合计均匹配。PDF文本层为空，原机器 `unconfirmed` 保留。
- 厦门市2026年第十六期专项债招标结果 PDF：1页，标题/期次、代码199701、计划及实际发行额22.78亿元、7年（5+2）含权期限、1.55%票面利率、发行价格、付息频率/日期及含权到期日双核无差异。2026-09-29旧受限解析仍为 `pdf_page_no_text`；旧205字 Readability `ok` 假阳性不更改。

以上是人工样本事实证据，不代表采集器或parser抓到同样正文，不更改DB/article/body status，不构成来源验收、跨周期稳定、Gate 2通过或P4/模型/publication授权。厦门源正文自动提取和福建扫描附件的机器路线仍未通过；12源维持disabled/fulltext关闭。产品要求核心财政业务公告持续自动获取，扫描机器路线的固定样本离线PoC已获限域S1批准，详见 [P3_SCAN_BODY_PROPOSAL.md](P3_SCAN_BODY_PROPOSAL.md) 与 [S1_SCAN_OCR_POC_REVIEW.md](S1_SCAN_OCR_POC_REVIEW.md)。这不把OCR变成Gate 2通用前置或业务管线批准；两类材料若纳入自动处理，在对应范围验收前仍受机器正文缺口阻塞。

## P3 五源官方首页只读快照（2026-10-02）

本轮增量报告及原始证据路径见 [P3_SOURCE_CHECKPOINT_2026-10-02.md](P3_SOURCE_CHECKPOINT_2026-10-02.md)。对表列五源按当前 `industry/sources.json` 各发起一次官方首页 GET，并使用实际 backend `fromHtml()` 离线解析；另外对会计司两篇既知 `unconfirmed` 详情各发起一次只读 GET。7次请求均由 Undici 8.11.2 Agent/ProxyAgent admission helper完整观测：`maxRequests=12`、attempted/dispatched=7/7、rejected=0，每个请求分别可见create、sendHeaders、headers事件；均为HTTP 200且无重定向。未运行collector或数据库写入、未请求附件，结果不改变任何 source/body状态。此前核心/区域批次的hook缺失与budget unknown仍原样保留。

| source ID | 本次列表快照/解析与日期 | 相对快照差分 | 仍未证明 |
|---|---|---|---|
| `mof-accounting-notices` | 14,233 bytes；10项，解析顺序最新/最旧列表日2026-09-30 / 2026-08-14。 | 对9/30 collector accepted URL集合9/10相同；对9/29原始HTML parser仅5项，当前与旧5项全重合。9/30没有可用原始整页HTML，故两个差分集合粒度不同。 | 不把当前多出的5个candidate都算作跨日新发布。仅诊断两个既知失败详情；附件和完整机器正文未解决。 |
| `mof-budget-work` | 12,368 bytes；10项，2026-03-26 / 2023-07-24。 | 与9/30 accepted集合10/10重合，与9/29原始HTML 10/10重合。 | 一次静态复读及旧首页快照不证明日常发布频率、未来滑窗风险或首页之外覆盖。 |
| `mof-regional-supervision-dynamics` | 21,332 bytes；8项，2026-09-30 / 2026-09-22。 | 与9/30原始首页5/8重合，新进3项、退出3项；与9/29原始首页4/7重合，新进4项、退出3项。 | 中央汇总只代表选登候选，不能声称覆盖35局全量；未做运行时跨源去重或长期稳定性验证。 |
| `mof-xiamen-supervision-dynamics` | 12,797 bytes；10项，2026-09-29 / 2026-09-01。 | 与9/29、9/30两份原始首页均10/10重合，顺序及日期范围一致。 | 相邻日期快照复读不代表长期稳定；党建/会议等候选是否为有效业务噪声仍需评估。 |
| `pboc-open-market` | 40,079 bytes；20项，2026-09-30 / 2026-09-04。 | 与9/30原始首页20/20重合；相对9/29为19/20，新进第192号、退出9/3第173号。 | 此差分延续先前单次跨日样本，不证明周期更新或深页覆盖。 |

正文详情只读诊断：会计司 `t20260920_3997803.htm` 为200、标题匹配列表、PubDate中国日9/20；Readability无正文，`.TRS_Editor`只含24字标题并提供XLSX链接，附件未请求。`t20260904_3996714.htm` 为200、标题及9/4日期匹配；Readability未达门槛，`.TRS_Editor`含323字和一张两行表格。机器抽取器可能低估第二篇结构化内容，但本轮没有更改配置、parser或数据库状态。中央监管汇总中出现的厦门文章与厦门源当前首页无exact URL重合；该有限窗口比较不是collector identity dedupe实测。

以上五源都保持配置 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`；首页只读结果仅增加有限的候选窗口快照和正文诊断，不构成来源验收、Gate 2通过或业务自动化依据。

会计司正文配置的独立范围裁定见 [S1_P3_OCT02_SCOPE_REVIEW.md](S1_P3_OCT02_SCOPE_REVIEW.md)：table-only selector 被判 `CHANGES_REQUIRED`，因为它会使既存473字、无表征求意见函退化为未确认；Sol批准对顶层 `.TRS_Editor:has(table)` 与 `.TRS_Editor:has(p + p)` 候选做行业离线fixture验证(scope only)。B的 [selector复核报告](P3_ACCOUNTING_BODY_FIX_2026-10-02.md) 与 `tests/fiscal-accounting-body.test.ts` 使用三份当前缓存真实HTML和短多段、五格装饰表两个身份匹配负例；focused test 6/6通过。union候选保留180字注销表和473字征求函、拒绝24字题名+XLSX，但也错收短通知和装饰表；更严CSS仍错收装饰表。由于S1配置条件未满足，`industry/sources.json`未改，来源状态和正文旧状态未变；结果不扩大来源网络/DB预算。

## P3 HTTP 预算工具离线验证（2026-09-30）

两份既有完整首页批次的真实HTTP hop证据仍分别为核心 `unknown`、区域至少25次 guardedFetch但重定向总hop `unknown`；其dispatch hook未命中，不能追认预算通过。后续工具 [p3-http-budget.ts](../../scripts/fiscal/p3-http-budget.ts) 锚定后端解析的 Undici 8.11.2，统计 Agent/ProxyAgent 的dispatch admission，并在达到配置上限后于原 dispatch 前拒绝；localhost测试用本地服务验证了两跳、N+1拒绝、ProxyAgent内部委派不双计及卸载恢复（5/5通过）。诊断频道只记录观察，不承担硬停止。

该工具仅验证对应后端 Undici 实例的dispatch边界，不声称操作系统全局网络限额，也不覆盖其他Undici副本、worker、私网绕过global dispatcher或proxy CONNECT内部请求。离线localhost通过只验证工具行为，未重跑来源批次或核定具体来源路径；是否安排新的有界联网运行须由Lead另行决定。

## 2026-10-02 扫描准备与本地进程验证增量

本段不改变任何来源配置或Gate状态。9/30模型下载失败（30秒中断、实收字节未知）继续作为独立历史记录。10/2获批批次只执行一次：仅有一条固定模型URL请求，HTTP 200 / Content-Length 2,469,156，收到16,384 bytes后于70,722ms以 `TypeError: terminated` 终止，EOF=false，未到120秒期限；没有license请求、hash或完整模型文件。无重试、manifest incomplete/runnable=false，OCR未运行，旧失败材料未覆盖。审计详见 [P3_SCAN_OCR_REVIEW_2026-10-02.md](P3_SCAN_OCR_REVIEW_2026-10-02.md)。

本地OCR过程核验报告 [P3_OCR_PROCESS_VERIFICATION_2026-10-02.md](P3_OCR_PROCESS_VERIFICATION_2026-10-02.md)记录17/17 focused tests与typecheck通过。Windows monitor对单个短fake-child实测首采样72ms、最大样本间隔162ms；这不是OCR负载下持续cadence、硬RSS或进程树行为证据。执行锁仍false。以上扫描证据与来源覆盖结论无关。

## 2026-10-03 原范围代码交付核验

代码侧selector probe与OCR守护器已有独立fixture/test，fresh隔离全套回归通过（35 migrations、184/184 backend、typecheck、Web build、15/15 Web tests）；不改 `industry/sources.json`、数据库source/body状态或collector。preview仍为3个固定人工样本与disabled来源；Gate 2仍未通过。这些工具测试不能外推为来源覆盖、运行期抓取或机器正文验收。10/2 preview smoke保留29项记录，10/3复核显示30项通过，计数差异unknown。

## P3 扫描附件本机 PoC 结果（2026-09-30）

固定五页实验见 [执行结果](P3_SCAN_OCR_POC_RESULT.md) 和 [独立 gold 审阅](P3_SCAN_OCR_GOLD_REVIEW.md)：第一项官方 commit 查询成功，固定 commit 的 `chi_sim.traineddata`请求返回HTTP 200但响应流超出30秒限制未完整接收；按S1禁止重试边界停止，没有请求许可证、运行OCR或字段比较。输入PNG哈希/尺寸核对通过，但机器候选为0，人工 gold不改写为机器成功。CLI保持`OCR_RUN_ENABLED=false`直到资源monitor/kill-wait路径有fake-child证据。福建附件机器正文仍`unconfirmed`、厦门附件仍`pdf_page_no_text`；此实验不改变正文状态、来源结论或Gate 2。

## 2026-10-03 新S1实现与两项有限实测

范围及离线实现证据见 [S1裁定](S1_P3_OCT03_IMPLEMENTATION_REVIEW.md)、[会计司正文policy报告](P3_ACCOUNTING_BODY_POLICY_2026-10-03.md)和[OCR API准备报告](P3_OCR_API_PREPARE_2026-10-03.md)。正文policy配置只适用于 `mof-accounting-notices` 已缓存结构，selector与header值已由Lead精确核销；代码通过failure-closed fixtures及统一helper入口测试。生产source仍`enabled=false`、全文关闭，未运行collector。

经单独核销后，对 `https://kjs.mof.gov.cn/gongzuotongzhi/202609/t20260904_3996714.htm` 仅做一次direct extraction。fresh隔离库 `fiscalhot_oct03_accounting_live_test` 有35 migrations；来源disabled，固定身份文章最终 `body_status=unconfirmed`、revision=1、无body/hash。Undici cap=1，实际dispatch 1/1、拒绝0，HTTP200，create/sendHeaders/headers各一，无redirect或retry。ignored结果未保存HTML，且runner没有保存helper warning的拒绝reason；该原因unknown。此失败不被离线fixture正例覆盖，也不授权retry。后续如需诊断，先以offline fixture检查如何在同一次调用中持久化结构化拒绝reason，并由Lead另批任何新网络请求。

固定 GitHub commit `87416418657359cb625c412a48b6e1d6d41c29bd` 的官方Git Blob准备另获一次有限核销并成功：新ignored批次精确3 API requests、均HTTP200，manifest complete/runnable，模型与LICENSE EOF/byte lengths/Git blob SHA-1/SHA-256与Apache-2.0验证通过。QA独立本地读取文件并调用 `assertPreparedManifest()`确认一致。数据准备不等于OCR执行；run.json不存在、run lock关闭、`OCR_RUN_ENABLED=false`，固定页/gold未运行。9/30、10/2失败目录保留且不重试。

本轮fresh 35 migrations、npm test 211/211、typecheck、Web build、Web tests 15/15与preview smoke 30/30通过；GitHub Check run [37078956435](https://github.com/revercgy-hub/MYHOT/actions/runs/37078956435) 对代码SHA `9bfa0d1a91dcc765b9870ecf5cb25b9958c9f651` 全绿。所有production source仍disabled，历史栏目/跨周期/hop预算缺口不变；Gate 2继续`NOT_PASSED`。以上有限测试和两个单篇操作都不等于来源验收。

## 2026-10-03 抽取拒绝原因的单篇诊断增量

本机结构化日志观察器及fixture结果见 [P3_EXTRACT_DIAGNOSTICS_2026-10-03.md](P3_EXTRACT_DIAGNOSTICS_2026-10-03.md)。经Root核销后，在独立 `fiscalhot_oct03_diagnostic_live_test` 以disabled `mof-accounting`测试source对保存列表中的会计司候选 `https://kjs.mof.gov.cn/gongzuotongzhi/202607/t20260714_3993483.htm` 只做一次direct extract。列表标题为《关于征求〈会计改革与发展“十五五”规划（征求意见稿）〉意见的函》，列表日2026-07-15；历史访问状态unknown，不称首次访问或新覆盖。

请求事件日志显示Undici 8.11.2 hard cap=1、attempted/dispatched/rejected=1/1/0；`request:create`、`sendHeaders`、`headers`各一次，HTTP 200、无request error。机器结果`unconfirmed`、`revision=1`、正文与hash为空；source disabled、全文开关false，publication/analysis/receipt/job_runs均0。structured reason为`attachments_unprocessed`：该安全检查说明所选响应中至少有一个被helper识别为PDF样式的链接，因此在身份、表格和正文长度核验前拒绝；本次未保留响应HTML，链接的实际文件类型及其与页面业务内容的关系均unknown。没有下载附件、重试、collector、worker、模型或OCR。该结果只描述该URL此次请求，9/4固定详情旧请求的reason仍unknown；不改变来源验收或Gate 2结论。后续若需判断无关PDF样式链接是否触发保守拒绝，先用localhost fixture核验；修改通用拒绝逻辑需要另行S1审查。

本机fresh QA全套和CI证据汇总见 [P3诊断检查点](HANDOFFS/P3_DIAGNOSTIC_CHECKPOINT_2026-10-03.md)。所有12个生产source继续`enabled=false`、站内及转发全文关闭。

## 2026-10-03 附件范围与区域短正文QA增量

通用可选HTML附件scope经S1范围批准、实现与QA回归后已合入代码SHA `8b1c4446a1c3131034a4d9b7c5ed482a92b80166`；GitHub run [37093486152](https://github.com/revercgy-hub/MYHOT/actions/runs/37093486152) 对同SHA全绿。它未在本轮配置到任何行业source，12源仍disabled/fulltext关闭。July14会计司一次经核销的单独DOM GET发现两个正文外PDF样式链接均在业务附件下载区；scope外导航/面包屑/页脚PDF计数为0，因此此前该页`attachments_unprocessed`是附件保护的有效拒绝。未下载附件，实际MIME/内容unknown。详见[DOM报告](P3_ATTACHMENT_SCOPE_DOM_2026-10-03.md)。

既有五篇区域短正文人工质量复核结果为2项接受最小业务证据、3项拒绝；两条详情日期unknown。同批另有224、259、296字三项不在该五篇审查范围。该结论是固定样本人工内容判断，不是模型/机器打分，也不证明全部短正文已审。见[短正文复核](P3_REGIONAL_SHORT_BODY_REVIEW_2026-10-03.md)。完整QA边界及测试数见[检查点](HANDOFFS/P3_BODY_QUALITY_CHECKPOINT_2026-10-03.md)。Gate 2继续`NOT_PASSED`。

## 2026-10-04 Gate 2范围裁定、首批详情与S1实现QA

Sol对最小严格初次日期窗口与附件诊断/自动精选保护范围给出`APPROVED_SCOPE`；这是实现授权范围，不是Gate 2 review或通过。A/B已完成该范围内实现；最终本地fresh测试结果、代码路径及CI状态以本轮检查点为准。范围与边界见[S1 Gate 2 blocker review](S1_GATE2_BLOCKERS_REVIEW_2026-10-04.md)。实现未新增schema/migration，也没有核准source配置或运行采集；行业12个source仍全部disabled/fulltext关闭。

首批逐局观察报告见[首页与栏目批次](REGIONAL_BUREAU_BATCH1_2026-10-04.md)、[详情QA](REGIONAL_BUREAU_BATCH1_DETAIL_QA_2026-10-04.md)及[配置准备审阅](REGIONAL_BUREAU_BATCH1_CONFIG_READINESS_2026-10-04.md)。福建、北京、上海各有一次首页、真实展示的“工作动态”栏目与一篇列表observed HTTPS详情的有限静态证据。6次首页/栏目GET和3次详情GET分别受独立undici dispatch caps控制，均记录HTTP200；详情三次共`attempted/dispatched/rejected=3/3/0`，未下载附件、未运行collector/extractor、未写DB、无worker/模型/OCR。离线DOM发现列表日期在福建与上海分别与详情`PubDate`日匹配；北京列表日2026-09-24但详情`PubDate=2026-09-30`，且detail title省略列表标题的“财政部”前缀。该差异保留为G2-A1风险，不按列表日推断真实发布日期。三篇详情有可见静态body容器；此抽样不证明正文业务完整、selector生产稳定、分页或周期稳定。

三局结果只推进各自矩阵行的有限页面证据状态，未改变35局逐一覆盖要求或Gate 2完结标准；第二、三批的8局补充见下段。旧历史预算unknown继续保留；本次新批次证据不追认历史批次，也不等于全来源运行验收。

三条拟议的地方局配置尚未写入`industry/sources.json`；配置准备报告用保存HTML、`fromHtml`、fake-fetcher `fetchDetail` 和 `extractSelectedBody` 做离线兼容检查，列表三页各解析10项。北京详情权威标题/日期会更新候选metadata，但首次detail body identity会是`identity_missing`；详情身份已保存后纯helper可提取正文。该两阶段collector/DB/queued-extraction连接尚未用集成测试验证，不能据此声明配置/来源ready或通过Gate 2。

### 2026-10-04 第二、三批八局首页与栏目观察

[第二批](REGIONAL_BUREAU_BATCH2_2026-10-04.md)调查天津、河北、山西、内蒙古；[第三批](REGIONAL_BUREAU_BATCH3_2026-10-04.md)调查辽宁、吉林、黑龙江、山东。每批4个官方首页与4个由保存首页DOM实际展示的“工作动态”同域链接，总budget均为`attempted/dispatched/rejected=8/8/0`，8/8响应HTTP200、无重试/重定向。QA离线复核16份HTML字节数与SHA-256均匹配manifest，8个首页栏目锚点均可回溯到保存首页，8个栏目页各见10条当前可见同域`.htm`候选。没有详情请求、DB/source配置、collector/extractor、附件、worker、模型或OCR。此观察不覆盖文章详情正文/日期、分页、历史窗口、跨周期稳定性、稳定selector或来源验收；列表日与URL路径日期差异样本仍应按下一步详情分别留证。35局中福建/北京/上海有各自一篇详情观察，另本两批8局只有首页/列表观察；厦门为既有有限配置，尚余23局无这些新批次的独立栏目观察。Gate 2仍为`NOT_PASSED`。

## 2026-10-05 新增三局disabled配置与合成集成测试

`industry/sources.json`从12项增至15项（14 HTML、1 JSON），新增`mof-fujian-supervision-dynamics`、`mof-beijing-supervision-dynamics`、`mof-shanghai-supervision-dynamics`；均为T1、第一方`web_list`、目标间隔1440分钟、首次严格90天日期范围、`enabled=false`且站内/RSS全文许可关闭。配置值来自10/04保存页面；详情正文fixture内容为明显标记的合成文字，不含真实新闻正文。列表与详情静态配置/解析检查、测试报告见[配置实现](OCT05_BUREAU_CONFIG_IMPLEMENTATION.md)；`source-rules` count 15及原有每源约束保持覆盖。

隔离loopback fixture数据库测试见[集成QA](OCT05_BUREAU_INTEGRATION_QA.md)：新库`fiscalhot_oct05_bureau_integration_test`执行35个既有migration；Node 24固定业务Date到2026-10-05并在finally恢复，仅验证本地保存DOM与真实collector/DB/队列/显式抽取衔接，没有真实来源请求或worker。福建/上海通过合成额外列表行验证每源最多抓10详情以及重跑不变；北京验证权威详情元数据持久化、首轮identity拒绝后保留pending并排队，冲突metadata失败保护，以及后续同fixture显式抽取成功。正文、压力列表和矛盾metadata均为合成输入；分析/receipt/selected结果为0。该验证证明观察fixture下软件路径，不验证当前真实站点、来源长期稳定性或Gate 2。

后续三局真实collector/body候选方案见[真实验证计划](BUREAU_REAL_VALIDATION_PLAN_2026-10-05.md)。它建议只先审核北京单局collector阶段（请求前硬cap 11），显式body阶段另行核销cap 1；福建和上海后续分别分批。计划只做离线审查，本轮没有启动collector或新数据库操作；理论多轮三局69个guarded fetch/414个dispatch仅解释累计风险，不是已批准请求额度或已执行结果。执行前仍需Lead逐阶段核销。

## 2026-10-05 福建、北京、上海受限短间隔复查

见[短间隔复查报告](REGIONAL_BUREAU_FOLLOWUP_2026-10-05.md)。三条精确旧列表URL各一次直接GET；Undici 8.11.2 hard cap=3，`attempted/dispatched/rejected=3/3/0`，9事件（3 create、3 sendHeaders、3 headers），HTTP200，无重定向/重试。10/04旧manifest `2026-10-03T23:13:00.189Z`到本轮`2026-10-05T07:35:10.322Z`起点为116,530,133毫秒（32小时22分10.133秒），Shanghai日期从10月4日跨至10月5日。三页响应bytes/hash分别与旧快照完全相同；离线同一`fromHtml`每局10/10留存、0进/0出，共同URL标题/列表日期均无变化。该结果是两个时间点的一次短间隔无变化观察；它不是daily scheduler运行、连续稳定、24小时覆盖验收或Gate通过。

## 2026-10-05 第四批江苏、浙江、安徽、江西栏目观察

独立离线预算/hash核验及状态见[batch 4报告](REGIONAL_BUREAU_BATCH4_2026-10-05.md)和[逐局矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)。主页4次、栏目3次、浙江获批补充1次，共`attempted/dispatched/rejected=8/8/0`；Undici日志8 create/8 sendHeaders/8 headers，零错误，8份raw bytes/SHA均与manifest一致。江苏、安徽、江西从首页实际主内容锚点发现“工作动态”，其单页各有10项当前唯一同域`.htm`候选；没有访问详情或分页。浙江首页没有“工作动态/新闻动态”主内容标题，获准的`动态简讯`入口响应为379字节JS redirect wrapper，0列表锚点。其脚本精确目标后经单独授权读取，见[浙江target页报告](REGIONAL_BUREAU_ZHEJIANG_TARGET_2026-10-05.md)：页面标题“图片新闻”，9条唯一同域`.htm`候选、可见日2023-12-28—2026-09-11、0 PDF、1次HTTP200 direct dispatch；未请求详情。该观察只说明一个图片新闻列表页，不表示浙江目标监管动态总体栏目覆盖。四局均未配置，batch4观察不涉及collector或DB测试；页面观察不等于来源验收。

## 2026-10-06恢复核验：batch5–9、详情与真实collector分段结果

文档恢复日为2026-10-06；网页调用实际时点取自各manifest，不能由报告文件名或恢复日期推导跨日周期或新采样。当前已提交`industry/sources.json`共19项（18 HTML、1 JSON），所有来源disabled且全文许可关闭；FJ strict-body opt-in是自动处理保护，并未启用来源或导入正式数据库。

batch5–9尝试19局，其中18局取得“工作动态”首屏列表，甘肃主页GET超时、无栏目请求且不补请求。预算/目录链接/锚点和成功raw SHA经离线QA核验。新增栏目列表与详情结果见[逐局矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)及各batch报告。河南、湖北、湖南、广东各访问列表第一条详情一次，cap4、4/4/0，raw hash与字节数独立匹配manifest；详情标题及显示日期与所选列表项匹配。样本正文分别为河南1383字符、广东1790字符的财政监管业务内容，湖北235字符的青年组织宣传，湖南313字符的公文保密/内控培训。四篇只是一篇/局的有限内容边界观察，不能推断各局噪声率。

北京、福建、上海各在独立fresh `_test`库中完成一轮受限collector。北京列表+10详情 cap11新增10条，指定详情显式抽取一篇后从pending变ok/revision1→2，重复list成功；首轮11个响应hash没有被捕获，继续unknown。福建 cap11新增10条，其中9篇body ok、1篇pending；显式抽取目标本已ok而0网络请求；repeat list成功且found/created/revised=10/0/0。上海 cap11新增10条且全部body ok；显式helper0请求跳过；repeat list GET一次超时并返回partial，没重试。FJ/SH隔离数据库均有35 migrations、各只有一条disabled source；无worker、模型、analyses、receipts、publications、selection或job_runs。详见[北京](BEIJING_REAL_COLLECTOR_2026-10-05.md)、[福建](FUJIAN_REAL_COLLECTOR_2026-10-05.md)、[上海](SHANGHAI_REAL_COLLECTOR_2026-10-05.md)报告和各自ignored日志/SQL。上述只覆盖单个列表及有限10条候选，不证明全页历史、90日窗口、分页或周期稳定；Gate 2继续NOT_PASSED。

浙江“监管工作”候选页在图片新闻窄栏目之外增加9项真实列表证据；之后按该已存列表首条详情一次GET，HTTP200，列表/详情标题、PubDate/可见日/URL日一致，正文666可读字符/4段，未见附件。甘肃仍无目标栏目列表。整体配置/来源验收边界见[状态](STATUS.md)与[Gate 2清单](GATE2_ACTION_CHECKLIST.md)。

### 2026-10-06 已保存列表的首篇详情补充

获批的新增15次详情GET（Batch6 4、Batch7 4、Batch8 3、Batch9 3、浙江1）经独立离线核对为`attempted/dispatched/rejected=15/15/0`，Undici事件`create/sendHeaders/headers/error=15/15/14/1`。14份HTTP200 HTML raw的bytes与SHA-256逐份匹配manifest；唯一失败为青岛单次20秒timeout，无raw、无重试、无换候选。四组报告及浙江首篇详情报告见[batch6详情](REGIONAL_BUREAU_BATCH6_DETAILS_2026-10-06.md)、[batch7详情](REGIONAL_BUREAU_BATCH7_DETAILS_2026-10-06.md)、[batch8详情](REGIONAL_BUREAU_BATCH8_DETAILS_2026-10-06.md)、[batch9详情](REGIONAL_BUREAU_BATCH9_DETAILS_2026-10-06.md)、[浙江详情](ZHEJIANG_REGULATORY_FIRST_DETAIL_2026-10-06.md)。

样本只推进各行对应的一篇文章证据。广西、云南、宁夏、新疆样本含明确财政监管业务；海南、重庆、四川、大连、宁波、深圳、贵州、陕西、青海等样本主要为内部活动/组织学习，不能推断全栏目噪声率。云南列表显示日/URL日为9月18、PubDate和可见日期为9月24；新疆列表显示日/PubDate/可见日为9月24，URL路径日为7月17；两处冲突均保留，不猜权威字段。青岛详情仍unknown。上述不是历史分页、长期selector稳定或source pass。

同期FJ fresh库唯一pending行获批一次cap1诊断，观察为`unconfirmed/non_article_container`，body空、revision1、marker false；保存raw离线解析后，配置body selector内只有16字标题文本，无结构化段落，selector外邻接PDF未请求。独立只读审计发现无marker的unconfirmed行有自动分析/精选可达路径。Sol审查标记`CHANGES_REQUIRED / APPROVED_SCOPE`；已实施source-specific严格正文就绪保护并完成focused/full回归和最终CI。FJ源保持disabled，Gate 2仍`NOT_PASSED`。见[FJ诊断](FUJIAN_PENDING_BODY_DIAGNOSTIC_2026-10-06.md)、[下游边界审计](FUJIAN_UNCONFIRMED_SELECTION_GUARD_AUDIT_2026-10-06.md)、[Sol范围审查](S4_ATTACHMENT_GUARD_SCOPE_REVIEW_2026-10-06.md)、[operator notes](STRICT_BODY_POLICY_OPERATOR_NOTES_2026-10-06.md)。

### 2026-10-06 页面2有限观察与分页范围

Batch6四局保存的page1脚本推导出精确`index_1.htm`目标；四个direct GET均HTTP200且最终URL精确，Undici 8.11.2预算`4/4/0`，events为create/sendHeaders/headers/error=`4/4/4/0`。QA独立复核四份page1/page2 raw bytes与SHA、manifest事件及离线候选。广西、海南、重庆、四川每个page2各10个唯一候选，0个与page1 URL重叠；显示日期范围分别为08-11—09-07、08-17—09-08、09-02—09-21、07-29—09-01；共6项显示日与URL日不一致（1/1/0/4）。最早显示日2026-07-29，未到10月6日前90日界限2026-07-08，且没有遍历之后的页面。详见[page2 probe](BATCH6_PAGINATION_PROBE_2026-10-06.md)及[离线方案](PAGINATION_PROBE_PLAN_2026-10-06.md)。

独立S1裁定仅批准`mof_index_v1`阶段A的离线/loopback有界遍历能力与测试，不批准现有19个带详情规则来源接入、不批准真实collector/page请求或90日完成声明。默认单页行为保持；source opt-in、详情阶段/完成状态需另行决策。见[scope review](S1_WEB_LIST_PAGINATION_SCOPE_REVIEW_2026-10-06.md)和[web-list gap audit](WEB_LIST_BACKFILL_GAP_AUDIT_2026-10-06.md)。后续配置准备度报告针对下一批广西/海南/重庆/四川，仅离线评估；B报告的“no model”指项目provider调用0，本轮分析代理为Luna High。所有来源仍disabled；Gate 2 NOT_PASSED。

2026-10-06 checkpoint：S1 Phase A现已在`b2f479c4517d040f4b1c24b14e1407ad342bbb3a`完成受限实现、fresh 276/276软件回归及Check/Docker CI；范围仍是离线/loopback，coverage `unproven`。Phase B仅批准独立[metadata范围裁定](S1_WEB_LIST_DETAIL_METADATA_SCOPE_REVIEW_2026-10-06.md)描述的直接HTML标题/日期续做，尚未实施，不代表任何source准入。独立四川page3 probe的raw hash与manifest一致：page1/page2/page3的bytes/SHA均经QA本地重算；page3 exact URL单GET预算`1/1/0`、HTTP 200、10个候选、与前两页无URL重叠，其中3项显示日与URL日不一致。没有读取详情、运行collector或写数据库；见[四川page3报告](SICHUAN_HISTORY_PAGE3_PROBE_2026-10-06.md)。这些观察不证明权威日期、历史完整、source通过或Gate 2。

## 2026-10-07 福建分页观察与四局配置增量

经 root 对具体分页目标逐项核准，福建监管局保存栏目快照及三次新 direct GET 覆盖首页与 `index_1.htm`–`index_3.htm` 四页静态候选。独立 QA 重算三份新 raw 的大小与 SHA-256、核对请求事件、状态与精确 final URL，并对四页保存 HTML 使用相同 selector 独立解析：每页10条，40条候选没有跨页 URL 或逐条可见日期重复；四页行序均非单调，可见日/URL路径日期差异为4/3/5/2，含2026-07-09的90日窗口候选数为10/8/2/0。页间日期区间有交叠，但没有相同的逐条日期；`countPage=50`脚本值不证明余下页面存在、可读或覆盖完整。没有详情/附件请求、collector、数据库或worker/模型/OCR操作。明细、预算、QA和边界见[福建分页观察报告](P3_PAGINATION_OBSERVATION_2026-10-07.md)；raw与manifest留在ignored目录 `.data/fiscal-qa/oct07-accelerate-pagination/`。该证据仍不足以确认90日窗口完整或 source admission。

行业配置从19项增至23项（22 `web_list`、1 `json_list`），增加 `mof-guangxi-supervision-dynamics`、`mof-hainan-supervision-dynamics`、`mof-chongqing-supervision-dynamics`、`mof-sichuan-supervision-dynamics` 四个 disabled T1 地方局动态来源；全部间隔目标1440分钟、首次3个月且要求可信发布日期、站内/RSS全文关闭。Sol以 `APPROVED_SCOPE` 仅批准这四个新配置使用既有严格正文就绪布尔开关；与原福建配置合计恰好五个 opt-in ID，且所有来源仍disabled。没有改 runtime、schema、保护语义或门槛。新保存列表/详情 fixture和配置解析回归见`tests/regional-bureau-config.test.ts`；synthetic body fixture只验证selector，不代表实时来源正文质量。测试结果及准确tested SHA另记于本轮handoff与STATUS；软件证据不等于栏目完整度、来源准入或Gate 2通过。

逐局矩阵更新仅推进广西、海南、重庆、四川的已保存单篇正文与第二页观察；分页、完整近90日范围、频率/失败恢复、跨周期稳定、全栏噪声和source admission仍待验证。所有35局仍按用户确认的逐局新闻动态范围记录，中央选登只作补充；不能以新增四个source或四页/单篇样本代替其他局覆盖。Gate 2继续`NOT_PASSED`。

本次最终本机 Node24 fresh 35-migration DB `fiscalhot_oct07_accelerated_maintenance_test` 的 backend suite 为310/310，`npm run typecheck` 通过；Web build、Web tests15/15、loopback smoke通过。来源提交后CI run37563773669暴露2项OCR monitor timing断言；最小时限维护提交 `fbccb32a611a963981bf95a84dd00865837f0a88` 已推送，最终SHA的GitHub Check+Docker [37564353711](https://github.com/revercgy-hub/MYHOT/actions/runs/37564353711)成功；Linux backend 309通过、0失败、1 Windows-only skip。完整前后回归及旧CI失败见[加速恢复检查点](HANDOFFS/ACCELERATED_P3_CHECKPOINT_2026-10-07.md)；软件测试不改变source admission状态。

## 2026-10-07 新四局配置、历史页观察与独立质量回归

行业配置在代码SHA `e3791c2744c285c7967cb1c6597da3187817889b` 增至27项（26 `web_list`、1 `json_list`），新增宁夏、青海、陕西、贵州四个来源。它们的URL、list selector、配对detail metadata/body selector与已有保存页面相符；每项均为T1、`interval_minutes=1440`、`initialBackfillMonths=3`、`initialBackfillRequirePublishedAt=true`，enabled及两项全文许可均为false。Sol于10/7批准四项采用既有 `_aihot.requireBodyReadyForAutomaticSelection: true`；与先前五项合计为精确九ID，条件续批范围见[S1配置续批裁定](S1_BUREAU_BODY_POLICY_CONTINUATION_2026-10-07.md)。新增parser fixtures中的正文使用合成段落，仅证明selector解析，不视为官方正文质量验证；单篇样本在[Batch 8详情](REGIONAL_BUREAU_BATCH8_DETAILS_2026-10-06.md)与[Batch 9详情](REGIONAL_BUREAU_BATCH9_DETAILS_2026-10-06.md)。

获准宁夏、青海各一页 `index_1.htm` 的只读观察预算为`2/2/0`，两页HTTP 200。独立 QA 使用当前27项配置解析，核对 raw/hash、EOF、标题/URL/可见日及 allowlist。宁夏10项与首页无URL重叠，日期顺序非增，4项日/路径日期不同；窗口截止日2026-07-09，9项在窗、1项更早。青海10项与首页无URL重叠，但日期乱序、2项日/路径日期不同；10项均在窗，最早日期2026-08-10，尚未到90日边界。详见[下一历史页报告](P3_NEXT_HISTORY_CHECK_2026-10-07.md)；raw/manifest仅在ignored `.data/fiscal-qa/oct07-next-history/`。不证明90日完整、日期权威或collector分页能力。

之后另有一份获准宁夏只读快照尝试（独立manifest `ningxia-snapshot-manifest.json`）：首页前置GET在20秒超时，预算为`1/11` dispatch，记录1个request:error，无response headers/raw，不重试；按失败即停止规则没有请求任何历史页或首页后置快照。该失败与上段先前成功的两条 `index_1.htm` 请求是不同运行，不改变其保存证据，也不构成刷新/周期稳定性证据。

代码SHA `e3791c2744c285c7967cb1c6597da3187817889b` 的本机全套QA使用新建 `fiscalhot_oct07_bureau9_test`、执行35 migrations：typecheck通过、backend tests 310/310、Web build通过、Web tests 15/15、loopback smoke 30/30。GitHub Actions run [37573322451](https://github.com/revercgy-hub/MYHOT/actions/runs/37573322451) 的Docker job成功；Check中的typecheck、Web build/tests、migration/seed及built-site smoke通过，backend为308通过、1失败、1 skip。失败是既有Windows monitor deadline fixture在CI中期待 `page deadline`，实得 `total deadline`，位置 `tests/fiscal-ocr-scan-poc.test.ts:319`；完整失败记录保留于ignored `.data/test-pg/oct07_bureau9_ci_37573322451_failed.log`。该失败不因本机310/310或配置/parser通过而覆盖；没有在相同SHA上重跑CI。完整交接见[新四局检查点](HANDOFFS/NEXT_BUREAU_CHECKPOINT_2026-10-07.md)。

获准最小deadline-reason维护提交`d4fd46ded57cd899793e819a3b49ff8bf6e72e4f`仅固定budget admission阶段的终止原因并校正对应边界fixture，没有增加OCR能力或预算。全新35-migration DB的backend tests310/310、typecheck通过；同SHA CI run [37574033213](https://github.com/revercgy-hub/MYHOT/actions/runs/37574033213) Check+Docker success，backend309通过/0失败/1 Windows-only skip，Web build/tests15/15、migration/seed与built-site smoke全过。它关闭了软件deadline分类验证，但不改变来源证据、enabled状态或Gate 2结论。

## 2026-10-07 连续P3来源配置与甘肃配对证据

配置工作树曾由27项增至32项；该中间状态已由下方最终冻结状态取代，不再作为当前配置数量。

独立QA复核Batch7大连、宁波、深圳主页/列表/详情的保存raw、manifest、hash及列表/详情身份；也复核获准的青岛详情重观测和甘肃首页、列表及配对详情。青岛clean正文为1,046字符/6段，manifest的2,764字符包含内嵌CSS；该篇是内部中秋活动。甘肃首页主内容锚点实指向“工作动态”列表；列表有10个候选且声明10页，未读其它页。配对样本列表日、`PubDate`和可见发布日期均为9月4日，URL token为8月21日；去除style/script/noscript后正文2,923字符/16段、无附件链接，涉及超长期特别国债资金、转移支付、预算执行和地方债监管。日期行序、路径差异、单页及单篇限制均保留；这些证据仅支持来源入口和单篇边界核对，不代表跨周期、近90日覆盖、全栏质量或source pass。完整manifest/raw索引和独立QA记录见[连续P3剩余来源证据](P3_REMAINING_SOURCE_GAPS_2026-10-07.md)。

这段工作没有运行collector、worker、真实模型或OCR，也没有seed或改写预览数据。`fiscalhot_preview_test`的只读快照在恢复本地loopback服务前后均为35项migration、3个disabled且全文关闭的source、3篇空body固定样本和3条publication，fetch/analysis/receipt/selection/job-run均为0；该环境检查与来源配置质量相互独立。Gate 2仍`NOT_PASSED`，所有35局的栏目、分页/90日窗口、日期语义、正文/附件退化和跨周期证据仍按逐项矩阵闭环。

## 2026-10-07 最终冻结的连续P3配置、证据边界与软件QA

此前连续来源配置检查点代码SHA `2e2a021ae5a5eaa614a758724480dc8b266f33e3` 包含46项配置（45 `web_list`、1 `json_list`），精确28个regional strict body-ready opt-in；每项均disabled，站内及转发全文许可关闭，未导入或seed到preview/production。已Lead exact接受新增regional IDs包括大连、宁波、深圳、青岛、甘肃、天津、河北、山西、内蒙古、吉林、黑龙江、山东、江苏、安徽、江西、新疆、浙江、辽宁、云南；各源实际栏目/样本与缺口仍看[区域覆盖矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)。短文、内部活动或只通过合成fixture的条目不得升级成实际正文质量通过。后续仅获准增加会计司中央source一个exact strict exception，详见本节最新增量。

本轮独立QA离线重算了保存raw长度/hash并比对manifest、精确目标/最终URL、HTTP/EOF、列表候选和detail题名/日期字段、clean body与附件链接。末两条已批准详情中辽宁列表/PubDate/可见日期为8月26日而URL token为8月13日；云南配对样本三者为8月27日而URL token为8月21日。云南已知冲突文章`https://yn.mof.gov.cn/caizhengjiancha/202609/t20260918_3997764.htm`继续保留既有history hold，且按Sol批准的来源级exact URL deny排除；第二篇样本不决定云南的全源日期语义。甘肃对应detail为9月4日列表/PubDate/可见日与8月21日URL token，clean body约2,923字符/16段且无附件。浙江首期栏目依用户决定为“监管工作”，图片新闻后续补充。各请求、精确SHA及其它来源事实见[continuous handoff](HANDOFFS/CONTINUOUS_P3_HANDOFF_2026-10-07.md)和[连续P3剩余来源证据](P3_REMAINING_SOURCE_GAPS_2026-10-07.md)。所有这些都是有限观察，不建立90日历史覆盖、来源级日期规则、selector长期稳定或source admission。

甘肃另完成collector前的本地loopback canary，独立QA确认成功manifest exit0、7/7案例通过且没有外部HTTP/DB/collector；gzip capture 4,488B/SHA `b6a3a91fbac3b6040423c1e8aa291a9a059c2a9882d2f770d1117ac310fa6090` 解压后与12,555B列表raw逐字节一致（SHA `2d30c52e5c3cd93e34dba0d183c971aadca43e2ddc27866ccaef9079dbc9f27e`），EOF true，唯一批准候选title/date/URL可被配置解析。redirect、non-HTML、6 MiB body与gzip解压限额、dispatch cap=2以及6种精确URL deny变体均按预期拒绝；两次早期失败manifest保留。配套collector runner的60秒hard stop、2 dispatch/20秒请求timeout及唯一新建隔离库目标经静态核对；并未运行collector或生产HTTP。细节见[连续P3交接](HANDOFFS/CONTINUOUS_P3_HANDOFF_2026-10-07.md)。

冻结代码的fresh数据库`fiscalhot_p3_continuous_20261007_test`执行35 migrations，typecheck通过、backend 310/310、Web production build通过、Web tests15/15、loopback smoke通过；同一SHA GitHub Check+Docker run [37611936804](https://github.com/revercgy-hub/MYHOT/actions/runs/37611936804)成功，backend 309 pass/0 fail/1 skip。上述全套软件QA未运行真实provider、collector、worker或OCR；之后授权的独立甘肃collector限量样本见下段。软件QA和单次collector样本均不等于source pass；Gate 2仍`NOT_PASSED`，35局栏目/窗口/日期/内容/附件/身份更新/跨周期要求继续依现有Gate 2清单逐项推进。

甘肃在loopback canary之后获准执行唯一一次legacy collector样本。fresh库`fiscalhot_oct07_gansu_legacy_test`先有35 migrations、空source/articles/fetch_runs；一次运行精确GET列表与详情各1次（Undici `2/2/0`，两份HTTP200 gzip EOF），found1/new1，新增1篇2026-09-04(+08)正文`ok`/revision1、2,923字符。原始gzip captures为4,402B/SHA `bc1031388b55d4dc4262e3450416c645ba3836043afa836e2bd6243d827230da` 与8,604B/SHA `d4e11dac4708bc99c6060bb9fa4e14c18109a3eb0166d5e3e4db15bd3068b990`；QA独立解压并确认与保存list/detail raw逐字节一致。source仍disabled/fulltext-off，无分析、receipts、publication或selection；一个分析job queued但worker未启动/未消费。初始化cursor只证明该次运行写入，不证明daily调度、近90日覆盖、恢复、全栏质量或source admission；详细结果见[continuous handoff](HANDOFFS/CONTINUOUS_P3_HANDOFF_2026-10-07.md)。

G2-A4另有PBOC OMO saved-snapshot runtime replay：固定MockAgent `disableNetConnect`、外网HTTP 0，在独立fresh 35-migration DB将9月29与9月30两张保存列表按精确已批准URLs回放。parser各20条，exact URL overlap19；第191号文章第二轮被识别为同一normalized URL/material identity，article ID/content hash/revision1/discovery1保持，第二轮只新建第192号一条。两次collector fetch均`ok`，分别found/new 1/1与2/1；每条详情只请求一次，无worker/model/receipt/analysis。时钟推进是模拟，不代表实际daily可靠性；中央样本也不替代地方35局逐项证据或source acceptance。原始审计、DB路径及边界见[连续P3交接](HANDOFFS/CONTINUOUS_P3_HANDOFF_2026-10-07.md)。

## 2026-10-07 会计司精确正文保护与有限历史快照

At the earlier accounting-guard checkpoint, Sol had approved `mof-accounting-notices` as the sole central exact-ID exception; the catalogue then had 46 sources and 29 opt-ins. That historical code checkpoint was `3108be5671ec0939bda7341a0b0c5f4753a1daf7` and its QA/CI result remains recorded here for traceability. A later exact central scope added `mof-budget-work` and `mof-finance-notices`, bringing the current catalogue to 46 sources and 31 strict IDs without changing the regional standing set. The current configuration and fresh QA result are documented below and in the [continuous P3 handoff](HANDOFFS/CONTINUOUS_P3_HANDOFF_2026-10-07.md). The accounting negative fixture and its `ALLOW_PRIVATE_NETWORK_FETCH=true` limitation remain in the earlier report; none of these strict guards proves XLSX parsing, source-wide body quality, or source acceptance.

三局既有page1/page2与PBOC列表的独立QA使用保存raw、原始manifest、实际source selector/parser及之前快照；不连数据库、不运行collector。regional page1、page2各3个exact列表GET均HTTP200/final URL exact/gzip EOF，capture bytes/SHA与manifest一致；page0/page1引用raw hash亦复核一致。离线`fromHtml`重解析六份页面，每页10个候选，URL集合匹配；各页内重复及与之前页URL overlap均为0。page1显示日全晚于2026-07-09；page2按显示日统计，≤7/09天津7条、山东4条、内蒙古4条，显示日/路径日期不一致分别1/6/3。最早显示日5/29、6/25、6/22仅说明有限快照触及既定边界，非完整历史覆盖或日期权威。

PBOC当前列表快照限cap=1，HTTP200/EOF，raw 40,079 bytes，SHA `fe16e2da27948d98b63dee28239f5d53895acacdd24a124e461b34864178aa4d`；实际parser取20条，和既有20条snapshot完全重叠，没有new/removed/changed。该单次列表对照不等于跨日runtime去重或daily可靠性。manifest路径、实际行/日期与边界见[连续P3交接](HANDOFFS/CONTINUOUS_P3_HANDOFF_2026-10-07.md)及ignored `.data/fiscal-qa/continuous-source-gaps/history-pages-20261007/`。Gate 2继续NOT_PASSED。

## 2026-10-07 Core source strict-body exceptions

After the 46-source/29-ID checkpoint above, Sol approved two further exact central IDs for the existing `requireBodyReadyForAutomaticSelection: true` flag: `mof-budget-work` and `mof-finance-notices`. That historical code checkpoint had 31 opt-ins total; later exact approvals are recorded below.

## 2026-10-08 strict-body exact scope and Xiamen debt negative check

The current source config at `edd0644ddcdee42de03eb21ad4704108f08000a5` contains 46 sources and exactly 40 strict-body opt-ins: the 35 regional IDs documented in the [operator notes](STRICT_BODY_POLICY_OPERATOR_NOTES_2026-10-06.md), plus five core IDs (`fujian-finance-notices`, `mof-accounting-notices`, `mof-budget-work`, `mof-finance-notices`, `xiamen-finance-debt`). This is a configuration checkpoint only; every source remains disabled with both full-text permissions false, and none was imported into preview or production. The exact Xiamen debt scope was reviewed against its saved official list/detail pair. Current offline extraction returned `identity_missing` and null body, and the strict readiness helper returned a hold for `unconfirmed`/null. Detail raw SHA-256 is `19a2f94d976ad7a077c7c1789e0fbb40159bb8d9d35ec843c521b713b3468a08`; helper result is saved in ignored `.data/fiscal-source-audit/xiamen-finance-debt-strict-helper-probe-20261008.json`. The historical 205-character false-positive row remains untouched and is not a positive readiness example; source admission remains unestablished. The 40-ID code commit passed fresh local QA and same-SHA CI run [37709884742](https://github.com/revercgy-hub/MYHOT/actions/runs/37709884742); full test details and preserved initial 39-ID failure are in the [continuous P3 handoff](HANDOFFS/CONTINUOUS_P3_HANDOFF_2026-10-07.md).

Two cap-bounded current-list snapshots from 2026-10-08 were independently verified from saved manifest/raw files and reparsed with current configuration. The Treasury stats raw is 12,330 bytes, SHA-256 `DFCEE01132E64572FD373457A4CAB5796DFA56E0ACD8632C28C2E0B8E6055E9D`, with ten parsed entries; it matches the bound saved snapshot byte-for-byte. The Xiamen supervision list is 12,797 bytes, SHA-256 `927B4F055EFB98202737D410DD65BE029AB21E57D866C9E4FF744A537E07F89E`, ten entries; it matches the 2026-09-29 saved list byte-for-byte. The approved batch dispatched exactly two requests, both 200/EOF, with zero rejected requests; no details, attachments, database writes, collector, worker, model, or OCR ran. Xiamen row 5 has URL path token 2026-09-20 and displayed/list publication date 2026-09-24; retain that mismatch as a diagnostic and use the displayed date for this observation. These are two first-page saved-snapshot comparisons, not evidence of ongoing refresh, source admission, historical completeness, or 90-day coverage.

## 2026-10-08 Formal Gate 2 disposition and pilot boundary

The frozen [formal review](GATE_2_REVIEW.md) is `APPROVED / PASSED_FOR_BOUNDED_P4_PILOT`. The approval permits only an article-level fixed sample for P4 from `pboc-open-market`, `mof-treasury-debt-data`, and `mof-xiamen-supervision-dynamics`; each included article must have verified identity, title, date, and attachment status, with `body_status=ok` and nonempty trimmed body. It does not admit all candidates from these source IDs, the 46-source catalogue, or the 35 regional sources for unattended collection. `xiamen-finance-debt` remains `NOT_ADMITTED` and excluded; its 205-character historical false-positive row is preserved and must not be copied into the pilot. Government/NFRA source work and all other coverage/quality items remain in the source mainline; their status is not silently changed by this limited gate decision.

## 2026-10-08 GovCN/NFRA bounded endpoint observations

Independent offline QA of `.data/fiscal-qa/govcn-nfra-source-20261008/{govcn,nfra}/` recomputed all four raw hashes/lengths and checked packet request accounting. Each 2-request packet was `attempted/dispatched/rejected=2/2/0`; all four responses were HTTP 200, exact requested/final URL, EOF true, with 20-second request/60-second packet limits, 6 MiB cap, and no redirect/retry/extras. No DB, source config, collector, worker, model, OCR, attachment or script execution occurred.

GovCN's `https://sousuo.www.gov.cn/zcwjk/policyDocumentLibrary?t=zhengcelibrary_gw` returned a 974-byte HTML shell (SHA-256 `ce81dd119e141f504631ccd1bda83e2b8495b991a6c329b8893a027da2ecef64`) that references the separately approved `https://sousuo.www.gov.cn/zcwjk/js/app.46949c63.js`; its 338,585-byte raw (SHA-256 `959e7575cf02de461c325e45bce73df6a079ee030775e5392c709b2fde18ed59`) was statically scanned only. Route hints in the script were not executed or fetched. The current HTML shell does not itself supply a parsed list.

NFRA list `https://www.nfra.gov.cn/cbircweb/DocInfo/SelectItemAndDocByItemPId?itemId=914&pageSize=6` raw is 26,200 bytes (SHA-256 `a45ad64cf1313e75850616e77a2e1cf65036008e7b1e51e915c07c3d5c914600`). Strict UTF-8 JSON parsing returns seven categories; category `itemId=915` / `监管动态` has six rows and includes `docId=1273452`. The candidate title is `金融监管总局 科技部等部门联合召开科技保险交流推进会 多方协同支持科技创新`. Exact detail URL `https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1273452` raw is 54,623 bytes (SHA-256 `b6e46388f904c8c8fead84cc66997b0a11dc4eca79e02fd03de1556fa7fc2af7`). It parses as valid UTF-8 JSON, with matching ID, title/subtitle after whitespace normalization, and publish date `2026-09-28 17:35:08`. Response headers are `application/json` without charset; the inner `docClob` has a `gb2312` meta declaration. Recomputed from raw UTF-8, structured title/list identity agrees and the clob is 47,038 characters with zero U+FFFD. Strict GB18030 reinterpretation of the raw JSON fails on byte `0x80`; replacement decoding yields 130 U+FFFD and loses the inner title. The current shared `guardedFetch.decodeBody()` at `packages/backend/src/lib/http-fetch.ts:144-159` nonetheless scans the first 2,048 bytes for HTML meta charset without restricting that sniff to HTML; embedded meta is at byte 1,772, so this JSON is decoded as GBK and its otherwise valid UTF-8 is corrupted in the current helper. This runtime behavior is unmodified and not fixed by this evidence-only QA.

The manifest's derived `offlineAnalysis.detail` conflicts with the raw response: it records a mojibake structured title, 47,878 clob chars and 40 replacements. The explicit raw-based correction `.data/fiscal-qa/govcn-nfra-source-20261008/nfra/raw-based-correction.json` (3,294 bytes, SHA-256 `800b34254f683432212fba76580896e1926f24b496a866141f2322ae83525108`) preserves the prior derived observation and records the raw UTF-8 parse. QA accepts the manifest-bound raw/transport and independent raw UTF-8 identity/date/title pair, but not the stale derived fields. The embedded `gb2312` meta is not an outer response charset; no manual raw GB18030 transcode is supported. The shared `decodeBody()` meta-sniff bug was fixed in `18e159be43810974dc80b2bb26d05babd6744646`; focused tests and an exact-origin replay of the actual saved detail raw confirm valid JSON/UTF-8 title and byte preservation. NFRA nested-category/separate JSON detail compatibility remains a distinct product gap. This is one endpoint pair only, not source admission, a working product parser, or proof of full-body quality. GovCN/NFRA remain source-mainline work; neither is passed, hash-exempt, nor permanently deferred.

## 2026-10-08 GovCN list/detail sample

The one-shot query `https://sousuo.www.gov.cn/search-gov/data?q=&sort=score&sortType=1&searchfield=title&p=1&n=5&type=gwyzcwjk` returned 34,046 bytes of strict UTF-8 JSON (SHA-256 `b6df9bf38ff165c672154b3696c30e4cc7c2e9965523a267be4afc4b59a89d35`); request count was exactly 1/1/0, HTTP 200, final URL exact, EOF true, cap 1, 20s/request, 30s/global, 6 MiB. The saved JS and raw query evidence show four category groups of five rows; every row includes a short `summary`, not a full-body guarantee. The matching `bumenfile` row is the eight-agency services-finance directive, list date 2026.09.28, exact detail URL `https://www.gov.cn/zhengce/zhengceku/202609/content_7082302.htm`.

The exact one-GET detail response is HTTP 200/EOF/native exit 0, with no retry or redirect. The 61,625-byte entity body SHA is `49a45d9fd5ea90f53978736363c005d9ee819ff613b1093424b29183e4a7c61d`; despite the response gzip header, `GuardedResponse.body` is already-decompressed HTML, so this is not a wire-compressed hash. The page title after removing its `_国务院部门文件_中国政府网` suffix matches the list title. List `pubtime` (2026-09-28T13:50:00Z) matches HTML `firstpublishedtime`/`lastmodifiedtime` (2026-09-28 21:50 +08); the visible `成文日期` is 2026-09-25 and is a separate signing date. There are no `ArticleTitle`/`PubDate` meta tags. The observed substantive main body selector is `#UCAP-CONTENT .trs_editor_view` (5,635 normalized characters, 35 paragraphs); no attachment links were found. The raw-based detail correction `.data/fiscal-qa/govcn-detail-20261008/raw-based-detail-analysis-correction.json` (SHA-256 `f62a4a0d72983abb56b6ecc5a55fe823090a3130d4fbceaadfd1dcc25a1eba06`) preserves the original manifest's flawed title/date booleans, superseded by this independent comparison. This is a single candidate pair, not evidence of complete category/page coverage, a configured source or source admission. No GovCN configuration change was made.

## 2026-10-08 P4 isolated sample preparation

Two article candidates were copied into fresh isolated `fiscalhot_p4_preparation_20261008_test` for read-only P4 planning: one Treasury article (origin revision 2; target revision 1) and PBOC OMO 192 (origin revision 1; target revision 1). Independent planner and SQL audits matched IDs, source IDs, exact URLs, titles, publication dates, body status/length and hashes; body text matched byte-for-byte. The target has 35 migrations, 2 source/article/revision rows, zero fetch_runs/analyses/receipts/receipt_attempts/job_runs/selected jobs, and no pg-boss job table. Both sources remain disabled/fulltext-off and the target rows are unqueued. Planner accepted 2/2, but made zero calls/writes/HTTP/collection and started no worker. Provider is `UNCONFIGURED`; its capacity snapshot is not reserved and amount estimate is unknown. This is isolated sample preparation only: it does not run P4 or include the third approved source's article, and it changes neither the fixed-sample boundary nor source-admission status. See the 2026-10-08 P4 section of the [continuous handoff](HANDOFFS/CONTINUOUS_P3_HANDOFF_2026-10-07.md) for artifact hashes and the full reconciliation.
