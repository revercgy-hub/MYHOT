import { isIP } from "node:net";

export interface LocalPreviewEnvironment {
  [key: string]: string | undefined;
  LOCAL_PREVIEW_ENABLED?: string;
  LOCAL_PREVIEW_LAN_ENABLED?: string;
  NODE_ENV?: string;
  SITE_URL?: string;
  WEB_HOST?: string;
  WEB_PORT?: string;
  PORT?: string;
  API_BASE_URL?: string;
  DATABASE_URL?: string;
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized === "::1") return true;
  return isIP(normalized) === 4 && normalized.startsWith("127.");
}

function isLoopbackUrl(value: string | undefined, fallback: string): boolean {
  try {
    const url = new URL(value || fallback);
    return (url.protocol === "http:" || url.protocol === "https:") && isLoopbackHost(url.hostname)
      && !url.username && !url.password && !url.search && !url.hash && (url.pathname === "/" || url.pathname === "");
  } catch {
    return false;
  }
}

function isPrivateIpv4(host: string): boolean {
  if (isIP(host) !== 4) return false;
  const [first, second] = host.split(".").map(Number);
  return first === 10 || (first === 172 && second! >= 16 && second! <= 31) || (first === 192 && second === 168);
}

function isLanPreviewSiteUrl(value: string | undefined): boolean {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "http:" && isPrivateIpv4(url.hostname) && url.port === "3000"
      && !url.username && !url.password && !url.search && !url.hash && (url.pathname === "/" || url.pathname === "");
  } catch {
    return false;
  }
}

const LAN_PREVIEW_DATABASE_URL = "postgres://postgres@127.0.0.1:5432/fiscalhot_preview_test";
const LAN_PREVIEW_DISABLED_FLAGS = [
  "COLLECT_ENABLED",
  "MODEL_CALLS_ENABLED",
  "JINA_BODY_FALLBACK",
  "INDEXNOW_SUBMIT_ENABLED",
  "FEISHU_CONTENT_PUSH_ENABLED",
  "FEISHU_INTERNAL_ENABLED",
  "ALLOW_PRIVATE_NETWORK_FETCH",
] as const;

function validateLanPreviewEnvironment(env: LocalPreviewEnvironment): void {
  if (!isLanPreviewSiteUrl(env.SITE_URL)) throw new Error("LAN local preview requires an HTTP private IPv4 SITE_URL on port 3000");
  if (!isLoopbackUrl(env.API_BASE_URL, "http://127.0.0.1:3001")) throw new Error("LAN local preview requires a loopback API_BASE_URL");
  if (env.WEB_HOST !== "0.0.0.0") throw new Error("LAN local preview requires WEB_HOST=0.0.0.0");
  if ((env.WEB_PORT || env.PORT || "3000") !== "3000") throw new Error("LAN local preview requires WEB_PORT=3000");
  if (env.DATABASE_URL !== LAN_PREVIEW_DATABASE_URL) throw new Error("LAN local preview requires the exact loopback fiscalhot_preview_test database URL");
  for (const key of LAN_PREVIEW_DISABLED_FLAGS) {
    if (!/^(false|0)$/i.test(env[key] ?? "")) throw new Error(`LAN local preview requires ${key}=false`);
  }
  if (Object.keys(env).some((key) => key.startsWith("DEV_AUTH_") && !!env[key])) {
    throw new Error("LAN local preview refuses DEV_AUTH_* bypasses");
  }
}

/** Validate the opt-in using server-only configuration; requests cannot enable preview mode. */
export function resolveLocalPreviewEnabled(env: LocalPreviewEnvironment): boolean {
  const enabled = env.LOCAL_PREVIEW_ENABLED === "true" || env.LOCAL_PREVIEW_ENABLED === "1";
  const lanEnabled = env.LOCAL_PREVIEW_LAN_ENABLED === "true" || env.LOCAL_PREVIEW_LAN_ENABLED === "1";
  if (lanEnabled && !enabled) throw new Error("LOCAL_PREVIEW_LAN_ENABLED requires LOCAL_PREVIEW_ENABLED=true");
  if (!enabled) return false;
  if (env.NODE_ENV === "production") throw new Error("LOCAL_PREVIEW_ENABLED is forbidden in production");
  if (lanEnabled) {
    validateLanPreviewEnvironment(env);
    return true;
  }
  if (!isLoopbackUrl(env.SITE_URL, "https://example.invalid")) throw new Error("LOCAL_PREVIEW_ENABLED requires a loopback SITE_URL");
  if (!isLoopbackUrl(env.API_BASE_URL, "http://127.0.0.1:3001")) throw new Error("LOCAL_PREVIEW_ENABLED requires a loopback API_BASE_URL");
  if (!isLoopbackHost(env.WEB_HOST || "127.0.0.1")) throw new Error("LOCAL_PREVIEW_ENABLED requires a loopback WEB_HOST");
  return true;
}

