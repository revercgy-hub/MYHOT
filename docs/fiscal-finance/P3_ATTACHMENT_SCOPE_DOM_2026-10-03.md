# 会计司单篇附件范围 DOM 离线准备（2026-10-03）

STATUS=Root 单独核销的一次受限 DOM GET 与离线解析完成；未改行业配置。
GATE_2=NOT_PASSED。

## 范围与结论

本报告先用已有fixture/cache离线准备，再在Root单独核销后对固定详情URL额外做了一次只读HTML GET以补齐真实DOM证据；这次GET不是重试此前失败的正文提取，旧 `unconfirmed/attachments_unprocessed` 事实仍独立保留。本轮没有运行详情抽取、collector/worker/OCR/model，没有读写数据库，也没有修改业务代码、测试、依赖或行业来源配置。七份guard fixtures、三份历史完整缓存和这次保存的目标HTML均用本机已安装Cheerio分析；没有请求任何附件URL。

拟观察的唯一既有 URL：

`https://kjs.mof.gov.cn/gongzuotongzhi/202607/t20260714_3993483.htm`

保存列表标题为“关于征求《会计改革与发展“十五五”规划（征求意见稿）》意见的函”，列表日 `2026-07-15`。此前一次经Root核销的direct extract结果为HTTP 200、`unconfirmed`、reason `attachments_unprocessed`、正文/hash为空；当时未保存原始响应HTML。Root随后另行核销一次只读请求以取得DOM证据。本次受限观察保存了完整公开响应，所以本报告后续判断基于新保存的HTML，不改写此前失败记录；历史9/4 reason仍未知且不重试。

`industry/sources.json` 中会计司当前两条 body policy 是：

- `.my_doccontent > .TRS_Editor:has(table)`，表格规则；
- `.my_doccontent > .TRS_Editor:has(p + p)`，普通多段正文规则。

本次逐项计数为第一条策略0项、第二条策略1项；唯一正文路径为 `div.mainboxerji > div.box_content > div.my_conboxzw > div.my_doccontent > div.TRS_Editor`。候选 `.box_content` 和 `.my_conboxzw` 均恰好命中一个普通元素、严格包含该正文；实际下载sibling及页面chrome关系见下节。`.box_content` 的单页DOM证据可供Root决定是否采用为该source的精确scope值；本报告不修改或代Root批准行业配置。不能把scope缩到 `.my_doccontent`/`.TRS_Editor` 来使抽取通过，因为这样会排除正文外的两个业务附件。S1要求scope内PDF外观链接仍触发fail-closed保护。

## Root 核销的目标页真实DOM观察

一次固定URL只读GET经现有backend `guardedFetch`，并在请求前安装 `installP3HttpBudget(1)`。runner先创建独占 `request-started-once.json` 标记；发现marker或输出已存在就拒绝执行。实际backend Undici `8.11.2` hard cap=`1`，attempted/dispatched/rejected=`1/1/0`；`request:create`、`sendHeaders`、`headers`各1，`request:error=0`；响应后立即停止，无redirect、重试、附件请求或第二URL。限制是deadline `20s`、最多`6 MiB`、`maxRedirects=0`。响应HTTP 200、`text/html`、15,791 bytes，server `Date=2026-10-03T03:21:59Z`，final URL逐字匹配目标。Raw response SHA-256：`eeb3c8185980d92f87832fbc99d2bf50ba7469e2a0c1108f085dcc5c1868e313`。

原始公开HTML与去敏DOM摘要只保存在Git ignored `.data/fiscal-qa/attachment-scope-dom-20261003/response.html`、`manifest.json`、`dom-summary.json`；未保存敏感请求头或凭证。摘要按相同raw bytes重载Cheerio生成。详情 `meta[name=ArticleTitle]` 和 `<title>` 都唯一并匹配列表标题；`meta[name=PubDate]` 唯一值 `2026-07-15 16:51:00`，按`+08:00`解析为`2026-07-15`，匹配列表日。日期来自页面header字段，不是URL推断。

会计司当前两条body policy中，表格规则命中0，普通多段正文规则命中1；选中body为 `div.mainboxerji > div.box_content > div.my_conboxzw > div.my_doccontent > div.TRS_Editor`。DOM去除该节点style/script/noscript后，419字符正文说明财办会〔2026〕19号征求会计改革发展“十五五”规划意见，列明征求单位（包括财政部各地监管局）、反馈截止日2026-07-26、反馈方式以及附件1和附件2。这里的文本仅供内容/DOM对照，没有调用extractor，也未改变DB正文状态。

按现有helper的PDF外观规则（URL pathname `.pdf` 或 `type=application/pdf`）精确找到**2个不同href、2个不同PDF样式附件链接**；两条都是正文明确列举的业务附件。两条均无`type`属性，均按路径后缀命中：

