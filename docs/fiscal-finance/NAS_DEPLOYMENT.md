# NAS Staging 部署路线

## 当前状态更新（2026-10-22）

用户已明确要求NAS隔离Staging，现已按用户指定目录`/vol2/1000/docker/fiscalhot-staging`部署；旧`/home/codex/fiscalhot-staging`保留。目标由固定tested code SHA `ac14beaf1b67ef709578624b388b14767998a80c`构建。第一次bridge build因容器不能连接官方Debian源超时；经Root批准，仅构建阶段使用Docker `--network=host`后成功。运行网络仍为默认Compose bridge，bridge容器外网超时尚未修复。详情见[10/22 NAS Staging部署与验收交接](HANDOFFS/NAS_STAGING_BUILD_ATTEMPT_2026-10-22.md)。

当前db healthy、setup exit0、api/web运行，worker/caddy不运行；只Web发布3221:3221，DB/API没有宿主端口。35 migrations完成，48 sources disabled、fulltext/syndication均false；articles/revisions/publications/analyses/receipts/job_runs/fetch_runs为0。内部API health、容器内smoke 30/30、LAN首页/全部/分类/404/robots noindex通过。采集、模型和外部provider均关闭。此为`APPROVED_FOR_ISOLATED_STAGING_RUNTIME`，不是Gate 3/4/5通过或Production授权。

## 2026-10-21 初始本地准备状态（历史）

用户已明确请求先部署隔离的 NAS Staging，外部端口 `3221` 映射至 Web 容器 `3221`。Root 已批准本地 Staging 配置准备范围；这是部署顺序的明确变更，不代表 Gate 3、Gate 4 或 Gate 5 已通过，也不等于 NAS 实际部署通过或授权 Production。Staging 配置代码已在本地测试并提交，**尚未在 NAS 写入、构建或启动任何服务**。本地测试代码 SHA：`ac14beaf1b67ef709578624b388b14767998a80c`。

目标设备信息来自用户：铭凡 N5、64 GB、飞牛 NAS（用户称支持 Docker）、LAN 地址 `192.168.3.100`。当前本地 Compose 配置使用独立项目 `fiscalhot-staging`、独立数据库 `fiscalhot_staging`、`aihot-staging:<DEPLOY_SHA>` 镜像标签；仅 Web 映射 `3221:3221`。数据库和 API 不映射宿主端口，Web 不挂载后端 `/data` 卷或接收后端密钥，worker 默认不启动。初始 Staging 显式关闭采集、模型、OCR、Jina、Feishu、IndexNow、私网抓取和可信代理，Web 设置 noindex 响应头与页面 meta。

本地已验证 YAML/Compose模型关键边界、相关 Web noindex 测试和 Web 集成测试。Docker CLI 在本地不可用，尚未运行真正的 `docker compose config` 或容器验收。Dockerfile 没有 HEALTHCHECK；容器镜像的 `EXPOSE 3000` 是元数据，Web 实际监听 `WEB_PORT`，DB 健康检查留在容器内。Gate 3/4/5 仍按各自正式证据记录，不能以 Staging 配置或本地测试代替。

截至10月21日的SSH/只读状态是历史快照，已被上方10月22日成功SSH发现更新。辅助脚本`scripts/nas/authorize-key.ps1` SHA `da630e770f62c098bf21a052042bd80df76757826e02ad312fb3ba8ccb4c6176`当时只执行本机`-WhatIf`；本轮不需要修改NAS `authorized_keys`。Root已完成本地配置审查并批准`APPROVED_FOR_PREPARATION`，不代表实际NAS部署审查或部署通过。

## 已执行的隔离部署

代码位于`/vol2/1000/docker/fiscalhot-staging`，`.env`为NAS本机生成并限制为0600，provider keys为空，副作用flags关闭。构建之前先完成Docker project/volume/port/空间冲突核验与脱敏Compose配置检查。第一次默认bridge build因容器不能访问官方Debian源而失败；后续获批的`--network=host`仅限单次镜像构建，不会改变Compose runtime bridge。

