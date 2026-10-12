// Seed fixed, verified editorial summaries into the isolated local preview database.
// Run only with LOCAL_PREVIEW_ENABLED=true and the exact preview DB; this script never fetches,
// enqueues collection/model jobs, or stores source article bodies.
import { assertLocalPreviewIds, prepareLocalPreviewSeedEnvironment } from "./lib/local-preview-safety.ts";
import { resolveLocalPreviewEnabled } from "../apps/web/app/lib/local-preview.server.ts";
import { isDeepStrictEqual } from "node:util";

const safe = prepareLocalPreviewSeedEnvironment(process.env);
if (!resolveLocalPreviewEnabled(process.env) || process.env.SITE_URL !== "http://127.0.0.1:3000"
  || process.env.API_BASE_URL !== "http://127.0.0.1:3001" || process.env.WEB_HOST !== "127.0.0.1") {
  throw new Error("local preview seed requires LOCAL_PREVIEW_ENABLED=true and SITE_URL=http://127.0.0.1:3000");
}

const { sql, closeDb } = await import("@aihot/backend/db");
const { identityKeyFor, upsertMaterial } = await import("@aihot/backend/content/materials");
const { publishArticleTx } = await import("@aihot/backend/publication/publish");

const previewActor = "local-preview-seed";
const samples = [
  {
    id: "local-preview-pboc-omo-191",
    source: { id: "local-preview-pboc", name: "中国人民银行" },
    title: "公开市场业务交易公告 [2026]第191号",
    publishedAt: new Date("2026-09-29T00:00:00+08:00"),
    url: "https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/2026092908461628271/index.html",
    category: "monetary-finance",
    tags: ["公开市场", "利率", "货币政策"],
    summary: "【开发预览·人工摘要；未经模型精选】公开市场业务公告列出7天期逆回购利率1.40%，投标量和中标量各905亿元；原文写明：“同时，开展了6985亿元隔夜逆回购操作。”详情以原公告为准。",
  },
  {
    id: "local-preview-mof-budget-qa",
    source: { id: "local-preview-mof-budget", name: "财政部预算司" },
    title: "财政部有关负责人就2026年中央预算公开答记者问",
    publishedAt: new Date("2026-03-26T00:00:00+08:00"),
    url: "https://yss.mof.gov.cn/gongzuodongtai/202603/t20260326_3986132.htm",
    category: "fiscal-policy",
    tags: ["预算管理", "中央预算", "政策解读"],
    summary: "【开发预览·人工摘要；未经模型精选】财政部有关负责人围绕2026年中央预算公开回应媒体提问，具体内容与数据见官方答记者问。",
  },
  {
    id: "local-preview-pboc-xiamen-payment",
    source: { id: "local-preview-pboc-xiamen", name: "人民银行厦门市分行" },
    title: "人民银行厦门市分行：支付护航投洽会 便利服务迎嘉宾",
    publishedAt: new Date("2026-09-14T00:00:00+08:00"),
    url: "https://xiamen.pbc.gov.cn/xiamen/127699/2026091714532820798/index.html",
    category: "local-practice",
    tags: ["厦门"],
    summary: "【开发预览·人工摘要；未经模型精选】人民银行厦门市分行介绍投洽会期间支付便利服务，具体安排见官方原文。",
  },
  {
    id: "local-preview-pboc-omo-192",
    source: { id: "local-preview-pboc-omo-192-source", name: "中国人民银行" },
    originalSourceId: "pboc-open-market",
    title: "公开市场业务交易公告 [2026]第192号",
    publishedAt: new Date("2026-09-30T00:00:00+08:00"),
    url: "https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/2026093008493852899/index.html",
    category: "monetary-finance",
    tags: ["金融数据", "公开市场", "中国人民银行"],
    summary: "【开发预览·Luna辅助摘要；未经正式模型精选】根据公开市场业务一级交易商需求，2026年9月30日7天期逆回购操作量为零；人民银行同时开展8335亿元隔夜逆回购操作。",
    luna: {
      inputArtifactSha256: "d7d872208e029dda9108c684a183b148e57da18f825d9dd26677efe6821e585c",
      articleContentHash: "a1bcfc5973a0fba355317c42893e3ba5cb2f9934327943509700b2027313adaa",
      officialBodySha256: "599c4c9affa6edfb28b8c5a59994fa211cbe1fb9b77d94eac493fbf952a5b8d0",
      inputRecordId: "p4prep_omo192_20261008",
    },
  },
  {
    id: "local-preview-mof-debt-202608",
    source: { id: "local-preview-mof-debt-202608-source", name: "财政部国库司" },
    originalSourceId: "mof-treasury-debt-data",
    title: "2026年8月地方政府债券发行和债务余额情况",
    publishedAt: new Date("2026-09-24T00:00:00+08:00"),
    url: "https://zwgls.mof.gov.cn/tjsj/202609/t20260924_3998108.htm",
    category: "government-debt",
    tags: ["财政数据", "政府债务", "再融资债", "财政部"],
    summary: "【开发预览·Luna辅助摘要；未经正式模型精选】财政部披露，2026年8月全国发行地方政府债券11945亿元，1—8月发行合计78034亿元；截至8月末地方政府债务余额598955亿元。8月发行平均利率为1.83%，1—8月到期偿还本金27311亿元、支付利息10594亿元。",
    luna: {
      inputArtifactSha256: "d7d872208e029dda9108c684a183b148e57da18f825d9dd26677efe6821e585c",
      articleContentHash: "88017464a38e35078e6b4ef1843255a1f50a63952d685aa354489cee76700c11",
      officialBodySha256: "23bfafada31d74d8fff225a99d068922417af476b5616571d8dd4fe8e7728183",
      inputRecordId: "p4prep_treasury_20261008",
    },
  },
  {
    id: "local-preview-mof-xiamen-capital-review",
    source: { id: "local-preview-mof-xiamen-capital-review-source", name: "财政部厦门监管局" },
    originalSourceId: "mof-xiamen-supervision-dynamics",
    title: "财政部厦门监管局：扎实开展中央企业国有资本收益审核工作",
    publishedAt: new Date("2026-09-24T00:00:00+08:00"),
    url: "https://xm.mof.gov.cn/caizhengjiancha/202609/t20260924_3998128.htm",
    category: "local-practice",
    tags: ["地方实践", "厦门", "财政部"],
    summary: "【开发预览·Luna辅助摘要；未经正式模型精选】厦门监管局介绍，2026年中央企业国有资本收益审核中，指导企业规范填报申报表并提交佐证材料，重点核对合并净利润、以前年度损益调整、亏损弥补和利润分配，对疑点事项开展延伸核查。",
    luna: {
      inputArtifactSha256: "d7d872208e029dda9108c684a183b148e57da18f825d9dd26677efe6821e585c",
      articleContentHash: "7ba26b30b4a826bc2646ed75c020db8c43d2796c587a7d681b2cefd97e7b2a2b",
      officialBodySha256: "118df61e3573d20911a10abe3b13196d4ae3c45283e57c20ba06bc1ff5b1fe9c",
      inputRecordId: "tlssno3ict5uydo34hfjo23tx",
    },
  },
  {
    id: "local-preview-mof-zhejiang-real-funds",
    source: { id: "local-preview-mof-zhejiang-real-funds-source", name: "财政部浙江监管局" },
    originalSourceId: "mof-zhejiang-supervision-dynamics",
    title: "财政部浙江监管局：以扩围为契机 构建中央预算单位实有资金全链条监控新格局",
    publishedAt: new Date("2026-07-21T00:00:00+08:00"),
    url: "https://zj.mof.gov.cn/caizhengjiancha/202607/t20260707_3993052.htm",
    category: "local-practice",
    tags: ["地方实践", "预算管理", "智能监管"],
    summary: "【开发预览·编辑摘要；未经正式模型精选】浙江监管局以扩围为契机，将新增中央预算单位纳入实有资金动态监控；通过银行账户年检核准账户信息，结合机器筛查、人工核查及账户、内控和预算审核协同，覆盖资金监管全流程。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-07-21",
      pubDateLocal: "2026-07-21",
      visibleDateLocal: "2026-07-21",
      responseBytes: 17928,
      responseSha256: "f193ebdf351bd587b624a29c3920edcbb8c7e8db5e949f00e75dd8ce1ce890d3",
      extractedBodyChars: 1264,
      extractedBodyTextSha256: "b8c48e8ace7746a03a98d7e7250b4d0db962ba0d7611c523a0164046d48793f1",
    },
  },
  {
    id: "local-preview-mof-zhejiang-transfer-performance",
    source: { id: "local-preview-mof-zhejiang-transfer-performance-source", name: "财政部浙江监管局" },
    originalSourceId: "mof-zhejiang-supervision-dynamics",
    title: "财政部浙江监管局：突出重点 扎实开展中央对地方转移支付绩效自评抽查复核工作",
    publishedAt: new Date("2026-07-29T00:00:00+08:00"),
    url: "https://zj.mof.gov.cn/caizhengjiancha/202607/t20260723_3994178.htm",
    category: "fiscal-policy",
    tags: ["地方实践", "转移支付", "预算绩效"],
    summary: "【开发预览·编辑摘要；未经正式模型精选】浙江监管局对全省中央转移支付绩效自评开展书面复核，并赴项目现场核查资金分配、实施内容和绩效产出；针对发现的问题提出整改要求，反馈主管部门并推动后续年度改进。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-07-29",
      pubDateLocal: "2026-07-29",
      visibleDateLocal: "2026-07-29",
      responseBytes: 18328,
      responseSha256: "56f6847c2579ca240ed180c8f981e6bdb02df05395d319f0b553dd42d2b06917",
      extractedBodyChars: 1390,
      extractedBodyTextSha256: "82689ef56b910111bd749e05101f592d1b3dcdfb6713ee22b01099d4a91b2464",
    },
  },
  {
    id: "local-preview-mof-zhejiang-fiscal-supervision-202608",
    source: { id: "local-preview-mof-zhejiang-fiscal-supervision-202608-source", name: "财政部浙江监管局" },
    originalSourceId: "mof-zhejiang-supervision-dynamics",
    title: "财政部浙江监管局：加大财政监管力度 坚定扛好守土尽责的政治担当",
    publishedAt: new Date("2026-08-11T00:00:00+08:00"),
    url: "https://zj.mof.gov.cn/caizhengjiancha/202608/t20260804_3994854.htm",
    category: "local-practice",
    tags: ["地方实践", "政府债务", "预算绩效", "金融风险"],
    summary: "【开发预览·编辑摘要；未经正式模型精选】浙江监管局报告对百余个超长期特别国债项目开展现场核查，转移支付监管发现并督改72个问题；对4项转移支付资金开展绩效自评抽查、深入9地现场复核并督改139个问题。另对40家在浙央属金融企业开展呆账核销备案全覆盖监管，并探索加强资产评估机构检查。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-08-11",
      pubDateLocal: "2026-08-11",
      visibleDateLocal: "2026-08-11",
      responseBytes: 24425,
      responseSha256: "f09c49b26bc8fdff80da29cb65926fcb949cae10462c69bc6c980e049ca3942e",
      extractedBodyChars: 3378,
      extractedBodyTextSha256: "cf5d5554935c9d78f51bb1e45e8876e8ce3e7c25f1204c200ce8c7084d583ac7",
    },
  },
  {
    id: "local-preview-pboc-omo-189",
    source: { id: "local-preview-pboc-omo-189-source", name: "中国人民银行" },
    originalSourceId: "pboc-open-market",
    title: "公开市场业务交易公告 [2026]第189号",
    publishedAt: new Date("2026-09-24T00:00:00+08:00"),
    url: "https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/2026092408454713496/index.html",
    category: "monetary-finance",
    tags: ["公开市场", "利率", "货币政策"],
    summary: "【开发预览·编辑辅助摘要；未经正式模型精选】人民银行9月24日以固定利率、数量招标开展515亿元7天期逆回购，操作利率为1.40%，并全额满足一级交易商需求。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-09-24",
      pubDateLocal: "2026-09-24",
      visibleDateLocal: "2026-09-24",
      responseBytes: 9594,
      responseSha256: "ad5c1959692a0575a21519abfd2194ea62fa97fcac13559697bb7c6dc2c67514",
      extractedBodyChars: 150,
      extractedBodyTextSha256: "11243faa365d5a939c3d5298e8f991d882d85d98bb0cd06b8d2a52b969e38128",
    },
  },
  {
    id: "local-preview-mof-debt-202607",
    source: { id: "local-preview-mof-debt-202607-source", name: "财政部国库司" },
    originalSourceId: "mof-treasury-debt-data",
    title: "2026年7月地方政府债券发行和债务余额情况",
    publishedAt: new Date("2026-09-09T00:00:00+08:00"),
    url: "https://zwgls.mof.gov.cn/tjsj/202609/t20260909_3997013.htm",
    category: "government-debt",
    tags: ["财政数据", "政府债务", "再融资债"],
    summary: "【开发预览·编辑辅助摘要；未经正式模型精选】财政部披露，2026年7月地方政府债券发行7383亿元，其中新增债券4041亿元、再融资债券3342亿元；1—7月发行合计66089亿元。报告还列出平均发行期限、利率及到期偿本情况。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-09-09",
      pubDateLocal: "2026-09-09",
      visibleDateLocal: "2026-09-09",
      responseBytes: 5669,
      responseSha256: "eb80fc868fcb01b53eeeaa8ede68f3bb7958114a05f033c1e3b8efd83448a25a",
      extractedBodyChars: 1028,
      extractedBodyTextSha256: "e787922976dc61236ba40ca9f6dd83894e2a7d1046a19efdcbf75a3ef3b8d563",
    },
  },
  {
    id: "local-preview-mof-xiamen-inclusive-finance",
    source: { id: "local-preview-mof-xiamen-inclusive-finance-source", name: "财政部厦门监管局" },
    originalSourceId: "mof-xiamen-supervision-dynamics",
    title: "厦门监管局：强化财金协同 深化精准监管 助力普惠金融高质量发展",
    publishedAt: new Date("2026-09-24T00:00:00+08:00"),
    url: "https://xm.mof.gov.cn/caizhengjiancha/202609/t20260920_3997811.htm",
    category: "fiscal-finance",
    tags: ["普惠金融", "财政贴息", "厦门"],
    summary: "【开发预览·编辑辅助摘要；未经正式模型精选】厦门监管局介绍将普惠金融政策落实情况纳入财政金融运行分析、转移支付监管、贷款贴息审核和调研，关注小微经营主体贷款覆盖、成本及期限；并推动财政、金融部门共享指标、跟踪贴息等政策落地。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-09-24",
      pubDateLocal: "2026-09-24",
      visibleDateLocal: "2026-09-24",
      responseBytes: 7289,
      responseSha256: "bb70d498978e695e147a785c00290f35a7154540d2de987516611af81a9d2f98",
      extractedBodyChars: 1935,
      extractedBodyTextSha256: "fce18a043f7159dc4a03bf80553906e628a612022d93985b8214760f4b905f24",
    },
  },
  {
    id: "local-preview-mof-fujian-vat-refund-review",
    source: { id: "local-preview-mof-fujian-vat-refund-review-source", name: "财政部福建监管局" },
    originalSourceId: "mof-fujian-supervision-dynamics",
    title: "财政部福建监管局：“三强化”提升资源综合利用增值税即征即退政策复查工作质量",
    publishedAt: new Date("2026-09-22T00:00:00+08:00"),
    url: "https://fj.mof.gov.cn/gzdt/caizhengjiancha/202608/t20260828_3996275.htm",
    category: "local-practice",
    tags: ["地方实践", "税费政策", "福建"],
    summary: "【开发预览·编辑辅助摘要；未经正式模型精选】福建监管局介绍其对资源综合利用增值税即征即退开展政策复查，围绕适用对象、行业资质、资源掺兑标准、退税比例和环保条件组织政策研学，并以典型案例练兵、统一资料审核标准提升风险识别，防范违规退税。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-09-22",
      pubDateLocal: "2026-09-22",
      visibleDateLocal: "2026-09-22",
      responseBytes: 7129,
      responseSha256: "24a986f0b04552072b0c3b1b38fca92d017c55fde4b7b19b40af852d07a0bda0",
      extractedBodyChars: 1659,
      extractedBodyTextSha256: "8293e165f849d4f7882ff519cbab2397ae269d59a14e8ccc2dbc0f37cceb6e09",
    },
  },
  {
    id: "local-preview-mof-zhejiang-cpa-law",
    source: { id: "local-preview-mof-zhejiang-cpa-law-source", name: "财政部浙江监管局" },
    originalSourceId: "mof-zhejiang-supervision-dynamics",
    title: "浙江监管局：关于新注册会计师法下加强注册会计师行业监管的思考",
    publishedAt: new Date("2026-10-10T00:00:00+08:00"),
    url: "https://zj.mof.gov.cn/caizhengjiancha/202610/t20261010_4002535.htm",
    category: "accounting-supervision",
    tags: ["财会监督", "注册会计师", "监管动态"],
    summary: "【开发预览·编辑辅助摘要；未经正式模型精选】浙江监管局围绕将于2027年1月1日起施行的新《注册会计师法》，梳理财政部门监督指导、执业检查、监管谈话、警示函和责令整改等监管工具，并讨论当前审计质量与监管实践中的问题及后续思路。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-10-10",
      pubDateLocal: "2026-10-10",
      visibleDateLocal: "2026-10-10",
      responseBytes: 7332,
      responseSha256: "661a3f4aba18da675aeb393aed6dc4f330625295d889741f0817aa737eab2cbb",
      extractedBodyChars: 1717,
      extractedBodyTextSha256: "6787c090a95db753ac90784280540308f311bf3defebdec716f4298f6ef88914",
    },
  },
  {
    id: "local-preview-mof-lottery-funds-rules",
    source: { id: "local-preview-mof-lottery-funds-rules-source", name: "财政部综合司" },
    originalSourceId: "mof-policy-release",
    title: "财政部关于印发《彩票市场调控资金管理办法》的通知",
    publishedAt: new Date("2026-08-14T00:00:00+08:00"),
    url: "https://zhs.mof.gov.cn/zhengcefabu/202608/t20260814_3995456.htm",
    category: "fiscal-policy",
    tags: ["政策发布", "转移支付", "预算绩效"],
    summary: "【开发预览·编辑辅助摘要；未经正式模型精选】财政部修订彩票市场调控资金管理办法，明确资金来源于彩票发行机构业务费上缴中央财政，并通过中央对地方转移支付分配；办法划分财政部、发行机构、省级财政部门和销售机构的预算申报、分配、监管与绩效管理职责。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-08-14",
      pubDateLocal: "2026-08-14",
      visibleDateLocal: "2026-08-14",
      responseBytes: 10679,
      responseSha256: "ff8fe6af6c5b4dab5be24ec13d8e96b1c9abc98a7f3aea58b4bf7e6a50e7928e",
      extractedBodyChars: 4563,
      extractedBodyTextSha256: "01f906facfbda4f68e64e8374940d84653c991fc9ea7d81f7eb12dfe088985bb",
    },
  },
  {
    id: "local-preview-mof-guangxi-accounting-checks",
    source: { id: "local-preview-mof-guangxi-accounting-checks-source", name: "财政部广西监管局" },
    originalSourceId: "mof-guangxi-supervision-dynamics",
    title: "广西监管局：三维聚力推动会计监督检查提质增效",
    publishedAt: new Date("2026-09-29T00:00:00+08:00"),
    url: "https://gx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260929_3998321.htm",
    category: "accounting-supervision",
    tags: ["会计监督", "检查整改", "地方实践"],
    summary: "【开发预览·编辑摘要；未经正式模型精选】广西监管局通过数据筛查与现场延伸相结合，检查事务所及企业会计信息，重点核查收入确认、资产减值、金融工具及商誉等事项，并推进协同整改。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-09-29",
      pubDateLocal: "2026-09-29",
      visibleDateLocal: "2026-09-29",
      responseBytes: 7394,
      responseSha256: "c3fd8ed50257fe214485438dcd5f57065f52ebe4f64a28a426c490f1fd12bf20",
      responseArtifact: ".data/fiscal-qa/regional-bulk-20261012/evidence/responses/dispatch-003.body",
      extractedBodyChars: 1759,
      extractedBodyTextSha256: "1fbf255ecb92c7890239219f125f27f848d3caa9c556ab823c05f5f03b2e2620",
    },
  },
  {
    id: "local-preview-mof-hainan-fiscal-management",
    source: { id: "local-preview-mof-hainan-fiscal-management-source", name: "财政部海南监管局" },
    originalSourceId: "mof-hainan-supervision-dynamics",
    title: "财政部海南监管局：“五个注重”扎实推进财政科学管理",
    publishedAt: new Date("2026-10-12T00:00:00+08:00"),
    url: "https://hq.mof.gov.cn/caizhengjiancha/202610/t20261012_4002621.htm",
    category: "fiscal-policy",
    tags: ["预算管理", "转移支付", "地方实践"],
    summary: "【开发预览·编辑摘要；未经正式模型精选】海南监管局推进财政科学管理，工作覆盖36家中央预算单位的预算编制，并审核71个中央转移支付项目绩效自评；同时开展转移支付和超长期特别国债资金监测，对异常数据核查并跟进整改。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-10-12",
      pubDateLocal: "2026-10-12",
      visibleDateLocal: "2026-10-12",
      responseBytes: 9824,
      responseSha256: "6a904675498b93669b92cf419c3887ba6edc7f18a73f04c747486aa0a734a159",
      responseArtifact: ".data/fiscal-qa/regional-bulk-20261012/evidence/responses/dispatch-006.body",
      extractedBodyChars: 2896,
      extractedBodyTextSha256: "8ce6f20eda98cca43e524684f7cba336a88cfdff2111c341e1f1ddd6003510c7",
    },
  },
  {
    id: "local-preview-mof-sichuan-budget-monitoring",
    source: { id: "local-preview-mof-sichuan-budget-monitoring-source", name: "财政部四川监管局" },
    originalSourceId: "mof-sichuan-supervision-dynamics",
    title: "财政部四川监管局：完善“月调度”机制 推进中央驻川预算单位预算执行监控提质增效",
    publishedAt: new Date("2026-10-08T00:00:00+08:00"),
    url: "https://sc.mof.gov.cn/caizhengjiancha/202610/t20261008_3998565.htm",
    category: "fiscal-policy",
    tags: ["预算执行", "财政监督", "地方实践"],
    summary: "【开发预览·编辑摘要；未经正式模型精选】四川监管局建立月度预算执行监控机制，结合系统预警和人工核查识别预算执行进度异常、支付不合规、会计科目使用不规范及项目支出与预算安排不符等疑点，督促单位限期整改并跟踪复核。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-10-08",
      pubDateLocal: "2026-10-08",
      visibleDateLocal: "2026-10-08",
      responseBytes: 6084,
      responseSha256: "549a2b861980e9a511c78ab2196dfe4bea31d277789298ecb3ca2f12b27f23a1",
      responseArtifact: ".data/fiscal-qa/regional-bulk-20261012/evidence/responses/dispatch-016.body",
      extractedBodyChars: 925,
      extractedBodyTextSha256: "ccb36af025c4e120e01cefbb9e14b1394ca0bebe527b6614444cb65cc67a8515",
    },
  },
  {
    id: "local-preview-mof-lottery-2025-sales",
    source: { id: "local-preview-mof-lottery-2025-sales-source", name: "财政部综合司" },
    originalSourceId: "mof-policy-release",
    title: "中华人民共和国财政部公告2026年第24号",
    publishedAt: new Date("2026-08-26T00:00:00+08:00"),
    url: "https://zhs.mof.gov.cn/zhengcefabu/202608/t20260826_3996112.htm",
    category: "fiscal-policy",
    tags: ["彩票", "财政数据", "公益金"],
    summary: "【开发预览·Luna辅助摘要；未经正式模型精选】财政部公告披露，2025年全国彩票销售6279.69亿元，并介绍彩票公益金筹集及中央彩票公益金安排。具体分配与安排以公告原文为准。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-08-26",
      pubDateLocal: "2026-08-26",
      visibleDateLocal: "2026-08-26",
      extractedBodyChars: 4024,
      extractedBodyTextSha256: "07fe4123fa78fd45f6ec6b866edbc6e5db92602a31a1592402b0c4ef5555e6a9",
    },
  },
  {
    id: "local-preview-mof-lottery-game-closures",
    source: { id: "local-preview-mof-lottery-game-closures-source", name: "财政部综合司" },
    originalSourceId: "mof-policy-release",
    title: "财政部关于中国福利彩票发行管理中心停止销售“联合销售15选5”等9款游戏的审批意见",
    publishedAt: new Date("2026-07-29T00:00:00+08:00"),
    url: "https://zhs.mof.gov.cn/zhengcefabu/202607/t20260729_3994493.htm",
    category: "fiscal-policy",
    tags: ["彩票", "政策发布", "兑奖"],
    summary: "【开发预览·Luna辅助摘要；未经正式模型精选】财政部同意中国福利彩票发行管理中心停止销售9款游戏，并列明停售时间、兑奖期限及停止销售后的结余资金划转安排。具体执行时间和流程以审批意见为准。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-07-29",
      pubDateLocal: "2026-07-29",
      visibleDateLocal: "2026-07-29",
      extractedBodyChars: 814,
      extractedBodyTextSha256: "2ff690cbe17dc2f480f9a0fd3fb14441fa6eb8c5afda50339acae1d756c7155b",
    },
  },
  {
    id: "local-preview-pboc-omo-196",
    source: { id: "local-preview-pboc-omo-196-source", name: "中国人民银行" },
    originalSourceId: "pboc-open-market",
    title: "公开市场业务交易公告 [2026]第196号",
    publishedAt: new Date("2026-10-12T00:00:00+08:00"),
    url: "https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/2026101208533774222/index.html",
    category: "monetary-finance",
    tags: ["公开市场", "逆回购", "利率"],
    summary: "【开发预览·Luna辅助摘要；未经正式模型精选】人民银行公告开展500亿元7天期逆回购操作，中标利率为1.40%。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-10-12",
      pubDateLocal: "2026-10-12",
      visibleDateLocal: "2026-10-12",
      extractedBodyChars: 150,
      extractedBodyTextSha256: "8f26a3f17235556901d1f1a4e6185304ae3a322a9c6edcee73b5233e4438dba5",
    },
  },
  {
    id: "local-preview-shanxi-accounting-inspection-2026",
    source: { id: "local-preview-shanxi-accounting-inspection-2026-source", name: "财政部山西监管局" },
    originalSourceId: "mof-shanxi-supervision-dynamics",
    title: "财政部山西监管局组织开展2026年度会计监督检查工作",
    publishedAt: new Date("2026-10-12T00:00:00+08:00"),
    url: "https://sn.mof.gov.cn/gzdt/caizhengjiancha/202610/t20261012_4002643.htm",
    category: "accounting-supervision",
    tags: ["会计监督", "执业检查", "山西"],
    summary: "【开发预览·Luna辅助摘要；未经正式模型精选】山西监管局开展2026年度会计监督检查，对两家从事证券服务业务备案的会计师事务所进行执业质量现场检查。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-10-12",
      pubDateLocal: "2026-10-12",
      visibleDateLocal: "2026-10-12",
      extractedBodyChars: 745,
      extractedBodyTextSha256: "9a667353e733b74421ed381e382fdd78ccf11aa4e60bdd36b5184e6f2aa58a77",
    },
  },
  {
    id: "local-preview-shanxi-zero-based-budget",
    source: { id: "local-preview-shanxi-zero-based-budget-source", name: "财政部山西监管局" },
    originalSourceId: "mof-shanxi-supervision-dynamics",
    title: "财政部山西监管局：以监管促改革推动零基预算改革落地见效",
    publishedAt: new Date("2026-10-09T00:00:00+08:00"),
    url: "https://sn.mof.gov.cn/gzdt/caizhengjiancha/202610/t20261009_4002417.htm",
    category: "fiscal-policy",
    tags: ["零基预算", "预算改革", "山西"],
    summary: "【开发预览·Luna辅助摘要；未经正式模型精选】山西监管局介绍零基预算改革推进情况：从2026年预算编制起在省内深化改革，并提及中央试点范围由16个地区扩展至48个地区。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-10-09",
      pubDateLocal: "2026-10-09",
      visibleDateLocal: "2026-10-09",
      extractedBodyChars: 1656,
      extractedBodyTextSha256: "14da952f60a88d895f502e3c9ea6c493323e66410751e24f88b14a66189fcb96",
    },
  },
  {
    id: "local-preview-zhejiang-budget-execution-joint-supervision",
    source: { id: "local-preview-zhejiang-budget-execution-joint-supervision-source", name: "财政部浙江监管局" },
    originalSourceId: "mof-zhejiang-supervision-dynamics",
    title: "浙江监管局：协同推进 建立预算执行常态化监督联合工作机制",
    publishedAt: new Date("2026-09-30T00:00:00+08:00"),
    url: "https://zj.mof.gov.cn/caizhengjiancha/202609/t20260930_3998386.htm",
    category: "fiscal-policy",
    tags: ["预算执行", "联合监督", "浙江"],
    summary: "【开发预览·Luna辅助摘要；未经正式模型精选】浙江监管局与省级财政部门建立预算执行常态化联合监督机制，文章介绍人员库建设、智能监控辅助和对财政资金全链条的监督安排。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-09-30",
      pubDateLocal: "2026-09-30",
      visibleDateLocal: "2026-09-30",
      extractedBodyChars: 666,
      extractedBodyTextSha256: "2fa22665dba7280b3490db808cf810227b866b8e4c84aeb1ed5c70513f09046d",
    },
  },
  {
    id: "local-preview-anhui-special-bonds-2026-batch-9",
    source: { id: "local-preview-anhui-special-bonds-2026-batch-9-source", name: "财政部安徽监管局" },
    originalSourceId: "mof-anhui-supervision-dynamics",
    title: "财政部安徽监管局：派员现场观察安徽省2026年第九批地方政府债券发行工作",
    publishedAt: new Date("2026-09-30T00:00:00+08:00"),
    url: "https://ah.mof.gov.cn/caizhengjiancha/202609/t20260930_3998374.htm",
    category: "government-debt",
    tags: ["地方政府债券", "发行", "安徽"],
    summary: "【开发预览·Luna辅助摘要；未经正式模型精选】安徽监管局现场观察安徽省2026年第九批地方政府债券发行，发行规模为268.07亿元。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-09-30",
      pubDateLocal: "2026-09-30",
      visibleDateLocal: "2026-09-30",
      extractedBodyChars: 233,
      extractedBodyTextSha256: "b5ac2b51a745a9359b7b9467d191ba89fb5d19d33bc663a56500206bf5964c3c",
    },
  },
  {
    id: "local-preview-jilin-transfer-payment-performance-loop",
    source: { id: "local-preview-jilin-transfer-payment-performance-loop-source", name: "财政部吉林监管局" },
    originalSourceId: "mof-jilin-supervision-dynamics",
    title: "财政部吉林监管局：构建闭环管理机制 推动绩效管理提质增效",
    publishedAt: new Date("2026-09-30T00:00:00+08:00"),
    url: "https://jl.mof.gov.cn/caizhengjiancha/202609/t20260930_3998472.htm",
    category: "fiscal-policy",
    tags: ["转移支付", "预算绩效", "吉林"],
    summary: "【开发预览·Luna辅助摘要；未经正式模型精选】吉林监管局介绍绩效自评复核、重点资金绩效评价及问题整改跟踪，推动预算绩效管理形成闭环。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-09-30",
      pubDateLocal: "2026-09-30",
      visibleDateLocal: "2026-09-30",
      extractedBodyChars: 2165,
      extractedBodyTextSha256: "375f7b600cd5d147eb69faf90a1104cedf67e3061f41a36f10caaa8aae4e481c",
    },
  },
  {
    id: "local-preview-hunan-state-finance-capital-registration",
    source: { id: "local-preview-hunan-state-finance-capital-registration-source", name: "财政部湖南监管局" },
    originalSourceId: "mof-hunan-supervision-dynamics",
    title: "湖南监管局深入衡阳市开展国有金融资本产权登记监督调研",
    publishedAt: new Date("2026-10-08T00:00:00+08:00"),
    url: "https://hn.mof.gov.cn/caizhengjiancha/202610/t20261008_3999374.htm",
    category: "fiscal-finance",
    tags: ["国有金融资本", "产权登记", "湖南"],
    summary: "【开发预览·Luna辅助摘要；未经正式模型精选】湖南监管局在衡阳调研国有金融资本产权登记，涉及13家机构，包括6家银行、6家担保公司和1家小额贷款公司；文章还指出部分担保公司经营困难。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-10-08",
      pubDateLocal: "2026-10-08",
      visibleDateLocal: "2026-10-08",
      extractedBodyChars: 280,
      extractedBodyTextSha256: "df1ae4663ddfd556cce6f7fed0fc0b943a99453f49ebe9397fb3402fcbf8ab04",
    },
  },
  {
    id: "local-preview-guangdong-central-transfer-supervision",
    source: { id: "local-preview-guangdong-central-transfer-supervision-source", name: "财政部广东监管局" },
    originalSourceId: "mof-guangdong-supervision-dynamics",
    title: "广东监管局：健全“四个突出”监管体系，持续提升中央转移支付资金监管质效",
    publishedAt: new Date("2026-09-28T00:00:00+08:00"),
    url: "https://gd.mof.gov.cn/caizhengjiancha/202609/t20260928_3998195.htm",
    category: "fiscal-policy",
    tags: ["中央转移支付", "资金监管", "广东"],
    summary: "【开发预览·Luna辅助摘要；未经正式模型精选】广东监管局介绍中央转移支付监管框架，覆盖增发国债、超长期特别国债和预算日常监督等工作重点。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-09-28",
      pubDateLocal: "2026-09-28",
      visibleDateLocal: "2026-09-28",
      extractedBodyChars: 1790,
      extractedBodyTextSha256: "2c94535707038f1324de272a6eb8481b31a267510c04920f4025279eec73d86a",
    },
  },
  {
    id: "local-preview-dalian-three-guarantees-monitoring",
    source: { id: "local-preview-dalian-three-guarantees-monitoring-source", name: "财政部大连监管局" },
    originalSourceId: "mof-dalian-supervision-dynamics",
    title: "财政部大连监管局以“三盯紧”筑牢基层“三保”底线",
    publishedAt: new Date("2026-10-08T00:00:00+08:00"),
    url: "https://dl.mof.gov.cn/caizhengjiancha/202610/t20261008_3998958.htm",
    category: "fiscal-policy",
    tags: ["基层三保", "风险监测", "大连"],
    summary: "【开发预览·Luna辅助摘要；未经正式模型精选】大连监管局介绍对基层“三保”的月度、季度和年度监测，按风险分级管理，并明确资金保障的优先顺序。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      listDateLocal: "2026-10-08",
      pubDateLocal: "2026-10-08",
      visibleDateLocal: "2026-10-08",
      extractedBodyChars: 1496,
      extractedBodyTextSha256: "be6e89526afedcb28fa110e7d6699c8e13684be7e74f0004ee22ba4e7f83a6d8",
    },
  },
] as const;
const previewArticleIds = samples.map((sample) => sample.id);
const previewSourceIds = samples.map((sample) => sample.source.id);
const previewAuditSubjects = previewArticleIds.map((id) => `content:${id}`);

