# NAS Staging 部署路线

## 最新检查点（2026-10-24 d45 app-only 部署及独立QA）

应用代码SHA `d45f0d93f5374b7c72cdf0efb64ada6a03b84404`于2026-10-24 02:15:43Z部署至原Staging project；仅更新api/web，二者实际镜像ID均为`sha256:54d1a34f104b665ccdecc60e82f4cb67acf114fb3171b742990464ee6d4c7bc6`。setup仍为原`21ca4d4`镜像且已退出，db未重启并保持healthy，worker为0；仅Web发布3221，API/DB没有宿主端口。运行时`.env`权限0600，当前采集、模型、OCR、Jina、Feishu、IndexNow与私网抓取开关为false。被批准的source archive实际大小18,135,040字节、SHA-256 `35be388c0163748f0ae449f3e022ea1f7c65570ec5de017e98a9b0d3f047aa5c`；archive manifest大小248,265字节、SHA-256 `762dca18b116dcb18a1f53c725cf0f7a4c230565fbd25cca1d20ec93924b576e`。实际运行镜像、容器、端口、卷和flag记录见本地ignored `.data/fiscal-qa/major-policy-category-staging-postqa-20261024/runtime-readonly.txt`；archive及Web公开面证据在同目录`independent-postqa.json`。

A的独立只读结论为`PASS_WITH_DOCUMENTED_LIMITATIONS`，结论sidecar SHA-256 `66be92b12b5e771ff22a88a38c7160f58e6b5121fbc25f3fbcbabcda604dfa4a`。LAN页面、新类别筛选、API与RSS均完成只读检查，页面和响应保留noindex；匿名`GET /api/admin/review-batches`返回401，后台审核页跳转302登录；`scripts/smoke.ts`只含GET业务检查及MCP initialize握手POST，没有业务mutation，30/30通过，证据sidecar SHA-256 `9b3a282d52179df572dbc346bf7020dd96f737c3d92d2e86a3389a72e609d79a`。只读DB检查为36 migrations、418 articles、509 revisions、418 discoveries、54 publications/overrides、48 sources、Gold200；body状态91 ok/321 pending/6 unconfirmed；Gold200 rowset hash `fbd469d962cbdf123953ec4236cdd1a53b8c6beeb62a7be24214e47bb7da4076`未变，source rowset hash `8d017180f9fdaa0aa101a9c1c3b24a0666ade2ba9adda3c64e905db7f1edcb98`与可得历史证据一致。

source/settings补证对照B4历史来源rowset、2026-10-23 post-summary restore快照及2026-10-24只读Staging/restore查询：48条sources行hash相同；settings两行中`selected_ledger_epoch`全行相同，heartbeat仅`value`、`updated_at`改变，`key`、`updated_by`未变。snapshot token `00000035-00000115-1`；其快照早于部署但不是部署前即时MVCC快照，因此不据此声称整个部署区间每个应用表均无变动。补证SHA-256 `00663d6f80b251fc1fe170ad6907405cf50fca455b7a93f8d0d3a5f397db7049`。Gate 5恢复演练已有独立restore子项：64/64表行哈希、64/64 inventory、16/16 sequence state匹配，目标目录权限0700/文件0600；没有完整schema DDL指纹，也没有长周期运行、重启或故障恢复验收。故本次QA只验收d45 Staging app-only rollout，不表示Gate 3/4/5通过或本地fresh-preview通过。

## 最新更新（2026-10-22 Gold私有人审队列）

既有隔离Staging已更新至固定代码SHA `21ca4d400bda9071f1e0b8761d404d1fc5b001e5`，0039迁移完成，总迁移36。批次`ef0a79d3cd791efad169ab4904e6666fb34cf1515fe3a6f0a3456a125042c889`导入150条私有候选，其中20条原确认保留、130条待审；seed15仍confirmed且非holdout。仅review表和导入审计有新增，业务文章/发布/分析/回执/worker任务表均为0。admin API鉴权、审核页和noindex已通过LAN只读验收，未提交新人工决定。详见[Gold私有人审队列Staging交接](HANDOFFS/GOLD_REVIEW_QUEUE_STAGING_2026-10-22.md)。本次功能审批仅为`APPROVED_FOR_PRIVATE_BATCH_REVIEW_ON_STAGING`，不代表任何Gate或Production通过。

## 首次Staging runtime验收（2026-10-22，review migration前检查点）

