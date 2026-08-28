"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getStaffId } from "@/lib/auth";
import { isValidCharacterId } from "@/lib/character-config";

export async function selectCharacterAction(
  characterId: string
): Promise<{ error: string } | { ok: true }> {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  // Recheck server-side — never trust a client-supplied id blindly, even
  // though the UI only ever sends ids from CHARACTER_DEFINITIONS.
  if (!isValidCharacterId(characterId)) {
    return { error: "選択できないキャラクターです" };
  }

  await prisma.staff.update({
    where: { id: staffId },
    data: { selectedCharacterId: characterId },
  });

  revalidatePath("/clock");
  revalidatePath("/my-room");
  return { ok: true };
}
