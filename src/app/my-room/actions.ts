"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getStaffId } from "@/lib/auth";
import { isValidCharacterId, CUSTOM_CHARACTER_ID, type AvatarState } from "@/lib/character-config";

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
  revalidatePath("/menu");
  return { ok: true };
}

const MAX_NAME_LENGTH = 20;

export async function updateStaffNameAction(
  name: string
): Promise<{ error: string } | { ok: true }> {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const trimmed = name.trim();
  if (!trimmed) return { error: "名前を入力してください" };
  if (trimmed.length > MAX_NAME_LENGTH) return { error: `名前は${MAX_NAME_LENGTH}文字以内で入力してください` };

  await prisma.staff.update({ where: { id: staffId }, data: { name: trimmed } });

  revalidatePath("/clock");
  revalidatePath("/my-room");
  revalidatePath("/menu");
  return { ok: true };
}

const CUSTOM_AVATAR_COLUMN: Record<AvatarState, "customAvatarHome" | "customAvatarWork" | "customAvatarNight"> = {
  HOME: "customAvatarHome",
  WORK: "customAvatarWork",
  NIGHT: "customAvatarNight",
};

// 1画像あたりの上限(data URL文字列の長さ)。クライアント側で縮小・圧縮済みの
// 前提だが、念のためDB肥大化を防ぐ安全弁として上限チェックする。
const MAX_DATA_URL_LENGTH = 2_000_000;

export async function saveCustomAvatarAction(
  state: AvatarState,
  dataUrl: string
): Promise<{ error: string } | { ok: true }> {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  if (!dataUrl.startsWith("data:image/")) return { error: "画像の形式が正しくありません" };
  if (dataUrl.length > MAX_DATA_URL_LENGTH) return { error: "画像サイズが大きすぎます" };

  await prisma.staff.update({
    where: { id: staffId },
    data: {
      [CUSTOM_AVATAR_COLUMN[state]]: dataUrl,
      // アップロードしたら自動的に「自分の写真」を選択状態にする。
      selectedCharacterId: CUSTOM_CHARACTER_ID,
    },
  });

  revalidatePath("/clock");
  revalidatePath("/my-room");
  revalidatePath("/menu");
  return { ok: true };
}
