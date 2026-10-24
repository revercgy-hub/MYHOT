# 2026-10-24 b5/b6 正文与 b5 摘要交接

## 当前结果

b5 的20项正文批次与b6的47项正文批次均已提交，并有独立只读数据库后验。b6后验快照为418篇文章、576条revision、418条discovery；正文状态158 `ok`、254 `pending`、6 `unconfirmed`；48个来源保持disabled且全文/转发关闭；publication/override各54；Gold200 hash保持`fbd469d962cbdf123953ec4236cdd1a53b8c6beeb62a7be24214e47bb7da4076`。b6后验快照是b5摘要导入前的精确保护基线，不是导入后的状态证明。

等待b6正文独立后验通过后，按Root批准的b5原始manifest和QA sidecar，canonical `nas-native-summary-import.ts`只导入独立grounding确认的10个PASS摘要；另10个BLOCK由导入器排除。执行回执为`NATIVE_SUMMARY_IMPORT_COMMITTED`，数据库为`fiscalhot_staging`，`imported=10`，执行时间`2026-10-24T03:03:06.622Z`。本地原件`.data/fiscal-qa/pending-body-batch-20261024-b5/summary-apply-result-b5.json` SHA-256为`8a2c99bb06a1504ac9f8fb1694f7149a0cf501b599d71961af09e6f1ac410112`；NAS私有原件位于`/data/operators/pending-body-batch-b5-20261024/runtime-root/.data/fiscal-qa/pending-body-batch-20261024-b5/summary-apply-result-b5.json`。控制台日志SHA-256为`6a651c2bbcc5a074b79d4b531d520a17e9829ccf220296fe622a067ef96fe141`。

canonical importer按摘要合同写入动态候选项；这不等于自动精选。所导入摘要的`selected=false`、score/reason保持null，并按summary-only模式关闭全文、索引和syndication。没有将Gold标签、预测分数或holdout信息用于摘要输入或导入。A独立后验已通过：数据库sidecar `.data/fiscal-qa/pending-body-batch-20261024-b5/summary-independent-db-postqa-b5.json` SHA-256 `bf31d4e375e9cf676d35fdb87360eee41c0055c433e1d4bbcb5443b3aa1ea7bd`；LAN sidecar `summary-independent-public-lan-postqa-b5.json` SHA-256 `3772fff9e23eb4895b1134cc9dde92514fe3f64d512635b136a07990749d4ca9`。实测10/10 target的输出/provenance/body/source/revision哈希匹配，只有这10项产生override/publication；保护rowset drift=0，当前publication/override均64，articles/revisions/discoveries为418/576/418，body为158/254/6，48来源flags全0，Gold200 count/hash不变。公开检查确认pool中的64条、10条新摘要详情API与网页、RSS/robots均符合预期、noindex保留且匿名`/api/admin/review-batches`为401。

## b5/b6 正文后验与导入前保护

b5 exact20正文目标提交后，独立后验记录为`.data/fiscal-qa/pending-body-batch-20261024-b5/execution-postcheck-b5-nas.json`，SHA-256 `0337440f96efbb05c07dc0b8a8461c408c09b9a8bf01047e73a84b8cf66bfc3f`。随后b6 exact47正文批次提交，并经独立直接只读数据库复核通过：47个proposal目标与当前revision 2逐项一致，3个hold仍为原pending/revision 1，0 mismatch；22个受保护rowset无变化。独立QA sidecar为`.data/fiscal-qa/pending-body-batch-20261024-b6/independent-body-postqa-b5-b6.json`，SHA-256 `4d9d5c9862ad67968f93315eb592bd34e0fb31ba83b9ccc796965d3495b2cdf8`。b6执行方postcheck为`.data/fiscal-qa/pending-body-batch-20261024-b6/execution-postcheck-b6.json`，SHA-256 `fc058873cbacd7f56813c6a2af97e9729d6881cee7e8c29a751d1ea820352f0b`，captured at `2026-10-24T02:51:56.087Z`，rowsets SHA-256 `59d33c430cc111f3c33a1fa433f33f9ea038c9da4cbfa9eacf5521c41ffccce3`。A在`2026-10-24T02:53:52.407Z`的独立RR/RO读取与该快照hash一致。

