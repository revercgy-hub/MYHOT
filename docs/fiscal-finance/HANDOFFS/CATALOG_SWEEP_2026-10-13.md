# 2026-10-13 全目录来源单页巡检交接

## 结果

Lead批准后，对`industry/sources.json`中固定的48个source各运行一次现有单页collector，目标为全新隔离库`fiscalhot_catalog_sweep_20261013_test`。库执行35 migrations，采集前业务表计数全为0。48个source均完成一次collector run，48/48 fetch run状态为`ok`；本次发现499个候选、写入413篇。实际HTTP dispatch为88/400，0 rejected、0 redirect，0非GET、0非200。全scope无source失败或未运行，但整体manifest按原始violations保留`partial_or_failed`。

数据库最终为413 articles/revisions、420 discoveries及48 fetch runs；正文状态为28 `ok`、378 pending、7 unconfirmed。没有analysis、receipt、publication projection、selection、job_runs或pool_search行。每一条文章均为隔离summary-only记录，不能当作本地preview或正式网站内容。

前次六个隔离bulk库合计425条记录，本批413条与之有394个URL交集，记录合计838、distinct URL 444，即本批只增加19个distinct URL。独立local preview有59条，与两组bulk库分别统计，不能把记录数理解为新增独立资讯数或已发布数量。

## 固定scope和安全边界

本轮覆盖全部48个目录source：45个`web_list`、3个`json_list`（厦门证监、国务院政策库、NFRA）。全部source在catalog和完成后的DB中仍`enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`。collector遵守每source单页；inline详情在兼容配置下最多1条，NFRA因既有validator要求保留detail上限6。福建财政通知、厦门地方债、财政部金融司通知本轮metadata-only，移除临时详情能力以避免对附件/PDF发请求。临时config逐source作用并在finally恢复；独立QA确认48/48配置精确恢复。

实际dispatch硬上限400（含redirect），本次88次，来源之间至少750ms；无retry。所有网络调用为GET；无模型/provider、worker、Jina、OCR、附件或PDF请求，global/source采集及全文开关全关闭。每source fetch result `ok`仅代表collector调用状态，不表示source可靠、内容合格或完成覆盖。

现有collector在插入文章时创建了28条`content.analyze` created jobs。按冻结的精确ID清单，将这28条在独立事务中全部改为`cancelled`，前后证据单独记录；378条`content.extract-body` jobs仍为created、未消费。worker未运行，analysis/receipt/selection/job_runs计数为0。原始manifest的`partial_or_failed`结果及`duplicate_dispatch_target`、`attachment_hold_rows_present`两项violations均未被事后改写。

## 全源汇总

每行依次为found候选、stored文章和文章body状态（`ok / pending / unconfirmed`）。完整逐源列表见[来源矩阵的48源表](../SOURCE_MATRIX.md#2026-10-13-48源目录单页巡检fresh隔离库)。

| 总计 | 数量 |
|---|---:|
| 固定/已运行source | 48 / 48 |
| found / stored | 499 / 413 |
| HTTP dispatch | 88 / 400 |
| body `ok` / pending / unconfirmed | 28 / 378 / 7 |
| extract-body jobs created / analysis jobs cancelled | 378 / 28 |
| PDF或附件请求 | 0 |

7条unconfirmed包括：会计来源1条文章含嵌入PDF链接，安全策略将其保留为hold；NFRA 6条详情JSON的附件列表为空，但保守诊断仍给出`attachments_unprocessed`，不能称为6个PDF或实际附件下载。NFRA的6次详情调用路径相同（`SelectByDocId` API endpoint），但响应中的6个`docId`各不相同，分别匹配6个文章URL的query。manifest的`duplicate_dispatch_target`是按URL path忽略query造成的path级误报。该解释已由离线raw与URL对账确认，但原manifest的`duplicate_dispatch_target`和`attachment_hold_rows_present`两项violation原样保留。

## 审核和限制

独立QA报告为`PASS_BOUNDED_WITH_RECORDED_SOURCE_HOLDS`，覆盖88/88 raw文件hash、长度及EOF，48/48 gzip/entity列表离线重放，413/413 SQL文章身份/状态/hash核对，48/48 source配置恢复、精确队列隔离和零PDF请求。QA未将此结论升级为来源准入或业务质量通过。Counts另对48个source各至多查看一篇body-ok正文，若无正文则仅看标题。样本中可核业务事实包括云南一篇对某单位884笔支出作分类核验并发现违规挤占资金；PBOC公开市场公告写明10月13日650亿元、7天期逆回购、利率1.40%。上海、山西、四川等样本描述了监督工作方法，但缺当期量化结果。另有较多样本为会议、党团学习、文化和内部活动；这些结论仅适用于被读的一条样本，不能外推整源质量或噪声比例。其余未抽正文的记录仅做标题线索检查。48源机器摘要含每源代表文章ID/URL/body hash及判断，位于ignored证据`content-review.json`，SHA-256为`89E52D09B2ADE277922A713239D7A45B43A23A63012A32E6FCF319C8717A737E`。

found与stored相差86；本次没有逐候选reject-reason导出，不能把差值臆分为日期、identity或URL过滤。每source仅一页、一个时间点；结果不证明90日完整、分页结束、发布日期权威、跨周期稳定或来源级质量。来源全保持disabled；Gate 2仍为`PASSED_FOR_BOUNDED_P4_PILOT`，Gate 3–5未通过。source矩阵和STATUS均记录本检查点。

## 可复核证据

所有执行材料放在gitignore目录`.data/fiscal-qa/catalog-sweep-20261013/`。

| artifact | SHA-256 |
|---|---|
| scope.json | `b3ded93d7440e2a55b4bf3ea446042b1d1fdd51203fe41144394a066dcf5d8c1` |
| sourceSet SHA-256 | `5e2a6f21825f6a0c2d6e313b0307276c8fb01947cd5cd799aa3c8249ac860533` |
| runner/run-once.mjs | `ec278a98895c82d0debedc8268181fa24d86beeff9341fa42b40052a69b1c962` |
| runner/preflight.mjs | `0cd7246fb4ed6bf0163e094962ccbb82212940ba86c4ab6f851c64d9e27065e4` |
| evidence/manifest.json | `a0b8734dc167e942abd949fea9b1ce77d1c66d01b3a58ebe30b573358c314657` |
| evidence/body-sql-export.json | `3d79eaefc18abf7794a7148de8d69f849ebb473000145288e05d6d8541e4b4a8` |
| evidence/independent-qa.json | `1503e0f890d0d95a440a8f64e606ce362d9b80b906e75f8435a264ae6b41c8bd` |
| evidence/content-review.json | `89E52D09B2ADE277922A713239D7A45B43A23A63012A32E6FCF319C8717A737E` |
| evidence/responses/ | 88 raw response files, each hash/length/EOF verified |

runner及freeze先由QA静核并执行offline preflight，再由Lead预先授权条件触发一次运行；没有复用其他数据库、旧manifest或旧run token。本轮没有改业务代码、source catalog、LAN配置或preview fixture，因此没有重新运行软件tests/CI。

## 当前交接

Requested model为`Luna High`，实际model未由平台工具验证；本次无provider/model调用。下一步是把逐源业务事实复核与内容候选排序单独记录，再决定是否纳入本地editorial preview；不可从隔离库直接复制文章或绕过既有seed/manual-review路径。仍需按每个来源独立证据补充跨周期/日期/分页/内容质量后再评估admission。
