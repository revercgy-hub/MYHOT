# Regional bureau batch 5: Henan, Hubei, Hunan, Guangdong (2026-10-05)

## TASK
Observe one mapped bureau homepage and, only when the live homepage exposes an exact same-host “工作动态” or “新闻动态” heading anchor in main content, one such list page for each of four previously unobserved bureaus. Dispatch ceiling: 8 total, 2 per bureau; 20 seconds, 6 MiB, direct HTTPS, zero redirects/retries. No article/detail, attachment, database, collector, worker, or model activity.

## MODEL
Luna High A; model/worker calls: 0. Network requests used the repository P3 guarded fetch and Undici 8.11.2 budget hook.

## FILES_CHANGED
- Tracked: this report only.
- Ignored evidence: `.data/fiscal-qa/regional-batch5-20261005/` (eight HTML responses, one-shot marker, manifest, and local one-shot runner). No source config, shared matrix, index, or database changes.

## TESTS_RUN
- `node --check .data/fiscal-qa/regional-batch5-20261005/run.mjs` passed before the one-shot run.
- Offline manifest/raw audit: 8 response files and SHA-256 values checked against the recorded manifest; all 8 responses were HTTP 200 at the exact requested URL.
- Undici 8.11.2 snapshot: attempted 8, rejected 0, dispatched 8; event counts `request:create=8`, `client:sendHeaders=8`, `request:headers=8`, `request:error=0`. No redirect/retry/fallback; no activity after the batch.

## RESULT
The saved Ministry of Finance bureau directory maps 河南/湖北/湖南/广东 to `http://ha.mof.gov.cn`, `http://hb.mof.gov.cn`, `http://hn.mof.gov.cn`, and `http://gd.mof.gov.cn` respectively (directory raw SHA-256: `5b2d91fb179372313657fef0884a04e7aef6ae1f0aed35503d78937c75ea177e`). This batch used the separately lead-authorized HTTPS root transport upgrade for those exact verified hosts; the saved directory itself did not provide HTTPS URLs.

Each returned homepage had its bureau homepage title. Each had an exact “工作动态” anchor nested in an `h2` under main-content sections (`.gzdtbox .gzdtlist` for 河南、湖北、湖南; `.bottomBox .czsjbox` for 广东). The observed relative hrefs, resolved without guessing, were `./caizhengjiancha/` for 河南, `./gzdt2019/caizhengjiancha/` for 湖北, and `./caizhengjiancha/` for 湖南、广东. Each list response title was “工作动态”.

All list pages exposed 10 distinct same-host article-link candidates in the captured HTML. Dates below are the dates visibly associated with list rows; URLs are resolved from those same observed anchors. Titles use each anchor’s actual `title` attribute where present (the visible link text is truncated for some rows).

### 河南
- Homepage: `https://ha.mof.gov.cn/` (HTTP 200); observed heading href `./caizhengjiancha/` at `div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a`; requested list: `https://ha.mof.gov.cn/caizhengjiancha/` (HTTP 200).
- Captured list SHA-256: `9411e77e368c5f9d267d2baf05472f3e1f1f46cfc0da8f6dde01c7102c9c313b`; visible unique candidates: 10.

