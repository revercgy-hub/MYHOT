import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { unsupportedConfig } from "@aihot/backend/sources/config-keys";
import { fetchDetail, fromHtml } from "@aihot/backend/sources/web-list";

const sourcesFile = new URL("../industry/sources.json", import.meta.url);
const fixtureUrl = (name: string) => new URL(`./fixtures/regional-bureaus/${name}`, import.meta.url);
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
    assert.deepEqual(config._aihot, { initialBackfillMonths: 3, initialBackfillRequirePublishedAt: true });
    assert.deepEqual(unsupportedConfig("web_list", config), []);
    assert.equal(config.url, spec.url);
    assert.deepEqual(config.allowUrlPrefixes, [spec.url]);
    assert.equal(config.itemSelector, "div.mainboxerji > div.zzright > div.listBox > ul.liBox > li");
    assert.equal(config.linkSelector, "a[href]");
    assert.equal(config.titleSelector, "a");
    assert.equal(config.titleAttribute, "title");
    assert.equal(config.publishedAtSelector, "span");
    assert.equal(config.publishedAtUtcOffset, "+08:00");
    if (["henan", "hubei", "hunan", "guangdong"].includes(spec.bureau)) {
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

    const detail = config.detail;
    assert.equal(detail.maxFetches, 10);
    assert.equal(detail.bodySelector, ".my_doccontent");
    assert.equal(detail.publishedAtUtcOffset, "+08:00");
    assert.equal(detail.publishedAtRegex, '<meta\\s+name="PubDate"\\s+content="([^"]+)');
    const detailHtml = readFileSync(fixtureUrl(`${spec.bureau}-detail.html`), "utf8");
    let reads = 0;
    const metadata = await fetchDetail(spec.article, { id: spec.id, kind: "web_list", config } as never,
      { date: true, title: true, summary: false, body: false }, {
        fetcher: async (url) => {
          reads += 1;
          return { status: 200, url, headers: new Headers({ "content-type": "text/html; charset=utf-8" }), body: Buffer.from(detailHtml), text: () => detailHtml };
        },
      });
    assert.equal(reads, 1);
    assert.equal(metadata.publishedAt?.toISOString(), new Date(`${spec.detailDate.replace(" ", "T")}+08:00`).toISOString());
    assert.equal(metadata.title, spec.parsedDetailTitle);
  }

  const beijing = sources.find(({ id }) => id === "mof-beijing-supervision-dynamics")!.config.detail;
  assert.equal(beijing.titleSelector, "h2.title_con");
  assert.equal(beijing.titleAuthoritative, true);
  assert.equal(beijing.publishedAtAuthoritative, true);
  for (const source of sources.filter(({ id }) => id !== "mof-beijing-supervision-dynamics")) {
    assert.equal(source.config.detail.titleAuthoritative, undefined);
    assert.equal(source.config.detail.publishedAtAuthoritative, undefined);
  }
});
