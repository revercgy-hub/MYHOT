import { SITE } from "@aihot/industry/site";
import { useEffect, useState } from "react";
import type { Route } from "./+types/summary-drafts";
import { isSummaryDraftPending, selectedSummaryDraftInputs, toggleAllSummaryDrafts, toggleSummaryDraftSelection } from "../../features/admin/summary-draft-state";
import { useAdminAction } from "../../features/admin/action";
import { bj } from "../../features/admin/format";
import { adminGet } from "../../lib/admin.server";
import { AdminPage, Badge, Button, Card, Empty, FilterChips, Pager } from "../../features/admin/ui";

type DraftStatus = "pending" | "approved" | "rejected";
type StatusFilter = DraftStatus | "all";
type Decision = "approve" | "reject";

interface DraftRow {
  draftId: string;
  draftSha256: string;
  createdAt: string;
  status: DraftStatus;
  reviewer: string | null;
  reviewedAt: string | null;
  sourceName: string;
  title: string;
  publishedAt: string | null;
  bodyText: string;
  bodySha256: string;
  model: string;
  promptVersion: string;
  summaryZh: string;
  titleZh: string | null;
  category: string | null;
  tags: string[];
  receiptIds: number[];
  url: string;
}

interface DraftList {
  total: number;
  limit: number;
  offset: number;
  items: DraftRow[];
}

interface ReviewResultItem {
  draftId: string;
  status: "approved" | "rejected" | "failed" | "already_reviewed";
  decision?: Decision;
  error?: string;
  replayed?: boolean;
}

interface ReviewResponse {
  appliedCount: number;
  failedCount: number;
  replayed: boolean;
  items: ReviewResultItem[];
}

const PAGE_SIZE = 25;
const STATUS_LABEL: Record<DraftStatus, string> = { pending: "待审核", approved: "已批准并发布", rejected: "已退回" };
const STATUS_TONE: Record<DraftStatus, "warn" | "ok" | "muted"> = { pending: "warn", approved: "ok", rejected: "muted" };
const RESULT_LABEL: Record<ReviewResultItem["status"], string> = {
  approved: "已批准并发布到全部动态",
  rejected: "已退回",
  failed: "未完成",
  already_reviewed: "已被处理，请刷新确认",
};

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const requestedStatus = url.searchParams.get("status") ?? "pending";
  const status: StatusFilter = ["pending", "approved", "rejected", "all"].includes(requestedStatus) ? requestedStatus as StatusFilter : "pending";
  const rawPage = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10_000) : 1;
  const offset = (page - 1) * PAGE_SIZE;
  const query = new URLSearchParams({ status, limit: String(PAGE_SIZE), offset: String(offset) });
  const data = await adminGet<DraftList>(request, `/api/admin/summary-drafts?${query}`);
  return { ...data, status, page };
}

export const meta: Route.MetaFunction = () => [{ title: `摘要审核 · ${SITE.name} 后台` }];

