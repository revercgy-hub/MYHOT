# JSONB 幂等性与福建分页配置检查点（2026-10-11）

STATUS=IN_PROGRESS
STAGE=P3来源主线与本地开发预览维护；本次完成受限实现QA，不代表P3/Gate退出
GATE=Gate 2 `PASSED_FOR_BOUNDED_P4_PILOT`，只适用于正式review限定的三个source逐篇小样；本轮Gate与source admission均无变化
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=c133db772d1718281fed55bef3a1d2390ed39245（文档提交前HEAD；代码已提交并推送，文档本次另提交）
STAGE_CODE_SHA=c133db772d1718281fed55bef3a1d2390ed39245（两个小代码提交合并后的精确SHA）
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
RECOVERY_SHA=3e6ee8e92c8314a229c54200ced40d165e0b7c77（本轮实际起点，clean HEAD）
TESTED_CI_SHA=c133db772d1718281fed55bef3a1d2390ed39245；Check run [38125181865](https://github.com/revercgy-hub/MYHOT/actions/runs/38125181865) 精确checkout此head，Check和Docker均success。
DOCS_BASE_HEAD=c133db772d1718281fed55bef3a1d2390ed39245（文档commit的父HEAD；文档commit SHA由其后的Git log记录）
WORKTREE=代码变更已拆为commit `ab43f2f`（JSONB实现/测试2文件）与`c133db7`（福建source及配置测试/fixture 6文件），均推送至`origin/feat/fiscal-finance-hot`；文档owner改动本handoff、`STATUS.md`、`SOURCE_MATRIX.md`、`HANDOFFS/README.md`并另行提交。

## 阶段退出条件与结论

这次获准范围的本地软件验证通过：JSONB对象属性顺序不再造成无语义变化的数据库更新时间触碰；福建只增加一个仍disabled的受限分页配置；最终冻结代码通过fresh隔离DB全套本地QA；经Root另行授权，固定九条preview数据恰好重放一次且写前后逐表快照相同。尚无本轮CI、commit或push；API/Web服务启动受既有策略阻止，未尝试重试。Gate、source admission、source质量和90日覆盖没有变化，因此阶段仍为`IN_PROGRESS`。

## 完成内容与可复核证据

### JSONB 持久化幂等性

变更仅在`packages/backend/src/content/materials.ts`与`tests/materials.test.ts`。保留JS早返回；数据库UPDATE增加JSONB语义保护条件，只有`raw IS DISTINCT FROM serializedNextRaw::jsonb`或诊断状态确有变化才写入。没有migration或生产数据修复。JSONB属性键序/等价序列化不更新时间戳；数组顺序与嵌套值确有语义差异时仍更新。冻结文件SHA-256：`materials.ts`=`9052259926F088632F2BED4E2AD53EFB483122B3D561A8BACF94D48F1D50AF2E`，`materials.test.ts`=`DC98A8698F5F902C92B079780FFE93D6D0359678AF9C6842AE2BEAC5FF91F0EF`。

### 福建官方页面有限观察与配置

只读GET已由来源owner按Root精确批准执行；QA只审计保存包，没有再发HTTP。source为`mof-fujian-supervision-dynamics`，生产source保持`enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`。唯一新增分页配置采用既有`mof_index_v1`，`maxPagesPerRun=2`、`maxDispatches=12`、`maxPageIndex=3`、`detailMode=direct_html_metadata_v1`。两个解析器fixture缩为每页10行真实结构的最小样本；真实raw留在ignored审计packet，fixtures与raw哈希在manifest分开记录。

保存packet `.data/fiscal-qa/fujian-source-next-20261011/`：本轮精确2个direct GET，budget attempted/dispatched/rejected=`2/2/0`，create/sendHeaders/response headers各2次，错误0；20秒、6MiB、无重试、无redirect、未请求附件。两者HTTP 200且final URL与目标精确相同并完整EOF。详情raw 18,454 bytes，SHA-256 `254915ea4f1f145d90ef60e34f5eb1bc0206cbb885d04606fd037532d12ae27d`；首页raw 12,434 bytes，SHA-256 `2e559c476d16de6b9e0c2424f474b23e4358e8dee7234ec713e6685bfa3361bd`。QA独立重新解析详情`ArticleTitle`、`PubDate=2026-07-28 08:16:00`和可见发布日期，均对应列表日2026-07-28；主正文容器1个、清理后2915字符/7段、无附件链接。详情只是一篇有限样本。

QA纠正了来源owner首份manifest里的离线比较目标错误：新首页被误与已保存`index_1`比较。历史manifest/raw未改写；`offline-audit-correction.json`指定正确基准后，QA独立解压旧page-0并比较，新旧均解析10条，URL/title/date逐行相同。旧page-0实体12,434 bytes，SHA-256 `fe899365992feb4b51a9cbbbee6fd73b14411eb5b599296b42c81e22f9cbbdea`；其压缩raw哈希及新`fujian-index-1.html`哈希见packet/correction。修正后观察是单次快照一致，不是跨周期稳定、历史覆盖、90日完整性或来源准入。

### 最终集中软件QA

最终冻结文件哈希在`.data/fiscal-qa/jsonb-finalqa-fix-20261011/frozen-files-before.txt`与`frozen-files-after.txt`逐项相同。范围包括source配置、JSONB实现与测试、regional loopback测试修复、两个福建专用测试与fixtures。最终QA使用新隔离数据库`fiscalhot_jsonb_finalqa_fix_20261011_test`；创建前确认不存在，35 migrations完成，suite前sources/articles/fetch_runs均为0。Node 24运行：`npm run typecheck` exit 0；backend full 374/374通过、0失败、0跳过；`npm run build -w @aihot/web` exit 0（仅chunk size advisory）；Web tests 16/16通过；`git diff --check`通过。日志：`.data/fiscal-qa/jsonb-finalqa-fix-20261011/{typecheck.log,backend-runner.log,web-build.log,web-tests.log}`及`.data/fiscal-qa/govcn-pagination-full-fiscalhot_jsonb_finalqa_fix_20261011_test.log`。

代码commit/push后，在目标fork明确检查无该SHA既有run，再只dispatch一次`Check`：`gh workflow run check.yml --repo revercgy-hub/MYHOT --ref feat/fiscal-finance-hot`。run [38125181865](https://github.com/revercgy-hub/MYHOT/actions/runs/38125181865) 的branch为`feat/fiscal-finance-hot`、head SHA精确为`c133db772d1718281fed55bef3a1d2390ed39245`，Check与Docker job均success。Check步骤Install、Typecheck、Web build、Web tests、35迁移及seed、built-site smoke和Backend tests均success；CI Web tests 16/16，backend 374项中373通过、0失败、1个Windows-only monitor test skip。Docker build/start及smoke success。不要把Linux CI的单项skip写成零skip；本地fresh full仍为374/374且0 skip。旧run 38101003073不是本轮测试证据。

QA历史保留：先前另一个新建隔离DB的首轮backend为373/374，唯一失败是`tests/regional-bureau-integration.test.ts`的旧synthetic loopback fixture带有production MOF-origin pagination配置；合成测试重写为localhost后命中有意保留的生产URL guard。获准的最小修复只在loopback测试副本去掉该配置，由专用mode/config tests覆盖分页；production URL guard未放宽。首轮日志`.data/fiscal-qa/govcn-pagination-full-fiscalhot_jsonb_finalqa_20261011_test.log`保留；最终fresh QA不是复用已污染首轮数据库。

### 固定preview seed幂等重放

仅在上面集中软件QA通过后，按Root明确授权对精确库`fiscalhot_preview_test`执行一次既有九条固定seed；没有preview、测试、采集、rollback、额外写库。安全日志在ignored `.data/fiscal-qa/local-preview-jsonb-replay-20261011/`。

写前身份`postgres/fiscalhot_preview_test/127.0.0.1/32:5432`，35 migrations；精确allowlist 18 ID。七张目标表`sources/articles/article_revisions/article_discoveries/publications/editorial_overrides/audit_log`每张9行、共63行；sources全部disabled/fulltext-off；publication eligible但未选、score为空、body模式summary；article正文空、revision=1，危险业务表与pgboss jobs均0。seed的9条既有ID全部`unchanged`。写后七张表的JSON快照与before逐张byte-equal；9篇`updated_at`全部与before完全相等，包括之前已触碰的三条时间戳（本轮未尝试回滚）；所有安全断言仍true。前后快照、命令输出、精确校验见`precheck-v3.log`、`before.json`、`seed-run.log`、`after.json`、`postcheck.log`。材料代码和source配置的前后SHA一致。

## 环境与安全边界

未读取或打印`.env`/keys；正式provider endpoints、keys、egress proxy均从QA环境去除；collector、push、Jina、embedding、OCR、private network均关。`MODEL_CALLS_ENABLED=true`仅用于backend suite的本地fake-provider测试路径，Web QA前复位为false。没有启真实API/Web/worker/collector；未请求附件或调用付费/外网服务。独立预览replay使用本地postgres loopback，所有非seed副作用开关关闭。没有改preview既有内容或时间戳。

## 未完成项、风险与阻塞

- 本轮提交后CI未运行；不得借用run `38101003073`（旧HEAD `f6a6bc2`）声称本轮绿色。Root负责按显式fork仓库运行一次CI并记录精确code/tested-CI/docs SHA。
- API/Web被先前执行策略拒绝启动；本轮未再尝试，live页面及HTTP headers仍未知。
- 福建仅有限官方首页/一篇详情/两个最小分页fixture；无跨周期、列表完整、90天历史或来源质量证明。来源保持disabled/unadmitted。
- preview既有三条时间戳的历史技术触碰保留；此次replay证明不再产生额外时间戳变化，但不作回滚。
- Gate 2状态只引用正式review，不因本轮测试或观察改变。

## 下一批 Agent

Root作为实现/集成owner可审核两份代码变更和独立日志，提交JSONB与福建配置两个小commit，显式指定`revercgy-hub/MYHOT`运行一次CI，再以确切tested SHA/run补记状态。Source owner保留福建raw packet；不得据此启动source或扩大分页参数。文档owner只维护本handoff、STATUS、SOURCE_MATRIX与HANDOFFS索引。后续不得重跑full suite/replay，除非有新的代码修改或实质失败需要复核。

## 必需任务字段

**TASK**：独立审查获准JSONB幂等性修复与福建分页配置；最终冻结后集中QA及一次preview幂等重放；本轮文档交接。

**MODEL**：软件测试使用本地Node 24及本机新建隔离PostgreSQL DB；实际source GET由来源owner获批执行；QA未调用应用模型，suite fake-provider路径仅为测试stub。

**FILES_CHANGED**：JSONB commit `ab43f2f`包含`materials.ts`与`materials.test.ts`；福建commit `c133db7`包含`industry/sources.json`、区域测试、独立config test及3 fixtures；文档owner修改本handoff、`STATUS.md`、`SOURCE_MATRIX.md`、`HANDOFFS/README.md`，另commit。忽略目录QA包仅为证据，不提交。

**TESTS_RUN**：fresh DB 35 migrations；typecheck PASS；本地backend 374/374、Web build PASS、Web tests 16/16；preview固定九条seed一次，七张表63条快照完全相等、时间戳无变化。精确代码SHA `c133db772d1718281fed55bef3a1d2390ed39245` 的CI run 38125181865 Check+Docker success，CI backend373 pass/1 Windows-only skip/0 fail，Web16/16。具体命令与日志路径见本文件。

**RESULT**：最终本地软件QA和一次受限preview幂等回放均通过；福建原始页与详情经离线独立QA；生产source仍disabled/fulltext-off。

**RISKS**：本机API/Web无live验收；来源分页/完整性与source admission未知；保留首轮QA真实失败及修复历史。

**BLOCKERS**：阶段其它P3证据未闭环；CI与代码已按本handoff记录完成。

**NEXT**：Root复核本轮结果；保持来源禁用，服务被策略阻止时不重试；有实质代码修改后才重新QA。

## 声明

没有由本handoff与其链接证据支持的事实不作猜测；未提及的操作不视为已验证。报告只反映上述固定版本/样本/测试范围。
