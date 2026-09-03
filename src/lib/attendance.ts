import { prisma } from "@/lib/prisma";
import { jstDayRange, toJstTimeValue } from "@/lib/time";

export type AttendingMember = {
  id: string;
  name: string;
  storeName: string | null;
  inTime: string | null;
  inTimestamp: number;
};

// 本日、在籍中のスタッフのうち「最後の打刻がIN」のスタッフ(=現在出勤中)を
// 出勤時刻の早い順に返す。/town の出勤メンバー一覧と、ホーム画面の
// 「現在〇〇人出勤中」表示の両方で使う共通ロジック。
export async function getAttendingStaff(at: Date = new Date()): Promise<AttendingMember[]> {
  const { start, end } = jstDayRange(at);
  const records = await prisma.clockRecord.findMany({
    where: { timestamp: { gte: start, lt: end }, staff: { status: "ACTIVE" } },
    include: { staff: true },
    orderBy: { timestamp: "asc" },
  });

  const byStaff = new Map<string, typeof records>();
  for (const record of records) {
    byStaff.set(record.staffId, [...(byStaff.get(record.staffId) ?? []), record]);
  }

  return [...byStaff.values()]
    .filter((items) => items.at(-1)?.type === "IN")
    .map((items) => {
      const latest = items.at(-1)!;
      const firstIn = items.find((record) => record.type === "IN");
      return {
        id: latest.staff.id,
        name: latest.staff.name,
        storeName: latest.storeName,
        inTime: firstIn ? toJstTimeValue(firstIn.timestamp) : null,
        inTimestamp: firstIn?.timestamp.getTime() ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => a.inTimestamp - b.inTimestamp || a.name.localeCompare(b.name, "ja"));
}
