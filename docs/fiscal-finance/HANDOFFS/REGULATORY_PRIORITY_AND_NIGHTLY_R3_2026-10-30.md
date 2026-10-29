# 2026-10-30 当前重点取舍与夜间启动修复

## 用户决定与Gate 3

用户原话：“优先评估精选，主要是相关工作是当前重点”。其上下文是厦门普惠金融监管稿及同类具体财政金融监管业务。已明确写入selection-score：直接属于这类具体业务应优先评估，优先来自读者当前重点，不额外要求必须提供可复用方法；仍按正文分别判断五轴，不把关键词、机构身份或所有监管局工作变成自动高分/自动精选。五轴、八类、权重和60/65/76均不变；先前总分单位数学示例候选未恢复。

该决定的私有记录SHA `3032251afd0eb7e3854822b248cce278ea97dc0213b99b0d81371702d8363114`；Gold v5 SHA `eee411a8ef87cab8fe2659c001cf6dc8a2954d5c3d99c2e426dae743d6417427`及全部标签未改，不补填不存在的用户时间戳或把理由追写到原manifest。

在新的loopback专库`fiscalhot_user9_priority_20261030_test`对全部9条已知反馈作真实本地qwen3.5:9b完整预筛及双评分，27 request/27 received、0 failed/unknown、无重试，业务表全0。先跑8条短材料、长会计稿最后，逐篇结果分别落盘。请求无Gold标签；不是holdout或完整development150。

| 材料 | 两轮分数 | 本轮判断 | 用户判断 |
|---|---|---|---|
| 国库现金管理单期结果 |3/3|全部动态|全部动态|
| 单批即开彩票审批 |4/4|全部动态|全部动态|
| 普通事务所检查 |5/6|全部动态|全部动态|
| 台胞银行服务中心 |6/6|全部动态|全部动态|
| 云南转移支付监管 |6/5|全部动态|全部动态|
| 湖南国资收益审核 |6/4|全部动态|全部动态|
| 彩票资金管理办法 |8/82|全部动态|精选|
| 厦门普惠金融监管 |5/6|全部动态|精选|
| 会计解释21号征求意见 |85/85|精选|精选|

7/9匹配（TP1/FP0/FN2/TN6）；不得把总正确率当作精选质量已达标，正例仅1/3召回，且出现8/82的明显量纲/轮间不稳定。当前偏好已准确记录，但本地模型尚不能可靠执行；继续排查评分执行与稳定性，不再重复询问已明确的业务取舍。结果SHA `c76d65eb2871a95ca959caa8b75c212bf74d95a42cfc2ec77471ec9e17f48e78`，prompt文件SHA `a530cd27c16ce54b6b8dedb4986248639221081dce95340335f9428f4b9f66d6`。旧unknown保持原样，测试集群已停止。

## Gate 5实际夜间结果

- **01:00备份**：真实scheduled run `pg17daily-20261029T170001Z-4a809f5cb2ab`，PG17.11 custom dump 2,207,825 bytes，SHA `21a4acef908e6ea20c41fc1d8a8374a6f2e9b9daa6c77c67ba8380a0c625e063`。已另外只读重算实际dump字节和SHA相符。manifest含pg_restore list及schema DDL哈希；本次没有新做restore drill，也不声称多周期通过。
- **02:00理解**：r2实际触发，0.7秒后`REVIEW_REQUIRED/LAUNCHER_FAILED_OR_INTERRUPTED`；旧state原样保留。没有结果文件，不能计成功。
- **03:30摘要**：9次请求，6 completed receipts/3 failed receipts，但实际只有**2篇草稿**；4条relevance BLOCK被拦截、3条generic Error HOLD。completed receipt不等于draft，BLOCK结果也可完成回执。先前口头“6篇摘要”已向用户明确更正。两篇新草稿带分类标签、仍待逐篇人审，其中一篇涉及党课而被判财会监督，尤其不能直接发布。旧9篇加新2篇，共11篇私有草稿；无发布或精选。
- **06:00采集**：46源44成功、2列表timeout（财政部政策发布、山东监管局），新增2篇、详情1。47 dispatch中45份raw长度/SHA/完整性逐一复核，2次无response，provider0。`COMPLETE`不等于全源成功，未重试。只读review输入SHA `438187467d752f866cd61e0434405931d288237ad04b8b7fdf25f90f5ac61187`。

当前NAS：525文章/847修订/525发现；正文359 ok/157 pending/9 unconfirmed；publication/override137/137、receipts/attempts18/18、Gold200、全部source flags0。只读状态产物`.data/fiscal-qa/overnight-readback-20261030.json`；计数不代替逐行审计。Gate 3–5仍未整体通过。

