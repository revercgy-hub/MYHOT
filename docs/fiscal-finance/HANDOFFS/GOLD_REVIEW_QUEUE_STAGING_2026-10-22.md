# Gold 私有人审队列 Staging 部署与验收交接（2026-10-22）

## 2026-10-22 人工标签完成与独立合并QA（最新）

用户已完成原130条待审项。独立核验冻结overlay SHA-256 `e6250b35f8781774a87fdc14071380b85ccc9e5f27020113361293da5700c0df`、merged label-only manifest SHA-256 `2f8e2ef7182127eaf4bd3d9c7df86dde3b3861290d845ff992c32bc9c2a140a6`及证据文件SHA-256 `364772c5bd04d1eda7799da335f533582421e5db30463784968ec237ce0ba585`。原proposal的100项tracked候选逐项deep-equal；合并后150项仅`humanAnnotation`变化。原20个人工标注13 select/7 reject和15个seed身份/决定均未变；新增130项为13 select、117 reject、0 either，全部150项现为confirmed。冻结payload的150正文快照分别与原candidate `bodySha256`匹配；原文章身份只作为metadata来源，live NAS sourceArticle binding仍null/null。event group、split、proposal及source evidence字段都未随人标改变。

显式seed CLI结果为`DRAFT_INCOMPLETE`、0 schema issues、150 confirmed/0 pending、15 seeds checked，exit 3。当前label-only manifest故意不含正文且event/split仍为`needs_review`，不可直接评测。新validator已支持`agent_verified`技术核验状态：只用于event group与split，分别记录`eventGroupVerification`及`samplingContext.splitVerification`中的reviewer/method/verifiedAt/evidenceSha256；真人`humanAnnotation`仍只能真实`user_confirmed`。明确事件可按源事实分组，按冻结确定性规则整组切分并独立QA；有歧义的项保留`needs_review`。这一技术状态不声称模型准确率，也不代表Gate 3通过。详细状态见[P5 readiness](../P5_GOLD_DATASET_READINESS.md)。

独立事件QA现已完成：150条均为唯一材料且无精确重复，39个近标题候选逐项核对后无同一地方实际事件；新metadata-only版本`.data/fiscal-qa/review-batches-20261022/reviewed-manifest-agent-verified-20261022.json` SHA-256 `a79839b1e27a368a3cdee65b36b38b9d075933cd39dc7d99c95839d3e74199dc`；QA证据`.data/fiscal-qa/review-batches-20261022/independent-event-group-qa-20261022.json` SHA-256 `9a2e73c412df98e53bb95b3905ea4d338a28fdfb08730448fe36500fa5937b71`。所有150条各为agent-verified单例事件组并分入development，holdout=0；已查看本批人标和分歧分析，不能重包装成盲测。旧tracked100、label-only manifest和原150 proposal均保留，不覆写。下一步由B收集50条全新、事件不重叠且正文合格的候选；先冻结两次隔离native预测，再向用户盲审。之后按既有评测合同完成留出评估、错例审阅和阈值确认。原15 seeds、旧20及本批150全部仅作development。Gate 4仍缺计划范围的完整来源/覆盖证据及正式review；Gate 5仍缺稳定性观察和恢复演练。validator READY（如达到）只代表静态数据完整；本工作不代表Gate 3/4/5通过。

**TASK**：用户人审标签合并的独立QA和Gold technical-verification contract。

**MODEL**：Luna High；未调用任何项目模型或provider。

**FILES_CHANGED**：`scripts/fiscal/gold-dataset.ts`、`scripts/fiscal/gold-review-packet.ts`、两项对应focused tests、`docs/fiscal-finance/P5_GOLD_DATASET_READINESS.md`、`STATUS.md`、`PROJECT_PLAN.md`、`GOLD_REVIEW_QUEUE.md`及本交接追加段；未改tracked100/150、B payload/overlay或A sidecar。

**TESTS_RUN**：独立Node检查overlay/manifest/payload身份、字段差异、150 body SHA、旧20/seed15；Gold CLI显式seed验证（预期DRAFT_INCOMPLETE/exit 3）；gold dataset+packet tests 17/17；`npm run typecheck`通过。未运行模型评测、NAS操作或全后端/全Web套件。

