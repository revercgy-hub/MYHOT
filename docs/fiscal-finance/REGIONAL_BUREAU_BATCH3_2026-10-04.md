# 财政部监管局区域来源批次三：辽宁、吉林、黑龙江、山东（2026-10-04）

## TASK
对 coverage matrix 中辽宁、吉林、黑龙江、山东四个财政部监管局进行有限只读观察：每局首页一次；只有首页 DOM 实际出现同域“工作动态”或“新闻动态”锚点时，才访问该锚点一次。本文记录静态页面证据，不表示来源配置完成、正文验证或 Gate 2 通过。

## MODEL
由 Luna High 基于现场保存的首页与栏目页 HTML、DOM 锚点清单和实际 HTTP budget manifest 离线整理；来源事实以保存证据为准。backend `guardedFetch` + `installP3HttpBudget`（Undici 8.11.2）；官方 HTTPS 域名直连，20 秒超时、6 MiB 上限、redirect=0、retry=0。首页4次；首页锚点确认后栏目页4次；总计不超过8次。原始HTML、两阶段 manifest/hash、请求预算和 one-shot markers 位于 ignored `.data/fiscal-qa/regional-batch3-20261004/`（`homes.json`、`columns.json`）。无详情页、collector、数据库、extractor、附件/OCR、worker、模型或 source-config 操作。

## FILES_CHANGED
新增本报告。请求与 HTML 证据仅写入 ignored 数据目录。未改代码、source config、共享 coverage matrix 或 Git index。

## TESTS_RUN
未运行软件测试（只读网站调查）。离线复核两份 manifest 的 host、状态、预算、hash、实际锚点和栏目列表；本报告尾随空白检查通过。

## RESULT

### 实际请求与首页锚点

首页每个 host 请求一次，四页均 HTTP 200，final URL 等于 request URL。四页均在主内容区实际观察到文字为“工作动态”的同域 HTTPS 标题锚点；仅用已观察 `href` 访问栏目页。其 path 是本次 DOM 观察记录，不作为已经验证稳定的 parser selector。

| 监管局 / host | 首页响应：字节 / SHA-256 | 实际首页标题锚点与栏目页 URL |
|---|---|---|
| 辽宁 `ln.mof.gov.cn` | 200；18,788 / `619c7f095de9f7d9ae7635997f6e50e6a2d47ecda948c6f1a6cc420bc3c22371` | “工作动态” `./gzdt2/caizhengjiancha/`；`div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a` → `https://ln.mof.gov.cn/gzdt2/caizhengjiancha/` |
| 吉林 `jl.mof.gov.cn` | 200；22,797 / `6dd00fd74ce197f6e89cfae25868865299da54bbc185afa0fcf1b99cc55843b6` | “工作动态” `./caizhengjiancha/`；同一主内容标题锚点 path → `https://jl.mof.gov.cn/caizhengjiancha/` |
| 黑龙江 `hlj.mof.gov.cn` | 200；21,216 / `8f907caeab8d9b36b14bdfc5068806f15bc0a06751cf311d18b21ed56dd2ba37` | “工作动态” `./caizhengjiancha/`；同一主内容标题锚点 path → `https://hlj.mof.gov.cn/caizhengjiancha/` |
| 山东 `sd.mof.gov.cn` | 200；13,016 / `77f26032880828ea38f7f901e2d4be575c1e37c93ce31c4a6eb3435225f5d3fd` | “工作动态” `./gzdt/caizhengjiancha/`；同一主内容标题锚点 path → `https://sd.mof.gov.cn/gzdt/caizhengjiancha/` |

首页 DOM 还显示侧栏中重复/较宽泛的“工作动态”入口；栏目请求使用实际主内容标题锚点，并在 hostname 与 HTTPS 校验后对重复 href 去重。

### 栏目页响应与列表

