# 浙江“动态简讯”跳转目标单页观察（2026-10-05）

## TASK
在已有batch4浙江首页和“动态简讯”JS包装页观察之后，对其保存HTML中明确指向的同域页面发起一次public direct GET。目标必须从原始脚本相对URL解析得出；请求限制为1次，20秒、6 MiB、redirect=0、retry=0。不跟随后续跳转、不请求详情或附件。

## MODEL
Luna High。唯一请求使用后端Undici 8.11.2 `p3-http-budget` admission hook。`attempted/dispatched/rejected=1/1/0`，观测事件3次（create、sendHeaders、response headers各1），0 request error、0 observer callback error。页面返回HTTP 200，final URL等于请求URL。未请求数据库、collector、worker或模型。

## FILES_CHANGED
- ignored evidence：`D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\zhejiang-target-20261005\` 下 `run.mjs`、one-shot marker、`manifest.json` 与 raw `zhejiang-tupianbaodao-1.html`。
- 新增本报告。未改industry配置、测试、共享矩阵或任何source数据库行。

## TESTS_RUN
- 请求前离线核对上轮包装页raw为379 bytes、SHA-256 `8a86eb22f95e97b01c37a4fd479e5d6a890b6c0d60df3e84491e487c9aef4187`，匹配其manifest。
- 离线将包装页中 `location.replace("./tupianbaodao_1/")` 相对于最终响应URL `https://zj.mof.gov.cn/dtjx/` 解析，结果精确为 `https://zj.mof.gov.cn/dtjx/tupianbaodao_1/`；与批准目标一致后才请求。
- `node --check .data/fiscal-qa/zhejiang-target-20261005/run.mjs`：通过。此次未运行软件测试。
- 目标raw按manifest记录为11,826 bytes，SHA-256 `525c6c11169de2b219cabec5766a3724e3dc14224e00283b87a112c3c3435661`；只离线解析该响应的列表DOM，没有后续网络访问。

## RESULT
本次GET时间为 `2026-10-05T08:09:55Z`，请求及最终URL均为 `https://zj.mof.gov.cn/dtjx/tupianbaodao_1/`，响应页title为“图片新闻”。解析到23个HTML锚点、9个唯一同域 `.htm` 文章链接、0个PDF链接。候选标题、所在行日期与URL如下；日期仅为列表可见日期，没有请求详情核对权威发布日期。

| 列表标题 | 列表日期 | 文章URL |
|---|---|---|
| 浙江监管局：9月2日孙丽华书记一行调研我局廉洁文化建设 | 2026-09-11 | `https://zj.mof.gov.cn/dtjx/tupianbaodao_1/202609/t20260911_3997289.htm` |
| 财政部浙江监管局：举办AED应急救护技能培训 | 2026-08-28 | `https://zj.mof.gov.cn/dtjx/tupianbaodao_1/202608/t20260828_3996303.htm` |
| 财政部浙江监管局：开展消防安全宣传教育活动 | 2026-06-18 | `https://zj.mof.gov.cn/dtjx/tupianbaodao_1/202606/t20260618_3991898.htm` |
| 浙江监管局召开驻浙中央预算单位部门预算监管工作会议 | 2026-04-29 | `https://zj.mof.gov.cn/dtjx/tupianbaodao_1/202604/t20260429_3988807.htm` |
| 浙江监管局举办“花开三月天 水乡寻春意”妇女节踏青活动 | 2026-04-29 | `https://zj.mof.gov.cn/dtjx/tupianbaodao_1/202604/t20260429_3988806.htm` |
| 浙江监管局温情举行彭刚同志荣休仪式 | 2026-04-29 | `https://zj.mof.gov.cn/dtjx/tupianbaodao_1/202604/t20260429_3988804.htm` |
| 财政部浙江监管局召开浙江省中央财政监管工作会议 | 2026-04-29 | `https://zj.mof.gov.cn/dtjx/tupianbaodao_1/202604/t20260429_3988802.htm` |
| 浙江监管局专项检查临时党支部在中共一大会址开展主题党日活动 | 2023-12-28 | `https://zj.mof.gov.cn/dtjx/tupianbaodao_1/202312/t20231228_3924472.htm` |
| 局机关工会组织“杭州史迹·石刻精讲”专题讲座 | 2023-12-28 | `https://zj.mof.gov.cn/dtjx/tupianbaodao_1/202312/t20231228_3924468.htm` |

页面面包屑为“首页 > 动态简讯 > 图片新闻”；导航锚点另列“图片新闻”“处室动态”“首页”“动态简讯”。本页可见一个“首页”面包屑，没有观察到“上一页”“下一页”“末页”或页码控件。列表日期最早为2023-12-28，最新为2026-09-11。当前页面混有培训、消防宣传、退休仪式、党日和工会活动等图片报道。因此它证明了“动态简讯”会落到一个“图片新闻”列表页，不能作为浙江监管新闻总体动态栏目或完整来源覆盖的确认。

## RISKS
- 只有一页HTML和9条候选；未核详情、完整发布日期、列表分页、更新窗口或长期稳定性。没有pager控件只能描述此页当前DOM，不能推断后台无历史分页。
- 页面显示该图片新闻流混有大量内部活动；不判断其余候选是否应入选，也不将图片新闻页面推广为来源配置。

## BLOCKERS
浙江“动态简讯”子栏目不等于目标整体“工作动态/新闻动态”覆盖，也尚未验证详情与业务质量。此观察不构成来源验收或Gate 2通过；Gate 2仍 `NOT_PASSED`。

## NEXT
QA可离线核验本目录manifest/raw及前序包装页target推导。共享覆盖矩阵如记录本次结果，应保留其“图片新闻子页、范围未确认”的边界；进一步详情、分页或其他栏目请求需另行批准。
