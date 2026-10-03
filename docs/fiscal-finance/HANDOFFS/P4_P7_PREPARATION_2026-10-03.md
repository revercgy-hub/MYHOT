# P3→P4/P5 准备检查点与P6/P7计划（2026-10-03）

STATUS=IN_PROGRESS
STAGE=P3；P4/P5仅完成离线准备工具，未开始正式阶段执行
GATE=Gate 1 PASSED；Gate 2 NOT_PASSED；Gate 3 NOT_PASSED；Gate 4 NOT_PASSED
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=1a15e3449e281ab4ce2137926f753a3f8a188f4a（CI-tested code HEAD；后续docs-only HEAD另记）
STAGE_CODE_SHA=1a15e3449e281ab4ce2137926f753a3f8a188f4a
BASE_SHA=c335c71031becab5d9e7ec1c4dab90d223decd78（本轮P4/P5准备代码阶段基线）
PROJECT_BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c（STATUS保留的历史项目基线）
P4_COMMIT=209ad1a86fb8998bc01da94cd032391de468c9c4
P5_COMMIT=1a15e3449e281ab4ce2137926f753a3f8a188f4a
REMOTE=origin/feat/fiscal-finance-hot；代码提交已推送
CI_TESTED_SHA=1a15e3449e281ab4ce2137926f753a3f8a188f4a
CI_RUN=https://github.com/revercgy-hub/MYHOT/actions/runs/37111577268（success；Docker与check jobs均success；backend 234项/233 pass/0 fail/1 skip，Web 15/15）
DOCS_COMMIT=待提交；提交后以Git核验填写最终HEAD与工作树状态。
WORKTREE=当前仅有docs-only改动，完成本轮提交后的实际状态见最终Git核验。

## 当前准入结论

现有P3证据不足以提交正式Sol Gate 2 review作“已满足/通过”裁定；Root已决定暂不消耗正式审查轮次，也不缩小Gate 2范围。P3必须继续。P4准备器和P5 validator仅为离线工具，不是正式P4模型执行或P5 Gold校准，不能据此宣布阶段完成。

主要Gate 2未满足项仍按 [正式Gate 2 readiness](../P3_GATE2_READINESS.md)、[12源矩阵](../SOURCE_MATRIX.md)、[下一批逐源账目](../P3_GATE2_NEXT_BATCH_2026-10-03.md)记录：历史核心/区域批次dispatch/hop总量unknown且不可追认；需要时间分散的首页候选窗口/轮询/突发与失败恢复证据；核心文章正文pending/unconfirmed与质量负例处置仍未整体结清；短文人工审核仅覆盖固定五篇，同批另有三条224/259/296字未审；中央监管局是选登汇总而非全国35局全量。旧hop unknown本身不永久挡Gate 2，未来经过验证的有界审计可补充证据，但不能改写旧批次。可供Root整理的候选subset已在 [P4–P7执行计划](../P4_P7_EXECUTION_PLAN.md) 中标为非标准变更、非请求授权。

## P4/P5准备工具与验证

- **P4 read-only pilot planner**：`scripts/fiscal/p4-pilot.ts`，只接受显式最多50个ID、本地`*_test`数据库；在只读一致性事务内检查文章revision/hash/body状态、worker/job与receipt风险、当前模型/prompt/预算快照并写入新`.data` manifest。`ready=true`只表示该快照满足清单条件，工具代码始终记录`modelCalls=0`、`analysisWrites=0`、`queueWrites=0`、`httpRequests=0`；绝非P4准入、provider能力或运行安全许可。`disabled source`本身不阻隔遗留job。Focused 6/6；fresh `fiscalhot_p4_pilot_20261003_test` 35 migrations后，以两个本地fixture验证接受/拒绝manifest；0 analyses/receipts/attempts/job_runs。QA确认DB URL限定PostgreSQL loopback与`_test`，输出锁止为ignored `.data/fiscal-p4-pilot/`。
- **P5 Gold metadata validator**：`scripts/fiscal/gold-dataset.ts`和`docs/fiscal-finance/gold/metadata-template.json`。模板8候选的`humanAnnotation.decision`均null、status `needs_review`；事件分组和split也待人审。附件失败候选无canonical文章ID/正文，不可ready。脚本输出`DRAFT_INCOMPLETE`/8候选/0确认/8pending并按预期exit 3；畸形schema exit 2。Focused 6/6；只有测试内synthetic row能走静态`READY_FOR_EVALUATION`分支，未运行模型。它不是`docs/selection.md`规定的`.data/gold.jsonl`，不得直接传给`eval-selection.ts`。Gold样本不足100–200、没有任何用户/读者确认标签，Gate 3未通过。
- Owner说明及限制见 [P4 pilot readiness](../P4_PILOT_READINESS.md) 与 [P5 Gold readiness](../P5_GOLD_DATASET_READINESS.md)。原有`industry/gold.example.jsonl`两条是假设格式示例。

