import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatJst, formatJstDate } from "@/lib/time";
import {
  IRREGULAR_REPORT_TYPE_LABEL,
  IRREGULAR_REPORT_STATUS_LABEL,
  SHIFT_CHANGE_KIND_LABEL,
  SHIFT_CHANGE_STATUS_LABEL,
} from "@/lib/attendance-requests";
import { AdminNav } from "../admin-nav";
import { updateIrregularReportStatus, approveShiftChangeRequest, rejectShiftChangeRequest } from "./actions";
import type { IrregularReportStatus } from "@prisma/client";

const FIELD_CLASS =
  "rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1 text-slate-100 text-sm focus:border-blue-500 focus:outline-none";

type FilterValue = "all" | "pending" | "reports" | "requests";

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "pending", label: "未対応" },
  { value: "reports", label: "イレギュラー報告" },
  { value: "requests", label: "シフト変更申請" },
];

export default async function AdminStaffRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireAdmin();
  const { filter: filterParam } = await searchParams;
  const filter: FilterValue = (["all", "pending", "reports", "requests"] as const).includes(filterParam as FilterValue)
    ? (filterParam as FilterValue)
    : "all";

  const [reports, requests] = await Promise.all([
    filter === "requests"
      ? []
      : prisma.irregularReport.findMany({
          where: filter === "pending" ? { status: { not: "RESOLVED" } } : undefined,
          include: { staff: true },
          orderBy: { createdAt: "desc" },
          take: 200,
        }),
    filter === "reports"
      ? []
      : prisma.shiftChangeRequest.findMany({
          where: filter === "pending" ? { status: "PENDING" } : undefined,
          include: { staff: true },
          orderBy: { createdAt: "desc" },
          take: 200,
        }),
  ]);

  type Row =
    | { kind: "report"; createdAt: Date; data: (typeof reports)[number] }
    | { kind: "request"; createdAt: Date; data: (typeof requests)[number] };

  const rows: Row[] = [
    ...reports.map((r) => ({ kind: "report" as const, createdAt: r.createdAt, data: r })),
    ...requests.map((r) => ({ kind: "request" as const, createdAt: r.createdAt, data: r })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-slate-100">
      <AdminNav />
      <h1 className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        申請・報告管理
      </h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/admin/attendance-requests" : `/admin/attendance-requests?filter=${f.value}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
              filter === f.value ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {rows.length === 0 && <p className="text-sm text-slate-400">該当する項目はありません。</p>}

        {rows.map((row) =>
          row.kind === "report" ? (
            <ReportRow key={`r-${row.data.id}`} report={row.data} />
          ) : (
            <RequestRow key={`s-${row.data.id}`} request={row.data} />
          )
        )}
      </div>
    </main>
  );
}

function ReportRow({
  report,
}: {
  report: Awaited<ReturnType<typeof prisma.irregularReport.findMany>>[number] & { staff: { name: string; employeeCode: string } };
}) {
  return (
    <article className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-blue-400">イレギュラー報告</p>
          <p className="mt-1 font-black">
            {report.staff.name} ・ {IRREGULAR_REPORT_TYPE_LABEL[report.reportType]}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            対象日: {formatJstDate(report.targetDate)} ・ 報告日時: {formatJst(report.createdAt)}
          </p>
          <p className="mt-1 text-sm text-slate-300">{report.reason}</p>
          <p className="mt-1 text-xs text-slate-500">{report.details}</p>
          {(report.changedTime || report.changedLocation) && (
            <p className="mt-1 text-xs text-slate-500">
              {report.changedTime && `変更後予定時間: ${report.changedTime} `}
              {report.changedLocation && `変更後勤務場所: ${report.changedLocation}`}
            </p>
          )}
        </div>
        <span className="h-fit shrink-0 rounded-full bg-slate-800 px-3 py-1 text-xs font-black">
          {IRREGULAR_REPORT_STATUS_LABEL[report.status]}
        </span>
      </div>

      <StatusForm reportId={report.id} reviewerName={report.reviewerName} />
    </article>
  );
}

