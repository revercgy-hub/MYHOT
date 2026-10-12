# 地方监管局两批来源扩展隔离观察交接（2026-10-12）

STATUS=COMPLETE_WITHIN_BOUNDED_BATCHES
STAGE=P3地方监管局来源质量与覆盖核验
GATE=Gate 2 `PASSED_FOR_BOUNDED_P4_PILOT`；仍仅限正式review指定的三个来源逐篇合格样本
SCOPE=两次各八个disabled地方监管局来源的普通单页collector和cap内正文尝试；每次独立fresh库、一次运行

## 运行摘要

Lead分别批准两次互不重叠的八源运行。两次都复用现有普通单页`web_list`路径，没有分页overlay。每源正文最多3次；隔离source config仅把`detail.maxFetches`临时设为0以抑制inline详情，再于每源结束后逐项恢复catalog config。共享Undici硬上限64并把redirect计入；列表25秒/8 MiB、正文20秒/6 MiB，无重试。每次source失败时停止该source的后续正文工作；未触达全局预算上限时继续后续source。

| Run | fresh database | found / created | dispatched / cap | body attempts | body `ok` / `unconfirmed` | ending counts |
|---|---|---:|---:|---:|---:|---|
| B1（北京、江苏、安徽、江西、河南、湖北、湖南、广东） | `fiscalhot_source_expand_20261012_test` | 80 / 69 | 28 / 64 | 20 | 19 / 1 | 69 articles、88 revisions、69 discoveries、20 empty-summary publication projections |
| B2（天津、河北、山西、内蒙古、吉林、黑龙江、山东、大连） | `fiscalhot_source_expand_b2_20261012_test` | 60 / 60 | 23 / 64 | 15 | 13 / 2 | 60 articles、73 revisions、60 discoveries、15 empty-summary publication projections |
| **合计** | **两个库独立保留** | **140 / 129** | **51 / 128** | **35** | **32 / 3** | **129篇新建；不得与既有preview条目相加** |

B1为`bounded_batch_completed`、8/8 collector `ok`、0 rejected、0 redirects。独立QA复放八份gzip列表raw，均还原10个列表候选；28/28响应raw的字节、SHA-256和EOF匹配manifest；20次详情raw离线重放为19 `ok`、湖南1条`identity_mismatch`，SQL正文长度逐项匹配。北京列表10项的显示日期都在三个月窗口，但source配置`publishedAtAuthoritative=true`要求详情日期权威确认；本次隔离设置`detail.maxFetches=0`关闭详情确认，同时`initialBackfillRequirePublishedAt=true`，所以collector `ok`且`found=10`、`created=0`。这是严格日期策略与本次inline详情抑制设置不兼容产生的无写入结果，不是窗口外判定或采集器失败；未发额外详情请求。湖北10项中1项日期为2023-11-20、超出配置的三个月首次回填窗口，因此10 found仅9 created。湖南首篇详情`identity_mismatch`后停止该源正文阶段。

B2为`bounded_batch_completed`，但天津与黑龙江两个列表请求timeout，按规约保留失败且不重试；余下6个collector `ok`。共23个dispatch中21个HTTP 200且EOF完整、2个timeout无完整raw body，0 rejected、0 redirects。独立QA确认两条正文hold均为`short_body_not_allowed`；未尝试补请求。

## 各源结果

| source ID | found / created | body尝试 / `ok` / held | 结果说明 |
|---|---:|---:|---|
| `mof-beijing-supervision-dynamics` | 10 / 0 | 0 / 0 / 0 | 10条列表日虽在窗口内，strict authoritative date需要详情确认；maxFetches=0使10条均未写入 |
| `mof-jiangsu-supervision-dynamics` | 10 / 10 | 3 / 3 / 0 | 单页；既有代表详情偏学习/组织活动的内容判断仍按逐篇处理 |
| `mof-anhui-supervision-dynamics` | 10 / 10 | 3 / 3 / 0 | 单页；正文抽取结果不等于业务质量通过 |
| `mof-jiangxi-supervision-dynamics` | 10 / 10 | 3 / 3 / 0 | 单页；既有代表详情偏组织活动的风险仍在 |
| `mof-henan-supervision-dynamics` | 10 / 10 | 3 / 3 / 0 | 单页；既有样本有财政监管事实，但不外推整栏 |
| `mof-hubei-supervision-dynamics` | 10 / 9 | 3 / 3 / 0 | 1条列表日为2023-11-20、在三个月窗口外；既有代表详情偏组织宣传，不外推整栏 |
| `mof-hunan-supervision-dynamics` | 10 / 10 | 2 / 1 / 1 | 一条`identity_mismatch`，失败后停止该源正文阶段 |
| `mof-guangdong-supervision-dynamics` | 10 / 10 | 3 / 3 / 0 | 单页；既有样本有财政监管事实，但不外推整栏 |
| `mof-tianjin-supervision-dynamics` | 0 / 0 | 0 / 0 / 0 | 列表timeout，无重试 |
| `mof-hebei-supervision-dynamics` | 10 / 10 | 3 / 3 / 0 | 单页 |
| `mof-shanxi-supervision-dynamics` | 10 / 10 | 3 / 3 / 0 | 单页 |
| `mof-inner-mongolia-supervision-dynamics` | 10 / 10 | 1 / 0 / 1 | 第一条正文`short_body_not_allowed`后停止该源正文阶段 |
| `mof-jilin-supervision-dynamics` | 10 / 10 | 3 / 3 / 0 | 单页 |
| `mof-heilongjiang-supervision-dynamics` | 0 / 0 | 0 / 0 / 0 | 列表timeout，无重试 |
| `mof-shandong-supervision-dynamics` | 10 / 10 | 2 / 1 / 1 | 第二条正文`short_body_not_allowed`后停止该源正文阶段 |
| `mof-dalian-supervision-dynamics` | 10 / 10 | 3 / 3 / 0 | 单页 |

