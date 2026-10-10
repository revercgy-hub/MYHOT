# 本地页面内容预览

## 2026-10-10 后续候选状态：三条浙江编辑摘要（尚未seed）

后续代码SHA `3385ef05ebf448a0bd9d68daf748d03b24b34440`在seed定义与预览server/test allow-list中加入三条浙江监管工作候选，旧六条样本ID保留。新ID为`local-preview-mof-zhejiang-real-funds`、`local-preview-mof-zhejiang-transfer-performance`、`local-preview-mof-zhejiang-fiscal-supervision-202608`。三个样本日期为2026-07-21、2026-07-29、2026-08-11，均在2026-10-10前90天内；更早的7月9日和6月30日候选因超出范围被排除。当前代码因此定义九条可识别sample，但本机没有seed或数据库读取，本机当前实际篇数未知；先前六条seed结果仅为上一轮历史审计，不推断仍是现状。

owner与QA从三份保存详情raw复核题名、日期和摘要事实。用当前`extractSelectedBody` helper重算的body长度/SHA见[本轮交接](HANDOFFS/CONTENT_PREVIEW_ZHEJIANG_AND_XIAMEN_PDF_2026-10-10.md)。summary均标“开发预览·编辑摘要；未经正式模型精选”；provenance的requested model为`gpt-6-luna/high`，actual model ID为`unverified`。human Gold、正式模型精选、事件聚类、project provider receipts均未发生。

集中QA完成selected-body focused 9/9、typecheck、Web build、Web tests 16/16。用户已表示手动恢复服务并手动运行CI；其后一次只读检查仍观察到本机API、Web、PostgreSQL均无listener，且GitHub Actions列表无本轮SHA的run。没有运行本机seed、查询数据库或live页面GET。因此新三条尚未入库，六条历史seed和live root/item呈现均未按当前状态复核。记录是该次快照；收到用户实际启动/运行结果后再追加更新。

## 2026-10-10 前序记录：六条preview seed曾通过隔离库审计

历史快照日期：2026-09-29。以下“页面入口与样本”及后续各节描述当时独立开发预览库的三篇人工样本；它们不是2026-10-10六篇seed当前状态的页面核验结果，也不代表模型精选、Gate 2通过或正式发布内容。

## 2026-10-10 前序检查点：Luna辅助识别内容预览扩展（六条seed历史结果；live页面待API）

用户已授权用Luna模型辅助识别保存的官方正文。对四条来自两个隔离`_test`库的body做只读identity/contentHash复核后，gpt-6-luna/high（`codex_agent_assisted`）及独立body-blind第二识别记录为：OMO第192号、2026年8月地方债发行/余额、厦门监管局中央企业国有资本收益审核三条正例；网络安全宣传为负例`BLOCK`，不加入预览。双评明确对应为：OMO第192号69/69，2026年8月地方债81/85，厦门央企国资收益审核56/70，网安宣传28/32；厦门评审分歧保留，不取平均，不用于校准、改门槛或声称质量通过。输入JSON见`.data/fiscal-qa/luna-content-20261010/input.json`（SHA-256 `d7d872208e029dda9108c684a183b148e57da18f825d9dd26677efe6821e585c`），模型识别、metadata audit、second recognition文件在同目录。

Root批准在AD-012既有seed/publication范围内增加三条正例、保留旧三条，预览allow-list精确为`local-preview-pboc-omo-191`、`local-preview-mof-budget-qa`、`local-preview-pboc-xiamen-payment`、`local-preview-pboc-omo-192`、`local-preview-mof-debt-202608`、`local-preview-mof-xiamen-capital-review`。冻结工作树运行HEAD `199e857`，5个目标文件起止SHA稳定；fresh `luna_preview_20261010_test`创建自空库并完成35 migrations，pre业务计数0；typecheck、backend 370/370、Web build、Web tests 15/15均通过，日志`.data/fiscal-qa/luna-preview-qa-20261010/`。fullMODEL仅fake路径，real keys/endpoints/proxies unset，P4 opt-in unset，其余flags false。首个只读预check查询误选不存在列`article_revisions.body_html`并失败，但未写入；修正后的只读检查通过，错误日志不是产品缺陷。精确`fiscalhot_preview_test`只seed一次且exit 0：原3篇unchanged、新3篇created；post-check为6 sources/articles/revisions/discoveries/publications/overrides/audits/eligible。旧3条source/article/revision/publication/override/audit与seed前baseline一致，输入hash和Luna provenance完整；selected、score、reason、analysis、receipt、jobs、fetch、body、queue均为0，source/fulltext flags为false。