| Anchor文字 / href | Anchor路径；parent路径 | 选中正文内 | `.box_content`内 | `.my_conboxzw`内 |
|---|---|---:|---:|---:|
| 附件1 会计改革与发展“十五五”规划（征求意见稿）.pdf；`./P020260714609360563000.pdf` | `div.mainboxerji > div.box_content > div.my_conboxzw > div.gu-download > ul#down1 > li > span#appendix1 > a`；parent `div.mainboxerji > div.box_content > div.my_conboxzw > div.gu-download > ul#down1 > li > span#appendix1` | 否，正文外 | 是 | 是 |
| 附件2 会计改革与发展“十五五”规划（征求意见稿）》起草说明.pdf；`./P020260714609360796202.pdf` | `div.mainboxerji > div.box_content > div.my_conboxzw > div.gu-download > ul#down1 > li > span#appendix1 > a`；parent路径同上 | 否，正文外 | 是 | 是 |

实际“附件下载”容器是 `div.mainboxerji > div.box_content > div.my_conboxzw > div.gu-download`，包含两个anchor，位于正文之外、正文的同一个 `.my_conboxzw` 内。另一个 `.gu-download` 区域标签为“相关文章”，anchor数0。`.box_content`候选唯一、不是html/body/nav/footer等blocked元素、严格包含唯一selected body和完整附件区；还包含两个不属于文件的javascript utility链接“打印此页”“关闭窗口”。`.my_conboxzw`也唯一且包含正文与两条附件，并不含utility链接。所有scope外页面链接按真实DOM路径均是站点chrome：主站logo、`div.nav`搜索/返回主站、`div.dangqian`首页/工作通知面包屑、`div#footer`纠错/网站标识/网站地图/联系我们/备案信息；scope外PDF外观anchor数均为0。故这页的历史 `attachments_unprocessed` 与当前raw DOM一致，是正文外业务附件的fail-closed保护，不是导航/页脚误拒。没有读取PDF字节，实际MIME和文件内容未知；锚点“附件下载”上下文、名称与正文附件清单支持它们的页面业务关联。

**候选scope结论**：真实目标DOM为 `.box_content` 提供了足够的单页结构证据：唯一、合法祖先，同时涵盖selected body和两项真实页面标识为业务附件的PDF下载链接；scope外可见链接均由DOM证实是无关站点chrome。`.my_conboxzw`在此页也满足同样的覆盖条件。是否将其中一个具体selector写入行业配置由Root另作范围裁决；本报告不改来源配置，也不因此改变抽取结果。无论scope取这两个候选中的哪一个，两个PDF链接仍在scope内，正文仍须因未处理附件而拒绝；不能缩到正文selector求`ok`。这一次响应不证明所有会计司页面都共享同一层级或附件布局。

## 现有完整会计司缓存的实际DOM

下表由既有完整 HTML 逐份加载到 Cheerio 后现场计算。DOM path 按本次保存 HTML 的树结构写出；“候选scope”只描述试验 `.box_content` 的命中/关系，不宣告可在行业配置中采用。

| 本地完整缓存 / HTML题名 / PubDate | body与候选scope | 文件样式 anchor（DOM parent；正文内/外；候选scope内/外） | chrome证据 |
|---|---|---|---|
| `.data/fiscal-central-audit/html/mof-accounting-detail.html`；《关于征求〈财政部关于加快推进会计数智化工作的指导意见（征求意见稿）〉意见的函》；`2026-09-22 14:39:00` | `.my_doccontent` 唯一；路径 `div.mainboxerji > div.box_content > div.my_conboxzw > div.my_doccontent`。`.box_content` 唯一；路径 `div.mainboxerji > div.box_content`；是正文严格祖先。 | `./P020260921531848062568.docx`（起草稿）、`./P020260921531848328116.docx`（起草说明）；两个 parent 都是 `div.mainboxerji > div.box_content > div.my_conboxzw > div.gu-download > ul#down1 > li > span#appendix1`；均正文外、scope内。当前 helper 的PDF规则没有将它们分类为PDF。 | `.gu-download` 两个：真实附件区和“相关文章”区都在scope内；后者无anchor。scope外共11个 `a[href]`；`nav/header/footer/[role=navigation]` 语义区域下的anchor为0，所以本样本不能证明一个真实 nav/footer PDF会被scope排除。全页无PDF外观anchor。 |
| `.data/fiscal-source-checkpoint-20261002/detail-t20260904_3996714.htm.html`；“从事证券服务业务会计师事务所注销备案名单”；`2026-09-04 15:31:00` | body与scope各1；路径同上；`.box_content` 严格包含 `.my_doccontent`。 | `./P020260904578906728122.xlsx`（截至9月4日备案名录）；parent `div.mainboxerji > div.box_content > div.my_conboxzw > div.gu-download > ul#down1 > li > span#appendix1`；正文外、scope内；非当前helper的PDF规则。 | 两个 `.gu-download`：附件区和“相关文章”区；后者无anchor。scope外11个anchor；语义 nav/header/footer anchor为0。全页无PDF外观anchor。 |
| `.data/fiscal-source-checkpoint-20261002/detail-t20260920_3997803.htm.html`；“2025年度会计师事务所从事证券服务业务有关信息”；`2026-09-20 16:08:00` | body与scope各1；路径同上；`.box_content` 严格包含 `.my_doccontent`。 | `./P020260920582392176701.xlsx`（年度信息附件）；parent `div.mainboxerji > div.box_content > div.my_conboxzw > div.gu-download > ul#down1 > li > span#appendix1`；正文外、scope内；非当前helper的PDF规则。 | 两个 `.gu-download`：附件区和“相关文章”区；后者无anchor。scope外11个anchor；语义 nav/header/footer anchor为0。全页无PDF外观anchor。 |

