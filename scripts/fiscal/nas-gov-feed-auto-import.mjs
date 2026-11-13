#!/usr/bin/env node
/** Auto-configure and import government notice feeds.
 *  For each candidate it finds the list container that holds the most dated entries, records the
 *  inferred selector, fetches the detail body and upserts through the canonical writer.
 *  Usage: node … [--dry] [--limit=20] [--only=xm-cz,hn] */
import * as cheerio from "cheerio";
import { sql, closeDb } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";

const FEEDS = [
  // Xiamen government bodies
  ["xm-cz-finance", "厦门市财政局·政务公开", "https://cz.xm.gov.cn/zwxx/"],
  ["xm-cz-policy", "厦门市财政局·政策解读", "https://cz.xm.gov.cn/zwxx/zcjd/"],
  ["xm-gov-open", "厦门市政府·政务公开", "https://www.xm.gov.cn/zwgk/"],
  ["xm-tax-policy", "厦门市税务局·政策文件", "http://xiamen.chinatax.gov.cn/xmswcms/zcwj.html"],
  ["xm-tax-open", "厦门市税务局·信息公开", "http://xiamen.chinatax.gov.cn/xmswcms/xxgk.html"],
  // Provincial finance departments with dated lists
  ["sc-finance-docs", "四川省财政厅·规范性文件", "https://czt.sc.gov.cn/scczt/xzgfxwj/gfxwj_list.shtml"],
  ["hn-finance-notices", "湖南省财政厅·通知公告", "http://czt.hunan.gov.cn/czt/xxgk/tzgg/index.html"],
  ["ah-finance-policy", "安徽省财政厅·政策法规", "http://czt.ah.gov.cn/public/column/7041?type=4&catId=6714181&action=list"],
  ["hlj-finance-notices", "黑龙江省财政厅·通知公告", "http://czt.hlj.gov.cn/czt/c110781/common_list.shtml"],
  ["yn-finance-notices", "云南省财政厅·通知公告", "http://czt.yn.gov.cn/xwzx/tzgg/"],
  ["gz-finance-open", "贵州省财政厅·政务公开", "https://czt.guizhou.gov.cn/zwgk/"],
  ["nx-finance-notices", "宁夏财政厅·通知公告", "http://czt.nx.gov.cn/xwzx/tzgg/"],
  ["hi-finance-policy", "海南省财政厅·政策法规", "http://mof.hainan.gov.cn/sczt/zcfg/tylist.shtml?ddtab=true"],
];

const DATE_RE = /(20\d{2})[-/年.](\d{1,2})[-/月.](\d{1,2})/;
const BODY = [".news_content", "#fontzoom", ".TRS_UEDITOR", ".TRS_Editor", ".my_doccontent", ".content_detail", "#zoom", ".article-content",
  ".Custom_UnionStyle", ".detail", ".view", ".content", ".article", "#content", ".zwgk_content", ".xl_content"];
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const limit = Number((args.find((a) => a.startsWith("--limit=")) || "--limit=20").split("=")[1]);
const only = (args.find((a) => a.startsWith("--only=")) || "").split("=")[1];

