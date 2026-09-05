import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { RequestForm } from "../request-form";

export default async function NewShiftChangeRequestPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");
  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  return (
    <main className="min-h-dvh bg-[#f5f6f8] text-slate-900">
      <div className="mx-auto max-w-md px-4 pb-28 pt-6">
        <Link href="/shift-change-request" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
          <ChevronLeft size={14} />
          申請一覧へ戻る
        </Link>
        <h1 className="mt-2 text-2xl font-black">シフト変更申請</h1>
        <p className="mt-1 text-sm text-slate-500">関係者との調整が完了した内容をシステムへ申請します</p>

        <div className="mt-4">
          <RequestForm />
        </div>
      </div>
      <BottomTabBar />
    </main>
  );
}
