import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import catalog from "../industry/sources.json" with { type: "json" };
import { detailConfigIsDirectHtml } from "../scripts/fiscal/nas-candidate-batch.ts";
import { unsupportedConfig } from "../packages/backend/src/sources/config-keys.ts";
import { fetchDetail } from "../packages/backend/src/sources/web-list.ts";
import type { SourceRow } from "../packages/backend/src/sources/types.ts";

const source = catalog.sources.find((item) => item.id === "pboc-open-market") as unknown as SourceRow & {
  site_fulltext: boolean;
  syndicate_fulltext: boolean;
};
const articleUrl = "https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/2026092208451519789/index.html";

test("PBOC open-market detail uses visible title/date and body, not createDate or page chrome", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.site_fulltext, false);
  assert.equal(source.syndicate_fulltext, false);
  assert.deepEqual(source.config.allowUrlPrefixes, ["https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/"]);
  assert.deepEqual(unsupportedConfig(source.kind, source.config), []);
  assert.equal(detailConfigIsDirectHtml(source), true);

  const detail = source.config.detail;
  assert.equal(detail.maxFetches, 3);
  assert.equal(detail.bodySelector, "#zoom");
  assert.equal(detail.allowShortBody, true);
  assert.equal(detail.titleSelector, "h2");
  assert.equal(detail.titleAuthoritative, true);
  assert.equal(detail.publishedAtAuthoritative, true);

  const html = await readFile(new URL("./fixtures/pboc-open-market/detail-186-create-date-conflict.html", import.meta.url), "utf8");
  assert.match(html, /name="createDate" content="2026-09-23 11:30:13"/u);
  assert.match(html, /id="shijian">2026-09-22 09:20:30<\/span>/u);

  const expectedTitle = "公开市场业务交易公告 [2026]第186号";
  const expectedPublishedAt = new Date("2026-09-21T16:00:00.000Z");
  let fetches = 0;
  const result = await fetchDetail(articleUrl, source, {
    date: true,
    title: true,
    summary: false,
    body: true,
    expectedTitle,
    expectedPublishedAt,
  }, {
    fetcher: async (url) => {
      fetches += 1;
      assert.equal(url, articleUrl);
      return {
        status: 200,
        url,
        headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
        body: Buffer.from(html),
        text: () => html,
      };
    },
  });

  assert.equal(fetches, 1);
  assert.equal(result.title, expectedTitle);
  assert.equal(result.publishedAt?.toISOString(), expectedPublishedAt.toISOString(), "date-only capture preserves the stored list-day precision");
  assert.ok(result.body && result.body.text.length >= 100);
  assert.match(result.body!.text, /350亿元7天期逆回购操作/u);
  assert.match(result.body!.text, /逆回购操作情况/u);
  assert.doesNotMatch(result.body!.text, /我所在的位置|打印本页|关闭窗口|字号|2026年9月23日/u);
});
