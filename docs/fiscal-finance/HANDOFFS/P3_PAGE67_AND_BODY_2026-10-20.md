# 2026-10-20 P3 分页与正文检查点（进行中）

STATUS=IN_PROGRESS
STAGE=P3 bounded pagination continuation and saved-body verification
GATE=Gate 2 PASSED_FOR_BOUNDED_P4_PILOT; Gate 3/4/5 not passed
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=93b61a690ec2739c2c00d2d8595371c94fddccc4（10/20代码+文档检查点提交；10/21后续见新交接）
STAGE_CODE_SHA=80e7458c805bae057a3d898d3d32ae2f69e7b163
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKTREE=93b61a6提交完成时干净；10/21启动状态与未提交文档草稿见[P3 latest增量与正文候选检查点](P3_LATEST_INCREMENTAL_AND_BODY_REVIEW_2026-10-21.md)


> 后续状态：本文件只记录10月20日结束时已完成的page6/7与两篇正文CAS事实，保持其manifest和历史结果不变。10月21日完成四条既有list metadata replay、对GX/四川各一条latest base-page观察（新增四川3条pending metadata），以及四篇既有body_text投影CAS；旧latest CLI在返回结果后因PgBoss producer未停止而需结束自身进程，raw响应未捕获。最终计数、CLI cleanup修复、tests/CI和未完成边界以[10月21日交接](P3_LATEST_INCREMENTAL_AND_BODY_REVIEW_2026-10-21.md)为当前记录；不要将10月20日146篇分页库快照当成当前计数。
## 范围、退出条件和下一步

本轮仅验证专用测试库受限分页及主隔离库两篇精确正文，不宣称来源准入或90日覆盖。分页raw/SQL独立QA与两篇人工CAS post-QA均通过；代码和测试改动已提交并推送，精确SHA GitHub Check通过。四源历史页覆盖复核报告指出重复、逆序和跨观察日问题；Root核准的一次base-page观察已完成，独立capture/hash QA通过并识别GX 3条、四川1条未见metadata候选。相关事实、限制和10/21只读baseline见[10/21检查点](P3_LATEST_INCREMENTAL_AND_BODY_REVIEW_2026-10-21.md)。本文件保留10/20检查点状态，后续以新交接为准。

本检查点记录分页续页、两篇正文的有限验证以及相关软件变更。它不表示来源准入、90日覆盖或Gate完成。忽略目录中的raw响应、SQL快照和独立QA报告为本机证据，不提交 `.data/`。

## 分页续页

经Root核准的scope v2 SHA-256为`F59B4FFB9E7BB1C91964C004A2CAD0BD0D5C314269C206AABBE346BBF5627903`，canonical SHA为`a9ef704c1253c897e85558299f2ae1ea0eb35caa3155a3c8549edbed21efa198`。专用库`fiscal_pagination4_20261016_test`的baseline在请求前复核；四源均从page6/7续跑，每源最多2次、总计8次GET、精确冻结URL allowlist、重定向0、最小间隔1000ms。执行结果为`bounded_continuation_complete`：8/8为计划URL、HTTP 200 HTML，raw SHA与manifest匹配；间隔1102.497–1114.035ms、并发1、无阻止请求和安全violations。manifest见`.data/fiscal-qa/page67-execute-20261020-s1-v2/manifest.json`，SHA-256 `A7BD92D254F95E7216F5C0382E0197A01A8EA7E4B8F6A613BA7E76439FE693EB`。

独立逐行QA见`.data/fiscal-qa/page67-v2-independent-qa-20261020.json`（SHA-256 `066D5FFA846550731247E5C63819BBBA46CB126C834E8ADF49C127FD14F122B5`）。preflight确认核准baseline逐行匹配。145篇既有articles、149条revisions、6条publications、145条discoveries和145个queue jobs均无既有行变化；本次仅新增1条重庆列表候选、其rev1、discovery、1个`created`且未启动的正文job，以及4条fetch runs。四源cursor 6→8，generation/anchor/cutoff不变，coverage仍`unproven`；source均disabled、全文与转发全文关闭，analyses/receipts/selection/job_runs为0。

