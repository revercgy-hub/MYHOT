import { SITE } from "@aihot/industry/site";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/review";
import { useAdminAction } from "../../features/admin/action";
import { bj } from "../../features/admin/format";
import { isReviewPending, selectedReviewInputs, togglePageSelection, toggleReviewSelection } from "../../features/admin/review-state";
import { adminGet } from "../../lib/admin.server";
import { AdminPage, Badge, Button, Card, Empty } from "../../features/admin/ui";

type Decision = "select" | "reject" | "either";
type ViewStatus = "pending" | "confirmed" | "all";

interface BatchRow {
  id: string;
  batchHash: string;
  manifestSha256: string;
  schemaVersion: string;
  totalCount: number;
  pendingCount: number;
  confirmedCount: number;
  importedAt: string;
}

interface ReviewItem {
  caseId: string;
  contentHash: string | null;
  bodySha256: string | null;
  title: string;
  originalTitle: string | null;
  publishedAt: string | null;
  sourceName: string;
  sourceId: string;
  url: string;
  bodyStatus: string;
  bodyZh: string | null;
  bodyOriginal: string | null;
  humanAnnotation: { status: "needs_review" | "user_confirmed"; decision: Decision | null; confirmedBy: string | null; confirmedAt: string | null };
}

interface ReviewBatchPage {
  batch: BatchRow;
  page: { status: ViewStatus; limit: number; offset: number; total: number };
  items: ReviewItem[];
}

const PAGE_SIZE = 25;
const DECISIONS: Array<{ value: Decision; label: string }> = [
  { value: "select", label: "精选" },
  { value: "reject", label: "不精选" },
  { value: "either", label: "两可" },
];
const DECISION_LABEL: Record<Decision, string> = { select: "精选", reject: "不精选", either: "两可" };

function queryString(batchId: string, status: ViewStatus, offset: number) {
  return "?" + new URLSearchParams({ batch: batchId, status, offset: String(offset) }).toString();
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const list = await adminGet<{ batches: BatchRow[] }>(request, "/api/admin/review-batches");
  const requestedId = url.searchParams.get("batch");
  const batch = list.batches.find((row) => row.id === requestedId) ?? list.batches[0];
  const requestedStatus = url.searchParams.get("status") ?? "pending";
  const status: ViewStatus = ["pending", "confirmed", "all"].includes(requestedStatus) ? requestedStatus as ViewStatus : "pending";
  const rawOffset = Number(url.searchParams.get("offset") ?? 0);
  const offset = Number.isSafeInteger(rawOffset) && rawOffset > 0 ? rawOffset : 0;
  if (!batch) return { batches: list.batches, pageData: null, status, offset: 0 };
  const query = new URLSearchParams({ status, limit: String(PAGE_SIZE), offset: String(offset) });
  const pageData = await adminGet<ReviewBatchPage>(request, "/api/admin/review-batches/" + encodeURIComponent(batch.id) + "?" + query.toString());
  return { batches: list.batches, pageData, status, offset };
}

export const meta: Route.MetaFunction = () => [{ title: "人工审核 · " + SITE.name + " 后台" }];

