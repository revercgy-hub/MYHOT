# 已确认规则实现与QA交接（2026-10-04）

STATUS=IN_PROGRESS
STAGE=P3/Gate 2证据仍在补齐；P4/P5仅有离线准备工具与模板
GATE=Gate 1 PASSED；Gate 2 NOT_PASSED；Gate 3 NOT_PASSED；Gate 4 NOT_PASSED
BRANCH=feat/fiscal-finance-hot
DOCS_BASE_SHA=a823166933049ed6521e7efea82f5aaf6b82e0a4
SOURCE_CONFIG_COMMIT=d7b49539e6981cff99b71c6f57c7053e2cda5b40（现有12源daily 1440分钟、首次回填3个月配置）
PROMPT_COMMIT=79a0f44330b50fe562ba54a03051c271cbc378e6
CODE_TESTED_SHA=79a0f44330b50fe562ba54a03051c271cbc378e6
CI_RUN=https://github.com/revercgy-hub/MYHOT/actions/runs/37137271384（success；docker与check jobs均success；backend 234项/233 pass/0 fail/1 skip；web 15/15）
DOCS_COMMIT=本交接所在docs-only提交；精确HEAD由提交后的Git核验记录
REMOTE=origin/feat/fiscal-finance-hot；代码提交已推送；文档推送后核对branch同步
WORKTREE=docs-only更改提交前含两份owner审计报告及本轮STATUS/plan/checklist/decision更新；最终状态以提交后Git核验为准

## 决策与实现状态

用户已确认Q1–Q5：首阶段逐一覆盖全国财政部地方监管局新闻动态栏目、中央选登只作补充；无实质业务事实的内部活动排除并纳入新政策/问题发现/监管措施/调研成果，地方一手不因传播范围降优先；业务附件无法可靠解析时保留原始URL、正文待解析、不自动精选，后续补能力；所有来源上线后每日检查一次；首次上线回填近90天，历史保留原发布日期且不删现有数据库数据。产品决定不等于实现或Gate通过。

- `industry/sources.json`现有12个source全部`interval_minutes=1440`，`_aihot.initialBackfillMonths=3`；静态检查确认12/12，且全部`enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`。source配置没有导入数据库，daily检查、collector和worker均未启动，既有source数据库行没有被本轮修改。
- Collector按30天/月以该配置筛选首次回填候选，故有发布日期的候选目标约90天；首次截止条件仍会保留缺`publishedAt`的候选。严格只纳入90天内有日期的条目尚未实现，待Root取得最小S1审查后再决定；通用collector的默认值12个月未修改。现有数据库记录未删除，增量仍走既有cursor行为。
- Q2内容边界已反映到`industry/prompts/prefilter.md`与`selection-score.md`。prompt loader/render focused 8项通过；这只是文本规则调整，不是硬过滤器、人工Gold评测或真实模型效果证明。
- Q3附件fallback仍未实现：系统没有把附件失败持久化为专门待解析状态/原附件URL，也没有据此阻断自动精选；通用`unconfirmed`仍可能继续分析与精选，不能把所有`unconfirmed`误判成附件失败。此跨模块边界待S1；本轮未改packages/apps/schema/UI、未下载附件/OCR、未启用模型或worker。最小S1审查请求本轮两次因agent thread limit未取得独立review，未绕过审查。
- Gate 2仍未通过；35局实际新闻栏目/selector/正文质量尚未逐一核实。P4/P5正式阶段未开始，真实P4 provider配置仍为后续前置；P6一般来源调查、P7/Gate 4也未完成。

## 全套验证与边界

本地完整日志存于Git ignored `.data/test-pg/oct04-rules-complete.log`，loopback smoke存于`.data/test-pg/oct04-rules-smoke.log`。fresh数据库`fiscalhot_20261004_rules_02_test`从空库完成35/35 migrations；`npm run typecheck`通过；`npm test` 234/234通过、0失败；Web build通过；Web tests 15/15通过；loopback preview smoke 30/30通过。preview smoke前只读核验既有库有35 migrations、3个source全部disabled/全文关闭、3条article、3条未精选publication且score为空、`job_runs=0`；服务与PostgreSQL仅监听loopback。没有查询或修改preview之外的持久业务库。

本地全套测试进程内`MODEL_CALLS_ENABLED=true`仅供tests中的localhost fake providers；采集、Jina、IndexNow、Feishu与private-network开关显式false；provider credential环境变量已从测试进程移除，`AIHOT_CREDENTIALS_DIR`指向不存在路径。未调用真实provider、未运行worker。CI `check.yml`对上述`CODE_TESTED_SHA`成功，backend 234项（233通过、0失败、1个Windows-only monitor跳过），Web 15/15；CI是软件验证，不验证来源覆盖、内容业务效果、provider或Gate 2。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：把用户已确认的日频、首次90天及财政金融内容边界转成有限行业配置/prompt更新，并完成安全隔离QA与交接。

**MODEL**：Luna High；项目真实模型调用为0。测试provider仅本机stub。

**FILES_CHANGED**：代码提交分别为`industry/sources.json`（`d7b4953`）及两份行业prompt（`79a0f44`）；本轮文档更新包括本交接、`STATUS.md`、`PROJECT_PLAN.md`、`GATE2_ACTION_CHECKLIST.md`、`GATE2_USER_DECISIONS.md`及两份链接的owner审计报告。未改source数据库行、全局packages/apps/schema、应用开关或GitHub workflow。

**TESTS_RUN**：fresh `_test`数据库35/35 migrations；`npm run typecheck`；`npm test` 234/234；Web build；Web tests 15/15；preview loopback smoke 30/30；source JSON 12项边界断言及`git diff --check`。GitHub Check run 37137271384对完整`CODE_TESTED_SHA`成功，Docker与Check均成功。

**RESULT**：配置仅表达disabled行业source的daily与约90天目标；prompt表达已确认的内容判断；没有开始运行、没有实际内容模型评估，也未改变Gate结论。代码CI成功。文档-only提交不改变代码tested SHA，最终HEAD另由Git记录。

**RISKS**：`initialBackfillMonths=3`以30天/月近似90天；无发布日期候选仍可保留，不能声称严格90天。source JSON值只有经受控导入/启用才会运行。prompt实际分类质量未知。历史Gate 2 hop/覆盖unknown不因本轮变动而追认。

**BLOCKERS**：严格排除无日期候选与附件失败后的“保留附件原链接/正文待解析/禁止自动精选”均尚未实现，待独立S1范围审查；该请求本轮因agent thread limit未获得review。35局逐一覆盖与Gate 2其余时窗、正文质量证据仍未闭环；P4 provider未配置，P4/P5正式执行未开始。

**NEXT**：先按Root取得的S1范围决定是否做最小日期/附件边界实现，再用本地fixture验证首次/后续cursor与精选安全；保持source disabled，继续逐局小批补足Gate 2证据。Gate 2正式通过及provider配置/单独授权前，不运行真实模型、worker或生产采集。最终docs HEAD、remote与clean状态以提交后核验为准。
