# 财政部地方监管局新闻栏目覆盖矩阵

状态基准：2026-10-07。范围按用户已确认的首阶段口径：逐局覆盖全国财政部各地方监管局的新闻动态栏目；财政部中央选登仅作补充。这里的35行来自财政部官网机构目录两页（本地保存HTML：`.data/fiscal-regional-audit/www.mof.gov.cn_znjg_jgsz_czbzdfzyb.html` 与 `..._index_1_htm.html`，解析为18+17个目录锚点），只证明机构名和官网域名。它们不是35个已发现栏目、feed、已配置来源或已完成覆盖。NFRA地方监管局不属于本矩阵。执行日期依据各manifest内真实UTC时间戳；10月6日至7日是文档更新时点，不改变各manifest记载的实际观察时间。

“栏目证据”仅记录现存资料里能证明的地方栏目或中央汇总样本；中央选登中的一篇稿件不能证明其发布局独立栏目已找到。`未知`代表本地证据不足，不猜栏目、URL或selector。各局后续均需按真实页面核验栏目入口、列表身份/日期、详情正文、窗口/分页和重复；单项通过后才更新状态。

| # | 财政部官网目录机构名 | 目录域名 | 官方目录证据 | 现存新闻栏目证据 | 独立局源配置 | 独立栏目验证 | 缺口 / 最小下一步 |
|---:|---|---|---|---|---|---|---|
| 1 | 财政部北京监管局 | `bj.mof.gov.cn` | 目录页1锚点 | 2026-10-04 batch 1 实见首页“工作动态”链接、栏目列表10条；详情日期相差6天。2026-10-05 fresh隔离库真实collector抓10条（1列表+10详情），再显式抽取1篇和重复列表1次；样本详情日期为9/30，列表日9/24 | 有，`mof-beijing-supervision-dynamics`（disabled） | 有限：首次列表/详情正文raw hash缺失；单篇body转ok；重复列表幂等；其余9篇pending。未验分页、90日历史、周期稳定性 | 保留列表/详情日期差异和首轮11个响应hash未知；不把一次collector/正文样本当来源通过。详见[北京验证报告](BEIJING_REAL_COLLECTOR_2026-10-05.md) |
| 2 | 财政部天津监管局 | `tj.mof.gov.cn` | 目录页1锚点 | 2026-10-04 batch 2 实见首页主内容“工作动态”锚点及同域栏目页；栏目页当前可见10条 `.htm` 候选，未请求详情 | 否 | 有限：一次首页与一页列表结构；未验详情、周期、分页或selector稳定性 | 详情题名/正文/权威日期和窗口仍未知；只可从已保存列表候选中另行核销详情 |
| 3 | 财政部河北监管局 | `he.mof.gov.cn` | 目录页1锚点 | 2026-10-04 batch 2 实见首页主内容“工作动态”锚点及同域栏目页；当前列表10条 `.htm` 候选，未请求详情 | 否 | 有限：一次首页与一页列表结构；未验详情、周期、分页或selector稳定性 | 列表日期与URL路径日期可见不一致样例；正文和真实发布时间未知，详情需另行核验 |
| 4 | 财政部山西监管局 | `sn.mof.gov.cn` | 目录页1锚点 | 2026-10-04 batch 2 实见首页主内容“工作动态”锚点及同域栏目页；当前列表10条 `.htm` 候选，未请求详情 | 否 | 有限：一次首页与一页列表结构；未验详情、周期、分页或selector稳定性 | 列表日期与URL路径日期有差异样例；正文和真实发布时间未知，详情需另行核验 |
| 5 | 财政部内蒙古监管局 | `nmg.mof.gov.cn` | 目录页1锚点 | 2026-10-04 batch 2 实见首页主内容“工作动态”锚点及同域栏目页；当前列表10条 `.htm` 候选，未请求详情。中央选登稿仍只作补充 | 否 | 有限：一次首页与一页列表结构；未验详情、周期、分页或selector稳定性 | 列表日期与URL路径日期有差异样例；正文和真实发布时间未知，详情需另行核验 |
| 6 | 财政部辽宁监管局 | `ln.mof.gov.cn` | 目录页1锚点 | 2026-10-04 batch 3 实见首页主内容“工作动态”锚点及同域栏目页；当前列表10条 `.htm` 候选，未请求详情 | 否 | 有限：一次首页与一页列表结构；未验详情、周期、分页或selector稳定性 | 日期路径差异、详情正文与更新窗口仍未知；需另行核验 |
| 7 | 财政部大连监管局 | `dl.mof.gov.cn` | 目录页1锚点 | 2026-10-05 batch 7实见“工作动态”列表10项；首条详情HTTP200，题名/日期相符 | 否 | 有限：296字符/3段节前廉洁教育样本；未验分页历史/跨周期 | 内容偏内部活动、不推断全栏；[batch7详情](REGIONAL_BUREAU_BATCH7_DETAILS_2026-10-06.md) |
| 8 | 财政部吉林监管局 | `jl.mof.gov.cn` | 目录页1锚点 | 2026-10-04 batch 3 实见首页主内容“工作动态”锚点及同域栏目页；当前列表10条 `.htm` 候选，未请求详情。旧中央选登稿仍只作补充 | 否 | 有限：一次首页与一页列表结构；未验详情、周期、分页或selector稳定性 | 多项列表日与URL路径日期不同；正文和真实发布时间未知，详情需另行核验 |
| 9 | 财政部黑龙江监管局 | `hlj.mof.gov.cn` | 目录页1锚点 | 2026-10-04 batch 3 实见首页主内容“工作动态”锚点及同域栏目页；当前列表10条 `.htm` 候选，未请求详情 | 否 | 有限：一次首页与一页列表结构；未验详情、周期、分页或selector稳定性 | 多项列表日与URL路径日期不同；正文和真实发布时间未知，详情需另行核验 |
| 10 | 财政部上海监管局 | `sh.mof.gov.cn` | 目录页1锚点 | 2026-10-04 batch 1实见栏目/详情；2026-10-05真实collector一次保存10条，均`body_status=ok`；target正文样本另有抽取调用但0请求（已ok），幂等列表GET一次超时 | 有，`mof-shanghai-supervision-dynamics`（disabled） | 有限：10条单时点候选、一次列表GET超时partial；未验分页、历史窗口和跨周期 | 记录repeat超时并停止，不重试；内容质量、时间范围和周期仍待核，见[上海真实验证报告](SHANGHAI_REAL_COLLECTOR_2026-10-05.md) |
| 11 | 财政部江苏监管局 | `jsz.mof.gov.cn` | 目录页1锚点 | 2026-10-05 batch 4 实见首页“工作动态”主内容锚点；栏目页10条唯一同域`.htm`链接，当前可见日期2026-08-14—2026-09-30，未请求详情 | 否 | 有限：一次首页、一页列表结构；未验详情、分页/历史、周期、selector稳定性或业务质量 | 另取一条列表详情核题名/权威日期/正文，并核查分页和窗口 |
| 12 | 财政部浙江监管局 | `zj.mof.gov.cn` | 目录页1锚点 | 2026-10-05 batch 4首页未见“工作动态”/“新闻动态”；“动态简讯”先返回379字节JS包装，图片新闻目标页9项。保存首页实见“监管工作”锚点；列表9条候选、JS声明16页、1个PDF未请求；首条详情HTTP200，题名/日期一致，666字符/4段财政监管正文 | 否 | 有限：监管工作列表与单篇详情；无后续页/历史/周期验证，图片新闻范围较窄 | 见[监管工作页](REGIONAL_BUREAU_ZHEJIANG_REGULATORY_COLUMN_2026-10-05.md)、[图片新闻target](REGIONAL_BUREAU_ZHEJIANG_TARGET_2026-10-05.md)、[首篇详情](ZHEJIANG_REGULATORY_FIRST_DETAIL_2026-10-06.md)；不代表全栏目通过 |
| 13 | 财政部宁波监管局 | `nb.mof.gov.cn` | 目录页1锚点 | 2026-10-05 batch 7实见“工作动态”列表10项；首条详情HTTP200，题名/日期相符 | 否 | 有限：386字符/3段机关理论宣讲与青年活动样本 | 内容偏内部组织活动，不推断全栏；[batch7详情](REGIONAL_BUREAU_BATCH7_DETAILS_2026-10-06.md) |
| 14 | 财政部安徽监管局 | `ah.mof.gov.cn` | 目录页1锚点 | 2026-10-05 batch 4 实见首页“工作动态”主内容锚点；栏目页10条唯一同域`.htm`链接，当前可见日期2026-09-15—2026-09-30，未请求详情；中央选登仍仅作补充 | 否 | 有限：一次首页、一页列表结构；未验详情、分页/历史、周期、selector稳定性或业务质量 | 另取一条列表详情核题名/权威日期/正文，并核查分页和窗口 |
| 15 | 财政部福建监管局 | `fj.mof.gov.cn` | 目录页1锚点 | 2026-10-04 batch 1实见栏目/详情；2026-10-05 collector新增10条，9篇body ok、1篇pending；repeat list无变化；唯一pending行后获准cap1诊断为unconfirmed/non_article_container，body空/revision1/marker false；10/07四页静态列表观察共40候选 | 有，`mof-fujian-supervision-dynamics`（disabled；strict body-ready opt-in） | 有限：旧collector 9篇body ok、1篇pending；邻接PDF位于body selector外且未请求 | 四页无URL/逐条日期重叠但日期行序均非单调、4/3/5/2个日/路径冲突，90日窗口没有完整覆盖证明；S4 guard软件证据不等source pass；见[FJ诊断](FUJIAN_PENDING_BODY_DIAGNOSTIC_2026-10-06.md)、[10/7分页观察](P3_PAGINATION_OBSERVATION_2026-10-07.md)、[Sol范围](S4_ATTACHMENT_GUARD_SCOPE_REVIEW_2026-10-06.md)及[operator notes](STRICT_BODY_POLICY_OPERATOR_NOTES_2026-10-06.md) |
| 16 | 财政部厦门监管局 | `xm.mof.gov.cn` | 目录页1锚点 | 独立“工作动态”首页 `https://xm.mof.gov.cn/caizhengjiancha/index.htm` | 是，`mof-xiamen-supervision-dynamics`（disabled） | 部分：配置首页、相邻历史页及有限正文样本有记录 | 只覆盖厦门已测窗口；补跨周期/正文与去重证据，不外推其余34局 |
| 17 | 财政部江西监管局 | `jx.mof.gov.cn` | 目录页1锚点 | 2026-10-05 batch 4 实见首页“工作动态”主内容锚点；栏目页10条唯一同域`.htm`链接，当前可见日期2026-09-04—2026-09-30，未请求详情 | 否 | 有限：一次首页、一页列表结构；未验详情、分页/历史、周期、selector稳定性或业务质量 | 另取一条列表详情核题名/权威日期/正文，并核查分页和窗口 |
| 18 | 财政部山东监管局 | `sd.mof.gov.cn` | 目录页1锚点 | 2026-10-04 batch 3 实见首页主内容“工作动态”锚点及同域栏目页；当前列表10条 `.htm` 候选，未请求详情。旧中央选登稿仍只作补充 | 否 | 有限：一次首页与一页列表结构；未验详情、周期、分页或selector稳定性 | 多项列表日与URL路径日期不同；正文和真实发布时间未知，详情需另行核验 |
| 19 | 财政部青岛监管局 | `qd.mof.gov.cn` | 目录页2锚点 | 2026-10-05 batch 7实见“工作动态”列表10项；首条详情精确GET一次超时 | 否 | 有限：列表证据，详情内容unknown | 单次20秒预算已用，不重试/不换候选；[batch7详情](REGIONAL_BUREAU_BATCH7_DETAILS_2026-10-06.md) |
| 20 | 财政部河南监管局 | `ha.mof.gov.cn` | 目录页2锚点 | 2026-10-05 batch 5 首页/“工作动态”栏目各一次；首条详情HTTP200，列表/ArticleTitle/日期一致 | 已提交`mof-henan-supervision-dynamics`（disabled） | 有限：单篇1383可见字符、7段财政绩效监管正文、0附件；未验其他详情、分页历史或跨周期 | 本样本含实质财政监管事实，不代表全源质量；[四局详情报告](REGIONAL_BUREAU_BATCH5_DETAILS_2026-10-05.md) |
| 21 | 财政部湖北监管局 | `hb.mof.gov.cn` | 目录页2锚点 | 2026-10-05 batch 5 首页/“工作动态”栏目各一次；首条详情HTTP200，列表/ArticleTitle/日期一致 | 已提交`mof-hubei-supervision-dynamics`（disabled） | 有限：单篇235可见字符、2段青年获奖/队伍宣传、0附件；未验其他详情、分页历史或跨周期 | 此样本以内部组织宣传为主，不见具体财政监管结果；勿泛化为全源噪声率；[四局详情报告](REGIONAL_BUREAU_BATCH5_DETAILS_2026-10-05.md) |
| 22 | 财政部湖南监管局 | `hn.mof.gov.cn` | 目录页2锚点 | 2026-10-05 batch 5 首页/“工作动态”栏目各一次；首条详情HTTP200，列表/ArticleTitle/日期一致 | 已提交`mof-hunan-supervision-dynamics`（disabled） | 有限：单篇313可见字符、3段公文/保密/内控培训、0附件；未验其他详情、分页历史或跨周期 | 此样本偏机关内部培训，不代表全源噪声率；[四局详情报告](REGIONAL_BUREAU_BATCH5_DETAILS_2026-10-05.md) |
| 23 | 财政部广东监管局 | `gd.mof.gov.cn` | 目录页2锚点 | 2026-10-05 batch 5 首页/“工作动态”栏目各一次；首条详情HTTP200，列表/ArticleTitle/日期一致 | 已提交`mof-guangdong-supervision-dynamics`（disabled） | 有限：单篇1790可见字符、10段中央转移支付监管正文、0附件；未验其他详情、分页历史或跨周期 | 本样本含具体财政监管事实，不代表全源质量；[四局详情报告](REGIONAL_BUREAU_BATCH5_DETAILS_2026-10-05.md) |
| 24 | 财政部深圳监管局 | `sz.mof.gov.cn` | 目录页2锚点 | 2026-10-05 batch 7实见“工作动态”列表10项；首条详情HTTP200，301字符/2段 | 否 | 有限：注册会计师法专题学习样本 | 偏内部法律学习，不推断全栏；[batch7详情](REGIONAL_BUREAU_BATCH7_DETAILS_2026-10-06.md) |
| 25 | 财政部广西监管局 | `gx.mof.gov.cn` | 目录页2锚点 | 2026-10-05 batch 6 实见“工作动态”列表10项；首条详情HTTP200，1759字符/7段；10/06 `index_1.htm` page2 有10项唯一候选，显示日2026-08-11—09-07 | 是，`mof-guangxi-supervision-dynamics`（disabled；strict body-ready opt-in） | 有限：会计监督检查、数字风险筛查与整改跟进业务样本；page2 为单页观察 | 当前只有首页及一个分页的候选/正文样本，未证明完整90天历史、后续分页、跨周期或全栏业务质量；[batch6详情](REGIONAL_BUREAU_BATCH6_DETAILS_2026-10-06.md)、[Batch6分页](BATCH6_PAGINATION_PROBE_2026-10-06.md) |
| 26 | 财政部海南监管局 | `hq.mof.gov.cn` | 目录页2锚点 | 2026-10-05 batch 6 实见“工作动态”列表10项；首条详情HTTP200，370字符/6段；10/06 `index_1.htm` page2 有10项唯一候选，显示日2026-08-17—09-08 | 是，`mof-hainan-supervision-dynamics`（disabled；strict body-ready opt-in） | 有限：首篇为红色家风展览与职工活动；page2 为单页观察 | HQ是海南站点短名；页面候选和单篇样本不足以估计全栏噪声率，也未证明完整90日历史/跨周期或source pass；[batch6详情](REGIONAL_BUREAU_BATCH6_DETAILS_2026-10-06.md)、[Batch6分页](BATCH6_PAGINATION_PROBE_2026-10-06.md) |
| 27 | 财政部重庆监管局 | `cq.mof.gov.cn` | 目录页2锚点 | 2026-10-05 batch 6 实见“工作动态”列表10项；首条详情HTTP200，859字符/5段；10/06 `index_1.htm` page2 有10项唯一候选，显示日2026-09-02—09-21 | 是，`mof-chongqing-supervision-dynamics`（disabled；strict body-ready opt-in） | 有限：首篇为党支部网络安全学习；单篇不能判定整栏业务/噪声质量 | 仅首页加一页列表和单篇详情；历史窗口、后续分页及跨周期均未核验，不能据此声称来源通过；[batch6详情](REGIONAL_BUREAU_BATCH6_DETAILS_2026-10-06.md)、[Batch6分页](BATCH6_PAGINATION_PROBE_2026-10-06.md) |
| 28 | 财政部四川监管局 | `sc.mof.gov.cn` | 目录页2锚点 | 2026-10-05 batch 6 实见“工作动态”列表10项；首条详情HTTP200，330字符/3段；10/06 `index_1.htm` page2 有10项候选（2026-07-29—09-01），`index_2.htm` page3 有10项（2026-07-01—07-27），均与之前页面无URL重叠 | 是，`mof-sichuan-supervision-dynamics`（disabled；strict body-ready opt-in） | 有限：服务代表委员工作样本；列表历史观察尚未证明完整90天窗口 | page2有4项、page3有3项显示日/URL日差异，page3仍未到10/06观测时90日界限；只有两个分页样本，无跨周期或source admission；[batch6详情](REGIONAL_BUREAU_BATCH6_DETAILS_2026-10-06.md)、[Batch6分页](BATCH6_PAGINATION_PROBE_2026-10-06.md)、[四川page3](SICHUAN_HISTORY_PAGE3_PROBE_2026-10-06.md) |
| 29 | 财政部贵州监管局 | `gz.mof.gov.cn` | 目录页2锚点 | 2026-10-05 batch 8实见“工作动态”列表10项；首条详情HTTP200，2086字符/8段 | 有，`mof-guizhou-supervision-dynamics`（disabled；strict body-ready opt-in） | 有限：单篇主要为机关文化、内部制度与学习活动；10/07未请求分页 | 来源配置不表示来源验收；偏组织文化，不推断全栏。见[batch8详情](REGIONAL_BUREAU_BATCH8_DETAILS_2026-10-06.md)及[10/07检查点](HANDOFFS/NEXT_BUREAU_CHECKPOINT_2026-10-07.md) |
| 30 | 财政部云南监管局 | `yn.mof.gov.cn` | 目录页2锚点 | 2026-10-05 batch 8实见“工作动态”列表9项；首条详情HTTP200，1686字符/9段，标题空格与列表略有差异 | 否 | 有限：财政收入监管、数据分析与异常核查业务样本；列表/URL日9/18，PubDate/可见日9/24 | 日期差异未裁定；[batch8详情](REGIONAL_BUREAU_BATCH8_DETAILS_2026-10-06.md) |
| 31 | 财政部陕西监管局 | `sx.mof.gov.cn` | 目录页2锚点 | 2026-10-05 batch 8实见“工作动态”列表10项；首条详情HTTP200，899字符/8段 | 有，`mof-shaanxi-supervision-dynamics`（disabled；strict body-ready opt-in） | 有限：节前廉洁、安全提醒单篇；10/07未请求分页 | 偏内部提示，不推断全栏；见[batch8详情](REGIONAL_BUREAU_BATCH8_DETAILS_2026-10-06.md)及[10/07检查点](HANDOFFS/NEXT_BUREAU_CHECKPOINT_2026-10-07.md) |
| 32 | 财政部甘肃监管局 | `gs.mof.gov.cn` | 目录页2锚点 | 2026-10-05 batch 8 官方目录映射已核；唯一首页GET超时（Undici request error code 23），未收到HTTP响应、无raw body；无栏目请求。获批预算未转移或重试 | 否 | 仅确认官方域名映射并记录一次失败的首页探测；栏目仍未知 | 不以timeout计为列表观察；后续需另行核销新的首页/栏目小预算 |
| 33 | 财政部青海监管局 | `qh.mof.gov.cn` | 目录页2锚点 | 2026-10-05 batch 9实见“工作动态”列表10项；首条详情HTTP200，837字符/6段；10/07 `index_1.htm`新增10项、与首页0 URL重叠，显示日09-11—08-10、行序非单调、2个日/路径差异 | 有，`mof-qinghai-supervision-dynamics`（disabled；strict body-ready opt-in） | 有限：首篇为民族法规学习；分页样本10项均在90日窗但未触及07-09边界 | 行序乱序不能证明更老页已覆盖；单篇内宣样本不推断全栏。见[batch9详情](REGIONAL_BUREAU_BATCH9_DETAILS_2026-10-06.md)、[下一历史页报告](P3_NEXT_HISTORY_CHECK_2026-10-07.md)及[10/07检查点](HANDOFFS/NEXT_BUREAU_CHECKPOINT_2026-10-07.md) |
| 34 | 财政部宁夏监管局 | `nx.mof.gov.cn` | 目录页2锚点 | 2026-10-05 batch 9实见“工作动态”列表10项；首条详情HTTP200，847字符/5段；10/07 `index_1.htm`新增10项、与首页0 URL重叠，显示日08-14—06-23、行序递减、4个日/路径差异 | 有，`mof-ningxia-supervision-dynamics`（disabled；strict body-ready opt-in） | 有限：单篇为中央转移支付监管座谈；分页样本9项在90日窗、1项更早 | 仅一页历史观察，不能证明完整覆盖或日期权威。见[batch9详情](REGIONAL_BUREAU_BATCH9_DETAILS_2026-10-06.md)、[下一历史页报告](P3_NEXT_HISTORY_CHECK_2026-10-07.md)及[10/07检查点](HANDOFFS/NEXT_BUREAU_CHECKPOINT_2026-10-07.md) |
| 35 | 财政部新疆监管局 | `xj.mof.gov.cn` | 目录页2锚点 | 2026-10-05 batch 9实见“工作动态”列表10项；首条详情HTTP200，1881字符/5段 | 否 | 有限：兵团转移支付监管与整改业务样本；列表/PubDate/可见日9/24，URL日7/17 | 日期差异未裁定；[batch9详情](REGIONAL_BUREAU_BATCH9_DETAILS_2026-10-06.md) |

