# 2026-10-16 验收与本地预览复核交接

## 范围

本交接汇总 2026-10-16 的软件回归、40 条本地摘要预览 API/Web 详情复核、采集正文余额及隔离库备份工具验证。它不升级来源准入、Gate、精选或生产状态。Git 提交与推送由 Root 串行处理；本交接本身不代表已提交。

## 软件回归

最终 fresh backend suite 使用隔离 loopback 数据库 `fiscal_acceptance_final2_20261016_test`，完成35项 migration，`npm test` 394/394通过，日志为 `.data/fiscal-acceptance-20261016-fulltest-final.log`（SHA-256 `9b0e2070b51009180c909509e22dca8868af52dcc50bfcc1975897bdb9abcf9b`）。该工作树包含四个地方局显式metadata-pagination配置及测试，也包含已批准的 `events.test.ts` fixture修复；该测试修复只让两篇目标标题得到 SAME_STORY、其它全局候选得到 UNRELATED，不改变生产的全局 `linkRelatedStories()`。独立 `events.test.ts` 为11/11。

测试环境仅为仓库本地mock测试启用 `MODEL_CALLS_ENABLED=true`；真实provider密钥及endpoint已从测试进程环境移除，collector、Feishu、IndexNow、Jina、private-network fetch、OCR和embeddings均关闭。一次先前完整尝试在 `MODEL_CALLS_ENABLED=false` 时让本地stub测试失败，属于无效测试环境；另一次临时环境清理误删 `DATABASE_URL`，测试安全断言拒绝连接并随即中止。这两次不计入回归结果。394/394运行后，测试修复提交为 `2d5d9602fd41fff3a9378fded0620d21e29d3fec`。

`npm run typecheck`通过，Web tests 17/17通过。Web生产构建在 `.data/fiscal-acceptance-20261016/web-build-copy/apps/web` 的隔离副本内完成，未覆盖活动目录 `apps/web/build`。当前本机运行站点的标准 smoke 通过30/30，基址 `http://192.168.3.47:3000`；同一主机通过LAN地址不证明另一台设备可连接。

四个地方局配置变更由独立提交 `8d022332edb8696f2800315a5a4a9fb5a8a0c073`引入，范围限已有bounded metadata pagination adapter并保留来源disabled、全文关闭及正文ready保护。本机隔离库备份/恢复工具通过focused tests 5/5，并完成合成测试库dump/restore核对；此结果不替代NAS或生产备份恢复验收。并发Git操作曾使两个备份工具文件进入标题含“audit”的提交 `7f2cce1`；实际文件内容是本机备份/恢复验证工具，Root决定保留公开历史，不回滚或改写。

## 40条摘要预览

40条固定候选导入结果为 `PREVIEW40_IMPORT_COMMITTED`，1条按原URL更新、39条新建；旧预览库总数为104，首页精选目前仍为空。内容审阅已由独立QA核为 `PASS_OFFLINE_CONTENT_REVIEW`，本交接不重复文章事实审核，也不把Luna-assisted摘要称为正式provider receipt、人工Gold或精选结果。

独立只读复核报告：`.data/fiscal-qa/preview40-api-web-postqa-20261016/summary.json`，SHA-256 `7efd6d9b207b841321fbff6478023045a75785a6b1073a86a9e3907e6d488c9a`。40/40 API详情和40/40 Web SSR详情均为HTTP 200，标题与摘要匹配，正文为空、selected=false、score=null、indexable=false，Web响应带 `noindex, nofollow`。API health及数据库健康为ok；`/all`同机LAN-IP请求为200并带noindex。报告末尾的脚本hash helper在写出JSON后对绝对路径重复拼接repo根目录而返回ENOENT；JSON本身已成功写入，之后直接重读并重算物理SHA，且核实所有40行均通过，没有重跑请求。此前 `.data/fiscal-qa/preview40-root-postqa-20261016/current-health-safety.json` 记录104条、零正文、零分析/收据/job_runs/selected、0个启用来源与0条unsafe publication。以上是同机本地预览检查，不是跨设备可达性证明。

## 采集库与后续范围

