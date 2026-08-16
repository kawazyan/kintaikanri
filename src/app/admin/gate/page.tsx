import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { AdminGateForm } from "./gate-form";

export default async function AdminGatePage() {
  if (await isAdmin()) redirect("/admin");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
          管理者ログイン
        </h1>
      </div>
      <AdminGateForm />
    </main>
  );
}
