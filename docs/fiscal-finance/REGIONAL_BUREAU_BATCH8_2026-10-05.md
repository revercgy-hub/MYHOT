# Regional bureau batch 8: Guizhou, Yunnan, Shaanxi, Gansu (2026-10-05)

## TASK
From the current uncovered list, observe each bureau homepage and at most one same-host list selected from an actual main-content “工作动态”/“新闻动态” heading anchor. Hard cap 8, at most 2 per bureau; 20 seconds, 6 MiB, direct HTTPS, zero redirects/retries. No details, attachments, DB, collector, worker, or model calls. Stop on failed homepage without retry or budget transfer.

## MODEL
Luna High; model/worker calls: 0. Requests used P3 guarded fetch and Undici 8.11.2 budget hook.

## FILES_CHANGED
- Tracked: this report only.
- Ignored evidence: `.data/fiscal-qa/regional-batch8-20261005/` (one-shot runner/marker, manifest, and raw HTML responses). No source config, shared matrix, index, or DB edits.

## TESTS_RUN
- `node --check .data/fiscal-qa/regional-batch8-20261005/run.mjs` passed before the one-shot run.
- Offline checks: 6 successful raw responses saved and verified against manifest hashes; statuses and final URLs match their requests. One homepage timed out and has no raw response.
- Undici 8.11.2: attempted=7, dispatched=7, rejected=0; create=7, sendHeaders=7, headers=6, error=1. No retry, fallback, redirect, or subsequent request.

## RESULT
Pre-run coverage rows #29 Guizhou, #30 Yunnan, #31 Shaanxi, #32 Gansu were unknown and absent from Batches 1–7. Saved official directory page 2 confirms original HTTP hrefs `http://gz.mof.gov.cn`, `http://yn.mof.gov.cn`, `http://sx.mof.gov.cn`, and `http://gs.mof.gov.cn`; this batch used the separately authorized HTTPS roots on those exact hosts, an explicit transport upgrade. Both directory file paths and hashes are retained in the manifest.

Guizhou, Yunnan and Shaanxi homepage roots returned HTTP 200 with matching bureau titles and actual main-content “工作动态” heading anchors. Their observed relative hrefs were `./caizhengjiancha/`, `./caizhengjiancha/`, and `./gzdt/caizhengjiancha/`, respectively; all three resulting same-host list responses returned HTTP 200 and title “工作动态”. Gansu HTTPS root request timed out at 20 seconds; no list URL was requested for Gansu and no retry/fallback was made.

Each successful list response exposes the following unique same-host `.htm` article-link candidates (10 Guizhou, 9 Yunnan, 10 Shaanxi). Dates are the adjacent displayed list values, titles use the anchor title attribute where available, and URLs are resolved from observed hrefs.

### 贵州
| List date | Title | Observed article URL |
|---|---|---|
| 2026-09-23 | 财政部贵州监管局：打造“1+5”模式 推动机关文化建设提质增效 | https://gz.mof.gov.cn/caizhengjiancha/202609/t20260923_3998000.htm |
| 2026-09-23 | 财政部贵州监管局：坚持学用结合 提升档案工作规范化标准化水平 | https://gz.mof.gov.cn/caizhengjiancha/202609/t20260923_3997999.htm |
| 2026-09-23 | 贯彻落实财政科学管理试点座谈会精神 不折不扣抓好财政监管工作 | https://gz.mof.gov.cn/caizhengjiancha/202609/t20260923_3997997.htm |
| 2026-09-20 | 贵州监管局：多措并举创新方法 扎实开展属地中央单位内控核查分析 | https://gz.mof.gov.cn/caizhengjiancha/202607/t20260722_3993935.htm |
| 2026-09-03 | 贵州监管局：“四措并举”纵深推进全面从严治党和党风廉政建设工作 | https://gz.mof.gov.cn/caizhengjiancha/202607/t20260715_3993525.htm |
| 2026-09-01 | 财政部贵州监管局：“三个坚持”闭环监管 扎实开展属地中央企业国有资本收益审核征收工作 | https://gz.mof.gov.cn/caizhengjiancha/202608/t20260806_3995057.htm |
| 2026-08-24 | 贵州监管局：强化党建理论研究和实践探索 持续推动机关党的建设高质量发展 | https://gz.mof.gov.cn/caizhengjiancha/202607/t20260720_3993835.htm |
| 2026-08-20 | 财政部贵州监管局：党建引领聚合力 实干笃行启新程--赴中科院地化所开展支部联学联建活动 | https://gz.mof.gov.cn/caizhengjiancha/202608/t20260820_3995847.htm |
| 2026-08-20 | 贵州监管局：“四举措”确保树立和践行正确政绩观学习教育取得实效 | https://gz.mof.gov.cn/caizhengjiancha/202608/t20260820_3995846.htm |
| 2026-08-20 | 贵州监管局：奋力书写树立和践行正确政绩观学习教育“五新”答卷 | https://gz.mof.gov.cn/caizhengjiancha/202608/t20260820_3995844.htm |

