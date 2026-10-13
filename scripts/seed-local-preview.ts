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
  {
    id: "local-preview-xlrwn948i42p6lbi1d1y8eikq",
    source: { id: "local-preview-sample-xlrwn948i42p6lbi1d1y8eikq", name: "财政部四川监管局·工作动态" },
    originalSourceId: "mof-sichuan-supervision-dynamics",
    title: "四川监管局：认真贯彻落实财政科学管理试点座谈会精神进一步提升财政监管质效",
    publishedAt: new Date("2026-10-12T00:00:00+08:00"),
    url: "https://sc.mof.gov.cn/caizhengjiancha/202610/t20261012_4002637.htm",
    category: "fiscal-policy",
    tags: ["财政政策","财政科学管理","地方财政"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】四川监管局称，将按月跟踪、按季分析并年度评估地方财政运行，把库款保障、“三保”、政府债务和特别国债项目纳入监测，并通过预警、核查、整改闭环推动风险处置。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-10-12",
      visibleDateLocal: "2026-10-12",
      extractedBodyChars: 1514,
      extractedBodyTextSha256: "5bfbd7e928fb8dbd6227bf0c8cbc21a84e6d651bea7bf055b3f7371d1d5d1c6a",
      sourceArticleContentHash: "e47afb0bd08da03790eb547ae30ca74381863a24b340c73eae85dfea569f2005",
      sourceArticleRevision: null
    },
  },
  {
    id: "local-preview-swnlrxg3no7zvr7052h992p5x",
    source: { id: "local-preview-sample-swnlrxg3no7zvr7052h992p5x", name: "财政部山西监管局·工作动态" },
    originalSourceId: "mof-shanxi-supervision-dynamics",
    title: "财政部山西监管局：构建“研-联-治”全周期常态化监督体系 赋能转移支付科学管理",
    publishedAt: new Date("2026-10-12T00:00:00+08:00"),
    url: "https://sn.mof.gov.cn/gzdt/caizhengjiancha/202610/t20261012_4002646.htm",
    category: "fiscal-policy",
    tags: ["财政政策","转移支付","预算管理"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】山西监管局介绍，其将数据预警、资金末端现场核验、转移支付申报审核和绩效评价联动，对查实问题限期整改并跟踪销号，重点核对资金拨付、项目实施及受益情况。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-10-12",
      visibleDateLocal: "2026-10-12",
      extractedBodyChars: 1356,
      extractedBodyTextSha256: "5b23df1689c7a42bfbd8c810d1f000a78a3d1b3b215093152cfb9f7ae5b33c6d",
      sourceArticleContentHash: "ac5fb71919ad20fc958d1ad3e8bf038c923f0f6a8ba03eece22a7b0432bdc145",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-vu1mrn37ph9hriaon9684ea6j",
    source: { id: "local-preview-sample-vu1mrn37ph9hriaon9684ea6j", name: "财政部江苏监管局·工作动态" },
    originalSourceId: "mof-jiangsu-supervision-dynamics",
    title: "财政部江苏监管局：“三个强化”提升地方财政运行分析评估工作质效",
    publishedAt: new Date("2026-10-08T16:00:00.000Z"),
    url: "https://jsz.mof.gov.cn/caizhengjiancha/202610/t20261009_4002430.htm",
    category: "fiscal-policy",
    tags: ["财政政策","地方财政","预算管理"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】江苏监管局介绍按月监测重点关注县“三保”执行，结合预算数据提示风险；日常评估还关注一般性支出、违规举债和资金沉淀，并跟踪到期税费政策效果。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-10-08",
      visibleDateLocal: "2026-10-08",
      extractedBodyChars: 2214,
      extractedBodyTextSha256: "d5846ec2ffe30df42955e332c155eca0cb22becc96673bcdb061b9293967a6ac",
      sourceArticleContentHash: "79098bb5f9cee61f10da7968e0aca79ea83764868cdc5afabdcdb98572cd8dd3",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-e6es8kyasp2l8ad52cgkgx9qp",
    source: { id: "local-preview-sample-e6es8kyasp2l8ad52cgkgx9qp", name: "财政部四川监管局·工作动态" },
    originalSourceId: "mof-sichuan-supervision-dynamics",
    title: "财政部四川监管局：“根干枝叶”四向发力 赋能中央转移支付资金闭环监管",
    publishedAt: new Date("2026-10-07T16:00:00.000Z"),
    url: "https://sc.mof.gov.cn/caizhengjiancha/202609/t20260909_3997020.htm",
    category: "fiscal-policy",
    tags: ["财政政策","转移支付","预算管理"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】四川监管局介绍，依托预算管理一体化系统跟踪中央转移支付从省级到市县的流转，以预警、自查、抽查和整改闭环排查违规划转等风险，并对疑点开展线下核证。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-10-07",
      visibleDateLocal: "2026-10-07",
      extractedBodyChars: 1972,
      extractedBodyTextSha256: "ad41d0867034feef88f69c76fb3f63864fb59e1fb5ca23ec5d217d995c1f2a75",
      sourceArticleContentHash: "14e3cbbe06d6997f54dcb247fde195d3a387972f07e3013473b859c5dfb49e68",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-ewiu4lkg7i33olsbgd1x9lcwc",
    source: { id: "local-preview-sample-ewiu4lkg7i33olsbgd1x9lcwc", name: "财政部北京监管局·工作动态" },
    originalSourceId: "mof-beijing-supervision-dynamics",
    title: "财政部北京监管局：以财政科学管理为引领 推动中央预算单位财政监管提质增效",
    publishedAt: new Date("2026-10-08T01:08:00.000Z"),
    url: "https://bj.mof.gov.cn/caizhengjiancha/202610/t20261008_3998543.htm",
    category: "local-practice",
    tags: ["地方实践","预算管理","财政政策"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】北京监管局提出把中央预算单位预算管理与履职目标衔接，监管从资金合规扩展到支出结构、存量资源和绩效管理，推动预算单位落实资金使用主体责任。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-10-08",
      visibleDateLocal: "2026-10-08",
      extractedBodyChars: 2620,
      extractedBodyTextSha256: "e8ca28fe4b3386df8323cdcb3337e85dccbfee2078f8dd71d8ba0a37a2707045",
      sourceArticleContentHash: "ed9edbc4c5eea57da832ec84b974864c44483a7866174707935f345c2227015a",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-fujj4bx366umeljostdaws698",
    source: { id: "local-preview-sample-fujj4bx366umeljostdaws698", name: "财政部安徽监管局·工作动态" },
    originalSourceId: "mof-anhui-supervision-dynamics",
    title: "财政部安徽监管局：严把三重关口 扎实开展特殊教育补助资金重点绩效评价工作",
    publishedAt: new Date("2026-09-28T16:00:00.000Z"),
    url: "https://ah.mof.gov.cn/caizhengjiancha/202609/t20260929_3998319.htm",
    category: "fiscal-policy",
    tags: ["财政政策","预算绩效","地方实践"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】安徽监管局按财政部部署开展特殊教育补助资金重点绩效评价，现场核验资金用途、项目管理和制度执行，并交叉比对学籍、送教记录及教学设备台账。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-09-28",
      visibleDateLocal: "2026-09-28",
      extractedBodyChars: 502,
      extractedBodyTextSha256: "20046857b2611c81e3f1e2718d6516ee6f5c6632962448cbe826dd0843f58963",
      sourceArticleContentHash: "9361cd384e1167bcec8d6bb88738187748119dd299435167a336680c5341e6db",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-j5i5az5u8iuket3cslkxlkgq1",
    source: { id: "local-preview-sample-j5i5az5u8iuket3cslkxlkgq1", name: "财政部河南监管局·工作动态" },
    originalSourceId: "mof-henan-supervision-dynamics",
    title: "财政部河南监管局：高位谋划推进零基预算改革 扎实开展属地中央预算单位预算编制审核工作",
    publishedAt: new Date("2026-09-28T16:00:00.000Z"),
    url: "https://ha.mof.gov.cn/caizhengjiancha/202609/t20260929_3998300.htm",
    category: "fiscal-policy",
    tags: ["财政政策","零基预算","预算管理"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】河南监管局把零基预算理念融入属地中央预算单位预算审核，组建专项工作组分工复核数据、系统录入与交叉核对，强调过紧日子和按需统筹资金。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-09-28",
      visibleDateLocal: "2026-09-28",
      extractedBodyChars: 712,
      extractedBodyTextSha256: "694593d88e272ba9446f5b2f90bc4aa6bf31af721f915d6894bb81290fece47b",
      sourceArticleContentHash: "11614e8777df4283d0a6017a1b8e5e972cfd2fe128d71f056622baeb6478454a",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-gef2vpls83h85b2c83o8fnlmt",
    source: { id: "local-preview-sample-gef2vpls83h85b2c83o8fnlmt", name: "财政部山东监管局·工作动态" },
    originalSourceId: "mof-shandong-supervision-dynamics",
    title: "山东监管局：三维发力抓实中小企业专项资金重点绩效评价 推动惠企政策落地见效",
    publishedAt: new Date("2026-09-28T16:00:00.000Z"),
    url: "https://sd.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260922_3997968.htm",
    category: "fiscal-policy",
    tags: ["财政政策","预算绩效","地方实践"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】山东监管局对中小企业发展专项资金开展重点绩效评价，检查拨付进度、专款专用和项目产出，并走访企业核验研发、设备更新及数字化改造等申报目标。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-09-28",
      visibleDateLocal: "2026-09-28",
      extractedBodyChars: 1199,
      extractedBodyTextSha256: "64274c1edf404cea49d800e4ba41d038ca2f015bdecf8defc87be9972c5779b9",
      sourceArticleContentHash: "292968c8819aa9d7dc7e9722f14ac5195b0fdb9c42e8c21f0ca333f2374497e5",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-oywkrh333bn0hxlhfsm7pjm5o",
    source: { id: "local-preview-sample-oywkrh333bn0hxlhfsm7pjm5o", name: "财政部重庆监管局·工作动态" },
    originalSourceId: "mof-chongqing-supervision-dynamics",
    title: "财政部重庆监管局：立足属地财会监督职能以“三维协同”赋能西部金融中心建设",
    publishedAt: new Date("2026-09-27T16:00:00.000Z"),
    url: "https://cq.mof.gov.cn/gzdt2019/caizhengjiancha/202609/t20260928_3998237.htm",
    category: "fiscal-finance",
    tags: ["财政金融","金融风险","地方实践"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】重庆监管局介绍以全周期监管支持西部金融中心建设，结合非现场监测、现场核查与整改督导识别风险，并关注不良资产、财务核算及财政贴息等业务。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-09-27",
      visibleDateLocal: "2026-09-27",
      extractedBodyChars: 1586,
      extractedBodyTextSha256: "9de026e73d78ec48db4b85e22c88dc932f2bf36394829896e20ad510ea0de5fe",
      sourceArticleContentHash: "d3e5f81a370205f8dbaed4f6e95d29e573b2b10a98f9526a343df109713294ee",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-kr9s99q6vyucu4m38n7l50qa4",
    source: { id: "local-preview-sample-kr9s99q6vyucu4m38n7l50qa4", name: "财政部广西监管局·工作动态" },
    originalSourceId: "mof-guangxi-supervision-dynamics",
    title: "财政部广西监管局：“四个聚焦”推进国有金融资本产权登记监管提质增效",
    publishedAt: new Date("2026-09-27T16:00:00.000Z"),
    url: "https://gx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260920_3997805.htm",
    category: "fiscal-finance",
    tags: ["财政金融","国有金融资本","金融监管"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】广西监管局印发国有金融资本产权登记监管办法，建立企业产权信息底账，并交叉核验出资分类、金额和企业层级，推动登记数据补齐与规范。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-09-27",
      visibleDateLocal: "2026-09-27",
      extractedBodyChars: 1720,
      extractedBodyTextSha256: "36b00746d87361f5706f6f3be5a9eee0200e3e380a93417fd4cd549fddff55d0",
      sourceArticleContentHash: "313f3fbe58cc40003cd0a81fbe4ac5a69d362893839ab27f8076460f6d6d7896",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-ektkjakgwgqg7tuis2mm6pv9w",
    source: { id: "local-preview-sample-ektkjakgwgqg7tuis2mm6pv9w", name: "财政部广东监管局·工作动态" },
    originalSourceId: "mof-guangdong-supervision-dynamics",
    title: "广东监管局：念好三字诀 高质量开展重点绩效评价工作",
    publishedAt: new Date("2026-09-27T16:00:00.000Z"),
    url: "https://gd.mof.gov.cn/caizhengjiancha/202609/t20260921_3997829.htm",
    category: "fiscal-policy",
    tags: ["财政政策","预算绩效","监管动态"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】广东监管局对中央专项资金开展重点绩效评价，结合书面审查和现场核验，排查资金闲置、拨付滞后、项目进度及绩效产出等问题，并建立整改台账。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-09-27",
      visibleDateLocal: "2026-09-27",
      extractedBodyChars: 1660,
      extractedBodyTextSha256: "3669661bfc17da0d8cb02a768a32b25cdffb26a3a795c76e535518328b45249a",
      sourceArticleContentHash: "ef07ce674f0d42a9aefeac58718c1cd42ddfde1d843566bda300fcfbbef6ac8e",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-n8nnkqjua32kaswzm5mmbfl0v",
    source: { id: "local-preview-sample-n8nnkqjua32kaswzm5mmbfl0v", name: "财政部吉林监管局·工作动态" },
    originalSourceId: "mof-jilin-supervision-dynamics",
    title: "吉林监管局：立足政策目标 发挥协同作用扎实做好普惠金融发展专项资金审核工作",
    publishedAt: new Date("2026-09-27T16:00:00.000Z"),
    url: "https://jl.mof.gov.cn/caizhengjiancha/202609/t20260910_3997205.htm",
    category: "fiscal-finance",
    tags: ["财政金融","普惠金融","财政贴息"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】吉林监管局审核普惠金融发展专项资金，覆盖农村金融机构费用补贴、创业担保贷款贴息和示范区奖补，并将财政申报与金融部门数据交叉比对。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-09-27",
      visibleDateLocal: "2026-09-27",
      extractedBodyChars: 1986,
      extractedBodyTextSha256: "f5da8d085d378206f9c4d85e25c9be75376e32773b9ad4e527203ffeca0586e0",
      sourceArticleContentHash: "bb1dfeee7e1faced40cd68e06c83622e942bd04287d43ba0176cd8da23f7bc2e",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-oiqcqwfsniamp70mzsk5gmpls",
    source: { id: "local-preview-sample-oiqcqwfsniamp70mzsk5gmpls", name: "财政部海南监管局·工作动态" },
    originalSourceId: "mof-hainan-supervision-dynamics",
    title: "财政部海南监管局：“四个强化”抓实内控管理 筑牢转移支付资金监管屏障",
    publishedAt: new Date("2026-09-22T16:00:00.000Z"),
    url: "https://hq.mof.gov.cn/caizhengjiancha/202609/t20260923_3998016.htm",
    category: "fiscal-policy",
    tags: ["财政政策","转移支付","内部控制"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】海南监管局称已围绕转移支付预算执行和超长期特别国债监管印发6项业务制度，将前置审核、过程监管与绩效评价纳入规程，并完善复核和整改闭环。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-09-22",
      visibleDateLocal: "2026-09-22",
      extractedBodyChars: 1707,
      extractedBodyTextSha256: "3794907cf4577cb9fece231ea5cf6ea3be77e28313eb9aefb5db9ac24d519d53",
      sourceArticleContentHash: "4ff227b3ac8c81f84c7c6c7b916fdb6ff2ce3a3fd707dc08ae8e809b11689413",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-px2fqcrm4px0xq249n82yi9t4",
    source: { id: "local-preview-sample-px2fqcrm4px0xq249n82yi9t4", name: "财政部湖南监管局·工作动态" },
    originalSourceId: "mof-hunan-supervision-dynamics",
    title: "湖南监管局：“四维发力”严审民航基建贷款贴息 切实提升财政资金监管质效",
    publishedAt: new Date("2026-09-22T16:00:00.000Z"),
    url: "https://hn.mof.gov.cn/caizhengjiancha/202609/t20260918_3997698.htm",
    category: "fiscal-finance",
    tags: ["财政金融","财政贴息","金融风险"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】湖南监管局对民航基建贷款贴息开展穿透审核，核对项目批复、贷款合同、利息凭证和资金流向，重点排除超范围贷款并核验贷款是否用于申报项目。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-09-22",
      visibleDateLocal: "2026-09-22",
      extractedBodyChars: 1659,
      extractedBodyTextSha256: "732ea188c7491045621ce1fd05753e0ed940ff8ddb286062e4c00bb9172996bc",
      sourceArticleContentHash: "09cae46e771de00e79ee0c07c6e54ca487ece9aec603dd5007e12c6b2c83dadf",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-ddnk7nkwwiyhkwl9t3r22x0al",
    source: { id: "local-preview-sample-ddnk7nkwwiyhkwl9t3r22x0al", name: "财政部内蒙古监管局·工作动态" },
    originalSourceId: "mof-inner-mongolia-supervision-dynamics",
    title: "财政部内蒙古监管局：坚持“四维发力” 持续推动财政收入监管提质增效",
    publishedAt: new Date("2026-09-22T16:00:00.000Z"),
    url: "https://nmg.mof.gov.cn/caizhengjiancha/202609/t20260923_3998041.htm",
    category: "fiscal-policy",
    tags: ["财政政策","财政收支","税费政策"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】内蒙古监管局介绍，财政收入监管覆盖增值税先征后退复核、中央非税收入征管和国有资本收益上缴，并按地区和行业跟踪收入规模、结构及变化。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-09-22",
      visibleDateLocal: "2026-09-22",
      extractedBodyChars: 1638,
      extractedBodyTextSha256: "3248dcdd6c5a094358ab07c905fa16e47d0141ad923fd7016a9cc5d590928f4b",
      sourceArticleContentHash: "62c38d97d843583317cb64429797ff3bf09da48c6342783a1663a2b8553796d8",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-vbkawm7m8izokp7k6jttwf05v",
    source: { id: "local-preview-sample-vbkawm7m8izokp7k6jttwf05v", name: "财政部重庆监管局·工作动态" },
    originalSourceId: "mof-chongqing-supervision-dynamics",
    title: "财政部重庆监管局：常态化深入开展年报分析夯实会计监督日常监管基础",
    publishedAt: new Date("2026-09-21T16:00:00.000Z"),
    url: "https://cq.mof.gov.cn/gzdt2019/caizhengjiancha/202609/t20260922_3997913.htm",
    category: "accounting-supervision",
    tags: ["财会监督","金融数据","地方实践"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】重庆监管局选取辖区78家A股上市公司2025年年报开展分析，对比资产、营收、利润、税费、研发和融资指标，并将分析报告报送地方政府。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-09-21",
      visibleDateLocal: "2026-09-21",
      extractedBodyChars: 885,
      extractedBodyTextSha256: "7d99dae021f2e8f8bdea497855d5c16e48cd50e6ffb84dbe11c960f3c4873d91",
      sourceArticleContentHash: "667fbda62c75fdeccf3c46e1b4b450d1b1cb58a517067f177bd4cc4bc75184b4",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-aosixdekxw78xgtxarnrhcfyi",
    source: { id: "local-preview-sample-aosixdekxw78xgtxarnrhcfyi", name: "财政部四川监管局·工作动态" },
    originalSourceId: "mof-sichuan-supervision-dynamics",
    title: "财政部四川监管局：2026年2季度征收入库西藏自治区彩票公益金等中央非税收入12860.36万元",
    publishedAt: new Date("2026-09-21T16:00:00.000Z"),
    url: "https://sc.mof.gov.cn/caizhengjiancha/202609/t20260922_3997938.htm",
    category: "fiscal-policy",
    tags: ["财政数据","财政收支","彩票"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】四川监管局披露，2026年二季度西藏自治区彩票公益金等中央非税收入共征收12,860.36万元；4至6月分月收入均已按时足额入库。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-09-21",
      visibleDateLocal: "2026-09-21",
      extractedBodyChars: 267,
      extractedBodyTextSha256: "e4dc94ee1b34a28e5051e1e3c06f3e70c607d1479ba28624a9339fec1f692ae8",
      sourceArticleContentHash: "655f5c62e52cf484f60739eab8212319099d2f63dc5a4375c058216219d7fbde",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-ukqu31m5j0rauy7wu69mhjgrv",
    source: { id: "local-preview-sample-ukqu31m5j0rauy7wu69mhjgrv", name: "财政部安徽监管局·工作动态" },
    originalSourceId: "mof-anhui-supervision-dynamics",
    title: "财政部安徽监管局：多维协同聚合力 积极推动财金协同促内需政策落地见效",
    publishedAt: new Date("2026-09-21T16:00:00.000Z"),
    url: "https://ah.mof.gov.cn/caizhengjiancha/202609/t20260922_3997927.htm",
    category: "fiscal-finance",
    tags: ["财政金融","财政贴息","政府投资"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】安徽监管局跟踪设备更新、中小微企业贷款和个人消费贷款贴息等促内需政策，协调省财政与金融机构共享执行信息，并核查资金审核、拨付和项目推进。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-09-21",
      visibleDateLocal: "2026-09-21",
      extractedBodyChars: 1562,
      extractedBodyTextSha256: "b0280ee74efa2c3cb7f6a2cfae7f5f95e3b9aa47a3d99747a417d9536e831acf",
      sourceArticleContentHash: "187452bb58eb19ad1b5458535559861d6e158716a6f3b261ba1e973c48f25e5f",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-v6lm8um8188rn6k1vra5fzyzn",
    source: { id: "local-preview-sample-v6lm8um8188rn6k1vra5fzyzn", name: "财政部湖北监管局·工作动态" },
    originalSourceId: "mof-hubei-supervision-dynamics",
    title: "财政部湖北监管局：坚持“四个突出”扎实开展中央金融企业不良资产业务专项核查",
    publishedAt: new Date("2026-09-21T16:00:00.000Z"),
    url: "https://hb.mof.gov.cn/gzdt2019/caizhengjiancha/202609/t20260922_3997922.htm",
    category: "financial-regulation",
    tags: ["金融监管","不良资产","风险处置"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】湖北监管局对属地中央金融企业不良资产业务开展专项核查，重点检查追偿是否充分、核销后是否持续追偿，以及资产处置交易目的和定价公允性。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-09-21",
      visibleDateLocal: "2026-09-21",
      extractedBodyChars: 998,
      extractedBodyTextSha256: "e7c86d9648abcc904c3f4366cbb863cfe1180c5d0225ba4b9435f9942ba6cec1",
      sourceArticleContentHash: "1491ac6eb1f12c12a20e646a00d85e7044eedb3e8925112cece83f43a37de14a",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-b0kvpev8vj8jakulbky07v8ob",
    source: { id: "local-preview-sample-b0kvpev8vj8jakulbky07v8ob", name: "财政部大连监管局·工作动态" },
    originalSourceId: "mof-dalian-supervision-dynamics",
    title: "大连监管局：扎实推进2027年部门预算编制审核工作",
    publishedAt: new Date("2026-09-21T16:00:00.000Z"),
    url: "https://dl.mof.gov.cn/caizhengjiancha/202609/t20260911_3997250.htm",
    category: "fiscal-policy",
    tags: ["财政政策","预算管理","地方实践"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】大连监管局开展2027年驻连中央预算单位预算审核，复核人员编制、新增资产配置和社会保险缴费需求，并将资产存量与新增需求对照、控制超标准配置。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-09-21",
      visibleDateLocal: "2026-09-21",
      extractedBodyChars: 1556,
      extractedBodyTextSha256: "c646b45a6d9e44158e99a772c085364d385335e544c37db44621d8fee6bb4beb",
      sourceArticleContentHash: "0a477079f8dff5f94c9efe0bda9a91c8b26ed952634a37d2ab999c58195388d5",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-q1ztd2w8qe42q0mlfwnweb5ya",
    source: { id: "local-preview-sample-q1ztd2w8qe42q0mlfwnweb5ya", name: "财政部山西监管局·工作动态" },
    originalSourceId: "mof-shanxi-supervision-dynamics",
    title: "山西监管局：扎实履行财会监督职责促进全国统一大市场建设",
    publishedAt: new Date("2026-09-21T16:00:00.000Z"),
    url: "https://sn.mof.gov.cn/gzdt/caizhengjiancha/202608/t20260803_3994738.htm",
    category: "accounting-supervision",
    tags: ["财会监督","政府采购","财政政策"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】山西监管局介绍通过财税优惠、招商引资、政府采购和产业资金监督纠治地方保护，推动落实政府采购预付款、电子保函等惠企举措，并以数字化预警配合现场核查。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-09-21",
      visibleDateLocal: "2026-09-21",
      extractedBodyChars: 815,
      extractedBodyTextSha256: "3defcde9e0057199fdd72803fd8d6f9050248cb47e9260e90e28bb912260a878",
      sourceArticleContentHash: "c30690e8ee90bd3565d4cf9f1949f0b9e74141da3d8fb56d63cb732e598ce2d9",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-w2lu0aoru9j93a0j0pw121ufe",
    source: { id: "local-preview-sample-w2lu0aoru9j93a0j0pw121ufe", name: "财政部安徽监管局·工作动态" },
    originalSourceId: "mof-anhui-supervision-dynamics",
    title: "财政部安徽监管局：聚焦全链条监管 推动专项债券绩效管理走深见效",
    publishedAt: new Date("2026-09-20T16:00:00.000Z"),
    url: "https://ah.mof.gov.cn/caizhengjiancha/202609/t20260921_3997835.htm",
    category: "government-debt",
    tags: ["政府债务","专项债","预算绩效"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】安徽监管局介绍专项债项目全流程绩效监管：入库前核查项目成熟度、收益成本平衡和偿债计划，执行中跟踪目标进度，并将评价结果用于债务限额调整建议。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-09-20",
      visibleDateLocal: "2026-09-20",
      extractedBodyChars: 773,
      extractedBodyTextSha256: "c722758135dc810ce3bbe9e2df4cb92d765c0043ee7fbec1547c6a884a7ee4b5",
      sourceArticleContentHash: "d1ae87d6bb659a28aaf1f8a0486ef7943daf755d9c3e021034f53d0bca47d9de",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-wx4k8brv7nyil4l41r8drgy17",
    source: { id: "local-preview-sample-wx4k8brv7nyil4l41r8drgy17", name: "财政部大连监管局·工作动态" },
    originalSourceId: "mof-dalian-supervision-dynamics",
    title: "财政部大连监管局：多维发力 纵深推进预算执行常态化监督走深走实",
    publishedAt: new Date("2026-09-20T16:00:00.000Z"),
    url: "https://dl.mof.gov.cn/caizhengjiancha/202609/t20260921_3997822.htm",
    category: "fiscal-policy",
    tags: ["财政政策","预算管理","财政收支"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】大连监管局围绕预算执行开展常态化监督，重点排查无预算或超预算支出、年底突击花钱、津补贴违规及资产采购重复等问题，并结合系统预警和现场核查跟踪整改。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-09-20",
      visibleDateLocal: "2026-09-20",
      extractedBodyChars: 1458,
      extractedBodyTextSha256: "720cfe5d8d55e68cd5bb11627984472e07f18564ab24aa6631405f9308cd8c9b",
      sourceArticleContentHash: "ea804f0dfa8e481d46d581a4ca6c4de7f9aecf36cd96f702c949f777f1a14433",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-sxqkd3domfod5qdgkm35gwdys",
    source: { id: "local-preview-sample-sxqkd3domfod5qdgkm35gwdys", name: "财政部贵州监管局·工作动态" },
    originalSourceId: "mof-guizhou-supervision-dynamics",
    title: "财政部贵州监管局：“三个坚持”闭环监管 扎实开展属地中央企业国有资本收益审核征收工作",
    publishedAt: new Date("2026-08-31T16:00:00.000Z"),
    url: "https://gz.mof.gov.cn/caizhengjiancha/202608/t20260806_3995057.htm",
    category: "fiscal-finance",
    tags: ["财政金融","国有金融资本","财政收支"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】贵州监管局介绍对属地中央企业国有资本收益实行申报审核、实地核验和闭环征收，核对申报表与审计报表、收益基数及历史缴款，推动应缴收益及时入库。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-08-31",
      visibleDateLocal: "2026-08-31",
      extractedBodyChars: 1421,
      extractedBodyTextSha256: "0c44c4ef034d726e9748fc23985df01d30601585df39baf507bb7f1667992ea9",
      sourceArticleContentHash: "eafaf02a1b44169a768e22531c9b5a67dba5f1d4efbdc5e458ae31ae843dedab",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-ylutigzgsep8kq0vcg5vrrap0",
    source: { id: "local-preview-sample-ylutigzgsep8kq0vcg5vrrap0", name: "财政部浙江监管局·监管工作" },
    originalSourceId: "mof-zhejiang-supervision-dynamics",
    title: "财政部浙江监管局：扎实开展中央企业国有资本收益审核工作",
    publishedAt: new Date("2026-08-20T16:00:00.000Z"),
    url: "https://zj.mof.gov.cn/caizhengjiancha/202608/t20260803_3994730.htm",
    category: "fiscal-finance",
    tags: ["财政金融","国有金融资本","财政收支"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】浙江监管局审核中央企业2026年度国有资本收益申报，建立企业台账并核定收益比例，重点检查2025年应缴未缴收益是否补足及申报数据与审计材料是否一致。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-08-20",
      visibleDateLocal: "2026-08-20",
      extractedBodyChars: 1287,
      extractedBodyTextSha256: "f5943b3106f8f8b5565241c6e8dba9aca0cfa1c4782914203159522df36fe5d0",
      sourceArticleContentHash: "aa01f59e2a6b6f470ffc9c80f5125a38de95c90c95fe4d953220ff9351b0fbc3",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-v3mgzkgko9kob778zg8rt4vpo",
    source: { id: "local-preview-sample-v3mgzkgko9kob778zg8rt4vpo", name: "财政部福建监管局·工作动态" },
    originalSourceId: "mof-fujian-supervision-dynamics",
    title: "福建监管局：优化工作流程 强化闭环管理 推动中央转移支付资金绩效自评复核工作提质增效",
    publishedAt: new Date("2026-08-16T16:00:00.000Z"),
    url: "https://fj.mof.gov.cn/gzdt/caizhengjiancha/202608/t20260811_3995249.htm",
    category: "fiscal-policy",
    tags: ["财政政策","转移支付","预算绩效"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】福建监管局对中央转移支付绩效自评开展全覆盖书面复核，并按风险划分任务、交叉复核存疑材料，随后结合线上数据和现场核查检查资金管理与项目产出。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-08-16",
      visibleDateLocal: "2026-08-16",
      extractedBodyChars: 1689,
      extractedBodyTextSha256: "68c3c90a9692c74f5a8ed837d9ddb333140ab10510434252629ddd9954db6c62",
      sourceArticleContentHash: "0721174d152bc06d1096b90d4195da8af2d53e60048cf93cf0ce2eb745219576",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-tv2xhdubccz7vup6vb5g2ap92",
    source: { id: "local-preview-sample-tv2xhdubccz7vup6vb5g2ap92", name: "财政部福建监管局·工作动态" },
    originalSourceId: "mof-fujian-supervision-dynamics",
    title: "财政部福建监管局：五措并举精准发力 赋能部门预算监管提质增效",
    publishedAt: new Date("2026-08-11T16:00:00.000Z"),
    url: "https://fj.mof.gov.cn/gzdt/caizhengjiancha/202608/t20260805_3994925.htm",
    category: "accounting-supervision",
    tags: ["财会监督","预算管理","财政政策"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】福建监管局将部门预决算审核、预算执行监督、特别国债核查、内控与绩效评价等统筹开展，并依托预算管理一体化系统跟踪预警、核实、整改闭环。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-08-11",
      visibleDateLocal: "2026-08-11",
      extractedBodyChars: 2547,
      extractedBodyTextSha256: "a6fcd35e6ff34840bc9e020a0cf6b76369e85917c3c247e683bb781d7dfb75cd",
      sourceArticleContentHash: "22f623b0c7fc1de231365059e52434861437937c5bae07b50fe01f198b697165",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-f8bp7vt0h3b1n6qzib5fxlr2x",
    source: { id: "local-preview-sample-f8bp7vt0h3b1n6qzib5fxlr2x", name: "财政部福建监管局·工作动态" },
    originalSourceId: "mof-fujian-supervision-dynamics",
    title: "福建监管局：下好“五步棋” 扎实推动中央非税收入退付审批工作提质增效",
    publishedAt: new Date("2026-07-27T16:00:00.000Z"),
    url: "https://fj.mof.gov.cn/gzdt/caizhengjiancha/202606/t20260626_3992351.htm",
    category: "fiscal-policy",
    tags: ["财政政策","财政收支","内部控制"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】福建监管局优化中央非税收入退付审批，逐项核验缴费主体、退付事由、入库数据、中央分成比例和金额，并以分级复核、台账留痕控制违规或超额退付风险。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-07-27",
      visibleDateLocal: "2026-07-27",
      extractedBodyChars: 1472,
      extractedBodyTextSha256: "e1587e78e74812dda91f0a2609605153982c26b33b4d115975a8af55ccd3931f",
      sourceArticleContentHash: "af21ff13b80c014f5d7368ef68e1db2ff7d98276eaab2f00e09ef546f71b7eb6",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-g4si0n85kvecp4lbaqt9hz599",
    source: { id: "local-preview-sample-g4si0n85kvecp4lbaqt9hz599", name: "财政部福建监管局·工作动态" },
    originalSourceId: "mof-fujian-supervision-dynamics",
    title: "财政部福建监管局：做实“三个聚焦”推动银行账户年检提质增效",
    publishedAt: new Date("2026-07-15T16:00:00.000Z"),
    url: "https://fj.mof.gov.cn/gzdt/caizhengjiancha/202606/t20260625_3992279.htm",
    category: "accounting-supervision",
    tags: ["财会监督","预算管理","地方实践"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】福建监管局按两年一个周期、每年约50%账户比例开展中央驻闽预算单位银行账户年检，交叉核对账户信息、银行余额和资产负债表，并对异常账户实地核验。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-07-15",
      visibleDateLocal: "2026-07-15",
      extractedBodyChars: 1390,
      extractedBodyTextSha256: "9499ffd8f592ddd864ddd5090d254649456c11c67eb1f2c59b5d6fc110399caf",
      sourceArticleContentHash: "f0ddfb1be4195926968c7045e4d2899efcf3cfdf9d6490563aef584f53b62d80",
      sourceArticleRevision: 2
    },
  },
  {
    id: "local-preview-cphmuf1hx0eboqeswtiiazu5q",
    source: { id: "local-preview-sample-cphmuf1hx0eboqeswtiiazu5q", name: "财政部青海监管局·工作动态" },
    originalSourceId: "mof-qinghai-supervision-dynamics",
    title: "青海监管局：深入高原一线 扎实开展高海拔地区 医疗服务能力提升项目重点绩效评价",
    publishedAt: new Date("2026-10-08T16:00:00.000Z"),
    url: "https://qh.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260922_3997906.htm",
    category: "fiscal-policy",
    tags: ["财政政策","预算绩效","地方实践"],
    summary: "【开发预览·Luna人工摘要；未经模型精选】青海监管局对高海拔地区医疗服务能力项目开展绩效评价，抽取6家市县医院，核查资金、设备采购和项目产出，并赴平均海拔约4100米的玛沁、玛多开展现场调查。",
    editorialAssistant: {
      requestedModel: "gpt-6-luna",
      requestedReasoningEffort: "high",
      actualModel: "unverified",
      pubDateLocal: "2026-10-08",
      visibleDateLocal: "2026-10-08",
      extractedBodyChars: 1525,
      extractedBodyTextSha256: "e5ecabafb66edb85b787f918f016345fa9fe1387a937058b102fed4d437242be",
      sourceArticleContentHash: "0f8d54ad12117f82b0c9dcaab00f37aa0763d3ea844cfe41f47bac0b0b62d419",
      sourceArticleRevision: 2
    },
  }
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
          ...("sourceArticleContentHash" in editorialAssistant ? { sourceArticleContentHash: editorialAssistant.sourceArticleContentHash } : {}),
          ...("sourceArticleRevision" in editorialAssistant ? { sourceArticleRevision: editorialAssistant.sourceArticleRevision } : {}),
          providerPipelineExecuted: false,
          providerReceipts: 0,
          humanGold: false,
        } : { provenance: "AD-012 local development sample", summaryOrigin: "manual", originalBodyStored: false },
        via: "import",
      } as const;
      // Compare persisted JSONB against its JSON representation. Optional metadata properties with
      // `undefined` values are dropped by JSON serialization and must not make an identical preview
      // sample look like an unapproved provenance change.
      const expectedRaw = JSON.parse(JSON.stringify(material.raw));
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
        || !isDeepStrictEqual(prior.raw, expectedRaw))) {
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