成功的固定SHA镜像构建范围和启动服务如下；不要对该host build参数作全局/运行时推断：

```powershell
docker --host unix:///var/run/docker.sock build --network=host --progress=plain -t aihot-staging:ac14beaf1b67ef709578624b388b14767998a80c .
docker compose --project-name fiscalhot-staging --env-file .env -f docker-compose.yml -f docker-compose.nas-staging.yml up -d --no-build db setup api web
```

这里保留命令用于重现已审查部署；不要向本机之外输出完整Compose渲染或实际`.env`。显式列出`db setup api web`避免启动worker；没有附加`--profile manual-worker`或`--profile https`。不得运行`docker compose down -v`，不得删除或覆盖volume。

## Staging 验收与回退

服务启动后，检查容器状态、DB readiness、API/Web 健康响应以及 Web SSR 页面、404 和 `/robots.txt` 的 `X-Robots-Tag: noindex, nofollow`；首页 HTML 还应包含 `<meta name="robots" content="noindex, nofollow">`。确认宿主仅开放预期 LAN Web 端口 `3221`，API/DB 不可从宿主端口直连；确认 worker 容器未运行、所有危险开关仍为 `false`、无 provider 请求，且没有尝试生产索引或推送。记录实际 Git SHA、迁移状态、容器/volume 名称、验收时间及脱敏日志。此运行验收仍不自动满足 Gate 3/4/5。

若 Staging 出现问题，先停止 `web`、`api`，保留数据库和数据卷用于调查；不得使用带 `-v` 的清理命令。任何恢复或丢弃卷前均需核对备份和卷归属。当前 NAS 备份/恢复目标及恢复步骤尚未得到现场验证，因此不得宣称已有可用的 NAS 恢复能力。

## 已知设备信息和未完成事项

| 项目 | 已知事实 | 未验证或阻塞 |
|---|---|---|
| 设备 | 铭凡 N5、64 GB（用户提供） | 尚未现场核验 |
| NAS系统/daemon | 飞牛NAS；Debian 12、Docker 28.5.2、Compose 2.40.3；DockerRootDir `/vol2/docker` | bridge容器出网到官方Debian源超时，后续启用采集/provider前须解决 |
| 地址/端口 | `192.168.3.100`；LAN smoke通过 | 3221当前按本次检查有Web服务；需持续确认访问控制/稳定性 |
| Web端口 | `3221 → 3221`，Web为唯一host-published服务 | 未做长期监控/重启恢复测试 |
| SSH/Docker权限 | `codex`组包含`docker`；strict SSH可用 | 不在本轮修改daemon/组权限 |
| Staging路径和卷 | 活动路径`/vol2/1000/docker/fiscalhot-staging`，目录0700，`.env`0600；旧`/home/codex/fiscalhot-staging`保留。Docker project `fiscalhot-staging`；卷`fiscalhot-staging_db`和`fiscalhot-staging_data`，network `fiscalhot-staging_default` | 备份/恢复目标和恢复过程尚未验证；不得复用或删除旧home准备目录 |
| 运行状态 | db healthy、setup exit0、api/web running；worker/caddy不存在 | 稳定性/重启/备份尚未验证 |
| 备份/恢复 | 未提供或实测 | 需在声明恢复能力前定义并验证 |
| 凭据 | NAS Staging目录内已生成`.env`，mode 0600；真实值未输出/入Git | 需核确认owner和权限；provider key保持空 |

本次受限运行验收已通过，但数据库没有文章/分析/收据或运行记录，不能将空seed解释为内容站上线。后续需单独决定并审查内容迁入/展示方案、Docker bridge出网修复、备份/恢复与稳定性计划。所有采集/model/provider flags保持关闭。Gate 3/4/5仍需独立满足正式验收；Staging检查不授权Production。