export const LOCAL_PREVIEW_ENABLED = resolveLocalPreviewEnabled(process.env);

const LOCAL_PREVIEW_ARTICLE_IDS = new Set([
  "local-preview-pboc-omo-191",
  "local-preview-mof-budget-qa",
  "local-preview-pboc-xiamen-payment",
  "local-preview-pboc-omo-192",
  "local-preview-mof-debt-202608",
  "local-preview-mof-xiamen-capital-review",
  "local-preview-mof-zhejiang-real-funds",
  "local-preview-mof-zhejiang-transfer-performance",
  "local-preview-mof-zhejiang-fiscal-supervision-202608",
  "local-preview-pboc-omo-189",
  "local-preview-mof-debt-202607",
  "local-preview-mof-xiamen-inclusive-finance",
  "local-preview-mof-fujian-vat-refund-review",
  "local-preview-mof-zhejiang-cpa-law",
  "local-preview-mof-lottery-funds-rules",
  "local-preview-mof-guangxi-accounting-checks",
  "local-preview-mof-hainan-fiscal-management",
  "local-preview-mof-sichuan-budget-monitoring",
  "local-preview-mof-lottery-2025-sales",
  "local-preview-mof-lottery-game-closures",
  "local-preview-pboc-omo-196",
  "local-preview-shanxi-accounting-inspection-2026",
  "local-preview-shanxi-zero-based-budget",
  "local-preview-zhejiang-budget-execution-joint-supervision",
  "local-preview-anhui-special-bonds-2026-batch-9",
  "local-preview-jilin-transfer-payment-performance-loop",
  "local-preview-hunan-state-finance-capital-registration",
  "local-preview-guangdong-central-transfer-supervision",
  "local-preview-dalian-three-guarantees-monitoring",
  "local-preview-xlrwn948i42p6lbi1d1y8eikq",
  "local-preview-swnlrxg3no7zvr7052h992p5x",
  "local-preview-vu1mrn37ph9hriaon9684ea6j",
  "local-preview-e6es8kyasp2l8ad52cgkgx9qp",
  "local-preview-ewiu4lkg7i33olsbgd1x9lcwc",
  "local-preview-fujj4bx366umeljostdaws698",
  "local-preview-j5i5az5u8iuket3cslkxlkgq1",
  "local-preview-gef2vpls83h85b2c83o8fnlmt",
  "local-preview-oywkrh333bn0hxlhfsm7pjm5o",
  "local-preview-kr9s99q6vyucu4m38n7l50qa4",
  "local-preview-ektkjakgwgqg7tuis2mm6pv9w",
  "local-preview-n8nnkqjua32kaswzm5mmbfl0v",
  "local-preview-oiqcqwfsniamp70mzsk5gmpls",
  "local-preview-px2fqcrm4px0xq249n82yi9t4",
  "local-preview-ddnk7nkwwiyhkwl9t3r22x0al",
  "local-preview-vbkawm7m8izokp7k6jttwf05v",
  "local-preview-aosixdekxw78xgtxarnrhcfyi",
  "local-preview-ukqu31m5j0rauy7wu69mhjgrv",
  "local-preview-v6lm8um8188rn6k1vra5fzyzn",
  "local-preview-b0kvpev8vj8jakulbky07v8ob",
  "local-preview-q1ztd2w8qe42q0mlfwnweb5ya",
  "local-preview-w2lu0aoru9j93a0j0pw121ufe",
  "local-preview-wx4k8brv7nyil4l41r8drgy17",
  "local-preview-sxqkd3domfod5qdgkm35gwdys",
  "local-preview-ylutigzgsep8kq0vcg5vrrap0",
  "local-preview-v3mgzkgko9kob778zg8rt4vpo",
  "local-preview-tv2xhdubccz7vup6vb5g2ap92",
  "local-preview-f8bp7vt0h3b1n6qzib5fxlr2x",
  "local-preview-g4si0n85kvecp4lbaqt9hz599",
  "local-preview-cphmuf1hx0eboqeswtiiazu5q",
  "local-preview-luna-cifomaa7avwqodozefwe79hn7",
  "local-preview-luna-inpgk81jtbkc79h4u5nmx6dyl",
  "local-preview-luna-no0f0gyhmml83o386b06t99fp",
  "local-preview-luna-ss2xzkxmn9jv0dc2x5eqle5mz",
  "local-preview-luna-vynkluz0lhfrxo8xkm0iauymb",
  "local-preview-luna-yxh1bxed0k1v3e8wm08dc6bep",
]);

export function isLocalPreviewArticleId(id: string): boolean {
  return LOCAL_PREVIEW_ARTICLE_IDS.has(id);
}
