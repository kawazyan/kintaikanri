import { createHash } from "node:crypto";

type LineTextMessage = { type: "text"; text: string };

// LINEの再試行キー(X-Line-Retry-Key)。同じ通知を二重送信しないよう、
// 対象(シフトIDなど)から決定的に導出する。
function retryKeyFor(seed: string): string {
  const bytes = createHash("sha256").update(`line-alert:${seed}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function callLine(endpoint: "push" | "reply", body: Record<string, unknown>, retryKey?: string): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return false;

  try {
    const response = await fetch(`https://api.line.me/v2/bot/message/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(retryKey ? { "X-Line-Retry-Key": retryKey } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    // LINEは同じ再試行キーを既に受理済みの場合409を返す(=成功扱いでよい)。
    if (response.status === 409 && retryKey) return true;
    if (!response.ok) console.error(`LINE ${endpoint} failed: ${response.status}`);
    return response.ok;
  } catch (error) {
    console.error(`LINE ${endpoint} failed`, error);
    return false;
  }
}

// 通知はあくまで補助機能。LINE_CHANNEL_ACCESS_TOKEN未設定や送信失敗があっても、
// 呼び出し元(未出勤チェックなど本来の業務処理)を絶対に失敗させない設計。
export function sendLinePush(groupId: string, message: string, dedupeSeed: string) {
  return callLine("push", { to: groupId, messages: [{ type: "text", text: message }] satisfies LineTextMessage[] }, retryKeyFor(dedupeSeed));
}

export function sendLineReply(replyToken: string, message: string) {
  return callLine("reply", { replyToken, messages: [{ type: "text", text: message }] satisfies LineTextMessage[] });
}