首页阶段 Undici budget 为 `attempted=4, dispatched=4, rejected=0`；栏目阶段也为 `4/4/0`，每阶段 12 个 Undici 事件（create、sendHeaders、headers 各四次，request:error 为0）。总计 `8/8/0`，8次响应均为 HTTP 200，最终 URL 与请求 URL 相同；未发生重定向或重试。四页标题均为“工作动态”。

| 监管局 | 栏目 URL | 字节 / SHA-256 | 锚点计数：总数 / 同域有文案 / 同域唯一 / 重复 / 同域 `.htm` | 列表日期范围 |
|---|---|---|---|---|
| 辽宁 | `https://ln.mof.gov.cn/gzdt2/caizhengjiancha/` | 12,844 / `3f16503418763fc29d3da22b57fc2fdd7d1f0d51df074986d933ded5b6f7e756` | 24 / 15 / 14 / 1 / 10 | 2026-07-23 至 2026-09-11 |
| 吉林 | `https://jl.mof.gov.cn/caizhengjiancha/` | 12,686 / `9928be3f24899b1fe14a0d76b0714299da5ae23cfaf9403880e1328c8d5e6636` | 27 / 18 / 17 / 1 / 10 | 2026-09-04 至 2026-09-30 |
| 黑龙江 | `https://hlj.mof.gov.cn/caizhengjiancha/` | 12,919 / `8a939feebc9e4dfc779dce0a80fe1b987905f5b938e5f84a508dcb0c96b1fd0b` | 27 / 18 / 17 / 1 / 10 | 2026-08-26 至 2026-09-30 |
| 山东 | `https://sd.mof.gov.cn/gzdt/caizhengjiancha/` | 12,453 / `fd427796103293036256ba72b1de6cbfea27e53a31b1b523bcd6de81169dd2a9` | 24 / 15 / 14 / 1 / 10 | 2026-08-27 至 2026-09-30 |

每页的十条同域 `.htm` 列表候选，锚点文本、近邻列表日期、URL、DOM path 与祖先位置均保存在 ignored `columns.json`。记录的实际列表项 path 为 `div.mainboxerji > div.zzright > div.listBox > ul.liBox > li > a`，仅是本次观察值，不是稳定 selector 结论。四页这些列表锚点均不在 DOM `nav`、`header` 或 `footer` 下；每页都出现“首页”面包屑，未观察到数字页码、“下一页”或“末页”标签。这不能证明没有后续页。

代表性列表候选（仅列表所显示的标题、日期、URL；均未请求详情）：

