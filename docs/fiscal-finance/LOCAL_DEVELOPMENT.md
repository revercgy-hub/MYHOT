# 本地开发

使用 Node.js 24 和仓库现有 npm workspaces。在 `.env` 或命令环境中保持：

```env
COLLECT_ENABLED=false
MODEL_CALLS_ENABLED=false
INDEXNOW_SUBMIT_ENABLED=false
FEISHU_INTERNAL_ENABLED=false
FEISHU_CONTENT_PUSH_ENABLED=false
```

运行页面和 worker 之前先准备名称以 `_test` 或 `_ci` 结尾的隔离数据库，执行 `node scripts/migrate.ts`。全量测试写数据库，必须指向隔离测试库：

```powershell
$env:DATABASE_URL='postgres://postgres@127.0.0.1:5432/fiscalhot_test'
npm run typecheck
npm test
npm run build -w @aihot/web
node --test apps/web/tests/*.test.ts
```

本地预览用 PostgreSQL 实例的手动启动命令、隔离地址和 API/Web 顺序见[本地页面预览说明](P3_LOCAL_PREVIEW.md)。它使用已有 EDB PostgreSQL 17.11-3 binaries 解压到被 Git 忽略的 `.data/test-pg/`，只绑定 `127.0.0.1`，不是 Windows 服务；不要重建集群，也不要把便携数据库、数据库文件、密钥或 `.data/` 提交。

完整测试中的分析和翻译用例必须走 provider 接口，所以测试子进程可临时设置 `MODEL_CALLS_ENABLED=true`；这些用例将 provider URL 覆盖到 `127.0.0.1` 的本地 mock，使用假 key。`COLLECT_ENABLED`、`INDEXNOW_SUBMIT_ENABLED`、`FEISHU_CONTENT_PUSH_ENABLED` 和 `FEISHU_INTERNAL_ENABLED` 保持显式关闭。普通开发、build 与 smoke 测试继续保持 `MODEL_CALLS_ENABLED=false`，不配置真实付费模型凭据。

准备运行端到端页面验收时，启动 API、worker 和 web 后运行 `node scripts/smoke.ts --base http://localhost:3000`。当前安全开关保持关闭，不执行真实采集和模型调用。
