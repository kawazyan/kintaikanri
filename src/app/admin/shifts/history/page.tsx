import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatJst } from "@/lib/time";
import { WORK_TYPE_LABEL } from "@/lib/carriers";
import { AdminNav } from "../../admin-nav";

const CHANGE_TYPE_LABEL: Record<string, string> = {
  CREATE: "新規登録",
  UPDATE: "変更",
  DELETE: "削除",
};

function summarize(json: unknown) {
  if (!json || typeof json !== "object") return "-";
  const v = json as Record<string, unknown>;
  const start = v.startTime ? formatJst(new Date(v.startTime as string)) : "-";
  const end = v.endTime ? formatJst(new Date(v.endTime as string)) : "-";
  const workType = v.workType === "BAND" || v.workType === "SPOT" ? WORK_TYPE_LABEL[v.workType] : "-";
  return `${start} 〜 ${end} / ${workType} / ${v.carrier ?? "-"} / ${v.storeName ?? "-"}`;
}

export default async function ShiftHistoryPage() {
  await requireAdmin();
  const histories = await prisma.shiftHistory.findMany({
    include: { staff: true },
    orderBy: { changedAt: "desc" },
    take: 200,
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <AdminNav />
      <h1 className="mb-6 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        シフト変更履歴
      </h1>

      <ul className="flex flex-col gap-3 text-sm">
        {histories.map((h) => (
          <li
            key={h.id}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 backdrop-blur-sm"
          >
            <div className="flex justify-between text-slate-500">
              <span>
                {h.staff.name}({h.staff.employeeCode}) - {CHANGE_TYPE_LABEL[h.changeType] ?? h.changeType}
              </span>
              <span>{formatJst(h.changedAt)}</span>
            </div>
            {h.changeType === "DELETE" ? (
              <p className="mt-1 text-red-400 line-through">{summarize(h.before)}</p>
            ) : (
              <>
                {h.before && (
                  <p className="mt-1 text-slate-500 line-through">{summarize(h.before)}</p>
                )}
                <p className="mt-1 text-slate-200">{summarize(h.after)}</p>
              </>
            )}
          </li>
        ))}
        {histories.length === 0 && (
          <p className="text-sm text-slate-500">変更履歴はありません。</p>
        )}
      </ul>
    </main>
  );
}
