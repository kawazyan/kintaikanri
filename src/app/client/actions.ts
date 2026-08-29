"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function makeClientCode() {
  return `REQ-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function submitClientRequest(formData: FormData) {
  const companyName = clean(formData.get("companyName"));
  const contactName = clean(formData.get("contactName"));
  const contactDepartment = clean(formData.get("contactDepartment"));
  const phone = clean(formData.get("phone"));
  const email = clean(formData.get("email"));
  const carrier = clean(formData.get("carrier"));
  const storeName = clean(formData.get("storeName"));
  const requestType = clean(formData.get("requestType")) as "CATCH" | "CLOSER" | "BAND";
  const schedulePattern = clean(formData.get("schedulePattern")) as "FIXED" | "VARIES";
  const contractType = clean(formData.get("contractType")) as "MONTHLY" | "DAILY";
  const rateAmountExTax = Number(formData.get("rateAmountExTax"));
  const travelExpense = clean(formData.get("travelExpense")) as "INCLUDED" | "SEPARATE" | "CONSULT";
  const absenceDeduction = clean(formData.get("absenceDeduction")) as "YES" | "NO" | "CONSULT";
  const notes = clean(formData.get("notes")) || null;
  const requestedNames = formData.getAll("requestedNames").map((v) => String(v).trim()).filter(Boolean);

  if (!companyName || !contactName || !phone || !email || !carrier || !storeName || requestedNames.length === 0) {
    throw new Error("必須項目を入力してください。");
  }
  if (!Number.isFinite(rateAmountExTax) || rateAmountExTax < 0) throw new Error("単価を確認してください。");
  if (!["CATCH", "CLOSER", "BAND"].includes(requestType)) throw new Error("依頼内容を確認してください。");
  if (!["FIXED", "VARIES"].includes(schedulePattern)) throw new Error("稼働時間の設定を確認してください。");
  if (!["MONTHLY", "DAILY"].includes(contractType)) throw new Error("単価区分を確認してください。");

  const isBand = requestType === "BAND";
  if (!isBand && contractType !== "DAILY") throw new Error("スポット依頼は日単価で登録してください。");

  const fixedStartTime = schedulePattern === "FIXED" ? clean(formData.get("fixedStartTime")) : null;
  const fixedEndTime = schedulePattern === "FIXED" ? clean(formData.get("fixedEndTime")) : null;
  if (schedulePattern === "FIXED" && (!fixedStartTime || !fixedEndTime)) throw new Error("固定の稼働時間を入力してください。");

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
    if (!/^\d{4}-\d{2}$/.test(yearMonth) || !Number.isInteger(plannedDays) || plannedDays < 1) {
      throw new Error("帯稼働は対象月と予定稼働日数を入力してください。");
    }
  } else {
    if (!spotDays.length) throw new Error("スポットの稼働日を1日以上入力してください。");
    yearMonth = spotDays[0].date.slice(0, 7);
    plannedDays = spotDays.length;
    if (spotDays.some((d) => d.date.slice(0, 7) !== yearMonth)) {
      throw new Error("1つの依頼では同じ月の稼働日を入力してください。月をまたぐ場合は依頼を分けてください。");
    }
    if (schedulePattern === "VARIES" && spotDays.some((d) => !d.start || !d.end)) {
      throw new Error("日ごとの稼働時間を入力してください。");
    }
  }

  const effectiveAbsence = isBand && contractType === "MONTHLY" ? absenceDeduction : "NO";
  const token = randomBytes(24).toString("hex");

  const existingClient = await prisma.client.findFirst({
    where: { name: companyName, email },
    orderBy: { updatedAt: "desc" },
  });

  const client = existingClient
    ? await prisma.client.update({
        where: { id: existingClient.id },
        data: { contactName, contactDepartment: contactDepartment || null, phone, email, active: true },
      })
    : await prisma.client.create({
        data: {
          name: companyName,
          clientCode: makeClientCode(),
          contactName,
          contactDepartment: contactDepartment || null,
          phone,
          email,
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
      clientContactEmail: email,
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
