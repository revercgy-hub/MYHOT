# 地方监管局八来源隔离批量观察交接（进行中，2026-10-12）

STATUS=IN_PROGRESS
STAGE=P3地方监管局来源质量与覆盖核验
GATE=Gate 2 `PASSED_FOR_BOUNDED_P4_PILOT`；仅正式review指定的三个来源逐篇合格样本，不因本批改变
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=ed0081cd295df99401b06212648b62f9ce829111（预览代码精确SHA；docs-only提交父SHA）
STAGE_CODE_SHA=ed0081cd295df99401b06212648b62f9ce829111（新增三条编辑辅助样本allow-list/seed，未改source collector）
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
RECOVERY_SHA=07aaf2fcb6d1b0d249c11f78c5a5ff95d2c461dc（Root恢复时的checkout起点）
STAGE_START_SHA=9030fcc5468d5662352655ddbdca25a53dc401b2（八源执行与文档收尾阶段起点；更早历史恢复点`cc0b830`不作为本轮起点）
WORKTREE=本次docs-only提交包含STATUS、SOURCE_MATRIX、REGIONAL_BUREAU_COVERAGE_MATRIX和本handoff；preview三文件已在ed0081c提交。忽略目录runner/证据不纳入Git

## 阶段退出条件与结论

本次按Lead明确授权，使用已存在的普通单页collector，对八个disabled地方监管局来源各运行一次。采集运行完整结束；本文件记录隔离数据库中的写入和正文抽取结果，不声明来源通过、覆盖完成或Gate升级。独立raw/SQL/runtime QA已通过；内容QA从16篇body `ok`中选出广西、海南、四川各一条供编辑辅助预览，仍未完结完整源质量与日期规则核验，故状态仍为`IN_PROGRESS`。正文`ok`不等于内容业务通过；19次尝试中16篇为`ok`、3篇为`unconfirmed`，不能将19条publication projection计作19篇正文通过。

## 完成内容与可复核证据

- 数据库：新建`fiscalhot_regional_bulk_20261012_test`，只应用仓库现有35项migration；执行前由`pg_isready`确认`127.0.0.1:5432` ready，read-only SQL确认默认库/用户`postgres`且目标库不存在。目标库在执行前fresh，运行前各审计表计数为0。
- 运行：`.data/fiscal-qa/regional-bulk-20261012/runner/run-once.mjs`一次运行；manifest记录UTC `2026-10-12T09:47:52.938Z`完成。单页collector 8/8 `status=ok`，每源发现并新建10条，共80篇；19次显式正文尝试中16 `ok`、3 `unconfirmed`。Undici dispatch 27/64，0 rejected、0 redirect，无重试，无全局cap触顶。
- Raw：`.data/fiscal-qa/regional-bulk-20261012/evidence/manifest.json`及`evidence/responses/dispatch-001.body`至`dispatch-027.body`。独立QA已逐份确认27/27 raw长度、SHA-256和EOF均与manifest匹配；全部27个dispatch为HTTP200，0 redirect/rejected/duplicate/runner violation。gzip列表响应解压后按当前parser离线重放，8源各得10项，URL/title与数据库记录逐项匹配。
- 只读正文导出：`.data/fiscal-qa/regional-bulk-20261012/evidence/body-sql-export.json`，19条尝试的article行含正文、来源、标题、URL、列表发布日期、body状态与content hash，并绑定尝试结果和raw dispatch ID/path。`articles`表无物理`body_sha256`列；导出按`body_text`计算SHA-256，19/19与manifest articleAudit摘要一致。
- 写入审计：before计数全0；after sources=8、articles=80、fetch_runs=8、article_revisions=96、article_discoveries=80、publications=19；analyses、receipts、selected ledger/state、job_runs、audit_log均0。80个`content.extract-body` jobs为`created`，未消费。19条publication均`selected=false`、`eligible=false`、`indexable=false`、summary body mode且无summary；不能据此称为站点页面可见内容或精选结果。
- Manifest `violations=[]`、`failure=null`、8/8源配置恢复标志为true；独立SQL核验亦确认source仍disabled、全文关闭且strict body-ready开启。无analysis、receipt、selection ledger/state或job run；无worker/API/Web、OCR/Jina、模型或付费provider调用。独立raw/SQL/runtime QA已通过；广西、海南、四川各一条候选通过事实核对，其余逐篇内容质量与日期权威性仍待评。本批本地执行未跑软件测试/CI；本次没有生产代码修改。
- runner/preflight和证据全位于忽略目录`.data/fiscal-qa/regional-bulk-20261012/`，`git status`不包含这些文件。

