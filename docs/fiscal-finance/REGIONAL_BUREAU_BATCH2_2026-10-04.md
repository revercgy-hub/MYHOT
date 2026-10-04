# 财政部监管局区域来源批次二：天津、河北、山西、内蒙古（2026-10-04）

## TASK
按已确认的“全国逐局覆盖、中央选登补充”方向，对四个财政部监管局做有预算的只读页面结构观察。只以已保存的官方首页和首页内实际观察到的“工作动态”链接为证据；本批不验证文章正文，不宣告来源通过或完整覆盖。

## MODEL
静态审阅保存的 HTTP 结果、完整公开 HTML 与解析出的 DOM 锚点清单。首页请求预算 4 次，栏目页预算 4 次；没有访问详情。Undici 8.11.2 budget hook 记录每次请求的 create/sendHeaders/headers 事件。请求为官方 HTTPS 域名直连，20 秒超时、6 MiB 上限、redirect=0、retry=0；无数据库、collector、extractor、附件/OCR、worker 或模型调用。原始 HTML 和逐请求 manifest/hash 均在 ignored 目录：`.data/fiscal-qa/regional-batch2-20261004/`（`homes.json`、`columns.json`及对应 HTML）。

## FILES_CHANGED
新增本报告。调查原始证据保存在上述 ignored 目录，不改 source 配置、共享 coverage matrix、代码、数据库或 Git index。

## TESTS_RUN
未运行软件测试（只读来源调查）。已离线核对两份 manifest 的请求计数、HTTP 状态、目标 URL、正文大小/hash，以及首页与栏目页实际锚点；`git diff --check -- docs/fiscal-finance/REGIONAL_BUREAU_BATCH2_2026-10-04.md` 通过。

## RESULT

### 网络预算及响应证据

| 监管局 | 首页请求 → 结果 | 首页字节 / SHA-256 | 首页内实际观察的“工作动态”锚点 → 栏目请求结果 | 栏目字节 / SHA-256 |
|---|---|---|---|---|
| 天津 | `https://tj.mof.gov.cn/` → 200 | 15,396 / `9faf9af25c633f04afcbd2ac9a267fb059ebe709b6a8945e6f370ff6501bb149` | `./gzdt2/caizhengjiancha/`；DOM path `div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a` → `https://tj.mof.gov.cn/gzdt2/caizhengjiancha/` → 200 | 12,717 / `1e37233b421e8bb6ad86c6572232e392dcddd6ae9c5bb41459bb141a0bb981d0` |
| 河北 | `https://he.mof.gov.cn/` → 200 | 15,175 / `af3dae0020ddc4a35a81453237621f2756d66102710e41df7facbce0cc5198c4` | `./caizhengjiancha/`；同一实际 DOM path → `https://he.mof.gov.cn/caizhengjiancha/` → 200 | 12,681 / `94d0ed6512da8d364f9ef7cc2f665a97ae58d80b317a803b8e61e972a577e762` |
| 山西 | `https://sn.mof.gov.cn/` → 200 | 19,430 / `cfb107f8987bf0ba61c157a1b5a104ac1c848e0c3cacac0ed5d278196fe9c44b` | `./gzdt/caizhengjiancha/`；同一实际 DOM path → `https://sn.mof.gov.cn/gzdt/caizhengjiancha/` → 200 | 12,674 / `0a41801d73186b72117f1f3d20b52643e519bfb4be2fc0a1a837c02bacf0d6ec` |
| 内蒙古 | `https://nmg.mof.gov.cn/` → 200 | 28,245 / `1e6d48e8081acf44a4601ba2ed1a40270a761c1a3dad4a04aa0772d4f08e6a01` | `./caizhengjiancha/`；同一实际 DOM path → `https://nmg.mof.gov.cn/caizhengjiancha/` → 200 | 12,597 / `f49e0cee99be4431ec68c7a810224e05d8784d915ad27cfbf116a206d28dc621` |

首页共 4 次 dispatch，栏目页共 4 次，合计 `attempted=8, dispatched=8, rejected=0`；每请求皆观察到 HTTP 200、最终 URL 等于请求 URL。各预算 manifest 各有 12 个 undici 事件（每站 create/sendHeaders/headers 各一、request:error 为 0）。无重试或重定向。栏目 URL 仅由保存首页上文字为“工作动态”的同域 HTTPS 锚点解析；没有按猜测构造 URL 或 selector。栏目页标题均为“工作动态”。

### 栏目页实际列表观测

四页各观察到 10 个同域 `.htm` 列表候选，共 40 个候选链接。这只是当前一次列表页 DOM 的可见项，不代表分页、时间窗、该局全部发布量或正文可读性。候选锚点的实际 DOM path 为 `div.mainboxerji > div.zzright > div.listBox > ul.liBox > li > a`；此处仅记录观察到的结构，不主张它是已验证的稳定采集 selector。每条候选的实际 `href`、锚点文本、近邻列表日期和祖先位置已保存在 `columns.json`。所有这些候选锚点均不在解析器标记的 `nav`、`header`、`footer` 下。DOM 另有“首页”面包屑；本次未观察到数字页码或“下一页”标签，不能据此判断不存在后续列表页。

代表性候选（只列网页列表中所见标题/日期/URL；详情未请求）：

