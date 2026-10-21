# NAS Staging 只读现场核验（2026-10-22）

STATUS=FILES_PREPARED_WAITING_DOCKER_READONLY（新目录文件准备与config检查已通过；build/up仍阻塞）
STAGE=P8 隔离NAS Staging部署准备
GATE=Gate 2 `PASSED_FOR_BOUNDED_P4_PILOT`；Gate 3/4/5未通过
BRANCH=feat/fiscal-finance-hot
DOCS_BASE_SHA=b855c20
DEPLOY_CODE_SHA=ac14beaf1b67ef709578624b388b14767998a80c
DEPLOY_ARCHIVE_SHA256=12567959012a471d9d2bb69b057428bb64431403a69f4ea267c2aeb2ac9cc2e7

## 用户指令与授权边界

用户于2026-10-22解锁了本机SSH identity，继续此前明确的NAS隔离Staging请求：LAN地址`192.168.3.100`，Web宿主/容器端口目标`3221:3221`。Root先授权只读发现；之后单独S1授权`NEW_DIRECTORY_PREPARATION_ONLY`，包括仅在经确认全新的目录原子创建文件、传输固定SHA包、生成不覆盖`.env`、运行Compose `config -q`和脱敏配置摘要。随后Root再次裁定条件S1：若用户Docker组授权生效、新SSH daemon只读inventory无冲突且C独立QA通过，B作为唯一远端执行owner执行固定`db setup api web`隔离启动；C只做独立QA、runtime验收、docs/Git。若前置条件不满足则停止并回Root。Gate 3/4/5仍按正式证据条件判定。

## 只读发现

经strict SSH只读会话确认：NAS报告Debian 12、kernel 6.18、Docker 28.5.2、Docker Compose 2.40.3。`/home/codex`所在文件系统约有35 GB可用；候选新目录`/home/codex/fiscalhot-staging`当前不存在且home可写。TCP 3221当时无listener。SSH认证已工作，远端账号为`codex`。

Docker daemon资源不能由该账号只读核验：直接Docker CLI访问`/var/run/docker.sock`报permission denied；具体`sudo -n /usr/bin/docker version`也失败并要求密码。新SSH会话的组为`Users`和`Administrators`，当时没有`docker`组。无法读取daemon info、现有containers、images、networks、volumes或DockerRootDir，也不能确认`fiscalhot-staging`命名空间无旧资源。候选目录原先不存在与端口空闲不等价于Docker daemon中没有既有项目/卷。没有改组/socket权限/sudoers；没有执行daemon级修改。

## 固定代码包、文件准备与配置检查

固定tested code SHA `ac14beaf1b67ef709578624b388b14767998a80c`在本地Git对象库存在。为没有Git客户端的NAS准备的本地归档为：

```text
D:\AI-work\MYHOT\AIHOT\.data\nas-staging-prep-ac14beaf1b67ef709578624b388b14767998a80c\fiscalhot-staging-source.tar
bytes=17541120
tracked_files=976
sha256=12567959012a471d9d2bb69b057428bb64431403a69f4ea267c2aeb2ac9cc2e7
manifest=.data/nas-staging-prep-ac14beaf1b67ef709578624b388b14767998a80c/manifest.json
manifest_sha256=8631E510D05DFFA5508707491619975C7E2CDEB8F650D85D48E802E598C95676
commands_note=.data/nas-staging-prep-ac14beaf1b67ef709578624b388b14767998a80c/deployment-commands.md
commands_note_sha256=6CB4471B827ECA0A94E89E07901FDFE61119317DC5892C5117F1FCA588A26B01
env_generator=.data/deploy/generate_staging_env.py
env_generator_sha256=21C313E03673E60F8EAF00F354852A353332E38BAB35DBA824139A6368112658
config_summary_helper=.data/deploy/render_staging_config_summary_v3.py
config_summary_helper_sha256=13B27DAB36AE88FA6F75D2EBED0C49A7BF05F06BB9D8F872C48EC6DF9F031B80
```

归档由该精确commit的tracked文件生成，排除`.git`、所有`.env`和`.data`。C独立核得tar、manifest和命令笔记SHA；同时独立审核了env生成器与脱敏配置helper，远端helper bytes与审核版SHA一致。B在Root授权的准确路径`/home/codex/fiscalhot-staging`原子创建新目录、mode 0700，SCP归档后对17,541,120 bytes的SHA校验通过，解包976成员。首次两次模板替换因CRLF校验失败而安全中止，未写入秘密；不含secret的尝试文件留在该Staging目录自己的`.data/deploy`。随后执行本地审核版生成器创建`.env`，mode 0600，四个64-hex随机secret、固定`DEPLOY_SHA`、安全flags false、provider keys empty；无secret值或secret hash被输出。备选的NAS Git clone流程未使用。

