import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
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
    <main className="min-h-dvh bg-gradient-to-b from-white via-[#fdfaf5] to-[#faf5eb]">
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pt-8 pb-28">
      <h1 className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-slate-700 bg-clip-text text-xl font-bold text-transparent">
        <Wallet size={20} className="text-red-500" />
        振込申請履歴
      </h1>

      <ul className="flex flex-col gap-2 text-sm">
        {requests.map((r) => (
          <li
            key={r.id}
            className="rounded-xl bg-gradient-to-b from-white to-slate-100 p-3 shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">
                {r.amount.toLocaleString("ja-JP")}円
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs font-semibold ${
                  r.status === "PAID"
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-amber-500/15 text-amber-700"
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
    </div>

      <BottomTabBar />
    </main>
  );
}
