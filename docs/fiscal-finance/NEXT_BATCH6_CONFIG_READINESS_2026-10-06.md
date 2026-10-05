# 广西、海南、重庆、四川来源配置准备度（2026-10-06）

## TASK
仅根据已保存的 Batch 6–9 页面、清单与详情报告，离线评估下一批四个财政部监管局“工作动态”来源的 collector 配置准备度。没有请求网页、连接数据库或修改 source/backend/tests/shared matrix/status。

## MODEL
离线证据审阅；无模型、collector、worker、数据库或网络活动。

## FILES_CHANGED
- 新增本报告。
- 证据原件仍在忽略目录 `.data/fiscal-qa/`；未改动。

## TESTS_RUN
- 离线用 Cheerio 对 Batch 6 保存的四份首页和四份列表 HTML 查询候选 CSS 选择器：四个“工作动态”主栏标题均命中同一路径；四份列表在推荐 row selector 下各有 10 行、10 个链接及 10 个日期 span；这 40 个链接均为相对路径 `.htm` 候选，且每行均有 `title` 属性。
- 离线对 Batch 6 四篇保存详情核对 `h2.title_con`、`ArticleTitle` 和 `.my_doccontent`；标题匹配报告记录，正文容器存在，容器内没有链接或 PDF/Office 附件链接。
- 未运行 collector 或自动化测试；上述检查只读本地保存文件。

## RESULT
四个来源均具备可复用的静态 `web_list` 配置形状，建议进入“配置实现 + parser fixture”阶段；现在的证据仍不足以宣布来源通过或 Gate 2 通过。Batch 6 的四个主页、四个首屏列表以及每局一篇保存详情提供了真实页面结构证据，但没有运行 collector，也没有验证第二页、近 90 天完整性或重复采集行为。

| 监管局 | 推荐来源 ID | 已保存列表 URL | 首篇已保存详情 | 静态配置准备度 |
|---|---|---|---|---|
| 广西 | `mof-guangxi-supervision-dynamics` | `https://gx.mof.gov.cn/gzdt/caizhengjiancha/` | `https://gx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260929_3998321.htm` | 高：列表及详情结构清楚；列表内存在展示日期与 URL 日期不一致行，需保留来源日期并做边界测试。 |
| 海南 | `mof-hainan-supervision-dynamics` | `https://hq.mof.gov.cn/caizhengjiancha/` | `https://hq.mof.gov.cn/caizhengjiancha/202609/t20260930_3998477.htm` | 高：列表及详情结构清楚；列表内存在展示日期与 URL 日期不一致行。 |
| 重庆 | `mof-chongqing-supervision-dynamics` | `https://cq.mof.gov.cn/gzdt2019/caizhengjiancha/` | `https://cq.mof.gov.cn/gzdt2019/caizhengjiancha/202609/t20260930_3998376.htm` | 高：列表及详情结构清楚；单页脚本显示的页数最多（45），分页完整性仍未验证。 |
| 四川 | `mof-sichuan-supervision-dynamics` | `https://sc.mof.gov.cn/caizhengjiancha/` | `https://sc.mof.gov.cn/caizhengjiancha/202609/t20260928_3998248.htm` | 高：列表及详情结构清楚；列表内存在展示日期与 URL 日期不一致行。 |

这四个来源 ID 是建议命名，不表示它们已经写入 `industry/sources.json` 或数据库。批次 6 证据记录了首页到主栏列表的实际链接：广西 `./gzdt/caizhengjiancha/`、海南 `./caizhengjiancha/`、重庆 `./gzdt2019/caizhengjiancha/`、四川 `./caizhengjiancha/`。四局官方目录原始映射、首页 URL、预算及响应 hashes 可在 [Batch 6 观察报告](REGIONAL_BUREAU_BATCH6_2026-10-05.md) 和对应 manifest `.data/fiscal-qa/regional-batch6-20261005/manifest.json` 离线核对。

### 可复用的配置骨架

四个列表页面都由已保存页面实测支持以下选择器：

```json
{
  "kind": "web_list",
  "config": {
    "url": "<该局已保存列表 URL>",
    "parseMode": "html",
    "itemSelector": "div.mainboxerji > div.zzright > div.listBox > ul.liBox > li",
    "linkSelector": "a[href]",
    "titleSelector": "a",
    "titleAttribute": "title",
    "publishedAtSelector": "span",
    "publishedAtUtcOffset": "+08:00",
    "allowUrlPrefixes": ["<该局已保存列表 URL>"] ,
    "detail": {
      "maxFetches": 10,
      "titleSelector": "h2.title_con",
      "publishedAtRegex": "<meta\\s+name=\"PubDate\"\\s+content=\"([^\"]+)",
      "publishedAtUtcOffset": "+08:00",
      "bodySelector": ".my_doccontent"
    },
    "_aihot": {
      "initialBackfillMonths": 3,
      "initialBackfillRequirePublishedAt": true
    }
  }
}
```

这是给后续实现和纯配置测试的候选模板，不是已应用配置。列表层 `span` 日期、每行 `<a title>`、详情 `h2.title_con` 和 `PubDate` 元数据均有本批保存样本支撑。单篇详情中列表标题、`ArticleTitle` 与 `h2.title_con` 一致，且 `PubDate` 日期日、可见发布日期、URL 日期日一致；因此可记录详情日期 regex 供解析，但不建议基于一篇匹配样本开启 `publishedAtAuthoritative` 或 `titleAuthoritative`。

