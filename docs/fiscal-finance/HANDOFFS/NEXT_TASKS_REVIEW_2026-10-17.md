# 2026-10-17 后续任务安排审查

## TASK

运行时只读检查P3/P4/P5后续安排并将Lead裁定的任务顺序写入计划索引。当前工作修改范围仅为计划文档；不表示任何新采集、正文解析、数据库变更或软件验收已经发生。

## MODEL

Luna High。未调用项目模型/provider。

## BASELINE AND SNAPSHOTS

审查时Git分支为`feat/fiscal-finance-hot`，基线短SHA `24ac9e7`，工作树干净。`STATUS.md`与[10月16日正文/分页交接](P3_BODY_AND_PAGINATION_CONTINUATION_2026-10-16.md)记录的是10月16日已核快照，不是10月17日live查询：

| 独立数据库/集合 | 已核快照 | 解释 |
|---|---|---|
| 主隔离采集库 | 442篇：375 `ok`、54 `pending`、13 `unconfirmed` | 786 revisions、315 publications；不与分页或preview计数相加 |
| 分页隔离库 | 129篇，全部正文`pending`；129个extract-body jobs为`created`且未消费 | 广西、海南、重庆、四川；cursor至page index 4，coverage仍`unproven` |
| preview库 | 104篇 | 固定摘要预览，无正文、未精选；独立于采集库 |

分页第2/3页有8个成功GET，但原manifest对gzip wire的pageAudit误计0候选；补充离线QA重放解码后的raw后核实候选。该补充QA不代表90日或全栏目覆盖。Gate 2仍为`PASSED_FOR_BOUNDED_P4_PILOT`；Gate 3–5未通过。

## PRIORITIES AND DEPENDENCIES

第一批A与B并行，C作为独立QA与文档/Git owner。Lead只处理S1、Gate和冲突裁定。第一批通过后，A按已有cursor范围做历史回填，B开展有已保存证据支撑的grounded正文批；不得先扩来源数量。

| Slot | Owner / exclusive scope | Exit criteria |
|---|---|---|
| A | Luna High；P3分页CLI `scripts/fiscal/p3-page-continuation.ts` execute成功路径，仅用现有collector与固定loopback fixture，在隔离`_test`库运行；独占该CLI、`tests/fiscal-page-continuation.test.ts` focused test与隔离运行证据文件 | 冻结positive scope；证明capture解码、collector结果、cursor和manifest相符；queue保持unstarted；覆盖cap、锁和失败时非零退出。无官方源请求。独立QA通过后，才可按原cursor范围安排历史回填。 |
| B | Luna High；证据配对和grounded正文处理，主库54条pending与分页隔离库129条pending分开；仅独占B自己的证据矩阵和正文处理scope | 每条记录已有证据路径、URL、title、date、hash、身份核验、下一动作；复用完整已存raw，去重只基于可复核身份。无保存详情则标缺口。13条`unconfirmed`保留各自hold；独立QA通过后，才可安排有证据支撑的正文批。 |
| C | Luna High；独立复核A/B的关键断言，独占计划/交接文档与唯一Git操作权；Lead仅裁定S1/Gate/冲突 | 对照冻结范围、raw、manifest、数据库隔离和queue断言复核；按改动运行必要检查，不重复已有全套QA；汇总差异供Lead裁决。 |

不得将三库行数相加。preview 104不参与pending正文批。每个新产物有明确单一owner；A/B不得修改彼此证据文件或共享状态文档。写入同一隔离库必须串行：完成一批写入并经独立QA，再开始下一批。A对分页库做历史回填期间，B可处理主库或做离线工作；B若处理分页库129篇正文，必须与A错开。Lead对涉及S1、Gate或冲突的决定保留裁定权。

## DO NOT REPEAT

- P4隔离故障与预算场景已在10月09日当前记录中覆盖；不得按10月08日旧表将相同场景重复建待办。
- 通用选择评测工具`scripts/eval-selection.ts`已经存在。P4/P5只准备现有工具/候选DRAFT；真实provider仍按用户决定deferred，不能把软件QA说成内容质量结果。
- `tatd…`日期冲突（详情2026-10-09、列表/DB为2026-10-08）继续hold、不重抓；会计司July14已知`attachments_unprocessed`不跟PDF、不重试；其他13条`unconfirmed`必须按既有provenance分类，不盲目重试。
- `xiamen-finance-debt`身份缺失及旧205字符历史假正文保持`NOT_ADMITTED`；配置flag不替代身份/正文证据。
- 正文v1非目标fingerprint差异原因未知；不重跑v1或改写baseline。v2只能按其自有冻结范围结果使用。
- WML单篇manual short-body及IFXP单篇attachment resolution已完成独立QA；5篇最近正文transaction已有独立SQL QA，不重复提交相同处理。
- 分页CLI plan/rejection已验收，execute happy path未验收。先完成A，不把此前分页数据执行当成CLI execute通过。

## AUTHORIZATION BOUNDARY

用户已授权持续推进此计划范围；Lead在范围内管理例行HTTP与数据库操作，不逐项重新询问用户。需要用户作决定的事项限于改变Gold路线/标注人和人工标签、改变付费provider路线，以及上线条款内容或部署目标/参数。模型付费执行仍deferred；Human Gold未确认；Gate/准入状态不因本handoff改变。

## THIS HANDOFF

**FILES_CHANGED**：运行时只读检查；仅修改`PROJECT_PLAN.md`、`P4_P7_EXECUTION_PLAN.md`、`HANDOFFS/README.md`、`STATUS.md`并新增本交接。Git提交后以实际HEAD为准。

**TESTS_RUN**：无。未发HTTP、未运行collector/worker/provider/服务，未读写数据库；检查文档和Git基线时为只读。

**RESULT**：记录第一批A/B并行、C独立QA/文档/Git的排他所有权与退出条件；将10月16日数据明确标为已核历史快照；10月08日/10月09日旧计划段落保留但标明历史。

**RISKS**：任务文档引用的计数并非当前live状态；A execute路径和B逐条证据配对尚未完成。13条hold的具体构成须在B报告逐条引用既有provenance，不应仅凭汇总数推断。

**BLOCKERS**：无阻挡A/B离线工作的用户输入；Gold人工确认、付费模型路线变更、上线条款及部署参数仅在相应路线需要时由用户决定。

**NEXT**：A与B并行开始；C独立QA两份产物。只有退出条件通过后，才分别安排原cursor范围的历史回填和grounded正文批。
