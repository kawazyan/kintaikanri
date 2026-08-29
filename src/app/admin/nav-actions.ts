"use server";

import { clearAdminCookie } from "@/lib/auth";

export async function clearAdminCookieAction() {
  await clearAdminCookie();
}
