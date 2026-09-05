"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function readFaqFields(formData: FormData) {
  const audienceRaw = String(formData.get("audience") ?? "STAFF");
  const audience = (audienceRaw === "CLIENT" ? "CLIENT" : "STAFF") as "STAFF" | "CLIENT";
  const category = String(formData.get("category") ?? "").trim();
  const question = String(formData.get("question") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim();
  const keywords = String(formData.get("keywords") ?? "").trim() || null;
  return { audience, category, question, answer, keywords };
}

export async function createBotFaq(formData: FormData) {
  await requireAdmin();
  const { audience, category, question, answer, keywords } = readFaqFields(formData);
  if (!category || !question || !answer) return;

  const last = await prisma.botFaq.findFirst({
    where: { audience },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = (last?.sortOrder ?? 0) + 10;

  await prisma.botFaq.create({
    data: { audience, category, question, answer, keywords, sortOrder },
  });

  revalidatePath("/admin/bot/faqs");
  redirect("/admin/bot/faqs");
}

export async function updateBotFaq(id: string, formData: FormData) {
  await requireAdmin();
  const { audience, category, question, answer, keywords } = readFaqFields(formData);
  if (!category || !question || !answer) return;

  await prisma.botFaq.update({
    where: { id },
    data: { audience, category, question, answer, keywords },
  });

  revalidatePath("/admin/bot/faqs");
  redirect("/admin/bot/faqs");
}

export async function deleteBotFaq(id: string) {
  await requireAdmin();
  await prisma.botFaq.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/bot/faqs");
}

export async function setBotFaqVisible(id: string, visible: boolean) {
  await requireAdmin();
  await prisma.botFaq.update({ where: { id }, data: { visible } });
  revalidatePath("/admin/bot/faqs");
}

// 表示順の入れ替え。同じ audience 内で直前/直後の項目と sortOrder を
// 入れ替えるだけのシンプルな方式(ドラッグ&ドロップ不要でスマホでも
// 操作しやすい上下ボタンのため)。
export async function moveBotFaq(id: string, direction: "up" | "down") {
  await requireAdmin();
  const current = await prisma.botFaq.findUnique({ where: { id } });
  if (!current) return;

  const neighbor = await prisma.botFaq.findFirst({
    where: {
      audience: current.audience,
      sortOrder: direction === "up" ? { lt: current.sortOrder } : { gt: current.sortOrder },
    },
    orderBy: { sortOrder: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return;

  await prisma.$transaction([
    prisma.botFaq.update({ where: { id: current.id }, data: { sortOrder: neighbor.sortOrder } }),
    prisma.botFaq.update({ where: { id: neighbor.id }, data: { sortOrder: current.sortOrder } }),
  ]);

  revalidatePath("/admin/bot/faqs");
}
