# P5 Gold 人工审阅检查点（2026-10-19）

STATUS=IN_PROGRESS  
STAGE=P5 Gold metadata与人工标注准备  
GATE=Gate 2 `PASSED_FOR_BOUNDED_P4_PILOT`；Gate 3/4/5未通过  
BRANCH=`feat/fiscal-finance-hot`  
BASE_SHA=`589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`  
WORKTREE=本检查点对应的docs与tracked Gold metadata待独立核销；不记录未来commit SHA

## 用户决定与审计

用户对已展示的batch-02编号6–10回复“都精选”。冻结JSON与Markdown的SHA-256分别为`C841BA4DE7EAC43064EB2A58F170AA49619CC1798CEC4403DADAAF9F4840C8C8`与`FC0EF126500657B41F7A45CF29B826C0C8BC785AE7DC65B3FBE475E13AC0F39F`；ignored审计文件SHA-256为`6DA96D3E3509DBF1A5E95FC64D9E97AECEFCB67C03BCBDAD326F3C98E2E5C079`。审计记录原文、五条case/article ID映射、`confirmedBy=user-in-this-chat`及观察时间`2026-10-19T01:22:23Z`。该时间表示本次记录时观察到的UTC时间，不声称原消息精确发送时间。用户没有提供理由，五项reason均missing。

tracked [candidates-2026-10-18.json](../gold/candidates-2026-10-18.json) 仅将batch-02五项人工标注更新为`user_confirmed/select`；batch-01五项reject保持不变。事件组和split均未改。既有validator命令：

```powershell
node scripts/fiscal/gold-dataset.ts validate docs/fiscal-finance/gold/candidates-2026-10-18.json
```

结果`DRAFT_INCOMPLETE`、0 issues、100 candidates、10 confirmed、90 pending，exit 3（预期）。P5样本完整性、开发/留出集划分、真实provider评测与校准仍未完成，Gate 3未通过；选择阈值未改变。

## batch-03资料独立QA

ignored batch-03继续编号11–15，五项decision/reason均空，不设置event group或split。独立核对版本化metadata、保存source snapshot和本地完整body，5/5的文章ID、标题、source ID/name、URL、UTC时间、北京时间日期、content hash、body SHA-256与body reference相符。此前发现日期显示早一天，材料已修正后再次核验通过：#11 9月15日、#12 9月29日、#13 10月12日、#14 8月26日、#15 10月8日（Asia/Shanghai）。五条摘要均与全文事实相符，不包含标签建议。

完整审计产物仅在忽略目录：`.data/fiscal-qa/gold-review-batches-20261018/`。独立结果在`.data/fiscal-qa/luna-gold-record-qa-20261019/independent-qa.json`，包括逐项hash/date/identity结果及正文长度。batch-03尚未获得用户决策，仍为待审草稿。

## 环境与边界

本轮只更新Gold metadata与文档，未触及数据库、source配置、worker、provider、HTTP、OCR或部署。没有重跑10月18日的preview runtime、Gate 4或Gate 5验收。当前环境与Gate边界仍以[STATUS](../STATUS.md)的10月18日运行时记录为准。

## 下一步

由用户逐条审阅batch-03后再记录逐条决定与理由（如有）。100条全部decision确认后，仍需单独核对eventGroup及development/holdout切分，再按既有Gold合同整理正文并评测；在此之前不运行selection评测、校准或调整门槛。