## 配置与状态边界

- `industry/sources.json` 当前有35个域名用于 `mof-regional-supervision-dynamics` 的中央选登 allowlist。这是一个汇总来源，不是35个地方栏目来源。
- 当前代码SHA `e3791c2744c285c7967cb1c6597da3187817889b` 配置27项（26 HTML、1 JSON），新增宁夏、青海、陕西、贵州四个disabled来源；九个地方局动态source采用strict body-ready opt-in，全部enabled=false、全文许可关闭。Batch 1–4有14个目标列表观察（不含厦门既有有限记录）；batch 5–9尝试19局，其中18局取得目标栏目列表、甘肃主页超时无列表。新增15条详情尝试已核销，14份raw hash匹配、青岛超时；连同batch5四局详情共19条尝试、18份成功raw、1次timeout。另有厦门既有有限配置/历史列表；浙江监管工作页和单篇业务详情不等于覆盖通过。北京、福建、上海隔离库collector及FJ S4诊断证据已核。Batch6广西、海南、重庆、四川各检查page2一页（各10条、无首页重叠），最老显示日7/29。福建10/07观察的四页40项候选未证明完整90日覆盖。宁夏、青海10/07获准各观察一页page2，原批次为2/2成功、各10项且无首页URL重叠；宁夏有1项早于90日截止日且4个日/路径冲突，青海页内乱序、仍未触及边界且有2个冲突。随后独立获准的宁夏快照尝试在首页前置GET超时（1/11 dispatch），失败后按规则停止，未请求任何历史页或首页后置快照。分页/历史、日期差异与跨周期仍未完整验证；证据只推进样本，不代表source pass或Gate 2通过。详见[下一历史页报告](P3_NEXT_HISTORY_CHECK_2026-10-07.md)、[配置续批裁定](S1_BUREAU_BODY_POLICY_CONTINUATION_2026-10-07.md)和[当前检查点](HANDOFFS/NEXT_BUREAU_CHECKPOINT_2026-10-07.md)。
- “中央候选稿”列只说明既有中央选登材料中曾有对应局名稿件，不补齐该局的栏目入口、未出现局的覆盖或栏目稳定性。样本命中与否均不用于判定某局是否有动态。
- 目录数量35按两页实际18+17计数；未把NFRA地方机构混入，也未按“25–35个来源”计划目标凑数。逐局确认范围不代表栏目已发现、source已验收或collector可批量启用；Gate 2仍未通过。

