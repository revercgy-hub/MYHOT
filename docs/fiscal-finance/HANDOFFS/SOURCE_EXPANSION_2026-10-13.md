# 10月13日来源扩展与正文检查点（进行中）

```text
STATUS=IN_PROGRESS
STAGE=P3 官方来源证据与预览维护
GATE=Gate 2 PASSED_FOR_BOUNDED_P4_PILOT；Gate 3–5未通过；本轮没有source admission或Gate裁定
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=6b1c2def0b683500cb7ce4846d6e5479b0779940（docs-only handoff commit的父SHA）
STAGE_CODE_SHA=6b1c2def0b683500cb7ce4846d6e5479b0779940（preview/LAN review代码提交；精确SHA CI成功）
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
```
WORKTREE=5个preview/LAN review代码文件及本检查点5份文档已分组提交并push；handoff交付时工作树clean，origin与本地HEAD一致，最终SHA由当轮git交接报告给出。

## 范围与结论

本检查点记录一次fresh隔离库采集、同库冻结pending正文提取、获批队列隔离，以及独立local preview从29条扩到59条的验证。Lead批准了本轮preview/LAN review范围；preview数据由已审核摘要seed维护。六个bulk测试库累计425条，body状态305 `ok`、102 pending、18 held；preview 59条单独维护，不加入该合计。`ok`仅表示正文提取结果。来源均保持disabled、全文分发关闭；本轮不构成栏目覆盖、持续稳定、业务质量或source admission结论。

### 单页采集

Lead批准15个catalog source在新库`fiscalhot_source_expand_20261013_test`单次运行（35 migrations）。使用既有collector、单页，不扩历史分页；Fujian metadata-only配置拒绝详情driver。实际dispatch 25/400，无redirect、reject或retry。结果为158 found、116 stored、15 fetch runs，结束DB有116 articles/revisions、118 discoveries；analyses/receipts/selected ledger/state/job_runs/pool_search均为0。所有catalog sources remain disabled，站内全文与转发全文关闭。

| Source ID | Found / stored | 备注 |
|---|---:|---|
| `mof-shanghai-supervision-dynamics` | 10 / 10 | 单页 |
| `mof-ningxia-supervision-dynamics` | 10 / 10 | 单页 |
| `mof-gansu-supervision-dynamics` | 10 / 10 | 单页 |
| `mof-qingdao-supervision-dynamics` | 10 / 10 | 单页 |
| `mof-ningbo-supervision-dynamics` | 10 / 10 | 单页 |
| `mof-shenzhen-supervision-dynamics` | 10 / 10 | 后续pending正文批次排除该整源 |
| `mof-liaoning-supervision-dynamics` | 10 / 10 | 后续pending正文批次排除该整源 |
| `mof-yunnan-supervision-dynamics` | 9 / 7 | 其余候选未存；正文观察仅覆盖7存档项 |
| `mof-budget-work` | 10 / 0 | 严格日期/来源规则未写入 |
| `fujian-finance-notices` | 5 / 5 | metadata-only，不请求详情或PDF |
| `pboc-xiamen-work` | 20 / 8 | 其余候选未存；没有本轮正文batch |
| `mof-accounting-notices` | 10 / 10 | 后续正文batch整源排除（既有附件hold） |
| `mof-regional-supervision-dynamics` | 9 / 7 | 其余候选未存；无本轮正文batch |
| `xiamen-csrc-regulatory-work` | 20 / 4 | 其余候选未存；无本轮正文batch |
| `govcn-policy-library` | 5 / 5 | 单页 |
| **Total** | **158 / 116** | **15 source / 25 actual HTTP dispatch** |

Collector原manifest结果为`partial_or_failed`且原样保留两项violations：`attachment_hold_rows_present`与`unexpected_or_consumed_queue_job`。后者是7个成功inline detail产生`content.analyze` created jobs；Lead批准后，单独事务精确取消这7个job，未删除或消费。原始manifest未被改写；独立隔离证据见`analysis-job-quarantine.json`。108个`content.extract-body` jobs未改动。附件hold仅记录未处理状态；没有下载PDF或附件。

### 冻结正文批次

