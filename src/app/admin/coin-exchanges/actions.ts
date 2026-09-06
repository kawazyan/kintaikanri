"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export async function updateGiftExchange(id:string,status:"FULFILLED"|"REJECTED"){
 await requireAdmin();
 await prisma.giftExchange.update({where:{id},data:status==="FULFILLED"?{status,fulfilledAt:new Date(),rejectedAt:null}:{status,rejectedAt:new Date(),fulfilledAt:null}});
 revalidatePath("/admin/coin-exchanges"); revalidatePath("/coin-shop"); revalidatePath("/clock");
}
