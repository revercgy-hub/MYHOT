# Regional bureau batch 7: Dalian, Ningbo, Qingdao, Shenzhen (2026-10-05)

## TASK
From the updated coverage matrix and prior completed batches, select four still-unobserved bureaus. Verify each host against the saved official directory, then request its HTTPS root and at most one same-host “工作动态”/“新闻动态” list URL found in an actual main-content heading anchor. Total cap 8 (2 per bureau); direct, 20 seconds, 6 MiB, zero redirects/retries. No details, attachments, databases, collectors, workers, or models.

## MODEL
Luna High; model/worker calls: 0. Network used P3 guarded fetch with Undici 8.11.2 budget hook.

## FILES_CHANGED
- Tracked: this report only.
- Ignored: `.data/fiscal-qa/regional-batch7-20261005/` (runner, one-shot marker, manifest, and eight HTML responses). No source configuration, shared matrix, index, or DB edits.

## TESTS_RUN
- `node --check .data/fiscal-qa/regional-batch7-20261005/run.mjs` passed before requests.
- Offline audit: all 8 raw response hashes match manifest; all responses are HTTP 200 and final URL equals requested URL.
- Undici 8.11.2: attempted/dispatched/rejected = 8/8/0; create/sendHeaders/headers/error = 8/8/8/0. No fallback, redirect, retry, or subsequent network activity.

## RESULT
Pre-run matrix rows #7 大连, #13 宁波, #19 青岛, and #24 深圳 were unknown and had no independent homepage/list observations in Batches 1–6. The saved official directory anchors verify mappings: `http://dl.mof.gov.cn`, `http://nb.mof.gov.cn` (directory page 1), and `http://qd.mof.gov.cn`, `http://sz.mof.gov.cn` (directory page 2). This batch used authorized HTTPS root requests for those same verified hosts; the directory links themselves are HTTP. Directory source file hashes are recorded in the manifest.

All four HTTPS homepage roots returned HTTP 200 with titles identifying their bureau. Each actual homepage main-content `h2` exposed “工作动态”; observed hrefs resolve as listed below. Each selected same-host list URL returned HTTP 200 and page title “工作动态”, with 10 unique same-host `.htm` article-link candidates. The tables give row-adjacent display dates and actual anchor titles/title attributes; they do not imply detail verification.

### 大连
- Homepage: `https://dl.mof.gov.cn/` (HTTP 200, title “大连监管局”). Main-content `工作动态` href `./caizhengjiancha/` at `div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a`; selected list: `https://dl.mof.gov.cn/caizhengjiancha/` (HTTP 200).
- List SHA-256: `009560520e6c579f3712f10065b845a07d66427e8b5b8537ff39eced4c6bd3a6`; candidate count: 10.

| List date | Title | Observed article URL |
|---|---|---|
| 2026-09-30 | 财政部大连监管局开展节前警示教育 筑牢廉洁过节防线 | https://dl.mof.gov.cn/caizhengjiancha/202609/t20260930_3998449.htm |
| 2026-09-30 | 财政部大连监管局：锚定主责主业 “四个着力”推动财政金融监管提质增效 | https://dl.mof.gov.cn/caizhengjiancha/202609/t20260930_3998448.htm |
| 2026-09-24 | 财政部大连监管局：监管二处开展预算编制审核政策专题学习 | https://dl.mof.gov.cn/caizhengjiancha/202609/t20260924_3998110.htm |
| 2026-09-21 | 财政部大连监管局：多维发力 纵深推进预算执行常态化监督走深走实 | https://dl.mof.gov.cn/caizhengjiancha/202609/t20260921_3997822.htm |
| 2026-09-18 | 财政部大连监管局健全内控机制 规范监督检查权力运行 | https://dl.mof.gov.cn/caizhengjiancha/202609/t20260918_3997715.htm |
| 2026-09-18 | 财政部大连监管局监管一处组织干部认真学习《2027年政府收支分类科目》 | https://dl.mof.gov.cn/caizhengjiancha/202609/t20260918_3997713.htm |
| 2026-09-22 | 大连监管局：扎实推进2027年部门预算编制审核工作 | https://dl.mof.gov.cn/caizhengjiancha/202609/t20260911_3997250.htm |
| 2026-09-04 | 财政部大连监管局监管一处认真学习财政科学管理试点座谈会会议精神 | https://dl.mof.gov.cn/caizhengjiancha/202609/t20260904_3996740.htm |
| 2026-08-27 | 财政部大连监管局：扎实推进国有资本收益审核工作 | https://dl.mof.gov.cn/caizhengjiancha/202608/t20260827_3996211.htm |
| 2026-08-21 | 财政部大连监管局：扎实做好部门决算公开工作 | https://dl.mof.gov.cn/caizhengjiancha/202608/t20260821_3995872.htm |

