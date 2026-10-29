# Gate 3–5整改与证据（2026-10-29）

本轮依据用户“根据gate3 4 5继续开发。努力通过”推进。验收仍以任务书§32、§33、§35为准，不降低条件或新增虚构分数线。本轮没有公开发布、修改Gold标签、改变评分门槛或启用全局worker。

## Gate 3：开发集错例与门槛比较

新增离线工具`scripts/fiscal/calibration-review.mjs`，对既有development evaluation重算混淆矩阵、分层错例和每个threshold的计数；拒绝holdout、重复case和不一致数据。输出标记人工签收未完成，不自动选择门槛。

本轮只读取10/26 e82e development150、Gold v2的既有评测，没有重新预测，没有读取fresh50。

| T1开发集候选门槛 | TP | FP | FN | TN | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|
| 60（当前） |16|27|8|99|37.21%|66.67%|
| 66 |9|16|15|110|36.00%|37.50%|
| 70 |7|9|17|117|43.75%|29.17%|
| 76 |2|6|22|120|25.00%|8.33%|
| 80 |1|1|23|125|50.00%|4.17%|

错误共35条（27 FP、8 FN），私有审阅包`.data/fiscal-qa/gate3-development-review-20261029.json`已生成。分层情况：地方监管业务4 TP/15 FP/0 FN/31 TN；金融债务6/10/2/25；政策与机构更新6/2/6/13；内部活动噪声0/0/0/30。层名称是原采样分层，不是对每条错误的因果归因。下一步要按原文审阅35条，区分普通业务介绍与重点工作，核对少数人审偏好与现有提示词是否一致，形成候选规则后仅在development复测。不能靠提高门槛同时解决这些错例。

**结论：CHANGES_REQUIRED。** T1/T1.5/T2保持60/65/76，T1开发结果不能证明T1.5/T2适用性。新独立效果验证仍需事件不重叠样本及预测先于人审的冻结链；旧fresh50不得重复充当未见留出集。

## Gate 4：集成检查与来源质量

最新本地源码类型检查通过；Web build及25项Web tests通过。NAS当前既有API/Web的`smoke.ts`30/30通过，覆盖页面、RSS/API和MCP initialize。两者版本范围不同：当前本地源码不等于ee9 API镜像，不能把NAS smoke说成验证最新完整应用镜像。

NAS只读来源快照`.data/fiscal-qa/gate4-source-quality-20261029.json`确认48来源、517文章、325正文ok/183 pending/9 unconfirmed。32个来源至少有一篇ok正文，16个来源没有ok正文，2源没有文章。此为数据库快照，不是来源准入或90日完整性证明。

正文优先队列：福建监管局13 pending、厦门监管局13、会计司10，以及政府网等核心源；公开市场20 pending按既有用户偏好属于全部动态需求，不通过日常公告凑精选。先复用已保存响应，逐篇验证身份/日期/附件，再按既有有界抓取与backup/CAS流程补缺。扫描附件仍按既有OCR延期决定处理。最早/最晚日期不等于期间无缺页，不据数据库日期跨度声称90日覆盖。

**结论：软件与出口检查子项通过，来源质量、历史覆盖及完整功能验收仍开放。Gate 4未整体通过。** 报告/事件聚类的实际内容质量、后台认证后的操作验收不能用空页面HTTP200代替。

## Gate 5：已修复02:00任务的启动缺陷

已定位确定缺陷：entrypoint设置`OLLAMA_UNDERSTAND_NETWORK_ANCHOR_API_IMAGE_SHA256`，但wrapper的最小子进程环境丢弃它；launcher随即拒绝`NETWORK_ANCHOR_PIN_HASH_INVALID`。stdout/stderr被忽略，所以旧state仅显示泛化的launcher失败。10/29 02:00失败仍保留，不改记成功。

修复使子进程只额外继承经过64位hex验证的anchor文件SHA，统一小写；真实密钥、DATABASE_URL和NODE_OPTIONS仍不继承。新增回归验证传递、缺失/非法值拒绝及敏感环境隔离。

NAS已安装独立r2 wrapper，原228文件源码与输入不变：

- wrapper：`/vol2/1000/docker/fiscalhot-understand-nightly/tools/ollama-understand-nightly-r2.mjs`，SHA `B6A3EFCA99199E7B97104E0D31C5287B958084DF1E1E2A22FC6665E16BF42A11`。
- 新entrypoint SHA `eb7821cee54d07790ab52dc61f077a0f197badab2f7b3fef19f9ad23750ca67c`，cron SHA `fb1187ef5a3180fb3d75f8112ae3655bb23e66c61a1739257308d93b437519ba`。cron只替换原02:00 job的entrypoint hash。
- 新state路径为`state/ollama-understand-nightly-r2.state.json`；旧失败state保留，终态不重置。部署在15点之后，旧夜窗已关闭，没有白天模型重跑。
- 新wrapper对NAS上228文件验证成功，新code manifest SHA `205091ABD95D9E52077C447C0AC1AA10D8F610E25B5E7CAAADEB0AB07110B7EC`。实际最小环境包含正确anchor pin。flock+entrypoint返回`NOOP_OUTSIDE_WINDOW`，新state未创建，model calls0。这不是夜间模型成功。
- 回退材料保留在NAS `backups/nightly-entrypoint.pre-env-repair-20261029.sh`及`backups/cron.pre-env-repair-20261029.txt`。r2 wrapper为独立运维修复，不覆盖旧source wrapper；未来整体重装需保留/纳入该修复和新state路径，避免恢复旧终态配置。

新增`trial-collector-review.mjs`核对source/counter/dispatch账目，把含失败源的完成任务明确标记为`PARTIAL_SOURCE_FAILURE`。实际复核12:00任务：46源45成功1失败（河北列表timeout）、7新增、6详情、52dispatch、provider0。51份raw hash已在前轮逐一校验。单次部分完成不代表稳定运行。

**结论：运行链缺陷已修复，Gate 5尚未通过。** 仍需10/29 18:00采集，10/30 01:00真实计划备份、02:00理解、03:30摘要生成及逐篇人工审阅，多周期稳定性、错误恢复、worker/聚类/日报端到端验收。旧backup/restore证据仅作为已完成子项保留。

## 检查记录

专项22项：21通过、1跳过（私有旧228 artifact的本地positive验证未配置；NAS对实际228文件另已通过）。新增两个离线工具各有正负例，拒绝留出集、重复/计数不一致、预算越界和未完成结果。typecheck通过，Web build与Web25/25，NAS smoke30/30。fresh `fiscalhot_gates_20261029_test`迁移36项，完整TypeScript回归540项中534通过/6跳过/0失败，测试后55438集群已停止。日志`.data/fiscal-qa/gates-full-tests-20261029.log`。本轮同时将`.test.mjs`加入默认npm test发现范围，避免两个新工具及原backup测试仅在手工专项运行。

全部`.test.mjs`另跑14/14通过，日志`.data/fiscal-qa/gates-mjs-tests-20261029.log`。完整TypeScript与mjs测试分别运行，未声称在一次进程里验证新package命令的联合运行。