冻结内容随后提交为`7bab896d029016f32d1ad3bf3c8bd7ac01eef3f2`；GitHub workflow run `38027644649` 对精确headSha的Check与Docker均success。CI built-site smoke不替代下文未执行的本机live GET。

本轮没有页面请求（GET=0）：最新独立只读检查确认Web `127.0.0.1:3000`与API `127.0.0.1:3001`均无listener；没有启动或重启服务。故live root/item页面可见性和HTTP noindex header均未验证。后续若要核验，须由用户在两个独立PowerShell窗口手动启动API和Web后再安排有限loopback GET；旧记录中“Web仍在监听”的事实已过期。

2026-10-10新增的根布局护栏在root metadata loader成功、失败时均为本地预览head保留`noindex, nofollow`，并通过`/all`叶路由metadata覆盖与root API fallback测试。冻结工作树QA的cache focused 10/10、Web tests 16/16、typecheck与Web build通过；组合代码SHA `3de96df641b08c817ba2dfea032ca9254399e66d`的GitHub Check/Docker run `38036049523`对精确headSha完成并成功。该软件QA不替代上段未执行的本机HTTP检查。

### 用户手动启动本地预览数据库、API与Web（可选）

若用户决定继续 live 页面核验，请先在仓库根目录的 PowerShell 窗口启动已存在的隔离 PostgreSQL 实例，再在另两个独立窗口手动启动 API 与 Web；先数据库、再 API、最后 Web。以下命令使用当前机器实际存在的 EDB PostgreSQL 17.11 便携实例，不创建或初始化数据目录，也不启动 worker。执行前应确认仓库根目录正确；不要打印或复制`.env`、密钥，也不要改用部署用 Compose。API变量显式关闭副作用开关，并固定到隔离的loopback preview DB。

```powershell
$aihotRepoRoot = (Get-Location).Path
$previewPgCtl = Join-Path $aihotRepoRoot ".data\test-pg\pgsql\bin\pg_ctl.exe"
$previewPgData = Join-Path $aihotRepoRoot ".data\test-pg\cluster"
$previewPgLog = Join-Path $aihotRepoRoot ".data\test-pg\preview-postgres-manual.log"
& $previewPgCtl -D $previewPgData -l $previewPgLog -o "-h 127.0.0.1 -p 5432" -w start
```

这仅启动绑定`127.0.0.1:5432`的本地预览数据库；不要启动其他数据库实例。数据库就绪后再按下面配置启动 API 和 Web。

```powershell
$env:NODE_ENV = "development"
$env:DATABASE_URL = "postgres://postgres@127.0.0.1:5432/fiscalhot_preview_test"
$env:API_HOST = "127.0.0.1"
$env:API_PORT = "3001"
$env:API_BASE_URL = "http://127.0.0.1:3001"
$env:SITE_URL = "http://127.0.0.1:3000"
$env:COLLECT_ENABLED = "false"
$env:MODEL_CALLS_ENABLED = "false"
$env:JINA_BODY_FALLBACK = "false"
$env:INDEXNOW_SUBMIT_ENABLED = "false"
$env:FEISHU_CONTENT_PUSH_ENABLED = "false"
$env:FEISHU_INTERNAL_ENABLED = "false"
$env:ALLOW_PRIVATE_NETWORK_FETCH = "false"
npm run dev:api
```

在另一个PowerShell窗口以loopback安全配置启动Web：

```powershell
$env:NODE_ENV = "development"
$env:LOCAL_PREVIEW_ENABLED = "true"
$env:SITE_URL = "http://127.0.0.1:3000"
$env:API_BASE_URL = "http://127.0.0.1:3001"
$env:WEB_HOST = "127.0.0.1"
npm run dev:web
```

以上命令仅供用户自行决定后执行；本轮没有运行它们。数据库、API和Web就绪后才能单独安排有限loopback页面GET及noindex核验。GitHub CI内置的built-site smoke是独立的CI检查，不代表本机 live 页面已验证。

这些内容的来源字段带Luna辅助摘要及输入/body hash provenance，但`siteProviderCalls=0`、receipts=0、无analysis、score=null、selected=false，源body不写入预览库；`humanGold=false`、system clustering=`NOT_RUN`。摘要在页面使用“编辑摘要 · 开发样本”标记，未精选声明不变。该Luna识别不等于应用真实provider执行、独立人工Gold、正式P4质量通过或Gate变化；source仍disabled，全文和索引保持关闭。

## 历史快照：2026-09-29三条旧人工样本的本地预览