| 监管局 | 列表标题 | 列表日期 | URL |
|---|---|---|---|
| 辽宁 | 财政部辽宁监管局：建机制 强监管 优结构助力属地提升财政科学管理质效 | 2026-09-11 | [候选详情](https://ln.mof.gov.cn/gzdt2/caizhengjiancha/202609/t20260911_3997251.htm) |
| 辽宁 | 财政部辽宁监管局：“三个坚持”扎实推进农村环境整治资金重点绩效评价工作 | 2026-08-26 | [候选详情](https://ln.mof.gov.cn/gzdt2/caizhengjiancha/202608/t20260813_3995391.htm) |
| 辽宁 | 财政部辽宁监管局：监管五处专题学习 《企业会计准则解释第20号》 | 2026-07-30 | [候选详情](https://ln.mof.gov.cn/gzdt2/caizhengjiancha/202607/t20260730_3994567.htm) |
| 吉林 | 财政部吉林监管局：构建闭环管理机制 推动绩效管理提质增效 | 2026-09-30 | [候选详情](https://jl.mof.gov.cn/caizhengjiancha/202609/t20260930_3998472.htm) |
| 吉林 | 财政部吉林监管局：“四维发力”持续巩固属地中央预算单位过紧日子监管成效 | 2026-09-24 | [候选详情](https://jl.mof.gov.cn/caizhengjiancha/202609/t20260921_3997820.htm) |
| 吉林 | 吉林监管局：立足政策目标 发挥协同作用扎实做好普惠金融发展专项资金审核工作 | 2026-09-28 | [候选详情](https://jl.mof.gov.cn/caizhengjiancha/202609/t20260910_3997205.htm) |
| 黑龙江 | 黑龙江监管局：监管三处组织学习《改善普通高中学校办学条件补助资金管理办法》 | 2026-09-29 | [候选详情](https://hlj.mof.gov.cn/caizhengjiancha/202609/t20260929_3998307.htm) |
| 黑龙江 | 黑龙江监管局：以高质量调研赋能财政监管 服务东北振兴发展大局 | 2026-09-11 | [候选详情](https://hlj.mof.gov.cn/caizhengjiancha/202606/t20260630_3992531.htm) |
| 黑龙江 | 黑龙江监管局：坚持“三措并举”扎实提升中央转移支付资金绩效自评复核精准性和有效性 | 2026-08-26 | [候选详情](https://hlj.mof.gov.cn/caizhengjiancha/202607/t20260717_3993749.htm) |
| 山东 | 山东监管局：三维发力抓实中小企业专项资金重点绩效评价 推动惠企政策落地见效 | 2026-09-29 | [候选详情](https://sd.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260922_3997968.htm) |
| 山东 | 山东监管局：“四个坚持”提升“一上”部门预算编制审核成效 | 2026-09-23 | [候选详情](https://sd.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260918_3997710.htm) |
| 山东 | 山东监管局2026年7月份征收入库中央非税收入6.65亿元 | 2026-09-01 | [候选详情](https://sd.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260904_3996670.htm) |

已确认的内容边界要求按正文识别业务事实；培训、学习、会议等形式不能仅凭标题一律排除，题名也不足以证明实质信息或精选资格。本次没有正文证据，所有候选正文内容、业务意义、附件情况和选择资格均为 UNKNOWN。

列表日期与 URL 路径日期存在多处差异：辽宁列表 8/26 项 URL 路径为 `202608/t20260813_3995391.htm`；吉林列表 9/24 项 URL 路径为 `202609/t20260921_3997820.htm`，9/28 项路径为 `202609/t20260910_3997205.htm`，9/9 项路径为 `202608/t20260831_3996363.htm`；黑龙江列表 9/11、9/9、8/26 项路径日期分别为 6/30、7/07、7/17；山东列表 9/29、9/23、9/18、9/1 项路径日期分别为 9/22、9/18、9/15、9/4。这里只报告 HTML 列表近邻日期和 URL 字符串，不推断实际发布时间。若未来另行核验详情，应并列保存列表日期、URL 路径日期和正文发布日期。

## RISKS
- 每局只观察一次首页与栏目页、每页可见十条链接；分页、完整时窗、刷新/去重和跨周期稳定性未验证。
- 未请求详情；所有正文业务事实、真实发布日期、正文可读性和附件处理均为 UNKNOWN。日期差异显著，不能以URL路径日期替代发布日期。
- 页面标题和链接存在学习培训及党务活动，也有预算、专项资金绩效、财政收入和财会监督题材；仅凭标题不做选择判定。
- 这四局有限观察不代表全部35个监管局覆盖，不表示 parser 可直接配置、来源通过或 Gate 2 通过。

## BLOCKERS
若需要将候选纳入下一步验证，需对少量精确详情 URL 另行核销并检查正文标题/发布日期/业务事实；本批不含详情请求预算。分页、重复项及来源稳定性也需单独、有界验证。

## NEXT
由 Root/QA 离线复核预算、原始页与候选列表，更新共享 coverage matrix。后续可按已核销的小批预算优先详情中可能包含监管、预算、专项资金绩效或财政收入事实的候选，并把列表日期与正文日期分开记录。本轮网络观察到此停止；不改 source config，不把观察当作 Gate 2 覆盖完成。
