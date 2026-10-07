# P3 下一历史页核验（2026-10-07）

## 结果

Root 核准后，按宁夏、青海顺序各发起一次 direct HTTPS GET。共享 Undici 8.11.2 budget 为 `2/2/0` attempted/dispatched/rejected；共 6 个 create/sendHeaders/headers 事件，0 error、0 redirect、0 retry。两页均 HTTP 200、`text/html`、exact final URL 并读至 EOF。总耗时 583ms。独立离线 QA 重算两份 raw 的长度/SHA，并用当时 `industry/sources.json` 中对应来源 selector 重解析标题、日期、URL，候选逐项与 manifest 相符。

| 来源/精确 URL | 响应 raw | 解析、日期与跨页核验 |
|---|---|---|
| 宁夏 `https://nx.mof.gov.cn/caizhengjiancha/index_1.htm` | 12,844 bytes；SHA-256 `680fb95d23712bea8967d7f873e6f146cb5ba541d78b7cd21567750c900a30ed` | 10/10 合法唯一 HTML 候选；与保存首页 0 URL 重叠；可见日范围 2026-06-23–2026-08-14，行序非增（本页按日期递减）；按本次 +08 锚点 2026-10-07、含 2026-07-09 起算，9 条在窗、1 条在窗外。4 条可见日期与 URL 日期 token 不同；旧日期行出现在末尾，不能由其推断已覆盖。脚本显示 `currentPage=1`、`countPage=11`。 |
| 青海 `https://qh.mof.gov.cn/gzdt/caizhengjiancha/index_1.htm` | 12,541 bytes；SHA-256 `9a81600765deb19bddb98476274d4745de8d0e24022609c0181e8eb1cdbd1b26` | 10/10 合法唯一 HTML 候选；与保存首页 0 URL 重叠；可见日范围 2026-08-10–2026-09-11，行序非单调（09-11 排在 09-07 之后）；10 条均在 90 日窗，尚未到边界。2 条可见日期与 URL 日期 token 不同。脚本显示 `currentPage=1`、`countPage=15`。 |

原始首页脚本已预先验证会生成 `index_n.htm`；新页内脚本继续显示该分页模式。标题词提示只作人工审阅线索，不能作为全栏噪声判断。以上结果增加两个来源各一页的历史观察；未请求详情、附件、API/XHR，未运行 collector、DB、worker、模型或 OCR。两个来源在请求时均 `enabled=false` 且站内/RSS 全文关闭。

## Gate 2 边界与下一步

这批结果**不证明**任何来源覆盖完整 90 日、栏目完整、日期来源权威、采集器能遍历历史页或每日调度/失败恢复可靠。宁夏虽有一条显示日在窗外，仍有可见日期/路径冲突；青海页面行序非单调且旧页样本没有到窗边界。不要据 `countPage` 或出现一条旧日期停止并声明完整，也不要将手动分页读取当作 collector opt-in。Gate 2 仍 `NOT_PASSED`、来源仍 `NOT_ADMITTED`。production collector 的 web-list 仍是单页行为；分页 Phase A 仅获准离线/loopback，Stage B 完成语义仍未批准，见[分页缺口审计](WEB_LIST_BACKFILL_GAP_AUDIT_2026-10-06.md)与[Phase A 裁定](S1_WEB_LIST_PAGINATION_SCOPE_REVIEW_2026-10-06.md)。

## 证据与账目

完整请求事件、实际 anchor/cutoff、逐行日期/标题/URL、raw hash、parser 摘要、运行安全开关和来源状态见 ignored `.data/fiscal-qa/oct07-next-history/manifest.json`；raw 为 `宁夏-index_1.html`、`青海-index_1.html`，`run.native-exit.txt=0`。报告只更新本文件；采集请求 2，数据库/collector/worker/model/OCR 请求 0。未新增配置或实现。

### 宁夏 bounded page 0–10 跟进尝试

Root 另核准宁夏一组最多 11 次顺序 GET：现读首页、`index_2.htm`–`index_10.htm`、再读首页；开始前要求首页仍为同一来源且 `currentPage=0`、`countPage=11`。**实际在首页前读第一步超时后立即停止**：`https://nx.mof.gov.cn/caizhengjiancha/` 已 dispatch 1 次，20 秒后 `TimeoutError`；实际 budget `1/1/0`，Undici create/sendHeaders/error 各 1、response headers 0，无响应 body/raw，未重试。`index_2.htm`–`index_10.htm` 与首页后读均未发出。该失败不追认历史覆盖或变更先前保存响应。部分 manifest、完整目标清单、错误事件和运行日志见 ignored `.data/fiscal-qa/oct07-next-history/ningxia-snapshot-manifest.json`、`ningxia-snapshot.native-exit.txt`、`ningxia-snapshot.stdout.log`、`ningxia-snapshot.stderr.log`；native exit 为 0（runner 按设计捕获并记录请求错误）。来源仍 disabled、全文关闭；此轮 follow-up 没有 raw response。后续若要重试首页或继续分页，需另行核准新的 exact URL/budget。Gate 2 与 90 日完整性仍未通过。
