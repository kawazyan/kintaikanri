import { prisma } from "@/lib/prisma";
import { jstDayRange } from "@/lib/time";

type ClockType = "IN" | "OUT";

// 同じ打刻が既にあるかを調べ、重複していればエラーメッセージを返す(なければ null)。
//  - シフトに紐付く打刻: 同じシフト・同じ種類(出勤/退勤)の打刻が既にあれば重複。
//  - シフトに紐付かない打刻: 同じスタッフ・同じ日(JST)・同じ種類で、
//    シフトに紐付かない打刻が既にあれば重複。
// excludeId は「修正」のとき自分自身の記録を判定から除くために使う。
export async function findClockDuplicateError(params: {
  staffId: string;
  type: ClockType;
  shiftId: string | null | undefined;
  timestamp: Date;
  excludeId?: string;
}): Promise<string | null> {
  const { staffId, type, shiftId, timestamp, excludeId } = params;
  const label = type === "IN" ? "出勤" : "退勤";
  const notSelf = excludeId ? { id: { not: excludeId } } : {};

  if (shiftId) {
    const dup = await prisma.clockRecord.findFirst({
      where: { shiftId, type, ...notSelf },
      select: { id: true },
    });
    return dup ? `このシフトには、すでに${label}打刻があります。重複して打刻できません。` : null;
  }

  const { start, end } = jstDayRange(timestamp);
  const dup = await prisma.clockRecord.findFirst({
    where: { staffId, type, shiftId: null, timestamp: { gte: start, lt: end }, ...notSelf },
    select: { id: true },
  });
  return dup ? `この日(シフト外)には、すでに${label}打刻があります。重複して打刻できません。` : null;
}
