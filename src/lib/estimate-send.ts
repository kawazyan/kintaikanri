import { prisma } from "@/lib/prisma";
import { sendMailStrict } from "@/lib/mail";
import { renderEstimatePdf } from "@/lib/estimate-render";
import { invoiceRecipients } from "@/lib/invoice-defaults";
import { estimatePdfFileName } from "@/lib/estimate";

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

// 送付: 保存済み → 送付済み。取引先の請求用メール宛に、見積書PDFを添付して送る(管理者アドレスをCC)。
// 送信に成功したときだけ送付済みにする(失敗したら保存済みのまま。何も変わらない)。
// 呼び出すのは画面の「送付」ボタンを押したときだけ。自動では送らない。
export async function sendSavedEstimate(id: string) {
  const estimate = await prisma.estimate.findUnique({ where: { id }, include: { client: true } });
  if (!estimate) throw new Error("見積書が見つかりません。");
  if (estimate.status !== "SAVED") throw new Error("保存済み（未送付）の見積書だけ送付できます。");

  const to = invoiceRecipients(estimate.client);
  if (!to.length) {
    throw new Error(`取引先「${estimate.client.name}」にメールアドレスが登録されていません。取引先窓口の画面で登録してから、もう一度送付してください。`);
  }
  const badTo = to.find((x) => !EMAIL_RE.test(x));
  if (badTo) throw new Error(`取引先のメールアドレスの形式が正しくありません: ${badTo}`);

  const admins = await prisma.adminEmail.findMany({ select: { email: true } });
  const cc = [...new Set(admins.map((a) => a.email.trim()).filter((x) => EMAIL_RE.test(x) && !to.includes(x)))];

  const pdf = await renderEstimatePdf(id);
  if (!pdf) throw new Error("PDFの作成に失敗しました。");

  const subject = `【御見積書】${estimate.subject}（株式会社K.J）`;
  const text = [
    `${estimate.addressee} 御中`,
    "",
    "いつも大変お世話になっております。",
    "株式会社K.Jです。",
    "",
    `「${estimate.subject}」の御見積書をお送りいたします。`,
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
    subject,
    text,
    attachments: [{ filename: estimatePdfFileName(estimate.estimateNumber), content: pdf.buffer }],
  });

  await prisma.estimate.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date(), sentTo: [...to, ...cc].join(", ") },
  });
  return { to, cc };
}
