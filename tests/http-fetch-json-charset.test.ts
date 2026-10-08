import assert from "node:assert/strict";
import http from "node:http";
import { after, test } from "node:test";
import { config } from "@aihot/backend/config";
import { guardedFetch } from "@aihot/backend/lib/http-fetch";

const utf8Json = Buffer.from(JSON.stringify({
  title: "NFRA 中文标题",
  date: "2026-10-08",
  id: "fixture-42",
  note: "<meta charset='gb2312'><div encoding=\"gb2312\">",
}));
const explicitGbkJson = Buffer.concat([
  Buffer.from('{"title":"'), Buffer.from([0xb2, 0xe2, 0xca, 0xd4]),
  Buffer.from('","html":"<meta charset=\'utf-8\'>"}'),
]);
const gbkHtml = Buffer.concat([
  Buffer.from('<html><head><meta charset="gb2312"></head><body><h1>'),
  Buffer.from([0xb2, 0xe2, 0xca, 0xd4]),
  Buffer.from("</h1></body></html>"),
]);
const encodingHtml = Buffer.concat([
  Buffer.from('<html><body><article encoding="gb2312">'),
  Buffer.from([0xb2, 0xe2, 0xca, 0xd4]),
  Buffer.from("</article></body></html>"),
]);
const htmlWithoutCharset = Buffer.from("<html><body>普通 UTF-8 正文</body></html>");
const jsonpWithEmbeddedMeta = Buffer.from(JSON.stringify({
  title: "JSONP 中文",
  note: "<meta charset='gb2312'>",
}));

const previousPrivateFetchSetting = config.allowPrivateNetworkFetch;
const server = http.createServer((req, res) => {
  switch (req.url) {
    case "/application-json":
      res.writeHead(200, { "content-type": "application/json" }).end(utf8Json);
      return;
    case "/problem-json":
      res.writeHead(200, { "content-type": "application/problem+json" }).end(utf8Json);
      return;
    case "/case-params":
      res.writeHead(200, { "content-type": "Application/LD+JSON; profile=\"fixture\"" }).end(utf8Json);
      return;
    case "/explicit-gbk":
      res.writeHead(200, { "content-type": "application/json; charset=gbk" }).end(explicitGbkJson);
      return;
    case "/html-meta":
      res.writeHead(200, { "content-type": "text/html; profile=application/json" }).end(gbkHtml);
      return;
    case "/html-encoding":
      res.writeHead(200, { "content-type": "text/html; foo=json" }).end(encodingHtml);
      return;
    case "/html-no-content-type":
      res.writeHead(200).end(gbkHtml);
      return;
    case "/html-utf8":
      res.writeHead(200, { "content-type": "text/html" }).end(htmlWithoutCharset);
      return;
    case "/application-jsonp":
      res.writeHead(200, { "content-type": "application/jsonp" }).end(jsonpWithEmbeddedMeta);
      return;
    default:
      res.writeHead(404).end();
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
config.allowPrivateNetworkFetch = true;
after(async () => {
  config.allowPrivateNetworkFetch = previousPrivateFetchSetting;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function fetchFixture(path: string, contentTypeExpected?: string) {
  const response = await guardedFetch(`${origin}${path}`, {
    route: "direct",
    runBudget: {
      beforeDispatch({ url }) {
        assert.equal(url.origin, origin, "transport fixture cannot dispatch outside its loopback server");
      },
    },
  });
  assert.equal(response.status, 200);
  if (contentTypeExpected) assert.equal(response.headers.get("content-type"), contentTypeExpected);
  return response;
}

test("UTF-8 JSON MIME types ignore body-embedded HTML charset hints and preserve raw bytes", async () => {
  for (const path of ["/application-json", "/problem-json", "/case-params"]) {
    const response = await fetchFixture(path);
    const beforeText = Buffer.from(response.body);
    const decoded = response.text();
    assert.deepEqual(JSON.parse(decoded), JSON.parse(utf8Json.toString("utf8")), path);
    assert.equal(decoded.includes("\uFFFD"), false, path);
    assert.equal(response.text(), decoded, `${path} text() should be repeatable`);
    assert.deepEqual(response.body, beforeText, `${path} text() should not change raw bytes`);
    assert.deepEqual(response.body, utf8Json, `${path} body bytes should match the fixture exactly`);
  }
});

test("an explicit HTTP GBK charset still takes precedence for JSON", async () => {
  const response = await fetchFixture("/explicit-gbk");
  assert.deepEqual(JSON.parse(response.text()), { title: "测试", html: "<meta charset='utf-8'>" });
  assert.deepEqual(response.body, explicitGbkJson);
});

test("non-JSON and missing Content-Type retain legacy GBK sniffing and plain UTF-8 decoding", async () => {
  for (const path of ["/html-meta", "/html-no-content-type"]) {
    const response = await fetchFixture(path);
    assert.match(response.text(), /<h1>测试<\/h1>/, path);
    assert.deepEqual(response.body, gbkHtml);
  }

  const encodingResponse = await fetchFixture("/html-encoding");
  assert.match(encodingResponse.text(), /<article encoding="gb2312">测试<\/article>/);
  assert.deepEqual(encodingResponse.body, encodingHtml);

  const utf8Response = await fetchFixture("/html-utf8");
  assert.equal(utf8Response.text(), htmlWithoutCharset.toString("utf8"));
  assert.deepEqual(utf8Response.body, htmlWithoutCharset);
});

test("application/jsonp is not treated as a JSON MIME type", async () => {
  const response = await fetchFixture("/application-jsonp");
  assert.notEqual(response.text(), jsonpWithEmbeddedMeta.toString("utf8"));
  assert.deepEqual(response.body, jsonpWithEmbeddedMeta);
});
