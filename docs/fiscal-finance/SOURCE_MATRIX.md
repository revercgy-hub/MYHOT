# 官方信源验证矩阵

本矩阵区分页面结构、只读 preview 与隔离数据库验证。以下“未运行采集 worker、数据库写入、队列、模型或付费 fallback”仅指原九个 HTML 来源的 `previewSource` 和一个 JSON 来源的 `fetchJsonList` dry-run 阶段。其后另在隔离 `_test` 数据库对三个 HTML 来源运行两轮受限 collector ingest，产生 30 篇 backfill 记录和 30 个未消费正文任务；验证范围与结果见 `P3_INGEST_VALIDATION.md`。这 30 篇的最新 SQL 正文汇总为 29 `ok`、1 `unconfirmed`、0 `pending`；30 个 `content.extract-body` 队列项仍未消费。此前的 28/2 是同一批记录的较早状态，已由最新单篇复验更新。另对 `pboc-open-market` 第191号做了一次隔离库两轮小样：首轮入库、二轮判重，结果见 [P3_OMO_VALIDATION.md](P3_OMO_VALIDATION.md)；这不是 30 篇批次的一部分。原十个来源的既有 P3 证据与后续两轮验证范围保持原样；当前 `industry/sources.json` 另增两个财政部监管局动态来源，合计12个（十一个 HTML、一个 JSON），均为 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`。新增来源的单次静态候选验证不等同于 collector 写库、正文验证或 Gate 2，详见下文和[来源调查记录](REGIONAL_SUPERVISION_SOURCES.md)。原十源 QA 与 Ubuntu `Check` workflow run [36589569943](https://github.com/revercgy-hub/MYHOT/actions/runs/36589569943) 的历史记录不代表新增两源经过相同回归；该 CI 在测试代码 SHA `dafe938` 上验证通用 Linux 测试/构建，不代表真实官方 PDF 已在 Linux 解析。所有来源仍需后续 Gate 验收分页、重复、正文和长期可靠性。

## P3 新增：财政部各地监管局动态（2026-09-29）

用户新增全国财政部各地监管局新闻动态覆盖要求。本轮在原十个来源基础上新增两个 disabled `web_list` 配置；没有新增监管局实体或主题页。完整官方入口、原始快照说明、35局目录清单及配置边界见[来源调查记录](REGIONAL_SUPERVISION_SOURCES.md)。目录显示35个局，但只有以下中央选登栏目及厦门局栏目经过本轮实际 HTML/parser 检查；不能将目录核对说成35局栏目核验。

| source ID | 实际候选页与配置解析 | 本轮有限验证 | 边界 |
|---|---|---|---|
| `mof-regional-supervision-dynamics` | 财政部“财政新闻”列表 `https://www.mof.gov.cn/zhengwuxinxi/caizhengxinwen/index.htm`；从真实快照验证 `ul.xwfb_listbox > li:has(a[title*='监管局'])`，标题读 `a[title]`，日期读同项 `span`；35个官方目录域名的 HTTP allowlist 限定文章链接。 | 快照原始列表共25项；项目 `fromHtml()` 按实际配置筛出7项，署名涉及广西、云南、吉林、福建、重庆、安徽、山东监管局，URL唯一；抽样标题、列表日期与文章 URL 均在列表项。 | 财政部选登而非35局全量实时源；本轮只读首页，没有抓取其20页历史，也未逐条比对中央列表日期和原局详情发布日期。未运行 `collectSource()`、写库或正文队列。 |
| `mof-xiamen-supervision-dynamics` | 财政部厦门监管局“工作动态” `https://xm.mof.gov.cn/caizhengjiancha/index.htm`；`ul.liBox > li`，标题读链接 `title` 属性（缺失回退可见文本），日期读列表项 `span`，URL限制在栏目路径内。 | 实际首页快照解析10项；第一条日期2026-09-29。配置列表 selector/标题/日期和 URL 解析经本地 parser 检查；另检查一篇2025详情，题名、正文、发布日期和链接可读。 | 最新列表首项详情未能直取；历史详情样本不是首页首项正文验收。分页脚本有10页，但本轮仅读取少量历史页用于核对存在性，未批量验分页覆盖、重复率、正文完整度或 freshness。未运行 `collectSource()`、写库或正文队列。 |

