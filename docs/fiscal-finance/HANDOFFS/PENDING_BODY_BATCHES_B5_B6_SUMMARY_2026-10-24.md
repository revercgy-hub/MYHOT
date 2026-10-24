# 2026-10-24 b5/b6 正文、摘要与评审交接

## 更新：b5/b6摘要已提交，b7正文及摘要输入进度

本更新取代下文早期“b6待QA/待导入、b7未提交正文”等当前态描述；旧的执行记录保留为历史，不作为现在状态。b5 exact10与b6 exact22 summary-only已提交并通过A独立数据库/LAN后验。当前Staging状态为418 articles/613 revisions/418 discoveries，body 195 ok/217 pending/6 unconfirmed，publications/overrides 86/86，sources48全disabled/fulltext/syndicate=0，Gold200 count/hash不变，分析/receipt/job无新增。

b6 exact22 的v1草稿保留；v2只修正两处事实表述，A核验sidecar为`.data/fiscal-qa/pending-body-batch-20261024-b6/independent-summary-v2-correction-qa-b6.json` SHA `7533f6385830ed9541fcac898a4285f0be1f6d62464575bea191bdf2634b6b8e`。A的grounding sidecar `.data/fiscal-qa/pending-body-batch-20261024-b6/independent-summary-grounding-qa-b6.json` SHA `7dc39b489b8e8c530b3fc59062901df94e101c0e809cdff04f7b9247332e8bc5`，22 PASS/25 BLOCK/0 UNKNOWN；canonical QA仅按批准的22 PASS分为30+17两份manifest，不含BLOCK。c1精确14项已提交，c2精确8项已提交；总数22。c1事务提交后CLI因结果文件输出路径守卫错误未产生原生执行回执，因此不重试、不伪造回执；A的直接DB确认`.data/fiscal-qa/pending-body-batch-20261024-b6/independent-c1-direct-commit-qa.json` SHA `5328220a1e4c51af7879b12bec9f7f88c1988068dc5662259012ce298100d08a`。c2 canonical执行结果SHA `535cdc13ce9ca0e2eacd93d171ed8ab475f6f8bd82078e4634326f79eb102358`。A独立b6 DB后验SHA `0001305d78b80f33ef2beabadcc66667ec9e200ab7a77c7b8abf7cb174bb196f`；LAN详情后验SHA `dba41a9d496a97d516ed259c70c78a2d195b790fa09878098204dfba5e0c9786`。22项summary/provenance/body/source hash和发布字段逐项通过，9项BLOCK保持未发布。

b7 exact37正文已提交并经A独立后验PASS，另1项hold维持原状。b7 summary只读准备分为c1 30项与c2 7项，manifest SHA分别为`7f95734edc9ab4d7052e0058c9f60389f665ce58368447aa0ebbec271f5c7e72`和`c6a67f294cf2f5f3911dcefbd5fb24ba9242d61d587bc8255c874bebcc8be6d9`；运行记录SHA `648e4a7086e29d180a304d3a6834b593da69c8e839c552b9c4570c550f54a277`。输入使用冻结f4 `--prepare`，摘要生成及独立grounding尚未进行；无数据库写入、无provider/worker调用。b7正文后验SHA `f4b61f428ce4d839eaaf7f4cd0faee8b64aede60886f6b86fd3759ea9e1dc0d5`，快照418/613/418、body195/217/6、pub/override64、Gold200不变。b6摘要独立QA完成后追加的当前事实见前文；本交接历史段落中的旧快照只代表相应时间点。

## 早期执行记录（历史快照）

b5 的20项正文批次与b6的47项正文批次均已提交，并有独立只读数据库后验。b6后验快照为418篇文章、576条revision、418条discovery；正文状态158 `ok`、254 `pending`、6 `unconfirmed`；48个来源保持disabled且全文/转发关闭；publication/override各54；Gold200 hash保持`fbd469d962cbdf123953ec4236cdd1a53b8c6beeb62a7be24214e47bb7da4076`。b6后验快照是b5摘要导入前的精确保护基线，不是导入后的状态证明。

