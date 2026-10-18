# NAS 部署路线

部署前先完成本地 Gate 1—4。NAS Production 当前禁止部署。按照仓库 [部署说明](../deploy.md) 和任务书流程先建独立 Staging，再在 Staging 验证通过后，将同一 Git SHA 部署至 Production。

Staging 与 Production 使用不同目录、`.env`、数据库和 volume。不得把两套环境接到同一数据库，也不得用手工复制代码代替 Git。第一次启动时保持采集、模型、飞书和 IndexNow 全部关闭，再验证容器、数据库迁移、API、Web、网络、持久卷、时区、重启和备份恢复。

只有 Gate 2 通过后才可在 Staging 分阶段启用小规模采集和模型调用；Gate 5 通过前不部署 Production。Production 应固定到已经在 Staging 验证的 commit SHA，并在升级前记录旧 SHA、目标 SHA 和 migration 状态。

## 用户提供的部分目标信息（2026-10-18）

| 项目 | 已提供信息 | 未知/未验证 |
|---|---|---|
| 设备型号 | 铭凡 N5 | 设备未连接或现场核验 |
| 内存 | 64 GB | 尚未现场核验 |
| NAS 系统 | 飞牛 NAS；用户称支持 Docker | 具体系统版本、Docker/Compose版本未知 |
| 网络地址 | `192.168.3.100` | 地址未探测，管理网络可达性未知 |
| Staging 目录与数据卷 | 未提供 | 真实部署目录、持久卷路径和权限待确认 |
| 管理访问 | 未提供 | SSH/控制台方式、端口、获准账号待确认；未尝试访问 |
| 备份/恢复 | 未提供 | 备份目标、恢复步骤和联系人待确认 |
| 运行配置 | 未提供 | 时区、网络限制、secret注入方式待确认 |

以上信息不足以进入 Staging。没有连接、扫描、SSH或部署NAS；不推测OS版本、真实Staging目录或volume路径。补齐这些信息后仍需先在本地完成Gate 1–4，再依本文件建立独立Staging。当前状态：尚未进入NAS Staging；没有真实部署配置或生产凭据记录在仓库。
