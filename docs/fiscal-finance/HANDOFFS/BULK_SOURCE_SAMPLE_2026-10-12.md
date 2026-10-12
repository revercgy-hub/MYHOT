# 六来源隔离批量采集与正文抽取检查点（2026-10-12）

STATUS=COMPLETED — 一次六来源批量观察、独立证据审计、获批固定15条本地预览seed与精确SHA CI均完成；业务质量与live页面仍未验证
CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_CODE_SHA=07aaf2fcb6d1b0d249c11f78c5a5ff95d2c461dc（固定15本地预览代码；GitHub Check+Docker run 38229999049对精确SHA success）
DOCS_BASE_HEAD=07aaf2fcb6d1b0d249c11f78c5a5ff95d2c461dc（本轮文档commit父SHA；文档HEAD单独记录）
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
RECOVERY_SHA=cc0b8305748b08c4059846ee8a1821ddb04bbb93（本轮文档工作恢复起点）
WORKSPACE=D:\AI-work\MYHOT\AIHOT
STAGE=P3来源质量与受限真实采集观察；此批次不提升Gate或source admission
GATE=Gate 2仍为`PASSED_FOR_BOUNDED_P4_PILOT`，范围仍限正式review指定三来源的逐篇合格小样；本轮用户批准的bulk测试不等于Gate 3或source admission
REVIEW=Root批准fresh隔离库、六source串行一次执行；独立QA对批次和approved fixed-15 preview seed均判定PASS。批量source仍全disabled、站内/转发全文关闭；preview中的15篇只用于本地开发编辑辅助。
SOURCE_DIRECTORY=tracked目录48 sources / 42 strict IDs；本次catalog hash固定为`0b35e66f3e7d5816fcc6588527a49d9b650df63c5a3ce01175e4fa909553e7d3`，全目录disabled/fulltext-off

## 本轮范围和安全边界

2026-10-12 09:08 UTC，对fresh `fiscalhot_bulk_20261012_test`（35 migrations）串行运行一次`pboc-open-market`、`mof-treasury-debt-data`、`mof-xiamen-supervision-dynamics`、`mof-fujian-supervision-dynamics`、`mof-zhejiang-supervision-dynamics`、`mof-policy-release`。请求预算硬上限120个Undici dispatch（redirect hop也计数），实际40次dispatch、拒绝0，40个响应均HTTP 200。无retry；单源collector/body失败按批准策略停止该源，预算触顶则停止整个batch。本次未触顶。

页面按真实source配置运行；共90条find候选、70条fresh article创建。显式正文抽取总上限按source为8/8/8/4/5/8，实际成功32篇；另38篇body仍pending/空，没有超限补采。列表超时25秒、正文20秒；单列表实体上限8 MiB、单详情6 MiB。每个raw响应保存在ignored证据包，并在manifest记录hash/大小/状态；catalog SHA-256为`0b35e66f3e7d5816fcc6588527a49d9b650df63c5a3ce01175e4fa909553e7d3`。PBOC fresh库effective config将detail `maxFetches`从catalog的3临时降至0，避免collector内部inline body重复失败请求；catalog未改。各source catalog/effective config SHA列在manifest。

本库运行时COLLECT_ENABLED、MODEL_CALLS_ENABLED、IndexNow、飞书、embeddings、OCR、Jina fallback和private-network fetch均关闭；没有provider credentials/endpoints、egress proxy变量或worker。没有调用模型、付费provider、附件/PDF/OCR；来源flag全disabled且`site_fulltext=false`、`syndicate_fulltext=false`。数据库before所有业务计数为0；after有6 sources、70 articles、6 fetch runs、102 revisions、70 discoveries、70个`content.extract-body` jobs（全部`created`）、32篇body `ok`和38篇body `pending`。`job_runs=0`、`analyses=0`、`receipts=0`、`selected_ledger=0`。独立QA核验了17条publication：均来自Fujian/Xiamen/Zhejiang严格正文source，`body_mode=summary`、summary为空、`selected/eligible/indexable=false`、全文flag关闭。它们不是已精选或站点页面可见内容；本地API/Web未连接此bulk DB。

| source ID | found | created | body ok / cap | 说明 |
|---|---:|---:|---:|---|
| `pboc-open-market` | 20 | 20 | 8 / 8 | body抽取样本题名为公开市场业务交易公告；逐篇正文业务价值仍需审核 |
| `mof-treasury-debt-data` | 10 | 3 | 3 / 8 | 本窗口仅3篇新记录；其余候选未创建 |
| `mof-xiamen-supervision-dynamics` | 10 | 10 | 8 / 8 | 8篇显式抽取成功 |
| `mof-fujian-supervision-dynamics` | 20 | 17 | 4 / 4 | 两页partial；详情与正文抽取均只取cap内 |
| `mof-zhejiang-supervision-dynamics` | 20 | 16 | 5 / 5 | 两页partial；4条旧候选未创建 |
| `mof-policy-release` | 10 | 4 | 4 / 8 | 窗口内新建4篇 |
| **合计** | **90** | **70** | **32 / 41** | dispatch 40/120；body ok不自动等于业务合格 |