| List date | Title | Observed article URL |
|---|---|---|
| 2026-09-30 | 财政部河南监管局：多措并举 推动绩效评价工作高质量开展 | https://ha.mof.gov.cn/caizhengjiancha/202609/t20260930_3998389.htm |
| 2026-09-30 | 财政部河南监管局：召开树立和践行正确政绩观学习教育总结会 | https://ha.mof.gov.cn/caizhengjiancha/202609/t20260930_3998355.htm |
| 2026-09-29 | 财政部河南监管局：高位谋划推进零基预算改革 扎实开展属地中央预算单位预算编制审核工作 | https://ha.mof.gov.cn/caizhengjiancha/202609/t20260929_3998300.htm |
| 2026-09-21 | 财政部河南监管局：监管三处党支部开展官德家风教育主题党日活动 | https://ha.mof.gov.cn/caizhengjiancha/202609/t20260921_3997864.htm |
| 2026-09-21 | 坚持正风肃纪 以廉赋能监管 ——局党组成员、纪检组长马连杰听取国债资金核查组 廉政工作汇报 | https://ha.mof.gov.cn/caizhengjiancha/202609/t20260921_3997863.htm |
| 2026-09-16 | 财政部河南监管局：深耕党建引领 赋能财政监管助推财政事业高质量发展 | https://ha.mof.gov.cn/caizhengjiancha/202609/t20260916_3997552.htm |
| 2026-09-16 | 财政部河南监管局：深学细悟《习近平党建文选》 以高质量党建引领财政监管工作提质增效 | https://ha.mof.gov.cn/caizhengjiancha/202609/t20260916_3997546.htm |
| 2026-09-16 | 财政部河南监管局：监管二处党支部与新郑海关综合业务一科党支部联合开展“三联基层促发展”党建联建活动 | https://ha.mof.gov.cn/caizhengjiancha/202609/t20260916_3997545.htm |
| 2026-09-16 | 财政部河南监管局：四个突出 扎实开展属地国有金融资本产权登记监管 | https://ha.mof.gov.cn/caizhengjiancha/202609/t20260916_3997542.htm |
| 2026-09-10 | 财政部河南监管局：四维发力 全链条护航中央转移支付资金落地见效 | https://ha.mof.gov.cn/caizhengjiancha/202609/t20260910_3997044.htm |

- Navigation/pagination observed in raw HTML: breadcrumb `首页`; JavaScript pagination declares `currentPage=0` (zero-based) and `countPage=50`, with page URLs constructed as `index.htm` / `index_n.htm` plus first/previous/next/last controls. These controls are emitted by page JavaScript rather than ordinary captured anchors. No subsequent page was requested, so page coverage is only this first captured list response.

### 湖北
- Homepage: `https://hb.mof.gov.cn/` (HTTP 200); observed heading href `./gzdt2019/caizhengjiancha/` at `div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a`; requested list: `https://hb.mof.gov.cn/gzdt2019/caizhengjiancha/` (HTTP 200).
- Captured list SHA-256: `b9bf99fa84634a4758a3bcddcb65bfa99e05b09c09a795eda12ef760f3a0b17b`; visible unique candidates: 10.

| List date | Title | Observed article URL |
|---|---|---|
| 2026-09-29 | 财政部湖北监管局：湖北监管局在第八届“财青8+” 青年调研中再创佳绩 | https://hb.mof.gov.cn/gzdt2019/caizhengjiancha/202609/t20260929_3998269.htm |
| 2026-09-29 | 财政部湖北监管局：打造“学习砺剑”品牌 增强财会监督本领 | https://hb.mof.gov.cn/gzdt2019/caizhengjiancha/202609/t20260929_3998267.htm |
| 2026-09-22 | 财政部湖北监管局：吾辈自强 永续荣光 ——监管四处党支部开展纪念中国人民抗日战争暨世界反法西斯战争胜利81周年主题党日活动 | https://hb.mof.gov.cn/gzdt2019/caizhengjiancha/202609/t20260922_3997924.htm |
| 2026-09-22 | 财政部湖北监管局：坚持“四个突出”扎实开展中央金融企业不良资产业务专项核查 | https://hb.mof.gov.cn/gzdt2019/caizhengjiancha/202609/t20260922_3997922.htm |
| 2026-09-14 | 财政部湖北监管局：学党建思想砥砺初心 传优良局风庚续使命 ——湖北监管局青年干部走进局史馆 | https://hb.mof.gov.cn/gzdt2019/caizhengjiancha/202609/t20260914_3997349.htm |
| 2026-09-14 | 财政部湖北监管局：主动对接 以评促服 推动财政监管与服务代表工作互融共促 | https://hb.mof.gov.cn/gzdt2019/caizhengjiancha/202609/t20260914_3997347.htm |
| 2026-09-16 | 财政部湖北监管局：切实提高政治站位 深入贯彻落实财政科学管理试点座谈会精神 | https://hb.mof.gov.cn/gzdt2019/caizhengjiancha/202609/t20260910_3997189.htm |
| 2026-09-07 | 财政部湖北监管局：明方向 强统筹 提质效 纵深推进零基预算改革落地见效 | https://hb.mof.gov.cn/gzdt2019/caizhengjiancha/202609/t20260907_3996861.htm |
| 2026-09-07 | 财政部湖北监管局：湖北多措并举优化编外人员队伍 以“精兵减支”落实过紧日子要求 | https://hb.mof.gov.cn/gzdt2019/caizhengjiancha/202609/t20260907_3996859.htm |
| 2026-08-31 | 湖北监管局：突出“三个坚持” 推动树立和践行正确政绩观学习教育走深走实 | https://hb.mof.gov.cn/gzdt2019/caizhengjiancha/202608/t20260831_3996354.htm |

