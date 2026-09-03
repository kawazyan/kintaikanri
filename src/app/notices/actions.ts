"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStaffId } from "@/lib/auth";

// 掲示板形式のお知らせ: 全スタッフが投稿・編集・削除できる(社内向けの
// 共有掲示板という位置づけのため、投稿者本人以外でも更新可能)。

async function requireActiveStaff() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");
  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");
  return staff;
}

export async function createNotice(formData: FormData) {
  const staff = await requireActiveStaff();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await prisma.notice.create({
    data: { authorId: staff.id, authorName: staff.name, body },
  });

  revalidatePath("/notices");
}

export async function updateNotice(noticeId: string, formData: FormData) {
  const staff = await requireActiveStaff();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const existing = await prisma.notice.findUnique({ where: { id: noticeId } });
  if (!existing) return;

  await prisma.notice.update({
    where: { id: noticeId },
    data: { body, editedByName: staff.name },
  });

  revalidatePath("/notices");
}

export async function deleteNotice(noticeId: string) {
  await requireActiveStaff();
  await prisma.notice.delete({ where: { id: noticeId } }).catch(() => {});
  revalidatePath("/notices");
}