- 贵州: homepage `https://gz.mof.gov.cn/` (HTTP 200); main-content heading href `./caizhengjiancha/` at `div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a`; list `https://gz.mof.gov.cn/caizhengjiancha/` (HTTP 200), SHA-256 `53d49f3fc8567d12989cf67b4ed95210d1f6c629a0b4cd1252ea9dbbad841f19`; JavaScript pager currentPage=0, countPage=50. No later page was fetched.

### 云南
| List date | Title | Observed article URL |
|---|---|---|
| 2026-09-18 | 财政部云南监管局：下好“三步棋” 织密财政收入监管“一张网” | https://yn.mof.gov.cn/caizhengjiancha/202609/t20260918_3997724.htm |
| 2026-08-27 | 财政部云南监管局：线上赋能 线下核查 多维统筹持续提升转移支付预算执行常态化监督质效 | https://yn.mof.gov.cn/caizhengjiancha/202608/t20260821_3995882.htm |
| 2026-08-07 | 财政部云南监管局：监管四处认真学习习近平总书记关于一体推进教育科技人才发展的重要论述 | https://yn.mof.gov.cn/caizhengjiancha/202608/t20260807_3995113.htm |
| 2026-08-07 | 财政部云南监管局：监管四处认真学习习近平总书记在庆祝中国共产党成立105周年大会上的重要讲话 | https://yn.mof.gov.cn/caizhengjiancha/202608/t20260807_3995112.htm |
| 2026-07-23 | 财政部云南监管局：监管四处党支部集中学习习近平总书记重要文章《做强做优做大实体经济》 | https://yn.mof.gov.cn/caizhengjiancha/202607/t20260723_3994119.htm |
| 2026-07-23 | 财政部云南监管局：监管二处党支部深入学习贯彻习近平总书记近期系列重要讲话精神 | https://yn.mof.gov.cn/caizhengjiancha/202607/t20260723_3994112.htm |
| 2026-07-23 | 财政部云南监管局：监管一处党支部开展支部学习暨主题党日活动 | https://yn.mof.gov.cn/caizhengjiancha/202607/t20260723_3994105.htm |
| 2026-07-14 | 财政部云南监管局：四聚发力强内控 助推财政监管工作提质增效 | https://yn.mof.gov.cn/caizhengjiancha/202607/t20260707_3993000.htm |
| 2026-07-09 | 财政部云南监管局：监管四处专题学习 《习近平关于树立和践行正确政绩观论述摘编》 | https://yn.mof.gov.cn/caizhengjiancha/202607/t20260709_3993255.htm |

- 云南: homepage `https://yn.mof.gov.cn/` (HTTP 200); main-content heading href `./caizhengjiancha/` at `div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a`; list `https://yn.mof.gov.cn/caizhengjiancha/` (HTTP 200), SHA-256 `17b14fe52ca3fe20bd14553a23cd979d84b1f4dabe8a282ede9ee72eb7b1b04d`; JavaScript pager currentPage=0, countPage=50. No later page was fetched.

