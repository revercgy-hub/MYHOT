// 财政金融行业分类、标签、机构名录和身份词典。
// 分类 key 会出现在网址和接口中；topics.json 的 slug 也会对外使用，上线后应保持稳定。

/** 网页筛选类别与日报分节。未归类资料回退到 fiscal-policy。 */
export const CATEGORIES = [
  { key: "fiscal-policy", label: "财政政策", section: "财政政策与预算", guide: "财政收支、中央和地方预算、转移支付、税费政策、政府采购、预算绩效、零基预算、财政体制与财政科学管理" },
  { key: "government-debt", label: "政府债务", section: "政府债务与专项债", guide: "地方政府债务、专项债、一般债、再融资债、置换债、化债、隐性债务、融资平台、存量债务、债务监测风险及专项债项目和偿还" },
  { key: "fiscal-finance", label: "财政金融", section: "财政金融协同", guide: "财政贴息、政府性融资担保、普惠金融、政策性金融、政府投资基金、产业基金、创业投资、财政金融联动、PPP、REITs、盘活存量资产与国有金融资本" },
  { key: "financial-regulation", label: "金融监管", section: "金融监管与风险", guide: "银行、保险和证券监管，金融机构处罚，资本监管、拨备、不良资产、风险处置、中小金融机构风险、金融稳定与监管规则" },
  { key: "monetary-finance", label: "货币金融", section: "货币与金融运行", guide: "货币政策、公开市场操作、MLF、LPR、准备金、利率、汇率、信贷、社会融资规模、M1、M2、宏观审慎、跨境资金流动与金融运行" },
  { key: "accounting-supervision", label: "财会监督", section: "财会监督与会计", guide: "财会、财政和会计监督，企业会计准则、政府会计、注册会计师、内部控制、金融企业财务、资产评估、会计信息质量与审计整改" },
  { key: "local-practice", label: "地方实践", section: "福建厦门与地方实践", guide: "福建、厦门以及全国具有较强参考价值的财政金融改革、管理和监管实践" },
  { key: "research", label: "研究观察", section: "政策研究与实践", guide: "权威政策解读、宏观财政金融研究、财政货币协调、地方财政、债务与金融风险研究及可复制改革经验" },
] as const;

/** 与内容理解和评分提示词中的权重表同步维护。 */
export const ITEM_TYPES = [
  "policy_release", "regulatory_rule", "fiscal_data", "financial_data",
  "debt_event", "regulatory_action", "local_practice", "research_analysis",
] as const;

/** 每篇资料的第一个标签必须是分类标签之一。 */
export const CATEGORY_TAGS = [
  "政策发布", "制度规则", "财政数据", "金融数据", "政府债务", "财政金融", "监管动态",
  "监管处罚", "风险事件", "财会监督", "地方实践", "政策解读", "研究报告", "其他",
] as const;

/** 主题词覆盖财政预算、债务、协同、货币金融、监管、财会和地方实践。 */
export const TOPIC_TAGS = [
  "财政收支", "预算管理", "转移支付", "财政体制", "零基预算", "预算绩效", "税费政策", "政府采购", "政府投资",
  "专项债", "一般债", "再融资债", "化债", "隐性债务", "融资平台", "债务风险", "专项债资产",
  "财政贴息", "政府性融资担保", "普惠金融", "政府投资基金", "PPP", "REITs", "国有金融资本",
  "货币政策", "公开市场", "LPR", "信贷", "社融", "利率", "汇率", "宏观审慎",
  "银行监管", "保险监管", "资本市场监管", "外汇管理", "金融风险", "不良资产", "拨备", "风险处置",
  "财会监督", "会计准则", "内部控制", "注册会计师", "金融企业财务",
  "福建", "厦门", "地方财政", "数字财政", "智能监管",
] as const;

/** 机构标签可用于卡片展示；主体 id 用于结构化 subjects 和机构主题页。 */
export const ENTITY_TAGS = [
  "国务院", "财政部", "财政部预算司", "财政部金融司", "财政部会计司", "财政部监督评价局",
  "中国人民银行", "国家金融监督管理总局", "中国证监会", "国家外汇管理局", "审计署", "国家发展改革委", "国家统计局", "国家税务总局",
  "福建省财政厅", "厦门市财政局", "人民银行厦门市分行", "国家金融监督管理总局厦门监管局", "厦门证监局", "外汇局厦门市分局",
] as const;