等待b6正文独立后验通过后，按Root批准的b5原始manifest和QA sidecar，canonical `nas-native-summary-import.ts`只导入独立grounding确认的10个PASS摘要；另10个BLOCK由导入器排除。执行回执为`NATIVE_SUMMARY_IMPORT_COMMITTED`，数据库为`fiscalhot_staging`，`imported=10`，执行时间`2026-10-24T03:03:06.622Z`。本地原件`.data/fiscal-qa/pending-body-batch-20261024-b5/summary-apply-result-b5.json` SHA-256为`8a2c99bb06a1504ac9f8fb1694f7149a0cf501b599d71961af09e6f1ac410112`；NAS私有原件位于`/data/operators/pending-body-batch-b5-20261024/runtime-root/.data/fiscal-qa/pending-body-batch-20261024-b5/summary-apply-result-b5.json`。控制台日志SHA-256为`6a651c2bbcc5a074b79d4b531d520a17e9829ccf220296fe622a067ef96fe141`。

canonical importer按摘要合同写入动态候选项；这不等于自动精选。所导入摘要的`selected=false`、score/reason保持null，并按summary-only模式关闭全文、索引和syndication。没有将Gold标签、预测分数或holdout信息用于摘要输入或导入。A独立后验已通过：数据库sidecar `.data/fiscal-qa/pending-body-batch-20261024-b5/summary-independent-db-postqa-b5.json` SHA-256 `bf31d4e375e9cf676d35fdb87360eee41c0055c433e1d4bbcb5443b3aa1ea7bd`；LAN sidecar `summary-independent-public-lan-postqa-b5.json` SHA-256 `3772fff9e23eb4895b1134cc9dde92514fe3f64d512635b136a07990749d4ca9`。实测10/10 target的输出/provenance/body/source/revision哈希匹配，只有这10项产生override/publication；保护rowset drift=0，当前publication/override均64，articles/revisions/discoveries为418/576/418，body为158/254/6，48来源flags全0，Gold200 count/hash不变。公开检查确认pool中的64条、10条新摘要详情API与网页、RSS/robots均符合预期、noindex保留且匿名`/api/admin/review-batches`为401。

## b5/b6 正文后验与导入前保护

b5 exact20正文目标提交后，独立后验记录为`.data/fiscal-qa/pending-body-batch-20261024-b5/execution-postcheck-b5-nas.json`，SHA-256 `0337440f96efbb05c07dc0b8a8461c408c09b9a8bf01047e73a84b8cf66bfc3f`。随后b6 exact47正文批次提交，并经独立直接只读数据库复核通过：47个proposal目标与当前revision 2逐项一致，3个hold仍为原pending/revision 1，0 mismatch；22个受保护rowset无变化。独立QA sidecar为`.data/fiscal-qa/pending-body-batch-20261024-b6/independent-body-postqa-b5-b6.json`，SHA-256 `4d9d5c9862ad67968f93315eb592bd34e0fb31ba83b9ccc796965d3495b2cdf8`。b6执行方postcheck为`.data/fiscal-qa/pending-body-batch-20261024-b6/execution-postcheck-b6.json`，SHA-256 `fc058873cbacd7f56813c6a2af97e9729d6881cee7e8c29a751d1ea820352f0b`，captured at `2026-10-24T02:51:56.087Z`，rowsets SHA-256 `59d33c430cc111f3c33a1fa433f33f9ea038c9da4cbfa9eacf5521c41ffccce3`。A在`2026-10-24T02:53:52.407Z`的独立RR/RO读取与该快照hash一致。

b5摘要导入前的只读preflight于`2026-10-24T03:02:17.436Z`通过，且当前rowsets hash与b6基线一致；20/20摘要目标按原manifest重新prepare后仍逐项匹配。SQL直接核实sources共48、enabled=0、site_fulltext=0、syndicate_fulltext=0；文章/revision/discovery为418/576/418，正文状态158/254/6，publication/override为54/54，analysis/receipt/job_runs为0，Gold200 hash保持上述值。preflight原件`.data/fiscal-qa/pending-body-batch-20261024-b5/summary-preflight-b5-after-b6.json` SHA-256 `00a2945ad6cb44f9c07b6dc1e7d30c9926acb4b6e8690b10995896ac4480e3a7`。只读helper SHA-256 `0e8fa4914ac59a3233c363ced117c0ec82f0e1cae2f6be69d3510eadd494f329`；它对source flags使用实际SQL计数，没有从rowset hash对象推断flags。

