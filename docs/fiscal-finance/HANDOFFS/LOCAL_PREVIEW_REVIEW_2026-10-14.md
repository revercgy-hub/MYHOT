# 正文复核与本地摘要预览交接（2026-10-14）

本阶段在隔离数据库继续处理正文，并把经事实审阅的无正文摘要放进已有本地编辑预览层。页面数据不是正式精选，也没有触发provider、模型worker、analysis或receipt流程。

## 当前状态

隔离库 `fiscalhot_catalog_sweep_20261013_test` 共442篇：344篇正文状态为 `ok`、76篇 `pending`、22篇 `unconfirmed`。本次六条短正文和一条Yunnan表格记录经逐条复核后使用现有内容修订、哈希和publication同步路径入库；旧修订保留。六条短正文事务结果为 [OP2 execution result](../../../.data/fiscal-qa/short-body-manual-review-20261014/evidence/v2/execution/op2-result.json)，SHA-256 `aa9d2f0e24ac18a8772ce08757fcb3269ce98f718d531f2d166fe7a96b9b8bdd`；独立只读QA通过，target、revision、哈希、publication与队列均匹配。Yunnan人工表格补录的独立QA报告在 [Yunnan QA](../../../.data/fiscal-qa/yunnan-manual-resolution-20261013/evidence/v2/independent-qa.json)，SHA-256 `54a4af7458c474f569e423d8f79ef8a56e4558f8a60af8087449dc9db95d400a`。

23条有界HTML正文批次中，11条正文解析通过、7条按source首次失败规则停止、5条未触达。失败原因包括附件待复核、身份不匹配、非正文容器和正文长度不足；没有重试。独立raw/SQL QA报告SHA-256 `e6eeb9971811f94f1b6e6825edc3857682a04a83af054de89a9eb4a66f1e8e1d`。区域监管局与深圳监管局的既有保存详情页各有一次离线positive replay，题名与日期匹配，正文分别1,525字与1,591字；未重复请求网络，也未将离线重放结果直接复制成数据库状态。

## Luna-assisted编辑摘要

20条已核正文记录绑定来源、URL、题名、发布日期、revision、content hash和正文SHA后完成事实审阅。1条关于既有规则学习的文章被标低价值并排除。其余19条安全导入：13条按原预览ID更新，6条新建；旧59条预览仍保留，当前总数65。导入以事务CAS检查既有seed归属和目标行身份，未知editorial fields保留，URL、原题名与日期不改。

所有19条都保持无正文、summary-only、unselected、score为null、non-indexable、non-syndicated；没有写入 `analyses`、`receipts`、selection或job状态。审阅记录说明“Luna-assisted agent review；实际模型执行未独立核验；非Human Gold”。这不是P4模型评估，也不构成来源准入。

冻结审阅文件 `.data/fiscal-qa/luna-agent-review-candidates-20261014/agent-review.json` SHA-256 `db82ad96e80a37335203377fe504bfbd4d2bb18c675f8346159e821b8e3f7bef`；独立内容QA SHA-256 `b339fef8948bcf7b6f0c95c0d7e42d80a5e1d284dc25b1de81c79520b85596bd`。导入plan SHA-256 `0466c6d0559182abff819f38dda469875aae3a4049e8cb0c8aaabf992aacff60`。执行结果 [AD-012 import](../../../.data/fiscal-qa/luna-agent-review-import-20261014/evidence/op2/execution-result.json) SHA-256 `b7a0d5998737cfa11519e09374ae7743ccaac73d9abb0f8cad4ad257aa6b9739`；独立DB QA SHA-256 `9c28aa4f614a41fcfdacbce932547fecd6a66c64d1b512006b1ab546a8ea2071`。一次未创建execution marker的OP1因frozen baseline file SHA pin typo而在写事务前拒绝；旧证据保留，OP2用独立baseline/marker完成，未重复覆盖或强制绕过CAS。

## 来源解析代码与验证

`mof-regional-supervision-dynamics` 的详情页题名现在从页面 `<title>` 读取；`mof-shenzhen-supervision-dynamics` 仅在显式 `titleAuthoritative=true` 时优先使用配置题名selector。正文严格身份校验仍在。定向来源/DOM身份测试26/26与typecheck通过。

PDF文本提取器现在拒绝只有页码/页脚的页面正文。`sweepUnprocessed` 增加可选精确文章ID范围，空范围为no-op。GitHub Check在代码HEAD `c2cc5427ea7c573faf9ed5444d013b34228de6c2` 成功，包含typecheck、web build/tests、迁移/种子、built-site smoke、backend tests及Docker smoke：[run 38489265042](https://github.com/revercgy-hub/MYHOT/actions/runs/38489265042)。

## 后续与限制

14-PDF bounded diagnostic只保存附件响应和解析，不自动清除文章hold。9篇固定候选（8篇GovCN和1篇会计司）manual-resolution proposal已通过独立QA：manifest SHA `435c3133c538aa1d5b8be6f337ea8af8ab2d6d1bff13392924496adc02a35776`，审计 SHA `d9cbd88691a7e676bc3424683ac072ef59c72dbcdd25a7dc036b39eec1b18b58`。包包含10份PDF解析，其中4篇GovCN正文太短，proposal保留严格通过的HTML通知段落和PDF全文为独立片段；截至本文写作时尚未写入文章。其余附件、PDF版面完整性与source级覆盖继续按逐条证据处理。

本地LAN刷新helper只新增、未执行。`-PreflightOnly` 在当前会话无法读取既有node PID的CIM命令行时会安全拒绝，helper不会停止无法确认归属的进程，也不会触碰Postgres或防火墙。服务固定build；未自动重启或绕过此前审核限制。跨设备访问待用户手动刷新并另行验证。

Gate状态、source enable/fulltext开关及正式选择流程均未改变。代码提交和采集数据分开维护；`.data/`中的raw、manifest、数据库快照和审计证据不进入Git。
