# 财政金融热点项目——WorkBuddy 日常工作交接书

交接日期：2026年11月4日。时间均为北京时间。状态：开发与NAS Staging试运行，Gate 3、4、5尚未整体通过。本文是接续工作交接，不是阶段通过或正式上线证明。

## 一、接手目标与工作方式

接手日常巡检、异常定位、正文与来源核验、精选质量整改、草稿审阅准备和验收证据整理。优先处理影响财政金融监管重点业务进入精选的问题，同时保持既有定时任务和数据安全。

已有业务取舍不要重复询问用户。可逆的代码修复、只读核查、离线重放和隔离测试应自主推进；只有确实涉及新增付费范围、业务口径变化或正式上线/发布等决策时，才将具体可审阅方案交用户决定。不能因一次检查或一个小样本通过就宣布项目通过。

本交接不自动向WorkBuddy提供账号权限。首次接手先验证本机仓库、SSH别名和NAS访问；缺少权限时向用户说明缺什么，不索取聊天中的密钥。

## 二、先读这些文件

按顺序阅读，历史记录发生冲突时，以有时间、版本和原始证据支持的较新记录为准；用户已明确的决定优先于文档。

1. 仓库根目录 `AGENTS.md`、`README.md`。
2. `docs/fiscal-finance/STATUS.md`、`SELECTION_RULES.md`。
3. 本交接书，以及 `NIGHTLY_RECOVERY_AND_SUBJECT_EVIDENCE_2026-10-31.md`。
4. `LOCAL_MODEL_DIAGNOSTICS_AND_HISTORY_BODIES_2026-10-30.md`。
5. `docs/fiscal-finance/PROJECT_PLAN.md`、`ACCEPTANCE.md`、`GATES_3_5_REMEDIATION_2026-10-29.md`，以及根目录《财政金融热点站完整开发与部署任务书.md》；验收按原任务书，不自行降低条件或发明通过分数。
6. 开发与变更时再读 `docs/fiscal-finance/LOCAL_DEVELOPMENT.md`、`docs/selection.md`、`docs/sources.md`、`docs/deploy.md`。

## 三、环境与版本