新候选`caajn36foqfznnnxb2oz8ji3o`标题为“财政部重庆监管局：紧盯六个方面有力有效做实超长期特别国债资金监管”，list页面日期为`2026-07-30`，但URL路径token为`2026-07-02`。捕获页面的同一list row同时支持标题和显示日期；保留列表日期、正文仍pending/空，不以URL token覆盖日期。后续若需判断此差异，另行按精确详情scope核验。

## 主库正文批与人工修复

主库只对陕西、天津两篇已核准详情页各发1次GET，两次之间1008ms；均为HTTP 200、gzip完整，无重定向/重试/额外请求。原execution结果`completed_with_violations`保持原样。B生成的附随QA文件`.data/fiscal-qa/body-progress-20261020/main-approved-http-independent-qa.json`（SHA-256 `81EE5D17064C7F3291DF90DDFD47D63C500666B37C43312761BB7096A7159C8E`）不是C的独立审查证据；C另行重算captured entity和decoded HTML哈希，确认runner把`encodedEntitySha256`误认作缺少`wireSha256`，并把`visibility=public`误报为不安全。陕西entity/decoded SHA分别为`8a93f6b05fd5789876b3c5349a5db25150ba777faa121ac58f8dd8d52c2491d8` / `0c4cada554133d42b0f02fa653c12b8d6e98465924adaff6901bc3a159b10575`；天津分别为`7ec33a20ba30e08533f2391ac4f62a9d22f930108030f296a71767aaa4620acc` / `72a1438936c0394ee73cdb7dee5331ec3d72e9fcaeddc2d4b91e9d215c82f46a`，均EOF完整且URL与scope一致。两目标publication均`eligible=false, selected=false, indexable=false, syndicate=false`。目标最初均安全落为`unconfirmed`、rev1、空body；publication计数316→318仅因增加这两条summary-mode目标记录。未修改历史违规报告或将自动parser decline改写为成功。

Root批准的离线人工CAS依据v2 proposal绑定captured HTML和独立正文QA。C直接重解析两份已保存decoded HTML与行业selector，重算sanitized HTML、可见文字SHA和content hash：陕西785字符，天津154字符（金额保留`1.66亿元`）；标题精确、上海日历日均匹配，均无选中节点链接、导航或附件。detail PubDate带时分，而列表入库时间为上海日零点；二者日期相同，保留原`published_at`。独立提案QA见`.data/fiscal-qa/body-progress-20261020/manual-body-review-independent-qa.json`（SHA-256 `3AF546DDD4C060D8E0ED8AAD0D86A3E97E89368EF6CD4E1767FA5AFDE8F6A031`）。Root随后仅批准这两条人工CAS，不改source阈值/配置，不发HTTP、不启动worker/provider。

人工CAS之后，独立行级QA见`.data/fiscal-qa/body-progress-20261020/manual-body-cas-independent-post-qa.json`（SHA-256 `99628EB54FBB1B26B6268B070F3ECDFDFD70BB1921AC2EB6A624312FA6E99450`）：主库48 sources、442 articles、789 revisions、318 publications、427 jobs；仅两目标新增rev2并改正文状态为`ok`，正文/HTML/content hash与v2精确匹配，list时间戳保留。所有非目标article/revision/publication、sources、jobs与关联表逐行不变；targets publication仍summary mode，eligible/selected/indexable/syndicate=false；其summary字段未变且为null。CAS过程0网络请求、0 worker、0 provider。原始自动decline与CAS修复作为两个独立证据阶段保留。

## 代码验证与边界

