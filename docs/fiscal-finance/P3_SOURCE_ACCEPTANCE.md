# P3 信源验收范围与正文边界

日期：2026-09-29。本文复用 `SOURCE_MATRIX.md`、`P3_INGEST_VALIDATION.md`、`P3_BODY_VALIDATION.md` 和 Git 忽略目录中的既有快照；为核实金融司 2025-12-12 快报详情执行过一次有界、免费的官方 HTML GET。随后在隔离 `_test` 库对一条历史 unconfirmed 记录执行单篇 HTML+PDF extraction 验证。没有启动 collector worker、模型、Jina、OCR 或付费服务，也没有打开 source 启用开关。

所有十个源在仓库配置中仍为 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`。下表的“可做下一次受限验证”只表示可以安排隔离环境下的单源小样，不表示 Gate 2 通过或生产启用。T1 官方一手信源顺序不因页面格式或待补正文而下调。

## 金融司正文和附件边界

### 2026-06-08 示范区绩效公示

复用 `.data/fiscal-central-audit/html/mof-finance-performance-detail.html` 与 `.data/fiscal-qa/unconfirmed-article.html`。详情 `ArticleTitle` 和 `PubDate=2026-06-08 16:29:00` 与已存条目一致。页面没有 `#zoom`；`.my_doccontent` 唯一命中，是主正文内容容器。正文约 158 个可见字符，低于默认 200 字门槛，且不能单独表示考核结果。

附件下载区在 `.my_doccontent` 之外，作为 `.box_content` 下的兄弟区块存在。精确可复核结构为：

- 附件区：`div.gu-download:has(> p#down-tit1):has(> ul#down1)`，样本中唯一命中 1 个。
- 附件链接：`#down1 > li #appendix1 > a[href$=".pdf"]`，样本中唯一命中 1 个。
- 链接标题：`附件：2026年中央财政支持普惠金融发展示范区绩效考核情况表.pdf`。
- 相对链接：`./P020260608599408762517.pdf`；按既有详情 URL 解析为 `https://jrs.mof.gov.cn/gongzuotongzhi/202606/P020260608599408762517.pdf`。本轮未重新请求或下载 PDF。

仅调用 clean-body helper 时，对 `.my_doccontent` 返回 `attachments_unprocessed`，这是正确的拒绝结果。按 AD-010 配置调用 `extractSelectedArticleEnvelope` 后，本地样本日期使用 `+08:00` 与列表候选逐日匹配：6/8 预期 `2026-06-08T08:29:00Z`，helper 识别出唯一 PDF 附件；7/16 预期 `2026-07-16T08:09:00Z`，无附件正文以 1,493 字通过；12/12 预期 `2025-12-12T09:29:00Z`，RAR 返回 `attachment_unsupported`。6/8 helper 成功只证明 HTML envelope/附件选择与身份匹配；PDF 是否完整解析、与短正文组合仍须通过有界 PDF driver 才能确认。此前单独预览存储路径上的 Readability 得到 `null`；首次失败原因仍是 unknown，后续诊断不能倒推首次失败的精确原因。

### 无附件成功文与 2025-12-12 快报页面

同源成功样本 `.data/fiscal-central-audit/html/mof-finance-detail.html`（工作通知，详情日期 2026-07-16）有且只有一个 `.my_doccontent`，无 PDF 链接；共享 helper 返回 `null` 失败原因、提取 1,493 字符。它说明金融司栏目并非所有文章都应要求 PDF。

本地没有“金融企业财务快报系统25版”详情快照，因此本轮对该精确官方 URL 作了一次 guarded GET：`https://jrs.mof.gov.cn/gongzuotongzhi/202512/t20251212_3979075.htm`。返回 200、`text/html`、12,071 字节、无重定向；忽略快照为 `.data/fiscal-central-audit/html/mof-finance-quarterly-report-detail.html`。`ArticleTitle` 匹配，`PubDate=2025-12-12 17:29:00`。唯一 `.my_doccontent` 只有 13 个可见字符，不构成正文；唯一附件区中有一个 RAR 链接，标题 `金融企业财务快报系统25版.rar`、相对链接 `./P020251212630570298147.rar`。本轮未跟随或下载 RAR。它不是 PDF，不能归因于 PDF parser；页面当前形态适合继续标记正文未确认，不能把附件标题冒作正文。

