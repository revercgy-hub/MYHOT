# P3 latest增量、正文修复与运行交接（2026-10-21）

STATUS=IN_PROGRESS（限定数据库变更及代码验证完成；最终CI通过）
STAGE=P3 metadata-only latest refresh与已保存HTML正文投影复核
GATE=Gate 2 `PASSED_FOR_BOUNDED_P4_PILOT`；Gate 3/4/5未通过
BRANCH=feat/fiscal-finance-hot
START_HEAD=93b61a690ec2739c2c00d2d8595371c94fddccc4
CODE_HEAD=6159de76f55601dcdcfd640d00d74e2a085afc08（已push到origin；文档checkpoint未提交）
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKTREE=本日文档checkpoint已同步；无raw或credential/env纳入Git

## 结论与数据边界

这轮完成了四篇既有正文投影修复、有限latest列表更新和相应代码改动。两个测试库完全分开计数。主正文库`fiscalhot_catalog_sweep_20261013_test`为48 sources、442 articles（378 `ok` / 51 `pending` / 13 `unconfirmed`）、793 revisions、318 publications、427 jobs。分页库`fiscal_pagination4_20261016_test`为4 sources、153 articles、157 revisions、6 publications、153 jobs、18 fetch runs、0 job runs。分页来源仍disabled、全文/转发全文关闭；cursor继续active，nextPageIndex=8、coverage `unproven`。本轮没有改selection/Gold/Split、source flags、provider设置、NAS状态或Gate结论。

## 主库四篇正文投影CAS

既有HTML解析结果在inline标签边界拆分数字/金额。本轮仅通过已有pure text projection从保存的sanitized `body_html`重算`body_text`与content hash，不重新请求来源、不重新sanitize HTML，也不宣称重新核定source admission。原提案`.data/fiscal-qa/inline-repair-20261021/manual-body-text-repair-proposal.json` SHA `aecca9451f83d9a72da17e5052e2820bd542aa0f1fffb86e4a293a8e16a7157e`；独立提案QA见`.data/fiscal-qa/qa-luna-20261021/proposal-independent-qa.json`。四目标为`w03wcant4ai1xm1nhfzd403g2`、`gzd3lm804mu4cml4wd80xijhb`、`j53z7cyp523j06d0li0obfkyf`、`wmlrrnb42kids842rgml54xa6`。仅这些目标从revision 2到3；source/title/date/raw/body_html/body_status/processing state与`processing_queued_at`原始微秒均保留。现有三条publication仍revision 1、summary mode及`eligible/selected/indexable/syndicate=false`，summary未填造；第四色目标没有publication。所有旧rev1/rev2、其他articles、sources、publications、jobs及其余70张关联表均逐行不变。结果`.data/fiscal-qa/inline-repair-20261021/attempt-3/execution-result-v3.json` SHA `6e4d0f5162405849ba81c037724c2c940ae0fb3c0a2ad6de721f528052b50816`，post snapshot SHA `baefe2c7cb98efa3e24d336c978b44595c79c20bff9faadeca1a81d19eaa761c`；C独立SQL比较零越界差异，报告在`.data/fiscal-qa/qa-luna-20261021/`。

CAS需保留三段真实尝试：attempt-1在事务前被baseline comparator误报fetch_runs差异而中止；attempt-2 full preflight通过，但JS `Date`毫秒精度令首个timestamp CAS update为0行，事务回滚；均不是数据损坏或业务漂移。attempt-3以精确text条件`processing_queued_at::text IS NOT DISTINCT FROM $::text`保留PG微秒并一次提交。历史binding/abort证据与supersession保留在`.data/fiscal-qa/inline-repair-20261021/attempt-{2,3}/`，不覆盖或改写前两次记录。

## 分页库latest操作

10/20一次性capture中4条新metadata候选通过受限payload replay写入分页测试库（GX 3、四川1），此replay不证明详情或精选。之后用冻结scope`.data/fiscal-qa/live-latest-20261021/scope.json` hash `DBC2506776EB92720E93673908F39CD423B5FA6618272A3CA2D7F9EFD026FF14`，绑定fresh baseline hash `708C8795460940133C402F405F45075902B7E0D5E2B1BFF625C49962D7EC0993`，对广西与四川各作一次base-list GET，预算总2/每源1/顺序间隔至少1秒/无详情、重试或重定向。两次应用结果均正常返回：GX 10 found、10 known、0 new；四川10 found、7 known、3 new，完成间隔1245ms。三个四川新候选为：

- `sak01wh212jngkp9aojhnk83y`：财政部四川监管局举行“理响巴蜀”进省直机关巡回宣讲暨“财政监管·熊猫论坛”活动。
- `o3ufcom3tk31afys61ebhsddw`：四川监管局：加强财政科学管理 推动中央驻川单位部门预算监管工作提质增效。
- `uec9i7jfsuasr0zv9a3nk8dsu`：财政部四川监管局：办公室深入学习全国财政法治建设工作会议精神。

