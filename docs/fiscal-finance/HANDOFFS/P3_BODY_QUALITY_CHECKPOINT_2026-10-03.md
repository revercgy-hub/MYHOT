# P3 正文质量检查点（2026-10-03）

STATUS=IN_PROGRESS
STAGE=P3
GATE=Gate 1 PASSED；Gate 2 NOT_PASSED
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=8b1c4446a1c3131034a4d9b7c5ed482a92b80166（本文件对应的已验证代码提交；docs-only提交SHA在提交后由Git读取）
STAGE_CODE_SHA=8b1c4446a1c3131034a4d9b7c5ed482a92b80166
BASE_SHA=4ba0f8bb333121a8ee3f1a9ce4ded6113ee0dee7（本轮代码阶段基线）
PROJECT_BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c（STATUS保留的历史项目基线；与本轮阶段基线不同）
WORKTREE=代码提交已推送；本检查点及文档增量提交后应为干净，最终HEAD以Git命令实测为准。
REMOTE=origin/feat/fiscal-finance-hot
CI_TESTED_SHA=8b1c4446a1c3131034a4d9b7c5ed482a92b80166
CI_RUN=https://github.com/revercgy-hub/MYHOT/actions/runs/37093486152（success；Docker/check jobs均成功）

## 阶段退出条件与结论

P3仍需证明来源栏目覆盖、首页滑窗与跨周期更新，并解决核心业务正文质量缺口；本轮附件scope代码验证成功不满足Gate 2退出条件。12个生产source保持disabled、全文关闭。没有打开规模采集、模型/OCR或worker。

## 完成内容与可复核证据

- 新增可选HTML `detail.attachmentScopeSelector`。仅允许经校验的唯一正文严格祖先范围；scope内PDF样式链接继续触发保护。身份检查移到附件拒绝之前。未改`industry/sources.json`、apps、migration或collector门控。S1范围及离线实现见 [裁定](../S1_P3_ATTACHMENT_SCOPE_REVIEW_2026-10-03.md) 与 [实现报告](../P3_ATTACHMENT_SCOPE_IMPLEMENTATION_2026-10-03.md)。
- 旧整页PDF链接检查的离线characterization见 [附件guard审计](../P3_ATTACHMENT_GUARD_AUDIT_2026-10-03.md)：5/5 focused tests。实现focused集为34/34，`npm run typecheck`通过。
- QA fresh全套使用新隔离测试库 `fiscalhot_oct03_scope_regression_test`，35 migrations；`npm test` 222/222；`npm run typecheck`；`npm run build -w @aihot/web`；Web tests 15/15；preview smoke 30/30，均通过。日志保存在Git ignored `.data/test-pg/oct03-attachment-scope-model-stubs/`。GitHub run对同一代码SHA全绿：backend 222项、221通过、0失败、1个Windows-only monitor跳过；Web 15/15。
- 环境：完整测试按既有AGENTS规范启用测试进程`MODEL_CALLS_ENABLED=true`，仅由测试配置的localhost假provider应答；真实provider credentials未设置，凭证目录为不存在的测试目录；其他采集、Jina、IndexNow、Feishu、私网相关开关显式false。第一轮MODEL flag关闭的测试失败环境日志另存于ignored `.data/test-pg/oct03-attachment-scope-full/`，不作为产品代码失败或有效通过。
- 区域短正文只读人工复核见 [报告](../P3_REGIONAL_SHORT_BODY_REVIEW_2026-10-03.md)：固定五条中2条接受最小业务证据、3条拒绝；两条详情日期unknown。另有224/259/296字三篇不属于已审五条范围。未新增网络、DB写入或模型调用。
- Root核销的单次July14 DOM GET及QA独立复核见 [DOM报告](../P3_ATTACHMENT_SCOPE_DOM_2026-10-03.md)。HTTP 200、15,791 bytes；Undici 8.11.2 cap=1，attempted/dispatched/rejected=1/1/0；raw SHA-256=`eeb3c8185980d92f87832fbc99d2bf50ba7469e2a0c1108f085dcc5c1868e313`。页面身份与日期匹配，两个PDF样式链接都在正文外的业务附件下载区，scope外导航/面包屑/页脚无PDF。没有请求附件；实际MIME/文件内容未知。Root未核销行业source scope，来源配置未改。
- 预览安全复核前后只读查询一致：`fiscalhot_preview_test`有35 migrations、3 sources disabled且全文关闭、3样本body为空/status none/rev1、3 publications，analysis/receipt/job_runs为0；仅API `127.0.0.1:3001`、Web `127.0.0.1:3000`、PostgreSQL `127.0.0.1:5432` loopback。smoke前后均未改变DB。启动脚本明确关闭COLLECT、MODEL、JINA、IndexNow、Feishu与私网开关；`.env`不存在。QA未启动collector/worker、OCR或真实模型。脚本证据与“无worker”观察分别记录，不从命令进程名推断所有运行时开关。

## 来源逐项记录

本轮不修改任何source配置，也未扩大12源列表/详情覆盖。July14观察只针对一条已保存列表URL，不称首次访问或新增来源覆盖。附件scope是可选通用能力，并未配置到具体会计司source。更多来源优先级见 [Gate 2 next-batch](../P3_GATE2_NEXT_BATCH_2026-10-03.md)。

## 环境与安全边界

无业务DB写入；preview DB只读核验，fresh_test库仅用于回归。July14 raw HTML、manifest及DOM摘要仅在Git ignored `.data/fiscal-qa/attachment-scope-dom-20261003/`，无PDF字节。生产source/全文配置仍关闭。没有重试、附件请求、OCR、worker或生产模型调用。S1及Root明确核销限于通用离线scope和一次固定URL DOM观察，不授权任何行业配置或下一URL。

## 未完成项、风险与阻塞

Gate 2仍未通过。12源栏目覆盖/周期稳定性、首页滑窗、历史批次HTTP预算缺口继续按原状态记录。附件href/type只是PDF外观信号，真实MIME与文件内容未知；单个页面布局不能证明全源统一。区域额外三篇短正文未审查，两个已审页面日期unknown。代码和CI成功不构成source acceptance或Gate通过。

## 下一批 Agent

下一位P3负责人先读本检查点、[STATUS](../STATUS.md)、[Gate 2 readiness](../P3_GATE2_READINESS.md)、[SOURCE_MATRIX](../SOURCE_MATRIX.md)、[12源next-batch](../P3_GATE2_NEXT_BATCH_2026-10-03.md)及本文件所链接的离线/DOM/短文报告。优先做有明确范围的跨周期/首页窗口证据与短文候选边界。新URL及source配置须Root单独核销；保留已批准的disable、无附件、无worker/OCR/生产模型边界。

## 声明

本轮代码SHA与CI tested SHA均为`8b1c4446a1c3131034a4d9b7c5ed482a92b80166`；项目历史基线`589f79...`与本轮阶段基线`4ba0f8...`分别记录。文档commit完成后的HANDOFF_HEAD、最终分支/远端同步与工作树状态应使用Git实测写入，不将docs-only HEAD称为CI测试代码SHA。没有由记录支持的事实不作猜测；本检查点未提及的行为不视为已验证。
