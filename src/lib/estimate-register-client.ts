import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { findExistingClient } from "@/lib/estimate-client";

export type RegisterResult =
  | { status: "created"; name: string }
  | { status: "linked"; name: string }
  | { status: "skipped"; reason: string };

// 見積書を送付した相手が取引先一覧になければ、自動で取引先に登録する。
// ・見積書にすでに取引先が選ばれているときは何もしない。
// ・会社名(宛名)が空のときは登録しない(名前のない取引先を作らないため)。
// ・会社名またはメールアドレスが既存の取引先と一致したら、新規には作らず、その取引先に見積書を紐づける(既存の取引先の内容は変更しない)。
// ・一致しなければ、会社名と送付先メールアドレスで新しい取引先を作り、見積書を紐づける。
// 失敗しても送付自体は成功のまま(呼び出し側で握りつぶさず、結果の文言に出す)。
export async function registerClientForSentEstimate(estimateId: string, sentTo: string[]): Promise<RegisterResult> {
  const estimate = await prisma.estimate.findUnique({
    where: { id: estimateId },
    select: { clientId: true, addressee: true },
  });
  if (!estimate) return { status: "skipped", reason: "見積書が見つかりません" };
  if (estimate.clientId) return { status: "skipped", reason: "取引先は選択済み" };
  const name = estimate.addressee.trim();
  if (!name) return { status: "skipped", reason: "会社名（宛名）が空のため、取引先には登録しませんでした" };

  const clients = await prisma.client.findMany({
    select: { id: true, name: true, email: true, invoiceEmails: true, updatedAt: true },
  });
  const found = findExistingClient(clients, name, sentTo);
  if (found) {
    await prisma.estimate.update({ where: { id: estimateId }, data: { clientId: found.id } });
    return { status: "linked", name: found.name };
  }

  const created = await prisma.client.create({
    data: {
      name,
      clientCode: `EST-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`,
      email: sentTo[0] ?? null,
      invoiceEmails: sentTo.length ? sentTo.join(", ") : null,
    },
    select: { id: true, name: true },
  });
  await prisma.estimate.update({ where: { id: estimateId }, data: { clientId: created.id } });
  return { status: "created", name: created.name };
}

export function registerNote(r: RegisterResult) {
  if (r.status === "created") return `取引先「${r.name}」を新しく登録しました`;
  if (r.status === "linked") return `既存の取引先「${r.name}」に紐づけました`;
  return r.reason === "取引先は選択済み" ? "" : r.reason;
}