- Navigation/pagination observed in raw HTML: breadcrumb `首页`; JavaScript pagination declares `currentPage=0` (zero-based) and `countPage=50`, with page URLs constructed as `index.htm` / `index_n.htm` plus first/previous/next/last controls. These controls are emitted by page JavaScript rather than ordinary captured anchors. No subsequent page was requested, so page coverage is only this first captured list response.

### 湖南
- Homepage: `https://hn.mof.gov.cn/` (HTTP 200); observed heading href `./caizhengjiancha/` at `div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a`; requested list: `https://hn.mof.gov.cn/caizhengjiancha/` (HTTP 200).
- Captured list SHA-256: `64d095eb28357c2637ca779898391b57c7f460d02bfaa6aca3f8af2fdef5341f`; visible unique candidates: 10.

| List date | Title | Observed article URL |
|---|---|---|
| 2026-09-30 | 财政部湖南监管局组织开展公文、保密和内控工作培训 | https://hn.mof.gov.cn/caizhengjiancha/202609/t20260930_3998467.htm |
| 2026-09-30 | 财政部湖南监管局赴浏阳市开展工作调研 | https://hn.mof.gov.cn/caizhengjiancha/202609/t20260930_3998463.htm |
| 2026-09-24 | 财政部湖南监管局：抓实安全举 措筑牢安全防线 | https://hn.mof.gov.cn/caizhengjiancha/202609/t20260924_3998121.htm |
| 2026-09-24 | 财政部湖南监管局：开展消防专题培训 筑牢安全防护底线 | https://hn.mof.gov.cn/caizhengjiancha/202609/t20260924_3998116.htm |
| 2026-09-23 | 湖南监管局：“四维发力”严审民航基建贷款贴息 切实提升财政资金监管质效 | https://hn.mof.gov.cn/caizhengjiancha/202609/t20260918_3997698.htm |
| 2026-09-20 | 湖南监管局：算好“三笔账”守牢中央企业国有资本收益“钱袋子” | https://hn.mof.gov.cn/caizhengjiancha/202609/t20260911_3997234.htm |
| 2026-09-14 | 财政部湖南监管局：筑牢证券所日常监督防线助力行业健康规范发展 | https://hn.mof.gov.cn/caizhengjiancha/202609/t20260911_3997229.htm |
| 2026-09-04 | 湖南监管局扎实开展国有金融资本产权登记监督调研 | https://hn.mof.gov.cn/caizhengjiancha/202609/t20260904_3996687.htm |
| 2026-09-04 | 财政部湖南监管局开展“赓续红色血脉 涵养清廉正气”主题党日暨工会活动 | https://hn.mof.gov.cn/caizhengjiancha/202609/t20260904_3996682.htm |
| 2026-08-25 | 财政部湖南监管局：三维发力纵深推进财政监管信息化建设 | https://hn.mof.gov.cn/caizhengjiancha/202608/t20260824_3995942.htm |

- Navigation/pagination observed in raw HTML: breadcrumb `首页`; JavaScript pagination declares `currentPage=0` (zero-based) and `countPage=27`, with page URLs constructed as `index.htm` / `index_n.htm` plus first/previous/next/last controls. These controls are emitted by page JavaScript rather than ordinary captured anchors. No subsequent page was requested, so page coverage is only this first captured list response.

### 广东
- Homepage: `https://gd.mof.gov.cn/` (HTTP 200); observed heading href `./caizhengjiancha/` at `div.mainboxerji > div.zzright > div.bottomBox > div.czsjbox > h2 > a`; requested list: `https://gd.mof.gov.cn/caizhengjiancha/` (HTTP 200).
- Captured list SHA-256: `ce12d38a62deca528e5fc6d5ff7753bb0a1a9dda8fd522d2d4e3567a9bd89aa8`; visible unique candidates: 10.