隔离主采集库当前为442篇：373 `ok`、57 `pending`、12 `unconfirmed`。最新四源HTML有界批次实际仅请求2篇（各源首篇），两篇均因详情日期与冻结列表日期不一致被严格身份检查保留为 `unconfirmed`；标题相符，不改写发布日期、不放宽身份门槛。新疆列表日为2026-09-24、详情日为2026-10-08；厦门证监列表日为2026-08-04、详情日为2026-09-23。按首篇非ok停止同源策略，其余2篇未请求。原始响应hash/EOF和SQL状态独立核验通过。执行审计另发现scope配置间隔下限为750ms（低于Lead批准的1000ms），两次HTTP GET起始间隔实测294ms，故这批存在执行节奏违规；原始数据可作有界身份失败证据，但不能称该次执行完全符合冻结节奏或重试补救。IFXP固定文章 ifxp3rg71sg6grhlply3qkkeg 的单条人工附件resolution也已提交并通过独立只读SQL QA：rev1/unconfirmed→rev2/ok，正文8835字符，正文与HTML哈希分别为46c32ad55fbfe5995539bf3ec24063bb6762325bd27c1d9557083107e94b730c和4adc43ef2c0342cec4aa9c9a4296a94efe192cb877b1ea5227cdc43f4537df4f；原 attachments_unprocessed/pdf_page_no_text 失败provenance被手工resolution证据保留，发布日期/URL/标题不变。来源及cursor未变，全局427 jobs哈希相同、目标job为0；publication仍summary-only、summary=null、eligible/selected/indexable/syndicate均false；分析、receipt、job_runs、selection、pool_search仍为0。无HTTP/provider/model/worker调用。独立SQL QA证据 .data/fiscal-qa/qa-luna-expansion-followup-20261016/ifxp-manual-resolution-independent-qa.json SHA 026764ec6bbdd7dd9d886e7ab00c15ed1912f1db42c143832f8c2d7b7765598d。最新5篇正文回填经Root独立SQL QA通过：目标文章进入rev2且正文hash、日期及URL身份匹配；非目标文章未变；来源配置/cursor恢复；extract-body与analyze队列数量保持既有状态；downstream表无新增结果。证据 `.data/fiscal-qa/pending-audit-20261016/poc-five/root-independent-sql-qa.json`。这与预览库104条是不同数据库、不同统计口径。

四源新分页仅证明已保存页面范围和bounded adapter行为，不证明90日覆盖或栏目准入。四源分页批次已在独立fresh数据库完成：广西、海南、重庆、四川各抓列表第0/1页，8次GET均HTTP 200；独立核验8份gzip原始响应hash及EOF均匹配，并用各来源当前列表选择器复算每页10项，跨页URL重复为0。每源insert 20篇（合计80），80篇body均pending且80个extract-body jobs仍created；4条fetch run均ok、每源pagesCommitted=2、nextPageIndex=2、coverage=unproven。四源source仍disabled、全文关闭；analyses/receipts/job_runs/publications/selection/pool_search均为0。请求最小间隔1003ms，符合冻结的至少1000ms。manifest的pageAudits因sourceId为空没有填入逐页候选，审计使用response origin/path映射并对8份原始HTML独立解析；finishedAtUtc字段为空，但live SQL fetch_runs均已结束为ok。此分页测试库独立于442篇主采集库，80不能加到主库或宣称为80条去重新增内容。

## 安全与验收边界

48项来源配置仍全部disabled且全文关闭；没有启用自动采集、worker、生产provider、付费API、OCR、推送或公开发布。当前结果不构成所有来源附件完整覆盖、Gate 2扩大、Gate 3 Gold/精选评测、Gate 4全站长期覆盖或Gate 5 NAS/Production验收。Gate 2状态继续是 `PASSED_FOR_BOUNDED_P4_PILOT`。

## 可继续工作

四源HTML身份失败留存，不自动复跑；可继续已授权的保存证据正文复核，并基于分页库page0/page1的80条待正文候选规划后续独立范围。常规离线复核与已授权采集批次可自行推进；人工Gold标注、付费模型调用和正式部署属于独立决策项。不得将未审核标题当事实，不得将分析摘要标成Gold或provider结果。

## HTTP dispatch 间隔 guard 后续修复

后续提交 `7de66eb` 为HTTP预算器增加可选全局 `minDispatchIntervalMs`：默认值0保持现有调用兼容；显式配置后，在每次真实dispatch边界拒绝间隔不足的请求，不自动sleep或retry，runner需自行等待并配置至少1000ms。focused测试7/7和typecheck通过。此前四HTML批次scope配置750ms、低于获批1000ms，实际起始间隔294ms的违规记录保持不变；没有重跑或重写原始证据。全套394/394回归属于该guard提交前代码，guard后未宣称完整套件通过。