- Pagination/navigation in raw HTML: breadcrumb `首页`; inline JavaScript declares `currentPage=0` (zero-based) and `countPage=10`, generating controls for `index.htm` / `index_n.htm` and first/previous/next/last. No later page was fetched.


### 宁波
- Homepage: `https://nb.mof.gov.cn/` (HTTP 200, title “宁波监管局”). Main-content `工作动态` href `./caizhengjiancha/` at `div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a`; selected list: `https://nb.mof.gov.cn/caizhengjiancha/` (HTTP 200).
- List SHA-256: `76737e98d1915672999f13d019fd17640f2ac0f7d7a64d96913e3a3cb3d33db5`; candidate count: 10.

| List date | Title | Observed article URL |
|---|---|---|
| 2026-09-30 | 财政部宁波监管局：参加宁波市直机关工委理论宣讲活动 | https://nb.mof.gov.cn/caizhengjiancha/202609/t20260930_3998450.htm |
| 2026-09-22 | 财政部宁波监管局召开树立和践行正确政绩观学习教育总结大会 | https://nb.mof.gov.cn/caizhengjiancha/202609/t20260922_3997947.htm |
| 2026-09-22 | 财政部宁波监管局：多措并举筑牢节日廉洁防线 | https://nb.mof.gov.cn/caizhengjiancha/202609/t20260922_3997946.htm |
| 2026-09-16 | 财政部宁波监管局开展2026年度国家网络安全宣传周活动 | https://nb.mof.gov.cn/caizhengjiancha/202609/t20260916_3997531.htm |
| 2026-09-10 | 财政部宁波监管局：依托数字化手段推动固定资产管理提质增效 | https://nb.mof.gov.cn/caizhengjiancha/202609/t20260910_3997056.htm |
| 2026-09-03 | 财政部宁波监管局：统筹谋划 以“三个结合”推动新修改《注册会计师法》贯彻实施走深走实 | https://nb.mof.gov.cn/caizhengjiancha/202609/t20260903_3996616.htm |
| 2026-08-28 | 财政部宁波监管局：学习贯彻财政科学管理试点座谈会精神 | https://nb.mof.gov.cn/caizhengjiancha/202608/t20260828_3996307.htm |
| 2026-08-24 | 财政部宁波监管局：多措并举推动属地中央预算单位内控管理提质增效 | https://nb.mof.gov.cn/caizhengjiancha/202608/t20260813_3995373.htm |
| 2026-08-17 | 财政部宁波监管局2025年度单位决算 | https://nb.mof.gov.cn/caizhengjiancha/202608/t20260817_3995597.htm |
| 2026-08-07 | 闻风而动严防守 多措并举筑防线 —— 财政部宁波监管局全力做好抗台防汛工作 | https://nb.mof.gov.cn/caizhengjiancha/202608/t20260807_3995123.htm |

- Pagination/navigation in raw HTML: breadcrumb `首页`; inline JavaScript declares `currentPage=0` (zero-based) and `countPage=50`, generating controls for `index.htm` / `index_n.htm` and first/previous/next/last. No later page was fetched.


### 青岛
- Homepage: `https://qd.mof.gov.cn/` (HTTP 200, title “青岛监管局”). Main-content `工作动态` href `./gzdt/caizhengjiancha/` at `div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a`; selected list: `https://qd.mof.gov.cn/gzdt/caizhengjiancha/` (HTTP 200).
- List SHA-256: `68725e14feacee7c8db0e3ce55e50f95f7d1b28bcbb2c79c17adb73385f162dc`; candidate count: 10.

| List date | Title | Observed article URL |
|---|---|---|
| 2026-09-30 | 情暖中秋树新风 清风润家促文明 ——财政部青岛监管局开展“我们的节日·中秋”系列活动 | https://qd.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260930_3998487.htm |
| 2026-09-29 | 财政部青岛监管局：青岛市以财政科学管理综合试点为牵引 推动财政发展提质增效 | https://qd.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260929_3998276.htm |
| 2026-09-28 | 财政部青岛监管局：召开树立和践行正确政绩观学习教育总结会议 | https://qd.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260928_3998185.htm |
| 2026-09-24 | 警钟长鸣守底线 安全过节不松懈 ——财政部青岛监管局召开中秋、国庆节前警示教育会 | https://qd.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260924_3998136.htm |
| 2026-09-21 | 研学实践拓视野 分享交流促提升 ——财政部青岛监管局开展青年理论学习小组活动 | https://qd.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260921_3997816.htm |
| 2026-09-18 | 财政部青岛监管局：青岛市深化零基预算改革 探索完善预算管理新模式 | https://qd.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260918_3997691.htm |
| 2026-09-14 | 青岛监管局：紧扣“高细严实”做精中央企业国有资本收益审核工作 | https://qd.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260914_3997330.htm |
| 2026-09-08 | 青岛监管局：挖掘属地“节约策” 推广落实过紧日子实践经验 | https://qd.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260908_3996929.htm |
| 2026-09-07 | 财政部青岛监管局：强化财政监管赋能 构建促消费长效机制 | https://qd.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260907_3996857.htm |
| 2026-09-04 | 财政部青岛监管局：青岛市委市直机关工委来局调研党建工作 | https://qd.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260904_3996733.htm |

