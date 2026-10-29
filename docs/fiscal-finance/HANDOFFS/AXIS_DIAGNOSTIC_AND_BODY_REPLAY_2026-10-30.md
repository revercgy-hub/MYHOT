# 2026-10-30 评分诊断与保存正文接续

## 结论

Gate 3–5仍未整体通过。新增开发隔离的五轴诊断工具，未更换正式评分输出、权重或60/65/76门槛。NAS额外13条正文已完成body-only CAS及另一代码路径的只读复核，公开内容不变。当前523文章/845修订/523发现，正文358 ok/156 pending/9 unconfirmed；35源有ok正文样本，不等于来源准入或90日覆盖。

## Gate 3：发现计算与输出格式不稳定

`scripts/fiscal/score-axis-diagnostic.mjs`从当前提示词读取全部八类权重，严格校验整数和每行总权重10；只校验内容类型、A/B/C、五轴及模型总分，用固定轴顺序复算。不含Gold、门槛、精选决定或解释输出，未接入生产分析链。软件测试使用本地数据，不调用模型。

另外进行了有界真实本地模型开发实验：qwen3.5:9b，固定digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`，loopback独立测试库，先1请求诊断，再5请求对照；串行、无自动重试，全部received，业务表0。请求仍经过既有receipt和本地gateway guard。修改的是诊断输出合同，不是正式评分；未提供人工标签、精选门槛或推理过程要求。

首次普惠金融稿五轴为4/5/6/8/7，模型59，实际加权60。五篇对照结果如下，不能把复算值当成正式双轮预测：

| 材料 | 诊断类型/重点 | 模型总分 | 复算总分 |
|---|---|---:|---:|
| 山西普通事务所检查 | regulatory_action / B |62|64|
| 台胞金融服务中心 | local_practice / A |75|76|
| 厦门普惠金融监管 | local_practice / B |45|52|
| 彩票市场调控资金办法 | regulatory_rule / A |83|85|
| 会计解释21号征求意见 | regulatory_rule / A |84|86|

五篇均存在算术偏差，且前两篇在改变输出格式后重新出现高分，普惠稿仍低分；此前scalar-only小样为5/6、7/6、6/6。证据同时指向计算错误、分类/打分不稳定及对输出格式敏感，不能归因为单一算术问题。现阶段不安装结构化评分替换，不调门槛，不将已知反馈小样充作新holdout。用户第9条工作价值追问仍待回复，不替用户补写理由。

私有结果：`.data/fiscal-qa/user1-axis-diagnostic-20261030/result.json` SHA `0f6c52e3b555894746fc1d72c33d8446ceb5663f0e84082cb0df879fe9ad0f0c`；五篇`user5-axis-diagnostic-20261030/result.json` SHA `686d592e0b859fafc84d4bf3096713e581d38b77caa949dcff455edea0b4fddb`。各库独立，不改变旧unknown回执。

## Gate 4：额外13条保存正文已应用

00:14只读样本盘点仍为523/832/523，48源中13源无ok正文（含2源无文章），与上一轮一致。盘点SHA `8f699727438a15830f1fe15da1794ce4ca93b81653ab393e79ce6b6ef4f4463f`。仅统计primary source，时间跨度不证明完整覆盖。

对全部169条空pending使用冻结legacy inventory和canonical catalog离线重放：99条无合格相同响应组、39条HOLD、31条正文候选；externalRequests0、databaseWrites0。原诊断SHA `b32f03fe3e74b2da3542a2a7d7f0b95cc6ab3c4013fcc8819037094569096de9`。每个重复响应组的manifest/raw长度与SHA均复核。

首个受限候选选16条；prepare第一次缺`AIHOT_APP_ROOT=/app`，修正环境后又被PBOC数据库config与canonical不一致的保护拒绝。两次均在准备阶段、数据库写入前失败，r1保留。没有放宽guard或更新来源config。新r2用实际source config/kind与canonical逐项比较，仅选13条：北京7、贵州/湖南/辽宁/宁夏/天津/新疆各1。其余156条pending全部保留完整rowText并后验逐行验证，不仅验证附件HOLD。

NAS `/data/operators/canonical-body-application-20261030-r2`：

- diagnostic SHA `0b66d38a14a01612931c2bec53cbba14999a72386b404185dc807ab83e23e410`；driver SHA `00282b879bc05fff52eb105422188fdca1b19ebbb739c5fb99d46f2699a957e4`。
- plan SHA `d57a41730e9e080f607508237f3990347dc4d4dd56cde43784a4beee8c7f0dd5`。沿用内部runId `canonical_html_body_20261030_r1`，实际目录和证据批次为r2，不能据runId推断r1曾写入。
- fresh PG17 dump 2,158,932 bytes，SHA `c1a1bffb858325526cba1d635c2320ddad425d540e31cb3ddcca0db3cde80543`，proof SHA `3667c866d0627145b195032d7e6ec123fbb2d033756de1fbe5011897c693ad43`；绑定plan及所有snapshot rowsets，pg_restore17.11检查通过。
- preflight写0；共享flock内一次execute，13条COMMITTED，各revision1→2。postcheck13匹配、156保留行原样、全部protected rowsets无差异。
- 另一只读SQL实现将目标文章投影回冻结原行、去掉恰好13条新修订，复原全表hash匹配；其余22个rowsets逐项匹配。QA SHA `108842d29af22f948472e9d1e10221e5cf0a382c52e02e583a44690bd1bd8f57`，allPass=true。是同一agent的另一实现，不声称独立人工审查。
- 完整证据归档2,558,053 bytes，SHA `2e93e3293c8989d25c9fc6182839be6f61592b009708a909d10cb723a5816012`，NAS容器/host和本机镜像一致。

当前publication/override137/137、receipts/attempts9/9、Gold200、全部source flags0；API未重启，LAN smoke全部通过。未增加精选或发布。剩余候选中的央行config漂移、云南PDF能力与陕西bodyPolicies不在当前纯HTML CAS范围；需独立整改和回归，不能把离线READY直接当作CAS准入。

## Gate 5与检查

00:10只读核验：backup01:00、understand02:00、summary03:30的cron及既有hash仍在，实际计划时间未到，日志没有新成功证据，不提前验收。未来真实运行与多个周期仍待核验。

新增工具测试3/3，Node24 typecheck、Web build和Web25/25通过。首次全量回归因调用进程显式设置`MODEL_CALLS_ENABLED=false`而拦住测试本地stub，失败记录保留；按现有CI测试方式，在另一个全新loopback专库、无真实凭据、推送和采集关闭条件重跑：567项560通过/7条件跳过/0失败。未改变业务运行开关。LAN post-CAS smoke全部通过。

下一步先取得第9条业务取舍依据，再在development材料验证评分方案；准备新事件隔离样本用于最终独立验收。并行整改剩余正文/来源配置漂移与90日分页覆盖，待真实计划触发后检查备份、理解、摘要及恢复证据；这些子项均不能由CI或单次smoke代替。
