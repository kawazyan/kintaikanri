import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "../admin-nav";
import { CopyCode } from "./copy-code";
import { disconnectDailySummaryGroup, disconnectLineGroup, issueDailySummaryLinkCode, issueLineLinkCode } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminLinePage() {
  await requireAdmin();
  const staff = await prisma.staff.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ employeeCode: "asc" }],
    select: { id: true, name: true, employeeCode: true, lineGroupId: true, lineLinkCode: true },
  });
  const dailyGroup = await prisma.lineDailySummaryGroup.findUnique({ where: { id: "main" } });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-slate-800">
      <AdminNav />
      <h1 className="text-2xl font-black">LINE出勤アラート</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        従業員ごとに本人と担当上司のLINEグループを作成し、LINE公式アカウントを招待してください。
        下の連携コードを発行し、そのグループで表示された「勤怠連携」から始まる文を送ると連携できます。
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        連携後は、出勤予定の5分前と未出勤アラートの対象になった際にグループへ通知します。これまでのメール通知も続きます。
      </p>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-black">毎朝9時の出勤予定者一覧</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          管理者用のLINEグループへ、当日の出勤予定者と時間・店舗を送ります。公式アカウントを招待したグループで、下の連携文を送信してください。
        </p>
        <p className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-black ${dailyGroup?.groupId ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
          {dailyGroup?.groupId ? "グループ連携済み" : "未連携"}
        </p>
        <div className="mt-3 flex gap-2">
          <form action={issueDailySummaryLinkCode}>
            <button type="submit" className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-black text-white">
              {dailyGroup?.linkCode ? "コードを再発行" : "連携コードを発行"}
            </button>
          </form>
          {(dailyGroup?.groupId || dailyGroup?.linkCode) && (
            <form action={disconnectDailySummaryGroup}>
              <button type="submit" className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-bold">連携を解除</button>
            </form>
          )}
        </div>
        {dailyGroup?.linkCode && <CopyCode text={`日報連携 ${dailyGroup.linkCode}`} />}
      </section>

      <div className="mt-6 space-y-3">
        {staff.map((person) => (
          <section key={person.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black">
                  {person.name} <span className="text-sm font-normal text-slate-500">({person.employeeCode})</span>
                </h2>
                <p className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-black ${person.lineGroupId ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                  {person.lineGroupId ? "グループ連携済み" : "未連携"}
                </p>
              </div>
              <div className="flex gap-2">
                <form action={issueLineLinkCode}>
                  <input type="hidden" name="staffId" value={person.id} />
                  <button className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-black text-white" type="submit">
                    {person.lineLinkCode ? "コードを再発行" : "連携コードを発行"}
                  </button>
                </form>
                {(person.lineGroupId || person.lineLinkCode) && (
                  <form action={disconnectLineGroup}>
                    <input type="hidden" name="staffId" value={person.id} />
                    <button className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-bold" type="submit">
                      連携を解除
                    </button>
                  </form>
                )}
              </div>
            </div>
            {person.lineLinkCode && <CopyCode text={`勤怠連携 ${person.lineLinkCode}`} />}
          </section>
        ))}
      </div>
    </main>
  );
}
