import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "../admin-nav";
import { createStaff } from "./actions";
import { StaffList } from "./staff-list";

const FIELD_CLASS =
  "rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ showRetired?: string; saved?: string }>;
}) {
  await requireAdmin();
  const { showRetired, saved } = await searchParams;

  const [staffList, allStaffForDupeCheck] = await Promise.all([
    prisma.staff.findMany({
      where: showRetired ? {} : { status: "ACTIVE" },
      orderBy: { employeeCode: "asc" },
    }),
    // 同姓同名の重複登録がないかを常にチェックする(在籍・退職済み問わず)。
    // 打刻・シフトが別々の重複スタッフ行に分散して紐付いていると、本人が
    // アプリで見ている画面(ログイン中の1行分)には実績が反映されず、
    // 「打刻はできているのに勤務スタンプ・確定受取金額が増えない」ように
    // 見えるが実際には他人ではなく「もう一つの自分の行」に記録されている、
    // という事故につながるため。
    prisma.staff.findMany({ select: { id: true, name: true, employeeCode: true, status: true } }),
  ]);

  const duplicateNameGroups = Object.values(
    allStaffForDupeCheck.reduce<Record<string, typeof allStaffForDupeCheck>>((acc, s) => {
      (acc[s.name] ??= []).push(s);
      return acc;
    }, {})
  ).filter((group) => group.length > 1);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <AdminNav />
      <h1 className="mb-6 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        スタッフ管理
      </h1>

      {saved === "1" && (
        <p className="mb-4 rounded-lg border border-emerald-700 bg-emerald-950/40 px-3 py-2 text-sm font-semibold text-emerald-300">
          保存しました
        </p>
      )}

      {duplicateNameGroups.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-700 bg-red-950/30 p-3 text-sm text-red-200">
          <p className="font-bold">同姓同名のスタッフが複数登録されています。</p>
          <p className="mt-1 text-xs text-red-300/80">
            同じ人が別々のスタッフ行として重複登録されていると、打刻・シフトがどちらかの行にしか記録されず、
            本人がログインしている方の画面には勤務スタンプ・確定受取金額が反映されないことがあります。
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {duplicateNameGroups.map((group) => (
              <li key={group[0].name} className="text-red-100">
                {group[0].name}: {group.map((s) => `${s.employeeCode}(${s.status === "ACTIVE" ? "在籍中" : "退職済み"})`).join(" / ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40 backdrop-blur-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">新規スタッフ登録</h2>
        <form action={createStaff} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input name="employeeCode" placeholder="社員コード" required className={FIELD_CLASS} />
          <input name="name" placeholder="氏名" required className={FIELD_CLASS} />
          <input
            name="email"
            type="email"
            placeholder="メールアドレス"
            required
            className={FIELD_CLASS}
          />
          <button
            type="submit"
            className="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-2 text-sm font-medium text-white shadow-md shadow-blue-950/50 active:scale-[0.98]"
          >
            追加
          </button>
        </form>
      </section>

      <div className="mb-3 text-sm">
        <a
          href={showRetired ? "/admin/staff" : "/admin/staff?showRetired=1"}
          className="text-blue-400 underline"
        >
          {showRetired ? "在籍中のみ表示" : "退職済みも表示"}
        </a>
      </div>

      <StaffList staffList={staffList} showRetired={!!showRetired} />
    </main>
  );
}