## 后续核验顺序

按小批次逐局进行：先从保存的财政部目录链接进入该局官方站点；只有在后续获批的有界页面观察中，才记录站点实际展示的新闻栏目、精确列表URL和DOM，再依据真实列表挑一条详情核标题、日期和正文。批次记录窗口变化、翻页/历史可见范围和URL重复；证据不足就保留未知。每批完成独立QA与Lead审阅前，不添加行业source配置，不跑bulk collector/模型。本矩阵没有替各批次核销网络预算，也不授权新请求。

### 2026-10-04 首批三局只读观察

福建、北京、上海每局各完成首页与其真实DOM展示的“工作动态”栏目观察，再从保存列表中选一条HTTPS文章URL作一次详情GET；整批详情预算`attempted/dispatched/rejected=3/3/0`，首页/列表预算另见[batch 1报告](REGIONAL_BUREAU_BATCH1_2026-10-04.md)。详情观察同样为三次HTTP 200。静态DOM检查及日期/标题差异见[详情QA](REGIONAL_BUREAU_BATCH1_DETAIL_QA_2026-10-04.md)。该证据只把三行从“栏目未知/无详情配对”推进到“首批有限页面证据”；没有配置来源、运行collector、数据库写入或模型调用，也没有跨周期/全局逐局覆盖结论。北京日期差异是需保留的风险，不以标题大体一致遮蔽。

