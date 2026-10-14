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

// 送信に使うチャネルアクセストークンの種類。
// - default: 勤怠・打刻漏れ・出勤5分前などの既存通知(LINE_CHANNEL_ACCESS_TOKEN)
// - manager: シフト案内通知(毎朝の出勤予定者一覧)用(LINE_ACCESS_TOKEN_MANAGER)
// 月200通の送信上限対策として、通知の種類ごとに公式アカウントを分ける。
export type LineTokenKind = "default" | "manager";

const TOKEN_ENV_NAMES: Record<LineTokenKind, string> = {
  default: "LINE_CHANNEL_ACCESS_TOKEN",
  manager: "LINE_ACCESS_TOKEN_MANAGER",
};

// 指定した種類のトークンを返す。未設定なら undefined。
export function getLineToken(kind: LineTokenKind = "default"): string | undefined {
  return process.env[TOKEN_ENV_NAMES[kind]] || undefined;
}

// 1回の送信結果。
// - ok: 送信成功(再試行キーが受理済みの409も成功扱い)
// - no-token: 指定した種類のトークンが未設定
// - rejected: LINEから応答があり、拒否された(401/403/400/429など)
// - error: 通信エラー・タイムアウト(LINE側で届いたか不明)
type LineCallResult = "ok" | "no-token" | "rejected" | "error";

async function callLineOnce(
  endpoint: "push" | "reply",
  body: Record<string, unknown>,
  retryKey: string | undefined,
  kind: LineTokenKind,
): Promise<LineCallResult> {
  const token = getLineToken(kind);
  if (!token) return "no-token";

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
    if (response.status === 409 && retryKey) return "ok";
    if (!response.ok) {
      console.error(`LINE ${endpoint} failed (${TOKEN_ENV_NAMES[kind]}): ${response.status}`);
      return "rejected";
    }
    return "ok";
  } catch (error) {
    console.error(`LINE ${endpoint} failed (${TOKEN_ENV_NAMES[kind]})`, error);
    return "error";
  }
}

async function callLine(
  endpoint: "push" | "reply",
  body: Record<string, unknown>,
  retryKey?: string,
  kind: LineTokenKind = "default",
): Promise<boolean> {
  const first = await callLineOnce(endpoint, body, retryKey, kind);
  if (first === "ok") return true;

  // 専用トークン(manager)が未設定、またはLINEに拒否された場合だけ、既存トークンで送り直す。
  // 通信エラー・タイムアウトは届いたか不明で二重送信になり得るため、ここでは切り替えない
  // (呼び出し元が次回の実行で、同じ再試行キーで再送する)。
  // reply は対象外(replyToken は受信したアカウント専用で、別のトークンでは送れない)。
  if (endpoint === "push" && kind !== "default" && (first === "no-token" || first === "rejected")) {
    console.error(`LINE ${endpoint}: ${TOKEN_ENV_NAMES[kind]} ${first === "no-token" ? "is not set" : "was rejected"}; falling back to ${TOKEN_ENV_NAMES.default}`);
    return (await callLineOnce(endpoint, body, retryKey, "default")) === "ok";
  }
  return false;
}

// 通知はあくまで補助機能。LINE_CHANNEL_ACCESS_TOKEN未設定や送信失敗があっても、
// 呼び出し元(未出勤チェックなど本来の業務処理)を絶対に失敗させない設計。
export function sendLinePush(groupId: string, message: string, dedupeSeed: string, kind: LineTokenKind = "default") {
  return callLine(
    "push",
    { to: groupId, messages: [{ type: "text", text: message }] satisfies LineTextMessage[] },
    retryKeyFor(dedupeSeed),
    kind,
  );
}

export function sendLineReply(replyToken: string, message: string, kind: LineTokenKind = "default") {
  return callLine("reply", { replyToken, messages: [{ type: "text", text: message }] satisfies LineTextMessage[] }, undefined, kind);
}
