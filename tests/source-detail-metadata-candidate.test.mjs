import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { prepareDetailMetadataCandidate } from "../scripts/fiscal/source-detail-metadata-candidate.mjs";
import { fetchDetail } from "../packages/backend/src/sources/web-list.ts";
const catalog = JSON.parse(readFileSync("industry/sources.json")).sources;
test("metadata candidates add only visible title and missing date extraction without changing body or admission", () => {
  for (const id of ["mof-fujian-supervision-dynamics", "mof-xiamen-supervision-dynamics"]) {
    const source = catalog.find(x => x.id === id), original = structuredClone(source);
    const result = prepareDetailMetadataCandidate(source);
    assert.deepEqual(source, original);
    assert.equal(result.candidate.config.detail.titleSelector, "h2.title_con");
    const expected = structuredClone(source);
    expected.config.detail.titleSelector = "h2.title_con";
    if (id === "mof-xiamen-supervision-dynamics") expected.config.detail.publishedAtRegex = '<meta\\s+name="PubDate"\\s+content="([^"]+)';
    assert.deepEqual(result.candidate, expected);
    assert.equal(result.guardrails.databaseWrites, 0);
  }
});
test("metadata candidate refuses enabled, fulltext, unrelated and already customized sources", () => {
  const source = catalog.find(x => x.id === "mof-xiamen-supervision-dynamics");
  for (const patch of [{ enabled: true }, { site_fulltext: true }, { id: "other" }]) assert.throws(() => prepareDetailMetadataCandidate({ ...source, ...patch }), /scope/u);
  const custom = structuredClone(source); custom.config.detail.titleSelector = "h1";
  assert.throws(() => prepareDetailMetadataCandidate(custom), /separate review/u);
});

test("candidate metadata restores title/date with unchanged body guard and rejects a changed article identity", async () => {
  const title = "财政部厦门监管局：开展国有资本收益审核";
  const body = "财政部门核验申报数据与审计报告，检查应缴收益和补缴情况，推动相关问题整改。".repeat(30);
  for (const id of ["mof-fujian-supervision-dynamics", "mof-xiamen-supervision-dynamics"]) {
    const candidate = prepareDetailMetadataCandidate(catalog.find(x => x.id === id)).candidate;
    const url = `${candidate.config.allowUrlPrefixes[0]}202610/t20261012_12345.htm`;
    const need = { title: true, date: true, summary: false, body: true, expectedTitle: title, expectedPublishedAt: new Date("2026-10-12T00:00:00+08:00") };
    async function read(heading, date = "2026-10-12 10:00:00", attachment = "") {
      const html = `<html><head><meta name="ArticleTitle" content="${heading}"><meta name="PubDate" content="${date}"></head><body><h2 class="title_con">${heading}</h2><div class="my_doccontent"><p>${body}</p>${attachment}</div></body></html>`;
      return fetchDetail(url, candidate, need, { fetcher: async requested => {
        assert.equal(requested, url, "offline fixture must never fetch an attachment or another URL");
        return { status: 200, url, headers: new Headers({ "content-type": "text/html" }), body: Buffer.from(html), text: () => html };
      } });
    }
    const valid = await read(title);
    assert.equal(valid.title, title);
    assert.ok(valid.body?.text.includes("申报数据"));
    assert.equal(valid.publishedAt.toISOString().slice(0, 10), "2026-10-12");
    assert.equal((await read("另一篇标题")).body, null);
    assert.equal((await read(title, "2026-10-13 10:00:00")).body, null);
    assert.equal((await read(title, "2026-10-12 10:00:00", '<a href="attachment.pdf">附件</a>')).body, null);
  }
});
