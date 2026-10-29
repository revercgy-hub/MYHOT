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
- 共享flock下的完整source/rowset/Gold/目标行预检`PREFLIGHT_NO_WRITES`通过。CI通过后按上述精确plan SHA执行一次COMMITTED，15条均revision1→2；后验15/15正文/HTML/hash/revision一致，4条HOLD完整native行未变，受保护rowsets差异0。

另外使用不同实现的READ ONLY SQL复核：将当前目标行恢复投影为冻结的原native文本后，整个articles rowset hash等于写前；从当前revisions剔除恰好15个新增revision2后，完整旧revisions hash等于写前。验证了全部非目标文章/旧修订未变，15个新修订与方案逐字一致，22项其它rowsets与4个HOLD均未变。该复核由同一agent另写SQL完成，不声称独立人工审查。sidecar SHA `06dac25c7db9a465e052d5a4d91bcfbbe0bb074d63c572165466f2bb11a6d536`。

当前523 articles/832 revisions/523 discoveries，body345 ok/169 pending/9 unconfirmed；有ok正文样本的source数32→35，但不代表35源准入或90日覆盖。publication/override137/137、Gold cases200、receipts/attempts9/9、selected0不变。API未重启，LAN smoke30/30通过。

完整runtime/evidence/plan/backup/execute/postcheck归档为NAS `/data/operators/reviewed-body-application-20261029-r3-evidence.tar.gz`，2,529,197 bytes，SHA `f0958b89f4e798f748f53468857730436e4dd8a419c9f76599ccac775bcf7988`。已镜像到本机同名`.data/fiscal-qa`文件，hash一致。

## Gate 3接续

根据上一轮实际FP（普通事务所检查、台胞银行服务中心）和FN（财政贴息/创业担保监管主线），评分提示词补充按全文核心动作判断A/B/C，防止将证券服务资质、再贷款等孤立词汇当作重点；补充reson评分锚点和可直接使用的财政金融监管要素对act的含义。锚点是本轮开发归纳，不是用户逐字给出的数字；原五轴、八种类型、权重及门槛60/65/76不变。

新的五篇development诊断在全新`fiscalhot_user5_phase2_20261029_test`运行，最多15次本地qwen3.5:9b请求、串行、无自动retry，和上轮25次及unknown receipt分别记录。选择三个错判、彩票资金管理正例及清理PDF坐标后的会计解释材料；原始正文hash保留。不是独立holdout，不能宣称泛化质量。

实际五篇全部完成，15 request/15 received，无重试、failed/unknown0。业务sources/articles/analyses/publications/fetch_runs/job_runs全0，仅独立测试库回执变化，测试集群已停止。旧测试库的unknown receipt原样保留，本次是在代码/提示词和长文渲染已改变后的新实验，不回填旧失败为成功。

| 材料 | 两轮分数 | 本轮判断 | 用户决定 |
|---|---|---|---|
| 山西事务所检查 |5/6|不精选|不精选|
| 台胞金融服务中心 |7/6|不精选|不精选|
| 厦门普惠金融监管 |6/6|不精选|精选|
| 彩票资金管理办法 |87/82|精选|精选|
| 会计解释第21号征求意见 |85/85|精选|精选|

4/5与已知反馈一致，仍漏选厦门普惠金融稿；对地方稿分数明显压低，不能凭两个FP消失就确认评分标准校准完成。长文首次完整走通预筛和双评分，但单次成功不能证明稳定性或单独归因全部来自坐标清理。根目录私有产物`.data/fiscal-qa/user5-phase2-regression-20261029`，保留输入、模型digest、prompt版本和完整回执状态。用户已被询问第9条的主要工作价值，以明确条线优先与方法可复用之间的取舍，等待答复。

18:00 collector已真实触发：46源45成功1失败（湖南列表timeout）、新增6、详情5；51次dispatch、50份完整raw字节数/SHA复核通过、1次timeout无response、provider0。result SHA `9a743dd7c1f7ba1979e1617436fbcac20951633643a6c8d0c206d4eb91193c53`。不能把COMPLETE日志解释为所有来源成功；12:00失败的是河北，本轮没有重试它们。API容器未重启。source/全文/精选和Gate结论保持原边界。

## 检查

本轮focused32项31通过/1专库条件skip、Node24.16 typecheck通过。1dc3a36代码的[Check40867625196](https://github.com/revercgy-hub/MYHOT/actions/runs/40867625196) check及docker均成功：563项555通过/8跳过/0失败、Web25/25、build/typecheck与两项smoke均通过。新增数据库回归另在fresh `fiscalhot_reviewed_metadata_20261029_test`迁移36项后运行26/26，无skip，验证两源的真实CAS只改正文并保留全套source及protected rowsets；该test-only新增晚于上述CI，不能把CI SHA混作最终test文件SHA。