### 2026-10-04 第二、三批四局栏目页只读观察

[第二批报告](REGIONAL_BUREAU_BATCH2_2026-10-04.md)记录天津、河北、山西、内蒙古；[第三批报告](REGIONAL_BUREAU_BATCH3_2026-10-04.md)记录辽宁、吉林、黑龙江、山东。两批各自首页4次、首页锚点所指栏目页4次，预算均为`attempted/dispatched/rejected=8/8/0`；8次响应均HTTP 200。离线比对8份raw HTML的字节数和SHA-256均与manifest相同，8个栏目URL都能在对应保存首页DOM中找到同域“工作动态”锚点；每个栏目页有10条当前可见同域`.htm`候选，共80条。无详情请求、source配置、数据库、collector/extractor、附件、worker、模型或OCR。列表日与URL路径日期存在差异；这些页面只给出了有限栏目/列表结构证据，不表示详情日期/正文、分页、更新窗口、selector稳定性或source验收。

### 2026-10-05 第四批四局只读观察

[第四批报告](REGIONAL_BUREAU_BATCH4_2026-10-05.md)记录江苏、浙江、安徽、江西。独立QA离线核对三份manifest及全部raw：主页4/4与列表3/3加浙江补充1次，共8/8 dispatch、rejected 0；Undici 8.11.2事件24个（8 create、8 sendHeaders、8 headers），无error/callback error；8份raw大小及SHA-256均与manifest一致。江苏、安徽、江西首页都展示主内容“工作动态”锚点，各自栏目页各见10条唯一同域`.htm`链接，日期可见范围分别为8/14—9/30、9/15—9/30、9/04—9/30；未请求详情或分页。浙江首页无“工作动态”/“新闻动态”主内容标题，但“动态简讯”地址返回379字节HTTP 200 JS跳转包装，0个列表候选。Lead另核销的精确目标GET经独立报告与manifest/hash离线核验后返回“图片新闻”列表：9条唯一同域`.htm`，日期2023-12-28—2026-09-11，无PDF；没有详情，也没有目标栏目的全量覆盖证据。没有详情、配置、collector、数据库、worker、模型或OCR。上述只是有限首页/列表结构观察，不表示时间语义、正文、噪声、周期或来源验收；该批全部仍未配置，Gate 2仍`NOT_PASSED`。

