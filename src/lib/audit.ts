import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// 振込・金額設定・経費・別途報酬の変更履歴(PaymentAuditLog)を残す。スタッフ詳細ページで見る。
//  TRANSFER=振込 / AMOUNT_SETTING=金額設定 / EXPENSE=経費 / COMPENSATION=別途報酬
// 履歴の記録に失敗しても、本来の操作(振込完了・承認など)は止めない(失敗はログに出すだけ)。
export type AuditCategory = "TRANSFER" | "AMOUNT_SETTING" | "EXPENSE" | "COMPENSATION";

export const AUDIT_CATEGORY_LABEL: Record<string, string> = {
  TRANSFER: "振込",
  AMOUNT_SETTING: "金額設定",
  EXPENSE: "経費",
  COMPENSATION: "別途報酬",
};

export type AuditInput = {
  staffId: string;
  category: AuditCategory;
  action: string;
  summary: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  yearMonth?: string | null;
  // ADMIN=管理者(operatorName=画面で入力された名前。空なら NULL) / STAFF=スタッフ本人(名前は自動で入る)
  actor: { type: "ADMIN"; operatorName?: string | null } | { type: "STAFF" };
};

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const staff = await prisma.staff.findUnique({ where: { id: input.staffId }, select: { name: true } });
    const staffName = staff?.name ?? "(不明)";
    await prisma.paymentAuditLog.create({
      data: {
        staffId: input.staffId,
        staffName,
        category: input.category,
        action: input.action,
        summary: input.summary,
        before: input.before,
        after: input.after,
        yearMonth: input.yearMonth ?? null,
        actorType: input.actor.type,
        actorName: input.actor.type === "STAFF" ? staffName : input.actor.operatorName?.trim() || null,
      },
    });
  } catch (e) {
    console.error("[audit] 変更履歴の記録に失敗しました", e);
  }
}

// フォームの「操作者名」欄(name="operatorName")から名前を取り出す。空欄は null。
export function operatorNameFrom(formData: FormData): string | null {
  return String(formData.get("operatorName") ?? "").trim() || null;
}

export const yenText = (n: number) => `${n.toLocaleString("ja-JP")}円`;
export const ymText = (ym: string) => `${ym.slice(0, 4)}年${Number(ym.slice(5))}月`;
export const expenseCategoryText = (c: string) => (c === "TRAVEL" ? "交通費" : c === "LODGING" ? "宿泊費" : "その他");
export const compCategoryText = (c: string) => (c === "REFERRAL" ? "リファラル報酬" : c === "INCENTIVE" ? "インセンティブ" : "その他");

export type AuditRow = {
  id: string;
  category: string;
  action: string;
  summary: string;
  yearMonth: string | null;
  actorType: string;
  actorName: string | null;
  createdAt: Date;
};

// スタッフ詳細ページ用。新しい順。履歴テーブルが読めないとき(まだ作られていない等)は null を返し、ページ全体は壊さない。
export async function loadAuditHistory(staffId: string, limit = 100): Promise<{ rows: AuditRow[]; total: number } | null> {
  try {
    const [rows, total] = await Promise.all([
      prisma.paymentAuditLog.findMany({
        where: { staffId },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: { id: true, category: true, action: true, summary: true, yearMonth: true, actorType: true, actorName: true, createdAt: true },
      }),
      prisma.paymentAuditLog.count({ where: { staffId } }),
    ]);
    return { rows, total };
  } catch (e) {
    console.error("[audit] 変更履歴を読み込めませんでした", e);
    return null;
  }
}
