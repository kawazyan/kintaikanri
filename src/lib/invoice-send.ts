import { prisma } from "@/lib/prisma";
import { sendMailStrict } from "@/lib/mail";
import { renderInvoicePdf, renderStatementPdf } from "@/lib/invoice-render";
import { nextMonthEnd } from "@/lib/invoice-defaults";
import { toJstDateValue } from "@/lib/time";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function splitEmails(raw: string | null | undefined) {
  return (raw ?? "")
    .split(/[,;、\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// 承認: 請求書PDFと稼働明細書PDFを作り、取引先の登録メールへ送信(管理者アドレスをCC)する。
// 送信に成功したときだけ請求を確定する(失敗したら下書きのまま。何も変わらない)。
export async function approveAndSendInvoice(id: string, approverName: string) {
  const name = approverName.trim();
  if (!name) throw new Error("承認者名を入力してください。");

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!invoice) throw new Error("請求書が見つかりません。");
  if (invoice.status !== "DRAFT") throw new Error("この請求はすでに確定・送信済みです。");
  if (!invoice.statement) {
    throw new Error("稼働明細書のデータがありません。請求下書きを作り直してください。");
  }

  const to = splitEmails(invoice.client.email);
  if (!to.length) {
    throw new Error(`取引先「${invoice.client.name}」にメールアドレスが登録されていません。取引先窓口の画面で登録してから、もう一度承認してください。`);
  }
  const badTo = to.find((x) => !EMAIL_RE.test(x));
  if (badTo) throw new Error(`取引先のメールアドレスの形式が正しくありません: ${badTo}`);

  const admins = await prisma.adminEmail.findMany({ select: { email: true } });
  const cc = [...new Set(admins.map((a) => a.email.trim()).filter((x) => EMAIL_RE.test(x) && !to.includes(x)))];

  const issuedAt = new Date();
  const inv = await renderInvoicePdf(id, issuedAt);
  const stmt = await renderStatementPdf(id);
  if (!inv || !stmt) throw new Error("PDFの作成に失敗しました。");

  const [y, m] = invoice.yearMonth.split("-").map(Number);
  const addressee = inv.data.addressee;
  const due = nextMonthEnd(toJstDateValue(issuedAt)).replaceAll("-", "/");
  const subject = `【請求書】${addressee} ${y}年${m}月稼働分`;
  const text = [
    `${addressee} 御中`,
    "",
    "いつも大変お世話になっております。",
    "株式会社K.Jです。",
    "",
    `${y}年${m}月稼働分の請求書と稼働明細書をお送りいたします。`,
    "添付ファイルをご確認くださいますようお願い申し上げます。",
    "",
    `ご請求金額（税込）：¥${invoice.totalInclTax.toLocaleString("ja-JP")}`,
    `お支払い期限：${due}`,
    "",
    "ご不明な点がございましたら、お気軽にお知らせください。",
    "何卒よろしくお願い申し上げます。",
    "",
    "株式会社K.J",
  ].join("\n");

  await sendMailStrict({
    to,
    cc,
    subject,
    text,
    attachments: [
      { filename: `請求書_${invoice.yearMonth}_${invoice.invoiceNumber}.pdf`, content: inv.buffer },
      { filename: `稼働明細書_${invoice.yearMonth}_${invoice.invoiceNumber}.pdf`, content: stmt.buffer },
    ],
  });

  await prisma.invoice.update({
    where: { id },
    data: {
      status: invoice.revision > 1 ? "REISSUED" : "FINALIZED",
      finalizedAt: issuedAt,
      finalizedBy: name,
      sentAt: new Date(),
      sentTo: [...to, ...cc].join(", "),
    },
  });

  return { to, cc };
}
