# NAS Staging 部署路线

## 当前状态更新（2026-10-22）

用户解锁本地SSH identity后，strict SSH只读发现确认NAS为Debian 12、Docker 28.5.2、Compose 2.40.3；候选`/home/codex/fiscalhot-staging`为空、约35 GB可用、3221当时无listener。Root随后授权`NEW_DIRECTORY_PREPARATION_ONLY`：B已在该新目录以0700权限传入并解包固定SHA包，安全生成mode 0600 `.env`；secret值从未输出。Compose default/`--profile '*'`可选profile `config -q`与脱敏边界检查通过。详见[10/22现场与文件准备交接](HANDOFFS/NAS_STAGING_RUNTIME_DISCOVERY_2026-10-22.md)。

`codex`当前不能访问Docker socket，`sudo -n /usr/bin/docker version`也失败；fresh SSH的groups仍只有`Users`和`Administrators`。用户已选择Docker组授权，Root已发本机命令但尚未收到执行完成确认。因此containers/images/volumes/networks和DockerRootDir仍未知。B未执行`up`/build、未应用migration、未创建Docker volume、未启动任何服务；不把只读配置通过视为部署。Root的条件S1允许：新SSH确认Docker socket权限后，B只读核对现存project/volume/port/space；C独立QA若确认无资源冲突且3221空闲、fixed SHA与env/config仍匹配，可按Root授权执行隔离的`db setup api web`构建启动，不需重复确认。未知或冲突资源仍须回Root，不得覆盖或`down -v`。Gate 3/4/5仍未通过；Staging runtime健康/noindex验收尚未开始。

## 2026-10-21 初始本地准备状态（历史）

用户已明确请求先部署隔离的 NAS Staging，外部端口 `3221` 映射至 Web 容器 `3221`。Root 已批准本地 Staging 配置准备范围；这是部署顺序的明确变更，不代表 Gate 3、Gate 4 或 Gate 5 已通过，也不等于 NAS 实际部署通过或授权 Production。Staging 配置代码已在本地测试并提交，**尚未在 NAS 写入、构建或启动任何服务**。本地测试代码 SHA：`ac14beaf1b67ef709578624b388b14767998a80c`。

目标设备信息来自用户：铭凡 N5、64 GB、飞牛 NAS（用户称支持 Docker）、LAN 地址 `192.168.3.100`。当前本地 Compose 配置使用独立项目 `fiscalhot-staging`、独立数据库 `fiscalhot_staging`、`aihot-staging:<DEPLOY_SHA>` 镜像标签；仅 Web 映射 `3221:3221`。数据库和 API 不映射宿主端口，Web 不挂载后端 `/data` 卷或接收后端密钥，worker 默认不启动。初始 Staging 显式关闭采集、模型、OCR、Jina、Feishu、IndexNow、私网抓取和可信代理，Web 设置 noindex 响应头与页面 meta。

本地已验证 YAML/Compose模型关键边界、相关 Web noindex 测试和 Web 集成测试。Docker CLI 在本地不可用，尚未运行真正的 `docker compose config` 或容器验收。Dockerfile 没有 HEALTHCHECK；容器镜像的 `EXPOSE 3000` 是元数据，Web 实际监听 `WEB_PORT`，DB 健康检查留在容器内。Gate 3/4/5 仍按各自正式证据记录，不能以 Staging 配置或本地测试代替。

截至10月21日的SSH/只读状态是历史快照，已被上方10月22日成功SSH发现更新。辅助脚本`scripts/nas/authorize-key.ps1` SHA `da630e770f62c098bf21a052042bd80df76757826e02ad312fb3ba8ccb4c6176`当时只执行本机`-WhatIf`；本轮不需要修改NAS `authorized_keys`。Root已完成本地配置审查并批准`APPROVED_FOR_PREPARATION`，不代表实际NAS部署审查或部署通过。

## Staging 运行前准备

在 NAS 选择一个新的专用 Staging 目录，并从经审查的 Git SHA 检出代码。不要复用任何已有 Compose 项目目录或数据库卷。将 `.env.nas-staging.example` 复制为该目录下的 `.env`，生成只供 Staging 使用的凭据：`POSTGRES_PASSWORD` 使用字母数字（Compose 会把它直接放入数据库 URL），`ADMIN_PASSWORD` 至少 12 个字符，并为 `SESSION_SECRET`、`IMG_PROXY_SIGN_SECRET` 设置强随机值。填写本次已审查的完整 Git SHA 到 `DEPLOY_SHA`；将 provider key 保持空白，所有副作用开关保持 `false`。不要将实际 `.env`、密钥或未经脱敏的 Compose 配置输出提交到 Git 或发到聊天中。