| 监管局 | 列表候选标题 | 列表日期 | URL |
|---|---|---|---|
| 天津 | 三维联动抓培训、多点发力促落实——以高质量培训推动过紧日子要求见行见效 | 2026-09-29 | [详情链接](https://tj.mof.gov.cn/gzdt2/caizhengjiancha/202609/t20260929_3998309.htm) |
| 天津 | 征收2026年8月彩票公益金等中央非税收入1.24亿元 | 2026-09-23 | [详情链接](https://tj.mof.gov.cn/gzdt2/caizhengjiancha/202609/t20260923_3997982.htm) |
| 天津 | 坚持四个聚焦，有序推进财会监督质效提升三年行动 | 2026-09-23 | [详情链接](https://tj.mof.gov.cn/gzdt2/caizhengjiancha/202609/t20260923_3997981.htm) |
| 河北 | 立足三个导向扎实开展中小企业发展专项资金重点绩效评价工作 | 2026-09-15 | [详情链接](https://he.mof.gov.cn/caizhengjiancha/202609/t20260915_3997463.htm) |
| 河北 | 强化财政资金监管，护航乡村全面振兴发展 | 2026-09-10 | [详情链接](https://he.mof.gov.cn/caizhengjiancha/202609/t20260901_3996418.htm) |
| 河北 | 抓实雄安新区国有资本收益审核收缴工作，助力雄安新区高质量建设发展 | 2026-09-09 | [详情链接](https://he.mof.gov.cn/caizhengjiancha/202609/t20260901_3996419.htm) |
| 山西 | 优化监督检查廉政防控体系，锻造责任担当财会监督铁军 | 2026-09-30 | [详情链接](https://sn.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260930_3998420.htm) |
| 山西 | 下好调研“三步棋”护航基层财政平稳运行 | 2026-09-20 | [详情链接](https://sn.mof.gov.cn/gzdt/caizhengjiancha/202608/t20260824_3995959.htm) |
| 山西 | 关于开展2027年驻晋中央预算单位“一上”预算审核工作的通知 | 2026-09-10 | [详情链接](https://sn.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260910_3997192.htm) |
| 内蒙古 | 坚持“四维发力”持续推动财政收入监管提质增效 | 2026-09-23 | [详情链接](https://nmg.mof.gov.cn/caizhengjiancha/202609/t20260923_3998041.htm) |
| 内蒙古 | 强化绩效导向，四向发力提升绩效自评复核工作质效 | 2026-09-24 | [详情链接](https://nmg.mof.gov.cn/caizhengjiancha/202609/t20260918_3997701.htm) |
| 内蒙古 | “四个聚焦”扎实做好国有金融资本产权登记监管工作 | 2026-08-31 | [详情链接](https://nmg.mof.gov.cn/caizhengjiancha/202608/t20260825_3996090.htm) |

列表时间标注范围：天津 2026-08-26 至 2026-09-29；河北 2026-09-08 至 2026-09-28；山西 2026-09-07 至 2026-09-30；内蒙古 2026-08-31 至 2026-09-30。页面列出培训、学习、党建/会议类活动，也列出财会监督、专项资金绩效、收入监管、预算审核等题材。依已确认的内容边界，不能仅因活动形式而从标题判定排除；也不能只凭标题判定含有实质业务事实或予以精选，必须读取正文并按规则复核。

已观察到列表路径中的日期与 URL 路径日期并非总相同：河北 9/10 条目路径含 `t20260901_3996418.htm`，9/9 条目路径含 `t20260901_3996419.htm`；山西 9/22 列表日期对应 `t20260803_3994738.htm`，9/20 对应 `t20260824_3995959.htm`；内蒙古 9/24 条目对应 `t20260918_3997701.htm`，9/17 对应 `t20260911_3997277.htm`，8/31 对应 `t20260825_3996090.htm`。以上是列表显示与 URL 文本的差异记录，不推断哪一个是页面正文的发布日期。后续若核验详情，应分别保留列表日期、URL 路径日期与正文日期证据，不能静默归一。

## RISKS
- 四个栏目各只观测一页和可见的十条 `.htm` 候选；翻页/滚动、时效、去重、源稳定性均未验证。
- 未请求详情，故正文可读性、题名与列表日期对应关系、业务事实、附件情况及是否满足选择条件皆为 UNKNOWN。标题仅能用于下一步核验候选排序，不能作为评估结果。
- 有日期路径不一致，正文日期需详情证据确认。中央选登样本不计为独立监管局覆盖；本批四局也不能外推全国 35 局 full coverage。
- 本批是静态只读页面观察，未验证生产抓取合同或运行稳定性，也未判断任何 source ready/pass。

## BLOCKERS
需要按后续单独核销的小批预算读取少量候选详情，才能核验正文、实际发布日期及内容边界；本批预算不包括详情请求。若准备配置来源，还需单独工程审查页面变化及分页/刷新/去重行为。

## NEXT
由 Root/QA 将已观察的精确栏目路径和证据纳入全国 coverage 工作项。后续按已核销的小批预算，优先选择列表正文可能含监管/财政业务事实的候选，逐页只读核验题名、日期与正文；日期不一致的条目应优先核对。任何新详情请求另行核销。本报告不修改 source 配置，也不将本批结果认作 Gate2 覆盖完成或 Gate2 通过。