摘要输入manifest `.data/fiscal-qa/pending-body-batch-20261024-b5/native-summary-manifest-b5.json` SHA-256 `4da13b6278e2e54d740e350b3c9055133e3967f45789f6db7ca71de971f5d9a5`；经A独立grounding侧车`.data/fiscal-qa/pending-body-batch-20261024-b5/native-summary-independent-grounding-qa-b5.json` SHA-256 `1cab39f036154a399251300cf49f405916705fa621adeb0c316928909c6d6ef4`确认20项哈希绑定及精确10 PASS/10 BLOCK。canonical QA文件`.data/fiscal-qa/pending-body-batch-20261024-b5/native-summary-qa-independent-b5.json` SHA-256 `750e1b1e88956a76ef3f3ecce5549acf7910e5878fe6f60d679e81e6fb0d6dba`，保留原draft输出并按既有工具合同由独立审阅者签核。

## b6 exact47摘要草稿（早期状态记录；最终以本文件顶部更新为准）

b6正文独立后验通过后，按原冻结输入manifest分为c1 30项、c2 17项生成native摘要草稿。c1 manifest/draft的SHA-256分别为`cc20b455458ee6f322e3facb2d6bc4f9fa18445ec48f28396fed9a5eb136874e`和`6928e2b318300536c4c2af95a30c4b16f576d234f88ee411f614aae37bdc3127`；c2分别为`32029b36f5d1fc5b1abd1d76fde512adfe450ad1d09dd93a5f61dcfb45710517`和`c374d7464a5d633c5dcf13a6c94671b1c10dd51c5cc89929aba5c23469e329fd`。冻结f4 importer副本`.data/fiscal-qa/pending-body-batch-20261024-b6/frozen-f4/nas-native-summary-import.ts` SHA-256为`f4c99df262fd7a194698a2f14d5412ec0b62adcf15d2862cd301ae858a18f70c`；生成与校验使用该历史副本及输入manifest内冻结的prompt版本，没有切换到后来拟议的CLI接口。

本机validator `.data/fiscal-qa/pending-body-batch-20261024-b6/native-summary-draft-validation-b6.json`由actual bytes计算并绑定两份manifest、两份draft、47项input/prompt/output hashes及f4 canonical结构校验；SHA-256为`ccae090eae579354bc3f6b32478e1cac36bc96919ceaa56b1a0d32f79dbd4015`。结果为47项、22 PASS/25 BLOCK/0 UNKNOWN，`independentGroundingQa=false`。这些PASS/BLOCK是草稿标签，不是独立审核结论；所有输出均`selected=false`、score/reason为null、receipt为null，未导入数据库，也未改Gold、分数或选择状态。请求路由元数据记为`gpt-6-luna high`；未调用runtime provider或worker。

A独立grounding QA已完成，sidecar `.data/fiscal-qa/pending-body-batch-20261024-b6/independent-summary-grounding-qa-b6.json` SHA-256为`7dc39b489b8e8c530b3fc59062901df94e101c0e809cdff04f7b9247332e8bc5`；结果为22 PASS/25 BLOCK/0 UNKNOWN，47个ID与草稿标签集合一致。Root已批准exact22 PASS，但要求先修正两项事实表述：`ixqqedjiiq3md8fp55q3i043i`标题改为“黑龙江监管局学习普通高中补助资金管理办法”；`neajwmxr5t35l3gk7316hh9mt`摘要把“22类典型问题”改为“4大类22条典型问题”。原始v1保留不覆盖；c1 v2路径为`.data/fiscal-qa/pending-body-batch-20261024-b6/native-summary-draft-b6-c1-v2.json`、SHA-256 `65809252cb0a979e7c7c0de5a262ac6e7234923652764822cdf726d267e479a2`；c2 v2与v1字节相同、SHA-256 `c374d7464a5d633c5dcf13a6c94671b1c10dd51c5cc89929aba5c23469e329fd`。程序化纠错/绑定验证sidecar SHA-256 `28200e529cee73752da8b4cdb2eae8ab0ebe557a7473b96e110db23ef00ba79a`，验证结果为47项decision仍22/25/0、f4 canonical结构30+17全过、非目标items字节级等同。A只需复核两处修正和hash绑定，尚未回传复核；当前未导入。

