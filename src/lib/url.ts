import { headers } from "next/headers";

// 取引先へ案内するURL等を組み立てるための、現在アクセスされているオリジンの
// 絶対URLを返す。NEXT_PUBLIC_APP_URL のような環境変数の設定漏れ(本番の
// Vercel側で設定し忘れる等)に依存せず、常に今アクセスされているホストから
// 正しいURLを組み立てられるようにするため、リクエストヘッダーから動的に
// 取得する(ローカル開発でも本番でも自動的に正しいオリジンになる)。
export async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}