- Pagination/navigation in raw HTML: breadcrumb `首页`; inline JavaScript declares `currentPage=0` (zero-based) and `countPage=50`, generating controls for `index.htm` / `index_n.htm` and first/previous/next/last. No later page was fetched.


### 深圳
- Homepage: `https://sz.mof.gov.cn/` (HTTP 200, title “深圳监管局”). Main-content `工作动态` href `./caizhengjiancha/` at `div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a`; selected list: `https://sz.mof.gov.cn/caizhengjiancha/` (HTTP 200).
- List SHA-256: `cbaf185bd44f43cf6a906cd7cc4a6467bdf2e251598083be65005c3abba85948`; candidate count: 10.

| List date | Title | Observed article URL |
|---|---|---|
| 2026-09-29 | 深圳监管局：监管三处专题学习《中华人民共和国注册会计师法》 | https://sz.mof.gov.cn/caizhengjiancha/202609/t20260929_3998295.htm |
| 2026-09-29 | 深圳监管局：深化转移支付业务学习 夯实预算执行监控工作基础 | https://sz.mof.gov.cn/caizhengjiancha/202609/t20260929_3998294.htm |
| 2026-09-23 | 深圳监管局：多措并举推动廉洁文化融入财政监管全过程 | https://sz.mof.gov.cn/caizhengjiancha/202609/t20260923_3997993.htm |
| 2026-09-23 | 深圳监管局：扎实做好2027年度驻深中央单位预算编制审核工作 | https://sz.mof.gov.cn/caizhengjiancha/202609/t20260923_3997992.htm |
| 2026-09-20 | 深圳监管局：监管三处专题学习贯彻财政科学管理试点座谈会精神 推动部署要求 落地见效 | https://sz.mof.gov.cn/caizhengjiancha/202609/t20260920_3997809.htm |
| 2026-09-20 | 深圳监管局：凝聚共识真抓实干 深入贯彻落实财政科学管理试点座谈会精神 | https://sz.mof.gov.cn/caizhengjiancha/202609/t20260920_3997808.htm |
| 2026-09-10 | 深圳监管局：多维聚力抓实全链条监管 精准护航超长期特别国债落地见效 | https://sz.mof.gov.cn/caizhengjiancha/202609/t20260910_3997206.htm |
| 2026-09-10 | 深圳监管局：锚定监管职责 精准施策发力 推动收入退付审核工作落地见效 | https://sz.mof.gov.cn/caizhengjiancha/202608/t20260827_3996174.htm |
| 2026-09-08 | 深圳监管局：攥指成拳凝聚合力 以“一二三”工作体系推动财政监管提质增效 | https://sz.mof.gov.cn/caizhengjiancha/202609/t20260908_3996939.htm |
| 2026-09-04 | 深圳监管局：创新探索“四个一”工作机制督促党政机关过紧日子落地见效 | https://sz.mof.gov.cn/caizhengjiancha/202609/t20260904_3996719.htm |

- Pagination/navigation in raw HTML: breadcrumb `首页`; inline JavaScript declares `currentPage=0` (zero-based) and `countPage=15`, generating controls for `index.htm` / `index_n.htm` and first/previous/next/last. No later page was fetched.


### Category scope
The observed heading is “工作动态” for all four bureaus. Captured first pages contain fiscal oversight/reporting along with routine organizational, training, and holiday activities. These are limited category leads; neither the full section scope, coverage across pages/time nor detail/body behavior is established. No article details were fetched; this is not source acceptance or Gate 2 completion.

## RISKS
List dates are row display values only and are not confirmed publication dates. Visible date/URL-path discrepancies occur in one Dalian row (display 2026-09-22, URL `t20260911`), one Ningbo row (display 2026-08-24, URL `t20260813`), and one Shenzhen row (display 2026-09-10, URL `t20260827`). Detail metadata was not requested, so these differences remain unresolved.

## BLOCKERS
No blocker to offline QA. Detail identity/body behavior, date authority, section remainder, and time-window stability remain unverified.

## NEXT
QA can validate both saved directory files and hashes, all eight raw responses, the dispatcher event cap, and the homepage-to-list anchor chain offline. Keep source pass/Gate 2 open pending separately authorized validation.

Evidence:
- Raw responses, one-shot marker and manifest: `D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\regional-batch7-20261005\`
- Manifest: `D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\regional-batch7-20261005\manifest.json`