export default function SummaryDrafts({ loaderData }: Route.ComponentProps) {
  const { items, total, status, page } = loaderData;
  const { run, pending } = useAdminAction();
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<ReviewResponse | null>(null);
  const pendingItems = items.filter(isSummaryDraftPending);
  const selectedItems = selectedSummaryDraftInputs(items, selected, "approve");
  const allPageSelected = pendingItems.length > 0 && pendingItems.every((item) => selected.includes(item.draftId));
  const isSubmitting = pending?.startsWith("summary-draft-review:") ?? false;

  useEffect(() => {
    setSelected([]);
    setResult(null);
  }, [status, page]);

  const selectPage = (checked: boolean) => setSelected((previous) => toggleAllSummaryDrafts(previous, items, checked));

  const submit = async (decision: Decision) => {
    const inputs = selectedSummaryDraftInputs(items, selected, decision);
    if (!inputs.length || inputs.length > PAGE_SIZE || isSubmitting) return;
    setResult(null);
    const label = `summary-draft-review:${decision}:${inputs.map((item) => `${item.draftId}:${item.expectedDraftSha256}`).join(",")}`;
    const response = await run<ReviewResponse>(
      "POST",
      "/api/admin/summary-drafts/review",
      { items: inputs },
      { label, revalidate: true },
    );
    if (!response) return;
    setResult(response);
    const completed = new Set(response.items.filter((item) => item.status !== "failed").map((item) => item.draftId));
    setSelected((previous) => previous.filter((id) => !completed.has(id)));
  };

  const statusChips = [
    { value: "", label: "待审核", count: status === "pending" ? total : undefined },
    { value: "approved", label: "已批准", count: status === "approved" ? total : undefined },
    { value: "rejected", label: "已退回", count: status === "rejected" ? total : undefined },
    { value: "all", label: "全部", count: status === "all" ? total : undefined },
  ];

  return (
    <AdminPage
      title="摘要审核"
      subtitle="逐条对照官方正文与模型草稿。批准后只发布摘要和原文链接到全部动态，保持非精选；不写Gold标签、不改评分或门槛。未勾选的草稿保持待审核。"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterChips param="status" options={statusChips} />
        <Badge tone="info">每页最多 {PAGE_SIZE} 条</Badge>
      </div>

      {result && (
        <Card className="mb-4" title="本次审核结果" right={<Badge tone={result.failedCount ? "warn" : "ok"}>{result.appliedCount} 完成 · {result.failedCount} 未完成</Badge>}>
          {result.replayed && <p className="mb-2 text-[12.5px] text-ink-3">这是同一请求的安全重放结果。</p>}
          <ul className="space-y-1.5 text-[13px]" aria-live="polite">
            {result.items.map((item) => (
              <li key={item.draftId} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-[11.5px] text-ink-4">{item.draftId}</span>
                <span className={item.status === "failed" ? "text-hot" : "text-ink-2"}>{RESULT_LABEL[item.status]}</span>
                {item.error && <span className="text-ink-4">· {item.error}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {items.length === 0 ? (
        <Card><Empty>{status === "pending" ? "目前没有待审核摘要。" : "这个筛选下没有摘要草稿。"}</Empty></Card>
      ) : (
        <div className="space-y-3">
          {status === "pending" && pendingItems.length > 0 && (
            <label className="flex items-center gap-2 rounded-control bg-bg-sunk/60 px-4 py-3 text-[13px] text-ink-2">
              <input
                type="checkbox"
                className="size-4 accent-[var(--accent)]"
                checked={allPageSelected}
                disabled={isSubmitting}
                onChange={(event) => selectPage(event.target.checked)}
                aria-label="全选本页待审核摘要"
              />
              全选本页待审核摘要
            </label>
          )}
          {items.map((item) => {
            const canReview = isSummaryDraftPending(item);
            const isSelected = canReview && selected.includes(item.draftId);
            const reviewResult = result?.items.find((entry) => entry.draftId === item.draftId);
            return (
              <article key={item.draftId} className="rounded-panel bg-surface p-4 ring-1 ring-line sm:p-5">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
                    checked={isSelected}
                    disabled={!canReview || isSubmitting}
                    onChange={(event) => {
                      setResult(null);
                      setSelected((previous) => toggleSummaryDraftSelection(previous, item, event.target.checked));
                    }}
                    aria-label={`选择待审核摘要 ${item.titleZh || item.title}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                      <Badge tone="muted">默认非精选</Badge>
                      {reviewResult && <Badge tone={reviewResult.status === "failed" ? "warn" : "ok"}>{RESULT_LABEL[reviewResult.status]}</Badge>}
                    </div>
                    <h2 className="mt-2 text-[16px] font-semibold leading-snug text-ink">{item.titleZh || item.title}</h2>
                    {item.titleZh && item.titleZh !== item.title && <p className="mt-1 text-[12.5px] text-ink-3">原始标题：{item.title}</p>}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-4">
                      <span>{item.sourceName}</span>
                      <span>发布时间 {item.publishedAt ? bj(item.publishedAt, true) : "未知"}</span>
                      <span>草稿 {bj(item.createdAt, true)}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
                      <span>模型 {item.model}</span>
                      <span>提示版本 {item.promptVersion}</span>
                      <details className="relative">
                        <summary className="cursor-pointer select-none">回执 {item.receiptIds.length} 条</summary>
                        {item.receiptIds.length > 0 && <ul className="absolute left-0 z-10 mt-1 max-h-36 min-w-48 overflow-auto rounded-control bg-surface p-2 font-mono text-[11px] shadow-lg ring-1 ring-line">{item.receiptIds.map((id) => <li key={id}>{id}</li>)}</ul>}
                      </details>
                      <span>正文 SHA-256 {item.bodySha256.slice(0, 12)}…</span>
                      {safeHttpUrl(item.url) ? <a className="break-all text-accent hover:underline" href={safeHttpUrl(item.url)!} target="_blank" rel="noopener noreferrer">查看官方原文</a> : <span className="text-hot">原文链接不可用</span>}
                    </div>

                    <div className="mt-4 grid gap-3 xl:grid-cols-2">
                      <section className="rounded-control bg-bg-sunk/60 p-3 ring-1 ring-line">
                        <h3 className="mb-2 text-[12px] font-semibold text-ink-3">模型摘要草稿{item.category ? ` · ${item.category}` : ""}</h3>
                        <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{item.summaryZh}</p>
                        {item.tags.length > 0 && <p className="mt-2 text-[12px] text-ink-4">标签：{item.tags.join("、")}</p>}
                      </section>
                      <details className="rounded-control bg-bg-sunk/60 p-3 ring-1 ring-line">
                        <summary className="cursor-pointer select-none text-[12px] font-semibold text-ink-3">展开官方正文核对</summary>
                        <p className="mt-2 max-h-[520px] overflow-auto whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-2">{item.bodyText || "没有可显示的正文；请勿批准。"}</p>
                      </details>
                    </div>
                    {(!item.bodyText.trim() || !/^[a-f0-9]{64}$/i.test(item.draftSha256) || !item.receiptIds.length) && (
                      <p className="mt-3 rounded-control bg-amber/10 px-3 py-2 text-[12.5px] text-amber">
                        草稿或正文证据不完整，建议退回；后端仍会再次核对版本和回执。
                      </p>
                    )}
                    {item.status !== "pending" && item.reviewer && (
                      <p className="mt-2 text-[11.5px] text-ink-4">处理人 {item.reviewer}{item.reviewedAt ? ` · ${bj(item.reviewedAt, true)}` : ""}</p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {status === "pending" && selectedItems.length > 0 && (
        <div className="sticky bottom-3 z-20 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-panel bg-surface/95 p-3 shadow-lg ring-1 ring-line backdrop-blur">
          <div className="text-[13px] text-ink-2">已勾选 <strong className="num">{selectedItems.length}</strong> 条 · 未勾选项目保持待审</div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={isSubmitting} busy={pending?.startsWith("summary-draft-review:approve:") ?? false} onClick={() => submit("approve")}>
              批准并发布到全部动态
            </Button>
            <Button tone="danger" disabled={isSubmitting} busy={pending?.startsWith("summary-draft-review:reject:") ?? false} onClick={() => submit("reject")}>
              退回所选草稿
            </Button>
          </div>
        </div>
      )}
      <Pager page={page} hasMore={page * PAGE_SIZE < total} />
    </AdminPage>
  );
}