function decode(buf, ct) {
  let cs = (ct.match(/charset=([\w-]+)/i) || [])[1];
  if (!cs) cs = (buf.slice(0, 2048).toString("latin1").match(/charset=["']?([\w-]+)/i) || [])[1] || "utf-8";
  const norm = cs.toLowerCase().replace(/^gb2312$/, "gbk").replace(/^gb18030$/, "gbk");
  try { return new TextDecoder(norm).decode(buf); } catch { return buf.toString("utf8"); }
}
async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    signal: AbortSignal.timeout(20000), redirect: "follow" });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, html: decode(buf, res.headers.get("content-type") || ""), finalUrl: res.url };
}
const parseDate = (s) => {
  const m = s.match(DATE_RE);
  return m ? new Date(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}T00:00:00+08:00`) : null;
};

/** Pick the list container whose direct children are the most dated, link-bearing items. */
function inferList($) {
  let best = null;
  $("ul, table, div").each((_, el) => {
    const kids = $(el).children("li, tr");
    if (kids.length < 5) return;
    let dated = 0, linked = 0;
    kids.each((__, k) => {
      const a = $(k).find("a[href]").first();
      if ((a.attr("href") || "") && (a.text() || "").trim().length >= 8) linked += 1;
      if (DATE_RE.test($(k).text())) dated += 1;
    });
    if (linked < 4) return;
    const score = dated * 10 + linked;
    if (!best || score > best.score) {
      const cls = ($(el).attr("class") || "").split(/\s+/).filter(Boolean).map((c) => "." + c).join("");
      const id = $(el).attr("id");
      best = { el, score, dated, linked, sel: el.tagName.toLowerCase() + (id ? "#" + id : "") + cls };
    }
  });
  return best;
}

const summary = [];
for (const [id, name, url] of FEEDS) {
  if (only && !only.split(",").includes(id)) continue;
  const row = { id, name };
  try {
    const l = await get(url);
    if (l.status !== 200) { summary.push({ ...row, error: `list_${l.status}` }); continue; }
    const $ = cheerio.load(l.html);
    const pick = inferList($);
    if (!pick) { summary.push({ ...row, error: "no_list_container" }); continue; }
    row.listSelector = pick.sel;
    row.items = pick.linked;
    row.dated = pick.dated;

    const entries = [];
    $(pick.el).children("li, tr").each((_, k) => {
      const a = $(k).find("a[href]").first();
      const title = (a.attr("title") || a.text() || "").replace(/\s+/g, " ").trim();
      const href = a.attr("href") || "";
      if (title.length < 8 || !href || /^javascript:/i.test(href)) return;
      let abs; try { abs = new URL(href, l.finalUrl).href; } catch { return; }
      if (!/\.(s?html?|htm|jhtml)|content|detail|t20/i.test(abs)) return;
      entries.push({ title, url: abs, date: parseDate($(k).text()) });
    });
    row.parsed = entries.length;

    const known = new Set((await sql`SELECT url FROM articles WHERE source_id = ${id}`).map((r) => r.url));
    const todo = entries.filter((e) => !known.has(e.url)).slice(0, limit);
    row.fresh = todo.length;

    if (!dry && todo.length) {
      await sql`
        INSERT INTO sources (id, name, kind, config, tags, first_party, tier, participation_mode,
          interval_minutes, site_fulltext, syndicate_fulltext, enabled)
        VALUES (${id}, ${name}, 'web_list', ${sql.json({ url, listSelector: pick.sel, importMode: "agent-adhoc" })},
          ${["官方", "地方财政"]}, true, 'T1', 'editorial', 1440, false, false, false)
        ON CONFLICT (id) DO NOTHING`;
    }

    let inserted = 0, bodied = 0;
    for (const e of todo) {
      let bodyText = null;
      try {
        const d = await get(e.url);
        const $$ = cheerio.load(d.html);
        let bestText = "";
        for (const sel of BODY) {
          const box = $$(sel).first().clone();
          if (!box.length) continue;
          box.find("style,script,noscript").remove();
          const t = box.text().split(/\n+/).map((x) => x.replace(/[ \t\u3000]+/g, " ").trim()).filter(Boolean).join("\n").trim();
          if (t.length > bestText.length) bestText = t;
        }
        if (bestText.length >= 120) bodyText = bestText;
      } catch { /* title-only */ }
      if (bodyText) bodied += 1;
      if (dry) { inserted += 1; continue; }
      const dt = bodyText ? `${e.title}\n\n${bodyText}` : null;
      const res = await upsertMaterial({
        sourceId: id, url: e.url, title: e.title, publishedAt: e.date,
        bodyHtml: dt ? dt.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join("\n") : null,
        bodyText: dt, bodyStatus: dt ? "ok" : "pending",
        via: "fetch", discoveredAt: new Date(), backfill: "provincial-import",
      });
      if (res.created) inserted += 1;
      // upsertMaterial can drop the claimed date; keep it explicitly so the timeline is right.
      if (e.date) {
        await sql`UPDATE articles SET published_at = ${e.date}, published_at_claim = ${e.date}, timeline_at = ${e.date}
          WHERE source_id = ${id} AND url = ${e.url} AND published_at IS NULL`;
      }
    }
    summary.push({ ...row, inserted, bodied });
  } catch (e) { summary.push({ ...row, error: (e.message || "").slice(0, 40) }); }
}
console.log(JSON.stringify({ dry, limit, summary }, null, 1));
await closeDb().catch(() => {});
process.exit(0);
