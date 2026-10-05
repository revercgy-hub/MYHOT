# Regional bureau batch 9: Qinghai, Ningxia, Xinjiang (2026-10-05)

## TASK
Finish the remaining uncovered-bureau homepage/list observations. For each listed bureau, request one HTTPS root page and at most one same-host work/news dynamics URL selected only from an actual main-content heading anchor. Hard dispatcher cap 6 (2 per bureau); 20 seconds, 6 MiB, direct, zero redirects/retries. No details, attachments, database, collector, worker, or model work.

## MODEL
Luna High; model/worker calls: 0. Requests used the P3 guarded fetch and Undici 8.11.2 budget hook.

## FILES_CHANGED
- Tracked: this report only.
- Ignored evidence: `.data/fiscal-qa/regional-batch9-20261005/` (one-shot runner/marker, manifest, six raw responses). No source config, shared matrix, index, or DB change.

## TESTS_RUN
- `node --check .data/fiscal-qa/regional-batch9-20261005/run.mjs` passed before dispatch.
- Offline audit: all 6 raw hashes matched manifest; all responses HTTP 200 and final URLs matched requests.
- Undici 8.11.2 snapshot: attempted/dispatched/rejected=6/6/0; create/sendHeaders/headers/error=6/6/6/0.

## RESULT
Pre-run matrix rows #33 青海, #34 宁夏, #35 新疆 were the last unobserved bureaus; no independent homepage/list evidence was found in Batches 1–8. Saved official directory page 2 provides the original HTTP mappings `http://qh.mof.gov.cn`, `http://nx.mof.gov.cn`, and `http://xj.mof.gov.cn`. This batch used the separately authorized HTTPS root transport upgrade for those verified hosts. Official directory file hashes and mapping anchors are in the manifest.

All three homepages returned HTTP 200 with titles “青海监管局”, “宁夏监管局”, and “新疆监管局”. Each actual main-content `h2` exposed “工作动态”, which yielded these observed relative anchors: 青海 `./gzdt/caizhengjiancha/`, 宁夏 `./caizhengjiancha/`, 新疆 `./caizhengjiancha/`. Each selected same-host list returned HTTP 200, title “工作动态”, and 10 unique same-host `.htm` candidate URLs. Dates below are adjacent row display values; titles come from anchor title attributes where present.

### 青海
- Homepage `https://qh.mof.gov.cn/`; list `https://qh.mof.gov.cn/gzdt/caizhengjiancha/` (HTTP 200). List SHA-256 `90b0ae93c5abe331c75e45b708662486c8e8e64ec3fa2787277e34b347e6b4dc`.

| List date | Title | Observed article URL |
|---|---|---|
| 2026-09-30 | 财政部青海监管局：深学细悟民族法规 筑牢高原民族团结法治根基 | https://qh.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260930_3998464.htm |
| 2026-09-30 | 财政部青海监管局：召开树立和践行正确 政绩观学习教育总结大会 | https://qh.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260930_3998366.htm |
| 2026-09-30 | 财政部青海监管局：三维发力做实“立体画像”式分析评估 推动地方财政运行监管提质增效 | https://qh.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260930_3998363.htm |
| 2026-09-30 | 财政部青海监管局：党组搭台青年唱 高原监管练担当 | https://qh.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260930_3998361.htm |
| 2026-09-24 | 财政部青海监管局： 赴联点帮扶村调研指导工作 | https://qh.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260924_3998129.htm |
| 2026-09-22 | 青海监管局：深入高原一线 扎实开展高海拔地区 医疗服务能力提升项目重点绩效评价 | https://qh.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260922_3997906.htm |
| 2026-09-22 | 财政部青海监管局：跨域调剂破壁垒，公车共享促节约 | https://qh.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260922_3997902.htm |
| 2026-09-18 | 青海监管局：党建引领聚合力 思想赋能强监管 ——全面提升资产评估执业质量检查工作质效 | https://qh.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260914_3997399.htm |
| 2026-09-14 | 财政部青海监管局：退休党支部开展主题党日活动 | https://qh.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260914_3997394.htm |
| 2026-09-15 | 青海监管局：常态化深化民族团结进步创建 持续铸牢中华民族共同体意识 | https://qh.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260910_3997078.htm |

- 青海 pagination/navigation: `首页` breadcrumb; inline JS declares `currentPage=0` (zero-based), `countPage=15`, and generates first/previous/numbered/next/last links (`index.htm`/`index_n.htm`). No further page was requested.

### 宁夏
- Homepage `https://nx.mof.gov.cn/`; observed heading href `./caizhengjiancha/` at `div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a`; list `https://nx.mof.gov.cn/caizhengjiancha/` (HTTP 200), SHA-256 `6e3d7fbc153635f78a79cd22fbdb35c0e528415dc9f8499b603b9aac589ca1c2`.

