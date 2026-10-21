# NAS Staging 部署与运行验收（2026-10-22）

STATUS=STAGING_RUNTIME_SMOKE_PASS_BRIDGE_EGRESS_REMAINS_BLOCKED
STAGE=P8 隔离NAS Staging部署
GATE=Gate 2 `PASSED_FOR_BOUNDED_P4_PILOT`；Gate 3/4/5未通过
REMOTE_EXECUTOR=B (`luna_bulk_collection`)，C只负责独立QA、文档和Git
DEPLOY_CODE_SHA=ac14beaf1b67ef709578624b388b14767998a80c
DEPLOY_ARCHIVE_SHA256=12567959012a471d9d2bb69b057428bb64431403a69f4ea267c2aeb2ac9cc2e7
DEPLOY_PATH=/vol2/1000/docker/fiscalhot-staging

## 目标目录、固定包与配置

用户要求把Staging放在`/vol2/1000/docker`下；没有修改Docker全局`DockerRootDir`。旧准备目录`/home/codex/fiscalhot-staging`保留，没有删除或覆盖。B在目标路径核实父目录可用后创建独立0700目录，传入固定归档并校验SHA256，再解包。归档共976成员（883 regular files、93 directories）；没有symlink、路径穿越或`.env`/`.data`/`.git`成员。解包后883文件逐一与归档成员字节相同。

归档对固定Git commit的独立审计为`.data/nas-staging-prep-ac14beaf1b67ef709578624b388b14767998a80c/archive-blob-audit.json`，SHA256 `8ef7a34609722b65642c4b3e681318db8c6c4f8e6a43558fbebb272da8dc9688`：883个tracked blobs中26个逐字节相同，857个只存在CRLF/LF差异，0个存在其它内容差异。Dockerfile带CRLF，但没有shell入口脚本；Docker命令为exec-form Node，setup使用Compose内联单行`sh -c`。构建时实际解析Dockerfile，以验证其续行语法。

NAS本机`.env`从旧准备目录复制并比较内容相同，目标权限0600；未重新生成或输出secret。固定`DEPLOY_SHA`仍指向上面的tested code SHA。目标目录执行的配置helper为`render_staging_config_summary_vol2.py`，审核版SHA256 `d7ebdbd2f058601834347fff350c03d021d93c87c82ae7c286da69db9200bd1e`，PROJECT固定为新目标路径。default和`--profile '*'`配置的`config -q`均PASS，脱敏summary全部checks=true：默认服务为db/setup/api/web，仅web映射3221:3221，DB/API没有host ports，数据库名正确；worker/caddy只在可选profile中，volume为项目命名且非external，Web没有backend secret或`/data`挂载，安全flags均false，provider keys为空。

## 只读Docker inventory

新SSH确认`codex`组包含`docker`，Docker客户端和服务端为28.5.2，Compose为2.40.3。DockerRootDir为`/vol2/docker`，`/vol2`可用约750 GB。启动前，`fiscalhot-staging`相关容器、卷、网络及应用镜像均为0；3221没有listener。独立QA通过后，Root授权B作为唯一远端执行owner尝试运行固定`db setup api web`命令。C没有执行远程build/up。

## 构建结果与网络诊断

第一次build/up命令退出1。Dockerfile解析和前置Postgres镜像下载正常；构建在固定Node基础镜像执行`apt-get update`时，连接官方Debian HTTP仓库超时，随后无索引可用而无法定位所需包。失败后没有启动容器或setup、没有运行migration、没有创建Staging volume/network；Postgres基础镜像已pull。Network probe临时容器已清理，固定digest的Node基础镜像已拉取。随后Root授权一次仅用于build的`--network=host`；B先用准确Node digest只读probe官方Debian base/security InRelease，均HTTP 200，再用固定source、同一个tested code SHA执行单次build，依赖安装和Web SSR client/server build均通过。没有改Dockerfile、daemon、registry或runtime network。构建完成后只用`docker compose up -d --no-build db setup api web`启动。

