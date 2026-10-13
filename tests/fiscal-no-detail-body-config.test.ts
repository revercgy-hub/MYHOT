import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import sourcesFile from "../industry/sources.json" with { type: "json" };
import { extractConfiguredHtmlBody } from "../packages/backend/src/content/pdf-body.ts";
import { extractSelectedBody } from "../packages/backend/src/content/selected-body.ts";
import { unsupportedConfig } from "../packages/backend/src/sources/config-keys.ts";

const sources = sourcesFile.sources as Array<{ id: string; kind: "web_list" | "json_list"; config: Record<string, any>; enabled: boolean; site_fulltext: boolean; syndicate_fulltext: boolean }>;
const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/fiscal-no-detail");
const identity = {
  "fujian-finance-notices": { title: "省直考区关于领取2026年度全国会计专业技术初级资格证书的通知", publishedAt: new Date("2026-09-28T16:00:00Z") },
  "mof-policy-release": { title: "中华人民共和国财政部公告2026年第24号", publishedAt: new Date("2026-08-25T16:00:00Z") },
  "mof-regional-supervision-dynamics": { title: "财政部宁夏监管局：以财政科学管理为统领推动过紧日子要求见行见效", publishedAt: new Date("2026-10-11T16:00:00Z") },
  "mof-treasury-debt-data": { title: "2026年8月地方政府债券发行和债务余额情况", publishedAt: new Date("2026-09-23T16:00:00Z") },
  "mof-xiamen-supervision-dynamics": { title: "财政部厦门监管局：办公室开展厦门市财政支持老旧水库除险加固工作专项调研", publishedAt: new Date("2026-10-09T16:00:00Z") },
  "pboc-xiamen-work": { title: "金融活水润鹭岛 普惠春风暖万家——2026年厦门市个体工商户金融产品手册", publishedAt: new Date("2026-10-07T16:00:00Z") },
  "xiamen-csrc-regulatory-work": { title: "政策引领创新突破 厦门辖区债券市场融资呈现新亮点", publishedAt: new Date("2026-09-28T06:30:12Z") },
  "mof-finance-notices": { title: "关于公布2026年中央财政支持普惠金融发展示范区名单等有关事项的通知", publishedAt: new Date("2026-07-15T16:00:00Z") },
} as const;

async function fixture(name: string) {
  return readFile(join(fixtureDir, name), "utf8");
}

function source(id: keyof typeof identity) {
  const found = sources.find((item) => item.id === id);
  assert(found, `missing industry source ${id}`);
  assert.equal(found.enabled, false, `${id} must remain disabled`);
  assert.equal(found.site_fulltext, false, `${id} must remain summary-only`);
  assert.equal(found.syndicate_fulltext, false, `${id} must remain summary-only`);
  assert.deepEqual(unsupportedConfig(found.kind, found.config), [], `${id} config must use supported keys`);
  return found;
}

test("the seven no-detail source configs extract only identity-matched article containers", async () => {
  const cases = [
    ["fujian-finance-notices", "fujian.html", 200],
    ["mof-policy-release", "mof-policy.html", 200],
    ["mof-regional-supervision-dynamics", "mof-regional.html", 200],
    ["mof-treasury-debt-data", "mof-treasury-with-pdf.html", 200],
    ["mof-xiamen-supervision-dynamics", "mof-xiamen.html", 200],
    ["pboc-xiamen-work", "pboc-xiamen.html", 200],
    ["xiamen-csrc-regulatory-work", "csrc-xiamen.html", 200],
  ] as const;
  for (const [id, filename] of cases) {
    const configured = source(id);
    const detail = configured.config.detail;
    assert.equal(typeof detail?.bodySelector, "string", `${id} must select a body`);
    const result = extractSelectedBody(await fixture(filename), "https://fixture.invalid/article", {
      bodySelector: detail.bodySelector,
      publishedAtUtcOffset: detail.publishedAtUtcOffset ?? "+08:00",
      ...(Object.hasOwn(detail, "titleRegex") ? { titleRegex: detail.titleRegex } : {}),
      ...(Object.hasOwn(detail, "publishedAtRegex") ? { publishedAtRegex: detail.publishedAtRegex } : {}),
    }, identity[id]);
    if (id === "mof-treasury-debt-data") {
      assert.equal(result.body, null);
      assert.equal(result.reason, "attachments_unprocessed");
      assert.deepEqual(result.attachments?.map((item) => item.title), ["附表 2026年8月地方政府债券发行和还本付息情况.pdf"]);
      continue;
    }
    assert.equal(result.reason, null, id);
    assert(result.body && result.body.text.length >= 200, id);
  }
});

test("PBOC Xiamen body excludes navigation, print controls, and date chrome", async () => {
  const configured = source("pboc-xiamen-work");
  const detail = configured.config.detail;
  const result = extractSelectedBody(await fixture("pboc-xiamen.html"), "https://fixture.invalid/article", {
    bodySelector: detail.bodySelector,
    publishedAtUtcOffset: detail.publishedAtUtcOffset,
  }, identity["pboc-xiamen-work"]);
  assert.equal(result.reason, null);
  assert(result.body && result.body.text.length >= 200);
  assert.match(result.body!.text, /手册涵盖(?:了)?21款特色金融产品/);
  assert.doesNotMatch(result.body!.text, /我所在的位置|打印本页|关闭窗口|字号/);
});

test("the existing MOF finance attachment envelope remains usable without inventing a PDF", async () => {
  const configured = source("mof-finance-notices");
  const detail = configured.config.detail;
  let fetchCount = 0;
  const result = await extractConfiguredHtmlBody(await fixture("mof-finance.html"), "https://fixture.invalid/article", {
    ...detail,
    publishedAtUtcOffset: "+08:00",
  }, identity["mof-finance-notices"], ["https://fixture.invalid/"], async () => {
    fetchCount += 1;
    throw new Error("fixture should contain no PDF attachment");
  });
  assert.equal(result.reason, null);
  assert(result.body && result.body.text.length >= 200);
  assert.equal(fetchCount, 0);
});

test("all configured sources retain strict list identity and keep PDF-bearing items held", async () => {
  for (const id of Object.keys(identity) as Array<keyof typeof identity>) source(id);
  const configured = source("mof-policy-release");
  const detail = configured.config.detail;
  const wrongTitle = extractSelectedBody(await fixture("mof-policy.html"), "https://fixture.invalid/article", detail, {
    ...identity["mof-policy-release"], title: "另一个公告",
  });
  assert.equal(wrongTitle.body, null);
  assert.equal(wrongTitle.reason, "identity_mismatch");
  const wrongDate = extractSelectedBody(await fixture("mof-policy.html"), "https://fixture.invalid/article", detail, {
    ...identity["mof-policy-release"], publishedAt: new Date("2026-08-26T16:00:00Z"),
  });
  assert.equal(wrongDate.body, null);
  assert.equal(wrongDate.reason, "identity_mismatch");
});