福建监管局列表/详情有界请求两次均为 HTTP 502，虽中央财政新闻快照选登一篇福建局稿件，本轮没有足够本地列表快照证据来配置福建独立源。中央更专用的“全国财政新闻联播 > 财政部”栏目本次快照陈旧，未采用。全国35局目录仅用于确认官方机构域名和中央来源的链接 allowlist，不推断其它33个局已有可用动态栏目。新增两源均为 T1、每360分钟、`enabled=false`、站内/RSS全文均关闭；具体来源与限制见[来源调查记录](REGIONAL_SUPERVISION_SOURCES.md)。Gate 2 仍未通过，本轮没有开启 worker、模型或大规模采集。

状态含义：

- **结构已核验，待 P3**：直接读取了列表与至少一篇文章，确认标题、日期、详情链接及 URL 范围；还未运行项目 collector。
- **待核验**：只找到官方入口/检索结果，或请求受阻；没有足够证据编写 selector，因此不进入 sources.json。

| 首批来源 | 列表页 / 入口 | 页面与结构证据 | 分页、噪声、历史、重复观察 | 当前状态 |
|---|---|---|---|---|
| 财政部预算司 | [工作动态](https://yss.mof.gov.cn/gongzuodongtai/) | Node fetch 直连 HTML 返回 200；本次列表 10 条，`ul.liBox > li`，链接 `a[href]`、标题 `a`、日期 `span`。详情样本 [2026-03-26](https://yss.mof.gov.cn/gongzuodongtai/202603/t20260326_3986132.htm) 返回 200，meta `ArticleTitle` / `PubDate` 和正文可见，列表与详情字段吻合。URL 前缀限定 `/gongzuodongtai/`。日期只有日历日，没有时区。 | 10 个选中条目的 href 唯一。通过 `createPageHTML` 观察到 `index.htm`、`index_1.htm` 等分页；抽查第 2 页有 2023/2022 历史条目，collector 不会自动翻页。列表首页当前最新可见日期为 2026-03-26，距核验日较久，存在新鲜度疑问。样本页含会议、培训等非政策动态，需精选过滤。 | **结构已核验；新鲜度需在 P3 复核**；已配置 disabled `mof-budget-work` |
| 财政部（综合政策发布） | [政策发布](https://zhs.mof.gov.cn/zhengcefabu/) | Node `guardedFetch` 直连 HTTP 200，14,521 字节；实际 `ul.liBox > li` 命中 10 篇，标题为链接文本/`title`、日期为 `span`。最新条目为《中华人民共和国财政部公告2026年第24号》（2026-08-26），详情 HTTP 200，`ArticleTitle` 与列表一致、`PubDate=2026-08-26 10:22:00`，Readability 4,024 字符。10 个列表候选链接唯一。 | 页面有 `createPageHTML(50, 0, "index", "htm")` 分页脚本；当前配置仅读首页。首页日期截至 2026-08-26，已有约 34 天的新鲜度间隔；栏目含彩票等综合财政内容，需精选。 | **结构与一次性 collector preview 已核验；禁用待 P3/Gate 2**；已配置 disabled `mof-policy-release` |
| 中国政府网 | [国务院政策文件库](https://sousuo.www.gov.cn/zcwjk/policyDocumentLibrary?t=zhengcelibrary_gw)，[部门文件页](https://www.gov.cn/zhengce/zhengceku/bmwj/home.htm) | 政策文件库两类查询参数均 HTTP 200，但响应只有 974 字节 JS 壳，无列表/详情链接。静态部门文件页 HTTP 200、32,713 字节，`ul` 中 64 项，抽出的部门文件列表候选 38 个详情链接；首页最新可见文件日期为 2026-02-02。样本详情 `https://www.gov.cn/zhengce/zhengceku/202602/content_7056817.htm` HTTP 200，标题完整。 | 当前静态部门页约落后核验日 8 个月；未确认分页、去重和适合作财政金融持续源的当前内容。动态政策库未返回可供当前 collector 解析的静态列表。 | **待核验：动态列表能力和静态页新鲜度阻塞；不配置** |
| 财政部金融司 | [工作通知](https://jrs.mof.gov.cn/gongzuotongzhi/) | Node `guardedFetch` HTTP 200，12,929 字节，`ul.liBox > li` 命中 10 篇；最新为《关于公布2026年中央财政支持普惠金融发展示范区名单等有关事项的通知》（2026-07-16）。详情 HTTP 200，列表/`ArticleTitle` 完全一致、`PubDate=2026-07-16 16:09:00`，Readability 1,493 字符。单次 `previewSource` 返回 10 候选。 | 页面采用 `createPageHTML(21, 0, "index", "htm")`，仅核验首页，没有跟页；最新可见条目为 7 月 16 日，需复核新鲜度。工作动态页最新日期仅至 6 月 8 日，故本次选择内容更明确的工作通知栏目。 | **结构与一次性 collector preview 已核验；禁用待 P3/Gate 2**；已配置 disabled `mof-finance-notices` |
| 财政部会计司 | [工作通知](https://kjs.mof.gov.cn/gongzuotongzhi/) | Node `guardedFetch` HTTP 200，14,018 字节；`ul.liBox > li` 命中 10 篇。最新列表候选为《财政部关于加快推进会计数智化工作的指导意见（征求意见稿）》征求意见函，列表日期 2026-09-21；详情 HTTP 200、标题吻合，但 `PubDate=2026-09-22 14:39:00`，与列表日相差一天；Readability 473 字符。单次 `previewSource` 返回 10 候选。 | `createPageHTML(50, 0, "index", "htm")` 显示有分页生成机制；本次只读首页，未查旧页重复。列表/详情日期口径差异需在 P3 核对后再作为 freshness 依据。 | **结构已核验，日期口径有差异；禁用待 P3/Gate 2**；已配置 disabled `mof-accounting-notices` |
| 中国地方政府债券信息公开平台 | [平台首页](https://www.celma.org.cn/)，[发行结果栏目](https://www.celma.org.cn/fxjg/index.jhtml)，[发行安排栏目](https://www.celma.org.cn/dfzfxjh/index.jhtml) | 平台首页 HTTP 200、51,168 字节，官方站名可见且确有债券信息入口。发行结果及发行安排栏目直连均 HTTP 200、73,642 字节，返回相同通用模板；其中 114 个 `<li>` 是导航/选项，不含可解析发行文章链接。首页能直接链接到“2026年10月江西省债券发行安排公开”详情 `https://www.celma.org.cn/dfzfxjh/70535.jhtml`（HTTP 200），但未找到与之配套的静态栏目列表行/发布日期。 | 栏目由模板内脚本呈现筛选/数据，通用列表响应缺真实行；详情页可访问但普通列表 collector 无法发现候选。已找到的交易/报告链接横跨平台与财政部子站，不能据首页混合链接拼成稳定的发行结果 selector。 | **待核验：列表以动态数据呈现、无稳定 HTML 候选；不配置** |
| 中国人民银行 | [公开市场业务交易公告](https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/index.html) | 官方主页及栏目 HTTP 200；静态栏目 40,079 字节，`tr:has(font.newslist_style)` 命中 20 条，链接含标题及 `title` 属性，`span.hui12` 为日期。列表最新为 2026-09-29 第191号。第[191号详情](https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/2026092908461628271/index.html) HTTP 200、`ArticleTitle` 与列表一致、`PubDate=2026-09-29`。配置启用 `titleAttribute=title` 后，一次 `previewSource` 返回 20 候选且标题完整；`+08:00` 解析得到上海日历日 2026-09-29。 | 首页候选为逐日逆回购操作公告，href 唯一且栏目 URL 可限制在 `/zhengcehuobisi/125207/125213/125431/125475/`；未实测栏目分页。第191号正文容器约 162 字，低于 Readability 200 字阈值，所以 `readable()` 为 `null`、preview 显示 0；这不是页面无正文。按 AD-009 将 `#zoom` 作为唯一正文容器、显式启用 `allowShortBody` 后，以本地快照运行共享 `extractSelectedBody` 得到 174 字文本、1 张表格，核对到 7 天、1.40%、905 亿元和 6,985 亿元；题名与 `PubDate=2026-09-29` 均匹配。此项是离线 helper 验证，不是 collector/worker 运行。相邻[第190号详情](https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/2026092808454683233/index.html)正文容器约 204 字，Readability 为 210，显示日常公告在门槛附近波动。保留原门槛，source 继续 disabled。只读 HTML 证据见忽略目录 `.data/fiscal-central-audit/html/pboc-omo-detail.html`、`pboc-omo-detail-190.html` 和 `inspect-omo-second.json`。 | **列表与详情结构已核验；共享短正文 helper 离线验证通过，仍禁用待质量复核**；已配置 disabled `pboc-open-market` |
| 财政部国库司（统计数据） | [统计数据](https://zwgls.mof.gov.cn/tjsj/) | Node `guardedFetch` HTTP 200，12,330 字节；`ul.liBox > li` 命中 10 条，最新为《2026年8月地方政府债券发行和债务余额情况》（列表日 2026-09-24）。详情 HTTP 200，`ArticleTitle` 一致、`PubDate=2026-09-24 14:52:00`，Readability 1,021 字符。一次 `previewSource` 解析 10 个候选，最新候选日期在 `+08:00` 下保持 9 月 24 日。 | 首页 `createPageHTML(3, 0, "index", "htm")`；直接检查 `index_1.htm` HTTP 200、再有 10 条，最新为 2025 年 10 月；第二页含 PDF 和中央政府收支统计等异类条目，当前配置仅读首页。分页/旧页混有附件与宽口径收支数据，保持 disabled，后续需噪声与正文边界验收。 | **结构与一次性 collector preview 已核验；禁用待 P3/Gate 2**；已配置 disabled `mof-treasury-debt-data` |
| 厦门证监局 | [监管工作首页](https://www.csrc.gov.cn/xiamen/)，[动态列表壳](https://www.csrc.gov.cn/xiamen/c101757/common_list.shtml?channelid=ffe0f9a9de42484cb218be2fd18116d0) | 首页 HTTP 200、`div.szyw-lists li` 7 条，最新静态新闻日期 2026-09-15；“加载更多”列表壳 HTTP 200 但无静态列表。官方 `common_list.js` 指向 API。page1 JSON HTTP 200、`data.total=399`、20 条，page2 HTTP 200、20 条；两页 URL 无重叠。JSON 项含 `title`、`content`、`url`、`publishedTime`（epoch 毫秒）、`publishedTimeStr`。按当前 `json_list` 配置调用真实 `fetchJsonList()`，page1 得到 20 候选，首条 allow 前缀内、摘要 944 字；详情 HTTP 200，`ArticleTitle` 一致、`PubDate=2026-09-28 14:31:07`、Readability 951 字。 | 首条 `publishedTime=1790548212000` 的绝对瞬时为 2026-09-27T22:30:12Z；`publishedTimeStr=2026-09-28 14:30:12` 按 `+08:00` 是 2026-09-28T06:30:12Z，两种字段相差 8 小时；配置使用字符串和显式 offset，不使用 epoch。另一条 `c7658572` 的 API/首页列表日为 2026-09-15，详情 meta `PubDate=2026-09-23 17:33:09`；选择列表公布日作为原始候选发布时间，因为 API 时间串与首页显示一致，详情 meta 的更新/发布口径仍留作 P3 冲突核验。page2 回溯至 2024-12-09；collector 不自动跟页，固定 page1 只覆盖最新 20 条，需在 P3 判断间隔是否足以避免漏项。 | **结构与一次性 `fetchJsonList` 预览已核验；日期冲突和分页限制待 P3**；已配置 disabled `xiamen-csrc-regulatory-work` |
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

从每个 HTML source 的首条候选各抽一条详情（HTML GET 单次、有界、跳过 PDF）核验：九条均 HTTP 200，标题均匹配，Readability 长度依次为 2,272、629、205、1,745、4,024、1,493、473、0、1,021 字符。厦门证监局 JSON 首条再抽一条详情 HTTP 200，列表与 `ArticleTitle` 一致，Readability 951 字。人民银行公开市场第191号公告的列表、`ArticleTitle`、`PubDate` 相符；补充检查正文容器约 162 字，低于 Readability 的 200 字符阈值，所以提取返回 `null`、preview 显示 0，并非官方页面没有正文。相邻第190号公告正文容器约 204 字，Readability 为 210，显示例行公告正好在阈值附近波动；不降低既有阈值，来源保持 disabled。会计司样本列表日为 9 月 21 日、详情 `PubDate` 为 9 月 22 日，需在 P3 确认 freshness 口径。厦门财政详情日期字段带“时间：”前缀，本次只读样本脚本未将其规范化比较；既有矩阵曾记录其详情日期同为 9 月 11 日，不据这次未规范化比较判定为差异。人民银行厦门启用 `titleAttribute=title` 后，preview 标题保持完整；十源 `+08:00` 已配置，preview 日期按中国本地日解释。机器样本摘要保存在忽略目录 `.data/fiscal-central-audit/verified-samples.json`，不包含页面正文。

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

- **财政部会计司**：列表页 [工作通知](https://kjs.mof.gov.cn/gongzuotongzhi/) 返回 200，最新显示 2026-09-21；文章 [详情](https://kjs.mof.gov.cn/gongzuotongzhi/202609/t20260921_3997874.htm) 的 `PubDate` 元数据和正文可见“发布日期”均为 2026-09-22。证据表示官方列表日比详情显式发布日期早一天；当前 `web_list` 从列表读日期，保留其原始列表值并将该差异留作数据口径提示，不改 parser 或 source 配置。首页分页脚本为 `createPageHTML(50, 0, ...)`；实际 GET [index_1.htm](https://kjs.mof.gov.cn/gongzuotongzhi/index_1.htm) 返回 200，样本日期从 2026-07-24 到 2026-05-08，与首页样本日期段不重叠。只抽查了这两页。
- **厦门证监局**：对文章 [详情](https://www.csrc.gov.cn/xiamen/c101757/c7658572/content.shtml) 的官方 HTML，正文可见“日期：2026-09-15 来源：厦门证监局”；API page1 记录 `publishedTimeStr=2026-09-15 12:43:00`，厦门监管工作首页此前也显示 9 月 15 日。详情 `PubDate` 与“页面生成时间”元数据均为 2026-09-23 17:33:09。现有证据支持使用 API 的列表发布时间字符串与 `+08:00` 作为原始发布时间字段；不能仅凭元数据断言 9 月 23 日是更新日或覆盖可见发布日期。API 当前报告总数 399，page1 20 项，page2 的结构/范围已由此前证据记录；本轮没有请求额外历史页。
- **财政部综合政策发布**：本次列表页返回 200，最新可见日期 2026-08-26；列表生成脚本表明支持分页，但本轮没有请求旧页。该栏目约一个月没有更新，仍应按栏目实际节奏审查，不作为每日发布源。
- **财政部金融司工作通知**：本次首页返回 200，最新日期 2026-07-16；脚本含 `createPageHTML(21, 0, ...)`，本轮不据此推断每页数量。实际请求 [index_1.htm](https://jrs.mof.gov.cn/gongzuotongzhi/index_1.htm) 返回 200，日期从 2025-12-12 回溯至 2024-12-10，两页日期在 2025-12-12 边界重合；本次未逐项比对标题/URL，不能据日期断言无重复。页面样本显示该栏目发布间隔较长，需据其主题价值和未来周期观察评估 freshness；不据此改 source 配置。

本次只检查会计司及金融司各两页、财政部综合政策首页、厦门证监局一条冲突详情与 API 首页；没有检查更多历史分页、跨周期更新、全量重复率，也未证明会计司列表日期字段代表官方最终发布日期。
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