async function assertPreviewDatabaseIsSafe() {
  const checks = await sql.begin(async (tx) => {
    const identities = await tx<{ id: string }[]>`
      SELECT id FROM sources
      UNION ALL SELECT id FROM articles
      UNION ALL SELECT article_id AS id FROM article_revisions
      UNION ALL SELECT article_id AS id FROM article_discoveries
      UNION ALL SELECT source_id AS id FROM fetch_runs
      UNION ALL SELECT article_id AS id FROM publications
      UNION ALL SELECT article_id AS id FROM editorial_overrides
      UNION ALL SELECT article_id AS id FROM pool_search
      UNION ALL SELECT article_id AS id FROM selected_ledger
      UNION ALL SELECT article_id AS id FROM selected_state`;
    const audit = await tx<{ count: number }[]>`
      SELECT count(*)::int AS count FROM audit_log
      WHERE actor <> ${previewActor} OR NOT (subject = ANY(${previewAuditSubjects}))`;
    const unsafeTables = await tx<{ table_name: string; count: number }[]>`
      SELECT 'analyses' AS table_name, count(*)::int AS count FROM analyses
      UNION ALL SELECT 'facts', count(*)::int FROM facts
      UNION ALL SELECT 'stories', count(*)::int FROM stories
      UNION ALL SELECT 'receipts', count(*)::int FROM receipts
      UNION ALL SELECT 'lb_models', count(*)::int FROM lb_models
      UNION ALL SELECT 'reports', count(*)::int FROM reports
      UNION ALL SELECT 'report_revisions', count(*)::int FROM report_revisions
      UNION ALL SELECT 'job_runs', count(*)::int FROM job_runs
      UNION ALL SELECT 'fetch_runs', count(*)::int FROM fetch_runs
      UNION ALL SELECT 'selected_ledger', count(*)::int FROM selected_ledger
      UNION ALL SELECT 'selected_state', count(*)::int FROM selected_state`;
    const [hasBossJobs] = await tx<{ exists: boolean }[]>`SELECT to_regclass('pgboss.job') IS NOT NULL AS exists`;
    const queueJobs = hasBossJobs!.exists
      ? await tx.unsafe<{ count: number }[]>("SELECT count(*)::int AS count FROM pgboss.job")
      : [{ count: 0 }];
    return {
      identities: identities.map((row) => row.id), auditRows: audit[0]!.count,
      unsafeTables: [...unsafeTables, { table_name: "pgboss.job", count: queueJobs[0]!.count }],
    };
  });
  assertLocalPreviewIds(checks.identities, [...previewSourceIds, ...previewArticleIds]);
  if (checks.auditRows !== 0) throw new Error("preview DB contains non-preview audit rows; refusing to seed");
  const populated = checks.unsafeTables.filter((row) => row.count !== 0);
  if (populated.length) throw new Error(`preview DB must have no ${populated.map((row) => row.table_name).join(", ")}`);
}