用户已明确要求NAS隔离Staging，现已按用户指定目录`/vol2/1000/docker/fiscalhot-staging`部署；旧`/home/codex/fiscalhot-staging`保留。初始镜像由固定tested code SHA `ac14beaf1b67ef709578624b388b14767998a80c`构建。第一次bridge build因容器不能连接官方Debian源超时；经Root批准，仅构建阶段使用Docker `--network=host`后成功。后续本项目实际runtime bridge上的有限只读探测显示官方Debian HTTP/HTTPS、MOF预算与PBOC公开市场指定请求可达；不外推到所有来源或覆盖。初始部署与首次验收见[NAS Staging部署交接](HANDOFFS/NAS_STAGING_BUILD_ATTEMPT_2026-10-22.md)，最新review-batch版本见[Gold私有人审交接](HANDOFFS/GOLD_REVIEW_QUEUE_STAGING_2026-10-22.md)。

当前db healthy、setup exit0、api/web运行，worker/caddy不运行；只Web发布3221:3221，DB/API没有宿主端口。35 migrations完成，48 sources disabled、fulltext/syndication均false；articles/revisions/publications/analyses/receipts/job_runs/fetch_runs为0。内部API health、容器内smoke 30/30、LAN首页/全部/分类/404/robots noindex通过。采集、模型和外部provider均关闭。此为`APPROVED_FOR_ISOLATED_STAGING_RUNTIME`，不是Gate 3/4/5通过或Production授权。

## 2026-10-21 初始本地准备状态（历史）

用户已明确请求先部署隔离的 NAS Staging，外部端口 `3221` 映射至 Web 容器 `3221`。Root 已批准本地 Staging 配置准备范围；这是部署顺序的明确变更，不代表 Gate 3、Gate 4 或 Gate 5 已通过，也不等于 NAS 实际部署通过或授权 Production。Staging 配置代码已在本地测试并提交，**尚未在 NAS 写入、构建或启动任何服务**。本地测试代码 SHA：`ac14beaf1b67ef709578624b388b14767998a80c`。

目标设备信息来自用户：铭凡 N5、64 GB、飞牛 NAS（用户称支持 Docker）、LAN 地址 `192.168.3.100`。当前本地 Compose 配置使用独立项目 `fiscalhot-staging`、独立数据库 `fiscalhot_staging`、`aihot-staging:<DEPLOY_SHA>` 镜像标签；仅 Web 映射 `3221:3221`。数据库和 API 不映射宿主端口，Web 不挂载后端 `/data` 卷或接收后端密钥，worker 默认不启动。初始 Staging 显式关闭采集、模型、OCR、Jina、Feishu、IndexNow、私网抓取和可信代理，Web 设置 noindex 响应头与页面 meta。

本地已验证 YAML/Compose模型关键边界、相关 Web noindex 测试和 Web 集成测试。Docker CLI 在本地不可用，尚未运行真正的 `docker compose config` 或容器验收。Dockerfile 没有 HEALTHCHECK；容器镜像的 `EXPOSE 3000` 是元数据，Web 实际监听 `WEB_PORT`，DB 健康检查留在容器内。Gate 3/4/5 仍按各自正式证据记录，不能以 Staging 配置或本地测试代替。

截至10月21日的SSH/只读状态是历史快照，已被上方10月22日成功SSH发现更新。辅助脚本`scripts/nas/authorize-key.ps1` SHA `da630e770f62c098bf21a052042bd80df76757826e02ad312fb3ba8ccb4c6176`当时只执行本机`-WhatIf`；本轮不需要修改NAS `authorized_keys`。Root已完成本地配置审查并批准`APPROVED_FOR_PREPARATION`，不代表实际NAS部署审查或部署通过。

## 已执行的隔离部署

代码位于`/vol2/1000/docker/fiscalhot-staging`，`.env`为NAS本机生成并限制为0600，provider keys为空，副作用flags关闭。构建之前先完成Docker project/volume/port/空间冲突核验与脱敏Compose配置检查。第一次默认bridge build因容器不能访问官方Debian源而失败；后续获批的`--network=host`仅限单次镜像构建，不会改变Compose runtime bridge。之后项目bridge对明确列出的官方Debian/MOF/PBOC请求已有有限200探测；其它来源、接口及历史覆盖仍需各自证据。

成功的固定SHA镜像构建范围和启动服务如下；不要对该host build参数作全局/运行时推断：