/** 模型输出的历史或常见近义写法归并到词表里的标准标签。 */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  财政: "财政收支", 预算: "预算管理", 转移支付: "转移支付", 专项债券: "专项债", 地方政府专项债券: "专项债",
  一般债券: "一般债", 再融资债券: "再融资债", 债务化解: "化债", 隐性债务化解: "化债",
  融资担保: "政府性融资担保", 政府担保: "政府性融资担保", 政府基金: "政府投资基金",
  公开市场操作: "公开市场", 社会融资规模: "社融", 资本市场: "资本市场监管", 证券监管: "资本市场监管",
  外汇: "外汇管理", 会计: "会计准则", 内控: "内部控制", 注册会计师行业: "注册会计师",
  福建省: "福建", 厦门市: "厦门", 地方: "地方财政", 政策研究: "研究报告", 权威解读: "政策解读",
};

/** 缺少分类标签时，根据内容类型提供对应的第一个分类标签。 */
export const CATEGORY_BY_ITEM_TYPE: Readonly<Record<string, string>> = {
  policy_release: "政策发布",
  regulatory_rule: "制度规则",
  fiscal_data: "财政数据",
  financial_data: "金融数据",
  debt_event: "政府债务",
  regulatory_action: "监管处罚",
  local_practice: "地方实践",
  research_analysis: "研究报告",
};

/** 机构 id 用于结构化 subjects 与主题归类；别名只列明确指向该机构的写法。 */
export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[] }> = {
  "state-council": { name: "国务院", displayTag: "国务院", aliases: ["国务院", "中国国务院"] },
  mof: { name: "财政部", displayTag: "财政部", aliases: ["财政部", "中华人民共和国财政部", "MOF"] },
  "mof-budget": { name: "财政部预算司", displayTag: "财政部预算司", aliases: ["财政部预算司", "预算司"] },
  "mof-finance": { name: "财政部金融司", displayTag: "财政部金融司", aliases: ["财政部金融司", "金融司"] },
  "mof-accounting": { name: "财政部会计司", displayTag: "财政部会计司", aliases: ["财政部会计司", "会计司"] },
  "mof-supervision": { name: "财政部监督评价局", displayTag: "财政部监督评价局", aliases: ["财政部监督评价局", "监督评价局"] },
  pboc: { name: "中国人民银行", displayTag: "中国人民银行", aliases: ["中国人民银行", "人民银行", "央行", "PBOC"] },
  nfsa: { name: "国家金融监督管理总局", displayTag: "国家金融监督管理总局", aliases: ["国家金融监督管理总局", "金融监管总局", "金监总局", "NFRA"] },
  csrc: { name: "中国证监会", displayTag: "中国证监会", aliases: ["中国证监会", "证监会", "CSRC"] },
  safe: { name: "国家外汇管理局", displayTag: "国家外汇管理局", aliases: ["国家外汇管理局", "外汇局", "SAFE"] },
  "audit-office": { name: "审计署", displayTag: "审计署", aliases: ["审计署", "中华人民共和国审计署"] },
  ndrc: { name: "国家发展改革委", displayTag: "国家发展改革委", aliases: ["国家发展改革委", "国家发改委", "发改委", "NDRC"] },
  stats: { name: "国家统计局", displayTag: "国家统计局", aliases: ["国家统计局", "统计局"] },
  taxation: { name: "国家税务总局", displayTag: "国家税务总局", aliases: ["国家税务总局", "税务总局"] },
  "fujian-finance": { name: "福建省财政厅", displayTag: "福建省财政厅", aliases: ["福建省财政厅", "福建财政厅", "福建财政"] },
  "xiamen-finance": { name: "厦门市财政局", displayTag: "厦门市财政局", aliases: ["厦门市财政局", "厦门财政局", "厦门财政"] },
  "pboc-xiamen": { name: "中国人民银行厦门市分行", displayTag: "人民银行厦门市分行", aliases: ["中国人民银行厦门市分行", "人民银行厦门市分行", "人民银行厦门分行", "人行厦门市分行"] },
  "nfsa-xiamen": { name: "国家金融监督管理总局厦门监管局", displayTag: "国家金融监督管理总局厦门监管局", aliases: ["国家金融监督管理总局厦门监管局", "金融监管总局厦门监管局", "厦门金融监管局"] },
  "csrc-xiamen": { name: "厦门证监局", displayTag: "厦门证监局", aliases: ["厦门证监局", "中国证监会厦门监管局"] },
  "safe-xiamen": { name: "国家外汇管理局厦门市分局", displayTag: "外汇局厦门市分局", aliases: ["国家外汇管理局厦门市分局", "外汇局厦门市分局", "厦门外汇局"] },
};

