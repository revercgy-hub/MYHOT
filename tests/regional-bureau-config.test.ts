import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { unsupportedConfig } from "@aihot/backend/sources/config-keys";
import { fetchDetail, fromHtml } from "@aihot/backend/sources/web-list";

const sourcesFile = new URL("../industry/sources.json", import.meta.url);
const fixtureUrl = (name: string) => new URL(`./fixtures/regional-bureaus/${name}`, import.meta.url);
const strictBodyIds = new Set([
  "mof-xiamen-supervision-dynamics",
  "mof-beijing-supervision-dynamics",
  "mof-shanghai-supervision-dynamics",
  "mof-henan-supervision-dynamics",
  "mof-hubei-supervision-dynamics",
  "mof-hunan-supervision-dynamics",
  "mof-guangdong-supervision-dynamics",
  "mof-fujian-supervision-dynamics",
  "mof-guangxi-supervision-dynamics",
  "mof-hainan-supervision-dynamics",
  "mof-chongqing-supervision-dynamics",
  "mof-sichuan-supervision-dynamics",
  "mof-ningxia-supervision-dynamics",
  "mof-qinghai-supervision-dynamics",
  "mof-shaanxi-supervision-dynamics",
  "mof-guizhou-supervision-dynamics",
  "mof-gansu-supervision-dynamics",
  "mof-tianjin-supervision-dynamics",
  "mof-hebei-supervision-dynamics",
  "mof-shanxi-supervision-dynamics",
  "mof-inner-mongolia-supervision-dynamics",
  "mof-jilin-supervision-dynamics",
  "mof-heilongjiang-supervision-dynamics",
  "mof-shandong-supervision-dynamics",
  "mof-jiangsu-supervision-dynamics",
  "mof-anhui-supervision-dynamics",
  "mof-jiangxi-supervision-dynamics",
  "mof-xinjiang-supervision-dynamics",
  "mof-zhejiang-supervision-dynamics",
  "mof-liaoning-supervision-dynamics",
  "mof-yunnan-supervision-dynamics",
  "mof-dalian-supervision-dynamics",
  "mof-ningbo-supervision-dynamics",
  "mof-shenzhen-supervision-dynamics",
  "mof-qingdao-supervision-dynamics",
]);
const sourceDoc = JSON.parse(readFileSync(sourcesFile, "utf8")) as {
  sources: Array<{
    id: string;
    name: string;
    kind: string;
    owner_entity_id?: string;
    config: Record<string, any>;
    tier: string;
    first_party: boolean;
    interval_minutes: number;
    site_fulltext: boolean;
    syndicate_fulltext: boolean;
    enabled: boolean;
  }>;
};