### 2026-10-05 第五至九批及浙江监管工作栏目只读观察

[第五至九批报告](REGIONAL_BUREAU_BATCH5_2026-10-05.md)、[batch 6](REGIONAL_BUREAU_BATCH6_2026-10-05.md)、[batch 7](REGIONAL_BUREAU_BATCH7_2026-10-05.md)、[batch 8](REGIONAL_BUREAU_BATCH8_2026-10-05.md)、[batch 9](REGIONAL_BUREAU_BATCH9_2026-10-05.md)新增尝试河南、湖北、湖南、广东、广西、海南、重庆、四川、大连、宁波、青岛、深圳、贵州、云南、陕西、甘肃、青海、宁夏、新疆19局。QA独立核对五批目录名/href、HTTPS同host升级映射、事件预算、全部成功raw hash及主页栏目锚点链。总上限8/8/8/8/6；实际dispatch依次8、8、8、7、6，无拒绝。前四批共16页全部200；第八批3局首页与栏目成功200、甘肃首页超时且无栏目请求。19局中18局取得工作动态首屏列表，每页可见候选9–10条；没有请求详情、分页或附件。甘肃剩余额度未转移、不补请求。详见各owned报告；这只是一次时点入口/列表证据。

浙江另获批对保存首页直接观察的“监管工作”目标URL单GET：[QA报告](REGIONAL_BUREAU_ZHEJIANG_REGULATORY_COLUMN_2026-10-05.md)。cap=1，HTTP200、raw 12,644 bytes/hash独立核验；标题“监管工作”，9条唯一同域`.htm`候选，JS显示16页，1个PDF链接只见未请求。结合之前“图片新闻”窄页与JS包装页，当前可见目标栏目线索较清楚，但没有详情、后续页/历史和周期证据，仍不构成浙江来源通过。