**RESULT**：150/150用户决定完成，26 select/124 reject/0 either；新增130为13/117/0。原20和15 seed保持。C独立核验并写入新版本的150个agent-verified事件组及development拆分；holdoutCount=0。即使Gold静态validator将完整输入标为READY，也不等于已有独立评测或Gate 3通过。

**RISKS**：150个人工标签和native分歧指标不是模型性能；seed、已用于偏好语境的旧20及全部已分析的150条都不能作为盲测；新metadata manifest不含正文，不能直接作为`eval-selection.ts`输入；holdout当前为0。

**BLOCKERS**：Gate 3仍需新建一批50条正文合格且与150材料/事件不重叠的样本，冻结预测后盲审，并执行holdout评估及错例/阈值审阅。Gate 4和Gate 5分别仍缺完整覆盖证明和稳定性/恢复演练。不得把预测、数据静态READY或Staging批准表述为Gate通过。

**NEXT**：B限定采集并QA新50候选；冻结两次隔离native预测，再由用户盲审标签；补正文齐全Gold评测输入，运行开发/留出评估并审阅错例和阈值。Gate 4补来源覆盖证据，Gate 5做稳定性观察及真实恢复演练。

## 结果

固定代码 SHA `21ca4d400bda9071f1e0b8761d404d1fc5b001e5` 已部署至用户指定的 NAS 隔离目录 `/vol2/1000/docker/fiscalhot-staging`。本轮新增 migration `0039_gold_review_batches.sql`，Staging 已应用 36 条 migration。镜像 tag 为 `aihot-staging:21ca4d400bda9071f1e0b8761d404d1fc5b001e5`，image ID `sha256:e756efa1c8368d01d3accfc2654de0f900e7ae52472dcdc9dc34ce7759c6693f`；旧 `ac14beaf...` 镜像保留。运行服务为 `db/setup/api/web`，db healthy、setup exit 0、api/web running；worker 和 Caddy 未启动。只有 Web 绑定宿主 `3221`，DB/API 无宿主端口；project volumes 是 `fiscalhot-staging_data`、`fiscalhot-staging_db`，network 为 `fiscalhot-staging_default`。旧 `/home/codex/fiscalhot-staging` 准备目录保留。

部署前在 NAS 保存了 staging DB custom-format dump，路径 `/vol2/1000/docker/fiscalhot-staging/.data/deploy/backups/pre-review-batch-20261022T014152Z/fiscalhot_staging.before-review-150.dump`，141,388 bytes，SHA-256 `9434bc70cb27de6ae1211f70d13497edd7d12893cc98b87dc471b100b6cafbcc`，权限 0600。使用 PostgreSQL 17 容器执行 `pg_restore --list`，得到359个TOC条目。**这只验证归档可读；没有做恢复演练。**旧镜像保留；未删除或覆盖既有卷。

固定 payload `payload-150.json` 为 1,003,770 bytes，SHA-256 `63e0ac1de60c8960095bccb32827f8f77ebc82a1f42e849a14bfc4a18f087b50`；batch hash `ef0a79d3cd791efad169ab4904e6666fb34cf1515fe3a6f0a3456a125042c889`，来源 manifest SHA-256 `f22fa8b25da6a281d320aa4febc1cfb2dd599ff41fa37be1ca73bcce118f7af7`。导入一次写入150个私有候选：20条已有人工确认（13 select、7 reject）保持不变、130条 `needs_review`；15条原 seed 仍为confirmed且没有一条被置为holdout。150条的live article/revision绑定均为null/null；原本地文章ID只保留在冻结metadata来源记录中。没有提交任何新人工决定。

