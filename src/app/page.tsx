import { redirect } from "next/navigation";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IdentifyForm } from "./identify-form";

export default async function Home() {
  const staffId = await getStaffId();
  if (staffId) {
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (staff && staff.status === "ACTIVE") {
      redirect("/clock");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-2xl font-bold text-transparent">
          勤怠管理システム
        </h1>
        <p className="mt-1 text-sm text-slate-400">社員コードを入力してください</p>
      </div>
      <IdentifyForm />
    </main>
  );
}
