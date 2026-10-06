# S1 Phase C 上海来源证据检查点 — 2026-10-06

STATUS=IN_PROGRESS
STAGE=S1 Phase C evidence preparation
GATE=Gate 2 NOT_PASSED；上海仅EVIDENCE_PACKET_ONLY / NOT_ADMITTED
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=a9647ef7a99fa85171284bf547f781ea92f1cdd7（source-doc checkpoint提交前HEAD；本次commit仅docs）
STAGE_CODE_SHA=b85f4e21f049571c4fc67ccb8553b8ea2f0a0b88（代码未变，仍为已fresh测试与CI验证的Phase B代码）
BASE_SHA=290f55cafe8f42289c9efb7b76a9ae5c92e6ae0a（本Phase C恢复轮起点；Round base）
WORKTREE=本次stage仅包含本handoff、上海source evidence packet及两份probe/date报告、WEB_LIST_SOURCE_ADMISSION_MATRIX和共享STATUS/PROJECT_PLAN。B-owned `scripts/fiscal/ocr-scan-poc.ts`与其未完成文档保持unstaged；未并入本commit。

## 结论和阶段边界

上海 (`mof-shanghai-supervision-dynamics`) 是Lead当前指定的首个 Phase C 证据候选，但仍**未准入**。两次彼此独立核销的单次请求分别获得本源 page 1 列表与其一条详情。QA重新哈希page 0两份raw、page 1 raw和详情raw，并离线复核列表/详情日期字段。它们只补足这个来源的有限身份、相邻页和日期样本；不证明网页自报50页、90天回填、真实末页、跨周期稳定、正文ready或Gate 2。

所有19个source配置仍disabled，全文关闭，无pagination opt-in。本轮没有改industry配置、代码、数据库、worker、collector、模型或OCR。本checkpoint只记录证据状态；Gate 2保持`NOT_PASSED`。

## 仓库和质量基线

- 当前feature分支代码SHA仍为`b85f4e21f049571c4fc67ccb8553b8ea2f0a0b88`，fresh本机测试296/296、typecheck、Web build/tests 15/15通过；对应CI run 37412301808 Check与Docker jobs成功。复用Phase B报告，本checkpoint没有重跑这些检查。
- 本Phase C恢复round base为`290f55cafe8f42289c9efb7b76a9ae5c92e6ae0a`。单独恢复环境checkpoint见[RECOVERY_SAFETY_CHECKPOINT_2026-10-06_PHASE_C.md](../RECOVERY_SAFETY_CHECKPOINT_2026-10-06_PHASE_C.md)。
- Phase A/B只批准了各自的受限工程实现范围；不是source admission。Phase C readiness proposal仍是设计建议，不改变Gate状态。

## 上海样本与独立核验

**列表 page 0：** 10/4与10/5保存的两份同源页面各12,617 bytes；QA重新计算SHA-256均为`cbbd59f4ac4dea453140f497543ed156c2324dee336366a430d57ab97a1eebce`。离线parser观察均10个候选、0页内重复。

**列表 page 1：** Lead单独核销的唯一URL为`https://sh.mof.gov.cn/gzdt/caizhengjiancha/index_1.htm`。manifest记载GET、HTTP 200、final URL不变、12,816 bytes、1/1 dispatch、0 reject、0 redirect/retry，raw SHA-256为`b8c5ec2033bbadd10d48b43a29c3e2b9d32a3e9648fe342e2eb9d3bd473adcdc`；QA独立核实bytes/hash与manifest一致。配置parser观察10个唯一候选，与page 0 URL交集为0；page 0显示日期从9/28到8/28，page 1从8/27到7/24，相邻边界接续。page 1有3/10列表日与URL日期token不同，并包含一条PDF。`countPage=50`是页面JS自报值，未逐页验证。

