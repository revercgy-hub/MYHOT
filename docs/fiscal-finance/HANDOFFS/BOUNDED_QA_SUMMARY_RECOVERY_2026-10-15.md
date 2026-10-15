# 受限摘要恢复与预览导入交接（2026-10-15）

本页记录10月14日停机前保存的执行结果，以及10月15日离线准备状态。所有隔离库和本地预览数据都不是正式发布或source admission结论。

## 正文与数据状态

隔离采集库 `fiscalhot_catalog_sweep_20261013_test` 最近保存SQL统计为442篇：367 `body_status=ok`、64 `pending`、11 `unconfirmed`。其中本轮12条HTML详情尝试全部返回提取结果`ok`，保存统计从355/76/11变为367/64/11；总文章数442不变，未触发analysis或selection。该批manifest在 `.data/fiscal-qa/pending-body-html-12-20261014/op2/http-body-evidence/manifest.json`，SHA-256 `f06b41524254dbfd4c5286eef4605f386800aaacfc352d175e99af353ec3f500`；SQL导出SHA-256 `bd1b6ee7067bc2a2dea44bfa71d2d35ea071e5b4c71363826a0720b56c20cafd`。保存的独立审计可确认raw、parser和执行时SQL导出关系，但因PostgreSQL当前停机，本次不能重新读取live SQL/cursor；导出也没有完整的非目标文章逐行before/after指纹，不能据此证明当前库未有外部变化。

此前9条附件正文resolution和2条保存raw离线正文replay各自有独立事务/QA记录；本handoff不把它们与12次新HTTP混为一批。25条附件壳诊断只有23次新GET，另2条复用了raw；所有原文均为200，但4个请求间隔只有724–748ms，未满足750ms节奏要求。Root将该运行判为执行节奏不合规；不重发、不称为稳定来源、不提升source准入。实际PDF读取、正文review与数据库hold状态分别记录在前序证据中。

## 最新40条内容核销与真实导入driver（本轮新增）

代码 `21bdddf19617ed2edf3451813ba7eb71f57dbc19` 新增 `scripts/import-local-preview40.mjs`、纯guard helper与聚焦测试。它实现三个真实模式：`--offline-check`只读取固定输入并执行内存安全夹具；`--preflight-only`必须连接精确loopback预览库才生成完整read-only baseline与normalized URL绑定；`--execute`要求已pin的独立full40 QA proof、baseline文件物理SHA及15分钟内的新鲜快照，随后在serializable事务中重新完整CAS。当前仅运行离线模式，没有写DB或制造baseline/匹配数。已有19条driver的核心SELECT原样复用，并追加pool_search完整投影；原Date对象先JSON-safe为ISO值再用相同sorted-key序列化，防止日期漂移被空对象序列化掩盖。

Root独立读取40/40全文（含长铁路、会计中英文PDF）、全部标题/引文/entity/relevance/topic，发现问题经作者15字段修改后逐项复核，最终内容proof为 `PASS_OFFLINE_CONTENT_REVIEW`：`.data/fiscal-qa/final-preview40-v4r2-20261015/root-independent-content-qa.json` SHA `145aa2be05dcb328b00855574487f551f8a98394d9acf13c91d3721757c89ab3`。最终master SHA `20ff84ad28aea5bd2053bfdcdee05fa50fee7b8f3aa1e3dcb2bd9e23d1b20030`，plan SHA `c473b89f0bb07d8af04a082f985802e9640a549a3166d0106724647545ca4898`。脚本三者均物理pin，并检查40精确IDs/per-ID PASS、原始freeze/body hash/metadata、全部编辑字段投影；这份内容proof仍不是Human Gold/Gate/SQL准入，也不能代替live baseline。

实时去重保留匹配记录的旧ID、原日期及原URL；陌生编辑归属、题名/日期/body身份冲突或精确开发标签清单外旧ID均跳过并记录，不强制替换ID。未知override字段通过overlay保留。新增source全部disabled/fulltext=false，source article仅bodyless写入；现有publisher负责eligible和pool投影，driver不手写publications.eligible。事务后要求target eligible=true、summary-only、unselected、score/reason=NULL、无analysis、不可syndicate/indexable；每个target唯一pool_search行且direct等于publication.search_text、body为空。非目标articles/sources/overrides/publications/pool、队列及旧审计均有前后守卫；失败回滚，baseline claim与execution marker以wx保存，不自动重试。