三个缓存均核对了HTML `ArticleTitle` 与 `PubDate`。它们是别的文章，不能拿来和July14目标的列表题名/日期比较。保存页面表现出“正文与附件同在 `box_content`、附件是 `.my_conboxzw` 下的 `.my_doccontent` sibling”的真实布局，但不能由这三页外推目标页。

## 七份 guard fixture 的离线边界

七份文件均为完整小型测试HTML，不含 `.box_content` 或 `.my_doccontent`，因此不能验证真实会计司候选scope。实际解析得到：

| Fixture | selected `.article-body` 与 PDF外观anchor | Anchor DOM parent | 若测试 `.box_content` |
|---|---|---|---|
| `body-relative-pdf.html` | 正文内1个相对 `.pdf`；helper当前会识别 | `main > article.article-body > p` | 没有scope元素；不能判断真实页scope |
| `content-type-pdf.html` | 正文内1个 `type=application/pdf` | `main > article.article-body > p` | 没有scope元素 |
| `footer-pdf.html` | 正文外1个 `.pdf` | `footer` | 没有scope元素 |
| `nav-pdf.html` | 正文外1个 `.pdf` | `nav` | 没有scope元素 |
| `short-body-footer-pdf.html` | 正文外1个 `.pdf`；当前测试也确认附件拒绝早于长度原因 | `footer` | 没有scope元素 |
| `no-pdf.html` | 无PDF外观anchor | — | 没有scope元素 |
| `query-fragment-fakes.html` | 无符合helper规则的PDF外观anchor | — | 没有scope元素 |

这些fixtures确证已有helper按整份文档的 `a[href]` 扫描，识别 URL pathname `.pdf` 或 `type=application/pdf`，页面chrome外的anchor也可触发 `attachments_unprocessed`；但它们不含真实附件区，不能决定应选哪一个会计司scope。当前无通用path猜测或“只扫正文”的依据。

## 保持范围与失败边界

本次请求使用了上述预先准备的固定URL、backend guardedFetch、Undici hard cap=1、20秒、6MiB、redirect=0/no retry；实际事件记录和响应材料均在ignored `.data/fiscal-qa/attachment-scope-dom-20261003/`。响应后没有第二次GET、附件GET、数据库或extract动作。后续读取和复核应离线进行；任何新网络请求都需新核销。S1允许的scope只是附件候选扫描范围，不下载、解析或接受PDF。本页两条附件链接的真实MIME/文件内容仍未知，Gate 2和P4状态不变。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：使用已有缓存和七个guard fixtures离线准备一次可复核的精确详情DOM观察方案。

**MODEL**：Luna High；未调用仓库模型服务。

**FILES_CHANGED**：仅新增本报告；ignored `.data/fiscal-qa/attachment-scope-dom-20261003/` 新增one-shot runner、预请求marker、manifest、公开响应HTML和DOM摘要。没有修改source配置、业务代码、tests、database或Git index。

**TESTS_RUN**：无测试。Node inline Cheerio离线分析读取七个fixtures、三份历史缓存及已保存目标HTML；no new deps。唯一GET的HTTP和Undici事件计数见上。DOM摘要随后仅从保存的`response.html`离线修订：style/script不再计入正文preview，按完整href区分两个同parent path链接；没有第二次GET。

**RESULT**：目标详情题名、PubDate、当前普通正文policy和列表身份一致；同一真实附件区中的2个不同PDF href均为正文外业务下载sibling、同时处于`.my_conboxzw`和`.box_content`内；二候选外的可见PDF计数为0，外侧可见anchor由DOM路径确认为导航/面包屑/页脚。单页DOM支持`.box_content`候选，不改变本页应拒绝未处理附件的结果。Raw SHA-256=`eeb3c8185980d92f87832fbc99d2bf50ba7469e2a0c1108f085dcc5c1868e313`；本次观察是另核销读取DOM，不是旧helper失败的重试或追认。

**RISKS**：没有请求附件，所以两个PDF href的MIME/bytes和PDF内容未知；“附件下载”标签、链接标题及正文清单提供页面业务关系，不证明文件完整。一个页面不能证明会计司所有模板或所有时段都共享此scope布局；这次raw不改写旧direct-extract证据。

**BLOCKERS**：目标页DOM证据已具备；具体行业 `attachmentScopeSelector` 是否写入由Root另行决定，本文未改配置。Gate 2仍为NOT_PASSED。

**NEXT**：QA只读复核ignored raw/hash及逐anchor摘要；Root另行决定是否采用`.box_content`或`.my_conboxzw`作为该source scope。任何候选都必须继续令两项PDF附件触发保护；后续正文extract/附件GET各自另需核销。9/4旧reason继续UNKNOWN且不重试。
