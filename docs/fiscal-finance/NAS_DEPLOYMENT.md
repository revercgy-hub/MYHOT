# NAS 部署路线

部署前先完成本地 Gate 1—4。NAS Production 当前禁止部署。按照仓库 [部署说明](../deploy.md) 和任务书流程先建独立 Staging，再在 Staging 验证通过后，将同一 Git SHA 部署至 Production。

Staging 与 Production 使用不同目录、`.env`、数据库和 volume。不得把两套环境接到同一数据库，也不得用手工复制代码代替 Git。第一次启动时保持采集、模型、飞书和 IndexNow 全部关闭，再验证容器、数据库迁移、API、Web、网络、持久卷、时区、重启和备份恢复。

只有 Gate 2 通过后才可在 Staging 分阶段启用小规模采集和模型调用；Gate 5 通过前不部署 Production。Production 应固定到已经在 Staging 验证的 commit SHA，并在升级前记录旧 SHA、目标 SHA 和 migration 状态。

当前状态：尚未进入 NAS Staging；没有真实部署配置或生产凭据记录在仓库。