## 全套质量回归

测试针对代码head `1a15e3449e281ab4ce2137926f753a3f8a188f4a`，保存在Git ignored `.data/test-pg/oct03-p4-p7-full/`：

- fresh数据库`fiscalhot_oct03_p4_p7qa_test`：35/35 migrations；`npm run typecheck`通过；`npm test` 234/234通过、0失败、0跳过。
- `npm run build -w @aihot/web`通过；`node --test apps/web/tests/*.test.ts` 15/15通过；preview `node scripts/smoke.ts --base http://127.0.0.1:3000` 30/30通过。
- 测试命令里的`MODEL_CALLS_ENABLED=true`仅用于仓库测试内的localhost fake providers；`tests/setup.ts`把credential目录指向`/nonexistent-test-credentials`，QA shell没有外部provider环境变量，仓库没有`.env`。采集、Jina fallback、IndexNow、Feishu、私网开关在该测试进程显式false。测试未对真实模型endpoint或官网发请求。
- preview DB smoke前后均以read-only事务核对相同：35 migrations；3 sources全部disabled且两项全文关闭；3 articles均`body_status=none/revision=1/body_text为空`；3 publications；analysis/receipts/job_runs均0。API/Web/PostgreSQL listeners只有`127.0.0.1:3001/3000/5432`，无55432；已有API/Web由忽略目录里的专用start脚本启动，脚本明确设相关安全开关false；未启动应用worker。
- 当前QA shell `MODEL_CALLS_ENABLED`为unset，不声称它显式false。没有`.env`和provider变量；本次运行中P4/P5工具均未触发该shell默认模型状态，只读取本地fresh test DB/模板。P4真实模型provider缺口详见下节。
- GitHub Actions `check.yml` run [37111577268](https://github.com/revercgy-hub/MYHOT/actions/runs/37111577268) 对head `1a15e3449e281ab4ce2137926f753a3f8a188f4a` 已成功：Docker与check jobs均success；CI backend tests 234项、233通过、0失败、1跳过（Windows-only monitor），Web tests 15/15。此结论验证软件测试/构建，不验证provider或来源质量；docs-only提交未重跑测试。

## P4真实模型provider缺口与停止边界

本机当前无`.env`，`LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`均无环境值；`.env.example`仅列DeepSeek等兼容模板，不是部署凭证。无可核验真实provider配置或key。只有Gate 2正式通过并另行授权后，才可由用户/负责人安全配置且只检查凭证存在性而不输出其值；随后按明确预算和receipt规则对固定、正文人工确认的样本执行小规模模型试点。当前不得启用`MODEL_CALLS_ENABLED`用于真实模型、不发送文章内容到provider、不启动worker，不把stub结果写作真实模型验证。

## P6/P7边界

当前只配置12个disabled sources。已识别的35个财政部驻地监管局机构目录/allowlist只是候选，不是35个可用feed或enabled来源；P6需要先调查25–35候选，再逐源取得selector、列表/详情、日期/分页/窗口、噪声与正文质量证据，通过review后才可配置。P7/Gate 4必须针对P4–P6之后实际待交付代码SHA重新做本地fresh `_test` 35 migrations、AGENTS现有typecheck/npm test/Web build/Web tests/loopback页面及smoke，并复核安全设置/DB/进程。当前软件代码CI和P4/P5准备工具通过不能称完整P7、Gate 4通过；不要新建重复测试harness。

## NEXT

1. 继续P3证据补齐；由Root决定何时把完整P3材料提交Sol正式Gate 2 review。通过前P4保持只读准备，不执行模型精选。
2. 需要Gold时由目标读者逐条确认候选、标签、事件组和development/holdout split，并增补合适难例；不自动采集正文、不把Luna proposal升级人工真值。
3. 只有Gate 2后且provider配置与预算由用户/负责人安全确认、固定样本正文已确认且队列隔离后，才单独核销真实P4 pilot。
4. Gate 3后调查/核验P6候选；P7对最终完整交付状态执行新鲜验收，并另行由Sol审Gate 4。

## 声明

基线`BASE_SHA=c335c71031becab5d9e7ec1c4dab90d223decd78`是本轮开始前代码/文档HEAD；历史项目基线仍为`589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`。代码tested/local head `1a15e...`与docs-only final HEAD分开记录。CI run `37111577268`已核验成功；本文件不宣称P4/P5、Gold、P6/P7或Gate2/3/4已完成。未记录的行为不视为已验证。
