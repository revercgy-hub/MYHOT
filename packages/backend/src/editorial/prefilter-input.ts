import type { AnalyzeInputArticle } from "./input.ts";
import { prefilterUser, stripPdfLayoutAnnotations } from "./writing.ts";

export const PREFILTER_BODY_WINDOW = 12_000;
export const PREFILTER_INPUT_VERSION = "body-window12000-v1";

/** Industry recall needs a bounded opening, while scoring retains the full article. */
export function buildPrefilterRequest(a: AnalyzeInputArticle, system: string, version: string) {
  const cleaned = a.xPost ? null : stripPdfLayoutAnnotations(a.bodyText ?? "");
  const partial = cleaned !== null && cleaned.length > PREFILTER_BODY_WINDOW;
  const input = partial ? { ...a, bodyText: cleaned.slice(0, PREFILTER_BODY_WINDOW) } : a;
  return {
    system: partial ? system + "\n\n本次为长文预筛，仅提供正文开头节选，未展示完整正文。不能仅因节选缺少相关信息排除全文；若无法确认相关性，返回UNKNOWN。" : system,
    user: prefilterUser(input),
    promptVersion: partial ? version + "+" + PREFILTER_INPUT_VERSION : version,
    partial,
  };
}

/** A partial input may advance to full scoring, but cannot exclude an unseen remainder. */
export function boundedPrefilterLabel(label: "PASS" | "BLOCK" | "UNKNOWN", partial: boolean) {
  return label === "BLOCK" && partial ? "UNKNOWN" : label;
}
