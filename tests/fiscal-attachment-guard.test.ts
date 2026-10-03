import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { extractSelectedBody, type SelectedBodyPolicy } from "../packages/backend/src/content/selected-body.ts";
import { extractConfiguredHtmlBody } from "../packages/backend/src/content/pdf-body.ts";
import { unsupportedConfig } from "../packages/backend/src/sources/config-keys.ts";
import { extractFromUrl } from "../packages/backend/src/content/extract.ts";
import { fetchDetail } from "../packages/backend/src/sources/web-list.ts";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/fiscal-attachment-guard");
const pageUrl = "https://example.org/notices/202610/article.html";
const expected = { title: "财政部政策通知", publishedAt: new Date("2026-10-01T01:00:00.000Z") };
const policy: SelectedBodyPolicy[] = [{ selector: ".article-body", minTextChars: 200 }];
const config = { bodyPolicies: policy, publishedAtUtcOffset: "+08:00" };
const longBody = "The selected body contains complete notice details and enough non-link article text for the configured minimum length. ".repeat(3);

async function fixture(name: string): Promise<string> {
  return (await readFile(join(fixtureDir, name), "utf8")).replace("{{LONG_BODY}}", longBody);
}

test("a relative PDF-like link in the selected business body is found and resolved against the article URL", async () => {
  const html = await fixture("body-relative-pdf.html");
  const result = extractSelectedBody(html, pageUrl, config, expected);
  assert.equal(result.body, null);
  assert.equal(result.reason, "attachments_unprocessed");
  assert.deepEqual(result.attachments.map(({ url }) => url), ["https://example.org/notices/files/notice.pdf?download=1#page=1"]);
});

test("PDF-like links in footer or navigation outside the selected body still reject the page", async () => {
  for (const name of ["footer-pdf.html", "nav-pdf.html"]) {
    const result = extractSelectedBody(await fixture(name), pageUrl, config, expected);
    assert.equal(result.body, null, name);
    assert.equal(result.reason, "attachments_unprocessed", name);
    assert.equal(result.attachments.length, 1, name);
  }
});

test("a complete body passes without PDF links; .pdf text in query or fragment alone is ignored", async () => {
  const clean = extractSelectedBody(await fixture("no-pdf.html"), pageUrl, config, expected);
  assert.equal(clean.reason, null);
  assert.ok(clean.body!.text.length >= 200);

  const fake = extractSelectedBody(await fixture("query-fragment-fakes.html"), pageUrl, config, expected);
  assert.equal(fake.reason, null);
  assert.ok(fake.body!.text.length >= 200);
  assert.deepEqual(fake.attachments, []);
});

test("application/pdf content-type marks a link even when its URL path has no .pdf suffix", async () => {
  const result = extractSelectedBody(await fixture("content-type-pdf.html"), pageUrl, config, expected);
  assert.equal(result.body, null);
  assert.equal(result.reason, "attachments_unprocessed");
  assert.deepEqual(result.attachments.map(({ url }) => url), ["https://example.org/download?id=42"]);
});

test("identity mismatch takes precedence over attachment refusal; attachment refusal still precedes minimum length", async () => {
  const withBusinessPdf = await fixture("body-relative-pdf.html");
  const mismatch = extractSelectedBody(withBusinessPdf, pageUrl, config, { ...expected, title: "错误标题" });
  assert.equal(mismatch.reason, "identity_mismatch", "identity mismatch is checked before attachment links");
  const withoutPdfPath = withBusinessPdf.replace("../files/notice.pdf?download=1#page=1", "/download?file=notice.pdf");
  const identityOnly = extractSelectedBody(withoutPdfPath, pageUrl, config, { ...expected, title: "错误标题" });
  assert.equal(identityOnly.reason, "identity_mismatch");

  const shortWithFooterPdf = await readFile(join(fixtureDir, "short-body-footer-pdf.html"), "utf8");
  const rejectedEarly = extractSelectedBody(shortWithFooterPdf, pageUrl, config, expected);
  assert.equal(rejectedEarly.reason, "attachments_unprocessed", "a footer link preempts the short-body reason");
  const shortWithoutPdfPath = shortWithFooterPdf.replace("/assets/footer.pdf", "/download?file=footer.pdf");
  const shortOnly = extractSelectedBody(shortWithoutPdfPath, pageUrl, config, expected);
  assert.equal(shortOnly.reason, "short_body_not_allowed");
});

test("an explicit article ancestor scope ignores external footer PDFs but keeps every in-scope PDF guarded", async () => {
  const scopedFooter = await fixture("scoped-article-shell.html");
  const noScope = extractSelectedBody(scopedFooter, pageUrl, config, expected);
  assert.equal(noScope.reason, "attachments_unprocessed");
  const scoped = extractSelectedBody(scopedFooter, pageUrl, { ...config, attachmentScopeSelector: ".article-scope" }, expected);
  assert.equal(scoped.reason, null);
  assert.ok(scoped.body!.text.length >= 200);
  assert.deepEqual(scoped.attachments, []);

  const siblingPdf = scopedFooter.replace("</div><footer>", '<div class="downloads"><a href="../files/notice.pdf">下载</a></div></div><footer>');
  const siblingRejected = extractSelectedBody(siblingPdf, pageUrl, { ...config, attachmentScopeSelector: ".article-scope" }, expected);
  assert.equal(siblingRejected.reason, "attachments_unprocessed");
  assert.deepEqual(siblingRejected.attachments.map(({ url }) => url), ["https://example.org/notices/files/notice.pdf"]);

  const bodyPdf = await fixture("body-relative-pdf.html");
  const bodyRejected = extractSelectedBody(bodyPdf, pageUrl, { ...config, attachmentScopeSelector: "main" }, expected);
  assert.equal(bodyRejected.reason, "attachments_unprocessed");
  assert.equal(bodyRejected.attachments.length, 1);

  const navInScope = (await fixture("nav-pdf.html")).replace("<body>", '<body><div class="article-scope">')
    .replace("</main></body>", "</main></div></body>");
  const navRejected = extractSelectedBody(navInScope, pageUrl, { ...config, attachmentScopeSelector: ".article-scope" }, expected);
  assert.equal(navRejected.reason, "attachments_unprocessed");
});