| List date | Title | Observed article URL |
|---|---|---|
| 2026-09-30 | 财政部宁夏监管局召开2026年中央转移支付监管工作座谈会 | https://nx.mof.gov.cn/caizhengjiancha/202609/t20260930_3998460.htm |
| 2026-09-24 | 财政部宁夏监管局以财政科学管理为统领推动过紧日子要求见行见效 | https://nx.mof.gov.cn/caizhengjiancha/202609/t20260924_3998133.htm |
| 2026-09-24 | 财政部宁夏监管局召开树立和践行正确政绩观学习教育总结会议 | https://nx.mof.gov.cn/caizhengjiancha/202609/t20260924_3998065.htm |
| 2026-09-11 | 宁夏监管局：迅速向中央驻宁预算单位传达财政科学管理试点座谈会精神 | https://nx.mof.gov.cn/caizhengjiancha/202609/t20260911_3997270.htm |
| 2026-09-11 | 以案为鉴筑防线 廉洁履职勇担当财政部宁夏监管局组织廉政警示教育专题讲座 | https://nx.mof.gov.cn/caizhengjiancha/202609/t20260911_3997269.htm |
| 2026-09-08 | 财政部宁夏监管局：“四维聚力”织密织牢资产评估行业监督防护网 | https://nx.mof.gov.cn/caizhengjiancha/202609/t20260902_3996556.htm |
| 2026-09-04 | 回望烽火岁月 赓续英雄精神 财政部宁夏监管局赴自治区科技馆开展抗美援朝英雄集体事迹专题展参观学习主题党日活动 | https://nx.mof.gov.cn/caizhengjiancha/202609/t20260904_3996730.htm |
| 2026-08-21 | 财政部宁夏监管局召开2026年上半年部门预算监管工作会议 | https://nx.mof.gov.cn/caizhengjiancha/202608/t20260821_3995915.htm |
| 2026-08-21 | 财政部宁夏监管局学习青年干部座谈会精神立足岗位淬炼财政青春 | https://nx.mof.gov.cn/caizhengjiancha/202608/t20260821_3995913.htm |
| 2026-08-17 | 财政部宁夏监管局2025年度单位决算 | https://nx.mof.gov.cn/caizhengjiancha/202608/t20260817_3995603.htm |

- 宁夏 pagination/navigation: `首页` breadcrumb; inline JS declares `currentPage=0` (zero-based), `countPage=11`, and generates first/previous/numbered/next/last links (`index.htm`/`index_n.htm`). No further page was requested.

### 新疆
- Homepage `https://xj.mof.gov.cn/`; observed heading href `./caizhengjiancha/` at `div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a`; list `https://xj.mof.gov.cn/caizhengjiancha/` (HTTP 200), SHA-256 `ec64a3be2ebf73afac533c0264a37ab1e73465532d591b393cf624766beec240`.

| List date | Title | Observed article URL |
|---|---|---|
| 2026-09-24 | 新疆监管局：创新四维监管模式 筑牢兵团转移支付资金安全防线 | https://xj.mof.gov.cn/caizhengjiancha/202607/t20260717_3993738.htm |
| 2026-09-23 | 财政部新疆监管局：政治领航 多点攻坚 协同筑防扎实做好财政金融监管工作 | https://xj.mof.gov.cn/caizhengjiancha/202607/t20260713_3993416.htm |
| 2026-09-21 | 新疆监管局：三措并举 推动农村环境整治资金重点绩效评价工作走深走实 | https://xj.mof.gov.cn/caizhengjiancha/202607/t20260722_3993952.htm |
| 2026-09-18 | 财政部新疆监管局：精准施策多维发力 抓实超长期特别国债资金监管 | https://xj.mof.gov.cn/caizhengjiancha/202609/t20260918_3997666.htm |
| 2026-09-16 | 财政部新疆监管局：聚焦四措精准发力 深耕内控提质增效 | https://xj.mof.gov.cn/caizhengjiancha/202609/t20260916_3997505.htm |
| 2026-09-11 | 财政部新疆监管局：监管课堂进基层 精准施训筑防线 | https://xj.mof.gov.cn/caizhengjiancha/202609/t20260911_3997248.htm |
| 2026-09-02 | 财政部新疆监管局：聚焦五项精准举措 扎实推进转移支付常态化监督工作 | https://xj.mof.gov.cn/caizhengjiancha/202609/t20260902_3996498.htm |
| 2026-08-20 | 财政部新疆监管局：三措并举做好民航发展基金审核 | https://xj.mof.gov.cn/caizhengjiancha/202608/t20260820_3995841.htm |
| 2026-08-17 | “监管课堂”走进兵团师市 精准赋能财政监管与风险防控 | https://xj.mof.gov.cn/caizhengjiancha/202608/t20260817_3995657.htm |
| 2026-08-17 | 财政部新疆监管局2025年度单位决算公开 | https://xj.mof.gov.cn/caizhengjiancha/202608/t20260817_3995653.htm |

- 新疆 pagination/navigation: `首页` breadcrumb; inline JS declares `currentPage=0` (zero-based), `countPage=15`, and generates first/previous/numbered/next/last links (`index.htm`/`index_n.htm`). No further page was requested.

### Category scope
The captured pages are headed “工作动态” and show fiscal oversight plus internal training, management, holiday, and organizational activity. This is limited first-page category evidence. It does not establish complete coverage, publication-date authority, detail/body behavior, or stable refresh windows. No details were requested. This is not source acceptance or Gate 2 completion.

## RISKS
List display dates may disagree with URL path dates. Examples include 青海 display 2026-09-18 versus URL `t20260914` and 2026-09-15 versus `t20260910`; 宁夏 display 2026-09-08 versus `t20260902`; 新疆 display dates 2026-09-24/09-23/09-21 versus July URL paths. These were not resolved via detail fetches.

## BLOCKERS
No blocker to offline QA. Detail identity/body, authoritative date semantics, and coverage outside the captured first pages remain unknown.

## NEXT
QA can verify the six raw response hashes, official directory raw hashes, exact dispatcher events and homepage-to-list anchor chain offline. This closes the current sweep through the final three still-unobserved directory rows. Recorded scope gaps remain: Gansu timed out before a homepage/list observation, and Zhejiang's dynamic-news target remains unresolved (the image-news list is narrower evidence). The broader evidence for other rows remains limited to their reports. Source acceptance and Gate 2 remain open for further review.

Evidence:
- Ignored raw responses, manifest, one-shot marker: `D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\regional-batch9-20261005\`
- Manifest: `D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\regional-batch9-20261005\manifest.json`