> 注：cap列是本轮Root批准的逐源body上限，PBOC等未用满上限的差额未补跑。Source-specific `found/created/body`为collector与显式抽取计数，不把列表候选数解释为栏目总量。

Fujian和Zhejiang各解析两页、共20个list candidates；fetch run均为`partial=true`、`stopReason=max_pages_per_run`、coverage=`unproven`。新修正的metadata计数在本批分别记录窗外3条（Fujian）与4条（Zhejiang）；这些窗外列表项未落库。Xiamen和其余source的实际页/详情dispatch及候选构成以manifest为准，不从`found`单独推断网站总量。

### 独立审核中的边界

独立QA在本次批次范围内判定PASS：核对了40/40 response raw与hash、字节/EOF、解析与数据库绑定，以及publication逐行状态；SQL计数为70 articles、102 revisions、70 discoveries、70 created jobs、32 body ok、38 pending，forbidden analysis/receipt/selected/job_runs均0。fresh库manifest在`.data/fiscal-qa/bulk-20261012/evidence/manifest.json`，原始响应在同目录`responses/`；这些忽略文件不提交。该PASS只代表此固定bounded run与隔离副作用核对，不是source admission、内容全栏质量或coverage通过。

福建与浙江fetch runs虽为`ok`，但分别只提交2页，`partial=true`、`stopReason=max_pages_per_run`、coverage=`unproven`；本轮不得说分页完成、90日历史完整或来源通过。标题和列表候选内容尚未完成业务噪声评估；正文`ok`只说明抽取函数有非空结果，不代表该内容适合preview或精选。必须等待独立QA从每来源挑选至多一条body样本，且不得重用超出已保存raw/hash绑定的事实。

17条publication虽然数据库visibility字段为public，也都为`eligible=false`、`selected=false`、`body_mode=summary`、`has_summary=false`、`indexable=false`和全文flag false；因此没有可供网页读取的内容摘要，不能表述成公开/精选。人工精选、worker消费jobs及模型分析均未发生。

## 本地编辑预览追加六条及独立seed审计

独立QA从本批六来源正文候选中复核并批准每source至多一篇编辑辅助样本；owner在既有本地preview清单上追加6条。按一次获批seed写入原`fiscalhot_preview_test`后，读写审计确认旧9条对应八张表72行逐字段（含`updated_at`）全一致；新增6条后总计15个source/article/publication/override/audit/revision/discovery/pool rows，各15。15篇preview source全disabled/fulltext-off，article `body_status=none`且body text/html均null；publication均summary-only、`eligible=true`、`selected=false`、无score、noindex、no syndication。fetch/analysis/receipt/selected-ledger/state/job-runs均0；环境不存在`pgboss`表。seed没有启动worker或模型，也没有改bulk DB。

Preview summaries是本地开发用AI辅助编辑样本，requested `Luna High`、actual model unverified，`humanGold=false`；不是项目模型精选、人工Gold、source admission、公开精选内容或HTTP页面验收。API/Web未运行且没有live GET；后续代码提交/CI未完成时，不宣称代码已推送。独立seed证据只存ignored `.data/fiscal-qa/local-preview-seed-20261012-qa/`。

| 新增预览来源 | 标题 / 页面日期 | Bulk article ID | 抽取正文 SHA-256 | 保存响应与响应 SHA-256 |
|---|---|---|---|---|
| `pboc-open-market` | 公开市场业务交易公告 [2026]第189号 / 2026-09-24 | `u7z8pwt3y5u9dwpe5v4rigbcl` | `11243faa365d5a939c3d5298e8f991d882d85d98bb0cd06b8d2a52b969e38128` | `responses/dispatch-009.body` / `ad5c1959692a0575a21519abfd2194ea62fa97fcac13559697bb7c6dc2c67514` |
| `mof-treasury-debt-data` | 2026年7月地方政府债券发行和债务余额情况 / 2026-09-09 | `l8cuzqb9sqw4uf9ym2sek78ew` | `e787922976dc61236ba40ca9f6dd83894e2a7d1046a19efdcbf75a3ef3b8d563` | `responses/dispatch-012.body` / `eb80fc868fcb01b53eeeaa8ede68f3bb7958114a05f033c1e3b8efd83448a25a` |
| `mof-xiamen-supervision-dynamics` | 厦门监管局：强化财金协同 深化精准监管 助力普惠金融高质量发展 / 2026-09-24 | `d8vlcb71ft41lhla5z9qwogg1` | `fce18a043f7159dc4a03bf80553906e628a612022d93985b8214760f4b905f24` | `responses/dispatch-022.body` / `bb70d498978e695e147a785c00290f35a7154540d2de987516611af81a9d2f98` |
| `mof-fujian-supervision-dynamics` | 财政部福建监管局：“三强化”提升资源综合利用增值税即征即退政策复查工作质量 / 2026-09-22 | `jy49lbe8hdqvfbookp6blnb5p` | `8293e165f849d4f7882ff519cbab2397ae269d59a14e8ccc2dbc0f37cceb6e09` | `responses/dispatch-027.body` / `24a986f0b04552072b0c3b1b38fca92d017c55fde4b7b19b40af852d07a0bda0` |
| `mof-zhejiang-supervision-dynamics` | 浙江监管局：关于新注册会计师法下加强注册会计师行业监管的思考 / 2026-10-10 | `wckan77gkve3peclwa0ig6l4o` | `6787c090a95db753ac90784280540308f311bf3defebdec716f4298f6ef88914` | `responses/dispatch-032.body` / `661a3f4aba18da675aeb393aed6dc4f330625295d889741f0817aa737eab2cbb` |
| `mof-policy-release` | 财政部关于印发《彩票市场调控资金管理办法》的通知 / 网页日期2026-08-14 | `l4h5ilfpfoje8wtpttyj0n3vt` | `01f906facfbda4f68e64e8374940d84653c991fc9ea7d81f7eb12dfe088985bb` | `responses/dispatch-038.body` / `ff8fe6af6c5b4dab5be24ec13d8e96b1c9abc98a7f3aea58b4bf7e6a50e7928e` |

