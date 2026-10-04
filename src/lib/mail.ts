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

// 請求書など「届いたことが重要」なメール用。sendMail と違い、失敗したら例外を投げる
// (呼び出し側が送信失敗を画面に出し、確定処理に進まないようにするため)。
export async function sendMailStrict(params: {
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  attachments?: { filename: string; content: Buffer }[];
}) {
  const from = process.env.MAIL_FROM;
  if (!from) throw new Error("MAIL_FROM が設定されていないため、メールを送信できません。");
  const { error } = await getClient().emails.send({
    from,
    to: params.to,
    cc: params.cc && params.cc.length ? params.cc : undefined,
    subject: params.subject,
    text: params.text,
    // Buffer をそのまま渡すとJSON化の際にオブジェクトになってしまうため、base64文字列で渡す。
    attachments: params.attachments?.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
  });
  if (error) throw new Error(`メール送信に失敗しました: ${error.message}`);
}