### 2026-10-06 Batch6分页样本与S1边界

[Batch6 page2报告](BATCH6_PAGINATION_PROBE_2026-10-06.md)记录广西、海南、重庆、四川各1次从已保存列表脚本推导的`index_1.htm` direct GET，预算4/4/0、12个Undici事件、四页均200且精确URL。QA离线核验page1/page2 raw SHA与manifest，并核候选：每页10个唯一项、与page1没有URL重叠；6个显示日/URL日差异。各局页面显示日范围为广西08-11—09-07、海南08-17—09-08、重庆09-02—09-21、四川07-29—09-01。最老样本07-29，未覆盖2026-07-08这一截至10月6日的90日界限，未抓取后续页。海南缩写使用HQ（`hq.mof.gov.cn`），不与湖南HN混淆。

[S1分页范围审查](S1_WEB_LIST_PAGINATION_SCOPE_REVIEW_2026-10-06.md)批准的仅是阶段A离线/loopback受限分页能力实现，不包括真实来源请求或把现有19项来源接入。阶段A默认单页legacy路径保持；本批4个page2样本不说明来源日期排序或历史完整，不构成source pass或Gate 2通过。

### 2026-10-05 受限真实collector和四局详情样本（10月6日恢复QA）

北京真实collector/正文/幂等阶段见[北京验证报告](BEIJING_REAL_COLLECTOR_2026-10-05.md)。北京首轮11个response body SHA未捕获、继续标UNKNOWN；stage2一篇文章body pending→ok/revision1→2；repeat列表found10/created0/revised0。北京fresh库35 migrations，10个待处理extract jobs仍created、无worker，9篇pending，分析/receipt/publication/selection/job_runs均0。

