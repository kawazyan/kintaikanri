"use server";
import { revalidatePath } from "next/cache";
import { getStaffId } from "@/lib/auth";
import { syncAndGetGameState } from "@/lib/game";
import { prisma } from "@/lib/prisma";

const RATES = new Map([[500,600],[1000,1100],[3000,3000],[5000,4800]]);
const BRANDS = new Set(["Amazonギフトカード","PayPayデジタルギフト","Starbucks eGift","タリーズ デジタルギフト","Apple Gift Card","Google Play ギフトコード"]);

export async function requestGiftExchange(brand: string, amountYen: number) {
  const staffId = await getStaffId();
  if (!staffId) return { ok:false, error:"本人確認が切れています" } as const;
  const coinsUsed = RATES.get(amountYen);
  if (!coinsUsed || !BRANDS.has(brand)) return { ok:false, error:"交換内容が正しくありません" } as const;
  const game = await syncAndGetGameState(staffId);
  if (game.coins < coinsUsed) return { ok:false, error:"コインが不足しています" } as const;
  await prisma.giftExchange.create({ data:{ staffId, brand, amountYen, coinsUsed } });
  revalidatePath("/coin-shop"); revalidatePath("/clock");
  return { ok:true } as const;
}
