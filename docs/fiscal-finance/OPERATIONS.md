# 运行维护

生产站需监控 API、worker、web 和 PostgreSQL 日志，重点观察信源抓取失败、处理队列积压、日报任务失败、模型预算和数据库增长。任何付费服务必须使用既有 receipts 与预算上限；飞书通知只使用后台配置的群组。

按照 [部署说明](../deploy.md) 配置每日 PostgreSQL 备份，定期在隔离环境演练恢复。每次上线前记录 Git SHA 和 migration 版本，准备按上一已验证 SHA 回滚的步骤。Staging 与 Production 数据库、volume 和备份目录必须隔离。

当前 DEV 安全状态：采集、模型调用、飞书通知和 IndexNow 提交关闭。首批 source 配置均为 disabled；不得把“已配置”当成“稳定运行”。