b5摘要导入前的只读preflight于`2026-10-24T03:02:17.436Z`通过，且当前rowsets hash与b6基线一致；20/20摘要目标按原manifest重新prepare后仍逐项匹配。SQL直接核实sources共48、enabled=0、site_fulltext=0、syndicate_fulltext=0；文章/revision/discovery为418/576/418，正文状态158/254/6，publication/override为54/54，analysis/receipt/job_runs为0，Gold200 hash保持上述值。preflight原件`.data/fiscal-qa/pending-body-batch-20261024-b5/summary-preflight-b5-after-b6.json` SHA-256 `00a2945ad6cb44f9c07b6dc1e7d30c9926acb4b6e8690b10995896ac4480e3a7`。只读helper SHA-256 `0e8fa4914ac59a3233c363ced117c0ec82f0e1cae2f6be69d3510eadd494f329`；它对source flags使用实际SQL计数，没有从rowset hash对象推断flags。

摘要输入manifest `.data/fiscal-qa/pending-body-batch-20261024-b5/native-summary-manifest-b5.json` SHA-256 `4da13b6278e2e54d740e350b3c9055133e3967f45789f6db7ca71de971f5d9a5`；经A独立grounding侧车`.data/fiscal-qa/pending-body-batch-20261024-b5/native-summary-independent-grounding-qa-b5.json` SHA-256 `1cab39f036154a399251300cf49f405916705fa621adeb0c316928909c6d6ef4`确认20项哈希绑定及精确10 PASS/10 BLOCK。canonical QA文件`.data/fiscal-qa/pending-body-batch-20261024-b5/native-summary-qa-independent-b5.json` SHA-256 `750e1b1e88956a76ef3f3ecce5549acf7910e5878fe6f60d679e81e6fb0d6dba`，保留原draft输出并按既有工具合同由独立审阅者签核。

## 执行尝试与边界

导入前有两个本地只读preflight helper错误和一次Shell引号解析错误：初版错误读取`snapshot.rowsets.sources.enabled`字段；下一版返回变量未插入source SQL查询；之后一次ssh命令在bash解析时因嵌套引号失败。三次均未运行summary importer、未提交事务、未写业务数据或启动/停止服务。最终preflight用实际SQL字段重跑通过，canonical importer只执行一次并返回COMMITTED。此记录区分工具层失败和数据库结果，不将失败命令记为业务写入。

此阶段没有修改Gold200人审标签、fresh50预测/标签、提示词、分类、评分阈值、应用代码、数据库schema或来源配置；没有调用provider或运行worker。fresh50仍是已消费holdout。Gate 3保持`CHANGES_REQUIRED`；Gate 4/5总体仍未通过。此前Gate 5的64/64 row hashes、64/64 inventory和16/16 sequence state仅是restore子项，不构成Gate 5通过。应用运行SHA仍是d45 `d45f0d93f5374b7c72cdf0efb64ada6a03b84404`，Staging镜像digest `sha256:54d1a34f104b665ccdecc60e82f4cb67acf114fb3171b742990464ee6d4c7bc6`；不涉及本地fresh-preview。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：按批准的b5 exact10 summary QA子集使用canonical importer提交摘要，并保留b5/b6与摘要写入前的证据链。
**MODEL**：本阶段未执行新模型/provider调用；使用此前冻结的native摘要draft和独立人工grounding QA。
**FILES_CHANGED**：新增本交接；本地ignored `.data/fiscal-qa/pending-body-batch-20261024-b5/` 保存preflight、脚本、apply原件与控制台日志。业务源码、Gold、prompt和schema未改。
**TESTS_RUN**：实际运行只读exact-manifest preflight并通过；canonical summary importer一次提交10项；A独立fresh DB/LAN postQA通过。当前无源码变更，未重跑full suite。
**RESULT**：b5正文20、b6正文47均已commit并由独立QA通过；b5摘要精确10项COMMITTED、10项BLOCK排除。导入前body计数与保护rowsets已与b6 postcheck逐项匹配。
**RISKS**：b5 exact10后验完整通过；b6 exact47摘要目前仅有只读manifest和validator，没有生成摘要、grounding或发布，不得按body提交推断summary完成。
**BLOCKERS**：Gate 3/4/5正式评审仍未通过；河北与福建两条历史Gold标签问题待用户确认。
**NEXT**：使用冻结的b6 c1/c2 manifest与其生成时冻结的f4工具、既有prompt版本准备47项native草稿，交A独立grounding后再按Root授权决定是否导入；fresh50不再称为未见holdout，也不用于调参。