以下页面入口、seed数据库与live页面通过结果均为2026-09-29历史记录。不要将旧三条样本和当时的30/30 smoke、HTTP noindex结果套用到2026-10-10新增六条样本；当前六条live GET为0，等待API由用户手动启动后再单独核验。

### 页面入口与样本

本地 Web 在 `http://127.0.0.1:3000` 提供预览；全站顶部显示“开发样本预览 · 人工摘要 · 未经模型精选”，并链接已有 `/all`。三个样本位于 `/all`，各 item 详情保留真实官方标题、机构、发布日期和原文链接。主页精选仍走原有 selected-only 读取条件，因此为空是预期结果；它没有被改成展示未精选内容。

| 内容 | 来源日期（上海时间） | 官方原文 |
|---|---|---|
| 公开市场业务交易公告 [2026]第191号 | 2026-09-29 | [中国人民银行原文](https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/2026092908461628271/index.html) |
| 财政部有关负责人就2026年中央预算公开答记者问 | 2026-03-26 | [财政部预算司原文](https://yss.mof.gov.cn/gongzuodongtai/202603/t20260326_3986132.htm) |
| 人民银行厦门市分行：支付护航投洽会 便利服务迎嘉宾 | 2026-09-14 | [人民银行厦门市分行原文](https://xiamen.pbc.gov.cn/xiamen/127699/2026091714532820798/index.html) |

这些条目的摘要根据此前逐篇核实的官方详情撰写，并以前缀“开发预览·人工摘要；未经模型精选”标识。OMO摘要按来源原句记录“同时，开展了6985亿元隔夜逆回购操作。”未添加政策影响判断。三篇原文正文未写入预览库，也没有伪造分析、评分、精选理由或讨论数据。

### 写入方式与隔离

`scripts/seed-local-preview.ts` 仅接受无密码 `postgres@127.0.0.1:5432/fiscalhot_preview_test`、显式 `SITE_URL=http://127.0.0.1:3000`、loopback API/Web 地址与 `LOCAL_PREVIEW_ENABLED=true`。它拒绝 Production、开发登录绕过、启用的采集/模型/Jina/IndexNow/飞书/私网访问开关，以及固定样本 ID allow-list 以外的任何数据库身份。入库使用 `upsertMaterial`、现有 editorial override 与 `publishArticle`；数据库中每个来源仍为 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`。

归档的验证库 `fiscalhot_preview_test` 有 35 项 migration 与 34 个主题。seed 首轮创建 3 个来源、3 篇文章和 3 个合格 publication；第二轮三篇均报告 `unchanged`。SQL核验每篇 article/publication/override 版本均为 1、文章 revision 行各 1、每条人工审计记录各 1；`eligible=3`、`selected=0`、`score/reason=null`、`body_mode=summary`、`indexable=false`。数据库中没有正文、analysis、receipt、job run、pg-boss job 或 selected ledger/state；采集、模型、Jina、IndexNow、Feishu 与私网访问 flags 全 false。seed 未调用 collector、worker、provider 或网络源。

### 页面和公开出口核验

- `/`、`/all` 与样本详情 SSR 均返回 200；首页含开发样本 banner/`/all` 链接且精选列表为空，`/all` 显示三个已核标题。
- item 页显示“人工摘要 · 开发样本”及未模型精选说明。Web 响应带 `X-Robots-Tag: noindex, nofollow`；预览 root/item meta 也设置 noindex。生成的 API 与全量 RSS 摘要保留人工预览前缀，不能被误认作模型摘要；精选 snapshot 与精选 RSS 均不含这三个条目。
- `/api/site/pool` 返回三篇，`score=null`、`reason=null`、`selected=false`，发布日期对应原始上海日期（UTC分别为 `2026-09-28T16:00:00Z`、`2026-03-25T16:00:00Z`、`2026-09-13T16:00:00Z`）。`/api/site/timeline` 的精选 cards 为空。
- 开关默认关闭；Focused guards 4/4、全量 typecheck、Web build、Web 测试 15/15 与 loopback smoke 30/30通过。fresh `fiscalhot_content_preview_test` 35 migrations 后完整 `npm test` 156/156 通过。Web 当前以 `NODE_ENV=development` 在 `127.0.0.1:3000` 提供构建版页面，preview flag 只在该 Web 进程开启；API 与 PostgreSQL 均为 loopback，其他安全开关 false。

本地页面预览仅用于查看固定人工样本。生产、NAS、真实模型、采集任务和来源配置仍保持关闭；所有来源稳定性、正文质量和栏目覆盖须按 P3/Gate 2 规则单独验收。