福建与上海在各自fresh `_test`库、source disabled/fulltext false状态下各执行一次cap11真实collector。福建11/11/0、found/created/revised=10/10/0，显式extract样本原已body ok故0请求跳过，repeat list 1/1/0；最终9篇body ok、1篇pending、9 analyze+1 extract jobs created、业务记录0。上海11/11/0，found/created/revised=10/10/0，10篇body ok；样本extract同样0请求跳过。上海重复列表1次GET超时、fetch_run失败；partial停止、不重试，最终原10篇及revision/body/jobs不变。见[福建报告](FUJIAN_REAL_COLLECTOR_2026-10-05.md)、[上海报告](SHANGHAI_REAL_COLLECTOR_2026-10-05.md)与各自ignored SQL/JSON；两库均35 migrations、仅一条disabled source、无worker/模型/业务处理。以上是一次单页十候选受限观察，不证明分页/90日历史或跨周期。

Batch5四局首条详情见[四局详情报告](REGIONAL_BUREAU_BATCH5_DETAILS_2026-10-05.md)。QA独立核对4个saved raw hash/bytes、HTTP200 exact URL、cap4事件与列表标题/日期；河南和广东样本含财政监管业务内容，湖北与湖南样本是内部宣传/培训内容。该差异是逐篇内容边界样本，不是四局整体噪声率。

福建pending文章另获批一次cap1显式诊断：目标由SQL确认，精确GET HTTP200，runner记录wire bytes 4391及hash `9ef4fad6dfe3e82b130222e41ededf5917a0adcbe9e655d0ccd9c9c5dd14a9c2`；本次helper结果为`unconfirmed/non_article_container`，body仍空、revision1、title/date不变、无marker。离线响应中`.my_doccontent`只有16字符重复标题；附近PDF样式链接未请求。该结果不追认首轮无article ID warning。独立下游审计与Sol S4审查确认strict source的无marker unconfirmed行存在自动分析/精选可达路径；最小正文就绪保护正在实现、尚未回归。详见[FJ诊断](FUJIAN_PENDING_BODY_DIAGNOSTIC_2026-10-06.md)、[下游审计](FUJIAN_UNCONFIRMED_SELECTION_GUARD_AUDIT_2026-10-06.md)、[Sol范围](S4_ATTACHMENT_GUARD_SCOPE_REVIEW_2026-10-06.md)。

A另获批的batch6–9及浙江监管工作保存候选详情最多15条direct GET正在分批执行/QA；在每个owned报告、manifest、raw/hash都核验前，不提前改变各局矩阵状态。

当前source配置的代码树候选数为19（已提交SHA `a00795e...` 的15项+新增4个未提交disabled项）；fresh `fiscalhot_oct06_sources_final_test`完成35 migrations，Node24 `npm test` 252/252、typecheck、Web build、Web tests15/15和smoke28/28通过。前两次npm test shell尝试因`DATABASE_URL`在setup guard处被遗漏/误删而未连库，不是代码失败；只正确fresh `_test` URL的第三次运行计入252/252。CI仍仅覆盖已提交15源SHA/run；19源工作树未提交、未触发CI。preview仍3 disabled source/3篇body空样本、analyses/receipts/job_runs=0；API/Web监听127.0.0.1:3001/3000并沿用既有运行代码，本轮未改backend/apps且未重启服务。

北京真实collector/正文/幂等阶段见[北京验证报告](BEIJING_REAL_COLLECTOR_2026-10-05.md)：专用fresh `_test`库35 migrations、单个source保持disabled/fulltext关闭；首轮cap11抓1个列表+10个详情、found/created/revised=10/10/0。首轮response body SHA未捕获、保留UNKNOWN且未重请求。对一篇既有article ID获批显式extract cap1，HTTP200，runner记录7108 bytes与response hash；title/pubdate不变、body pending→ok、revision1→2/1696字符。再获批repeat list cap1，found/created/revised=10/0/0；所有10个extract job仍created，未运行worker，9篇保持pending/rev1，分析/receipt/publication/selected/ledger/job_runs为0。三个阶段只验证一次列表和一个正文，不证明90日全页覆盖、持续性或source pass。

## 2026-10-04 矩阵更新记录（前三批调查时点）

以下TASK/MODEL字段记录截至前三批调查后的历史矩阵更新，不覆盖上方2026-10-05更新的当前行状态与配置数。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

### 2026-10-05 福建、北京、上海短间隔栏目复查