| 项目 | 位置或当前值 |
|---|---|
| Windows仓库 | `D:\AI-work\MYHOT\AIHOT`；父目录 `D:\AI-work\MYHOT` 不是Git仓库 |
| 分支 | `feat/fiscal-finance-hot` |
| 本次接手核验代码头 | `a65820135f0b959b0e6f0cdc3d78fb378199b056`；核验时工作区干净 |
| GitHub仓库 | `revercgy-hub/MYHOT`；gh命令显式带 `--repo revercgy-hub/MYHOT` |
| 最近代码CI | [Check41161576833](https://github.com/revercgy-hub/MYHOT/actions/runs/41161576833)，上述代码头全部成功 |
| 本机Node | `C:\Users\cnyyc\.codex\tools\node-v24.16.0-win-x64\node.exe`；默认Node可能为22，不能直接替代 |
| 本机隔离PG工具 | `.data/test-pg/pgsql/bin`；既有测试集群使用loopback端口55438，实际运行状态须现查 |
| NAS SSH | 别名 `fnnas`；配置 `C:\Users\cnyyc\.ssh\config.txt`；192.168.3.100，端口22 |
| Staging站点 | `http://192.168.3.100:3221` |
| Staging容器 | `fiscalhot-staging-api-1`、`fiscalhot-staging-web-1`、`fiscalhot-staging-db-1` |
| Staging数据库 | `fiscalhot_staging`；容器用户从现有配置读取，不猜用户名或密码 |
| 实际API镜像 | `sha256:ee9ead66eb33d557bbc6206c975ed9649b87973a6de15b4049b4f18543ec54ba`；11/4核验running、restartCount 0 |
| 本地模型 | NAS Ollama gateway `http://192.168.3.100:11435/v1`；qwen3.5:9b，digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` |
| 私有证据 | 本机 `.data/fiscal-qa/`；NAS `/vol2/1000/docker/` 下对应证据包，通常mode600 |

**源码与运行版本有差异。** 结构化机构原文依据保护已在开发源码修复并通过CI；尚未部署整体API或替换夜间228文件冻结源码。NAS理解任务r4只安装了导出端口修复。不要把开发分支测试通过写成NAS已经应用全部改动。

## 四、11月4日最新核查事实

以下数据库快照采于11月4日19:49；不是10月31日的旧计数。

| 指标 | 核查值 |
|---|---:|
| 文章 / 修订 / 发现 | 669 / 1052 / 669 |
| 正文ok / pending / unconfirmed | 480 / 176 / 13 |
| 有ok正文样本的来源 | 36 |
| 配置来源 / 已打开采集或全文开关的来源 | 48 / 0 |
| publications / editorial_overrides | 137 / 137 |
| Staging receipts / receipt_attempts | 31 / 31 |
| Gold人工样本 | 200 |

来源开关全关闭与既有有界采集任务并存，是当前试运行方式。不要为了让数字“好看”打开全局worker或来源开关。

- **理解任务r4：** 11月1日02:00实际COMPLETED，8请求、8 attempts，state有预测与回执hash。11月2日至4日cron连续记录NOOP_TERMINAL。它没有形成每日连续运行证据。先核对有界pilot的终态设计；如需恢复每日运行，按日状态设计须保留历史终态、同日幂等和每日调用上限，不能删除COMPLETED或失败state来触发重跑。
- **摘要r10：** 11月1日、2日候选0；11月3日候选10、完成回执10；11月4日候选3、完成回执3。两日日志均无failed/unknown/pending回执。仍须逐篇核对实际草稿、内容HOLD/拦截情况与人工审阅，不能直接称“新增13篇合格摘要”。
- **采集：** 11月4日12:00为46/46成功、新增5；18:00为42/46成功、新增8、详情尝试6，并出现一条财政部来源身份不一致提示。18:00失败来源及原始响应尚待WorkBuddy逐项核验；“COMPLETE”不能代替“所有来源成功”。
- **备份：** 11月4日01:00日志为VERIFIED，2,538,917字节，dump SHA256 `d4f754e79c6f393c4289a98de2c22eb61c95178b57e8a32a617f21f766a3d17a`。本次仅核查日志，未实际恢复该份最新备份。10月31日备份曾在本机独立库实际恢复通过，不能冒充11月4日恢复证明。

本次只读快照保存在 `.data/fiscal-qa/workbuddy-handoff-snapshot-20261104.json`。上述新日期状态与日志检查不代替完整artifact、草稿质量和多周期验收。

## 五、已确认的精选业务口径

用户明确：“直接属于财政金融监管业务，就应优先评估精选”，原因是相关工作是当前重点。涵盖财政贴息、融资担保、创业担保贷款、普惠金融政策落实、金融企业财务及国有金融资本监管、金融风险识别监测处置等。

- 优先评估不等于自动精选；没有大金额、处罚结果或首次发明的方法，不是机械排除理由。不能仅因工作总结、经验稿形式而压低具体业务。
- 国家级重大民生政策纳入评估，即使没有明确财政资金安排；普通地方活动和一般科普不自动享有该地位。
- 一般预算、转移支付、会计师事务所检查、国有资本收益审核不自动套用金融监管优先；重要政策、风险和具体结果仍正常评估。
- 银行网点、金融服务中心、产品推广，与财政金融监管不是一回事。单期现金招标、单批彩票游戏审批不自动成为制度改革；彩票资金管理普遍规则修订要分开判断。
- 央行常规公告放全部动态，有重要操作或政策变化时才精选。
- 保留八种itemType、五轴加权、噪声压制、安全边界；T1/T1.5/T2当前60/65/76，不凭感觉改值。标题、摘要、机构名单和地域标签必须有原文或已确认身份依据。

用户九篇具体决定已写入私有Gold v5：现金招标、批量彩票批准、山西会计检查、台胞服务中心、云南资金监管案例、湖南国资收益审核六篇均仅全部动态；会计解释征求意见、彩票市场调控资金办法、厦门普惠金融监管三篇精选。保留具体决定，不再次要求用户重复回答。

## 六、验收缺口及接手任务单

| 优先级 / 任务 | 立即做什么 | 可交付的完成证据 |
|---|---|---|
| P0 日常链路与终态 | 核验11/1 r4原始预测、脱敏回执、dump与hash；解释连续NOOP_TERMINAL，审查按日接续方案；保留旧state | 时间/版本清楚的运行台账；同日不重试、跨日边界和每日预算测试；实际新日期运行证据 |
| P0 摘要人工审阅准备 | 收集11/3、11/4 roster、每个result、回执和草稿；对照原文检查事实、金额、日期、分类、机构及福建/厦门标签 | 逐篇“合格候选/需改/保留HOLD”表和理由；不能自动签成人工通过或公开发布 |
| P0 精选质量 Gate 3 | 先读现有完整评估和错例；区分业务口径、模型能力、提示词理解及算术问题；实验冻结输入、代码、预算、回执 | 完整development复测、分层FP/FN及新独立事件验收；不靠反复看旧holdout或十篇熟悉样本宣布通过 |
| P1 来源与正文 Gate 4 | 先查缓存和既有HTTP证据，再判断是否需要新请求；处理5条历史HOLD和当前pending/unconfirmed；补来源分页与90日窗证据 | 原始响应/EOF/hash、身份日期、正文边界、离线重放、来源范围及覆盖报告 |
| P1 开发到运行版本差异 | 准备机构依据保护的整体API或冻结运行源码升级方案，核对镜像、依赖、hash、回退及夜间任务绑定 | 完整检查和可回退部署证据；不能直接把单个新文件塞进旧冻结树 |
| P1 稳定性 Gate 5 | 备份、理解、摘要、采集分别按实际周期核验；再验证worker、归组、日报与公开出口端到端流程 | 多个真实稳定周期、非空内容质量和端到端证据；单个COMPLETED/HTTP200/CI绿不能替代 |

### 精选评估现状与费用边界

- 完整本地development150：TP8/FP15/FN13/TN114，查准34.78%、查全38.10%，不合格。200人工样本中24精选/176非精选；development150为21/129。旧holdout50已查看/使用，不能再称未见独立验收。
- 已批准的第一轮DeepSeek：10篇、20次评分、无重试；TP3/FP0/FN4/TN3，匹配6/10。费用按当时高峰价保守估计0.12082元，**实际账单未查询**；没有切换正式模型。
- 10/31新说明候选免费本地20次：TP5/FP3/FN2/TN0，匹配5/10。减少漏选但误选仍在，**未采用、未扩大150**。文件 `industry/prompts/selection-score-dimensions-work-value-candidate.md` 只是开发候选。
- 第二轮DeepSeek仅有待批方案：`.data/fiscal-qa/deepseek10-workvalue-proposal-20261031/proposal.json` 和同目录 `方案.md`。拟新增20次，同10篇同模型仅换规则，请求累计40次、费用累计上限仍5元。原20次请求授权已用完，**没有第二轮明确批准，不能执行**。10/31估价已过时，执行前必须重新核验官网价格、整批与累计预算、源码和输入hash；不得只看到Key存在或剩余金额就调用。
- 现有付费凭据在本机忽略目录 `.data/credentials/deepseek-comparison/models.env`；不在交接书、日志、Git或消息中复制密钥。运行仍走回执及预算熔断，不绕开现有保护器。

### 正文与来源遗留

63条历史元数据补缺中，58条正文已补全，5条HOLD清单见 `.data/fiscal-qa/historical-final-five-holds-20261030.json`：海南转移支付绩效抽查、海南资产盘点、海南单位决算、广西单位决算、广西养老保险补助结算审核。

已有原始响应及拒绝原因，先离线核验；不得放宽身份/日期/正文容器保护来“凑通过”，不得重复GET已捕获、已失败或待审的URL。附件/OCR此前延期，不自行改成付费OCR或另购服务。海南、广西、四川已有两遍一致的有限历史窗证据，仅是archive window snapshot，不代表全部来源准入或持续覆盖合格。

## 七、日常任务安排

沿用现有定时任务，**不另建一套重复cron**。

| 时间 | WorkBuddy日常工作 | 输出 |
|---|---|---|
| 08:30左右 | 核查01:00备份、02:00理解、03:30摘要、06:00采集；检查运行日期、原始结果、回执、失败原因、共享锁及资源 | 一份晨检台账；有异常列出事实、影响、处理动作和未决事项 |
| 上午 | 优先审阅重点财政金融业务的精选漏选及新草稿；按P0/P1推进一个可验证修复或一批离线核验 | 错例/草稿逐条表，或带测试和回退说明的变更 |
| 12:15以后 | 核查12:00采集，区分全部成功、部分失败和未运行；核对新增数与raw evidence | 更新同一台账，避免重复告警或重复抓取 |
| 18:15以后 | 核查18:00采集、当天代码与运行版本差异、未结风险和次日任务 | 日结简报，优先写业务进展、阻塞及需要用户决定的事项 |
| 每周一次 | 在独立测试库实际恢复近期备份；复核来源覆盖、失败趋势、预算与回执；清查有归属且已备份验证的临时资源 | 恢复报告、来源/质量趋势及下一周任务排序 |

无变化的健康检查只写台账，不反复打扰用户。有数据丢失风险、明确任务失败、持续来源缺口、费用异常或需要业务决策时及时通知。不要将自动修复完成但尚未经过实际周期验证的事项写成“已稳定”。

## 八、运行入口和证据位置

| 事项 | NAS位置 |
|---|---|
| 理解任务 | `/vol2/1000/docker/fiscalhot-understand-nightly/`；`tools/nightly-entrypoint.sh`、`state/ollama-understand-nightly-r4.state.json`、`results/`、`logs/cron.log` |
| 摘要任务 | `/vol2/1000/docker/fiscalhot-summary-draft-nightly-20261028/`；`logs/summary-draft-YYYYMMDD-0330.log`、`state/` |
| 摘要roster / 草稿 | API容器 `/data/summary-draft-rosters/`、`/data/summary-drafts/` |
| 采集任务 | `/vol2/1000/docker/fiscalhot-latest-collector-20261028/logs/cron.log`；API容器 `/data/operators/runs/daily-latest-YYYYMMDD-HHMM/` |
| 备份任务 | `/vol2/1000/docker/fiscalhot-pg17-backup-nightly/`；API容器 `/data/pg17-daily-backups/` 下各runId |
| 共用锁 | `/vol2/1000/docker/fiscalhot-understand-nightly/state/ollama-understand-nightly.lock`；必须复用，不删除、不截断、不另建替代锁 |

最小接手检查示例（PowerShell，均只读）：

```powershell
Set-Location D:\AI-work\MYHOT\AIHOT
git status --short
git log -1 --oneline
& 'C:\Users\cnyyc\.codex\tools\node-v24.16.0-win-x64\node.exe' --version
ssh -F "$env:USERPROFILE\.ssh\config.txt" -o BatchMode=yes -o StrictHostKeyChecking=yes fnnas 'docker ps --format "{{.Names}} {{.Status}}"'
```

只读数据库盘点可参考 `.data/fiscal-qa/source-readiness-snapshot-20261031.mjs`；NAS现有副本 `/data/operators/source-readiness-snapshot-20261031.mjs` 需先确认存在。切勿打印完整环境、凭据配置或包含Authorization的请求。

## 九、代码、数据变更的检查要求

1. 先确认当前分支、工作区、实际运行镜像、目标库及文件归属，保留其他未提交修改；不要覆盖或清理不属于本任务的内容。
2. 开发和测试使用Node24及新建的loopback `*_test`/`*_ci`库，先迁移；不对Staging库执行测试。不得在完整测试时加载真实凭据或访问真实服务。测试可按现有stub机制临时开模型调用，日常服务开关保持关闭，详见LOCAL_DEVELOPMENT。
3. 代码修改完成至少执行 `npm run typecheck`、新隔离库 `npm test`、`npm run build -w @aihot/web`、`node --test apps/web/tests/*.test.ts` 及运行站点smoke。最后已确认本地完整601项594通过/7条件跳过，Web25；条件跳过不是实际验收通过。
4. GitHub feature分支push不自动触发本仓库Check；需要时显式 `gh workflow run check.yml --repo revercgy-hub/MYHOT --ref feat/fiscal-finance-hot`，记录对应SHA和结论，不引用旧CI冒充新代码验证。
5. NAS数据库回写必须先形成精确目标和输入hash、新一致性备份、零写入预检，在原共享锁内按CAS提交；独立复核旧文章/修订、source、Gold、publications、receipts及队列等受保护行。已有成功脚本按冻结批次绑定，不能改几个参数就盲目复用。
6. 安装或升级前准备可审阅版本、备份与回退，保持API、collector catalog、数据库source配置、nightly冻结文件及hash绑定一致。不要直接覆盖冻结脚本、修改pin绕过检查或重置失败状态。
7. 不提交 `.env`、密钥、`.data/`、Gold原文和私有数据库备份；私有证据单独保存，NAS文件mode600、目录700。删除临时容器前核对精确ID、镜像和归属，并确认所需数据已备份且可恢复。

## 十、关键证据与接手验收

| 证据 | 位置或校验摘要 |
|---|---|
| Gold v5 | `.data/fiscal-qa/gold-human-review-20261029-v5/gold200-reviewed-manifest-v5.json`，SHA256 `eee411a8ef87cab8fe2659c001cf6dc8a2954d5c3d99c2e426dae743d6417427` |
| 完整150评估 | `.data/fiscal-qa/development150-dimensions-r2-20261030/`；含review、独立回执QA及15个隔离库证据 |
| 第一轮付费对照 | `.data/fiscal-qa/deepseek10-approved-20261030/`；完成归档SHA256 `3e45557f3f90d626e3e87bc9b2caa74de2c3b1c53103879dc3f849fddacaeb9c` |
| 新说明本地对照 | `.data/fiscal-qa/workvalue10-dimensions-20261031/`；归档SHA256 `51f4a370885375005e037672159da0b0883995bfbfbcff7e98b20e3a87079a2f` |
| 10/31夜间取证恢复 | `recover-understand-20261031-completed-evidence.tar.gz`，SHA256 `24172e25764efb7eec0275f148746f0db4d44a6b3fdeaa70ce2e69f938551e64` |
| 10/31周期与备份恢复 | `nightly-cycle-audit-20261031-completed-evidence.tar.gz`，SHA256 `047860543f2e7333af6feb039c879ec90bb427b40d53dea011545bbc20566584` |

上述归档在本机 `.data/fiscal-qa/` 与NAS `/vol2/1000/docker/` 有对应副本。接手先核验可读性与hash，不重新生成或覆盖原证据。

**首次接手应交付：** 最新版本/运行/计数台账；11/1理解成功及之后终态的核验说明；11/3和11/4摘要逐篇核查表；11/4 18:00采集失败来源表；按P0/P1排序的下一步。无需重新让用户确认已给出的九篇判断和财政金融监管优先原则。

**每日简报模板：**

```text
日期（北京时间）：
今天完成：具体业务结果、变更版本、验证证据。
运行状况：备份 / 理解 / 摘要 / 采集；明确空运行、部分失败和未运行。
质量进展：精选错例、草稿审阅、正文与来源证据；不混淆开发样本和独立验收。
尚未通过：对应Gate及真实缺口。
下一步：可自主执行的事项、交付物和验证方式。
需要用户决定：仅列新增费用范围、业务口径或正式发布等真正决策；无则写“无”。
```

## 十一、可直接交给WorkBuddy的启动指令

> 请接手 `D:\AI-work\MYHOT\AIHOT` 的财政金融热点项目日常工作。先读本交接书、AGENTS.md、STATUS.md及SELECTION_RULES.md，核查当前Git、NAS实际版本和最近定时任务证据，再按本交接书的P0/P1任务及每日安排持续推进。优先解决精选漏选和摘要质量；已有业务取舍不要重复问。保持原类型、五轴权重和门槛，不重置终态凑成功，不自动扩大付费请求，不启用全局采集/模型/发布，不在日志或聊天中输出密钥。可逆修复、只读检查、离线核验与隔离测试自主完成；真正需要用户决策时，先把具体方案与证据准备好再询问。每次变更记录版本、测试、原始证据、回退和剩余缺口。当前Gate 3–5尚未整体通过，不把单项成功写成项目完成。