### 配置裁决边界

金融司成功 HTML 的正文区、6/8 公示正文区和附件区证据明确，但附件区与主正文 selector 不在同一树：唯一主正文 `.my_doccontent` 不包含附件区；共同祖先 `.box_content` 同时包含标题、正文、附件区及相关文章区，因此必须把它用作文章识别外壳而不是干净正文。Sol 已批准 AD-010 的 source-config 设计，且已在 disabled source 配置：`articleSelector='.box_content'`，clean `bodySelector='.my_doccontent'`，附件 selector `div.gu-download:has(> p#down-tit1):has(> ul#down1)` 相对该外壳精准选取 `#down1` 内文件链接，`attachmentMode='optional'`。本地 envelope helper 已验证三个 HTML 样本：无附件时只在正文达到既有 200 字且身份匹配后允许 HTML 成功；单一 PDF 仍须完整解析并与正文组合；RAR、XLS、多附件不解析、不 fallback，保持未确认。它避免全栏目要求 PDF 而拒绝 7/16 有效通知，也不把 6/8 的短 intro 因 optional 误标成功。source 仍为 disabled，live driver 与 PDF 组合链待验证；两项全文开关保持 false。

## 十个已配置来源 Gate 2 证据矩阵

| Source ID / T1 来源 | 真实列表与两轮入库 | 详情与正文完整性 | 日期证据 | 分页、重复及栏目噪声 | 下一步受限 E2E 与当前边界 |
|---|---|---|---|---|---|
| `mof-budget-work` 财政部预算司 | 隔离库对一条固定候选做两轮：首轮 `found=1/created=1/revised=0`，次轮 `found=1/created=0/revised=0`。 | 详情正文 2,272 字，`ok`。具体样本和请求边界见 [P3_LOCAL_SOURCE_VALIDATION.md](P3_LOCAL_SOURCE_VALIDATION.md)。 | 样本列表日和详情日为 2026-03-26；原 `+08:00` 配置保留。 | 两轮仅覆盖一条 URL，不验证首页其余9条、历史分页或栏目重复率；已有第2页快照含2023/2022历史文章。新鲜度明显待复核。 | 单篇边界样本通过，不作为当前新鲜稳定源或完整列表覆盖通过。 |
| `fujian-finance-notices` 福建省财政厅 | 当前静态组 selector 解析 5 项；无两轮 collector ingest 证据。 | 详情样本 629 字；前 5 项中 2 个 PDF。代表扫描附件 4 页已视觉确认同一招标公告，Node helper 返回 `pdf_page_no_text`，不支持 OCR。 | 首页最新 2026-09-29；详情 `ArticleTitle`、`PubDate` 与 `span.article_time` 可读。 | 22 个静态分页块/108 项预渲染；配置只解析 `$showStatic(1)` 当前 5 项。PDF URL 过滤不能通过现有 prefix selector 表达。 | 可做一次隔离试抓并验证 2 个 PDF 均不触发付费/错误正文；重要扫描材料仍待明确人工处置，福建 T1 不降级、不永久排除。 |
| `xiamen-finance-debt` 厦门市财政局地方债 | 隔离库一条固定候选两轮：首轮创建1条、次轮不创建/不修订，fetch run成功；该单篇候选结果不等于栏目稳定。 | 原 Readability 给出 205 字并标 `ok`，但DB正文实为标题/日期、“扫一扫”及站点页尾，没有招标结果，是正文质量假阳性。随后唯一 `.Custom_UnionStyle` 本地命中26字，单独 helper 以 `attachments_unprocessed` 拒绝，不回退 Readability；同页唯一 PDF 在该正文区外，尚未读取。当前 disabled source 仅加 `detail.bodySelector='.Custom_UnionStyle'`，无 `allowShortBody`、PDF附件字段或启用开关。 | 固定样本列表和详情日为 2026-09-11，`+08:00` 保留。 | 首页覆盖 2026-05-08 至 09-11，没发现翻页链接；历史覆盖未知。未验证其他候选正文。 | Gate 2 正文完整性阻塞；单篇两轮判重不能掩盖实质正文不完整，也不代表栏目覆盖。PDF路由仍未实现/验证，不降门槛、不使用OCR/付费fallback。 |
| `pboc-xiamen-work` 人民银行厦门市分行 | 隔离库对一条固定候选两轮：首轮创建1条，次轮0创建/0修订，详情正文提取成功。 | 样本正文 1,745 字，`ok`；`titleAttribute=title` 保持完整标题。 | 列表日期 2026-09-14，详情标题与存储发布时间一致；`+08:00` 保留。 | 页面显示 663 条/34 页；已直接检查第2页，20项且与第1页href无重叠。两轮仅覆盖固定 URL，不代表首页批量或34页接入。 | 单篇边界样本通过，地方一手源维持 T1；其余首页候选和跨周期 freshness 待核验。详见 [P3_LOCAL_SOURCE_VALIDATION.md](P3_LOCAL_SOURCE_VALIDATION.md)。 |
| `mof-policy-release` 财政部综合政策 | 隔离测试库两轮真实 collector：10/10/0、10/0/0（found/new/revised），同页重复 0 新建/修订；当前源关闭。 | 正文样本 10/10 `ok`；代表详情 4,024 字。 | 存库日期 `+08:00` 正确；最新列表日 2026-08-26。 | 两轮只读首页，没有证明自动翻页；已检查 `index_1.htm`，含历史与不同类别内容；综合栏目含彩票等噪声。 | 可用作受控 collector 对照源；需观察真实更新周期与内容精选，不因两轮幂等即宣称长期稳定。 |
| `mof-finance-notices` 财政部金融司 | 隔离测试库两轮：10/10/0、10/0/0；历史第 1/2 页各解析 10 项，URL 无重复，但有同标题不同 URL 的跨年事项。 | 30 篇最新受控正文中本源 9 `ok`、1 `unconfirmed`。一条历史 unconfirmed 记录 `c4ozkz6z1udq4hd1956vv2r40` 经单篇复验由 rev1/0字转为 rev2/1,454字，标题相同、正文hash变化；实际使用 1 HTML+1 PDF，表格布局 19 行并按 X/Y 坐标恢复 4×4 值。6/8 原始短公示单独不足；12/12 约13字并带 RAR；7/16 无附件正文1,493字通过。 | +08:00 日期核验保留；首次失败的原始原因仍 unknown，之后单篇复验成功不倒推或改写首次原因。 | 首页最新 2026-07-16，约75天间隔；第2页回溯至2024；PDF/RAR与普通正文混合。 | AD-010 envelope/helper已通过三份本地HTML验证；fresh整库回归已通过，但这不替代两轮入库或栏目整体稳定性。十源保持 disabled。 |
| `mof-accounting-notices` 财政部会计司 | 首页 10 项预览；无两轮 collector ingest 证据。第 2 页解析另见 10 项，URL 无重叠。 | 代表正文 473 字；日期冲突样本正文可读。 | 9/21 列表日与 9/22 `PubDate` 相差一天；保留列表原始日作候选，不宣称已判定官方日期语义。 | `index_1.htm` 与首页日期区间不重叠；扫描到两组同题不同 URL 的历史名单。collector 不自动翻页。 | 可受限两轮E2E，但应原样保留日期差异，单独统计 freshness，不自动用详情日修正列表日。 |
| `pboc-open-market` 中国人民银行公开市场 | 首页 20 项预览；第191号另在隔离库限单 URL 完成两轮 collector 小样：首轮 `found=1/created=1/revised=0`，第二轮 `found=1/created=0/revised=0`，详情调用 1 次后判重跳过。 | 第191号详情低于 200 字；`#zoom` + 显式 short opt-in 最终入库 174 字/1 表，金额、利率和单位保留，`body_status=ok`。第190号略过阈值（204 容器字、Readability 210）。 | 列表日与 `ArticleTitle`、`PubDate` 均为 2026-09-29；+08:00 入库 UTC 为 `2026-09-28T16:00:00Z`。 | 静态首页只查当前 20 项，未验证更深历史页；逐日例行公告低字数不是无正文。第二轮相同 URL 未产生修订或额外详情请求。 | 仅第191号单篇两轮小样通过，source 仍 disabled；未覆盖其余 19 项、翻页、连续更新或长期稳定性。详见 [P3_OMO_VALIDATION.md](P3_OMO_VALIDATION.md)。 |
| `mof-treasury-debt-data` 财政部国库司统计 | 隔离测试库两轮：10/10/0、10/0/0；同页重复无新建/修订。 | 受控正文样本 10/10 `ok`；代表详情 1,021 字。 | 列表/详情日一致，+08:00 落库；首页最新 2026-09-24。 | 第 2 页 10 项日期回溯至 2025-10，含 PDF 与中央政府收支类异项；collector 不自动翻页。 | 已完成有限两轮稳定性；继续检查栏目噪声/周期更新，可用于受限对照，但不可宣称深分页 coverage。 |
| `xiamen-csrc-regulatory-work` 厦门证监局 | 单次真实 `fetchJsonList()` 返回 page1 20 项；无隔离库两轮 collector 证据。 | 代表详情 951 字；API 摘要 944 字。 | 选 `publishedTimeStr +08:00`；样本 c7658572 的 API/可见正文为 9/15，详情 meta 为 9/23，冲突未判定语义。 | 官方 API page2 有 20 项，与 page1 URL 无重叠；page2 回溯到 2024-12，collector 固定 page1。 | 可做单次隔离 E2E及同页重复验证；保持列表发布时间字符串，不把 meta 自动改写成发布时间；coverage 仍仅 20 条。 |