const expected = [
  {
    id: "mof-fujian-supervision-dynamics",
    bureau: "fujian",
    url: "https://fj.mof.gov.cn/gzdt/caizhengjiancha/",
    article: "https://fj.mof.gov.cn/gzdt/caizhengjiancha/202608/t20260828_3996275.htm",
    title: "财政部福建监管局：“三强化”提升资源综合利用增值税即征即退政策复查工作质量",
    listDate: "2026-09-22T00:00:00+08:00",
    detailTitle: "财政部福建监管局：“三强化”提升资源综合利用增值税即征即退政策复查工作质量",
    detailDate: "2026-09-22 08:21:00",
    parsedDetailTitle: null,
  },
  {
    id: "mof-beijing-supervision-dynamics",
    bureau: "beijing",
    url: "https://bj.mof.gov.cn/caizhengjiancha/",
    article: "https://bj.mof.gov.cn/caizhengjiancha/202609/t20260924_3998098.htm",
    title: "财政部北京监管局：坚持“四个进阶”提升属地中央预算单位预算编制审核质效",
    listDate: "2026-09-24T00:00:00+08:00",
    detailTitle: "北京监管局：坚持“四个进阶”提升属地中央预算单位预算编制审核质效",
    detailDate: "2026-09-30 08:39:00",
    parsedDetailTitle: "北京监管局：坚持“四个进阶”提升属地中央预算单位预算编制审核质效",
  },
  {
    id: "mof-shanghai-supervision-dynamics",
    bureau: "shanghai",
    url: "https://sh.mof.gov.cn/gzdt/caizhengjiancha/",
    article: "https://sh.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260923_3998015.htm",
    title: "财政部上海监管局四维靶向施策 扎实推进增值税留抵退税抽审提质增效",
    listDate: "2026-09-23T00:00:00+08:00",
    detailTitle: "财政部上海监管局四维靶向施策 扎实推进增值税留抵退税抽审提质增效",
    detailDate: "2026-09-23 15:09:00",
    parsedDetailTitle: null,
  },
  {
    id: "mof-henan-supervision-dynamics",
    bureau: "henan",
    url: "https://ha.mof.gov.cn/caizhengjiancha/",
    article: "https://ha.mof.gov.cn/caizhengjiancha/202609/t20260930_3998389.htm",
    title: "财政部河南监管局：多措并举 推动绩效评价工作高质量开展",
    listDate: "2026-09-30T00:00:00+08:00",
    detailTitle: "财政部河南监管局：多措并举 推动绩效评价工作高质量开展",
    detailDate: "2026-09-30 11:16:00",
    parsedDetailTitle: "财政部河南监管局：多措并举 推动绩效评价工作高质量开展",
  },
  {
    id: "mof-hubei-supervision-dynamics",
    bureau: "hubei",
    url: "https://hb.mof.gov.cn/gzdt2019/caizhengjiancha/",
    article: "https://hb.mof.gov.cn/gzdt2019/caizhengjiancha/202609/t20260929_3998269.htm",
    title: "财政部湖北监管局：湖北监管局在第八届“财青8+” 青年调研中再创佳绩",
    listDate: "2026-09-29T00:00:00+08:00",
    detailTitle: "财政部湖北监管局：湖北监管局在第八届“财青8+” 青年调研中再创佳绩",
    detailDate: "2026-09-29 09:00:00",
    parsedDetailTitle: "财政部湖北监管局：湖北监管局在第八届“财青8+” 青年调研中再创佳绩",
  },
  {
    id: "mof-hunan-supervision-dynamics",
    bureau: "hunan",
    url: "https://hn.mof.gov.cn/caizhengjiancha/",
    article: "https://hn.mof.gov.cn/caizhengjiancha/202609/t20260930_3998467.htm",
    title: "财政部湖南监管局组织开展公文、保密和内控工作培训",
    listDate: "2026-09-30T00:00:00+08:00",
    detailTitle: "财政部湖南监管局组织开展公文、保密和内控工作培训",
    detailDate: "2026-09-30 15:14:00",
    parsedDetailTitle: "财政部湖南监管局组织开展公文、保密和内控工作培训",
  },
  {
    id: "mof-guangdong-supervision-dynamics",
    bureau: "guangdong",
    url: "https://gd.mof.gov.cn/caizhengjiancha/",
    article: "https://gd.mof.gov.cn/caizhengjiancha/202609/t20260928_3998195.htm",
    title: "广东监管局：健全“四个突出”监管体系，持续提升中央转移支付资金监管质效",
    listDate: "2026-09-28T00:00:00+08:00",
    detailTitle: "广东监管局：健全“四个突出”监管体系，持续提升中央转移支付资金监管质效",
    detailDate: "2026-09-28 10:49:00",
    parsedDetailTitle: "广东监管局：健全“四个突出”监管体系，持续提升中央转移支付资金监管质效",
  },
  {
    id: "mof-guangxi-supervision-dynamics",
    bureau: "guangxi",
    url: "https://gx.mof.gov.cn/gzdt/caizhengjiancha/",
    article: "https://gx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260929_3998321.htm",
    title: "广西监管局：三维聚力推动会计监督检查提质增效",
    listDate: "2026-09-29T00:00:00+08:00",
    detailTitle: "广西监管局：三维聚力推动会计监督检查提质增效",
    detailDate: "2026-09-29 15:51:00",
    parsedDetailTitle: "广西监管局：三维聚力推动会计监督检查提质增效",
  },
  {
    id: "mof-hainan-supervision-dynamics",
    bureau: "hainan",
    url: "https://hq.mof.gov.cn/caizhengjiancha/",
    article: "https://hq.mof.gov.cn/caizhengjiancha/202609/t20260930_3998477.htm",
    title: "财政部海南监管局：传承红色家风 涵养清廉正气",
    listDate: "2026-09-30T00:00:00+08:00",
    detailTitle: "财政部海南监管局：传承红色家风 涵养清廉正气",
    detailDate: "2026-09-30 15:53:00",
    parsedDetailTitle: "财政部海南监管局：传承红色家风 涵养清廉正气",
  },
  {
    id: "mof-chongqing-supervision-dynamics",
    bureau: "chongqing",
    url: "https://cq.mof.gov.cn/gzdt2019/caizhengjiancha/",
    article: "https://cq.mof.gov.cn/gzdt2019/caizhengjiancha/202609/t20260930_3998376.htm",
    title: "财政部重庆监管局：监管五处党支部开展 “护航网络安全 赋能财会监督”网络安全学习",
    listDate: "2026-09-30T00:00:00+08:00",
    detailTitle: "财政部重庆监管局：监管五处党支部开展 “护航网络安全 赋能财会监督”网络安全学习",
    detailDate: "2026-09-30 10:09:00",
    parsedDetailTitle: "财政部重庆监管局：监管五处党支部开展 “护航网络安全 赋能财会监督”网络安全学习",
  },
  {
    id: "mof-sichuan-supervision-dynamics",
    bureau: "sichuan",
    url: "https://sc.mof.gov.cn/caizhengjiancha/",
    article: "https://sc.mof.gov.cn/caizhengjiancha/202609/t20260928_3998248.htm",
    title: "财政部四川监管局：加强沟通 密切协作用心用情做好服务代表委员工作",
    listDate: "2026-09-28T00:00:00+08:00",
    detailTitle: "财政部四川监管局：加强沟通 密切协作用心用情做好服务代表委员工作",
    detailDate: "2026-09-28 16:37:00",
    parsedDetailTitle: "财政部四川监管局：加强沟通 密切协作用心用情做好服务代表委员工作",
  },
  {
    id: "mof-ningxia-supervision-dynamics",
    bureau: "ningxia",
    url: "https://nx.mof.gov.cn/caizhengjiancha/",
    article: "https://nx.mof.gov.cn/caizhengjiancha/202609/t20260930_3998460.htm",
    title: "财政部宁夏监管局召开2026年中央转移支付监管工作座谈会",
    listDate: "2026-09-30T00:00:00+08:00",
    detailTitle: "财政部宁夏监管局召开2026年中央转移支付监管工作座谈会",
    detailDate: "2026-09-30 15:06:00",
    parsedDetailTitle: "财政部宁夏监管局召开2026年中央转移支付监管工作座谈会",
  },
  {
    id: "mof-qinghai-supervision-dynamics",
    bureau: "qinghai",
    url: "https://qh.mof.gov.cn/gzdt/caizhengjiancha/",
    article: "https://qh.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260930_3998464.htm",
    title: "财政部青海监管局：深学细悟民族法规 筑牢高原民族团结法治根基",
    listDate: "2026-09-30T00:00:00+08:00",
    detailTitle: "财政部青海监管局：深学细悟民族法规 筑牢高原民族团结法治根基",
    detailDate: "2026-09-30 15:12:00",
    parsedDetailTitle: "财政部青海监管局：深学细悟民族法规 筑牢高原民族团结法治根基",
  },
  {
    id: "mof-shaanxi-supervision-dynamics",
    bureau: "shaanxi",
    url: "https://sx.mof.gov.cn/gzdt/caizhengjiancha/",
    article: "https://sx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260930_3998367.htm",
    title: "财政部陕西监管局开展中秋、国庆 “双节”廉洁、安全提醒",
    listDate: "2026-09-30T00:00:00+08:00",
    detailTitle: "财政部陕西监管局开展中秋、国庆 “双节”廉洁、安全提醒",
    detailDate: "2026-09-30 09:45:00",
    parsedDetailTitle: "财政部陕西监管局开展中秋、国庆 “双节”廉洁、安全提醒",
  },
  {
    id: "mof-guizhou-supervision-dynamics",
    bureau: "guizhou",
    url: "https://gz.mof.gov.cn/caizhengjiancha/",
    article: "https://gz.mof.gov.cn/caizhengjiancha/202609/t20260923_3998000.htm",
    title: "财政部贵州监管局：打造“1+5”模式 推动机关文化建设提质增效",
    listDate: "2026-09-23T00:00:00+08:00",
    detailTitle: "财政部贵州监管局：打造“1+5”模式 推动机关文化建设提质增效",
    detailDate: "2026-09-23 10:55:00",
    parsedDetailTitle: "财政部贵州监管局：打造“1+5”模式 推动机关文化建设提质增效",
  },
  {
    id: "mof-gansu-supervision-dynamics",
    bureau: "gansu",
    url: "https://gs.mof.gov.cn/gzdt/caizhengjiancha/",
    article: "https://gs.mof.gov.cn/gzdt/caizhengjiancha/202608/t20260821_3995880.htm",
    title: "财政部甘肃监管局：构建“一二三”监管体系 推动甘肃中央财政监管工作提质增效",
    listDate: "2026-09-04T00:00:00+08:00",
    detailTitle: "财政部甘肃监管局：构建“一二三”监管体系 推动甘肃中央财政监管工作提质增效",
    detailDate: "2026-09-04 08:19:00",
    parsedDetailTitle: "财政部甘肃监管局：构建“一二三”监管体系 推动甘肃中央财政监管工作提质增效",
  },
  {
    id: "mof-qingdao-supervision-dynamics",
    bureau: "qingdao",
    url: "https://qd.mof.gov.cn/gzdt/caizhengjiancha/",
    article: "https://qd.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260930_3998487.htm",
    title: "情暖中秋树新风 清风润家促文明 ——财政部青岛监管局开展“我们的节日·中秋”系列活动",
    listDate: "2026-09-30T00:00:00+08:00",
    detailTitle: "情暖中秋树新风 清风润家促文明 ——财政部青岛监管局开展“我们的节日·中秋”系列活动",
    detailDate: "2026-09-30 16:33:00",
    parsedDetailTitle: "情暖中秋树新风 清风润家促文明 ——财政部青岛监管局开展“我们的节日·中秋”系列活动",
  },
  {
    id: "mof-dalian-supervision-dynamics",
    bureau: "dalian",
    url: "https://dl.mof.gov.cn/caizhengjiancha/",
    article: "https://dl.mof.gov.cn/caizhengjiancha/202609/t20260930_3998449.htm",
    title: "财政部大连监管局开展节前警示教育 筑牢廉洁过节防线",
    listDate: "2026-09-30T00:00:00+08:00",
    detailTitle: "财政部大连监管局开展节前警示教育 筑牢廉洁过节防线",
    detailDate: "2026-09-30 14:33:00",
    parsedDetailTitle: "财政部大连监管局开展节前警示教育 筑牢廉洁过节防线",
  },
  {
    id: "mof-ningbo-supervision-dynamics",
    bureau: "ningbo",
    url: "https://nb.mof.gov.cn/caizhengjiancha/",
    article: "https://nb.mof.gov.cn/caizhengjiancha/202609/t20260930_3998450.htm",
    title: "财政部宁波监管局：参加宁波市直机关工委理论宣讲活动",
    listDate: "2026-09-30T00:00:00+08:00",
    detailTitle: "财政部宁波监管局：参加宁波市直机关工委理论宣讲活动",
    detailDate: "2026-09-30 14:31:00",
    parsedDetailTitle: "财政部宁波监管局：参加宁波市直机关工委理论宣讲活动",
  },
  {
    id: "mof-shenzhen-supervision-dynamics",
    bureau: "shenzhen",
    url: "https://sz.mof.gov.cn/caizhengjiancha/",
    article: "https://sz.mof.gov.cn/caizhengjiancha/202609/t20260929_3998295.htm",
    title: "深圳监管局：监管三处专题学习《中华人民共和国注册会计师法》",
    listDate: "2026-09-29T00:00:00+08:00",
    detailTitle: "深圳监管局：监管三处专题学习《中华人民共和国注册会计师法》",
    detailDate: "2026-09-29 10:42:00",
    parsedDetailTitle: "深圳监管局：监管三处专题学习《中华人民共和国注册会计师法》",
  },
  {
    id: "mof-tianjin-supervision-dynamics",
    bureau: "tianjin",
    url: "https://tj.mof.gov.cn/gzdt2/caizhengjiancha/",
    article: "https://tj.mof.gov.cn/gzdt2/caizhengjiancha/202609/t20260929_3998309.htm",
    title: "财政部天津监管局：三维联动抓培训 多点发力促落实——以高质量培训推动过紧日子要求见行见效",
    listDate: "2026-09-29T00:00:00+08:00",
    detailTitle: "财政部天津监管局：三维联动抓培训 多点发力促落实——以高质量培训推动过紧日子要求见行见效",
    detailDate: "2026-09-29 14:29:00",
    parsedDetailTitle: "财政部天津监管局：三维联动抓培训 多点发力促落实——以高质量培训推动过紧日子要求见行见效",
  },
  {
    id: "mof-hebei-supervision-dynamics",
    bureau: "hebei",
    url: "https://he.mof.gov.cn/caizhengjiancha/",
    article: "https://he.mof.gov.cn/caizhengjiancha/202609/t20260915_3997463.htm",
    title: "财政部河北监管局：立足三个导向扎实开展中小企业发展专项资金重点绩效评价工作",
    listDate: "2026-09-15T00:00:00+08:00",
    detailTitle: "财政部河北监管局：立足三个导向扎实开展中小企业发展专项资金重点绩效评价工作",
    detailDate: "2026-09-15 15:23:00",
    parsedDetailTitle: "财政部河北监管局：立足三个导向扎实开展中小企业发展专项资金重点绩效评价工作",
  },
  {
    id: "mof-shanxi-supervision-dynamics",
    bureau: "shanxi",
    url: "https://sn.mof.gov.cn/gzdt/caizhengjiancha/",
    article: "https://sn.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260930_3998420.htm",
    title: "山西监管局：优化监督检查廉政防控体系 锻造责任担当财会监督铁军",
    listDate: "2026-09-30T00:00:00+08:00",
    detailTitle: "山西监管局：优化监督检查廉政防控体系 锻造责任担当财会监督铁军",
    detailDate: "2026-09-30 11:48:00",
    parsedDetailTitle: "山西监管局：优化监督检查廉政防控体系 锻造责任担当财会监督铁军",
  },
  {
    id: "mof-inner-mongolia-supervision-dynamics",
    bureau: "inner-mongolia",
    url: "https://nmg.mof.gov.cn/caizhengjiancha/",
    article: "https://nmg.mof.gov.cn/caizhengjiancha/202609/t20260923_3998041.htm",
    title: "财政部内蒙古监管局：坚持“四维发力” 持续推动财政收入监管提质增效",
    listDate: "2026-09-23T00:00:00+08:00",
    detailTitle: "财政部内蒙古监管局：坚持“四维发力” 持续推动财政收入监管提质增效",
    detailDate: "2026-09-23 17:41:00",
    parsedDetailTitle: "财政部内蒙古监管局：坚持“四维发力” 持续推动财政收入监管提质增效",
  },
  {
    id: "mof-jilin-supervision-dynamics",
    bureau: "jilin",
    url: "https://jl.mof.gov.cn/caizhengjiancha/",
    article: "https://jl.mof.gov.cn/caizhengjiancha/202609/t20260930_3998472.htm",
    title: "财政部吉林监管局：构建闭环管理机制 推动绩效管理提质增效",
    listDate: "2026-09-30T00:00:00+08:00",
    detailTitle: "财政部吉林监管局：构建闭环管理机制 推动绩效管理提质增效",
    detailDate: "2026-09-30 15:46:00",
    parsedDetailTitle: "财政部吉林监管局：构建闭环管理机制推动绩效管理提质增效",
  },
  {
    id: "mof-heilongjiang-supervision-dynamics",
    bureau: "heilongjiang",
    url: "https://hlj.mof.gov.cn/caizhengjiancha/",
    article: "https://hlj.mof.gov.cn/caizhengjiancha/202609/t20260929_3998307.htm",
    title: "黑龙江监管局：监管三处组织学习《改善普通高中学校办学条件补助资金管理办法》",
    listDate: "2026-09-29T00:00:00+08:00",
    detailTitle: "黑龙江监管局：监管三处组织学习《改善普通高中学校办学条件补助资金管理办法》",
    detailDate: "2026-09-29 14:14:00",
    parsedDetailTitle: "黑龙江监管局：监管三处组织学习《改善普通高中学校办学条件补助资金管理办法》",
  },
  {
    id: "mof-shandong-supervision-dynamics",
    bureau: "shandong",
    url: "https://sd.mof.gov.cn/gzdt/caizhengjiancha/",
    article: "https://sd.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260922_3997968.htm",
    title: "山东监管局：三维发力抓实中小企业专项资金重点绩效评价 推动惠企政策落地见效",
    listDate: "2026-09-29T00:00:00+08:00",
    detailTitle: "山东监管局：三维发力抓实中小企业专项资金重点绩效评价 推动惠企政策落地见效",
    detailDate: "2026-09-29 08:34:00",
    parsedDetailTitle: "山东监管局：三维发力抓实中小企业专项资金重点绩效评价推动惠企政策落地见效",
  },
  {
    id: "mof-jiangsu-supervision-dynamics",
    bureau: "jiangsu",
    url: "https://jsz.mof.gov.cn/caizhengjiancha/",
    article: "https://jsz.mof.gov.cn/caizhengjiancha/202609/t20260930_3998382.htm",
    title: "财政部江苏监管局总结树立和践行正确政绩观学习教育开展情况",
    listDate: "2026-09-30T00:00:00+08:00",
    detailTitle: "财政部江苏监管局总结树立和践行正确政绩观学习教育开展情况",
    detailDate: "2026-09-30 11:01:00",
    parsedDetailTitle: "财政部江苏监管局总结树立和践行正确政绩观学习教育开展情况",
  },
  {
    id: "mof-anhui-supervision-dynamics",
    bureau: "anhui",
    url: "https://ah.mof.gov.cn/caizhengjiancha/",
    article: "https://ah.mof.gov.cn/caizhengjiancha/202609/t20260930_3998374.htm",
    title: "财政部安徽监管局：派员现场观察安徽省2026年第九批地方政府债券发行工作",
    listDate: "2026-09-30T00:00:00+08:00",
    detailTitle: "财政部安徽监管局：派员现场观察安徽省2026年第九批地方政府债券发行工作",
    detailDate: "2026-09-30 09:51:00",
    parsedDetailTitle: "财政部安徽监管局：派员现场观察安徽省2026年第九批地方政府债券发行工作",
  },
  {
    id: "mof-jiangxi-supervision-dynamics",
    bureau: "jiangxi",
    url: "https://jx.mof.gov.cn/gzdt/caizhengjiancha/",
    article: "https://jx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260930_3998513.htm",
    title: "财政部江西监管局：在2025年度财政部“三优”评选和第八届“财青8+”青年调研活动中取得好成绩",
    listDate: "2026-09-30T00:00:00+08:00",
    detailTitle: "财政部江西监管局：在2025年度财政部“三优”评选和第八届“财青8+”青年调研活动中取得好成绩",
    detailDate: "2026-09-30 18:10:00",
    parsedDetailTitle: "财政部江西监管局：在2025年度财政部“三优”评选和第八届“财青8+”青年调研活动中取得好成绩",
  },
  {
    id: "mof-xinjiang-supervision-dynamics",
    bureau: "xinjiang",
    url: "https://xj.mof.gov.cn/caizhengjiancha/",
    article: "https://xj.mof.gov.cn/caizhengjiancha/202607/t20260717_3993738.htm",
    title: "新疆监管局：创新四维监管模式 筑牢兵团转移支付资金安全防线",
    listDate: "2026-09-24T00:00:00+08:00",
    detailTitle: "新疆监管局：创新四维监管模式 筑牢兵团转移支付资金安全防线",
    detailDate: "2026-09-24 08:32:00",
    parsedDetailTitle: "新疆监管局：创新四维监管模式 筑牢兵团转移支付资金安全防线",
  },
  {
    id: "mof-zhejiang-supervision-dynamics",
    bureau: "zhejiang",
    url: "https://zj.mof.gov.cn/caizhengjiancha/",
    article: "https://zj.mof.gov.cn/caizhengjiancha/202609/t20260930_3998386.htm",
    title: "浙江监管局：协同推进 建立预算执行常态化监督联合工作机制",
    listDate: "2026-09-30T00:00:00+08:00",
    detailTitle: "浙江监管局：协同推进 建立预算执行常态化监督联合工作机制",
    detailDate: "2026-09-30 11:13:00",
    parsedDetailTitle: "浙江监管局：协同推进 建立预算执行常态化监督联合工作机制",
  },
  {
    id: "mof-liaoning-supervision-dynamics",
    bureau: "liaoning",
    url: "https://ln.mof.gov.cn/gzdt2/caizhengjiancha/",
    article: "https://ln.mof.gov.cn/gzdt2/caizhengjiancha/202608/t20260813_3995391.htm",
    title: "财政部辽宁监管局：“三个坚持”扎实推进农村环境整治资金重点绩效评价工作",
    listDate: "2026-08-26T00:00:00+08:00",
    detailTitle: "财政部辽宁监管局：“三个坚持”扎实推进农村环境整治资金重点绩效评价工作",
    detailDate: "2026-08-26 08:16:00",
    parsedDetailTitle: "财政部辽宁监管局：“三个坚持”扎实推进农村环境整治资金重点绩效评价工作",
  },
  {
    id: "mof-yunnan-supervision-dynamics",
    bureau: "yunnan",
    url: "https://yn.mof.gov.cn/caizhengjiancha/",
    article: "https://yn.mof.gov.cn/caizhengjiancha/202608/t20260821_3995882.htm",
    title: "财政部云南监管局：线上赋能 线下核查 多维统筹持续提升转移支付预算执行常态化监督质效",
    listDate: "2026-08-27T00:00:00+08:00",
    detailTitle: "财政部云南监管局：线上赋能 线下核查 多维统筹持续提升转移支付预算执行常态化监督质效",
    detailDate: "2026-08-27 08:58:00",
    parsedDetailTitle: "财政部云南监管局：线上赋能 线下核查 多维统筹持续提升转移支付预算执行常态化监督质效",
    denyUrlPrefixes: ["https://yn.mof.gov.cn/caizhengjiancha/202609/t20260918_3997724.htm"],
  },
];