有界HTTP/HTTPS诊断发现宿主机访问官方Debian HTTP与HTTPS均返回200，但Docker bridge容器访问两者均超时；镜像没有CA bundle，因此单纯改用HTTPS不能解决。仅构建命令的host network workaround让依赖下载成功；Compose运行时网络仍是默认project bridge，bridge出网没有修复。未改Docker daemon/全局DockerRootDir、未换第三方镜像源、未关闭TLS或签名。未来启用采集/model/provider前，仍需单独解决和验证运行时容器出网。

## 当前Runtime验收

2026-10-22部署后只读容器检查：数据库`running/healthy`，setup容器`exited 0`，API与Web运行；镜像tag为`aihot-staging:ac14beaf1b67ef709578624b388b14767998a80c`，应用镜像ID为`sha256:ba44cd62cba0af01a7545714a7d80674eadb0961281c55a807d157e7e3a6e028`。唯一host port mapping为Web `3221:3221`；DB/API无宿主端口；worker、caddy容器不存在。创建并保留的项目命名卷为`fiscalhot-staging_db`和`fiscalhot-staging_data`，project network为`fiscalhot-staging_default`；三者由本次启动创建，DockerRootDir为`/vol2/docker`。

内部API `/api/health`返回200。setup应用35条migration；数据库有48个sources，`enabled`、`site_fulltext`、`syndicate_fulltext`均为0。`articles`、`article_revisions`、`publications`、`analyses`、`receipts`、`receipt_attempts`、`job_runs`、`fetch_runs`均为0，`pgboss.job`表不存在。容器内安全flags均false；provider secret/key字段为空，没有执行采集、模型、OCR、Jina、Feishu或IndexNow调用。无文章不是采集成功，只说明seed边界符合Staging预期。

工作站直连`http://192.168.3.100:3221`（绕过本机HTTP代理）验收：`/`、`/all`、`/all?category=fiscal-policy`均200；都含`X-Robots-Tag: noindex, nofollow`及对应HTML robots meta。随机不存在路径返回404且header noindex/nofollow、meta noindex；`/robots.txt`返回200并带noindex/nofollow header。走本机代理的第一次请求返回502，直连后通过。B容器内`node scripts/smoke.ts --base http://127.0.0.1:3221`的30项检查全通过。没有从宿主暴露或直连API/DB端口。

## 当前边界与后续

Staging运行时与页面noindex验收通过；桥接容器的外网连通性仍未通过，不能据此启用采集或provider。Root需另行决定bridge网络的安全修复计划。不要将build-only host networking记为runtime出网已修复。保留DockerRootDir `/vol2/docker`，不得执行`down -v`或清理已创建的volume。Gate 3/4/5仍按各自正式证据判定；Staging健康不授权Production。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：独立核验NAS Staging部署准备和首次有界build/up结果；C未执行远程mutation。

**MODEL**：GPT-6 Luna / high。

**FILES_CHANGED**：本交接、`STATUS.md`、`PROJECT_PLAN.md`、`NAS_DEPLOYMENT.md`；部署代码SHA未改变。归档、env与审计材料均在ignored `.data`，未进入Git。

**TESTS_RUN**：新目标固定归档/883文件校验、env权限与同内容核对、default/profile `docker compose config -q`和脱敏summary检查；只读Docker inventory；宿主/bridge官方Debian HTTP/HTTPS probe；固定SHA host-network build 1次成功；`up -d --no-build db setup api web`成功；35 migrations；内部API health 200；容器内smoke 30/30；工作站LAN页面/404/robots检查。

**RESULT**：目标为`/vol2/1000/docker/fiscalhot-staging`；配置与资源冲突检查通过。首次普通bridge build因Debian包源超时失败；随后一次host-network-only固定SHA build和限定服务启动成功。Runtime、noindex和数据库零内容边界检查通过；bridge容器出网仍阻塞。

**RISKS**：Docker bridge出网恢复路径尚未确认；HTTPS scheme不解决当前超时且基础镜像无CA bundle。当前服务功能/页面验收不代表未来采集、model/provider通道可用。

**BLOCKERS**：启用采集/model/provider前需解决Docker bridge网络无法连通官方源的问题。Staging运行本身已通过限定验收。

**NEXT**：由Root明确Docker bridge出网的安全修复方案；在此之前保持Staging采集/provider flags关闭，不改daemon、不切第三方源。持续保留本次首次失败和host-network build事实，Gate状态不变。