export default function Review({ loaderData }: Route.ComponentProps) {
  const { batches, pageData, status, offset } = loaderData;
  const navigate = useNavigate();
  const { run, pending } = useAdminAction();
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelected([]);
    setExpanded([]);
    setSubmitMessage(null);
  }, [pageData?.batch.id, status, offset]);

  if (!pageData) {
    return <AdminPage title="人工审核" subtitle="逐项查看材料；只有显式勾选的待审项会提交人工决定。"><Card><Empty>目前没有可审核的批次。导入审核材料后会显示在这里。</Empty></Card></AdminPage>;
  }

  const { batch, page, items } = pageData;
  const selectable = items.filter(isReviewPending);
  const selectedInputs = selectedReviewInputs(items, selected);
  const allPageSelected = selectable.length > 0 && selectable.every((item) => selected.includes(item.caseId));
  const isSubmitting = pending?.startsWith("decision:") ?? false;

  const go = (next: { batchId?: string; status?: ViewStatus; offset?: number }) => {
    navigate({ search: queryString(next.batchId ?? batch.id, next.status ?? status, next.offset ?? 0) });
  };

  const submitDecision = async (decision: Decision) => {
    if (!selectedInputs.length || selectedInputs.length > 50 || isSubmitting) return;
    setSubmitMessage(null);
    const ids = selectedInputs.map((item) => item.caseId);
    const label = "decision:" + batch.id + ":" + decision + ":" + ids.join(",");
    const result = await run<{ appliedCount: number }>(
      "POST",
      "/api/admin/review-batches/" + encodeURIComponent(batch.id) + "/decisions",
      { batchHash: batch.batchHash, decision, items: selectedInputs },
      { label, success: "已记录 " + selectedInputs.length + " 条人工决定" },
    );
    if (result) {
      setSelected([]);
      setSubmitMessage("已保存" + DECISION_LABEL[decision] + "决定，列表已刷新。");
    } else {
      setSubmitMessage("提交未完成，已保留勾选项。若发生版本冲突，请刷新页面后重新审核。");
    }
  };

  return (
    <AdminPage
      title="人工审核"
      subtitle="按批次查看材料。机器建议不会显示在此页；未勾选的项目保持待审，已确认结果只读。人工审核结果用于后续筛选校准，不会自动发布内容或修改公开精选状态。"
      actions={<a className="inline-flex h-9 items-center justify-center rounded-control bg-surface px-3.5 text-[13.5px] font-medium text-ink ring-1 ring-line-strong hover:bg-bg-sunk" href={"/api/admin/review-batches/" + encodeURIComponent(batch.id) + "/export"}>导出人工标注</a>}
    >
      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(240px,1fr)_auto] lg:items-end">
        <label className="block text-[12.5px] text-ink-3">
          审核批次
          <select className="mt-1 block h-10 w-full rounded-control bg-surface px-3 text-[13.5px] text-ink ring-1 ring-line-strong" value={batch.id} onChange={(event) => go({ batchId: event.target.value })} aria-label="审核批次">
            {batches.map((entry) => <option key={entry.id} value={entry.id}>批次 {bj(entry.importedAt, true)} · 待审 {entry.pendingCount} · 已确认 {entry.confirmedCount}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="审核状态筛选">
          {([["pending", "待审"], ["confirmed", "已确认"], ["all", "全部"]] as const).map(([value, label]) => <Button key={value} tone={status === value ? "primary" : "secondary"} onClick={() => go({ status: value })}>{label}</Button>)}
        </div>
      </div>

      <Card className="mb-4" title="批次概况">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-ink-3">
          <span>总计 {batch.totalCount}</span><span>待审 {batch.pendingCount}</span><span>已确认 {batch.confirmedCount}</span>
          <span>批次日期 {bj(batch.importedAt, true)}</span>
        </div>
        <details className="mt-3 text-[12px] text-ink-4">
          <summary className="cursor-pointer select-none">查看批次标识</summary>
          <div className="mt-2 grid gap-1 break-all font-mono">
            <span>批次 {batch.batchHash}</span><span>材料清单 {batch.manifestSha256}</span><span>内部编号 {batch.id}</span>
          </div>
        </details>
      </Card>

      <Card pad={false} title={status === "pending" ? "待审材料" : status === "confirmed" ? "已确认材料（只读）" : "批次材料"} right={<span>本页 {items.length} 条 · {page.total ? page.offset + 1 + "–" + (page.offset + items.length) : "0"} / {page.total}</span>}>
        {items.length === 0 ? <Empty>{status === "pending" ? "当前批次没有待审项目。" : "此筛选下没有材料。"}</Empty> : (
          <div>
            {status !== "confirmed" && selectable.length > 0 && (
              <label className="flex items-center gap-2 border-b border-line bg-bg-sunk/40 px-4 py-3 text-[13px] text-ink-2">
                <input type="checkbox" checked={allPageSelected} onChange={(event) => setSelected((previous) => togglePageSelection(previous, selectable, event.target.checked))} aria-label="全选本页待审项目" />
                全选本页待审项目
              </label>
            )}
            <div className="divide-y divide-line/70">
              {items.map((item) => {
                const canReview = isReviewPending(item);
                const checked = selected.includes(item.caseId);
                const isExpanded = expanded.includes(item.caseId);
                const body = item.bodyZh || item.bodyOriginal;
                return (
                  <article key={item.caseId} className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" className="mt-1 size-4 shrink-0" checked={canReview && checked} disabled={!canReview || isSubmitting} onChange={(event) => setSelected((previous) => toggleReviewSelection(previous, item, event.target.checked))} aria-label={"选择待审材料 " + item.title} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {item.humanAnnotation.status === "user_confirmed" ? <Badge tone="info">已确认 · {item.humanAnnotation.decision ? DECISION_LABEL[item.humanAnnotation.decision] : "无决定"}</Badge> : <Badge tone="warn">待审</Badge>}
                        </div>
                        <h2 className="mt-2 text-[15px] font-semibold leading-snug text-ink">{item.title}</h2>
                        {item.originalTitle && item.originalTitle !== item.title && <p className="mt-1 text-[12.5px] text-ink-3">原标题：{item.originalTitle}</p>}
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-4">
                          <span>{item.sourceName}</span><span>{item.publishedAt ? bj(item.publishedAt, true) : "发布时间未知"}</span>
                          <a className="max-w-full break-all text-accent hover:underline" href={item.url} target="_blank" rel="noreferrer">查看原文</a>
                        </div>
                        {body && <div className="mt-3 rounded-control bg-bg-sunk/50 px-3 py-2.5 text-[13px] leading-relaxed text-ink-2">
                          <p className={isExpanded ? "whitespace-pre-wrap" : "line-clamp-4 whitespace-pre-wrap"}>{body}</p>
                          {body.length > 500 && <button type="button" className="mt-2 text-[12px] font-medium text-accent hover:underline" onClick={() => setExpanded((previous) => isExpanded ? previous.filter((id) => id !== item.caseId) : [...previous, item.caseId])}>{isExpanded ? "收起正文" : "展开正文"}</button>}
                        </div>}
                        {item.humanAnnotation.status === "user_confirmed" && <p className="mt-2 text-[11.5px] text-ink-4">只读标注 · {item.humanAnnotation.confirmedBy ?? "标注人未知"} · {item.humanAnnotation.confirmedAt ? bj(item.humanAnnotation.confirmedAt, true) : "时间未知"}</p>}
                        <details className="mt-2 text-[11.5px] text-ink-4">
                          <summary className="cursor-pointer select-none">查看材料标识</summary>
                          <div className="mt-1 grid gap-1 break-all font-mono">
                            <span>内部编号 {item.caseId}</span><span>正文状态 {item.bodyStatus}</span>
                            {item.contentHash && <span>内容校验值 {item.contentHash}</span>}
                            {item.bodySha256 && <span>正文校验值 {item.bodySha256}</span>}
                          </div>
                        </details>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {status !== "confirmed" && (
        <div className="sticky bottom-3 z-20 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-panel bg-surface/95 p-3 shadow-lg ring-1 ring-line backdrop-blur">
          <div className="text-[13px] text-ink-2">已勾选 <strong className="num">{selectedInputs.length}</strong> 条 · 未勾选项目保持待审</div>
          <div className="flex flex-wrap gap-2">
            {DECISIONS.map(({ value, label }) => <Button key={value} tone={value === "reject" ? "danger" : value === "select" ? "primary" : "secondary"} busy={pending === "decision:" + batch.id + ":" + value + ":" + selectedInputs.map((item) => item.caseId).join(",")} disabled={!selectedInputs.length || isSubmitting} onClick={() => submitDecision(value)}>{label}</Button>)}
          </div>
        </div>
      )}
      {submitMessage && <p role="status" className="mt-3 text-[12.5px] text-ink-3">{submitMessage}</p>}
      <div className="mt-4 flex items-center justify-between text-[12.5px] text-ink-3">
        <Button disabled={page.offset <= 0} onClick={() => go({ offset: Math.max(0, page.offset - page.limit) })}>上一页</Button>
        <span>每页 {page.limit} 条</span>
        <Button disabled={page.offset + items.length >= page.total} onClick={() => go({ offset: page.offset + page.limit })}>下一页</Button>
      </div>
    </AdminPage>
  );
}
