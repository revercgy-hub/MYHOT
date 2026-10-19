# P5 Gold 人工审阅检查点（2026-10-19）

STATUS=IN_PROGRESS  
STAGE=P5 Gold metadata与人工标注准备  
GATE=Gate 2 `PASSED_FOR_BOUNDED_P4_PILOT`；Gate 3/4/5未通过  
BRANCH=`feat/fiscal-finance-hot`  
BASE_SHA=`589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`  
WORKTREE=本轮6个tracked prompt/docs文件待提交与CI；所有偏好/机器建议产物留在ignored `.data/fiscal-qa/experience-assisted-review-20261019/`

## 用户决定与审计

用户对已展示的batch-02编号6–10回复“都精选”。冻结JSON与Markdown的SHA-256分别为`C841BA4DE7EAC43064EB2A58F170AA49619CC1798CEC4403DADAAF9F4840C8C8`与`FC0EF126500657B41F7A45CF29B826C0C8BC785AE7DC65B3FBE475E13AC0F39F`；ignored审计文件SHA-256为`6DA96D3E3509DBF1A5E95FC64D9E97AECEFCB67C03BCBDAD326F3C98E2E5C079`。审计记录原文、五条case/article ID映射、`confirmedBy=user-in-this-chat`及观察时间`2026-10-19T01:22:23Z`。该时间表示本次记录时观察到的UTC时间，不声称原消息精确发送时间。用户没有提供理由，五项reason均missing。

tracked [candidates-2026-10-18.json](../gold/candidates-2026-10-18.json) 仅将batch-02五项人工标注更新为`user_confirmed/select`；batch-01五项reject保持不变。事件组和split均未改。既有validator命令：

```powershell
node scripts/fiscal/gold-dataset.ts validate docs/fiscal-finance/gold/candidates-2026-10-18.json
```

结果`DRAFT_INCOMPLETE`、0 issues、100 candidates、10 confirmed、90 pending，exit 3（预期）。P5样本完整性、开发/留出集划分、真实provider评测与校准仍未完成，Gate 3未通过；选择阈值未改变。

## batch-03资料独立QA

ignored batch-03继续编号11–15，五项decision/reason均空，不设置event group或split。独立核对版本化metadata、保存source snapshot和本地完整body，5/5的文章ID、标题、source ID/name、URL、UTC时间、北京时间日期、content hash、body SHA-256与body reference相符。此前发现日期显示早一天，材料已修正后再次核验通过：#11 9月15日、#12 9月29日、#13 10月12日、#14 8月26日、#15 10月8日（Asia/Shanghai）。五条摘要均与全文事实相符，不包含标签建议。

完整审计产物仅在忽略目录：`.data/fiscal-qa/gold-review-batches-20261018/`。独立结果在`.data/fiscal-qa/luna-gold-record-qa-20261019/independent-qa.json`，包括逐项hash/date/identity结果及正文长度。用户随后对batch-03逐项决策，见下一节。

## batch-03用户决定与batch-04独立QA

用户原文为“11精选 12不 13精选 14精选 15精选”，observedAt UTC=`2026-10-19T12:18:04Z`。batch-03冻结JSON/Markdown SHA-256分别为`8200A0E27B0D81537AE3F53DCA0DB6FF4257B13A25B41725F9F4C9E4F5C33F1C`与`C552817040677E7455A9C925C3EEF8F39E93EB1EC5E9AC589A85AE1F2E49E953`；ignored用户决定审计SHA-256为`E074AC050EA82213A8774BA049887CF5A95197706A5CF7373B46B3D31E3B6BF6`，审计中source hashes与冻结文件匹配。编号11–15映射为四项`select`、一项`reject`，五项理由均missing。tracked metadata只改这五项四个humanAnnotation字段，前十项与其它字段保持不变。

batch-04编号16–20仍为中性待审草稿，decision/reason均空，eventGroup/split未填。独立QA 5/5核对了标题、source ID/name、URL、UTC瞬时和北京时间、content hash、正文SHA-256及body reference，均与冻结候选和source snapshot一致；五条摘要均对照本地全文核验且无标签建议。batch-04 JSON/Markdown SHA-256分别为`4885095F06F83F58882C57273BCB24318E22577C59F92950437F9FFCE5D81EC8`和`678B85D3AF2058550FD3E2AFEA4ED74DED9201E9500CB537FF26E119637C9AB2`。北京时间依次为#16 9月14日、#17 9月7日、#18 9月21日、#19 9月30日、#20 7月17日。详细逐项QA在ignored `.data/fiscal-qa/luna-gold-record-qa-20261019/batch04-independent-qa.json`。

当前100项metadata为15 confirmed（9 select、6 reject）/85 pending；所有eventGroup/split仍`needs_review`。Gold validator为`DRAFT_INCOMPLETE`、0 issues、预期exit 3。Gate 3仍未通过，未运行评测或校准。

## 环境与边界