function StatusForm({
  reportId,
  reviewerName,
}: {
  reportId: string;
  reviewerName: string | null;
}) {
  return (
    <form className="mt-4 flex flex-wrap items-center gap-2">
      <input name="reviewerName" required defaultValue={reviewerName ?? ""} placeholder="確認者名" className={FIELD_CLASS} />
      <StatusSubmitButtons reportId={reportId} />
    </form>
  );
}

function StatusSubmitButtons({ reportId }: { reportId: string }) {
  // select/inputの値をそのまま使い、ステータスごとに個別のformActionを
  // bindするのではなく、クライアント側の追加コードなしで送信できるよう
  // 「対応済みにする」「確認中にする」「未確認に戻す」の3ボタンにする。
  return (
    <>
      <SubmitStatusButton reportId={reportId} status="IN_PROGRESS" label="確認中にする" tone="amber" />
      <SubmitStatusButton reportId={reportId} status="RESOLVED" label="対応済みにする" tone="emerald" />
      <SubmitStatusButton reportId={reportId} status="UNCONFIRMED" label="未確認に戻す" tone="slate" />
    </>
  );
}

function SubmitStatusButton({
  reportId,
  status,
  label,
  tone,
}: {
  reportId: string;
  status: IrregularReportStatus;
  label: string;
  tone: "amber" | "emerald" | "slate";
}) {
  const toneClass =
    tone === "amber" ? "bg-amber-600" : tone === "emerald" ? "bg-emerald-600" : "bg-slate-700";
  const boundAction = updateIrregularReportStatus.bind(null, reportId, status);
  return (
    <button formAction={boundAction} className={`rounded-lg px-3 py-1.5 text-xs font-black text-white ${toneClass}`}>
      {label}
    </button>
  );
}

function RequestRow({
  request,
}: {
  request: Awaited<ReturnType<typeof prisma.shiftChangeRequest.findMany>>[number] & {
    staff: { name: string; employeeCode: string };
  };
}) {
  const approveAction = approveShiftChangeRequest.bind(null, request.id);
  const rejectAction = rejectShiftChangeRequest.bind(null, request.id);

  return (
    <article className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-emerald-400">シフト変更申請</p>
          <p className="mt-1 font-black">
            {request.staff.name} ・ {SHIFT_CHANGE_KIND_LABEL[request.kind]}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            対象日: {formatJstDate(request.targetDate)} ・ 申請日時: {formatJst(request.createdAt)}
          </p>
          <p className="mt-1 text-sm text-slate-300">{request.reason}</p>
          <p className="mt-1 text-xs text-slate-500">
            {request.kind === "DATE_CHANGE" && request.newDate && `変更後の勤務日: ${formatJstDate(request.newDate)}`}
            {request.kind === "TIME_CHANGE" && `変更後の勤務時間: ${request.newStartTime} 〜 ${request.newEndTime}`}
            {request.kind === "LOCATION_CHANGE" && `変更後の勤務場所: ${request.newLocation}`}
            {request.kind === "TRANSFER" && request.transferDate && `振替日: ${formatJstDate(request.transferDate)}`}
          </p>
          {request.status === "REJECTED" && request.rejectionReason && (
            <p className="mt-1 text-xs font-bold text-red-400">却下理由: {request.rejectionReason}</p>
          )}
        </div>
        <span className="h-fit shrink-0 rounded-full bg-slate-800 px-3 py-1 text-xs font-black">
          {SHIFT_CHANGE_STATUS_LABEL[request.status]}
        </span>
      </div>

      {request.status === "PENDING" && (
        <form className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
          <input name="reviewerName" required placeholder="承認者名" className={FIELD_CLASS} />
          <input name="rejectionReason" placeholder="却下理由(却下時は必須)" className={FIELD_CLASS} />
          <button formAction={approveAction} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white">
            承認
          </button>
          <button formAction={rejectAction} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-black text-white">
            却下
          </button>
        </form>
      )}
    </article>
  );
}
