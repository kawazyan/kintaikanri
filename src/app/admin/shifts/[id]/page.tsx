import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toJstDateValue, toJstTimeValue, TIME_OPTIONS } from "@/lib/time";
import { CARRIERS, WORK_TYPE_LABEL } from "@/lib/carriers";
import { AdminNav } from "../../admin-nav";
import { adminUpdateShift } from "../actions";

const FIELD_CLASS =
  "rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

export default async function AdminEditShiftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const shift = await prisma.shift.findUnique({ where: { id }, include: { staff: true } });
  if (!shift) notFound();

  const boundAction = adminUpdateShift.bind(null, shift.id);

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <AdminNav />
      <h1 className="mb-6 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        シフト編集 - {shift.staff.name}({shift.staff.employeeCode})
      </h1>

      <form action={boundAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          稼働区分
          <select name="workType" defaultValue={shift.workType} className={FIELD_CLASS}>
            {(["BAND", "SPOT"] as const).map((wt) => (
              <option key={wt} value={wt}>
                {WORK_TYPE_LABEL[wt]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          キャリア
          <input
            type="text"
            name="carrier"
            list="carrier-options"
            defaultValue={shift.carrier}
            required
            className={FIELD_CLASS}
          />
          <datalist id="carrier-options">
            {CARRIERS.filter((c) => c !== "その他").map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          店舗名
          <input
            type="text"
            name="storeName"
            defaultValue={shift.storeName}
            required
            className={FIELD_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          稼働日
          <input
            type="date"
            name="date"
            defaultValue={toJstDateValue(shift.startTime)}
            required
            className={FIELD_CLASS}
          />
        </label>

        <div className="flex items-center gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm text-slate-400">
            開始時間
            <select
              name="startTime"
              defaultValue={toJstTimeValue(shift.startTime)}
              className={FIELD_CLASS}
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <span className="mt-5 text-slate-500">〜</span>
          <label className="flex flex-1 flex-col gap-1 text-sm text-slate-400">
            終業時間
            <select
              name="endTime"
              defaultValue={toJstTimeValue(shift.endTime)}
              className={FIELD_CLASS}
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          単価(スポット稼働のみ使用。帯稼働では未使用)
          <input
            type="number"
            name="unitAmount"
            min={0}
            step={1}
            defaultValue={shift.unitAmount ?? ""}
            className={FIELD_CLASS}
          />
        </label>

        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-white shadow-lg shadow-blue-950/50 active:scale-[0.98]"
        >
          保存
        </button>
      </form>
    </main>
  );
}