在同一隔离库，冻结54篇pending ID，7个有detail HTML driver的source：GovCN 4、甘肃9、宁波9、宁夏9、青岛9、上海9、云南5。排除Accounting整源（既有附件hold）、深圳及辽宁整源（先前inline identity mismatch），以及Fujian 5、PBOC厦门8、区域监管7、厦门证监4等无detail或metadata-only候选；排除PDF。仅走既有body extractor，未重抓列表、无retry、串行节流、首次non-ok停该source，预算150 actual HTTP dispatch含redirect。

44次实际dispatch均为direct request，0 redirect/reject。冻结基线为108 pending/7 ok/1 held，完成后为64 pending/48 ok/4 held；本次净变化为41 `ok`、3 held。GovCN 2次（先1 ok、再`attachments_unprocessed`停），甘肃9次（8 ok后`attachments_unprocessed`停），宁波9次ok，宁夏1次`identity_mismatch`后停，青岛9次ok，上海9次ok，云南5次ok。其他剩余候选均未请求。source flags保持关闭；analyses/receipts/selection/job_runs/pool_search均为0。队列中108个extract jobs保持created、未消费。

## 证据和复核

忽略目录证据位于`.data/fiscal-qa/source-expand-20261013/`和`.data/fiscal-qa/source-expand-body-20261013/`。

