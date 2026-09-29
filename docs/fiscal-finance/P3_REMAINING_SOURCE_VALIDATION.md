# P3 剩余三源受控验证

日期：2026-09-29。范围仅为福建省财政厅、财政部会计司、厦门证监局三个固定候选的两轮真实 collector 列表调用，以及每条一次显式 `extractArticleBody(id, false)` 正文提取。验证在全新隔离库 `fiscalhot_remaining3_test`（35 项 migration）执行；source 在行业配置和数据库中均 `enabled=false`、全文开关关闭。数据库副本只为本次验证设置单一 URL allowlist、`initialBackfillLimit=1`、`initialBackfillMonths=12`，没有修改跟踪的 `industry/sources.json`。

## 固定预算与执行结果

预算上限为 6 次 `collectSource` 列表函数调用（每源两轮）、3 次详情提取函数调用（每条最多一次）、首轮最多新增 3 条；不切换候选、不重试、不翻页、不下载附件。本表中的“found”是 collector 列表解析在 exact URL allowlist 和新旧记录过滤前的数量，尤其 CSRC 每轮从 API 返回 20 项，数据库只接受精确指定的一项。底层 `guardedFetch` 的有界重定向可能产生额外网络跳转；这里报告的是函数调用预算，不把它误报为线上的单包 GET 数。

| Source ID | 固定 URL / 候选 | 第 1 轮 (found / created / revised) | 正文结果 | 第 2 轮 (found / created / revised) |
|---|---|---:|---|---:|
| `fujian-finance-notices` | `https://czt.fujian.gov.cn/zwgk/tzgg/202609/t20260929_7219534.htm` —《省直考区关于领取2026年度全国会计专业技术初级资格证书的通知》 | 1 / 1 / 0 | `ok`，629 字，revision 2；正文包含 10 月 8 日领证安排、邮寄截止日、地址及各考区电话。它是会计资格考试领证服务信息，属于领域噪声，不能算财政政策优质内容通过。 | 1 / 0 / 0 |
| `mof-accounting-notices` | `https://kjs.mof.gov.cn/gongzuotongzhi/202609/t20260921_3997874.htm` —《关于征求〈财政部关于加快推进会计数智化工作的指导意见（征求意见稿）〉意见的函》 | 1 / 1 / 0 | `ok`，473 字，revision 2；正文含征求意见对象、反馈期限（2026-10-20）、联系方式及两份附件标题。 | 1 / 0 / 0 |
| `xiamen-csrc-regulatory-work` | `https://www.csrc.gov.cn/xiamen/c101757/c7658572/content.shtml` —《厦门证监局投资者保护工作提质增效》 | 20 / 1 / 0 | `ok`，1,157 字，revision 2；正文包含辖区上市公司业绩、回购分红、投资者维权和教育工作等内容。 | 20 / 0 / 0 |

合计 6/6 fetch runs 成功，首轮新增 3 条，二轮新增 0、修订 0；没有超出 6 次列表函数、3 次正文提取或 3 条新增上限。每条正文只调用一次 `extractArticleBody(id, false)`。文章标题、URL、列表日保持不变；正文成功后正常升至 revision 2。结果 SQL 摘要保存在忽略目录 `.data/fiscal-qa/remaining3-final-evidence.json`，正文开头/结尾和关键词核对在 `.data/fiscal-qa/remaining3-body-results.json`。

## 日期冲突与质量边界

会计司样本的列表日期和入库日期为 2026-09-21；详情 `ArticleTitle` 与列表题名相同，但详情 `PubDate` 为 `2026-09-22 14:39:00`，正文落款为 2026-09-17。保留列表发布时间，不推断这三种日期中的哪一个应覆盖另一个，也不自动修正。

厦门证监样本 API `publishedTimeStr` 为 `2026-09-15 12:43:00`，现有 `+08:00` 解析后保存为 2026-09-15（UTC `2026-09-15T04:43:00Z`）。与该候选 URL 对应的本地详情快照 `.data/fiscal-central-audit/html/csrc-date-conflict.html` 中 `ArticleTitle` 匹配，`PubDate` 是 `2026-09-23 17:33:09`。保留 API 列表时间，不把详情 meta 时间改写为发布时间。快照 `.data/fiscal-central-audit/html/csrc-xiamen-detail.html` 是另一条文章，不能用来代表本候选。

福建样本正文确实是完整可读的考试领证通知，但它不具备财政政策价值。福建厅另一个已核实的重要现金管理公告的四页扫描 PDF 样本（忽略文件 `.data/fiscal-central-audit/pdf/fujian-cash-management-result.pdf`，178,333 字节）在既有视觉检查中被确认是同一公告的续页；本次复用现有离线 `parsePdfText` 结果为 `pdf_page_no_text`。这次没有抓取或下载该 PDF、没有 OCR，也未把该重要来源缺口隐藏在当前 HTML 样本的 `ok` 结果之后。扫描公告如何提供可核验全文仍是 Gate 2 的阻塞项。

## 安全与结论

测试库有 35 项 migration、3 个源副本；所有源 `enabled=false`，`site_fulltext=false`、`syndicate_fulltext=false`。`COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`JINA_BODY_FALLBACK`、`INDEXNOW_SUBMIT_ENABLED`、`FEISHU_CONTENT_PUSH_ENABLED`、`FEISHU_INTERNAL_ENABLED`、`ALLOW_PRIVATE_NETWORK_FETCH` 均为 `false`。未启动应用 worker；队列仅有 3 个 `content.extract-body:created` 任务，没有 `content.analyze` 任务被处理；receipts 与模型账本均为 0。

这三条样本证明了固定 URL 的列表解析、两轮判重以及三条 HTML 正文的单次提取结果，不证明来源首页覆盖、分页、重复率、长期新鲜度或栏目整体质量。福建领证公告的领域噪声与扫描 PDF 缺口、会计司和 CSRC 的日期口径冲突仍待处理。本验证不构成 Gate 2 通过，也不允许启用采集或扩大采集规模。

## 同一轮本地预览变更的后端回归

AD-012 本地预览代码在 focused 测试 4/4 与 `npm run typecheck` 通过后，使用全新空库 `fiscalhot_content_preview_test` 执行 `npm test`：35 项 migrations，156/156 通过，失败 0；完整输出保存在忽略目录 `.data/fiscal-qa/content-preview-npm-test.log`。测试进程内的 `MODEL_CALLS_ENABLED=true` 只支持仓库测试使用的 loopback 假 provider；真实 provider key/base URL 环境变量已清除，并将 credentials 目录指向不存在的测试路径。`LOCAL_PREVIEW_ENABLED` 未设置；采集、Jina、IndexNow、Feishu 和私网抓取开关均为 `false`。应用 worker 未启动。本段只记录后端 `npm test`；AD-012 的 Web build、Web tests 和 smoke 由负责页面实现的 Agent 单独验证，不在这里重复声称。