## 本地编辑预览增量与读写审计

内容QA为广西、海南、四川各选出一条事实核对通过的样本。preview owner在代码SHA `ed0081cd295df99401b06212648b62f9ce829111`将固定preview allow-list和seed扩展至18项；未改collector、行业source配置或migration。精确SHA的GitHub Check+Docker run [38233568406](https://github.com/revercgy-hub/MYHOT/actions/runs/38233568406)已completed/success；`gh --repo revercgy-hub/MYHOT`核对head SHA完全一致，origin分支也指向该SHA。

Root批准后，在既有`fiscalhot_preview_test`做了一次seed；没有创建/清空数据库或重放。before快照`.data/fiscal-qa/local-preview-seed-20261012-qa/before-eighteen.json`确认`postgres@127.0.0.1/32:5432`、35 migrations，旧15个source/article身份及8个preview业务表各15行，正常`pool_search=15`；新3 IDs不存在。fetch/analysis/receipts/selection/job_runs为0，`pgboss.job`关系不存在并按0记录。Seed将样本数从15增至18，前三项旧记录unchanged，新增广西/海南/四川三项created。

之后只读审计`.data/fiscal-qa/local-preview-seed-20261012-qa/audit-eighteen-result.json`为PASS，完整snapshot为`after-eighteen.json`：8表均18行；旧15条跨sources/articles/publications/editorial_overrides/audit_log/article_revisions/article_discoveries/pool_search完整字段与timestamp逐行相同；3条新记录为summary-only、body null、source disabled/fulltext-off、eligible但未精选、score null、不可索引/转发，`humanGold=false`。fetch/analysis/receipt/ledger/state/job_runs仍0，pgboss关系仍不存在。没有API/Web、worker或额外HTTP。

| source ID | 官方列表入口 | found/created | 正文尝试 | 初步正文结果 | 抽取诊断 | 日期/内容结论 |
|---|---|---:|---:|---|---|---|
| `mof-guangxi-supervision-dynamics` | `https://gx.mof.gov.cn/gzdt/caizhengjiancha/` | 10/10 | 3 | 3 ok | — | 3条存储发布日期均在90日窗口；1条业务候选事实QA通过，权威日期未定 |
| `mof-hainan-supervision-dynamics` | `https://hq.mof.gov.cn/caizhengjiancha/` | 10/10 | 3 | 3 ok | — | 3条存储发布日期均在90日窗口；1条业务候选事实QA通过，权威日期未定 |
| `mof-chongqing-supervision-dynamics` | `https://cq.mof.gov.cn/gzdt2019/caizhengjiancha/` | 10/10 | 3 | 3 ok | — | 3条存储发布日期均在90日窗口；未晋升候选，权威日期未定 |
| `mof-sichuan-supervision-dynamics` | `https://sc.mof.gov.cn/caizhengjiancha/` | 10/10 | 3 | 3 ok | — | 3条存储发布日期均在90日窗口；1条业务候选事实QA通过，权威日期未定 |
| `mof-guizhou-supervision-dynamics` | `https://gz.mof.gov.cn/caizhengjiancha/` | 10/10 | 3 | 3 ok | — | 3条存储发布日期均在90日窗口；未晋升候选，权威日期未定 |
| `mof-shaanxi-supervision-dynamics` | `https://sx.mof.gov.cn/gzdt/caizhengjiancha/` | 10/10 | 1 | 0 ok / 1 unconfirmed | `non_article_container`；非PDF约3,087字TRS `div/font/span`，缺正文结构节点 | 存储发布日期在90日窗口；正文阶段停止；保持hold |
| `mof-qinghai-supervision-dynamics` | `https://qh.mof.gov.cn/gzdt/caizhengjiancha/` | 10/10 | 2 | 1 ok / 1 unconfirmed | `short_body_not_allowed`；非PDF约176字且含图片，低于200字 | 两条存储发布日期均在90日窗口；失败样本含财政监督事实但保持hold |
| `mof-xinjiang-supervision-dynamics` | `https://xj.mof.gov.cn/caizhengjiancha/` | 10/10 | 1 | 0 ok / 1 unconfirmed | `identity_mismatch`；标题匹配但当前PubDate冲突 | 列表9/24、当前详情10/8、旧详情9/24；URL日7/17不作为裁定，保持hold |

前三项诊断来自runner告警并由独立QA使用保存原始响应离线复现；失败后没有追加请求、降阈值或换候选。陕西详情为非PDF正文，约3,087字，TRS结构只见`div/font/span`，不含当前正文结构门禁要求的节点；青海为非PDF正文，约176字且含图片，正文有真实财政监督事实但低于200字严格短正文门槛；新疆当前同URL正文约3,329字、标题匹配，但列表日期为9月24日、当前详情PubDate为10月8日，而旧详情曾显示9月24日，URL路径日期7月17日不能裁定冲突。三篇均保持hold，不放宽身份或正文门禁。独立QA确认80条存储发布日期均落在本次采集窗口内，但这个判断以采集器当前列表日期解析为基准，不确立详情发布日期规则或来源级日期权威性。内容QA选出广西、海南、四川各一篇真实财政监管业务候选；四川摘要初稿纠正了原文不支持的“预算垫支”，最终事实限定为预算执行进度异常、支付不合规、会计科目不规范及项目支出与预算不符。广西、海南候选摘要通过事实核对；其余样本没有为凑满八源而提升为候选。

## 环境与安全边界

执行目标为本地PostgreSQL `127.0.0.1:5432/fiscalhot_regional_bulk_20261012_test`，35 migrations；本地现有portable PG cluster恢复后保持运行。所有八个source catalog条目均仍disabled，`site_fulltext=false`、`syndicate_fulltext=false`。runner在隔离的source config副本中将`detail.maxFetches=0`以禁用inline正文、精确限定目录URL，并在每源结束时恢复且核验catalog原配置。每源正文最多3次，共享Undici硬上限64且redirect计数；实际27次。失败停当前source正文阶段，其他已批准源继续；没有达到全局cap。

COLLECT_ENABLED、MODEL_CALLS_ENABLED、INDEXNOW_SUBMIT_ENABLED、FEISHU_CONTENT_PUSH_ENABLED、FEISHU_INTERNAL_ENABLED、EMBEDDINGS_ENABLED、OCR_RUN_ENABLED、JINA_BODY_FALLBACK、ALLOW_PRIVATE_NETWORK_FETCH均为false；`COLLECT_SKIP_JINA=true`。没有模型/provider凭据或proxy环境变量；worker未运行，jobs仍created。只请求八个官方列表与cap内文章HTML；无分页overlay、PDF/附件、OCR、Jina、重试、API/Web或生产代码/配置/schema修改。

## 内容QA结论

独立内容QA最终通过三条候选供本地编辑辅助预览：广西、海南、四川各1条。四川摘要已移除无正文依据的“预算垫支”并通过事实核对。该结论只表示这三条候选可交预览owner进一步编辑；不构成正式模型精选、人工Gold、source admission或业务质量全源通过。陕西、青海、新疆三条unconfirmed保持严格hold；对其它来源不为凑满八源而造候选。文章ID、题名、日期、正文hash、raw response绑定在`.data/fiscal-qa/regional-bulk-20261012/evidence/body-sql-export.json`。

## 未完成项、风险与阻塞

- 独立raw、parser、SQL、runtime QA已通过；内容QA通过广西/海南/四川各一条候选事实核对；既有预览库15→18 seed后读前/写后审计通过，旧15条八表全字段未变。尚未完成来源级日期规则、全栏业务质量或Gate/source admission审查。`ok`只表示抽取非空，不代表来源质量通过。对3篇unconfirmed保留严格hold，不补请求。
- 本批仅单页、单时点各10条；不证明近90日完整覆盖、分页末页、日期规则、重复/历史完整性、跨周期稳定性或来源准入。
- Gate 2仍按正式review限定三个核心来源的有界P4 pilot；本批扩展观察不扩大授权或改变source admission。

## 下一步与线上验证限制

1. 本handoff与矩阵、状态随docs-only提交推送；父代码SHA为`ed0081c`，精确SHA对应的Check+Docker成功结果见run 38233568406。旧`07aaf2f` CI仅作为历史代码证据。
2. API/Web未启动；本轮没有root/item页面GET、noindex/robots或live UI核验，preview条目的实际页面显示仍未确认。以后若做loopback验证另安排服务启动和预算，不由当前seed授权自动带出。
3. 后续来源工作只做逐局栏目历史、详情日期权威性和跨周期稳定性证据，不因三条预览候选跳过source admission审查。陕西、青海、新疆三项保持hold；详情/配置修改或补采须另定范围并由Root批准。

## 声明

本交接区分单页发现、显式正文尝试、正文抽取状态与独立业务质量。没有由raw、manifest或只读数据库结果支持的事实不作猜测；未完成的QA不视为通过。
