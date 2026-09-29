// 站点身份和读者看得到的文案。换成你的行业时，先改这个文件。
// 网页和后端都读它；改完重新构建（docker compose up --build）即可生效。
// 域名不在这里：部署时用环境变量 SITE_URL 设置。

export const SITE = {
  /** 站名：导航、页面标题、分享图、RSS、MCP、后台都用它。 */
  name: "MyHOT",
  /** 行业词：拼进默认说法里，例如“财政金融日报”“财政金融动态”。 */
  subject: "财政金融",
  /** 首页的完整标题（浏览器标签、搜索结果）。 */
  homeTitle: "财政金融政策与监管热点 · 每日精选与日报",
  /** 一句话介绍：搜索引擎、分享卡片、RSS、llms.txt 会用。 */
  description: "自动跟踪财政、政府债务、金融监管、货币金融、财政金融协同、财会监督及地方实践的一手政策和权威信息，通过筛选、归并和摘要，提炼真正影响财政金融管理与监管工作的变化。",
  /** 首页左上角和侧边栏下面的一行小字。 */
  tagline: "值得关注的财政金融政策与监管动态",
  /** 主题目录页文案与分组；group key 是现有主题存储契约。 */
  topicsPage: {
    title: "按主题看财政金融",
    description: "按机构、重点领域和内容类型浏览主题，持续汇集近期政策与精选。",
    groups: [
      { key: "company", name: "机构", blurb: "按财政金融主管与监管机构追踪政策发布、监管动态和地方实践" },
      { key: "field", name: "重点领域", blurb: "按财政政策、政府债务、金融运行与风险等重点工作浏览" },
      { key: "genre", name: "内容类型", blurb: "按政策发布、数据、监管处罚、地方实践与研究浏览" },
    ],
  },
  /** 界面语言（HTML lang、og:locale）。 */
  locale: "zh-CN",
  /** 默认域名，只在没设置 SITE_URL 时使用。 */
  defaultUrl: "http://localhost:3000",
  /**
   * MCP 工具名的前缀（小写字母、数字、下划线），工具会叫 myhot_get_latest、myhot_search……
   * 已经有人接入后就不要再改。
   */
  mcpPrefix: "myhot",
  /** 对外联系邮箱（选填）：使用规则、llms.txt、响应头里会写。 */
  contactEmail: null as string | null,
  /** 页脚的一行小字（选填）。 */
  footerNote: "财政金融政策与监管信息聚合摘要",
  /** 中国大陆网站的 ICP 备案号（选填），填了就显示在页脚并链接到工信部备案系统。 */
  icp: null as string | null,
  /** 结构化数据里的网站运营者（搜索引擎用）。 */
  organization: {
    name: "MyHOT",
    /** 创始人（选填）：{ name, url, description }。 */
    founder: null as null | { name: string; url?: string; description?: string },
  },
  /** 抓取信源时报上的名字（User-Agent 里用），不要冒用别的站。 */
  crawlerName: "MyHOTBot",
} as const;

/** 关于页的文案。数字（信源数、收录数、精选数、日报期数）来自站内实时统计，不用写在这里。 */
export const ABOUT = {
  kicker: `关于 ${SITE.name}`,
  /** 大标题：第一行正常颜色，第二行强调色。 */
  headline: ["财政金融政策与监管动态，", "每天精选值得关注的变化。"] as [string, string],
  /** 标题下面的一段话。{sources} 会换成实时的信源数。 */
  lead: `${SITE.name} 跟踪 {sources} 个财政金融官方与权威信源，整理政策、数据和监管变化，每天早上 8 点出一份日报。`,
  /** 信源河动画下面的四个环节。 */
  steps: {
    collect: "持续跟踪中央与地方财政金融部门的官网和权威信息，优先核验一手政策、数据与监管动态。",
    store: "保存来源、发布时间与原文链接，并把同一政策的发布、解读和后续进展归到一起。",
    select: "按财政金融管理和监管工作的实际价值筛选，整理准确的中文标题、摘要和推荐理由。",
    publish: "每天 08:00 出日报，周一出周报，每月 1 日出月报，汇总政策、数据、风险与地方实践。",
  },
  /**
   * 作者块（选填），null 就不显示。
   * avatarSourceId：一个 X 账号信源的 id，头像取它的（选填）。
   * 二维码在后台“设置”里上传，或者放进 industry/brand/contact/；没有二维码就不显示那张卡片。
   */
  maker: null as null | {
    name: string;
    greeting: string[];
    avatarSourceId?: string | null;
    wechat?: { title: string; note: string };
    feishu?: { title: string; note: string };
  },
  /** 页面底部的版权与下架说明（结尾会接“反馈页”的链接）。 */
  copyright: `${SITE.name} 是聚合摘要和阅读索引，原文版权归各来源所有。如果你是来源方，希望更正、下架或调整展示方式，可以通过`,
} as const;

/** 行业词和名词之间，英文词加空格，中文词不加。 */
export function withSubject(noun: string): string {
  return /[A-Za-z0-9]$/.test(SITE.subject) ? `${SITE.subject} ${noun}` : `${SITE.subject}${noun}`;
}
