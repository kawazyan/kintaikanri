import { createHmac, timingSafeEqual } from "node:crypto";

// Webhookを受け取るLINE公式アカウントの種類。
// - default: 勤怠用(AI管理者)。環境変数 LINE_CHANNEL_SECRET
// - manager: 毎朝の一覧用(AIマネージャー)。環境変数 LINE_CHANNEL_SECRET_MANAGER
// 1つのグループには公式アカウントを1つしか入れられないため、アカウントごとに別のグループへ連携する。
export type LineWebhookChannel = "default" | "manager";

export const WEBHOOK_SECRET_ENV: Record<LineWebhookChannel, string> = {
  default: "LINE_CHANNEL_SECRET",
  manager: "LINE_CHANNEL_SECRET_MANAGER",
};

export function validSignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  const received = Buffer.from(signature, "base64");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

// 署名がどの公式アカウントのものかを判定する。
// - configured: 秘密文字列が1つでも設定されているか(未設定ならWebhookは受け付けない)
// - channel: 署名が一致したアカウント。どれにも一致しなければ null
export function identifyChannel(
  body: string,
  signature: string | null,
  env: Record<string, string | undefined> = process.env,
): { configured: boolean; channel: LineWebhookChannel | null } {
  let configured = false;
  for (const channel of ["default", "manager"] as const) {
    const secret = env[WEBHOOK_SECRET_ENV[channel]];
    if (!secret) continue;
    configured = true;
    if (validSignature(body, signature, secret)) return { configured, channel };
  }
  return { configured, channel: null };
}