三条均保存为listing-derived标题/上海日期临时metadata，`body_status=pending`、body_text/body_html为null，无publication；各有rev1、discovery与一个`created`且未启动的extract job。两个source仅last fetch/ok与updated时间变化，config/cursor和所有旧行不变。post snapshot`.data/fiscal-qa/live-latest-20261021/baseline-after.json` SHA `7FF45B3C6DB0D70950D9AB54BC5D9D43DD22F254111859E66CDD1530296901EF`，C当前只读8表逐行比对全匹配；独立报告`.data/fiscal-qa/live-latest-20261021/independent-post-qa.json` SHA `35129AF8D161B8F052C9B7113ABE7D9B12C00A539FC7B7C5E8DBBB1E8689507E`。

需保留限制：执行时的CLI旧hash为`6d3f7273…07eacc33`，collector结果与DB事务均完成，但PgBoss producer未在CLI结束时stop；仅对这一执行进程Ctrl-C终止，exit 1，不重发请求。`execution-evidence.json`记明`rawResponseCaptured=false`，所以没有wire/decoded HTML/hash证据；fetch_runs保留精确计划base URL、每源单dispatch、redirect/detail/retry为0及cursor保留的执行metadata，但C不能声称已独立核响应字节或source正文质量。该次受限操作不是source admission、coverage pass或精选决策。

已加入finally `stopBoss()`（即使它报错仍`closeDb()`）及child CLI exit regression；mock child断言唯一base URL dispatch、pending article和一个extract job后status 0。现有guard仅允许显式loopback PostgreSQL `_test`或`_ci`数据库名，普通数据库名和远程host由新测试拒绝。本地focused最终10/10，typecheck通过；无官方HTTP或真实数据库写新增。

## 软件验证与Git

本机fresh 35-migration backend suite（运行于cleanup/suffix测试变更前）414项、413 pass、0 fail、1 skip；typecheck通过，Web build成功、Web tests 17/17。cleanup后的focused tests 9/9通过；suffix修复后的focused 10/10通过，typecheck通过。安全flags由测试/运行命令显式设置，不能把shell的UNSET说成有效关闭。

本轮代码提交：`d3a1ed5` inline text projection、`3beb410` latest增量核心、`ed7dcfd`关闭latest CLI PgBoss、`6159de7` `_ci`数据库名对齐。CI run [39529387711](https://github.com/revercgy-hub/MYHOT/actions/runs/39529387711) 对`3beb410`通过；run [39530121854](https://github.com/revercgy-hub/MYHOT/actions/runs/39530121854) 对`ed7dcfd`失败在CI名`aihot_ci`不符合旧`*_test` guard，412 pass/1 fail/2 skipped，Docker job通过。该失败在DB访问/HTTP前发生，未改数据库或发请求。最终SHA `6159de76f55601dcdcfd640d00d74e2a085afc08` 的唯一最终Check run [39530549243](https://github.com/revercgy-hub/MYHOT/actions/runs/39530549243)成功：backend 416/414 pass/0 fail/2 skipped，typecheck、Web build/tests 17/17、migrate/seed、built-site smoke及Docker均通过。无本机API/Web live smoke；CI smoke只表示GitHub runner内临时环境。

## 当前边界与下一步

Gate 2仍为`PASSED_FOR_BOUNDED_P4_PILOT`，Gate 3、4、5未通过；7条metadata候选均不等于人审/精选，事件组/隔离holdout未变。376篇已保存正文离线投影仍只是可评估文本，不是source重新准入。11篇历史数字边界候选已逐项审查：4篇已修正body_text投影，7篇低影响且无修复提案；除非有新证据，不重复扫描。latest兼容入口已交付，但尚无周期运行或coverage完成证据。

```text
TASK=QA两库限定写入与P3 latest/body代码；更新状态与交接
MODEL=Luna High（native）；provider/model API调用0
FILES_CHANGED=代码已分批提交；本轮文档草稿为STATUS.md、PROJECT_PLAN.md、HANDOFFS/README.md、昨日P3 handoff顶部修订、本handoff；无.data进入Git
TESTS_RUN=本机backend full 414/413/0/1（cleanup前）；Web build+17/17；typecheck；final latest focused10/10；CI 39530549243 backend416/414/0/2、Docker成功
RESULT=4篇正文投影仅目标rev2→3并经独立全行QA；分页库回放4旧metadata+一次latest两GET新增3 list-only pending；cursor保持8/unproven。最终代码head6159de7已push
RISKS=latest GET未保留raw response；旧CLI在producer停止缺失时挂起后被结束自身进程；Gate 3–5仍缺；不宣称90日覆盖或source准入
BLOCKERS=独立人工Gold/事件隔离、来源质量/90日覆盖、NAS验收仍未完成
NEXT=核验7条list-only候选的详情/正文；随后进行受控周期latest运行并补coverage证据。11篇历史候选不重扫，除非有新证据；不自动精选、不批量回写、不机械续页
```
