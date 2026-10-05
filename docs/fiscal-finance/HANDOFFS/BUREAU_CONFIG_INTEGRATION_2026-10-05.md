# P3 检查点：三局disabled配置、集成QA与区域来源观察（2026-10-05）

STATUS=IN_PROGRESS
STAGE=P3 / Gate 2 remediation
GATE=Gate 1 PASSED；Gate 2 NOT_PASSED
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=本次文档基于代码HEAD `a00795ea5911afaa2bdf4ac31580b29a9c84a33c`；文档提交后当前HEAD请由 `git rev-parse HEAD` 实时读取，代码SHA与docs HEAD分开记录
STAGE_CODE_SHA=a00795ea5911afaa2bdf4ac31580b29a9c84a33c
CI_TESTED_SHA=a00795ea5911afaa2bdf4ac31580b29a9c84a33c
CI_RUN=37281829324，Check success；Linux backend 252 tests / 251 passed / 0 failed / 1 Windows-only monitor skip；[GitHub Actions](https://github.com/revercgy-hub/MYHOT/actions/runs/37281829324)
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
ROUND_BASE_SHA=c73473b386c9724ab9d14aded97df3bf2f8e7cd7
WORKTREE=代码commit `6a8dcb4`、`a00795e`及其CI已完成并推送；本检查点与共享QA文档由单独docs-only commit提交。最终状态由文档提交/推送后`git status --short`与`git status -sb`实测记录。

## 阶段退出条件与结论

本轮完成三局disabled source配置、saved-fixture parser/config测试、北京详情identity两阶段collector/数据库/显式extract集成测试和signals本地fake-provider测试隔离；本机完整软件回归通过，最终代码SHA对应CI也成功。此结果不表示福建、北京、上海来源通过，不证明35局覆盖，亦不改变Gate 2正式状态。Gate 2仍`NOT_PASSED`，P3继续进行。

## 完成内容与可复核证据

- 代码commit `6a8dcb4`（`test(signals): isolate local provider fixtures`）只改`tests/signals.test.ts`，为既有localhost embedding stub局部启用`EMBEDDINGS_ENABLED=true`并将review profile定向到同文件已有Deepseek localhost stub；真实provider配置与全局runner安全开关未改变。
- 代码commit `a00795e`（`feat(sources): add disabled regional bureau feeds`）新增`mof-fujian-supervision-dynamics`、`mof-beijing-supervision-dynamics`、`mof-shanghai-supervision-dynamics`三项T1 first-party `web_list` 配置，更新source-rules总数断言，添加6个saved HTML fixture、fixture config test与数据库集成test。三条来源目标间隔1440分钟、首次严格90天且要求发布日期、`enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`。没有改`apps/`、`packages/`实现、schema或migration。
- 配置与fixture实现报告：[配置QA](../OCT05_BUREAU_CONFIG_IMPLEMENTATION.md)；数据库衔接报告：[集成QA](../OCT05_BUREAU_INTEGRATION_QA.md)。集成在Node 24.16及PG17.11 loopback新库`fiscalhot_oct05_bureau_integration_test`跑35 migrations；integration 1/1、source-rules 12/12和typecheck均通过。集成输入正文、压力行和矛盾身份数据为合成fixture，不是新闻原文；没有真实collector、worker、模型或外网请求。
- 最终本机完整回归：全新`fiscalhot_oct05_bureau_final_rerun_test`应用35 migrations；Node24 `npm run typecheck`通过、`npm test` 252/252、0 skip。日志在`.data/test-pg/oct05_bureau_final_rerun_{full,npmtest,typecheck,migrate,migration_count}.log`。测试环境`MODEL_CALLS_ENABLED=true`仅用于本地fake provider；全局embeddings、COLLECT、Jina fallback/skip、Feishu、IndexNow、private-network及OCR flags关闭；真实provider key/base URL已清空，credentials目录不存在，`.env`不存在。
- Web build本机通过，存在Vite client chunk >500KB警告；Web tests 15/15；`node scripts/smoke.ts --base http://localhost:3000` 输出28/28通过。API/Web/Postgres分别仅监听127.0.0.1:3001/3000/5432，没有worker。预览库`fiscalhot_preview_test`只读复核35 migrations、三来源disabled、三篇固定article仍`body_status=none/revision=1`且正文长度0、analyses/receipts/job_runs均0；未导入新的15条JSON来源。
- GitHub Check run 37281829324对最终代码SHA `a00795ea5911afaa2bdf4ac31580b29a9c84a33c`成功；Linux后端实际252项中251通过、0失败、1项Windows-only monitor skip。CI另外通过Install、typecheck、Web build/tests、migration/seed、built-site smoke和Docker smoke。不能把Windows本机252/252说成Linux CI结果。
- 本地起初full suite有3项signals test失败。离线诊断确认1项由测试运行器全局embeddings=false覆盖本地fake embedding fixture造成；2项因测试profile落到Mimo而未连该文件已有Deepseek localhost fake server。上述只通过`tests/signals.test.ts`局部fixture wiring修复；没有backend/provider路由变更，未调用真实provider。修复后才执行一次新fresh库完整回归。

## 来源逐项记录

| 来源 | 当前状态与已知事实 | 未完成验证 |
|---|---|---|
| 福建 `mof-fujian-supervision-dynamics` | disabled配置；10/04保存栏目列表与一条真实详情；10/05同URL再次直接读取一次。两时点间隔32小时22分10.133秒，HTTP200、bytes/hash一致、离线`fromHtml` 10/10候选相同。Fixture集成只证明限额与代码路径。 | 真实collector写库与正文抽取、标题/日期与正文业务质量、分页/窗口、跨周期更新和source pass。 |
| 北京 `mof-beijing-supervision-dynamics` | disabled配置；一条详情的列表日2026-09-24、权威`PubDate` 2026-09-30，详情title省略“财政部”前缀。集成fixture证明metadata更新后首轮identity拒绝仍持久化并排队，后续显式extract可以使用persisted identity。10/05列表复查HTTP200且10/10候选无变化。 | 真正数据库对官方详情的collector/queue/body路径、日期及正文业务质量、分页/窗口、跨周期更新和source pass。Fixture不是线上行为证据。 |
| 上海 `mof-shanghai-supervision-dynamics` | disabled配置；10/04保存栏目列表与一条真实详情且列表日/PubDate匹配；10/05同URL再次GET，HTTP200、bytes/hash一致、10/10候选相同。Fixture集成验证最多详情数及重跑不变。 | 真实collector写库/正文、分页/窗口、跨周期更新、噪声质量和source pass。 |
| 第四批江苏、浙江、安徽、江西 | [batch4报告](../REGIONAL_BUREAU_BATCH4_2026-10-05.md)与矩阵已离线核验：首页4次、栏目3次、浙江包装页1次，该批cap8合计8/8 dispatch、0拒绝，24 Undici事件，raw bytes/SHA匹配。后续对浙江JS目标另有单独cap=1的授权GET，见[浙江target QA](../REGIONAL_BUREAU_ZHEJIANG_TARGET_2026-10-05.md)：返回“图片新闻”9项列表、2023-12-28—2026-09-11、0 PDF。这只是一子页样本，不是目标动态栏目全覆盖。 | 四局均无详情、无collector/DB、无分页历史或跨周期证据；浙江“动态简讯”整体目标范围仍未知。 |

短间隔观察原始报告：[福建、北京、上海复查](../REGIONAL_BUREAU_FOLLOWUP_2026-10-05.md)。旧时间`2026-10-03T23:13:00.189Z`、新起点`2026-10-05T07:35:10.322Z`，毫秒差116,530,133，等于32小时22分10.133秒，上海日期从10月4日跨至10月5日。候选无变化只是一对手动快照，不表示daily scheduler运行、连续稳定或Gate通过。第四批与浙江各次请求和证据边界见[区域覆盖矩阵](../REGIONAL_BUREAU_COVERAGE_MATRIX.md)。

## 环境与安全边界

已有EDB PostgreSQL 17.11 loopback服务绑定127.0.0.1:5432；本轮新建且仅用于测试的`*_test`库不触碰预览库。API 3001/Web 3000是已存在的preview配置安全开关false loopback服务，无worker。完整测试只用本地fake provider，移除真实keys/base URLs和凭据目录；任何collector/scheduler/job worker均未启动。15项industry source JSON没有导入数据库，所有source保持disabled，全站正文许可关闭。没有OCR、Jina、外部模型、真实source collector、详情跟进或正式数据写入。

## 未完成项、风险与阻塞

- Gate 2仍未通过。35局中4局有独立配置（厦门既有、福建/北京/上海本轮新增），14局有目标新闻列表页观察，另浙江图片新闻子页有一次列表观察但栏目范围未确认；福建/北京/上海各只有一条详情样本；另19局缺独立页面观察。标题日期、业务内容、分页/历史、噪声和跨周期更新仍有缺口。
- [三局真实验证计划](../BUREAU_REAL_VALIDATION_PLAN_2026-10-05.md)只作离线方案；建议先单独审阅北京collector请求前hard cap=11，再由Lead为显式body阶段另核销cap=1。福建/上海后续分别分批。其69次guarded fetch/414个理论dispatch只用于说明多个阶段累积风险，不是获批额度。该计划不建议backend/schema更改；本轮未执行真实collector或新增网络/数据库步骤。
- P4真实provider配置仍未提供且按先前决定保留在Gate2后；P5人工Gold未完成；P6/P7和Gate4未完成。软件测试绿不等于source验收。
- 9/30旧批次HTTP预算unknown照常保留；新批次硬预算通过不追认历史旧unknown。

## 下一批 Agent

先由Lead审阅三局真实验证计划中北京单局11-dispatch建议及显式body单独cap=1。获准之前保持所有source disabled，不运行collector、worker或真实模型。获准后逐阶段使用fresh测试库，沿用request前Undici budget hard cap、固定host/path、达到cap即停止并标记partial/NOT_PASSED。福建和上海另批；其他监管局按覆盖矩阵继续有限首页/栏目/详情审查。P4、Gold与P7准入仍按各自计划执行。

## 声明

记录区分本地synthetic fixtures、手工HTTP快照、真实collector/DB测试和GitHub软件检查；它们互不替代。本检查点未声称Gate 2通过、全国栏目覆盖、来源长期稳定、90天全量回填或真实模型质量。文档提交后的当前HEAD用`git rev-parse HEAD`读取，`CHECKPOINT_CODE_SHA`和`CI_TESTED_SHA`保持指向实际测试代码，不将文档提交SHA嵌入自己。