### 日期、分页与噪声

四页第一屏各保存 10 个候选，HTML 中的内联脚本分别声明 `countPage=15`（广西）、15（海南）、45（重庆）、11（四川），并动态生成 `index.htm`、`index_n.htm` 形式的翻页控制。该证据只证明页面带有分页控件及声明页数；后续页都没有请求，也不能据此推断 collector 会翻页或近 90 天历史已覆盖。特别是重庆的 45 页与其余页面差异明显，若目标要求日期窗完整，应另做单局、受限分页验证。`detail.maxFetches=10` 是详情访问配置上限，不能当作全局 dispatch 上限；后续真实 collector 验证仍需沿用独立 P3 请求预算 wrapper。

第一屏列出的候选日期均在 2026-07-08 至 2026-10-06 的 90 天内，但这只适用于已保存首屏。保存列表中可见：广西一条显示 `2026-09-28` 的条目 URL 为 `t20260920`；海南一条显示 `2026-09-15` 的条目 URL 为 `t20260902`；四川两条分别为显示 `2026-09-14` / URL `t20260910`、显示 `2026-09-02` / URL `t20260831`。选中的首篇详情没有出现这种冲突，但尚未抽查这些冲突行的 `PubDate`。日期解析应以已观察的列表 `span` 为候选来源，不应从 URL 推造日期；冲突样本需在后续预算内核验，再决定是否需要权威详情日期策略。列表顺序和已保存页面也不能证明整个 90 天窗口的候选完整。

四个详情共同有 `h2.title_con` 和 `.my_doccontent`；Batch 6 报告的首篇正文分别为 1,759、370、859、330 字符，均无实际附件链接。Batch 6 详情报告称页面另有静态“附件下载”标签，但未见文档/PDF链接，标签不能误当作附件。Batch 6–9 的其他已返回详情（共 13 篇）报告也记录相同标题与正文 CSS 路径，支持复用 selector；这仍不是四局全部文章的完整性保证。

正文和列表均有需避免的站点噪声：详情有旧版站点导航日期“2017年11月21日 星期二”，通用日期扫描不应选它；应只读 `PubDate` 元数据。广西、重庆主页还在左侧导航重复显示“工作动态”，必须使用主栏标题路径 `div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a` 对应的页面链接。正文推荐选 `.my_doccontent`，不要扩大到内容栏外部或整页。

标题样本的业务/组织活动混合也不同：广西首屏有会计监督检查、金融资本登记、养老保险补助审核，也有集中学习和青年活动；海南有转移支付、注册会计师法、预算核查及核电税款审核，也有较多党日、培训和内部活动；重庆首屏混有会计监督、财政工作会议、金融中心事项与支部学习、安全教育；四川混有非税收入、会计检查、县域财政调研、转移支付监管以及服务代表委员和学习活动。每局目前只看一屏和一篇详情，不足以量化整体噪声比例或据此添加过滤规则。

## RISKS
- 这是静态 HTML 和首篇详情观察，不是 collector 解析结果；批量导入后可能暴露分页、超时、URL 归一、日期或正文拒绝问题。
- 多条列表日期与 URL 日不一致，且这些具体冲突行未取详情确认。首次历史抓取不能以路径日期补缺，也不应把一篇日期一致推广为栏目全局权威规则。
- 首屏显示当前内容，但分页/跨周期复查未进行。分页脚本声明总页数不能替代受限采集验证；页面数也不等于近 90 天所需请求数。
- `.my_doccontent` 样本均有正文且无文档链接；这不能证明所有文章都无附件、没有正文短缺或正文外置。
- 首屏内外都有内部组织活动和监管业务内容；不能只凭单条样本加入 selector 噪声过滤。

## BLOCKERS
没有阻碍准备静态配置骨架的证据缺口。进入来源验收前仍需分别验证真实 collector 行为、日期冲突样本、分页/近 90 天覆盖、重复列表不回退和正文边界；这些未在本任务执行。

## NEXT
若 Lead 分批授权实现，按四局独立 source ID 加入 disabled、T1、first-party、1440 分钟、站内与 syndicate 全文关闭配置，并为已保存 list/detail DOM 编写不含新闻全文的 parser fixtures。随后每次只验证一个新鲜隔离库、一个来源和预算内 collector 结果；分页需求另行核销请求 cap。不要把本报告或旧 Batch 6–9 观察视为 source pass、Gate 2 通过或生产启用许可。

证据报告：
- [Batch 6 首页与列表观察](REGIONAL_BUREAU_BATCH6_2026-10-05.md)
- [Batch 6 首篇详情观察](REGIONAL_BUREAU_BATCH6_DETAILS_2026-10-06.md)
- [Batch 7 详情结构对照](REGIONAL_BUREAU_BATCH7_DETAILS_2026-10-06.md)
- [Batch 8 详情结构对照](REGIONAL_BUREAU_BATCH8_DETAILS_2026-10-06.md)
- [Batch 9 详情结构对照](REGIONAL_BUREAU_BATCH9_DETAILS_2026-10-06.md)
- 忽略的原始页目录：`.data/fiscal-qa/regional-batch6-20261005/` 与 `.data/fiscal-qa/regional-detail-followup-20261006/batch6/`
