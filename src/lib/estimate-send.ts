import { prisma } from "@/lib/prisma";
import { sendMailStrict } from "@/lib/mail";
import { renderEstimatePdf } from "@/lib/estimate-render";
import { invoiceRecipients } from "@/lib/invoice-defaults";
import { registerClientForSentEstimate, registerNote } from "@/lib/estimate-register-client";
import { ESTIMATE_CONFIRM_BCC, estimatePdfFileName, resolveEstimateRecipients } from "@/lib/estimate";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 見積書メール末尾の署名(請求書メールと同じ。請求書側のファイルは変更しないため、ここに持つ)。
const MAIL_SIGNATURE = [
  ">>>>>>>>>>>>>>>>>>>>>>>>>>>>",
  "株式会社K.J",
  "〒980-0804",
  "宮城県仙台市青葉区大町2丁目3-12 Blank仙台703",
  "TEL:050-5369-0824（24h/AI対応）",
  "経理課　伊藤",
  ">>>>>>>>>>>>>>>>>>>>>>>>>>>>",
];

// 送付: 保存済み → 送付済み(送付済みの再送も可)。見積書PDFを添付して送る(管理者アドレスをCC、keiri@kjgroup.info をBCC)。
// 送信先は、見積書に手入力した送信先メールアドレスがあればそれ、なければ取引先の請求用の宛先。どちらもなければ送らない。
// 送信に成功したときだけ送付済みにする(失敗したら状態は変わらない)。
// 送信後、宛名が取引先一覧になければ自動で登録する(失敗しても送付は成功のまま)。
// 呼び出すのは画面の「送付」ボタンを押したときだけ。自動では送らない。
export async function sendSavedEstimate(id: string) {
  const estimate = await prisma.estimate.findUnique({ where: { id }, include: { client: true } });
  if (!estimate) throw new Error("見積書が見つかりません。");

  const to = resolveEstimateRecipients(estimate.recipientEmails, estimate.client ? invoiceRecipients(estimate.client) : []);
  if (!to.length) {
    throw new Error("送信先のメールアドレスがありません。見積書の「送信先メールアドレス」を入力するか、取引先を選んで（取引先窓口でメールアドレスを登録して）から、もう一度送付してください。");
  }
  const badTo = to.find((x) => !EMAIL_RE.test(x));
  if (badTo) throw new Error(`送信先メールアドレスの形式が正しくありません: ${badTo}`);

  const admins = await prisma.adminEmail.findMany({ select: { email: true } });
  const cc = [...new Set(admins.map((a) => a.email.trim()).filter((x) => EMAIL_RE.test(x) && !to.includes(x)))];

  const lower = new Set([...to, ...cc].map((x) => x.toLowerCase()));
  const bcc = lower.has(ESTIMATE_CONFIRM_BCC) ? [] : [ESTIMATE_CONFIRM_BCC];

  const pdf = await renderEstimatePdf(id);
  if (!pdf) throw new Error("PDFの作成に失敗しました。");

  // 宛名・件名が空でも送れるようにする(空のときは、その行を省く)。
  const subject = `【御見積書】${estimate.subject ? `${estimate.subject}` : estimate.estimateNumber}（株式会社K.J）`;
  const text = [
    ...(estimate.addressee ? [`${estimate.addressee} 御中`, ""] : []),
    "いつも大変お世話になっております。",
    "株式会社K.Jです。",
    "",
    estimate.subject ? `「${estimate.subject}」の御見積書をお送りいたします。` : "御見積書をお送りいたします。",
    "添付ファイルをご確認くださいますようお願い申し上げます。",
    "",
    `お見積金額（税込）：¥${estimate.totalInclTax.toLocaleString("ja-JP")}`,
    `見積番号：${estimate.estimateNumber}`,
    "",
    "ご不明な点がございましたら、お気軽にお知らせください。",
    "何卒よろしくお願い申し上げます。",
    "",
    ...MAIL_SIGNATURE,
  ].join("\n");

  await sendMailStrict({
    to,
    cc,
    bcc,
    subject,
    text,
    attachments: [{ filename: estimatePdfFileName(estimate.estimateNumber), content: pdf.buffer }],
  });

  await prisma.estimate.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date(), sentTo: [...to, ...cc, ...bcc].join(", ") },
  });

  let registered = "";
  try {
    registered = registerNote(await registerClientForSentEstimate(id, to));
  } catch (e) {
    console.error("Failed to register client for estimate", { id, e });
    registered = "送付は完了しましたが、取引先の自動登録に失敗しました（手動で登録してください）";
  }
  return { to, cc, bcc, registered };
}
