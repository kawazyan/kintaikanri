import { Resend } from "resend";

let resendClient: Resend | null = null;

function getClient() {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set");
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// 通知メールはあくまで補助機能。RESEND_API_KEY/MAIL_FROM が未設定、または送信自体が
// 失敗しても、呼び出し元(シフト登録など本来の業務処理)を絶対に失敗させない。
export async function sendMail(params: {
  to: string | string[];
  subject: string;
  text: string;
}) {
  try {
    const from = process.env.MAIL_FROM;
    if (!from) throw new Error("MAIL_FROM is not set");
    await getClient().emails.send({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
    });
  } catch (err) {
    console.error("Failed to send mail", { to: params.to, subject: params.subject, err });
  }
}
