# 验收清单

## Gate 1：静态行业改造

- [x] taxonomy、ITEM_TYPES、category fallback、topics 与提示词白名单一致。
- [x] 主题 slug 稳定；主题组显示为机构、重点领域、内容类型。
- [x] 关于页、首页及用户可见行业语义已改为财政金融。
- [x] 专属扩展功能关闭；机构发布域名映射限于已核验的官方域名，当前条目见 `industry/taxonomy.ts`，来源证据见 `SOURCE_MATRIX.md`。
- [x] 对站点品牌、开发日志、示例 Gold 数据和用户可见表单占位文案完成 AI 行业残留检查与处理；条款模板保留待负责人确认。
- [x] Gate 1 测试通过。最新回归：`npm run typecheck`、隔离测试数据库上的 `npm test` 132/132、`npm run build -w @aihot/web`、web tests 11/11。loopback smoke 30 项通过；P3 受控入库验证见 `P3_INGEST_VALIDATION.md`。
- [x] Sol 完成一次架构 Review；三项最小修复由 Lead 核销，`GATE_1_REVIEW.md` 记录 `FINAL_GATE_STATUS=PASSED`。Review 本身不替代上述测试 Gate。

## Gate 2—5

- [ ] Gate 2：首批官方信源逐个验证列表、详情、日期、分页、导航噪声和重复项，记录在 `SOURCE_MATRIX.md`。
- [ ] Gate 3：Gold Dataset 开发集与留出集完成，精选规则和门槛有评测依据。
- [ ] Gate 4：25—35 个高质量信源、本地完整页面与 smoke 验收通过。
- [ ] Gate 5：NAS Staging 连续运行、备份恢复、重启和故障恢复验证通过后，才允许 Production。

## 当前证据

Gate 1 的实现、自动检查、唯一一次 Sol Review 和 Lead 修复核销均已完成，`FINAL_GATE_STATUS=PASSED`。首批 10 个配置源保持 disabled；9 个 HTML 源完成一次 preview，厦门证监局 JSON 源完成一次 `fetchJsonList()` 验证。P3 已在隔离测试库对财政部综合政策、金融司、国库司统计各运行两轮真实 collector：每源首轮 10 篇、第二轮 10/10 判重，见 `P3_INGEST_VALIDATION.md`；30 篇受控正文调用最终为 28 篇 `ok`、2 篇 `unconfirmed`、0 篇 `pending`，30 个正文队列 job 均未消费。对其中一条未确认页的单次只读诊断显示当前 HTML 正文约 158 字并链接 PDF；首次 extraction 原因仍 unknown。详见 `P3_BODY_VALIDATION.md`。

AD-009 的共享正文 selector 已在 OMO 本地快照及 collector 详情预取/正文提取两条路径测试；默认 Readability 200 字行为保持。离线 `pdfjs-dist@6.3.289` PoC 在 Windows Node 24 对文本 PDF 的4行×4列坐标归属完成核验；福建厅扫描 PDF 与合成混合扫描/空页样本均拒绝为未确认。PDF 附件下载和 HTML/PDF 组合存储仍未接入；Linux/NAS 与部署硬 RSS 约束尚未验证。AD-009 代码后全套验证通过：fresh `fiscalhot_ad009b_test` 35 migrations，`npm run typecheck`、`npm test` 144/144、web build、web tests 11/11、loopback smoke 30/30。未启动应用 worker、真实模型、Jina 或通知。

Gate 2—5 尚未通过。首批重点仍有 3 个来源未配置，分页、freshness 和长期重复率仍需验证。PDF PoC 不代表来源正文覆盖验收。