### 陕西
| List date | Title | Observed article URL |
|---|---|---|
| 2026-09-30 | 财政部陕西监管局开展中秋、国庆 “双节”廉洁、安全提醒 | https://sx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260930_3998367.htm |
| 2026-09-28 | 铸魂固廉强根基 守正笃行促监管 ——财政部陕西监管局扎实推进三季度 廉洁文化建设工作 | https://sx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260928_3998176.htm |
| 2026-09-22 | 财政部陕西监管局四维发力做实国有金融资本产权登记监管 | https://sx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260922_3997950.htm |
| 2026-09-30 | 财政部陕西监管局：落实六字工作方针持续提升财政运行分析评估“三化”水平 | https://sx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260922_3997949.htm |
| 2026-09-17 | 财政部陕西监管局召开国有“三资”盘活情况专题座谈会 | https://sx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260917_3997635.htm |
| 2026-09-17 | 财政部陕西监管局召开会议对树立和践行正确政绩观学习教育进行总结 | https://sx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260917_3997634.htm |
| 2026-09-11 | 财政部陕西监管局办公室党支部开展“学思想明方向、强党建促发展”主题党日活动 | https://sx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260911_3997301.htm |
| 2026-09-09 | 财政部陕西监管局召开驻陕中央预算单位工作会议传达学习财政科学管理试点座谈会精神 | https://sx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260909_3997022.htm |
| 2026-09-03 | 陕西监管局持续擦亮“陕财监管大讲堂” 品牌纵横联动提升干部教育培训质效 | https://sx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260903_3996628.htm |
| 2026-09-01 | 财政部陕西监管局学习贯彻财政科学管理试点座谈会精神 | https://sx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260901_3996438.htm |

- 陕西: homepage `https://sx.mof.gov.cn/` (HTTP 200); main-content heading href `./gzdt/caizhengjiancha/` at `div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a`; list `https://sx.mof.gov.cn/gzdt/caizhengjiancha/` (HTTP 200), SHA-256 `673f9b0999a8db7198e760a522b2d6db48bcdb81ef9282289c85fc495d495761`; JavaScript pager currentPage=0, countPage=12. No later page was fetched.

### 甘肃
- Homepage request `https://gs.mof.gov.cn/`: `request_failed_no_retry`, The operation was aborted due to timeout; Undici event accounting records one request error. No homepage raw was saved, no heading/list request was attempted, and no retry/fallback was made.

### Category scope
The three returned headings are “工作动态”; they provide limited leads, not full category coverage or article validation. Titles include both fiscal oversight and routine organizational/training activity. The Gansu page remains unobserved because its authorized root request timed out. No article detail/body, metadata authority, time-window stability, or full-page continuation was checked. This batch does not indicate source acceptance or Gate 2 completion.

## RISKS
Displayed list dates are not verified publication dates. Visible date/URL-path differences include Guizhou 2026-09-20 vs URL `t20260722`, Yunnan 2026-08-24 vs `t20260813`, and Shaanxi 2026-09-30 vs `t20260922`. Gansu root timeout leaves both homepage and target column unknown.

## BLOCKERS
Gansu did not return within the single 20-second root request budget. There is no retry or remaining-budget substitution under this batch scope. Detail identity/body, date authority, and broader section coverage remain unknown for all four.

## NEXT
QA can verify the manifest, all successful raw hashes, both official directory source hashes, timeout event, and homepage-to-list anchor chain offline. Keep source/Gate 2 status open. Any further Gansu request or additional coverage requires its own authorized scope.

Evidence:
- Ignored raw responses, manifest, runner/marker: `D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\regional-batch8-20261005\`
- Manifest: `D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\regional-batch8-20261005\manifest.json`