## 隔离与写入边界

两库都在执行前通过新库空表检查，含`pool_search=0`，并各应用仓库当前35项migration。各source始终`enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`；manifest记录每源结束时恢复精确catalog config。B1结束计数为`sources=8/articles=69/fetch_runs=8/revisions=88/discoveries=69/publications=20`；B2为`8/60/8/73/60/15`。全部body extraction jobs分别69、60条且均为`created`，没有worker消费。两库的`analyses/receipts/selected_ledger/selected_state/job_runs/editorial_overrides/audit_log/pool_search`均为0；publication仅是正常summary projection，无摘要且不可精选/索引/全文，不能描述为公开页面内容。

没有运行API/Web/worker、模型、付费provider、Jina、附件/PDF/OCR、seed或已有preview数据库写入。两次数据留在不同隔离库；既有`fiscalhot_preview_test`固定18项未修改。tested body `ok`只代表非空抽取，不代表业务候选、人工Gold、来源准入或Gate升级。单页单时点观察不证明90日完整覆盖、分页末页、日期权威、跨周期稳定性或全栏质量。B1的北京日期身份风险与B2两个timeout、三条held状态均保留，不补抓或重试。

## 独立复核与证据

独立QA对B1和B2分别检查raw响应长度、SHA-256与EOF状态，重放列表解析并核对SQL写入、详情正文结果、publication约束、source safety/config恢复及副作用计数。B1为`PASS_WITHIN_BOUNDED_BATCH`，报告见`evidence/offline-qa.json`：28/28 raw与manifest匹配，所有28次GET为HTTP200；八个列表各重放10项，20条详情正文重放与SQL一致；before零计数、69条created body jobs、20条空summary、未精选且不可索引的publication映射均符合边界。B2为`PASS_WITHIN_BOUNDED_SAMPLE`：23个dispatch全对账，21个HTTP200实体raw、2个无重试timeout；六个成功列表各重放10条，body为13 ok/2 `short_body_not_allowed`/45 pending，SQL/配置/job状态符合隔离边界。两个结果只说明固定样本范围与证据完整，不表示来源通过、质量认证、Gate/Gold或覆盖完成。

- B1 runner / manifest / raw / SQL导出及独立QA：忽略目录`.data/fiscal-qa/source-expand-20261012/evidence/`；QA报告`offline-qa.json`；配置preflight为`runner/preflight.mjs`及`evidence/preflight.json`。
- B2 manifest / raw / SQL导出及独立QA：忽略目录`.data/fiscal-qa/source-expand-b2-20261012/evidence/`，QA报告`offline-qa.json`。
- runner与所有raw/SQL证据不提交Git。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

### TASK
按用户“现在数据量，扩大数据来源”要求，完成两批共16个来源各一次的有界本地隔离采集观察。

### MODEL
requested `Luna High`；实际model未验证。项目model/provider/OCR调用0。

### FILES_CHANGED
更新`STATUS.md`、`SOURCE_MATRIX.md`、`REGIONAL_BUREAU_COVERAGE_MATRIX.md`及本文。没有修改tracked业务代码、source配置或migration。

### TESTS_RUN
B1 runner frozen后`node --check`及离线preflight；每次运行前fresh DB身份、35 migrations与全零baseline。独立QA分别对B1、B2完成离线raw/parser/body replay及只读SQL核验。此阶段没有运行软件测试或CI。

### RESULT
B1 `PASS_WITHIN_BOUNDED_BATCH`，B2 `PASS_WITHIN_BOUNDED_SAMPLE`。16源found/created合计140/129，35次body尝试中32 `ok`、3 `unconfirmed`，51 dispatch；独立QA确认两批都符合各自bounded isolated边界。所有来源仍disabled，全局Gate/source admission保持不变。

### RISKS / BLOCKERS
日期权威性、整栏内容质量、90日分页历史与跨周期稳定性仍未建立。北京本轮zero insert是严格权威详情日期要求与`maxFetches=0`冲突所致，历史列表/详情日期差异未解决；天津、黑龙江列表timeout；湖南`identity_mismatch`、内蒙古与山东`short_body_not_allowed`保持hold。结果不能外推为来源通过。

### NEXT
保留当前失败和holding evidence供后续逐项审查；北京权威日期处理、timeout复查及任何重试/补采需单独范围与Lead批准。本轮不执行。