```powershell
docker --host unix:///var/run/docker.sock build --network=host --progress=plain -t aihot-staging:ac14beaf1b67ef709578624b388b14767998a80c .
docker compose --project-name fiscalhot-staging --env-file .env -f docker-compose.yml -f docker-compose.nas-staging.yml up -d --no-build db setup api web
```

这里保留命令用于重现已审查部署；不要向本机之外输出完整Compose渲染或实际`.env`。显式列出`db setup api web`避免启动worker；没有附加`--profile manual-worker`或`--profile https`。不得运行`docker compose down -v`，不得删除或覆盖volume。

## Staging 验收与回退

服务启动后，检查容器状态、DB readiness、API/Web 健康响应以及 Web SSR 页面、404 和 `/robots.txt` 的 `X-Robots-Tag: noindex, nofollow`；首页 HTML 还应包含 `<meta name="robots" content="noindex, nofollow">`。确认宿主仅开放预期 LAN Web 端口 `3221`，API/DB 不可从宿主端口直连；确认 worker 容器未运行、所有危险开关仍为 `false`、无 provider 请求，且没有尝试生产索引或推送。记录实际 Git SHA、迁移状态、容器/volume 名称、验收时间及脱敏日志。此运行验收仍不自动满足 Gate 3/4/5。

若 Staging 出现问题，先保留数据库和数据卷用于调查；不得使用带 `-v` 的清理命令。2026-10-23已将post-summary dump恢复至隔离测试库并完成行哈希核验，但该演练不代表对当前Staging主库的回滚、定期备份、自动恢复或故障恢复能力完成验收。任何恢复或丢弃卷前仍须核对备份和卷归属。

## 已知设备信息和未完成事项

| 项目 | 已知事实 | 未验证或阻塞 |
|---|---|---|
| 设备 | 铭凡 N5、64 GB（用户提供） | 尚未现场核验 |
| NAS系统/daemon | 飞牛NAS；Debian 12、Docker 28.5.2、Compose 2.40.3；DockerRootDir `/vol2/docker` | 初始默认bridge build的官方Debian连接曾超时；项目bridge后来对Debian HTTP/HTTPS、MOF预算、PBOC公开市场指定请求探测200。不得外推到其它源或完整采集能力 |
| 地址/端口 | `192.168.3.100`；LAN smoke通过 | 3221当前按本次检查有Web服务；需持续确认访问控制/稳定性 |
| Web端口 | `3221 → 3221`，Web为唯一host-published服务 | 未做长期监控/重启恢复测试 |
| SSH/Docker权限 | `codex`组包含`docker`；strict SSH可用 | 不在本轮修改daemon/组权限 |
| Staging路径和卷 | 活动路径`/vol2/1000/docker/fiscalhot-staging`，目录0700，`.env`0600；旧`/home/codex/fiscalhot-staging`保留。Docker project `fiscalhot-staging`；卷`fiscalhot-staging_db`和`fiscalhot-staging_data`，network `fiscalhot-staging_default` | 10/23 restore演练私有证据目录为0700、其文件为0600；不得复用或删除旧home准备目录 |
| 运行状态 | 10/24只读复核时db healthy，api/web运行d45镜像，setup仍为旧镜像且exit0，worker=0；Web仅发布3221，DB/API无宿主端口；模型/采集等运行开关关闭 | 尚未完成长周期稳定性、重启恢复和故障恢复验收 |
| 备份/恢复 | 10/23完成一次post-summary custom dump及隔离恢复演练；64/64应用表行hash、64/64 inventory和16/16 sequence状态一致；目标为`fiscalhot_staging_restore_20261023_postsummary_test` | 这是Gate 5恢复子项，不是完整Gate 5；无完整schema DDL指纹，也不代表定期备份/自动恢复能力已验收 |
| 凭据 | Staging `.env` mode 0600；QA仅保存安全flag、行哈希与状态，不记录secret值 | 不改NAS权限或凭据；生产仍未授权 |

本次d45 app-only rollout独立QA为`PASS_WITH_DOCUMENTED_LIMITATIONS`；当前数据库已有受控内容（418 articles、54 publications/overrides），不是空seed；analyses/receipts/job_runs/fetch_runs均为0，不能将受控摘要展示解释为线上模型运行或新一轮采集。后续仍需完成来源覆盖、Gate 3校准结论以及Staging长周期/重启/故障恢复的正式审查。所有采集/model/provider flags保持关闭。Gate 3/4/5仍未通过；Staging检查不授权Production。