本轮只更新Gold metadata与文档，未触及数据库、source配置、worker、provider、HTTP、OCR或部署。没有重跑10月18日的preview runtime、Gate 4或Gate 5验收。当前环境与Gate边界仍以[STATUS](../STATUS.md)的10月18日运行时记录为准。

## 下一步

85条首轮机器建议QA完成：A 43条（11 select/31 reject/1未分类、20需复核）、B 42条（18 select/19 reject/5未分类、10需复核），合并为29 select/50 reject/6未分类。manifest顺序覆盖85个未确认case，无seed重复；两分片的文章身份、标题/来源/URL、contentHash/body SHA、正文hash和Asia/Shanghai日期已独立核验，0 mismatch。30个低/中置信标志对应正文均已核；另按可用性对高置信抽查A select 1、A reject 2、B select 2、B reject 2，合计37篇正文事实核查，摘要有据。抽查按既有[Gate 2用户内容边界](../GATE2_USER_DECISIONS.md)处理：无实质业务事实的内部活动排除，新政策、问题发现、监管措施和调研成果纳入；未新增硬阈值。此前提出的地方金融服务稿优先级问题已由用户原则确认，三个中性例子见ignored `.data/fiscal-qa/experience-assisted-review-20261019/neutral-preference-examples.json`。

合并机器建议保存在ignored `.data/fiscal-qa/experience-assisted-review-20261019/auto-suggestions.json`（SHA-256 `51d7e5c8865449e98997d698a158a610c72cbc44929444e1f7f3a905fe3b84a3`）；保留原分片`part-a.json`、`part-b.json`。每项附有未改写的`sourceShardRecord`，保留A分片的`reason/inferenceOnly`及B分片的`reason/bodyEvidence/basisType`等原生字段，避免把不同字段名合并时丢失依据；这些是分类器记录，不是正文逐字引文。原始30个`needsHumanReview`标志现已由独立QA按正文/已确认规则检查完成，其中27项按已确认边界处理，另3篇地方金融服务稿作为一个偏好组应用。中性内部QA索引为`neutral-review-queue.json`，不显示机器标签、置信度或理由；三例中性主题说明为`neutral-preference-examples.json`。用户无需逐条判断30条，更不需逐条重读85条。15条人工confirmed（9 select/6 reject）仍是偏好归纳样本；85条建议不写入`humanAnnotation`，也不计Gold。未来独立holdout须盲审并按事件组隔离，本轮不自动分配`split`。本轮为本机Luna基于已确认偏好样本的经验辅助初判；未用provider/eval/receipt，未运行selection评测或校准。Gate 3评测、错例复核及阈值确认尚未完成。

用户随后确认地方金融服务稿放入“全部动态”，精选优先政策、资金和监管重点。偏好审计SHA `271f2034a2408905e9496fe4334dc2f4a3bcbbb1bd87997301f65d36460bf570`，原文SHA `37d44d53d7f6a49ec99c2496f0717303a1b307e5546423d032e5704a3e3b6562`，observedAt UTC `2026-10-19T14:26:07Z`。v2 SHA `88d8051b50300598bbc581a51090091c582b4170eeee5fc4e72988edb24d5c15`仅为三例应用偏好的机器建议，三例仍非独立人标；其余82条与原合并建议deep-equal，计数仍29/50/6。独立核验三例身份、正文hash和北京时间全部匹配manifest及本地正文。

随后独立复核ignored `null-resolution-proposals.json`（SHA-256 `0fa4ae5e005d3bf4767483d6db5fce38a7134b356854d86c48fa81d4310376d5`）的6篇正文、body SHA、标题/来源、北京时间和依据：新疆监管综述按用户确认的监管重点优先给出中置信select建议；吉林/海南党支部学习与内蒙古仅泛谈政策案例的培训按既有内部活动边界为reject；甘肃代表建议闭环流程无政策、资金或监管结果，为中置信推断reject；北京财青论坛虽列调研和量化复盘，但未展示结论或结果，仍保留null。证据是正文意译摘要，不是逐字引文。v3保留v2及每条此前建议，SHA-256 `e1a3e1bc1f80a20676459d4712c0f9bc901b6389d47cc907c79b1483127ad993`；仅6条相对v2变化，其余79条deep-equal，建议数为30 select、54 reject、1未分类。所有85条仍为机器建议，不写入Gold或人工annotation。用户偏好只适用于所述地方金融服务稿，甘肃扩展仍标为推断。

评分提示词在`industry/prompts/selection-score.md`增加一条文字规则：服务便利和覆盖面本身不抬高政策/资金/监管重点相关性，出现实质制度、资金、监管问题或风险处置时按事实评价。未添加维度分数上限/权重或prefilter门槛，评分器不直接决定精选，地方范围也不按传播度扣分。B运行typecheck及diff check通过；A本地Web build通过、Web tests 17/17通过；API/Web/Postgres均未启动，真实smoke `NOT_RUN`。本轮不是provider evaluation或Gate 3校准；15人工标签仍为9 select/6 reject，85仍pending于Gold metadata，eventGroup/split未分配。
