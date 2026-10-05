# Zhejiang regulatory-work list observation (2026-10-05)

## TASK
After offline review of the saved Zhejiang homepage exposed the exact `监管工作` list URL, use the separately approved scope for one direct GET only (20 seconds, 6 MiB, redirects 0, retries 0). Do not follow list links, download attachments, access DB, or run collectors, workers, or models.

## MODEL
Luna High; model/worker calls: 0. One GET used P3 guarded fetch with Undici 8.11.2 hard cap 1.

## FILES_CHANGED
- Tracked: this report only.
- Ignored evidence: `.data/fiscal-qa/zhejiang-regulatory-column-20261005/` (one-shot runner/marker, manifest, saved list HTML). No source config, shared docs/matrix, index, or DB changes.

## TESTS_RUN
- Pre-request offline preflight validated the saved homepage HTML and exactly two matching `监管工作` anchors with the same observed href. Runner passed `node --check` before executing.
- Response audit: HTTP 200, final URL equals exact authorized URL; saved raw SHA-256 and byte count in manifest.
- Undici 8.11.2: attempted/dispatched/rejected=1/1/0; create/sendHeaders/headers/error=1/1/1/0. No further network access.

## RESULT
The exact target was `https://zj.mof.gov.cn/caizhengjiancha/`, derived from `href="./caizhengjiancha/"` on the saved homepage, not guessed. That homepage provides two distinct actual anchor locations with the same link: left navigation `div.mainboxerji > div.zzleft > ul > li#2697 > a`, and main-content heading `div.mainboxerji > div.zzright > div.zcgzBox > h2 > a`.

The one response page title is “监管工作”; breadcrumb is “当前位置：首页>监管工作”. It yielded 9 unique same-host `.htm` article candidates and one visible PDF attachment anchor. Display dates are adjacent row metadata, not independently verified publication dates. Raw response: 12,644 bytes, SHA-256 `3a48972a67fd98701e6e861f908ef84e6840a6bf39e976eccaac010b28a1a254`.

| List date | Title | Observed link |
|---|---|---|
| 2026-09-30 | 浙江监管局：协同推进 建立预算执行常态化监督联合工作机制 | https://zj.mof.gov.cn/caizhengjiancha/202609/t20260930_3998386.htm |
| 2026-09-24 | 浙江监管局：服务工作得到陈清莉委员当面感谢 | https://zj.mof.gov.cn/caizhengjiancha/202609/t20260924_3998132.htm |
| 2026-09-18 | 浙江监管局：认真贯彻落实财政科学管理试点座谈会精神 | https://zj.mof.gov.cn/caizhengjiancha/202609/t20260918_3997664.htm |
| 2026-09-18 | 浙江监管局：赴杭州市财政局调研部门预算管理数字化应用情况 | https://zj.mof.gov.cn/caizhengjiancha/202609/t20260918_3997663.htm |
| 2026-09-16 | 浙江监管局：深学践行义乌发展经验 牢固树立和践行正确政绩观以高效能中枢履职服务财政监管高质量发展 | https://zj.mof.gov.cn/caizhengjiancha/202609/t20260904_3996734.htm |
| 2026-09-02 | 浙江监管局：深入学习贯彻新修改《中华人民共和国注册会计师法》 以法治力量推动财会监督提质增效 | https://zj.mof.gov.cn/caizhengjiancha/202608/t20260828_3996301.htm |
| 2026-08-27 | 浙江监管局：以习近平党建思想为引领 锻造想监管敢监管能监管的过硬本领 | https://zj.mof.gov.cn/caizhengjiancha/202608/t20260810_3995209.htm |
| 2026-08-21 | 财政部浙江监管局：“四个坚持”推进干部教育培训 为财政监管高质量发展提供坚实保障 | https://zj.mof.gov.cn/caizhengjiancha/202608/t20260821_3995908.htm |
| 2026-08-21 | 财政部浙江监管局：扎实开展中央企业国有资本收益审核工作 | https://zj.mof.gov.cn/caizhengjiancha/202608/t20260803_3994730.htm |

The response also contains a PDF link titled “财政部浙江监管局2025年度单位决算” (`https://zj.mof.gov.cn/caizhengjiancha/202608/P020260817402979611996.pdf`). Only its link was observed; no attachment was requested.

Navigation on this response page: “关于我们” (`../gywm2019/`), “机关党建” (`../lianzhengjianshe/`), “监管工作” (`./`), “办事指南” (`../banshizhinan/`), “动态简讯” (`../dtjx/`). In particular, “动态简讯” remains a sibling menu branch under the previous saved homepage, and prior offline evidence shows its `/dtjx/` wrapper replaces location to `/dtjx/tupianbaodao_1/`, whose label is “图片新闻”; the saved Picture News target page separately links sibling “处室动态” at `../csdt_1/`. These are relations from the saved homepage/wrapper/Picture News raw files; this request did not open that branch or request sibling pages.

Pagination observed in the returned raw HTML: inline JS declares `currentPage=0` (zero-based), `countPage=16`, and provides first/previous/numbered/next/last controls that generate `index.htm` / `index_n.htm` URLs. No later page was requested. The page’s ordinary captured anchor corresponding to navigation was “首页” breadcrumb; JS controls were not followed.

The heading and observed article titles make this an evident candidate for Zhejiang fiscal-regulatory business-news coverage (for example, budget-execution supervision, fiscal-management pilot work, budget-management digitization, accounting-supervision law, and state-owned-enterprise capital-revenue review). This one first-page observation does not establish the section’s complete scope, time coverage, detail/body quality, or production-source acceptance. The distinct “图片新闻” page remains narrower evidence and is not treated as total coverage.

## RISKS
List dates are not yet compared with article-detail metadata. Several displayed dates differ from the URL path date (for example, one displayed 2026-09-16 item uses a `t20260904` URL; displayed 2026-09-02 uses `t20260828`; displayed 2026-08-27 uses `t20260810`). No detail or PDF was requested, so these and body identity remain unknown.

## BLOCKERS
No blocker to offline QA. Broader section coverage, authoritative dates, and detail/body behavior are not established.

## NEXT
QA can verify the exact homepage anchor chain, manifest, raw hash, and one-event P3 budget offline. Preserve this as a strong source-review candidate, not an acceptance or Gate 2 pass.

Evidence:
- Manifest/raw/one-shot marker: `D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\zhejiang-regulatory-column-20261005\`
- Manifest: `D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\zhejiang-regulatory-column-20261005\manifest.json`