try {
  await assertPreviewDatabaseIsSafe();
  const changed: string[] = [];
  for (const sample of samples) {
    await sql.begin(async (tx) => {
      const originalSourceId = "originalSourceId" in sample ? sample.originalSourceId : undefined;
      const luna = "luna" in sample ? sample.luna : undefined;
      const editorialAssistant = "editorialAssistant" in sample ? sample.editorialAssistant : undefined;
      const sourceConfig = originalSourceId
        ? { localPreviewSample: true, referenceSourceId: originalSourceId }
        : { localPreviewSample: true };
      const [existingSource] = await tx<{ id: string; name: string; kind: string; config: Record<string, unknown>; tier: string; participation_mode: string; first_party: boolean; interval_minutes: number; enabled: boolean; site_fulltext: boolean; syndicate_fulltext: boolean }[]>`
        SELECT id, name, kind, config, tier, participation_mode, first_party, interval_minutes, enabled, site_fulltext, syndicate_fulltext
        FROM sources WHERE id = ${sample.source.id}`;
      if (existingSource && (!isDeepStrictEqual(existingSource, {
        id: sample.source.id, name: sample.source.name, kind: "web_list", config: sourceConfig, tier: "T1",
        participation_mode: "editorial", first_party: true, interval_minutes: 1440, enabled: false,
        site_fulltext: false, syndicate_fulltext: false,
      }))) {
        throw new Error(`preview source ${sample.source.id} exists with unexpected identity or safety flags`);
      }
      await tx`
        INSERT INTO sources (id, name, kind, config, tier, participation_mode, first_party, interval_minutes,
          site_fulltext, syndicate_fulltext, enabled, next_fetch_at)
        VALUES (${sample.source.id}, ${sample.source.name}, 'web_list', ${tx.json(sourceConfig)}, 'T1', 'editorial', true, 1440,
          false, false, false, 'infinity')
        ON CONFLICT (id) DO NOTHING`;

      const material = {
        id: sample.id,
        sourceId: sample.source.id,
        url: sample.url,
        title: sample.title,
        language: "zh",
        publishedAt: sample.publishedAt,
        bodyStatus: "none",
        raw: luna ? {
          provenance: "AD-012 local development sample",
          summaryOrigin: "luna_agent_assisted",
          originalBodyStored: false,
          referenceSourceId: originalSourceId,
          inputArtifactSha256: luna.inputArtifactSha256,
          articleContentHash: luna.articleContentHash,
          officialBodySha256: luna.officialBodySha256,
          inputRecordId: luna.inputRecordId,
          model: "gpt-6-luna/high",
          mode: "codex_agent_assisted",
          providerPipelineExecuted: false,
          providerReceipts: 0,
        } : editorialAssistant ? {
          provenance: "AD-012 local development sample",
          summaryOrigin: "agent_assisted_editorial",
          originalBodyStored: false,
          referenceSourceId: originalSourceId,
          requestedModel: editorialAssistant.requestedModel,
          requestedReasoningEffort: editorialAssistant.requestedReasoningEffort,
          actualModel: editorialAssistant.actualModel,
          listDateLocal: editorialAssistant.listDateLocal,
          pubDateLocal: editorialAssistant.pubDateLocal,
          visibleDateLocal: editorialAssistant.visibleDateLocal,
          officialResponseBytes: editorialAssistant.responseBytes,
          officialResponseSha256: editorialAssistant.responseSha256,
          ...("responseArtifact" in editorialAssistant ? { officialResponseArtifact: editorialAssistant.responseArtifact } : {}),
          extractedBodyChars: editorialAssistant.extractedBodyChars,
          extractedBodyTextSha256: editorialAssistant.extractedBodyTextSha256,
          providerPipelineExecuted: false,
          providerReceipts: 0,
          humanGold: false,
        } : { provenance: "AD-012 local development sample", summaryOrigin: "manual", originalBodyStored: false },
        via: "import",
      } as const;
      const expectedIdentityKey = identityKeyFor(material);
      const priorRows = await tx<{
        id: string; source_id: string; identity_key: string; url: string; title: string; published_at: Date;
        body_text: string | null; body_html: string | null; body_status: string; raw: unknown; revision: number;
      }[]>`
        SELECT id, source_id, identity_key, url, title, published_at, body_text, body_html, body_status, raw, revision
        FROM articles WHERE id = ${sample.id} OR identity_key = ${expectedIdentityKey}`;
      if (priorRows.some((prior) => prior.id !== sample.id || prior.source_id !== sample.source.id || prior.identity_key !== expectedIdentityKey
        || prior.url !== sample.url || prior.title !== sample.title || prior.published_at?.getTime() !== sample.publishedAt.getTime()
        || prior.body_text !== null || prior.body_html !== null || prior.body_status !== "none" || prior.revision !== 1
        || !isDeepStrictEqual(prior.raw, material.raw))) {
        throw new Error(`preview article ${sample.id} already exists with unapproved identity, content, body, revision, or provenance`);
      }
      const result = await upsertMaterial(material, tx);
      if (result.articleId !== sample.id) throw new Error(`sample identity collision for ${sample.id}`);
      const [article] = await tx<{ source_id: string; url: string; title: string; published_at: Date; body_text: string | null; body_html: string | null; body_status: string }[]>`
        SELECT source_id, url, title, published_at, body_text, body_html, body_status FROM articles WHERE id = ${sample.id}`;
      if (!article || article.source_id !== sample.source.id || article.url !== sample.url || article.title !== sample.title
        || article.published_at?.getTime() !== sample.publishedAt.getTime() || article.body_text !== null || article.body_html !== null || article.body_status !== "none") {
        throw new Error(`preview article ${sample.id} has unexpected provenance, date, or stored body`);
      }

      const fields = {
        title: sample.title,
        summary: sample.summary,
        category: sample.category,
        tags: [...sample.tags],
        relevance: "pass",
        selected: false,
      };
      const overrideReason = luna
        ? "AD-012 local preview; Luna-assisted editorial summary; not human Gold or formal P4 model selection"
        : editorialAssistant
          ? "AD-012 local preview; agent-assisted editorial summary; not human Gold or formal P4 model selection"
          : "AD-012 local preview; manually written summary";
      const auditReason = luna
        ? "AD-012 local development sample; Luna-assisted editorial summary; not human Gold or formal P4 model selection"
        : editorialAssistant
          ? "AD-012 local development sample; agent-assisted editorial summary; not human Gold or formal P4 model selection"
          : "AD-012 local development sample; manual summary; not model selected";
      const [override] = await tx<{ fields: Record<string, unknown>; visibility: string | null; reason: string | null; version: number; updated_by: string | null }[]>`
        SELECT fields, visibility, reason, version, updated_by FROM editorial_overrides WHERE article_id = ${sample.id}`;
      if (override) {
        if (!isDeepStrictEqual(override.fields, fields) || override.visibility !== "public" || override.reason !== overrideReason
          || override.version !== 1 || override.updated_by !== previewActor) {
          throw new Error(`preview override ${sample.id} differs from the reviewed seed; refusing to overwrite`);
        }
      } else {
        await tx`
          INSERT INTO editorial_overrides (article_id, fields, visibility, reason, version, updated_by)
          VALUES (${sample.id}, ${tx.json(fields as never)}, 'public', ${overrideReason}, 1, ${previewActor})`;
      }

      const [previousProjection] = await tx<{
        revision: number; visibility: string; eligible: boolean; selected: boolean; title: string; original_title: string | null; summary: string | null;
        reason: string | null; category: string | null; tags: string[]; score: number | null; source_id: string; url: string;
        published_at: Date; body_mode: string; syndicate: boolean; indexable: boolean; analysis_id: number | null;
      }[]>`
        SELECT revision, visibility, eligible, selected, title, original_title, summary, reason, category, tags, score, source_id,
          url, published_at, body_mode, syndicate, indexable, analysis_id
        FROM publications WHERE article_id = ${sample.id}`;
      if (previousProjection) {
        const matches = previousProjection.revision === 1 && previousProjection.visibility === "public" && previousProjection.eligible && !previousProjection.selected
          && previousProjection.title === sample.title && previousProjection.original_title === null && previousProjection.summary === sample.summary
          && previousProjection.reason === null && previousProjection.category === sample.category && isDeepStrictEqual(previousProjection.tags, [...sample.tags])
          && previousProjection.score === null && previousProjection.source_id === sample.source.id && previousProjection.url === sample.url
          && previousProjection.published_at.getTime() === sample.publishedAt.getTime() && previousProjection.body_mode === "summary"
          && !previousProjection.syndicate && !previousProjection.indexable && previousProjection.analysis_id === null;
        if (!matches) throw new Error(`preview publication ${sample.id} differs from its approved scoreless sample projection`);
      } else {
        const published = await publishArticleTx(tx, sample.id, { now: new Date() });
        if (!published || published.selected || published.visibility !== "public") throw new Error(`unexpected publication state for ${sample.id}`);
      }
      await tx`
        INSERT INTO audit_log (actor, action, subject, reason, after)
        SELECT ${previewActor}, 'content.override', ${`content:${sample.id}`}, ${auditReason}, ${tx.json(luna
          ? { preview: true, selected: false, summaryOrigin: "luna_agent_assisted" }
          : editorialAssistant
            ? { preview: true, selected: false, summaryOrigin: "agent_assisted_editorial", humanGold: false }
            : { preview: true, selected: false })}
        WHERE NOT EXISTS (SELECT 1 FROM audit_log WHERE actor = ${previewActor} AND subject = ${`content:${sample.id}`} AND action = 'content.override')`;
      changed.push(`${sample.id}:${result.created ? "created" : result.revised ? "revised" : "unchanged"}`);
    });
  }

  const summary = await sql<{ sources: number; articles: number; publications: number; overrides: number; audit_rows: number; eligible: number; selected: number; analyses: number; body_texts: number; score_values: number }[]>`
    SELECT (SELECT count(*)::int FROM sources WHERE id = ANY(${previewSourceIds})) AS sources,
           (SELECT count(*)::int FROM articles WHERE id = ANY(${previewArticleIds})) AS articles,
           (SELECT count(*)::int FROM publications WHERE article_id = ANY(${previewArticleIds})) AS publications,
           (SELECT count(*)::int FROM editorial_overrides WHERE article_id = ANY(${previewArticleIds})) AS overrides,
           (SELECT count(*)::int FROM audit_log WHERE actor = ${previewActor} AND subject = ANY(${previewAuditSubjects})) AS audit_rows,
           (SELECT count(*)::int FROM publications WHERE article_id = ANY(${previewArticleIds}) AND eligible) AS eligible,
           (SELECT count(*)::int FROM publications WHERE article_id = ANY(${previewArticleIds}) AND selected) AS selected,
           (SELECT count(*)::int FROM analyses WHERE article_id = ANY(${previewArticleIds})) AS analyses,
           (SELECT count(*)::int FROM articles WHERE id = ANY(${previewArticleIds}) AND body_text IS NOT NULL) AS body_texts,
           (SELECT count(*)::int FROM publications WHERE article_id = ANY(${previewArticleIds}) AND score IS NOT NULL) AS score_values`;
  const result = summary[0]!;
  if (result.sources !== samples.length || result.articles !== samples.length || result.publications !== samples.length
    || result.overrides !== samples.length || result.audit_rows !== samples.length || result.eligible !== samples.length
    || result.selected !== 0 || result.analyses !== 0 || result.body_texts !== 0 || result.score_values !== 0) {
    throw new Error(`post-seed invariant failed; expected exactly ${samples.length} eligible, unselected, scoreless summary-only records and no analyses/full text`);
  }
  console.log(JSON.stringify({ database: safe.database, samples: changed, ...result, safetyFlags: safe.safetyFlags }));
} finally {
  await closeDb();
}
