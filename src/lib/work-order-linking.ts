import { prisma } from "@/lib/prisma";
import { combineJstDateAndTime, jstMonthRange, toJstDateValue } from "@/lib/time";

// 依頼スタッフ(社内スタッフに紐付け済みのものだけ)について、シフトとの
// 紐づけを行う。
// 1. 対象月にすでに登録されている未紐付けのシフトがあれば、そのまま
//    この依頼に紐づける(今まで「未紐付けシフト」欄で手動で行っていた操作)。
// 2. 稼働日が具体的に決まっている依頼(スポット・キャッチ・クローザー・
//    コンサルティング)は、依頼の稼働日からシフト自体を新規作成する
//    (帯稼働は具体的な日付を持たないため対象外。従来通り後からシフトを
//    登録・紐付けする)。
//
// 承認された瞬間だけでなく、承認後も月の途中でシフトが追加登録されるたび
// (帯稼働は特にこのケースが多い)に取引先側の勤務状況が自動で反映される
// よう、取引先の状況確認ページを開くたびにも呼び出す(冪等: 既に紐付いた
// シフトへは影響しない)。
export async function syncWorkOrderShiftLinks(workOrderId: string) {
  const order = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: { scheduleDays: true, staffAssignments: true },
  });
  if (!order || order.status === "CANCELLED") return;

  const { start, end } = jstMonthRange(order.yearMonth);
  const mappedAssignments = order.staffAssignments.filter((a) => a.staffId && a.active);

  for (const assignment of mappedAssignments) {
    const staffId = assignment.staffId!;

    // 1. 既存の未紐付けシフトをこの依頼に紐づける。
    await prisma.shift.updateMany({
      where: { staffId, workOrderStaffId: null, startTime: { gte: start, lt: end }, cancelledAt: null },
      data: { workOrderStaffId: assignment.id },
    });

    // 2. 稼働日が確定している依頼は、まだシフトが無い日について新規作成する。
    if (order.scheduleDays.length === 0) continue;

    const linkedDateKeys = new Set(
      (
        await prisma.shift.findMany({
          where: { workOrderStaffId: assignment.id },
          select: { startTime: true },
        })
      ).map((s) => toJstDateValue(s.startTime))
    );

    const toCreate = order.scheduleDays.filter(
      (d) => !linkedDateKeys.has(toJstDateValue(d.workDate))
    );
    if (toCreate.length === 0) continue;

    await prisma.shift.createMany({
      data: toCreate.map((d) => {
        const dateKey = toJstDateValue(d.workDate);
        const startTimeStr = d.startTime || order.fixedStartTime || "10:00";
        const endTimeStr = d.endTime || order.fixedEndTime || "19:00";
        return {
          staffId,
          workType: "SPOT" as const,
          carrier: order.requestedCarrier || "",
          storeName: d.storeName || order.defaultStoreName,
          startTime: combineJstDateAndTime(dateKey, startTimeStr),
          endTime: combineJstDateAndTime(dateKey, endTimeStr),
          unitAmount: assignment.contractType === "DAILY" ? assignment.rateAmountExTax : null,
          workOrderStaffId: assignment.id,
        };
      }),
    });
  }
}
