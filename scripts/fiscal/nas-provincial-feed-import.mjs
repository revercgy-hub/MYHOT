#!/usr/bin/env node
/** One-off import for provincial finance notices that are not yet in the pinned catalog.
 *  Builds the source rows, walks each list, fetches the detail body and upserts through the canonical writer. */
import * as cheerio from "cheerio";
import { sql, closeDb } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";

const SOURCES = [
  {
    id: "gd-finance-notices", name: "广东省财政厅·通知公告", url: "https://czt.gd.gov.cn/tzgg/index.html",
    item: ".content > ul.lists_ty > li", title: "a", date: ".lists_time",
  },
  {
    id: "henan-finance-notices", name: "河南省财政厅·通知公告", url: "https://czt.henan.gov.cn/xwdt/tzgg/",
    item: ".list > ul.datenews > li", title: "a.newsTitle", date: "span",
  },
  {
    id: "cq-finance-notice", name: "重庆市财政局·公告公示", url: "https://czj.cq.gov.cn/zwxx_268/ywgg/",
    item: ".list > ul > li", title: "a", date: "span",
  },
];

const BODY = [".TRS_UEDITOR", ".my_doccontent", ".TRS_Editor", ".content_detail", "#zoom", ".article-content", ".detail", ".view", ".content"];
const DATE_RE = /(20\d{2})[-/年.](\d{1,2})[-/月.](\d{1,2})/;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const dry = process.argv.includes("--dry");
const parseDate = (s) => { const m = s.match(DATE_RE); return m ? new Date(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}T00:00:00+08:00`) : null; };

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }, signal: AbortSignal.timeout(25000) });
  return { status: res.status, html: await res.text() };
}

const summary = [];
// Skip URLs already stored so the daily run only pays for genuinely new notices.
const known = new Set(
  (await sql`SELECT url FROM articles WHERE source_id IN ${sql(SOURCES.map((x) => x.id))}`).map((r) => r.url),
);
for (const s of SOURCES) {
  if (!dry) {
    await sql`
      INSERT INTO sources (id, name, kind, config, tags, first_party, tier, participation_mode,
        interval_minutes, site_fulltext, syndicate_fulltext, enabled)
      VALUES (${s.id}, ${s.name}, 'web_list', ${sql.json({ url: s.url, importMode: "agent-adhoc" })},
        ${["官方", "地方财政"]}, true, 'T1', 'editorial', 1440, false, false, false)
      ON CONFLICT (id) DO NOTHING`;
  }
  let items = [];
  try {
    const l = await get(s.url);
    const $ = cheerio.load(l.html);
    $(s.item).each((_, el) => {
      const a = $(el).find(s.title).first();
      const title = (a.attr("title") || a.text() || "").replace(/\s+/g, " ").trim();
      const href = a.attr("href") || "";
      if (title.length < 6 || !href || /^javascript:/i.test(href)) return;
      const dateText = $(el).find(s.date).first().text() || $(el).text();
      items.push({ title, url: new URL(href, s.url).href, date: parseDate(dateText) });
    });
  } catch (e) {
    summary.push({ id: s.id, listError: e.message.slice(0, 40) });
    continue;
  }
  let inserted = 0, bodied = 0;
  for (const it of items) {
    if (!/\.(s?html?|htm|jhtml)/i.test(it.url) && !it.url.includes("/content/")) continue;
    if (known.has(it.url)) continue;
    let bodyText = null;
    try {
      const d = await get(it.url);
      const $ = cheerio.load(d.html);
      let best = "";
      for (const sel of BODY) {
        const box = $(sel).first().clone();
        if (!box.length) continue;
        box.find("style,script,noscript").remove();
        const t = box.text().split(/\n+/).map((x) => x.replace(/[ \t\u3000]+/g, " ").trim()).filter(Boolean).join("\n").trim();
        if (t.length > best.length) best = t;
      }
      if (best.length >= 120) bodyText = best;
    } catch { /* keep the title-only row */ }
    if (dry) { inserted += 1; if (bodyText) bodied += 1; continue; }
    const dt = bodyText ? `${it.title}\n\n${bodyText}` : null;
    const res = await upsertMaterial({
      sourceId: s.id, url: it.url, title: it.title, publishedAt: it.date,
      bodyHtml: dt ? dt.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join("\n") : null,
      bodyText: dt, bodyStatus: dt ? "ok" : "pending",
      via: "fetch", discoveredAt: new Date(), backfill: "provincial-import",
    });
    if (res.created) inserted += 1;
    if (dt) bodied += 1;
  }
  summary.push({ id: s.id, listed: items.length, inserted, bodied });
}
console.log(JSON.stringify({ dry, summary }, null, 1));
await closeDb().catch(() => {});
process.exit(0);
