# 2026-10-29 本地改动核验与后续安排

本轮依据用户“可以继续”推进本地核验。代码基线为 `f07e9d2` 加既有未提交改动；未连接 NAS，未修改公开内容、Gold 或来源开关。

## 已核验

- 摘要相关性、分类和标签校验，以及 GovCN pending 正文范围：专项27项，26通过、1数据库用例跳过、0失败。
- `npm run typecheck` 通过；Web build通过；Web tests 25/25通过。
- 安装器与launcher通过 Git Bash `bash -n`；`git diff --check`通过。
- r7部署候选已在本地生成，绑定既有 ee9 API image、独立提示词资产和taxonomy；没有安装或触发模型。目录 `.data/fiscal-qa/summary-draft-nightly-candidate-20261029-r7-bound`。
- 完整回归使用新建的 loopback `fiscalhot_review_20261029_test`，36项迁移：539项中533通过、6跳过、0失败，退出0。私有日志 `.data/fiscal-qa/review-20261029-tests.log`。测试模型使用本地stub；采集及推送关闭。完成后已停止本轮启动的55438测试集群。

## 接续顺序

1. 完整回归通过后，整理本地代码提交；r7仍为待部署候选，不能记作NAS已安装。
2. 管理员逐篇审核既有9篇摘要；其中以旧换新摘要可补齐问卷对象包含消费者与参与商家。现有草稿没有分类标签，不追溯宣称采用新提示词。
3. NAS只读核对10/29 12:00、18:00采集，10/30 01:00备份、02:00理解及03:30摘要任务；保留真实失败/跳过记录，核验锁释放和受保护数据计数。
4. 再分批修复正文缺口、补来源分页和90日覆盖，积累多个稳定周期后复核Gate 3。

Gate 2仅通过bounded pilot；Gate 3仍CHANGES_REQUIRED，Gate 4/5未通过。当地记录之外的最新NAS状态本轮未验证。

## 15:12+08 接续核验与Staging安装

- 已通过既有SSH身份连接NAS。12:00 scheduled collector为COMPLETE但不是全源成功：46源、45成功、河北列表超时1、7新增、6详情、52 dispatch、provider 0。51份已有response文件的长度和SHA逐一相符，另1次超时无response；未重试河北。result SHA `3634d626d143bd8275477f91743bf7a1975e7efea627da88bbf721012d374d30`。
- 只读SQL当前517 articles / 811 revisions / 137 publications；正文325 ok / 183 pending / 9 unconfirmed，receipts9，来源enabled/fulltext flags非零0。API仍ee9 image、restartCount0；共享锁无holder。
- 补跑专用DB测试首次因准备不足出现3失败（固定数据库名、预置来源和identity缺失），不计通过。之后新建并迁移固定`fiscalhot_nas_candidate_test`、离线预置来源及identity fixture，41/41通过；独立空`fiscalhot_nas_native_summary_import_test`迁移后2/2通过。55438测试集群已停止。
- r7安装后真实plan检查发现launcher错在宿主检查容器`/data`路径。已修复为容器内校验目录、mode、文件SHA；schema检查使用宿主同SHA资产。此问题不会触发模型，但会阻断任务。r7已由r8替换。
- r8已安装到现有Staging，未重建/重启API。operator SHA `b6c7bc9ab81a6c3bf5f20aed2a8ca98261724df010748564c7f2f33d6d0c51e3`；launcher `d787c25c58d17fd66e82e07e353ec59f41673bb2a5f049e5393f4de357a64646`；manifest `c09b95fff4f279a6099245d900298584ae3c6f91faf9233fb015b01c0803d71d`；entrypoint `113e91bc9c0287c3a7b83702d5d379bdebf88a70812780a44bfa01a39d7330c7`。
- 容器内prompt/taxonomy预检通过。实际launcher plan-only run `summary-draft-plan-20261029-1511-582827`通过，roster SHA `b1010849bba093f9f8e0a8b046141f322ff8bd61dd38dae4bec182c653ca6d17`。没有真实模型执行，既有9 receipts未增，今天once marker保留。新分类提示词只作用于后续草稿，不改写旧9篇。
- cron仍03:30；其它job块对比安装前一致（忽略块边界空行），最终cron SHA `cebadd998683013648839edc5169f9f3fcd25fc5cd10cc56b639f19e210f1f5e`。r6回退文件为NAS `/vol2/1000/docker/summary-before-r7-20261029-1510.tar.gz`及同名前缀`.cron`。候选r7/r8与安装器生成的crontab备份保留。

后续仍需10/29 18:00及10/30凌晨真实scheduled证据、9篇管理员人工审核、正文缺口与90日覆盖补证。Gate状态未变。
