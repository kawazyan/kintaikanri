"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function createWorkOrder(token: string, formData: FormData) {
  const access = await prisma.clientAccessToken.findUnique({ where: { token }, include: { client: true } });
  if (!access?.active || !access.client.active) throw new Error("この共有URLは現在利用できません。");
  const requestedNames = formData.getAll("requestedNames").map(v=>String(v).trim()).filter(Boolean);
  if (!requestedNames.length) throw new Error("スタッフ名を1名以上入力してください。");
  const plannedDays = Number(formData.get("plannedDays"));
  const rateAmountExTax = Number(formData.get("rateAmountExTax"));
  const data = {
    clientId: access.clientId,
    yearMonth: String(formData.get("yearMonth")), plannedDays,
    defaultStoreName: String(formData.get("defaultStoreName") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim() || null,
    clientContactName: String(formData.get("clientContactName") ?? "").trim(),
    clientContactPhone: String(formData.get("clientContactPhone") ?? "").trim() || null,
    clientContactEmail: String(formData.get("clientContactEmail") ?? "").trim() || null,
  };
  if (!data.yearMonth || !data.defaultStoreName || !data.clientContactName || !Number.isFinite(plannedDays) || plannedDays < 1 || !Number.isFinite(rateAmountExTax) || rateAmountExTax < 0) throw new Error("入力内容を確認してください。");
  const order = await prisma.workOrder.create({ data: {
    ...data,
    staffAssignments: { create: requestedNames.map(requestedName => ({
      requestedName,
      contractType: String(formData.get("contractType")) as "MONTHLY"|"DAILY",
      rateAmountExTax,
      absenceDeduction: String(formData.get("absenceDeduction")) as "YES"|"NO"|"CONSULT",
      travelExpense: String(formData.get("travelExpense")) as "INCLUDED"|"SEPARATE"|"CONSULT",
    })) },
    sites: { create: { storeName: data.defaultStoreName } },
    histories: { create: { entityType: "WORK_ORDER", changeType: "CREATE", after: {...data, requestedNames}, actorRole: "CLIENT", actorName: data.clientContactName } },
  }});
  redirect(`/client/${token}/requests/${order.id}`);
}