部署前须只读确认该目录解析出的项目名确为 `fiscalhot-staging`，目标 image tag 为该检出 SHA，Web 仅监听/映射到预期的 `3221:3221`，DB/API 无宿主端口，worker 不在默认启动集合中。检查已有容器和卷的 Compose project 标签；如果 `fiscalhot-staging` 下已有任何容器或卷，先停下核实所有者和内容，不要复用。不得运行 `docker compose down -v`，不得删除或覆盖旧卷。

完成访问授权和最终配置审查后，预期部署命令（仅在专用 NAS Staging 目录内执行；尚未执行）：

```powershell
docker compose --project-name fiscalhot-staging --env-file .env -f docker-compose.yml -f docker-compose.nas-staging.yml config
docker compose --project-name fiscalhot-staging --env-file .env -f docker-compose.yml -f docker-compose.nas-staging.yml up -d --build db setup api web
```

`config` 结果可能包含 secret，只在 NAS 本机查看并遮蔽敏感值后再分享。显式列出 `db setup api web` 是为了避免启动 worker；不要附加 `--profile manual-worker` 或 `--profile https`。执行前必须先确认构建上下文 SHA 与 `DEPLOY_SHA` 一致，并检查命令将要使用的 Docker project 和卷名。

## Staging 验收与回退

服务启动后，检查容器状态、DB readiness、API/Web 健康响应以及 Web SSR 页面、404 和 `/robots.txt` 的 `X-Robots-Tag: noindex, nofollow`；首页 HTML 还应包含 `<meta name="robots" content="noindex, nofollow">`。确认宿主仅开放预期 LAN Web 端口 `3221`，API/DB 不可从宿主端口直连；确认 worker 容器未运行、所有危险开关仍为 `false`、无 provider 请求，且没有尝试生产索引或推送。记录实际 Git SHA、迁移状态、容器/volume 名称、验收时间及脱敏日志。此运行验收仍不自动满足 Gate 3/4/5。

若 Staging 出现问题，先停止 `web`、`api`，保留数据库和数据卷用于调查；不得使用带 `-v` 的清理命令。任何恢复或丢弃卷前均需核对备份和卷归属。当前 NAS 备份/恢复目标及恢复步骤尚未得到现场验证，因此不得宣称已有可用的 NAS 恢复能力。

## 已知设备信息和未完成事项

| 项目 | 已知事实 | 未验证或阻塞 |
|---|---|---|
| 设备 | 铭凡 N5、64 GB（用户提供） | 尚未现场核验 |
| NAS 系统 | 飞牛 NAS；只读发现报告 Debian 12、Docker 28.5.2、Compose 2.40.3 | daemon资源状态未读取，未做运行验证 |
| 地址 | `192.168.3.100`（用户提供）；SSH连接成功 | 3221空闲仅为发现时快照，部署后未监听 |
| Web 端口 | 目标 `3221 → 3221` | 未在 NAS 上监听或验收 |
| SSH | 本地 alias `fnnas` 指向`codex@192.168.3.100:22`；10/22 strict只读SSH成功 | SSH可用；Docker socket需要权限，`sudo -n`需密码 |
| Staging路径和卷 | `/home/codex/fiscalhot-staging`新建0700，固定SHA source已解包；`.env`存在且0600 | Docker daemon既有project/volume未能列举；资源状态未知，不能覆盖或复用 |
| 备份/恢复 | 未提供或实测 | 需在声明恢复能力前定义并验证 |
| 凭据 | NAS Staging目录内已生成`.env`，mode 0600；真实值未输出/入Git | 需核确认owner和权限；provider key保持空 |

下一步是用户执行其选择的Docker组授权命令并以新SSH session确认组/socket访问。B随后只读盘点DockerRootDir、`fiscalhot-staging`现存container/volume/image/network、3221绑定和空间；C独立核实。如确认无旧资源冲突且source SHA/env/config仍精确，Root条件S1已授权C执行隔离的`db setup api web`启动；若有旧或未知资源则回Root审，不覆盖、不删除卷。部署后再做上述runtime验收。Production仍禁止部署，直至所有正式Gate要求满足并另行授权。
