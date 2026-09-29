# 财政金融站架构说明

本项目沿用 AIHOT 上游的三进程结构：`apps/web` 提供页面，`apps/api` 提供接口，`apps/worker` 执行采集、精选和成刊。`packages/backend` 负责数据和业务流程，`packages/contracts` 共享 API 类型；财政金融行业配置集中放在 `industry/`。

数据按“信源 → 预筛 → 两次评分 → 标题摘要与结构化 → 事件归组 → 日报/主题页及公开出口”处理。模型任务只在 worker 中执行，网页通过 HTTP 读取 API，公开内容统一经过 `packages/backend/src/publication/`。

行业配置的类别 key、主题 slug 和 topic group 存入数据库并参与公开 API。类别 key 与 slug 应视为稳定标识。主题 group 继续使用上游存储/API 值 `company | field | genre`，机构主题的展示名为“机构”；该值受现有数据库 CHECK 约束，当前无需迁移。`ITEM_TYPES` 由行业词表动态校验，不需要数据库枚举迁移。

行业层提供分类、标签、机构实体、身份词典、主题、信源、提示词、选择门槛和功能开关。不得把 API key、模型调用、数据库读取或采集逻辑放进前端。条款及隐私页为模板，正式上线前需由站点负责人确认。

## 本轮兼容决定

- `industry/topics.json` 保留 `company` 内部组值，将其展示语义改为机构。
- Web 主题目录文案和分组从 `industry/site.ts` 读取，避免在页面代码中固定某一行业。
- 行业分类替换后，移除过期的 `tip`/`opinion` RSS 与 v1 特例；RSS 和 v1 API 按当前公开分类精确过滤。
- Windows 下 SSR 入口通过 `pathToFileURL` 导入构建产物，兼容盘符路径。

此文档记录实现契约，不表示 Gate 1 已通过。
