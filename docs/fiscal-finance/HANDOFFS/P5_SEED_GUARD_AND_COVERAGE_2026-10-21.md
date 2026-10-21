# P5 seed guard 与分页来源观察（2026-10-21）

## 结果边界

本轮完成离线P5 seed检查、batch-04人标记录、150条metadata DRAFT提案，以及厦门/PBOC有限列表观察。没有升级Gold、coverage或任何Gate。用户提供的batch-04回复“16不，17-20可以”只映射为16 reject、17–20 select；20条人标现为13 select、7 reject，80条仍pending。既有15条seed保持不变，新增50条提案不自动加入seed、event group或split。

seed validator要求显式`--seed-case-ids <json-string-array>`；无seed传`[]`。遗漏、重复、空白、未知ID或holdout泄漏失败关闭。程序API旧调用会显示`seedCheck.status=not_run`并保持DRAFT，不可冒充ready。实现只改变离线验证行为与测试，不改变标签、split或阈值。对旧100条清单的固定15-seed rehearsal为`DRAFT_INCOMPLETE`、15 checked、0 seed issues；rehearsal时的输入manifest SHA为`3918ec45f0d28ff451c44b60159ecb0233db79c398e949781ace64b4642a7189`，seed SHA为`f2b3272c3bfd774dba2dc8761fe1737f066d56e1561a9ef0b3cc4e7e3d4f33d5`。批次04后的tracked 100条manifest SHA为`96c2e0914e08e22080cf91e05a6c4f419533356459406d262f81dd19ff6e2051`。

Ignored目录中的150条DRAFT proposal以tracked 100条为前缀逐项deep-equal，只追加50条新候选，不改变tracked manifest指针。独立QA确认新增50篇正文/current revision/title/date/hash关联与快照一致，body文件哈希全部匹配；50条均待人工审阅、decision/proposal为空、event group/split未确认。按本次最终严格谓词，509行源读取经筛选为323个跨库唯一合格候选，最终按噪声10、债券12、政策12、区域监管业务16抽取50；28个来源均为T1，每源至多2条。候选提案SHA `f22fa8b25da6a281d320aa4febc1cfb2dd599ff41fa37be1ca73bcce118f7af7`，源快照SHA `a16a53a8c8f3d585eb95bff883696080c66615e642d9f499901529a373b6ece0`，选择报告SHA `dabfff59331d0ba7c6fbf8384e54e430d8dbcadd23a4cb98d5807bc75e3c5683`。早期296候选池属于不同筛选阶段，不与本报告的323混算。150条提案仍非Gold、非评测集，不能据此声称任务书Gold已经达标。

规模条件区分如下：任务书§32对Gold材料的硬目标为150–200条；`docs/selection.md`中的100–200是说明性建议。Gate 3没有规定development和holdout各自的数值下限或独立质量分数线；仍需完成人工标签、事件组及隔离切分、两集评测、错例审阅和阈值确认。现有150条metadata草案并未满足这些验收条件。

## 有界来源观察

厦门page-set campaign只向冻结的`index.htm`发出1次GET，20秒超时，无status/body/raw/EOF；page1–9均未请求，没有重试、数据库、cursor或provider副作用。manifest SHA `f9aae3681af06b239148368e1744c0748a60eb911340888cb879bb6ed726ce9e`。这是网络超时和停源记录，不是10页抓取完成，也不支持coverage通过。

PBOC第一次观察保存page1（当前分页192页/3824条，与早期保存的191/3812不同），据真实next链接发出独立page2–5 campaign。该campaign仅发出page2一个GET：HTTP 200、EOF、40,435 bytes、raw SHA `9ab13dffca777d2b6bc819041fc024a8793f2d0026ca895a6653af01168c5f23`。随后因runner把absolute URL与path-only prefix比较而错误停源；独立重放确认20个链接均在同origin和prefix内。page3–5当次未请求，旧campaign保留并标记`RUNNER_DEFECT`，不覆写、不重试。