test("scope selector shape, uniqueness, strict ancestry, and blocked containers fail closed", async () => {
  const html = await fixture("footer-pdf.html");
  for (const [label, scope] of [
    ["missing", ".missing"], ["invalid CSS", "["], ["body", "body"], ["html", "html"],
    ["nav", "nav"], ["same as body", ".article-body"], ["sibling", "footer"],
  ] as const) {
    const result = extractSelectedBody(html, pageUrl, { ...config, attachmentScopeSelector: scope }, expected);
    assert.equal(result.body, null, label);
    assert.equal(result.reason, "attachment_scope_invalid", label);
  }
  const duplicate = html.replace("</body>", '<div class="article-scope"></div><div class="article-scope"></div></body>');
  assert.equal(extractSelectedBody(duplicate, pageUrl, { ...config, attachmentScopeSelector: ".article-scope" }, expected).reason, "attachment_scope_invalid");
  for (const scope of ["", "  ", null, [], {}, "x".repeat(501)] as unknown[]) {
    const result = extractSelectedBody(html, pageUrl, { ...config, attachmentScopeSelector: scope } as never, expected);
    assert.equal(result.reason, "attachment_scope_invalid", String(scope));
  }
});

test("scope configuration validates only for web_list body extraction and the shared driver rejects envelope conflicts", async () => {
  assert.deepEqual(unsupportedConfig("web_list", { detail: { bodySelector: ".article-body", attachmentScopeSelector: "main" } }), []);
  assert.deepEqual(unsupportedConfig("web_list", { detail: { bodyPolicies: policy, attachmentScopeSelector: "main" } }), []);
  assert(unsupportedConfig("web_list", { detail: { attachmentScopeSelector: "main" } }).some((value) => value.includes("requires detail.bodySelector")));
  assert(unsupportedConfig("json_list", { detail: { bodySelector: ".article-body", attachmentScopeSelector: "main" } }).some((value) => value.includes("only supported by web_list")));
  for (const value of ["", "x".repeat(501), null, [], {}]) {
    assert(unsupportedConfig("web_list", { detail: { bodySelector: ".article-body", attachmentScopeSelector: value } }).some((entry) => entry.includes("attachmentScopeSelector")));
  }
  for (const conflict of ["articleSelector", "attachmentSelector", "attachmentMode", "pdfDirect"] as const) {
    assert(unsupportedConfig("web_list", { detail: { bodySelector: ".article-body", attachmentScopeSelector: "main", [conflict]: conflict === "pdfDirect" ? false : ".files" } }).some((entry) => entry.includes("attachmentScopeSelector cannot be combined")));
  }
  const result = await extractConfiguredHtmlBody(await fixture("footer-pdf.html"), pageUrl, {
    bodySelector: ".article-body", attachmentScopeSelector: "main", articleSelector: "main", attachmentSelector: ".files",
  }, expected, []);
  assert.equal(result.body, null);
  assert.equal(result.reason, "attachment_scope_invalid");
});

test("detail prefetch and article extraction pass the same scope; malformed scope fails before fetch", async () => {
  const html = await fixture("scoped-article-shell.html");
  const configValue = { bodySelector: ".article-body", attachmentScopeSelector: ".article-scope", publishedAtUtcOffset: "+08:00" };
  const calls: string[] = [];
  const fetcher = async (url: string) => {
    calls.push(url);
    return { status: 200, url, headers: new Headers({ "content-type": "text/html" }), body: Buffer.from(html), text: () => html };
  };
  const source = { id: "scope-test", kind: "web_list", config: { url: "https://example.org/list", detail: configValue } } as never;
  const detail = await fetchDetail(pageUrl, source, {
    body: true, date: false, title: false, summary: false, expectedTitle: expected.title, expectedPublishedAt: expected.publishedAt,
  }, { fetcher });
  assert.equal(detail.body?.via, "selector");

  let failure: string | null = null;
  const extracted = await extractFromUrl(pageUrl, {
    allowJina: true, subject: "scope-test", selectedBody: { config: configValue, expected, allowUrlPrefixes: [] },
    onSelectedBodyFailure: (reason) => { failure = reason; }, fetcher,
  });
  assert.equal(extracted?.via, "selector");
  assert.equal(failure, null);
  assert.equal(calls.length, 2, "one fake HTML response per configured extraction path");

  let invalidCalls = 0;
  let invalidFailure: string | null = null;
  const invalid = await extractFromUrl(pageUrl, {
    allowJina: true, subject: "scope-test", selectedBody: {
      config: { bodySelector: ".article-body", attachmentScopeSelector: ".article-scope", pdfDirect: false }, expected, allowUrlPrefixes: [],
    },
    onSelectedBodyFailure: (reason) => { invalidFailure = reason; },
    fetcher: async (url) => { invalidCalls += 1; return fetcher(url); },
  });
  assert.equal(invalid, null);
  assert.equal(invalidFailure, "attachment_scope_invalid");
  assert.equal(invalidCalls, 0, "conflicting scope config is refused before any request");
});
