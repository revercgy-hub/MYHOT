import { createHash } from "node:crypto";

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
const digest = value => createHash("sha256").update(canonical(value)).digest("hex");

/** Prepare only; installation must bind the source row and collector catalog together. */
export function prepareDetailMetadataCandidate(source) {
  const expectedUrl = {
    "mof-fujian-supervision-dynamics": "https://fj.mof.gov.cn/gzdt/caizhengjiancha/",
    "mof-xiamen-supervision-dynamics": "https://xm.mof.gov.cn/caizhengjiancha/index.htm",
  }[source.id];
  if (!expectedUrl || source.kind !== "web_list" || source.config?.url !== expectedUrl || source.enabled !== false || source.site_fulltext !== false || source.syndicate_fulltext !== false || source.config?.detail?.bodySelector !== ".my_doccontent") throw Error("outside the reviewed disabled source scope");
  const candidate = structuredClone(source);
  const detail = candidate.config.detail;
  if (detail.titleSelector || detail.titleRegex || detail.titleAuthoritative) throw Error("existing title rule requires separate review");
  detail.titleSelector = "h2.title_con";
  // Keep the existing identity guard: title is obtained from the visible heading.
  if (source.id === "mof-xiamen-supervision-dynamics") {
    if (detail.publishedAtSelector || detail.publishedAtRegex || detail.publishedAtAuthoritative) throw Error("existing date rule requires separate review");
    detail.publishedAtRegex = '<meta\\s+name="PubDate"\\s+content="([^"]+)';
  }
  return { format: "fiscal.source-detail-metadata-candidate/v1", status: "OFFLINE_CANDIDATE_NOT_INSTALLED", sourceId: source.id,
    beforeConfigSha256: digest(source.config), candidateConfigSha256: digest(candidate.config), candidate,
    guardrails: { bodyPolicyUnchanged: true, sourceRemainsDisabled: true, fulltextRemainsOff: true,
      publicationChanged: false, databaseWrites: 0, externalRequests: 0 } };
}