默认profile和`--profile '*'`可选profile的Compose `config -q`均通过，脱敏摘要检查均为true：default仅`db/setup/api/web`，default命名卷为项目隔离的`fiscalhot-staging_db`和`fiscalhot-staging_data`；可选render包括`worker/manual-worker`、`caddy/https`及项目隔离的caddy卷；只有Web发布`3221:3221`，DB/API无宿主端口，DB名正确，Web无backend env及`/data`挂载，flags全false且provider keys empty。helper版本SHA `13b27dab36ae88fa6f75d2ebed0c49a7bf05f06bb9d8f872c48ec6df9f031b80`；远端字节与审核版匹配。完整配置和secret从未输出。此CLI只解析配置，不连接或修改Docker daemon；不能证明NAS上不存在同名既有volume。

compose配置静态QA结论沿用`APPROVED_FOR_PREPARATION`：项目`fiscalhot-staging`、数据库`fiscalhot_staging`、镜像`aihot-staging:<fixed SHA>`；仅Web映射3221，DB/API无host ports；Web没有backend env或`/data`挂载；worker只有显式profile启动；noindex开启。仓库48个来源配置中的`enabled`、`site_fulltext`、`syndicate_fulltext`均为false。首次`setup`会应用migration、写入topics、按seed只新增48个disabled来源，不会导入articles；但在daemon状态和旧volume归属确认之前不能应用任何migration或运行seed。上述静态边界不能证明NAS上的effective config或runtime状态。

## 尚未执行的Docker动作

本轮没有运行Compose `up`、build/pull镜像、应用数据库migration、创建Docker volume或启动服务。没有worker、采集、模型、OCR、Jina、Feishu、IndexNow或任何provider调用。没有做HTTP健康或页面验收，因为新Staging尚未启动。3221空闲是一次发现时的状态快照。

## 下一步与阻断

1. 用户已选择Docker组权限变更；在用户确认其执行后，B用新的SSH会话核实际组和Docker socket访问。不得由agent改组或调socket权限。只读读取DockerRootDir、标为`fiscalhot-staging`的容器/卷/网络及3221绑定；已有或不明资源先停下，不复用、不删除。
2. C独立QA inventory：若确认目标路径/卷无旧资源冲突、3221空闲、固定包SHA/目录/.env/config仍精确，则由B这个唯一远端执行owner按Root条件S1执行固定SHA `db setup api web` build/up；C不执行远端启动命令。若旧或未知资源冲突，停止并回Root审。当前`config -q`通过仅证明Compose文件与env解析有效。
3. B启动后由C做runtime验收：核对端口映射、API/DB无host ports、Web无后端env/data卷、worker未运行、noindex头/meta、主页/`/all`/分类页/health；新Staging库内确认48 sources均disabled且fulltext flags false、0个消费job/`job_runs`、provider调用0。`/api/health`只通过容器内或Compose网络读取，不暴露API端口。
4. 发生任何资源冲突时停下；不复用、不删除既有volume，不执行`down -v`。Staging验收不自动满足Gate 3/4/5，也不授权Production。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：独立QA NAS现场只读发现与固定SHA部署准备；不做远端写入或启动。

**MODEL**：GPT-6 Luna / high。

**FILES_CHANGED**：本交接、`STATUS.md`和`PROJECT_PLAN.md`；本轮NAS准备代码SHA保持`ac14beaf1b67ef709578624b388b14767998a80c`。源归档及manifest位于忽略目录，不进入Git。

**TESTS_RUN**：复核固定commit存在、tar字节数和SHA、manifest/helper SHA；远端default及wildcard profile `config -q`通过且脱敏结构检查全true。无软件测试重跑，无Docker daemon/build/up或HTTP。

**RESULT**：strict SSH与Root限定的新目录文件准备成功；包hash、解包、0600 env和effective Compose静态配置均核对通过。Docker daemon资源仍无法读取，未证明旧project/volume不存在；未build/up或做runtime验收。

**RISKS**：Docker daemon/volume命名空间不可见；可能已有同名资源。首次启动会创建卷、应用migration并seed配置，必须先确认daemon状态及卷归属。

**BLOCKERS**：`codex`没有Docker socket权限，`sudo -n`要求密码；目前无法验证DockerRootDir和既有容器/卷。

**NEXT**：等待用户确认已执行其选择的Docker组授权命令；新SSH下由B只读核daemon资源。若无冲突且SHA/env/config一致，B按Root条件S1作为唯一远端执行owner启动，C独立验收和更新docs/Git。Production及Gate 3/4/5状态不变。