S1已核准仅在现有Web exact-ID helper追加本plan的40固定ID及扩展对应清单测试；旧65与新40合计105个**允许开发标签的静态ID**，不是DB条数或页面105可见。未知prefix仍不获信任，没有修改routes/API/packages/schema。匹配的旧ID也须在现有exact allowlist中，避免新摘要被误标普通AI导读。实际页面仍须服务恢复并完成导入后独立核验。

验证：`npm run typecheck`退出0；全Web tests17/17；driver聚焦tests11/11，含14项内存guard、未知override/旧ID日期保留、ownership/日期冲突、normalized URL歧义、非目标和queue、eligible/pool拒绝场景及proof缺失/物理hash错误/非独立/错ID/错plan/无baseline的拒绝测试；node语法检查通过。真实Rootproof pin的offline-check通过，输出在ignored `.data/fiscal-qa/preview40-driver-20261015/`。新隔离project的client与SSR build成功，未覆盖active build；首次从错误工作目录调用npm exec因plugin未找到失败，已从正确隔离project重跑成功。PG停机，未运行真实数据库integration、live SQL/smoke或完整后端tests，不复用旧393测试声称本轮通过。exact代码SHA自动CI列表读取为空；不手动dispatch、不声称CI通过。

服务恢复后先运行（此命令本轮尚未运行）：

```powershell
node 'D:\AI-work\MYHOT\AIHOT\scripts\import-local-preview40.mjs' --preflight-only --out-dir '.data/fiscal-qa/preview40-live-20261015/preflight-op1' --qa-file '.data/fiscal-qa/final-preview40-v4r2-20261015/root-independent-content-qa.json' --qa-sha '145aa2be05dcb328b00855574487f551f8a98394d9acf13c91d3721757c89ab3'
```

它会输出真实baseline路径、物理SHA和匹配/新建/跳过数量。随后在15分钟内以该输出SHA作为`--baseline-sha`、文件作为`--baseline-file`，使用新的`--out-dir`和同一proof运行`--execute`；不得填写占位或旧baseline，不自动重试。若进程环境已有其他DATABASE_URL，driver拒绝而不悄悄切换；目标只接受 `postgres://postgres@127.0.0.1:5432/fiscalhot_preview_test`。最终DB/页面QA通过前，保存预览总量仍只记65，40尚未入库。

## 40条摘要导入计划（此前v3r3准备历史）

10月15日此前full40审阅确认结构/原文绑定后发现六处待修：医疗2030量化指标与旧judgment/uncertainties矛盾；会计意见征集须区分财政部2026-11-15国内反馈与IASB 2027-01-26全球截止；该会计topic财政收支无依据；紧急采购直接采购例外须保留竞争采购不能满足需要及原文列举原因；福建200亿元、1个月国库定存应按Root裁定标policy_release/政策发布并保留计划而非结果；新疆重复句删除。对应摘要、类型、标签与关联metadata已同步。v3 SHA `f090a727954591cb5cad368c84c143568723f48f0b298cdf1db43a8d051c4794`、v3r2 SHA `3aae652b8b6e2ee8769583c42ebb13d96a71ae96c8c50f0dd6db1773a83421de`原包保留。

v3r2仍有两个收尾问题：紧急采购uncertainties把列举原因错误变成必须同时成立；新疆删除重复后114字不足既定120–220字。新v3r3仅将前者恢复为原文“等原因导致竞争不能满足”关系，后者补原文中央预算管理一体化系统、大数据筛查、指标比对和预警复核方法。Root直接核对冻结正文和before/after，裁定 `APPROVED_FOR_LOCAL_SUMMARY_FIELDS_ONLY`。作者的六项问题关闭记录不是独立全40内容QA；结构PASS、限定字段内容核销、完整内容QA与Gold不能混同。

新目录 `.data/fiscal-qa/final-preview40-v3r3-20261015/` 保存整40包 `agent-review-40-v3r3.json` SHA `d0dd767ca1eab23acfbf35932480b48077659bd16f1909fb4a6206c3ae47bd8b`；batch2 SHA `7fb7ea87d964012f44a0bc32a832711f69e5fa9fbd46c161aae6c798aeca9b3e`；batch3 SHA `26b6108a11eb65d299f75738d3cd6ef3c8553c899e54af6d58d6afd8c089a447`。唯一最终准备plan `import-plan-40-v3r3.json` SHA `09f5008005beec7541f832785783bacd780c022950b820962af4e5cd2a19573a`；输入安全预检 `offline-input-preflight.json` SHA `52debf90276dc1ebd6490dbea5ef80bb9aaff0b20e9a2d723027fd99e9f52836`。新输出均用wx防覆盖。40条完整冻结字段、正文/HTML hash、quote、taxonomy成员、字符数、plan投影、ID/URL唯一与非Gold/selected/score/receipt约束通过。7项负例（目标库、精选、伪造baseline、身份漂移、编辑投影漂移、虚报实时计数、重复URL）均拒绝；另有offline-safety-policy-audit.json验证副作用/全文/索引等安全policy及7项dangerous flag漂移负例，合计14项负例通过；没有数据库连接或HTTP。