分页guard改动在commit `41dec8a`，selected-body提取和既有长度断言修复在commit `80e7458c805bae057a3d898d3d32ae2f69e7b163`；没有改apps/schema、source config、全局sanitizer、数值门槛或历史正文。page continuation scope schema为v2，预算固定绑定冻结page URL数（本scope 2/源、8全局），dispatch仅允许确切冻结URL，拒绝重复、额外URL和redirect；fixture helper有原生redirect mode。fresh DB focused分页集成7/7、typecheck通过。selected-body相关focused suite 30/30；新增长度边界断言确认三段归一长度199拒绝、200通过，保留段落分隔输出。Backend full-suite尝试均在空`_test`库进行，保留全部失败及其环境原因：A的`.data/fiscal-qa/full-local-qa-20261020/npm-test.log`为377/403通过、25失败、1跳过，`MODEL_CALLS_ENABLED=false`；B第一轮`.data/qa/local-backend-acceptance-20261020/npm-test.log`为389通过、13失败、1跳过，embedding endpoint被配置为bad port；第二轮`npm-test-second.log`为399通过、3失败、1跳过，额外embedding环境变量导致signals测试未接管repo-local mock并尝试连接loopback:65001；B第三轮为403项、402通过、0失败、1跳过；第四轮为405项、401通过、3失败、1跳过，三失败是accounting测试仍断言旧的raw长度473，而保留段落换行后raw长度482、归一化仍473。B随后只改这两个测试的语义断言，focused15/15通过；C又独立运行selected-body、两份accounting测试共30/30通过。错误full-suite结果和日志原样保留，不表述成本机full-suite成功。

