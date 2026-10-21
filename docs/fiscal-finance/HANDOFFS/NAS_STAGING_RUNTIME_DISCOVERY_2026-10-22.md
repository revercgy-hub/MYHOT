# NAS Staging 只读现场核验（2026-10-22）

STATUS=BLOCKED_BEFORE_DEPLOY（只读现场访问成功；Docker资源不可见；无已确认远端mutation）
STAGE=P8 隔离NAS Staging部署准备
GATE=Gate 2 `PASSED_FOR_BOUNDED_P4_PILOT`；Gate 3/4/5未通过
BRANCH=feat/fiscal-finance-hot
DOCS_BASE_SHA=b855c20
DEPLOY_CODE_SHA=ac14beaf1b67ef709578624b388b14767998a80c
DEPLOY_ARCHIVE_SHA256=12567959012a471d9d2bb69b057428bb64431403a69f4ea267c2aeb2ac9cc2e7

## 用户指令与授权边界

用户于2026-10-22解锁了本机SSH identity，继续此前明确的NAS隔离Staging请求：LAN地址`192.168.3.100`，Web宿主/容器端口目标`3221:3221`。Root授权本地/远端只读发现，要求在Root最终S1前不写NAS、不启服务。本文只记录只读事实和准备物，不代表部署操作已获最终批准；Gate 3/4/5仍按正式证据条件判定。

## 只读发现

经strict SSH只读会话确认：NAS报告Debian 12、kernel 6.18、Docker 28.5.2、Docker Compose 2.40.3。`/home/codex`所在文件系统约有35 GB可用；候选新目录`/home/codex/fiscalhot-staging`当前不存在且home可写。TCP 3221当时无listener。SSH认证已工作，远端账号为`codex`。

Docker daemon资源不能由该账号只读核验：直接Docker CLI访问`/var/run/docker.sock`报permission denied；`sudo -n -l`返回exit 1并要求密码。无法读取daemon版本/info、现有containers、images、networks、volumes或DockerRootDir，也不能确认`fiscalhot-staging`命名空间无旧资源。候选目录不存在与端口空闲不等价于Docker daemon中没有既有项目/卷。没有更改组、socket权限、sudoers或NAS服务；没有已确认远端写入。

## 固定代码包及配置草案

固定tested code SHA `ac14beaf1b67ef709578624b388b14767998a80c`在本地Git对象库存在。为没有Git客户端的NAS准备的本地归档为：

```text
D:\AI-work\MYHOT\AIHOT\.data\nas-staging-prep-ac14beaf1b67ef709578624b388b14767998a80c\fiscalhot-staging-source.tar
bytes=17541120
tracked_files=976
sha256=12567959012a471d9d2bb69b057428bb64431403a69f4ea267c2aeb2ac9cc2e7
manifest=.data/nas-staging-prep-ac14beaf1b67ef709578624b388b14767998a80c/manifest.json
manifest_sha256=8631E510D05DFFA5508707491619975C7E2CDEB8F650D85D48E802E598C95676
review_only_commands=.data/nas-staging-prep-ac14beaf1b67ef709578624b388b14767998a80c/deployment-commands.md
review_only_commands_sha256=6CB4471B827ECA0A94E89E07901FDFE61119317DC5892C5117F1FCA588A26B01
```

归档由该精确commit的tracked文件生成，排除`.git`、所有`.env`和`.data`。C独立核得tar、manifest和ignored命令笔记SHA一致；command note含checkout或归档传输、hash校验、不可覆盖的`.env`生成、`docker compose config -q`及只输出脱敏结构摘要的命令，所有命令仅供审查且没有执行。尚未传送或解包到NAS。备选是NAS端克隆仓库后checkout这个固定SHA。NAS端`.env`尚未生成；预计由NAS生成唯一随机`POSTGRES_PASSWORD`、`ADMIN_PASSWORD`、`SESSION_SECRET`和`IMG_PROXY_SIGN_SECRET`，权限限于Staging用户；`DEPLOY_SHA`使用以上完整SHA。provider凭据留空，副作用flags均false。任何真实secret不得回传、写入仓库或完整输出compose配置。

compose配置静态QA结论沿用`APPROVED_FOR_PREPARATION`：项目`fiscalhot-staging`、数据库`fiscalhot_staging`、镜像`aihot-staging:<fixed SHA>`；仅Web映射3221，DB/API无host ports；Web没有backend env或`/data`挂载；worker只有显式profile启动；noindex开启。仓库48个来源配置中的`enabled`、`site_fulltext`、`syndicate_fulltext`均为false。首次`setup`会应用migration、写入topics、按seed只新增48个disabled来源，不会导入articles；但在daemon状态和旧volume归属确认之前不能应用任何migration或运行seed。上述静态边界不能证明NAS上的effective config或runtime状态。

## 未执行的动作

本轮没有在NAS创建目录、传输归档、创建`.env`、运行`docker compose config`或`up`、pull/build镜像、应用数据库migration、创建volume或启动服务。没有worker、采集、模型、OCR、Jina、Feishu、IndexNow或任何provider调用。没有做HTTP健康或页面验收，因为新Staging尚未启动。3221空闲是一次发现时的状态快照。

## 下一步与阻断

1. 先以不改变NAS权限/组的方式提供Docker daemon只读盘点能力，或由获授权管理员运行只读检查并交付脱敏输出。至少列明Docker root、Compose project标签为`fiscalhot-staging`的容器和卷、相关images/networks、port映射与daemon状态；未知不能按空资源处理。
2. C独立核对目标路径和volume归属、3221冲突、Compose有效配置及操作边界，然后提交Root最终S1。只有Root批准后才由指定执行者传包/准备`.env`/做首次Compose render或启动。
3. 若获准部署，实际runtime验收需核对端口映射、API/DB无host ports、Web无后端env/data卷、worker未运行、noindex头/meta、主页/`/all`/分类页/health；新Staging库内确认48 sources均disabled且fulltext flags false、0个消费job/`job_runs`、provider调用0。`/api/health`只通过容器内或Compose网络读取，不暴露API端口。
4. 发生任何资源冲突时停下；不复用、不删除既有volume，不执行`down -v`。Staging验收不自动满足Gate 3/4/5，也不授权Production。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：独立QA NAS现场只读发现与固定SHA部署准备；不做远端写入或启动。

**MODEL**：GPT-6 Luna / high。

**FILES_CHANGED**：本交接、`STATUS.md`和`PROJECT_PLAN.md`；本轮NAS准备代码SHA保持`ac14beaf1b67ef709578624b388b14767998a80c`。源归档及manifest位于忽略目录，不进入Git。

**TESTS_RUN**：复核固定commit存在、tar字节数和SHA、manifest SHA、Compose和source静态配置；无软件测试重跑、无远端Compose/Docker命令、无HTTP。

**RESULT**：strict SSH只读发现成功，但Docker daemon资源无法读取；候选目录和端口可用，仍不足以证明旧Docker project/volume不存在。部署前置QA阻塞，未执行远端mutation。

**RISKS**：Docker daemon/volume命名空间不可见；可能已有资源。初次部署会迁移空Staging DB并seed配置，必须先确认目标卷归属。

**BLOCKERS**：`codex`没有Docker socket权限，`sudo -n`要求密码；目前无法验证DockerRootDir和既有容器/卷。

**NEXT**：取得只读daemon审计结果，C核对后交Root最终S1；获准后才由指定执行者部署并补runtime验收。Production及Gate 3/4/5状态不变。