获批的福建、北京、上海三个精确列表URL各GET一次，backend Undici 8.11.2 cap为3，实际`3/3/0`；三页HTTP 200，final URL匹配请求URL，无重定向/重试。实测起止为`2026-10-05T07:35:10.322Z`至`2026-10-05T07:35:12.362Z`（上海时间10月5日15:35），距10月4日栏目manifest `2026-10-03T23:13:00.189Z`相差116,530,133ms，即32小时22分10.133秒；两次上海本地时间分别为10月4日07:13和10月5日15:35。三个新HTML的大小与SHA-256各自完全等于10月4日保存响应；离线 `fromHtml` 比较亦为每局10/10候选留存、0进/0出、共同URL标题/列表日期变化0。详见[复查报告](REGIONAL_BUREAU_FOLLOWUP_2026-10-05.md)。这只是一对相隔32小时的内容快照，不是自动daily check运行、跨周期稳定性证据、详情/正文验收或source通过；35局覆盖和Gate 2状态不变。

**TASK**：依据本地财政部目录、已有来源材料与当前source配置建立逐局覆盖基线。

**MODEL**：Luna High；未调用项目模型。

**FILES_CHANGED**：本文表格和当前摘要增列8局有限首页/栏目观察并链接batch 2/3报告；未改source配置、业务代码或数据库。

**TESTS_RUN**：离线逐份比对batch 2/3的homes/columns manifest、预算、响应状态、保存HTML字节数及SHA-256、首页锚点和栏目候选数；不运行软件测试、不联网、不操作数据库。

**RESULT**：按官方目录页证据列出35个财政部监管局（18+17）；仅厦门有独立地方栏目source配置。至2026-10-04，福建/北京/上海有有限首页、列表与单篇详情观察；另8局有有限首页与栏目列表观察但无详情；这些都未配置或验收。中央选登与35域名allowlist均未计作逐局覆盖。

**RISKS**：目录官方域名不证明新闻栏目可抓取；一次列表观察不能证明栏目稳定、全量覆盖、正文业务质量或适用日期；中央选登是有限选取窗口。用户确认覆盖范围，不等于接受栏目质量或覆盖完成。

**BLOCKERS**：35局逐局来源验收仍未完成；批次入口与单篇真实collector不足以证明栏目完整性、分页/历史窗口和跨周期行为。上海重复列表遇超时而partial停止；北京首轮响应hash仍unknown。正文业务性样本显示同栏含内部消息，筛选质量仍需更广样本。Gate 2仍为`NOT_PASSED`。

**NEXT**：后续经Lead逐项核销小批官方栏目观察；先取真实DOM与一篇配对详情，证据审阅后再更新矩阵，配置与采集授权另行审查。


### 2026-10-06 首篇详情补充及S4边界

获批的新增15次详情GET（Batch6 4、Batch7 4、Batch8 3、Batch9 3、浙江1）经独立离线核验：attempted/dispatched/rejected=15/15/0；Undici create/sendHeaders/headers/error=15/15/14/1；14份成功HTML raw的byte length与SHA-256逐份匹配manifest。唯一失败是青岛单次20秒timeout，无raw、不重试、不换候选。报告链接：[Batch6](REGIONAL_BUREAU_BATCH6_DETAILS_2026-10-06.md)、[Batch7](REGIONAL_BUREAU_BATCH7_DETAILS_2026-10-06.md)、[Batch8](REGIONAL_BUREAU_BATCH8_DETAILS_2026-10-06.md)、[Batch9](REGIONAL_BUREAU_BATCH9_DETAILS_2026-10-06.md)、[浙江首篇](ZHEJIANG_REGULATORY_FIRST_DETAIL_2026-10-06.md)。

单篇样本中，广西、云南、宁夏、新疆显示具体财政监管业务；大连、宁波、深圳、海南、重庆、四川、贵州、陕西、青海样本主要是内部组织活动/学习，不能据此推断全栏噪声率。云南列表日/URL日为9/18、详情PubDate/可见日为9/24；新疆列表日/PubDate/可见日为9/24、URL路径日为7/17；均未裁定权威日期。浙江监管工作列表首条详情标题一致，PubDate/可见日期/URL日同为9/30，正文666字符/4段；它只提供一个业务内容样本。

福建隔离库唯一pending文章cap1诊断结果为unconfirmed/non_article_container，body空/revision1/marker false；body selector只有16字重复标题，selector外PDF链接未请求。离线下游审计发现该状态有自动分析/精选可达路径。Sol审查为CHANGES_REQUIRED / APPROVED_SCOPE，已批准最小source-specific严格正文就绪保护，正在实现，尚无修复后回归。见[FJ诊断](FUJIAN_PENDING_BODY_DIAGNOSTIC_2026-10-06.md)、[下游审计](FUJIAN_UNCONFIRMED_SELECTION_GUARD_AUDIT_2026-10-06.md)和[Sol范围](S4_ATTACHMENT_GUARD_SCOPE_REVIEW_2026-10-06.md)。

截至2026-10-06的source工作树记录为19项（当时已提交代码SHA a00795e仍为15项）；相关252/252软件套件是S4修复前历史baseline。该数量由下方2026-10-07增量的四个disabled source更新为23项；不代表已导入正式库、source admission或Gate 2通过。
