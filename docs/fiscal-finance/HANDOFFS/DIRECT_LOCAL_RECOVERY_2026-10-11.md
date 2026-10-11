# 本地恢复与预览seed检查点（2026-10-11）

STATUS=IN_PROGRESS
STAGE=P3来源主线与本地开发预览维护
GATE=Gate 2 `PASSED_FOR_BOUNDED_P4_PILOT`；仅按[正式review](../GATE_2_REVIEW.md)限定三个source逐篇小样，本轮无Gate变化
CURRENT_BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=f6a6bc2009dd2c1965ce77bb0cbd93127df2ee0c（本轮文档更新前的clean HEAD；文档提交SHA由最终git log记录）
STAGE_CODE_SHA=3385ef05ebf448a0bd9d68daf748d03b24b34440（运行时代码SHA；其后`f6a6bc2`及本轮提交为docs-only）
LATEST_TESTED_CI_HEAD_SHA=f6a6bc2009dd2c1965ce77bb0cbd93127df2ee0c
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
RECOVERY_SHA=f6a6bc2009dd2c1965ce77bb0cbd93127df2ee0c
WORKSPACE=D:\AI-work\MYHOT\AIHOT
WORKTREE=开始时clean；本轮只改文档：本交接、`STATUS.md`、`P3_LOCAL_PREVIEW.md`、本目录`README.md`

## 阶段退出条件与结论

本轮完成了固定九条本地预览seed、隔离库读写后审计，以及当前运行时代码的GitHub Check与Docker workflow。九条样本都保持未精选、无正文、source禁用。GitHub历史403已定位为CLI自动选择了upstream仓库；显式指定用户fork后，一次dispatch成功并全绿。

本机PostgreSQL已就绪并完成seed。API与Web启动请求在进程创建前被策略拒绝，未创建PID，未尝试换工具。因此本机root/item页面、robots header及loopback smoke仍未验证；阶段保持`IN_PROGRESS`。CI中独立的built-site smoke通过，不代替本机HTTP检查。

## 完成内容与可复核证据

### 本机固定样本seed

- 精确目标库：`fiscalhot_preview_test`，loopback PostgreSQL；迁移数35。写入前审核确认旧六条样本安全基线；本轮只执行用户授权的一次固定九条seed。
- 结果：旧六条报告`unchanged`，新增三条浙江预览报告`created`。终态为9 sources、articles、publications、overrides及audits；9篇eligible，selected=0、score=0、body=0、analyses=0、jobs=0、fetches=0、receipts=0。source仍disabled，站内与转发全文关闭。
- 对旧六条逐字段比较显示业务内容、raw与provenance、revision、publication、override及audit均相同。3篇旧article的`updated_at`被材料upsert刷新；原因是材料JSON比较对JSONB对象键序敏感，误判raw发生变化。该时间戳是技术处理时间，不是官方内容变化；保留当前值，没有回滚或额外数据库写入。需要独立评估最小修复。
- 精确审核材料留在被Git忽略的`.data/fiscal-qa/local-preview-seed-20261011/`。本handoff不复制隐私或运行时文件。应用数据没有正文、精选、评分、分析或队列执行事实。

### GitHub Actions与目标仓库