- Collector scope SHA `dd579a865892b099689a19b43731604eff7a8f3438cfbd0966a6672a1de5c8ad`；runner SHA `cf15d79e770479fdc2612bbb66e61e7931f55d3732b69e26ab42a26269d8a888`；preflight SHA `db92c51329f3eab3d0b76a4edb46a0f4bbf89cdc7e61c8221a90ed33457abd55`。
- Collector manifest `.data/fiscal-qa/source-expand-20261013/evidence/manifest.json`；只读SQL审计 `.data/fiscal-qa/source-expand-20261013/evidence/read-only-sql-audit.json`；精确job隔离审计 `.data/fiscal-qa/source-expand-20261013/evidence/analysis-job-quarantine.json`。保留原manifest中的violations字段，不将结果改写为无异常完成。
- Body freeze `.data/fiscal-qa/source-expand-body-20261013/frozen-candidates.json` SHA `d59bad64466cc35a7571569d72628c9f1f8b97fce3a4b94ab32c4bcbdc172e45`，canonical ID hash `3ade248e3529e3c4c6951752c983a1fed086f9b81278e5095acf17cf3bdfc07f`；runner SHA `0427aa057c0362bf03671f704382a5eb82e52085ff7b85cca52726aa6751cee2`；preflight `.data/fiscal-qa/source-expand-body-20261013/evidence/preflight.json`。
- Body manifest `.data/fiscal-qa/source-expand-body-20261013/evidence/manifest.json` SHA `b95aeee0239291135ea3a948bbde6eeb0b70c3a8ee791f1b02d3432f12d18573`；SQL export `.data/fiscal-qa/source-expand-body-20261013/evidence/body-sql-export.json` SHA `5cab6785ecd05d9266de5d535eddd448295371bb68b5ce45d0ac14c0bb8df704`；44 raw response files位于相邻`responses/`目录。Counts独立审计PASS：44/44 raw hash/length/EOF与HTTP GET dispatch一致；54 ID与SQL body状态对账为41 ok、3 unconfirmed、10未尝试pending；source flags均false、分析/回执/选择/job_runs/pool_search均为0；7 analyze jobs cancelled、108 extract-body jobs保持created。三条held为GovCN与甘肃`attachments_unprocessed`、宁夏`identity_mismatch`。
- 软件QA：fresh `fiscalhot_final_qa_20261013_test` 35 migrations、backend 377/377、typecheck、Web build、Web tests 17/17均通过。首次并发build/Web test遇到cache下测试依赖build文件缺失；串行重跑全过，保留初始失败事实。
- Git/CI：preview/LAN review改动只提交5个指定代码文件，commit `6b1c2def0b683500cb7ce4846d6e5479b0779940`，已push至origin `feat/fiscal-finance-hot`；`git ls-remote`与本地代码HEAD匹配。对该精确SHA的GitHub Check+Docker run [38327393124](https://github.com/revercgy-hub/MYHOT/actions/runs/38327393124) `completed/success`，workflow head SHA完全一致。本文和状态矩阵为独立docs-only提交。
- Local preview从29扩至59。首次seed遇到PostgreSQL JSONB Date/Infinity/undefined与JS值表示差异后触发既有行保护、未改DB；比较器规范化后再执行唯一seed。QA读写前后核实旧29条在8表全字段及timestamps无变化；新30条是summary-only、bodyless、eligible/unselected/nonindexable，jobs/analysis/receipts/fetch_runs为0。preview只是本地人工review seed，不与425条bulk数据合并，也不代表正式精选或发布。

## 安全边界、风险和下一步

COLLECT/MODEL/provider/OCR/Jina/worker、全局source开关及全文开关保持关闭；没有付费服务调用、PDF/附件请求或生产库写入。目标库为loopback fresh隔离测试库，preview使用其独立既有preview seed流程。隔离测试库数据不是主页可见内容。

此前第一次防火墙规则创建尝试因access denied以exit 1结束，作为历史保留。随后用户提供成功创建输出；Counts只读核实ActiveStore和PersistentStore各有两条等价规则（不删除）：DisplayName `MYHOT local LAN preview TCP 3000`，Enabled、Public、Inbound、Allow、TCP/3000、local address `192.168.3.47`、remote subnet `192.168.3.0/24`、interface `以太网`，GUID分别为`{7ea9cd3d-98e2-4312-aead-eafc689398be}`和`{04e2d2ad-67f6-40b5-91cf-4a54e8ac9354}`。使用范围仅覆盖指定子网，异机实际可达性仍需另一台设备验证。

服务由用户手动启动；Counts没有重启或改配置。runtime state及日志位于`.data/fiscal-qa/lan-web-20261013/`：Web `0.0.0.0:3000` PID 365024，API `127.0.0.1:3001` PID 203468，Postgres `127.0.0.1:5432` PID 423500；runtime.json记录对应PID与preview数据库，API stdout记录listen成功，stderr只有Fastify deprecation warning，Web stderr为空。只读系统状态显示服务正在运行。

初次用默认系统代理请求局域网IP时返回502；在本机仅为checker进程清除HTTP/HTTPS/ALL/NO_PROXY大小写变量与`NODE_USE_ENV_PROXY`后直连，首页、`/all`、`X-Robots-Tag: noindex, nofollow`、robots meta及`assets/manifest-fcefeb47.js`均通过，页面/asset/API请求返回200。API health、timeline、pool返回200；匿名`/api/admin/me`返回预期401。502属于代理路径结果，直连未复现网站错误。

本机smoke通过：`node scripts/smoke.ts --base http://192.168.3.47:3000` exit 0，27/27项成功，包括`/api/mcp` stateless initialize握手（未调用MCP tools）；使用临时清代理的checker进程执行并在结束后恢复环境，不改变服务进程或配置。smoke输出未落独立文件。上述只验证本机，异机/跨设备网络访问未验证。

```powershell
New-NetFirewallRule -DisplayName 'MYHOT local LAN preview TCP 3000' -Direction Inbound -Action Allow -Profile Public -InterfaceAlias '以太网' -LocalAddress 192.168.3.47 -RemoteAddress 192.168.3.0/24 -Protocol TCP -LocalPort 3000
```

未证明这些sources的完整90日覆盖、历史分页、跨周期稳定或整栏业务质量。三处正文held及原collector异常按证据保留；不重跑此scope。下一步只读检查48个catalog sources中尚未尝试的3个（含NFRA），提出有限metadata单页能力缺口；本交接不授权新网络请求、正文补抓、启源或改Gate。

## 声明

Requested model为Luna High；实际model未由本记录验证。执行agent处理大部分操作、Lead负责设计/纠偏/核准；token占比未测量，约90/10仅为估计。记录仅陈述manifest、SQL审计、原始response、离线复核和测试命令支持的事实。`bodyStatus=ok`不等于业务审核通过；本文件未提及的行为不视为已验证。
