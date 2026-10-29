# 2026-10-29 保存响应正文应用与评分整改接续

用户“继续”授权接续三个错判、长文处理和15条正文候选。当前Staging仍API ee9 image/restartCount0；本轮不改source flags、canonical catalog、Gold或publication。

## 新增批次级metadata机制

`nas-pending-body-batch.ts`新增可选`reviewedMetadataSourceIds` manifest字段。只接受福建监管局、厦门监管局两个既有disabled/fulltext-off来源；原始数据库config仍须与canonical catalog一致。字段进入manifest字节hash与后续proposal/backup审批绑定。

字段只在保存响应重放和正文CAS快照检查时生成内存metadata候选：福建补可见标题selector，厦门补标题与日期提取。正文、附件和URL规则保留，source数据库行及全站catalog不变。未带字段的旧流程保持原行为；fresh capture并不自动继承这个scope。新测试证明默认拒绝/显式通过、来源不变、无关/重复/启用/全文/配置篡改拒绝，以及同份保存HTML在未opt-in时保留HOLD。

该方式修订前轮“先同步全站source/catalog”的应用顺序：这次只批准有界保存响应提取，不声称canonical source metadata已部署或未来collector已自动修复。

## 准备与保护

原19份保存响应及全部duplicate组的raw/manifest bytes/hash再次验证；适配复用既有legacy adapter，network cadence仍UNPROVEN_HISTORICAL_CADENCE，不新增官方HTTP。

首次r1只读准备因福建缺metadata范围被拒，未写数据库；r2因会计司附件来源不属于direct-HTML scope而拒绝，未扩附件权限。最终r3只把15条原合格正文列为写目标，另外4条HOLD以完整native row text单独保留。所有文章/修订及21类受保护关系的baseline仍进入快照。

- NAS路径：`/data/operators/reviewed-body-application-20261029-r3`。
- driver SHA `ddfeafae9198a530db02b2d8079c5d2417b538ba911b6ddf4ffe9c0c86abe513`；全部34个初始runtime/input/evidence文件逐次读回校验。
- reviewed plan SHA `ab97fae0f5c3253e8b2d0c496fb09fa4b6bfdc0a3f2a6e778d2013d639f328af`。
- fresh snapshot：48 sources、523 articles/817 revisions/523 discoveries；publications/overrides137/137、receipts/attempts9/9、Gold cases200，pgboss jobs0。15 READY write targets、4 retained HOLD。
- 第一份备份因shell引号错误生成0字节，PG17 restore-list拒绝；没有proof或写入资格，空文件原样保留。改用传递完整shell脚本重新备份，避免跨shell引号问题。
- 有效PG17.11 dump为2,119,326 bytes，SHA `78f5822979a9c0124b7c44f749005ba683666fbb69cf4f3dab02581757c8f661`；proof SHA `ea895229531ca595101999814ad9a6c4edfbac459c0994d7dfd0d74a30a9b5be`，mode600，`pg_restore --list`校验通过，绑定plan SHA及snapshot rowsets。
- 共享flock下的完整source/rowset/Gold/目标行预检`PREFLIGHT_NO_WRITES`通过。执行/后验状态另追加，不把预检记作已回写。

## Gate 3接续

根据上一轮实际FP（普通事务所检查、台胞银行服务中心）和FN（财政贴息/创业担保监管主线），评分提示词补充按全文核心动作判断A/B/C，防止将证券服务资质、再贷款等孤立词汇当作重点；补充reson评分锚点和可直接使用的财政金融监管要素对act的含义。锚点是本轮开发归纳，不是用户逐字给出的数字；原五轴、八种类型、权重及门槛60/65/76不变。

新的五篇development诊断在全新`fiscalhot_user5_phase2_20261029_test`运行，最多15次本地qwen3.5:9b请求、串行、无自动retry，和上轮25次及unknown receipt分别记录。选择三个错判、彩票资金管理正例及清理PDF坐标后的会计解释材料；原始正文hash保留。不是独立holdout，不能宣称泛化质量。

18:00 collector已真实触发：46源45成功1失败、新增6、详情5；不能把COMPLETE日志解释为所有来源成功。API容器未重启。source/全文/精选和Gate结论保持原边界。

## 检查

本轮focused32项31通过/1专库条件skip、Node24.16 typecheck通过。完整CI及实际模型、CAS结果将在完成后补充。
