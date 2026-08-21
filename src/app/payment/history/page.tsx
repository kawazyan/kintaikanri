import { redirect } from "next/navigation";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatJst } from "@/lib/time";
import { BottomTabBar } from "@/components/bottom-tab-bar";

export default async function PaymentHistoryPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  // Scoped to the logged-in staff's own id only — never accepts a staff id
  // from the client, so this can't be used to read another staff's history.
  const requests = await prisma.transferRequest.findMany({
    where: { staffId },
    orderBy: { requestedAt: "desc" },
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 pt-8 pb-28">
      <h1 className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        振込申請履歴
      </h1>

      <ul className="flex flex-col gap-2 text-sm">
        {requests.map((r) => (
          <li
            key={r.id}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 shadow-md shadow-black/30 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-100">
                {r.amount.toLocaleString("ja-JP")}円
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  r.status === "PAID"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-amber-500/10 text-amber-400"
                }`}
              >
                {r.status === "PAID" ? "振込済み" : "申請中"}
              </span>
            </div>
            <div className="mt-1 text-slate-500">
              申請日: {formatJst(r.requestedAt)} / 希望日:{" "}
              {new Intl.DateTimeFormat("ja-JP", {
                timeZone: "Asia/Tokyo",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(r.desiredPaymentDate)}
            </div>
          </li>
        ))}
        {requests.length === 0 && (
          <p className="text-sm text-slate-500">振込申請履歴はありません。</p>
        )}
      </ul>

      <BottomTabBar />
    </main>
  );
}