最终GitHub Check run [39356710341](https://github.com/revercgy-hub/MYHOT/actions/runs/39356710341) 的workflow head精确为`80e7458c805bae057a3d898d3d32ae2f69e7b163`，Check与Docker jobs均成功；backend403/403 pass、0 fail、2 skipped，typecheck、Web build/tests、migration/seed、built-site smoke、Docker build/smoke全部通过。该workflow run作为最终精确代码SHA软件回归证据。API/Web未启动，本机live health/noindex/smoke均`NOT_RUN`。

四源page0–7覆盖差异只读分析见`.data/fiscal-qa/page67-coverage-next-20261020/coverage-gap.md`（SHA `278b30df033e022d5906f8e54f7a93cd9aea34d6ff4c8d12cc884ed23621913d`）及JSON（SHA `5568e27e996a9ee0a52215566edeef3956d5598f5c6bd3d97ab8ca03a57780ee`）。不同日期采集的页样本不能视为稳定快照：GX page5→6有4条重复和10条逆序，CQ有6条逆序，SC有1条重复，海南未见此类重复/逆序；CQ page6显示日期2026-07-30而URL token为07-02，继续hold。各源page7都有早于既定cutoff的行，但这不证明无缝覆盖；固定观察窗与当前滚动90日窗也不能混为一谈。下一步应定义覆盖完成/稳定快照和增量更新证据契约，不机械增加index8/9。

Root核准的latest base-page一次只读观察使用一次性脚本`.data/fiscal-qa/latest-lists-20261020/capture-lists-once.ts`（SHA `2E06BF74660BE63A8D3F478F9141C220681CBB3C3053B49F086593E1512C84D3`）。结果manifest `.data/fiscal-qa/latest-lists-20261020/capture/manifest.json` SHA `82C0264FD0E81E82A4BD84D9802443593BE0AE9C63FB14A61E0B3F395C3C8314`：四个既定URL各一次GET，均HTTP200 HTML，wire bytes/SHA、独立gzip解码和decoded/text hash匹配；dispatch间隔1378.153/1386.890/1376.796ms，零redirect/retry/extra dispatch、零DB写。C独立文件/运输QA报告见`.data/fiscal-qa/qa-luna-20261020/independent-page-and-body-qa.json`（SHA `C29447998ECD4AB47619D3AA61433B495FF696815596B2E6A39252037F281944`）。

listing分析`.data/fiscal-qa/latest-lists-20261020/capture/listing-analysis.json` SHA `20F5277BDBE1099DE1BF7BC784AF73E2E08C955BB3E4BAF95154D36B74F12692`：每源parser读到10项，40条与分页库146条既有文章对照，读表限`articles`/`sources`且transaction read-only。四条本页未见metadata候选为GX 3条（10/20敬老慰问、10/20学习品牌、10/19产业奖补验收）和四川1条（10/19财政金融协同促内需），它们未入库、未精选；CQ和海南本页0新增不证明没有遗漏。四川另两条既有候选list日10/12、10/08与URL date token 9/28、9/09不一致，维持hold，不更新DB状态。固定90日窗口和本次滚动90日cutoff分开计算。

历史正文影响审计`.data/fiscal-qa/inline-text-spacing-audit-20261020/persisted-impact/impact.json` SHA `D3CF945802CABAF72A304B6972ABF0D73591FA6B39A1E4907C327945BC72DEF2`检查378篇`ok`中排除本日已人工修复两篇后的376条保存HTML。374条raw text不同：171仅格式、203归一化后仍不同，后者不都证明空格错误。严格DOM邻接筛查列出11篇、总57个数字/数字单位边界候选；artifact包含24段示例证据，未逐条人工核查57项。山东标题“2026年8月份征收入库中央非税收入7.70亿元”是强例，sanitized HTML相邻`7.70`与`亿元`文本节点而stored body在中间插空格。该离线重放用synthetic wrapper，title/date取自DB且HTML是已sanitized正文；不能声称重新确认来源身份，也未对历史body批量回填。C对该统计与示例的独立复核也记录在上述qa报告。后续仅按原始来源/捕获证据逐项核对这11篇，不依据候选数自动更改DB。

本轮前HEAD为`928cff90818275ab0b188a879f8e435af209042d`，分支`feat/fiscal-finance-hot`，`origin/feat/fiscal-finance-hot`当时一致。Gate 2仍`PASSED_FOR_BOUNDED_P4_PILOT`；Gate 3/4/5未通过。分页sample不证明90日覆盖或source admission；Gold仍15人工confirmed、85项机器建议不计人标，事件组/split未确认。

## PostgreSQL恢复与运行边界

Root核准后只读核实原cluster无postgres进程、loopback 5432无listener、`pg_ctl status`无运行server；旧`postmaster.pid`中的PID 6368实际属于`SearchProtocolHost`且不属于cluster。原锁文件在cluster内可逆改名为`postmaster.pid.stale-20261020`，原件与备份SHA一致；随后只调用一次既有`pg_ctl start`，Postgres对此前unclean shutdown执行正常fsync/WAL recovery，最终loopback ready。没有删除/重建/强杀数据文件；停机根因仍未知。本轮未启动API/Web/worker，未做live smoke。

```text
TASK=P3 finite pagination and two grounded body cases
MODEL=Luna; no project model/provider was called
FILES_CHANGED=scripts/fiscal/p3-page-continuation.ts; tests/fiscal-page-continuation.test.ts; tests/helpers/fiscal-page-continuation-transport-preload.ts; this handoff and current status/plan index
TESTS_RUN=pagination focused 7/7; selected-body/accounting focused 30/30; fresh backend full suite latest local attempt 401/405 pass, 3 fail, 1 skip; GitHub Check 39356710341 on 80e7458 passed (403 pass, 0 fail, 2 skipped); typecheck/Web build/Web17 pass
RESULT=page6/7 bounded execution and two manually approved body CAS writes independently verified; coverage unproven and all source flags remain disabled
RISKS=one newly inserted Chongqing list candidate has list date 2026-07-30 vs URL token 2026-07-02; keep pending and do not rewrite date without detail evidence
BLOCKERS=Gate 3–5 requirements remain incomplete; source coverage completion evidence and remaining source/body quality review remain open
NEXT=verify the 4 latest metadata candidates and 11 historical numeric-boundary candidates against their original evidence; design latest incremental inspection compatible with the active backfill cursor plus coverage completion evidence; continue Gold/source coverage/NAS work without changing split/admission state or mechanically fetching page8/9
```