- 仓库`revercgy-hub/MYHOT`的default branch为`main`；repo API返回当前actor有admin权限，Actions enabled，`Check` workflow active，并包含`workflow_dispatch`。本地分支为`feat/fiscal-finance-hot`，运行时代码SHA为`3385ef0`。
- 第一次未带`--repo`的CLI dispatch请求自动解析到Git remote `upstream`对应的`KKKKhazix/AIHOT`，返回403 `Must have admin rights to Repository`，没有dispatch成功。它不是fork权限不足。随后先查目标fork的精确branch/SHA已有run为0，再用`gh workflow run check.yml --repo revercgy-hub/MYHOT --ref feat/fiscal-finance-hot`执行一次成功。历史状态中将旧403解释为权限不足的判断已在[STATUS](../STATUS.md)纠正；没有改remote或仓库权限。
- Run [38101003073](https://github.com/revercgy-hub/MYHOT/actions/runs/38101003073) 的event为`workflow_dispatch`，branch为`feat/fiscal-finance-hot`，head SHA精确为`f6a6bc2009dd2c1965ce77bb0cbd93127df2ee0c`，Check与Docker均completed/success。Check的Install、Typecheck、Build web、Web tests、migrate/seed、built-site smoke及Backend tests步骤成功；Docker compose build/start与smoke成功。只记录workflow步骤状态，不推测测试条数。
- `f6a6bc2`对应文档/状态修订，运行时代码仍是`3385ef0`。本轮文档提交后不会重新dispatch；精确runtime CI evidence仍记录它实际checkout的`f6a6bc2`。

### 本机服务启动请求

2026-10-11对API与Web分别发起一次隐藏进程启动请求。执行策略在CreateProcess前拒绝，未创建PID；没有用其他执行工具、浏览器或connector重试。PostgreSQL仍运行于`127.0.0.1:5432`，seed已完成；API/Web未启动，本机页面GET=0、robots/noindex=未验证、smoke=未运行。该拒绝属于本轮新事件，不应沿用早先“等待用户手动启动”的状态。

## 来源与预览边界

本地库的九条固定预览ID仅供开发查看。三条浙江样本是编辑摘要，不是人工Gold或应用模型精选；九篇`selected=false`，均无正文与score。厦门债务真实PDF历史结果仍为`pdf_page_no_text`，source保持hold。所有来源仍`enabled=false`，`site_fulltext=false`、`syndicate_fulltext=false`。没有collector、worker、真实模型、OCR、付费provider、Jina、附件请求或内容推送。

## 未完成项、风险与阻塞

- 本机API/Web被启动策略拒绝，因此页面渲染、HTTP headers/noindex及loopback smoke未知；CI built smoke不能替代这些观察。
- 旧六条三项`updated_at`触碰没有回滚。调查材料JSONB比较键序的行为，并独立评估只改比较方式的最小修复；不要把时间戳说成来源内容更新。
- 未完成人工Gold标签、事件分组及来源质量、历史和90日覆盖证明。Gate与source admission没有变化。

## 下一批Agent

先读本handoff、[项目状态](../STATUS.md)、[本地预览状态](../P3_LOCAL_PREVIEW.md)、[来源矩阵](../SOURCE_MATRIX.md)与[Gate 2 review](../GATE_2_REVIEW.md)。优先调查材料JSON比较中的JSONB对象键顺序并提出最小变更及针对性证据，不需要重复本轮seed或CI。API/Web live核验仅在新的明确授权且执行策略允许后考虑；不得用其他工具绕过本轮策略拒绝。文件归属由Lead安排。

## 必需任务字段

**TASK**：恢复本地隔离preview库，单次固定seed九条并审计；确认GitHub Actions权限/目标，运行当前feature branch workflow；尝试API/Web本地启动。

**MODEL**：本机数据库操作/审核由本地runtime执行；CI使用GitHub-hosted workflow。本任务未调用应用模型。

**FILES_CHANGED**：文档仅限本交接、`STATUS.md`、`P3_LOCAL_PREVIEW.md`、`HANDOFFS/README.md`。ignored seed审计材料在`.data/fiscal-qa/local-preview-seed-20261011/`。

**TESTS_RUN**：GitHub Check与Docker run `38101003073`针对精确head `f6a6bc2`全绿；未重跑本地软件套件。API/Web未启动，本机HTTP/smoke未运行。

**RESULT**：九条隔离预览样本已写入并完成审计；精确head CI通过。旧六条业务内容保持不变，但三条`updated_at`被技术触碰。API/Web被执行策略拒绝创建进程。

**RISKS**：材料upsert对JSONB对象键序的比较导致无业务变化时刷新`updated_at`；本机页面未核验；厦门PDF仍hold。

**BLOCKERS**：本机API/Web启动被策略拒绝；live页面与noindex尚无证据。

**NEXT**：调查JSONB键序比较并提出最小修复；后续live核验需新的授权且执行策略允许。

## 声明

没有由本交接和所链接审计支持的事实不作猜测；本文件未提及的行为不视为已验证。
