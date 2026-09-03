import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toJstInputValue } from "@/lib/time";
import { AdminNav } from "../../admin-nav";
import { createClockRecordByAdmin } from "../actions";

const FIELD_CLASS =
  "rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

export default async function NewRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ staffId?: string }>;
}) {
  await requireAdmin();
  const { staffId } = await searchParams;

  const staffList = await prisma.staff.findMany({
    where: { status: "ACTIVE" },
    orderBy: { employeeCode: "asc" },
  });

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <AdminNav />
      <p className="mb-2 text-sm">
        <Link href="/admin/records" className="text-blue-400 underline">
          ← 打刻記録一覧へ戻る
        </Link>
      </p>
      <h1 className="mb-1 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        打刻を代わりに登録
      </h1>
      <p className="mb-6 text-xs text-slate-500">
        スタッフが出勤・退勤の打刻を押し忘れた場合などに、管理者が代わりに時刻を指定して打刻記録を追加します。
      </p>

      <form action={createClockRecordByAdmin} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          対象スタッフ
          <select
            name="staffId"
            defaultValue={staffId ?? ""}
            required
            className={FIELD_CLASS}
          >
            <option value="" disabled>
              選択してください
            </option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}({s.employeeCode})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          種別
          <select name="type" defaultValue="IN" className={FIELD_CLASS}>
            <option value="IN">出勤</option>
            <option value="OUT">退勤</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          日時
          <input
            type="datetime-local"
            name="timestamp"
            defaultValue={toJstInputValue(new Date())}
            required
            className={FIELD_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          店舗名(任意・未入力なら当日のシフトから自動設定)
          <input type="text" name="storeName" className={FIELD_CLASS} />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          処理者名(変更履歴に記録されます)
          <input type="text" name="operatorName" className={FIELD_CLASS} />
        </label>

        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-white shadow-lg shadow-blue-950/50 active:scale-[0.98]"
        >
          この内容で打刻を追加
        </button>
      </form>
    </main>
  );
}