| List date | Title | Observed article URL |
|---|---|---|
| 2026-09-28 | 广东监管局：健全“四个突出”监管体系，持续提升中央转移支付资金监管质效 | https://gd.mof.gov.cn/caizhengjiancha/202609/t20260928_3998195.htm |
| 2026-09-28 | 广东监管局：加强“四个落实” 高质量做好部门预算编制审核工作 | https://gd.mof.gov.cn/caizhengjiancha/202609/t20260928_3998190.htm |
| 2026-09-21 | 广东监管局：坚持财政科学管理导向 服务属地推进财政科学管理试点工作 | https://gd.mof.gov.cn/caizhengjiancha/202609/t20260921_3997865.htm |
| 2026-09-16 | 广东监管局召开会议 对树立和践行正确政绩观学习教育进行总结 | https://gd.mof.gov.cn/caizhengjiancha/202609/t20260916_3997538.htm |
| 2026-09-16 | 广东监管局：四举措抓实重点绩效评价 全面提升财政资金使用质效 | https://gd.mof.gov.cn/caizhengjiancha/202609/t20260916_3997537.htm |
| 2026-09-16 | 广东监管局：重温百年党史 筑牢实干初心 | https://gd.mof.gov.cn/caizhengjiancha/202609/t20260916_3997536.htm |
| 2026-09-08 | 财政部广东监管局召开财政科学管理试点座谈会精神宣讲会 | https://gd.mof.gov.cn/caizhengjiancha/202609/t20260908_3996948.htm |
| 2026-09-07 | 广东监管局：监管四处抓实保密教育 筑牢财政监管安全防线 | https://gd.mof.gov.cn/caizhengjiancha/202609/t20260907_3996856.htm |
| 2026-09-07 | 广东监管局：当好“三种角色”推动财政金融协同促内需一揽子政策落地见效 | https://gd.mof.gov.cn/caizhengjiancha/202609/t20260907_3996854.htm |
| 2026-09-03 | 广东监管局：赛龙夺锦竞风采 揭榜挂帅砺尖兵 | https://gd.mof.gov.cn/caizhengjiancha/202609/t20260903_3996610.htm |

- Navigation/pagination observed in raw HTML: breadcrumb `首页`; JavaScript pagination declares `currentPage=0` (zero-based) and `countPage=15`, with page URLs constructed as `index.htm` / `index_n.htm` plus first/previous/next/last controls. These controls are emitted by page JavaScript rather than ordinary captured anchors. No subsequent page was requested, so page coverage is only this first captured list response.

The category heading is “工作动态” for all four observations, so the captured pages support a category-level work-dynamics lead. One page per bureau and one page of candidates do not establish complete section coverage, update cadence, or full-text/detail behavior. Titles include both fiscal supervision and routine organizational activity; the practical topical scope of the broader section remains unverified. No article detail pages were fetched, so body availability and article metadata authority remain unknown. This is an observation lead only, not source acceptance or Gate 2 completion.

## RISKS
List-row dates are observed display metadata, not independently authoritative publication dates. At least one visible date/URL-date disagreement appears in Hubei: the row displays 2026-09-16 while the observed article URL contains `t20260910`. Hunan also has several URL-date/display-date differences. These require later detail/metadata validation; no inference was made here. List titles, page ordering, and first-page candidates may change over time.

## BLOCKERS
No blocker to offline QA of this observation batch. Unknowns remain about detail-page identity/body behavior, date authority, and the unobserved remainder of each category.

## NEXT
QA can independently verify the ignored raw files, manifest, exact budget events, and homepage-to-list anchor chain without network access. Keep source-pass and Gate 2 status open until separately authorized validation establishes the needed detail and coverage properties.

Evidence paths (absolute on the local workspace):
- Raw responses, manifest, and one-shot marker: `D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\regional-batch5-20261005\`
- Full request/event/hash manifest: `D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\regional-batch5-20261005\manifest.json`