**详情：** 对应page 1第8行的精确URL为`https://sh.mof.gov.cn/gzdt/caizhengjiancha/202607/t20260728_3994403.htm`，由另一张one-shot marker和独立dispatch预算控制。manifest记录HTTP 200、HTML、final URL相同、18,945 bytes、1/1 dispatch、0 reject、0 redirect/retry；raw SHA-256 `b5b98612935674920813e045fb707d8cd55719008110d60aaa0e518d8f1037d3`，QA重算吻合。保存page 1行的title、URL、display date与详情manifest一致。页面可见且标注“发布日期：2026年07月31日”；URL路径token是2026-07-28。配置`PubDate`规则读取`2026-07-31 08:17:00 +08`。列表date-only午夜与详情instant相差8小时17分；单篇不能证明source-wide `PubDate`原始发布日期语义。

QA在离线raw上独立用LinkeDOM去除`.my_doccontent`中的style/script/noscript，再统计文本：唯一selector 1个，1,641字符、9个段落、0表格、0列表项、0附件链接。详情manifest初次`textCharacters=3089`包含容器内CSS；清理后的复算与报告一致。这只是静态DOM结构观察，**不是** extractor结果、`body_status=ok`、内容完整性或S4 readiness。

## 请求与安全边界

两次请求分别为listing page 1与一条详情，不共享预算或重试；均为1次实际dispatch、HTTP 200、没有redirect/retry。所有provider、Jina、采集、Feishu、IndexNow、OCR和私网开关均由各自runner显式关闭；manifest显示provider credential env name为空。没有附件请求、数据库、collector、worker或模型调用。QA只读取已保存manifest/raw并离线parse，没有再请求官网。

既有上海collector报告的一次重复列表超时仍保留为失败/partial证据；本轮的只读HTTP成功不覆盖它，也不构成两轮collector稳定性。

## 文件、核验和结果

**TASK**：QA复核上海Phase C证据包原始manifest/hash/date对照，并更新source admission矩阵和共享状态；不作source准入。

**MODEL**：GPT-6 Luna High；无项目provider/model调用。

**FILES_CHANGED**：新增本handoff、[first-source packet](../PHASE_C_FIRST_SOURCE_EVIDENCE_PACKET_2026-10-06.md)、[page-1 probe](../SHANGHAI_PAGE2_PROBE_2026-10-06.md)、[single-detail review](../SHANGHAI_DATE_CONFLICT_DETAIL_2026-10-06.md)；更新[admission matrix](../WEB_LIST_SOURCE_ADMISSION_MATRIX_2026-10-06.md)、[STATUS](../STATUS.md)与[PROJECT_PLAN](../PROJECT_PLAN.md)。未改代码、source config、数据库或migration。

**TESTS_RUN**：无software tests、typecheck、build、CI或smoke。离线重新读取并hash 4个列表/详情raw，核对两个one-shot manifest的URL、HTTP/budget字段及list/detail date binding；用现有LinkeDOM依赖离线去除style/script/noscript后统计正文容器，不写业务状态。不运行collector、worker、OCR或model。

**RESULT**：`EVIDENCE_PACKET_ONLY / NOT_ADMITTED`。Source仍disabled、full-text off。Gate 2仍`NOT_PASSED`；coverage仍unproven。

**RISKS**：样本只有两页和一条详情；页数声明、深层历史、时间排序、老边界、source-wide日期定义、日期精度策略、PDF/S4正文能力、跨周期稳定性未知。之前的repeat-list timeout仍在。

**BLOCKERS**：尚无Phase C source-specific S1 admission裁定；尚未证明90天连续窗口/terminal。列表date-only与detail instant不同，PDF行正文未核验。无source opt-in、complete、incremental或reset状态。

**NEXT**：Lead/S1只审阅这份有限packet中的日期语义、list精度和后续历史/terminal所需证据。任何进一步GET需新的精确批准；任何source opt-in、completion、reset或incremental实现需独立S1范围。B-owned OCR工作保持独立；OCR真实执行仍blocked，不能由本source checkpoint推断。

## 声明

本交接区分网页自报值、保存原始响应、运行manifest和QA离线复算；证据没有覆盖的事实保持unknown。本文件及其链接材料均不把候选写成source pass或Gate通过。