## Gate 2 决定边界

财政部综合政策、财政部金融司、财政部国库司三源完成两轮各 10 项的真实 collector 列表 ingest；另有四源完成单篇固定 URL 的两轮边界样本：`pboc-open-market` 第191号、预算司一条、人行厦门一条、厦门财政一条。预算司与人行厦门样本正文可读；厦门财政样本虽最初被 Readability 标 `ok`，实际只有标题/日期、扫码提示与页尾，不含招标结果，已作为质量假阳性阻塞并在 disabled source 配置唯一经本地核验的正文 selector 以 fail-closed。以上四个单篇两轮样本均不能视作对应栏目首页批量覆盖或长期稳定性验证。福建厅、会计司、厦门证监 JSON 三源目前仍无两轮真实 collector 证据；preview、人工 `fromHtml()` 或第2页观察不能替代入库证据。三源10篇批次的最新 SQL 正文汇总仍为 29 `ok`、1 `unconfirmed`、0 `pending`，30 个正文任务仍为 `content.extract-body:created`；金融司单篇复验不消费此队列。OMO独立样本另留1个未消费 `content.analyze:created` job。所有来源保持 disabled；Gate 2 尚未通过。受控单篇证据见 [P3_LOCAL_SOURCE_VALIDATION.md](P3_LOCAL_SOURCE_VALIDATION.md) 和 [P3_OMO_VALIDATION.md](P3_OMO_VALIDATION.md)。最新 `fiscalhot_pagecopy_test` fresh回归在新selector配置下完成35项 migrations，`npm test` 156/156、typecheck和source whitelist/saved-HTML focused检查通过；route文案后的Web build、web tests 11/11、smoke 30/30亦通过。第一次MODEL关闭造成的25个stub测试失败属于无效环境设置，不计作代码失败或通过。

下一步优先处理厦门财政源正文质量假阳性与附件覆盖；保持其 disabled，未验收PDF不能转为完整正文。另验证福建扫描件的人工处置边界以及会计司、厦门证监局列表的受限collector路径。四个单篇双轮样本不代替页面批次、分页、跨周期 freshness 或全栏目稳定性。Linux真实官方PDF、NAS RSS/隔离资源仍待验证；每步由Lead评估 Gate 2，不在配置中启用来源。
