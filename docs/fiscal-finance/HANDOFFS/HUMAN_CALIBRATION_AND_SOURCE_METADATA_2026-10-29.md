# 2026-10-29 人工校准与来源metadata修复候选

用户同意参与审阅以加速Gate 3–5。审阅按每批三篇开展，每篇展示事实简述和原文链接，不展示旧Gold或模型分数。材料来自development150，不能称作新的盲测或holdout。

## 已确认的业务决定

前两批六篇，用户均明确回复“仅放全部动态”：福建省级国库现金管理第十一期招标结果；19款即开型福利彩票审批；山西会计师事务所执业质量检查；厦门首批台胞金融服务中心；云南转移支付常态化监管案例；湖南中央企业国有资本收益审核。

逐条决定进入私有新overlay，不覆盖原始Gold200、v2、v3或Staging数据库。用户没有提供理由，因此`userReason=null`；不把六个具体决定推断成来源永久排除、全部地方业务降权或有案例就一定不精选等新通则。

- batch01 packet SHA `8b684998a4c4a7502baabcb5157d0ff044d0ae47c97a7ebc541aa31fbf0d2782`；v3 overlay `24f8a240274807b37d4b2db473d245282789b8b8a52bec9756b70fa00cc6570d`；v3 manifest `83c851d954503e82423b291cec65089011637fff9d18c561d1e6d7e74587e2b1`。两条select改为reject，一条reject再次确认。
- batch02 packet SHA `7762b74e7ec65a9085dc4180f8c25976da111b2be7d3ac279efa9529b4353299`；v4 overlay `c22b395b828a098253f3a05f594f5daa03159e55f3c450878887aeb3fc845849`；v4 manifest `3a4bc67c601eb0bd34c6e343f0dd3660e5bea87544bd34492f69d58c453d8d59`。一条select改为reject，两条reject再次确认。
- v4共200个confirmed，24 select/176 reject；development150为21 select/129 reject，消费过的holdout50仍3/47，原文、正文hash、事件组和分集不变；seed15隔离验证通过，validator `READY_FOR_EVALUATION`。这是数据就绪，不是Gate通过。
- `confirmedAt`采用决定落盘时间，并明确声明不是用户回复的精确时钟时间。六项只在上述packet绑定范围确认；用户是依据事实简述及可访问原文链接回复，未声称已逐字阅读全文。

只用既有e82e冻结预测作development复算：v4 TP16/FP27/FN5/TN102，precision37.21%、recall76.19%、F1 50%。**分数变化来自人工标签版本变化，模型没有重新运行，不能宣称模型效果提升。** 原v2为16/27/8/99，precision同为37.21%。历史预测和评测保留。

第三批（企业会计准则解释征求意见、彩票市场调控资金管理办法、厦门普惠金融监管工作）packet SHA `4da0670d48be24302e5928d6ddbc8386c71611c57ff1de0962b7855892be9580`，当前待用户答复，不推定同意或沿用前六条结论。

新增`calibration-review-packet.mjs`：正文hash验证、明确development范围、唯一身份校验，输出不包含旧标签、评分或门槛；决策一律初始pending。初版已生成的三份packet另经Gold落盘脚本核对development身份和正文hash，后续CLI还要求提供明确的development manifest。

## Gate 4正文缺口的实际排查

只读查询四个优先来源当前44条pending，匹配既有私有inventory及完整历史响应，找到19条可复用记录。逐份校验allowlisted manifest SHA、raw字节数和SHA；重放只返回冻结URL的保存HTML，任何附件或其他URL均拒绝，不请求官方站点。

原配置严格重放只有1条满足标题、日期和正文检查。排查发现：福建监管局缺详情标题规则；厦门监管局同时缺详情标题和日期规则。保存HTML实际存在`h2.title_con`和`PubDate`。

新增`source-detail-metadata-candidate.mjs`只为这两个disabled/fulltext-off来源生成独立候选：福建新增`titleSelector=h2.title_con`；厦门新增同标题selector及PubDate正则。原正文、附件、安全和准入规则不变；遇到已有自定义metadata规则时拒绝覆盖。

使用候选配置对相同19条原始响应重放，15条满足标题、日期及正文检查（原1条政府网+8条福建+6条厦门）。4条HOLD分别为政府网规划附件、会计司两篇附件歧义、福建单位决算无合格正文。候选不是已回写正文，不代表新HTTP、来源准入或90日覆盖。

私有诊断产物：`.data/fiscal-qa/gate4-priority-body-replay-20261029.json`与`gate4-priority-body-replay-candidate-20261029.json`。两者均externalRequests0/databaseWrites0，包含完整保存证据路径及候选配置。尚无fresh完整受保护rowset snapshot或可执行CAS批准。

**应用顺序**：准备source row与catalog一致性变更、实际镜像/有界operator绑定及回退材料；做预检后再应用metadata配置；随后以新鲜备份、准确article/source快照对15条逐项复核并按有界CAS流程回写。不能只改数据库source配置而破坏现有collector的catalog一致性，也不能把诊断中的旧revision直接提交。

## 验证与Gate结论

Node24.16专项5/5通过，覆盖中性审阅包的正文/身份/分集拒绝，候选只改预期metadata，真实提取器对正确标题日期成功、错误标题/日期及附件仍拒绝。Gold v4 validator通过；既有预测复算不触发模型/数据库。当前新增源码未安装到NAS，先前r8摘要与r2理解任务安排不变。

Gate 3仍CHANGES_REQUIRED；Gate 4/5仍未整体通过。下一步接收第三批业务决定、继续development规则校准；对metadata候选作完整软件/部署预检；观察18:00采集和下一凌晨任务。
