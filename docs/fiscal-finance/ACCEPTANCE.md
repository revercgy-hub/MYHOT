# 验收清单

## Gate 1：静态行业改造

- [x] taxonomy、ITEM_TYPES、category fallback、topics 与提示词白名单一致。
- [x] 主题 slug 稳定；主题组显示为机构、重点领域、内容类型。
- [x] 关于页、首页及用户可见行业语义已改为财政金融。
- [x] 专属扩展功能关闭；机构发布域名仅列入直连核验的四个来源域名。
- [x] 对站点品牌、开发日志、示例 Gold 数据和用户可见表单占位文案完成 AI 行业残留检查与处理；条款模板保留待负责人确认。
- [x] `npm run typecheck`、隔离测试数据库上的 `npm test`、`npm run build -w @aihot/web` 和 web tests 通过；完整测试 129/129，web tests 11/11。详情见 `STATUS.md`。
- [x] Sol 完成一次架构 Review；三项最小修复由 Lead 核销，`GATE_1_REVIEW.md` 记录 `FINAL_GATE_STATUS=PASSED`。Review 本身不替代上述测试 Gate。

## Gate 2—5

- [ ] Gate 2：首批官方信源逐个验证列表、详情、日期、分页、导航噪声和重复项，记录在 `SOURCE_MATRIX.md`。
- [ ] Gate 3：Gold Dataset 开发集与留出集完成，精选规则和门槛有评测依据。
- [ ] Gate 4：25—35 个高质量信源、本地完整页面与 smoke 验收通过。
- [ ] Gate 5：NAS Staging 连续运行、备份恢复、重启和故障恢复验证通过后，才允许 Production。

## 当前证据

Gate 1 的实现、自动检查、唯一一次 Sol Review 和 Lead 三项修复核销均已完成，`FINAL_GATE_STATUS=PASSED`。四个配置源已完成一次受限 live preview，并在 `SOURCE_MATRIX.md` 记录结果；这不等同 Gate 2 collector 稳定性验收。Gate 2—5 尚未通过，仍有 8 个首批来源未配置，以及分页、freshness、PDF 与详情正文等问题待解决。
