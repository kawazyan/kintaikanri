"use server";

import { redirect } from "next/navigation";
import { setAdminCookie } from "@/lib/auth";

export async function submitAdminPassword(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return { error: "サーバー設定エラー: 管理者パスワードが未設定です" };
  }
  if (password !== expected) {
    return { error: "パスワードが正しくありません" };
  }

  await setAdminCookie();
  redirect("/admin");
}