## b7 正文范围准备

截至本检查点，b7范围准备为38个目标、37个proposal和1个hold，仍处于prepared状态，尚未执行正文CAS或独立后验。pending分层计数尚待B提供，本交接不据此推算。Root批准的typed `--preflight-only` importer接口仍待实现和QA；b5/b6均使用frozen f4工具合同，未使用该新接口。

## 执行尝试与边界

导入前有两个本地只读preflight helper错误和一次Shell引号解析错误：初版错误读取`snapshot.rowsets.sources.enabled`字段；下一版返回变量未插入source SQL查询；之后一次ssh命令在bash解析时因嵌套引号失败。三次均未运行summary importer、未提交事务、未写业务数据或启动/停止服务。最终preflight用实际SQL字段重跑通过，canonical importer只执行一次并返回COMMITTED。此记录区分工具层失败和数据库结果，不将失败命令记为业务写入。

此阶段没有修改Gold200人审标签、fresh50预测/标签、分类、评分阈值、应用代码、数据库schema或来源配置；b6摘要草稿生成没有runtime provider调用或worker运行。另有selection-score仅供下一development candidate的规则文字变更，不用于fresh50，不影响已冻结的b6摘要输入/输出；其统一检查尚待B的CLI改动冻结。fresh50仍是已消费holdout。Gate 3保持`CHANGES_REQUIRED`；Gate 4/5总体仍未通过。此前Gate 5的64/64 row hashes、64/64 inventory和16/16 sequence state仅是restore子项，不构成Gate 5通过。应用运行SHA仍是d45 `d45f0d93f5374b7c72cdf0efb64ada6a03b84404`，Staging镜像digest `sha256:54d1a34f104b665ccdecc60e82f4cb67acf114fb3171b742990464ee6d4c7bc6`；不涉及本地fresh-preview。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：完成b5 exact10摘要导入与独立后验，并生成b6 exact47摘要草稿供独立grounding QA。
**MODEL**：b5使用此前冻结的native draft；b6生成请求路由记为`gpt-6-luna high`，但未调用runtime provider，receipt为null。
**FILES_CHANGED**：更新本交接；ignored b5/b6目录保存冻结manifest、草稿、validator及导入证据。评分提示词另有development-only候选改动，不用于fresh50或本次b6摘要。
**TESTS_RUN**：b5 exact-manifest preflight、一次canonical exact10 summary import、A独立fresh DB/LAN postQA通过；b6草稿以frozen f4 canonical validator完成绑定/结构校验。没有重跑应用full suite。
**RESULT**：b5 exact10和b6 exact22摘要COMMITTED并经独立DB/LAN后验；b6余25 BLOCK未写。b7正文37项独立后验PASS，摘要37项目前仅frozen f4只读输入已准备，尚无草稿。当前publication/override均86。
**RISKS**：b6 c1摘要已由事务提交14项，但CLI因结果输出路径错误没有原生回执；A通过直接只读数据库验证，无重试。fresh50已消费。
**BLOCKERS**：b7 exact37摘要待生成及独立grounding QA；Gate 3/4/5正式评审仍未通过；河北与福建两条历史Gold标签问题待用户确认。
**NEXT**：按已冻结的b7 30+7 f4输入生成native drafts，保持输入/输出/prompt hashes及receipt=null，交A独立grounding；未批准前不导入。不要重跑Gold评测或fresh50。