导入后只读 SQL：48个 source 均 disabled，`site_fulltext`、`syndicate_fulltext` 均关闭；articles、article_revisions、publications、analyses、receipts、receipt_attempts、job_runs、fetch_runs 均为0；`gold_review_batches` 为1行，`gold_review_cases` 为150行，import audit为1行。没有worker消费、文章发布、模型或外部provider调用。安全开关 `COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`OCR_RUN_ENABLED`、Feishu、IndexNow、Jina与私网抓取均为false；`EMBEDDINGS_ENABLED`未设置，但模型调用总开关关闭。容器runtime仍使用Compose bridge；先前为了镜像构建使用的 `--network=host` 只作用于build，不改变runtime网络。B对本项目bridge做过有限只读探测，官方Debian HTTP/HTTPS、MOF预算与PBOC公开市场的指定GET/headers返回200；这只证明列出的端点可达，不代表其它源可达、采集已开或覆盖完成。

## 独立验收

NAS postrun证据显示内部 API health 200、匿名 review API 401、未登录 `/admin/review` 跳转到登录页、管理员登录后批次列表/详情/SSR 200。队列计数150/130/20；每页25条。API/HTML只呈现允许的中性展示字段和正文，没有暴露候选metadata、机器proposal、评分、理由、seed或split；没有调用决策POST。

C 从工作站做了无凭据只读 HTTP 复核：`/`、`/all`、`/topics`、`/api/health`、`/robots.txt`、`/admin/login?return=%2Fadmin%2Freview` 返回200；随机路径返回404；未认证 `/admin/review` 返回302并精确重定向到 `/admin/login?return=%2Fadmin%2Freview`；匿名批次列表和详情 API 都返回401。公开页面与404均带 `X-Robots-Tag: noindex, nofollow`，HTML页面含noindex标记。应用 smoke 30/30通过。

本轮 fresh local software checks：backend `npm test` 431项（430 pass、0 fail、1 skip），typecheck通过，Web build通过、Web tests 22/22。固定代码已分三次提交：backend/API/migration `67ed061`、CLI `5415d43`、Web UI `21ca4d4`；最终固定 SHA 为 `21ca4d400bda9071f1e0b8761d404d1fc5b001e5`。CI workflow没有作为本轮本地检查结果的替代。

Ignored独立审计文件位于 `.data/deploy/review150-deployment-evidence.json`（SHA-256 `051faa603689cb735a582424cd48156642c55c73749af3a5c16517c0e863268b`）和 `.data/deploy/review150-postrun-evidence.json`（SHA-256 `189870c3bbcad2506f0a996ccd4102b54ec6dc190bf407d57b3331104577bbdc`）。冻结payload在 `.data/fiscal-qa/review-batches-20261022/payload-150.json`；导入缓存正文和凭据均不进Git。50条新 native screening 是独立辅助sidecar：23 select、22 reject、5 either，50条全部仍 `needsHumanReview=true`，与payload中新增50条body hash匹配，不修改Gold payload、已有20个人工标签或15个seed；它们不能替代人工决策。

## 使用与边界

用户可打开 `http://192.168.3.100:3221/admin/login?return=%2Fadmin%2Freview`，登录后分页查看材料。只有显式勾选并提交的候选才保存 `select`、`reject` 或 `either`；未勾选仍是待审，既有20条只读。审核只记录私有Gold人审，不发布内容、不更改公开精选、不自动将新确认项加入seed/holdout，也不会自动令Gold达到ready。

如需在用户自己的Windows PowerShell终端取回初始管理密码，可运行以下只读命令；命令输出仅应留在用户本机终端。Codex不读取或回显该secret：

```powershell
ssh -F "$env:USERPROFILE\.ssh\config.txt" -o StrictHostKeyChecking=yes -o IdentitiesOnly=yes -o ForwardAgent=no fnnas "sed -n 's/^ADMIN_PASSWORD=//p' /vol2/1000/docker/fiscalhot-staging/.env"
```

Root对本次结果的裁定是 `APPROVED_FOR_PRIVATE_BATCH_REVIEW_ON_STAGING`，只针对私有人审队列功能，不是Gate 3、Gate 4、Gate 5通过，也不是Production授权。Gate 3仍需要足量独立Gold、事件组隔离与正式评测；Gate 4仍需要完整来源/覆盖证据；Gate 5仍需要Staging稳定性、恢复演练和正式Gate审查。当前下一步由用户在UI人工审核130条待审项；之后导出overlay、与冻结manifest合并并显式seed校验。若还需新增采集，应另定受限scope并维持source/provider开关关闭，不能把人工审核批次或native建议视为采集授权。