/** 仅在标题、正文或明确发布域中识别到的机构，才允许出现在生成标题和摘要里。 */
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "state-council", name: "国务院", patterns: [/国务院|中国国务院/] },
  { id: "mof", name: "财政部", patterns: [/财政部|中华人民共和国财政部|\bMOF\b/i] },
  { id: "mof-budget", name: "财政部预算司", patterns: [/财政部预算司|财政部预算管理司/] },
  { id: "mof-finance", name: "财政部金融司", patterns: [/财政部金融司/] },
  { id: "mof-accounting", name: "财政部会计司", patterns: [/财政部会计司/] },
  { id: "mof-supervision", name: "财政部监督评价局", patterns: [/财政部监督评价局/] },
  { id: "pboc", name: "中国人民银行", patterns: [/中国人民银行|人民银行|央行|\bPBOC\b/i] },
  { id: "nfsa", name: "国家金融监督管理总局", patterns: [/国家金融监督管理总局|金融监管总局|金监总局|\bNFRA\b/i] },
  { id: "csrc", name: "中国证监会", patterns: [/中国证监会|证监会|\bCSRC\b/i] },
  { id: "safe", name: "国家外汇管理局", patterns: [/国家外汇管理局|外汇局|\bSAFE\b/i] },
  { id: "audit-office", name: "审计署", patterns: [/审计署|中华人民共和国审计署/] },
  { id: "ndrc", name: "国家发展改革委", patterns: [/国家发展改革委|国家发改委|发改委|\bNDRC\b/i] },
  { id: "stats", name: "国家统计局", patterns: [/国家统计局|统计局/] },
  { id: "taxation", name: "国家税务总局", patterns: [/国家税务总局|税务总局/] },
  { id: "fujian-finance", name: "福建省财政厅", patterns: [/福建省财政厅|福建财政厅|福建财政/] },
  { id: "xiamen-finance", name: "厦门市财政局", patterns: [/厦门市财政局|厦门财政局|厦门财政/] },
  { id: "pboc-xiamen", name: "人民银行厦门市分行", patterns: [/中国人民银行厦门市分行|人民银行厦门(?:市)?分行|人行厦门市分行/] },
  { id: "nfsa-xiamen", name: "金融监管总局厦门监管局", patterns: [/国家金融监督管理总局厦门监管局|金融监管总局厦门监管局|厦门金融监管局/] },
  { id: "csrc-xiamen", name: "厦门证监局", patterns: [/厦门证监局|中国证监会厦门监管局/] },
  { id: "safe-xiamen", name: "外汇局厦门市分局", patterns: [/国家外汇管理局厦门市分局|外汇局厦门市分局|厦门外汇局/] },
];

/** 只列本轮已直连并核验页面结构的官方域名；完成核验后再增补。 */
export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "mof-budget", domains: ["yss.mof.gov.cn"] },
  { entityId: "mof", domains: ["zhs.mof.gov.cn"] },
  { entityId: "mof-finance", domains: ["jrs.mof.gov.cn"] },
  { entityId: "mof-accounting", domains: ["kjs.mof.gov.cn"] },
  { entityId: "mof", domains: ["zwgls.mof.gov.cn"] },
  { entityId: "fujian-finance", domains: ["czt.fujian.gov.cn"] },
  { entityId: "xiamen-finance", domains: ["cz.xm.gov.cn"] },
  { entityId: "pboc-xiamen", domains: ["xiamen.pbc.gov.cn"] },
  { entityId: "pboc", domains: ["www.pbc.gov.cn"] },
  { entityId: "mof", domains: ["mof.gov.cn"] },
];

export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [];