修复只把candidate边界验证改为URL pathname与配置path prefix比较，并离线重放page1/2共40个保存候选及5种拒绝fixture。新独立page3–5 scope绑定page1/page2 manifest及raw hash、page2实际DOM next、192/3824 pager，限制3次串行GET、至少1100ms间隔、无redirect/retry、首错停源；所有进程安全开关显式false，禁止数据库、详情、附件、provider、worker、API/Web副作用。campaign实际3次请求均HTTP 200、精确URL、EOF；page3/4/5 raw各40,435 bytes，SHA分别为`f3111adeff7d568ce094a8764d3a6eef5f4ac437fb18f46b3fc8772b8e9a62da`、`2c5d0c083aee1e3f5dbf4cb4f0a9865200299d58d6b930b18c75457117f180ae`、`ea5ef7100ae95db3b52fbc2034b08e5eba8bd268630a57f1e97138c384597ed6`。间隔1119ms、1101ms。每页20候选、pager保持192/3824、下一页顺序正确；page6链接只观察未请求。page1–5合计100个URL互异，其中63个显示日期在2026-07-23至2026-10-21窗口内；观测日期范围2026-06-02至2026-10-21。该有限观察不代表完整90日覆盖或Gate 4通过。执行manifest SHA `378c75bf9ac9f4e01f0dfc5ef5fcea03d46f6263a55e8633f42441894398df5e`。

## 软件检查与运行状态

本轮tracked代码tested SHA仍以Git提交后的版本为准；旧CI run 39530549243仅覆盖旧代码SHA `6159de76f55601dcdcfd640d00d74e2a085afc08`，不代表本轮新代码已通过CI。当前seed guard代码在隔离fresh DB `fiscalhot_p5_seed_validator_retry_20261021_test`上完成35 migrations；backend suite 418 pass、0 fail、1 skipped，`npm run typecheck`、Web build和Web tests 17/17通过。mock测试进程显式启用测试内mock route，但清除了provider credentials/base URL及proxy变量，没有真实provider调用。第一次`MODEL_CALLS_ENABLED=false`运行的mock gate失败保留为无效测试配置记录；Web并行build/test的初次race也由build结束后串行17/17重跑通过。旧CI结果不覆盖当前源码。

本轮未由QA启动API、Web或worker，也未做实时页面smoke。此前只读观察未见3000/3001 listener；用户承诺手动启动API/Web并告知后，再依据真实运行态做只读验证。历史PBOC/Xiamen数据和DRAFT产物全部在`.data/`忽略目录，不入Git。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：独立QA seed guard、人标与P5候选提案；复核有界列表观察；更新交接与Gate状态记录。

**MODEL**：GPT-6 Luna / high。模型只用于离线候选辅助整理，无项目provider调用；本轮native建议不是Gold或receipt。

**FILES_CHANGED**：离线seed validator及focused tests；100候选manifest中的batch-04人工标签；P5 readiness、STATUS、PROJECT_PLAN与本交接。原文、正文文件、seed文件及网络raw均留在ignored `.data/`。

**TESTS_RUN**：fresh 35-migration backend 418 passed、0 failed、1 skipped；typecheck通过；Web build通过；Web tests 17/17。另有seed rehearsal、150 proposal独立哈希/关联校验；PBOC runner node check、offline 40 URL/5负例校验及page3–5 post-QA。未重跑CI；未运行实时API/Web smoke。

**RESULT**：seed guard防止无seed检查被误报ready；batch-04计20 human confirmed（13/7）、80 pending。150条是DRAFT proposal。PBOC有界观察100个唯一列表候选、63个落在90日窗；厦门campaign 1 GET超时停源。Gate 3/4/5均未通过，Gate 2边界不变。

**RISKS**：PBOC page2旧campaign暴露已修复的runner comparator defect；保留旧证据，不把它当源失败或campaign PASS。PBOC观察不证明完整覆盖；Xiamen后续页无证据。150条提案未人工标注，且全部来源为T1。

**BLOCKERS**：仍缺逐条Gold决定、event group/split确认及Gate 3评测；Gate 4仍缺来源准入和90日覆盖证据；Gate 5仍缺NAS staging实际验收。API/Web live smoke待用户手动启动并告知。

**NEXT**：保持DRAFT与现有15 seed隔离；按真实page2 runner defect记录继续处理而不重试旧scope；待用户提供运行态后做loopback/LAN页面只读检查；继续Gate 3–5正式证据，不升级状态。
