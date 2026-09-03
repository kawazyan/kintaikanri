import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatJst, toJstInputValue } from "@/lib/time";
import { AdminNav } from "../../admin-nav";
import { updateClockRecord } from "../actions";

const FIELD_CLASS =
  "rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

export default async function EditRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const record = await prisma.clockRecord.findUnique({ where: { id }, include: { staff: true } });
  if (!record) notFound();

  // 打刻がどのシフトにも紐付いていないと、勤務スタンプ・確定受取金額の
  // 集計に一切カウントされない(出退勤の記録自体は残っていても反映されない)。
  // その日の前後を含めて候補シフトを出し、ここで直接紐付け直せるようにする。
  const nearbyStart = new Date(record.timestamp.getTime() - 3 * 24 * 60 * 60 * 1000);
  const nearbyEnd = new Date(record.timestamp.getTime() + 3 * 24 * 60 * 60 * 1000);
  const nearbyShifts = await prisma.shift.findMany({
    where: { staffId: record.staffId, cancelledAt: null, startTime: { gte: nearbyStart, lt: nearbyEnd } },
    orderBy: { startTime: "asc" },
  });

  const boundAction = updateClockRecord.bind(null, record.id);

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <AdminNav />
      <h1 className="mb-6 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        打刻記録の修正 - {record.staff.name}({record.staff.employeeCode})
      </h1>

      <form action={boundAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          種別
          <select name="type" defaultValue={record.type} className={FIELD_CLASS}>
            <option value="IN">出勤</option>
            <option value="OUT">退勤</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          日時
          <input
            type="datetime-local"
            name="timestamp"
            defaultValue={toJstInputValue(record.timestamp)}
            required
            className={FIELD_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          店舗名
          <input
            type="text"
            name="storeName"
            defaultValue={record.storeName ?? ""}
            className={FIELD_CLASS}
          />
        </label>

        <p className="text-xs text-slate-500">
          位置情報: {record.latitude != null ? record.latitude.toFixed(6) : "未取得"} /{" "}
          {record.longitude != null ? record.longitude.toFixed(6) : "未取得"}(修正不可)
        </p>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          紐付けシフト
          <select name="shiftId" defaultValue={record.shiftId ?? ""} className={FIELD_CLASS}>
            <option value="">紐付けなし(シフト外)</option>
            {nearbyShifts.map((s) => (
              <option key={s.id} value={s.id}>
                {formatJst(s.startTime).slice(0, 16)}〜{formatJst(s.endTime).slice(-5)} ・ {s.storeName}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">
            打刻はシフトに紐付いていないと、勤務スタンプ・確定受取金額に反映されません。前後3日以内のシフトを候補として表示しています。
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          処理者名(変更履歴に記録されます)
          <input type="text" name="operatorName" className={FIELD_CLASS} />
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
