# 财政金融热点站本地页面预览

日期：2026-09-29。预览地址：<http://127.0.0.1:3000>。页面只绑定本机 loopback；API 为 `127.0.0.1:3001`，PostgreSQL 为共享的本地 `127.0.0.1:5432`。API、Web 与 PostgreSQL 在本轮验证后保持运行，供 Lead 在 Codex 中打开检查。

## 页面与数据范围

当前已有精选首页、全部动态、热点榜、日报/周报/月报、主题目录、文章与事件详情、关于、更新日志、反馈、Agent 接入、条款和隐私等页面路由。模型榜和 Codex 重置监控通过 `industry/features.ts` 关闭，导航与对应 API 不提供这些可选 AI 行业模块。

预览使用独立空库 `fiscalhot_preview_test`，完成仓库 35 项迁移后只运行 `node scripts/seed.ts --topics-only`，导入 34 个行业主题。数据库计数确认：topics=34、sources=0、articles=0、stories=0、reports=0。页面展示的是财政金融站点结构与真实空状态，不含伪造的精选条目、事件、日报或复制来的未发布正文。

## 安全与运行边界

API 和 Web 均绑定 `127.0.0.1`，没有启动 worker。`COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`JINA_BODY_FALLBACK`、`INDEXNOW_SUBMIT_ENABLED`、`FEISHU_CONTENT_PUSH_ENABLED`、`FEISHU_INTERNAL_ENABLED`、`ALLOW_PRIVATE_NETWORK_FETCH` 全为 false；`DEV_AUTH_ROLE` 未设置，进程未读取仓库 `.env` 或真实模型凭据。仅使用本地预览用 dummy secrets/password。API 启动时写入隔离库的 `heartbeat.api` 设置项；worker watchdog 未检测到 worker 心跳时不启动 worker。

## 验证

- `npm run typecheck` 通过。
- `npm run build -w @aihot/web` 通过；预览 Web 使用该生产构建启动。
- `node --test apps/web/tests/*.test.ts`：11/11 通过。
- `node scripts/smoke.ts --base http://127.0.0.1:3000`：30/30 通过。
- `/hot`、`/daily`、`/topics` 和 `/admin/login` 实际返回 HTTP 200；行业文案使用财政金融站点标题。

仅验证页面可访问性和空库状态，不表示 Gate 2、来源覆盖、精选质量或生产部署验收通过。预览保持隔离测试库，不执行真实采集、模型调用、推送或付费请求。
