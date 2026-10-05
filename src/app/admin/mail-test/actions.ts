"use server";

import { requireAdmin } from "@/lib/auth";
import { sendMailStrict } from "@/lib/mail";

// 送信先は固定(請求先などへ誤送信しないため)。
const TEST_TO = "t090070t@yahoo.co.jp";

export async function sendTestMail(): Promise<{ ok: true; from: string } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    await sendMailStrict({
      to: [TEST_TO],
      subject: "【テスト】勤怠システム メール送信確認",
      text: "このメールは、勤怠システムの管理画面から送ったテストメールです。\nこのメールが届いていれば、請求書メールの送信設定は正常です。",
    });
    return { ok: true, from: process.env.MAIL_FROM ?? "" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
