import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// 会社経費ページ(/admin/company-expenses)専用のパスワード。管理画面にログインしたうえで、さらにこのパスワードが必要。
// パスワードはコードに書かず、環境変数 EXPENSE_PAGE_PASSWORD(Vercelの設定)から読む。未設定のときは誰も開けない。
const COOKIE = "kj_company_expenses";
export const EXPENSE_COOKIE_PATH = "/admin/company-expenses";
const MAX_AGE = 60 * 60 * 4; // 4時間

function configuredPassword(): string {
  return process.env.EXPENSE_PAGE_PASSWORD ?? "";
}

export function expenseGateConfigured(): boolean {
  return configuredPassword().length > 0;
}

const digest = (key: string, value: string) => createHmac("sha256", key).update(value).digest();

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function expensePasswordMatches(input: string): boolean {
  const pw = configuredPassword();
  if (!pw) return false;
  return safeEqual(digest("kj-compare", input), digest("kj-compare", pw));
}

// Cookieに入れる値。パスワードそのものではなく、パスワードから作った署名。
function sessionToken(): string {
  return createHmac("sha256", configuredPassword()).update("company-expenses-session-v1").digest("hex");
}

export async function isExpenseUnlocked(): Promise<boolean> {
  if (!expenseGateConfigured()) return false;
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  return safeEqual(Buffer.from(value), Buffer.from(sessionToken()));
}

export async function unlockExpenses() {
  (await cookies()).set(COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: MAX_AGE,
    path: EXPENSE_COOKIE_PATH,
  });
}

export async function lockExpenses() {
  (await cookies()).delete({ name: COOKIE, path: EXPENSE_COOKIE_PATH });
}