逐篇摘要与body/raw hash映射均经独立QA检查。Treasury样本正文中虽引用统计，详情页有appendix PDF链接，但本轮未请求或审计附件，摘要不把附表数字表述为已核实。浙江《注册会计师法》摘要将新法生效日写为2027-01-01，不暗示法规当前已生效。彩票管理办法样本区分网页发布日期2026-08-14与文件签署日2026-07-24；摘要不假设另一publisher或信源。PBOC摘要正文内容为515亿元7天逆回购、利率1.40%；这仍是单篇预览样本，不作栏目质量或重要性结论。

## 必需任务字段

**TASK**：按授权对六个固定官方来源各串行执行一次隔离采集及有界显式正文抽取，并保留完整证据供独立审计。

**MODEL**：requested `Luna High`；actual model unverified。六条summary是AI辅助编辑样本，非项目model输出/精选；项目模型/provider/OCR调用0。

**FILES_CHANGED**：批量collector生产tracked code未变；六source fresh DB与raw/manifest仅写入ignored `.data/fiscal-qa/bulk-20261012/`。preview owner三文件代码提交`07aaf2fcb6d1b0d249c11f78c5a5ff95d2c461dc`已推送，精确SHA Check+Docker run 38229999049 success；seed写入仅限既有preview DB。本轮handoff、STATUS及两份source矩阵作docs-only提交。

**TESTS_RUN**：独立运行脚本静态审查/离线preflight通过；真实collector一次。当前manifest报告`bounded_batch_completed`、6/6 collector status `ok`、40 dispatch/0 rejected、没有budget stop或runner violations。独立QA核实40/40 raw hash/EOF和DB逐项绑定，并审计全部17条publication及副作用表，bounded/isolated scope PASS。Counter-fix SHA `0b7d8c8` 的Check+Docker run 38227340214精确head成功；fixed-15 code SHA `07aaf2f` 的Check+Docker run 38229999049对精确head success。CI验证软件，不是本轮抓取或内容质量证据。0b7d8c8本机backend完整376例曾374通过/2失败：`translate-shutdown.test.ts:61`预期2 requests但收到3，`translate.test.ts:70`预期translated receipt但返回空对象；独立fresh隔离重跑两个filtered用例分别2/2、1/1通过，未修改translation代码，也不抹去原失败。Web tests曾因build并行导致artifact缺失失败，顺序重跑16/16通过。

**RESULT**：fresh隔离库写入70篇metadata；32篇显式body抽取`ok`，38篇仍pending；70个body jobs创建但未由worker消费。17条空summary且不可精选/索引的publication不是网站可见新增。source flags未开启，Gate/source准入不变。

**RISKS**：正文抽取成功不能推出文章具有财政业务价值；PBOC公告正文尤其需确认用途。存在内部活动/彩票等列表内容的可能，QA须按单篇审查，不外推整源噪声率。两来源仅到达每次运行页上限，coverage仍unproven。只读数据库审计不能代替来源质量、90日完整性或周期稳定性验证。另有上述两项本机translation完整套件失败，filtered rerun通过但仍记录为flaky/unresolved；它们不改变本批实际采集结果。

**BLOCKERS**：正文业务质量、噪声比例与两页来源覆盖仍未知；本地API/Web未启动，因此live页面尚未核验。bulk DB保持隔离，不连接其运行页面。

**IN_PROGRESS**：逐篇业务价值/噪声人工审阅、Fujian/Zhejiang coverage、历史90日覆盖与跨周期稳定性仍未完成；source admission和Gate不变。固定15条本地预览seed、独立after-audit、preview代码commit/push与精确SHA CI均已完成。

**NEXT**：本次六source批次不重跑/补采；按项目阶段继续内容质量和来源覆盖核验，不把编辑辅助预览当作Gold/精选。docs-only handoff commit/push后，精确local/remote SHA和工作树状态列于最终状态记录。
