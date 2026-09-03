"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentJstYearMonth } from "@/lib/time";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function makeClientCode() {
  return `REQ-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

// このフォームには入力必須の項目がない(仕様: 空欄のまま送信できる)。
// そのため以下は「入力チェックで弾く」のではなく、DBのNOT NULL制約や
// 型を満たすための最低限のフォールバック値を補うだけの処理になっている。
// 未入力の項目は管理画面側で承認前に確認・補完する想定。
export async function submitClientRequest(formData: FormData) {
  const companyName = clean(formData.get("companyName")) || "(会社名未入力)";
  const contactName = clean(formData.get("contactName")) || "(担当者名未入力)";
  const contactDepartment = clean(formData.get("contactDepartment"));
  const phone = clean(formData.get("phone"));
  const email = clean(formData.get("email"));
  const carrier = clean(formData.get("carrier"));
  const storeName = clean(formData.get("storeName")) || "未定";
  const requestTypeRaw = clean(formData.get("requestType"));
  const requestType = (["CATCH", "CLOSER", "BAND", "CONSULTING"].includes(requestTypeRaw) ? requestTypeRaw : "BAND") as
    | "CATCH"
    | "CLOSER"
    | "BAND"
    | "CONSULTING";
  const schedulePatternRaw = clean(formData.get("schedulePattern"));
  const schedulePattern = (["FIXED", "VARIES"].includes(schedulePatternRaw) ? schedulePatternRaw : "FIXED") as
    | "FIXED"
    | "VARIES";
  const isBand = requestType === "BAND";
  const contractTypeRaw = clean(formData.get("contractType"));
  const contractType = (isBand && contractTypeRaw === "MONTHLY" ? "MONTHLY" : "DAILY") as "MONTHLY" | "DAILY";
  const rateAmountExTaxRaw = Number(formData.get("rateAmountExTax"));
  const rateAmountExTax = Number.isFinite(rateAmountExTaxRaw) && rateAmountExTaxRaw >= 0 ? rateAmountExTaxRaw : 0;
  const travelExpenseRaw = clean(formData.get("travelExpense"));
  const travelExpense = (["INCLUDED", "SEPARATE", "CONSULT"].includes(travelExpenseRaw) ? travelExpenseRaw : "CONSULT") as
    | "INCLUDED"
    | "SEPARATE"
    | "CONSULT";
  const absenceDeductionRaw = clean(formData.get("absenceDeduction"));
  const absenceDeduction = (["YES", "NO", "CONSULT"].includes(absenceDeductionRaw) ? absenceDeductionRaw : "CONSULT") as
    | "YES"
    | "NO"
    | "CONSULT";
  const notes = clean(formData.get("notes")) || null;
  const requestedNames = formData.getAll("requestedNames").map((v) => String(v).trim()).filter(Boolean);

  const fixedStartTime = schedulePattern === "FIXED" ? clean(formData.get("fixedStartTime")) || null : null;
  const fixedEndTime = schedulePattern === "FIXED" ? clean(formData.get("fixedEndTime")) || null : null;

  const scheduleDates = formData.getAll("scheduleDate").map((v) => String(v).trim());
  const scheduleStarts = formData.getAll("scheduleStart").map((v) => String(v).trim());
  const scheduleEnds = formData.getAll("scheduleEnd").map((v) => String(v).trim());
  const spotDays = scheduleDates.map((date, i) => ({
    date,
    start: schedulePattern === "VARIES" ? scheduleStarts[i] || "" : fixedStartTime || "",
    end: schedulePattern === "VARIES" ? scheduleEnds[i] || "" : fixedEndTime || "",
  })).filter((d) => d.date);

  let yearMonth = clean(formData.get("yearMonth"));
  let plannedDays = Number(formData.get("plannedDays"));
  if (isBand) {
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) yearMonth = currentJstYearMonth();
    if (!Number.isInteger(plannedDays) || plannedDays < 1) plannedDays = 1;
  } else if (spotDays.length > 0) {
    // 月をまたいで入力された場合は、最初の稼働日の月を代表月として扱う
    // (依頼を分け直してもらう必要はなく、そのまま受け付ける)。
    yearMonth = spotDays[0].date.slice(0, 7);
    plannedDays = spotDays.length;
  } else {
    yearMonth = currentJstYearMonth();
    plannedDays = 0;
  }

  const effectiveAbsence = isBand && contractType === "MONTHLY" ? absenceDeduction : "NO";
  const token = randomBytes(24).toString("hex");

  const existingClient = await prisma.client.findFirst({
    where: { name: companyName, ...(email ? { email } : phone ? { phone } : {}) },
    orderBy: { updatedAt: "desc" },
  });

  const client = existingClient
    ? await prisma.client.update({
        where: { id: existingClient.id },
        data: { contactName, contactDepartment: contactDepartment || null, phone, email: email || null, active: true },
      })
    : await prisma.client.create({
        data: {
          name: companyName,
          clientCode: makeClientCode(),
          contactName,
          contactDepartment: contactDepartment || null,
          phone,
          email: email || null,
        },
      });

  await prisma.workOrder.create({
    data: {
      clientId: client.id,
      yearMonth,
      plannedDays,
      defaultStoreName: storeName,
      requestedCarrier: carrier,
      requestType,
      schedulePattern,
      fixedStartTime,
      fixedEndTime,
      notes,
      clientContactName: contactName,
      clientContactDepartment: contactDepartment || null,
      clientContactPhone: phone,
      clientContactEmail: email || null,
      staffAssignments: {
        create: requestedNames.map((requestedName) => ({
          requestedName,
          contractType,
          rateAmountExTax,
          absenceDeduction: effectiveAbsence,
          travelExpense,
        })),
      },
      sites: { create: { storeName } },
      scheduleDays: !isBand
        ? {
            create: spotDays.map((d) => ({
              workDate: new Date(`${d.date}T00:00:00+09:00`),
              startTime: d.start || null,
              endTime: d.end || null,
              storeName,
            })),
          }
        : undefined,
      accessTokens: { create: { token } },
      histories: {
        create: {
          entityType: "WORK_ORDER",
          changeType: "CLIENT_CREATE",
          after: {
            companyName,
            contactName,
            contactDepartment,
            phone,
            email,
            carrier,
            storeName,
            requestedNames,
            requestType,
            yearMonth,
            plannedDays,
            schedulePattern,
            fixedStartTime,
            fixedEndTime,
            contractType,
            rateAmountExTax,
            absenceDeduction: effectiveAbsence,
            travelExpense,
            spotDays,
          },
          actorRole: "CLIENT",
          actorName: contactName,
        },
      },
    },
  });

  redirect(`/client/request/${token}?submitted=1`);
}
