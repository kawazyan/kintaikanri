import { prisma } from "@/lib/prisma";
import { sendMailStrict } from "@/lib/mail";
import { renderInvoicePdf, renderStatementPdf } from "@/lib/invoice-render";
import { invoiceRecipients } from "@/lib/invoice-defaults";
import { planManualContracts } from "@/lib/manual-contracts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 請求書メール末尾の署名。
const MAIL_SIGNATURE = [
  ">>>>>>>>>>>>>>>>>>>>>>>>>>>>",
  "株式会社K.J",
  "〒980-0804",
  "宮城県仙台市青葉区大町2丁目3-12 Blank仙台703",
  "TEL:050-5369-0824（24h/AI対応）",
  "経理課　伊藤",
  ">>>>>>>>>>>>>>>>>>>>>>>>>>>>",
];

// 添付PDFのファイル名: 「請求書_2026年9月分_株式会社K.J.pdf」。ファイル名に使えない文字は _ にする。
export function pdfFileName(kind: "請求書" | "請求内訳書", y: number, m: number) {
  return `${kind}_${y}年${m}月分_株式会社K.J.pdf`.replace(/[\\/:*?"<>|]/g, "_");
}

// 承認: 下書き → 承認済み。メールはまだ送らない(承認済みの一覧から「送信」する)。
// 請求書で「スタッフを追加」したスタッフがいれば、承認と同時に取引先の契約へ自動登録する(manual-contracts.ts)。
export async function approveDraftInvoice(id: string, approverName: string) {
  const name = approverName.trim();
  if (!name) throw new Error("承認者名を入力してください。");
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { status: true, statement: true, clientId: true, yearMonth: true } });
  if (!invoice) throw new Error("請求書が見つかりません。");
  if (invoice.status !== "DRAFT") throw new Error("下書きの請求だけ承認できます。");
  if (!invoice.statement) throw new Error("稼働明細書のデータがありません。請求下書きを作り直してください。");
  const plan = await planManualContracts(invoice);
  await prisma.$transaction([
    ...plan.ops,
    prisma.invoice.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date(), approvedBy: name } }),
  ]);
  return { registered: plan.registered, notes: plan.notes };
}

// 送信: 承認済み → 送付済み。請求書PDFと稼働明細書PDFを取引先の登録メールへ送信(管理者アドレスをCC)する。
// 送信に成功したときだけ送付済みにする(失敗したら承認済みのまま。何も変わらない)。
export async function sendApprovedInvoice(id: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!invoice) throw new Error("請求書が見つかりません。");
  if (invoice.status !== "APPROVED") throw new Error("承認済みの請求だけ送信できます。");
  if (!invoice.statement) {
    throw new Error("稼働明細書のデータがありません。請求下書きを作り直してください。");
  }

  const to = invoiceRecipients(invoice.client);
  if (!to.length) {
    throw new Error(`取引先「${invoice.client.name}」にメールアドレスが登録されていません。取引先窓口の画面で登録してから、もう一度送信してください。`);
  }
  const badTo = to.find((x) => !EMAIL_RE.test(x));
  if (badTo) throw new Error(`取引先のメールアドレスの形式が正しくありません: ${badTo}`);

  const admins = await prisma.adminEmail.findMany({ select: { email: true } });
  const cc = [...new Set(admins.map((a) => a.email.trim()).filter((x) => EMAIL_RE.test(x) && !to.includes(x)))];

  const issuedAt = new Date(); // 送付した実際の日時(記録用)。請求書の発行日は稼働月の月末日。
  const inv = await renderInvoicePdf(id);
  const stmt = await renderStatementPdf(id);
  if (!inv || !stmt) throw new Error("PDFの作成に失敗しました。");

  const [y, m] = invoice.yearMonth.split("-").map(Number);
  const addressee = inv.data.addressee;
  const subject = `【請求書】${y}年${m}月分のご請求（株式会社K.J）`;
  const text = [
    `${addressee} 御中`,
    "",
    "いつも大変お世話になっております。",
    "株式会社K.Jです。",
    "",
    `${y}年${m}月の請求書と請求内訳書をお送りいたします。`,
    "添付ファイルをご確認くださいますようお願い申し上げます。",
    "",
    `ご請求金額（税込）：¥${invoice.totalInclTax.toLocaleString("ja-JP")}`,
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
    attachments: [
      { filename: pdfFileName("請求書", y, m), content: inv.buffer },
      { filename: pdfFileName("請求内訳書", y, m), content: stmt.buffer },
    ],
  });

  await prisma.invoice.update({
    where: { id },
    data: {
      status: invoice.revision > 1 ? "REISSUED" : "FINALIZED",
      finalizedAt: issuedAt,
      finalizedBy: invoice.approvedBy,
      sentAt: new Date(),
      sentTo: [...to, ...cc].join(", "),
    },
  });

  return { to, cc };
}