## 理解launcher r3已安装

通过在凭据读取前、容器创建前、模型pilot前分别截断的诊断定位错误，所有输出仅允许失败常量；没有执行模型pilot。原launcher复现`CLIENT_CONTAINER_CREATE_FAILED`：Docker拒绝`--hostname`与`--network container:API`并用。后续还暴露镜像自带的`.env.example`误拦截及非root写`/run`、copy后文件归属问题。

最终修复保持冻结身份校验：client加入API当前唯一bridge网络并保留规定hostname，独立PG共享client的loopback namespace，数据库仍只监听127.0.0.1:55433、没有宿主端口映射，不再共享业务API网络namespace。仍核验API image和bridge类型；原API端口预检保守保留。仅对镜像中确切`/app/.env.example`且SHA为`23d9220f9938efc199039739b1ee3ad6bac0f816f3257bb47c92022c3981f78a`的公开模板例外，其他.env文件仍拦截。临时client内以root创建私有运行目录、修正复制文件owner，模型进程仍使用原node用户。失败时若已保留PG证据，一并保留承载其网络namespace的client；正常清理先PG后client，均只操作本次命名且已创建的容器。

隔离诊断实际走通创建/启动client及PG、装载冻结源码、PG readiness、36项迁移，**在模型调用前停止**；原trap清理临时资源。不是夜间执行成功或真实provider稳定性证明。最新r3启动诊断退出0；228个冻结源文件和原输入SHA未修改。r3 external wrapper/launcher绑定的新codeManifest SHA `cebae666f7cc3fb3b939e83fda0c9288c23c70f01a2251b7362120d6be029278`。

wrapper只从最多8192字节stderr识别pinned launcher中声明的单个`LAUNCHER_FAILED=常量`，存安全常量而非任意stderr；其他内容丢弃，避免下一次仍只有泛化原因。未知/多重/嵌入式标记负例有软件回归。

NAS激活文件：

- wrapper `tools/ollama-understand-nightly-r3.mjs` SHA `2f49f1d05ab06b83646e4ac277135db87431aeaa8b6a0c711ae61c72f187bd9b`。
- launcher `tools/ollama-understand-nightly-launcher-r3.sh` SHA `873adf13cd28d50999e14075cd52039bcd8812cdc231f6c19ada80699882e8c5`。
- entrypoint SHA `14728e1ba6bf5a76af640dbde508e3aa1c206239466c6ea7d241ccc4e1920c44`；cron SHA `99428541cb7bd6582b8364b388575aa4831aff7713cf3b4be20b1b492ea9d967`。只替换原02:00块的entrypoint hash，其余job不变。
- 新state为`state/ollama-understand-nightly-r3.state.json`，未覆盖r1/r2终态。rollback目录`backups/understand-r3-20261030`含原entrypoint、原crontab与install-proof，private modes。

安装在共享flock内完成。真实entrypoint窗外检查为`NOOP_OUTSIDE_WINDOW`，没有白天重跑或新增理解模型请求；下一次实际计划触发为10/31 02:00。NAS API未重启，LAN smoke全部通过。

## 软件检查与后续

Node24 typecheck、Web build/Web25通过，fresh专库full569项562通过/7 skip/0失败；首轮漏加新helper声明导致typecheck失败，补齐.d.mts后通过，失败日志保留。最终另加重点偏好政策合同测试及可选failureCode声明，focused24项23通过/1 frozen-artifact条件skip。最后的launcher清理顺序变更经实际隔离启动诊断通过；最终CI另行记录，不混作此前通过的24971f8 Check40912839787。

下一步继续开发模型评分执行稳定性并进行完整development评估，之后另备未参与调优的事件隔离样本；对夜间3个HOLD按保存回执做无重试诊断、两篇新摘要人工审阅；核验10/31真实r3执行及更多运行周期。来源90日分页覆盖和两项source metadata漂移仍开放。没有付费模型、自动精选或公开发布。

最终代码`e1ab9c2`的[Check40973619667](https://github.com/revercgy-hub/MYHOT/actions/runs/40973619667)已完成且成功，含最终偏好测试、声明、launcher及完整check/docker检查。私有27请求/用户取舍/夜间readback和06:00采集证据归档SHA `cfdf196f7a52d10788143f61d881fff91b502105e22c4e7677e1f5130e09cc9c`已备份到NAS host，mode600。收尾核对API仍ee9 image/restartCount0、无遗留diagnostic容器；工作区干净。Gate结论不因CI成功改变。