旧v2的 `import-plan-40.json` 实际SHA已从原pin `fce8b40b0533401deade1f05ef62ed0588bb3e2c462acac87611b5d1a2640444`变成 `bc2e226e49509bb0c1ee60f59d541a16ebff4779b9bdf1be9cd001aeb9c0a553`，原因是前序准备中更新结构覆盖了该路径。现有import-plan JSON中未找到原fce文件字节，仅有旧hash引用；明确证据保留缺口，不伪恢复原文件或SHA。旧review与其余旧包均保留，后续一律新路径并wx。

当前65条预览只为最近保存观察；40条实时匹配/新建数量、库计数、baseline与CAS均未查询，plan为null并executionAllowed=false。新target IDs仅是待live去重的建议，未声称40全新或实际105。服务恢复后必须针对精确 `fiscalhot_preview_test`做fresh normalized URL/identity去重；匹配项保留旧ID和未知editorial fields，不符则跳过。复用既有AD-012 driver的readBaseline和canonical序列化，在新路径冻结适配40条的hash/count/完整baseline与serializable事务CAS；旧19条runner不能直接运行。写入仍bodyless/summary-only、selected=false、score/reason=NULL、source/全文关闭，不写analysis/receipt/selection/jobs/provider，完成后须独立DB/页面QA。

ifxp既有 `.data/fiscal-qa/ifxp-manual-resolution-proposal-20261015/resolution-proposal.json`已保存，body/text SHA核实；组成是HTML通知+PDF第1–16页完整maintext+独立标记第18页印制信息，第17页只有页码。此次未重建、不做OCR/付费调用；原strict parser失败与hold保留，仍须独立QA和fresh exact-row snapshot后才考虑人工事务。

## PostgreSQL现况与恢复方式

2026-10-15本轮最新只读复核：5432、3000、3001均无listener。早前记录Web/API仍监听是旧时点，不能沿用为当前事实。实际默认IPv4路由为以太网（interface 11，gateway 192.168.3.1），该接口地址192.168.3.47；172.30.196.60是虚拟接口，未用作LAN地址。PostgreSQL旧postmaster.opts指向现有cluster、127.0.0.1:5432；pg_ctl路径与cluster目录均存在。旧PID残留和日志不足以解释停机原因，未删除、未自动启动，先前自动服务start被policy阻止的边界不变。

用户可依次在PowerShell手动执行这两条命令（当前未由agent执行）；先启动现有cluster，PG ready后启动现有安全LAN脚本：

```powershell
& 'D:\AI-work\MYHOT\AIHOT\.data\test-pg\pgsql\bin\pg_ctl.exe' -D 'D:\AI-work\MYHOT\AIHOT\.data\test-pg\cluster' -l 'D:\AI-work\MYHOT\AIHOT\.data\test-pg\pg-start-20261015.log' -o '-h 127.0.0.1 -p 5432' start -w
& 'D:\AI-work\MYHOT\AIHOT\scripts\start-local-lan.ps1' -LanAddress '192.168.3.47'
```

第一条不重建库或删除PID；第二条脚本检查PG ready、端口与进程归属，Web只按既有配置开放LAN、API保持loopback且副作用开关false，不启动worker。如任何命令拒绝或失败，保留输出/日志，先诊断，不绕过脚本护栏。启动完成后再做数据库只读preflight；LAN网页地址为 `http://192.168.3.47:3000/all`，仅在成功启动后可访问。

## 安全与后续

所有source和全文开关维持关闭；预览摘要不构成正式精选、Gold或source admission。无应用provider调用，不等于没有native agent辅助审阅；requested GPT-6.1 Sol Medium、临时quota fallback均按原review provenance保留，实际model未验证。Gate 2仍仅为`PASSED_FOR_BOUNDED_P4_PILOT`，其他Gate和完整近90日覆盖未通过。

下一步顺序：用户手动恢复现有PostgreSQL；只读确认服务与数据库目标；fresh URL去重和完整baseline/CAS；重新冻结并审查40条AD-012导入；执行后由独立QA核验数据库和页面；最后继续剩余pending正文与附件处理。旧raw、旧失败marker和原执行manifest均保留，不重试25条节奏不合规诊断。