test("regional bureau disabled configs match the saved list DOMs and detail metadata", async () => {
  const sources = sourceDoc.sources.filter((source) => expected.some(({ id }) => id === source.id));
  assert.deepEqual(sources.map(({ id }) => id), expected.map(({ id }) => id));

  for (const spec of expected) {
    const source = sources.find(({ id }) => id === spec.id)!;
    const config = source.config;
    assert.equal(source.kind, "web_list");
    assert.equal(source.tier, "T1");
    assert.equal(source.first_party, true);
    assert.equal(source.interval_minutes, 1440);
    assert.equal(source.enabled, false);
    assert.equal(source.site_fulltext, false);
    assert.equal(source.syndicate_fulltext, false);
    assert.deepEqual(config._aihot, {
      initialBackfillMonths: 3,
      initialBackfillRequirePublishedAt: true,
      ...(strictBodyIds.has(spec.id) ? { requireBodyReadyForAutomaticSelection: true } : {}),
    });
    assert.deepEqual(unsupportedConfig("web_list", config), []);
    assert.equal(config.url, spec.url);
    assert.deepEqual(config.allowUrlPrefixes, [spec.url]);
    assert.deepEqual(config.denyUrlPrefixes ?? [], spec.denyUrlPrefixes ?? []);
    assert.equal(config.itemSelector, "div.mainboxerji > div.zzright > div.listBox > ul.liBox > li");
    assert.equal(config.linkSelector, "a[href]");
    assert.equal(config.titleSelector, "a");
    assert.equal(config.titleAttribute, "title");
    assert.equal(config.publishedAtSelector, "span");
    assert.equal(config.publishedAtUtcOffset, "+08:00");
    if (["henan", "hubei", "hunan", "guangdong", "ningxia", "qinghai", "shaanxi", "guizhou", "dalian", "ningbo", "shenzhen", "qingdao", "gansu", "tianjin", "hebei", "shanxi", "inner-mongolia", "jilin", "heilongjiang", "shandong", "jiangsu", "anhui", "jiangxi", "xinjiang", "zhejiang"].includes(spec.bureau)) {
      assert.equal(source.owner_entity_id, "mof");
      assert.equal(config.detail.titleSelector, "h2.title_con");
      assert.equal(config.detail.titleAuthoritative, undefined);
      assert.equal(config.detail.publishedAtAuthoritative, undefined);
    }
    if (spec.bureau === "liaoning" || spec.bureau === "yunnan") {
      assert.equal(source.owner_entity_id, "mof");
      assert.equal(config.detail.titleSelector, "h2.title_con");
      assert.equal(config.detail.titleAuthoritative, undefined);
      assert.equal(config.detail.publishedAtAuthoritative, undefined);
    }

    const listHtml = readFileSync(fixtureUrl(`${spec.bureau}-list.html`), "utf8");
    const candidates = fromHtml(listHtml, spec.url, { id: spec.id, config } as never);
    assert.equal(candidates.length, 1);
    assert.deepEqual(candidates.map(({ url, title, publishedAt }) => [url, title, publishedAt?.toISOString()]), [
      [spec.article, spec.title, new Date(spec.listDate).toISOString()],
    ]);
    if (spec.id === "mof-yunnan-supervision-dynamics") {
      const conflictUrl = "https://yn.mof.gov.cn/caizhengjiancha/202609/t20260918_3997724.htm";
      assert.equal(candidates.some(({ url }) => url === conflictUrl), false, "known date-conflict item must be denied");
      assert.equal(candidates.some(({ url }) => url === spec.article), true, "the separately paired alternate remains allowed");
    }

    const detail = config.detail;
    assert.equal(detail.maxFetches, 10);
    assert.equal(detail.bodySelector, ".my_doccontent");
    assert.equal(detail.publishedAtUtcOffset, "+08:00");
    assert.equal(detail.publishedAtRegex, '<meta\\s+name="PubDate"\\s+content="([^"]+)');
    // Shenzhen's saved ArticleTitle contains an encoded <br> absent from h2/list; strict identity must hold body readiness.
    const checksBody = strictBodyIds.has(spec.id) && spec.id !== "mof-shenzhen-supervision-dynamics";
    let detailHtml = readFileSync(fixtureUrl(`${spec.bureau}-detail.html`), "utf8");
    if (checksBody) {
      const syntheticBody = Array.from({ length: 4 }, () => "<p>Synthetic body paragraph for selector verification; no official article text is copied.</p>").join("");
      detailHtml = detailHtml.replace(/(<div class="my_doccontent">)[\s\S]*?(<\/div>)/, (_match, start: string, end: string) => `${start}${syntheticBody}${end}`);
    }
    let reads = 0;
    const expectedDetailDate = new Date(`${spec.detailDate.replace(" ", "T")}+08:00`);
    const metadata = await fetchDetail(spec.article, { id: spec.id, kind: "web_list", config } as never,
      { date: true, title: true, summary: false, body: checksBody, ...(checksBody ? { expectedTitle: spec.detailTitle, expectedPublishedAt: expectedDetailDate } : {}) }, {
        fetcher: async (url) => {
          reads += 1;
          return { status: 200, url, headers: new Headers({ "content-type": "text/html; charset=utf-8" }), body: Buffer.from(detailHtml), text: () => detailHtml };
        },
      });
    assert.equal(reads, 1);
    assert.equal(metadata.publishedAt?.toISOString(), expectedDetailDate.toISOString());
    assert.equal(metadata.title, spec.parsedDetailTitle);
    if (checksBody) {
      assert.ok(metadata.body?.text && metadata.body.text.length >= 200, `${spec.id} extracts the configured body fixture`);
      assert.ok(metadata.body!.text.includes("Synthetic body paragraph"), `${spec.id} body comes from .my_doccontent`);
      assert.ok(!metadata.body!.text.includes("DETAIL-CHROME-SHOULD-NOT-LEAK"), `${spec.id} excludes page chrome`);
    }
  }

  const beijing = sources.find(({ id }) => id === "mof-beijing-supervision-dynamics")!.config.detail;
  assert.equal(beijing.titleSelector, "h2.title_con");
  assert.equal(beijing.titleAuthoritative, true);
  assert.equal(beijing.publishedAtAuthoritative, true);
  for (const id of ["mof-ningxia-supervision-dynamics", "mof-qinghai-supervision-dynamics", "mof-shaanxi-supervision-dynamics", "mof-guizhou-supervision-dynamics"]) {
    const source = sources.find((candidate) => candidate.id === id)!;
    assert.deepEqual(source.config._aihot, { initialBackfillMonths: 3, initialBackfillRequirePublishedAt: true, requireBodyReadyForAutomaticSelection: true });
    assert.equal(source.owner_entity_id, "mof");
  }
  for (const source of sources.filter(({ id }) => id !== "mof-beijing-supervision-dynamics")) {
    assert.equal(source.config.detail.titleAuthoritative, undefined);
    assert.equal(source.config.detail.publishedAtAuthoritative, undefined);
  }
});
