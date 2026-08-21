import { prisma } from "@/lib/prisma";
import {
  jstDayRange,
  jstMonthRange,
  toJstDateValue,
  currentJstYearMonth,
  combineJstDateAndTime,
  listDaysInJstYearMonth,
} from "@/lib/time";
import {
  GAME_FEATURE_START_DATE,
  XP_PER_SHIFT,
  COINS_PER_SHIFT,
  LEVEL_XP_BASE,
  STAMP_MONTHLY_TARGET_DAYS,
  STAMP_MONTHLY_BONUS_COINS,
  TITLE_DEFINITIONS,
} from "@/lib/game-config";
import type { GameTitleCode } from "@prisma/client";

// ゲーミフィケーション機能全体の設計方針:
// ストリーク・XP・コイン・スタンプ進捗は「打刻+シフト」から毎回再計算する
// (DBに確定値として保存しない)。シフトの後日修正・退勤忘れの補正があっても
// 自動的に整合性が取れる。称号・皆勤賞だけは「その瞬間に達成した」という
// 事実の記録であり再計算では復元できないため、条件を満たした瞬間にDB保存する
// (一度獲得したら没収しない)。詳細は gamification-spec.md 参照。

type DayStatus = "OFF" | "COMPLETED" | "ABSENT" | "PENDING";

const TITLE_LABELS: Record<GameTitleCode, string> = Object.fromEntries(
  TITLE_DEFINITIONS.map((t) => [t.code, t.label])
) as Record<GameTitleCode, string>;

export type GameState = {
  streak: number;
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  coins: number;
  titles: { code: GameTitleCode; label: string; achievedAt: Date }[];
  lockedTitles: { code: GameTitleCode; label: string; minStreak: number }[];
  perfectAttendanceThisMonth: boolean;
  stamp: {
    yearMonth: string;
    targetDays: number;
    completedDays: number;
    bonusCoins: number;
    bonusAwarded: boolean;
    cells: { index: number; state: "stamped" | "today" | "empty" }[];
  };
};

// 1日にシフトが複数ある場合でも「1勤務達成」は日単位の二値判定にする(仕様:
// 1日1勤務まで。同日中の複数回出退勤でも付与は1日1回分のみ)。
function classifyDay(
  shiftsThatDay: { endTime: Date; hasIn: boolean; hasOut: boolean }[],
  now: Date
): DayStatus {
  if (shiftsThatDay.length === 0) return "OFF"; // 公休
  if (shiftsThatDay.some((s) => s.hasIn && s.hasOut)) return "COMPLETED";
  if (shiftsThatDay.some((s) => s.hasIn && !s.hasOut)) return "PENDING"; // 退勤打刻忘れ
  if (shiftsThatDay.some((s) => s.endTime > now)) return "PENDING"; // まだ勤務予定終了前
  return "ABSENT"; // 予定終了時刻を過ぎても出勤打刻なし
}

function enumerateDateKeys(fromDateKey: string, toDateKey: string): string[] {
  const [fy, fm, fd] = fromDateKey.split("-").map(Number);
  const [ty, tm, td] = toDateKey.split("-").map(Number);
  const start = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  const pad = (n: number) => String(n).padStart(2, "0");
  const keys: string[] = [];
  for (let t = start; t <= end; t += 24 * 60 * 60 * 1000) {
    const d = new Date(t);
    keys.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
  }
  return keys;
}

function previousYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// GAME_FEATURE_START_DATE 〜 今日までの全日について、日単位のステータスを
// 1回のクエリで算出する。以降の集計(ストリーク・XP・コイン・スタンプ・皆勤賞)は
// すべてこのマップから導出する。
async function loadDailyStatusMap(staffId: string, now: Date): Promise<Map<string, DayStatus>> {
  const todayKey = toJstDateValue(now);
  if (GAME_FEATURE_START_DATE > todayKey) return new Map();

  const rangeStart = combineJstDateAndTime(GAME_FEATURE_START_DATE, "00:00");
  const { end: rangeEnd } = jstDayRange(now);

  const shifts = await prisma.shift.findMany({
    where: { staffId, startTime: { gte: rangeStart, lt: rangeEnd } },
    select: { startTime: true, endTime: true, clockRecords: { select: { type: true } } },
  });

  const byDate = new Map<string, { endTime: Date; hasIn: boolean; hasOut: boolean }[]>();
  for (const s of shifts) {
    const key = toJstDateValue(s.startTime);
    const entry = {
      endTime: s.endTime,
      hasIn: s.clockRecords.some((r) => r.type === "IN"),
      hasOut: s.clockRecords.some((r) => r.type === "OUT"),
    };
    const list = byDate.get(key);
    if (list) list.push(entry);
    else byDate.set(key, [entry]);
  }

  const statuses = new Map<string, DayStatus>();
  for (const dateKey of enumerateDateKeys(GAME_FEATURE_START_DATE, todayKey)) {
    statuses.set(dateKey, classifyDay(byDate.get(dateKey) ?? [], now));
  }
  return statuses;
}

// 今月の連続勤務ストリーク。未完了(退勤打刻忘れ)の日に達したら、以降の日は
// 補正されるまでカウントを一時停止する(欠勤とは判定しない)。欠勤の日は
// 0にリセットして継続。公休の日はスキップして継続扱い。
function computeCurrentMonthStreak(
  statuses: Map<string, DayStatus>,
  yearMonth: string,
  todayKey: string
): number {
  let streak = 0;
  let frozen = false;
  for (const day of listDaysInJstYearMonth(yearMonth)) {
    if (day.dateKey > todayKey) break;
    if (day.dateKey < GAME_FEATURE_START_DATE) continue;
    if (frozen) continue;
    const status = statuses.get(day.dateKey) ?? "OFF";
    if (status === "OFF") continue;
    if (status === "COMPLETED") streak += 1;
    else if (status === "ABSENT") streak = 0;
    else if (status === "PENDING") frozen = true;
  }
  return streak;
}

function countCompletedDays(
  statuses: Map<string, DayStatus>,
  filter?: (dateKey: string) => boolean
): number {
  let count = 0;
  for (const [dateKey, status] of statuses) {
    if (status === "COMPLETED" && (!filter || filter(dateKey))) count += 1;
  }
  return count;
}

function completedCountsByMonth(statuses: Map<string, DayStatus>): Map<string, number> {
  const map = new Map<string, number>();
  for (const [dateKey, status] of statuses) {
    if (status !== "COMPLETED") continue;
    const ym = dateKey.slice(0, 7);
    map.set(ym, (map.get(ym) ?? 0) + 1);
  }
  return map;
}

function levelFromXp(xp: number): { level: number; xpIntoLevel: number; xpForNextLevel: number } {
  let level = 1;
  let remaining = xp;
  let needed = LEVEL_XP_BASE * level;
  while (remaining >= needed) {
    remaining -= needed;
    level += 1;
    needed = LEVEL_XP_BASE * level;
  }
  return { level, xpIntoLevel: remaining, xpForNextLevel: needed };
}

// 現在ストリークが新たに閾値へ到達していれば称号をDB保存する。称号は永久保持
// のため、一度保存されたコードは再評価しても消えない(UNIQUE制約で重複防止)。
async function syncTitles(staffId: string, currentStreak: number) {
  const existing = await prisma.gameTitle.findMany({ where: { staffId } });
  const existingCodes = new Set(existing.map((t) => t.titleCode));
  const toCreate = TITLE_DEFINITIONS.filter(
    (t) => currentStreak >= t.minStreak && !existingCodes.has(t.code)
  );
  if (toCreate.length > 0) {
    await prisma.gameTitle.createMany({
      data: toCreate.map((t) => ({ staffId, titleCode: t.code })),
      skipDuplicates: true,
    });
    return prisma.gameTitle.findMany({ where: { staffId }, orderBy: { achievedAt: "asc" } });
  }
  return existing;
}

// 指定した月について、対象開始日以降に登録された全シフトが「1勤務達成」して
// いるか判定する。まだ来ていない予定日が残っている場合は判定を保留(false)する。
async function isMonthFullyPunched(
  staffId: string,
  yearMonth: string,
  statuses: Map<string, DayStatus>,
  todayKey: string
): Promise<boolean> {
  const { start, end } = jstMonthRange(yearMonth);
  const gameStart = combineJstDateAndTime(GAME_FEATURE_START_DATE, "00:00");
  const effectiveStart = gameStart > start ? gameStart : start;
  if (effectiveStart >= end) return false;

  const shifts = await prisma.shift.findMany({
    where: { staffId, startTime: { gte: effectiveStart, lt: end } },
    select: { startTime: true },
  });
  if (shifts.length === 0) return false;

  const dateKeys = new Set(shifts.map((s) => toJstDateValue(s.startTime)));
  for (const dateKey of dateKeys) {
    if (dateKey > todayKey) return false; // 未確定の予定日が残っている
    if (statuses.get(dateKey) !== "COMPLETED") return false;
  }
  return true;
}

async function syncPerfectAttendance(
  staffId: string,
  yearMonth: string,
  statuses: Map<string, DayStatus>,
  todayKey: string
): Promise<void> {
  const existing = await prisma.perfectAttendance.findUnique({
    where: { staffId_yearMonth: { staffId, yearMonth } },
  });
  if (existing) return;
  if (await isMonthFullyPunched(staffId, yearMonth, statuses, todayKey)) {
    await prisma.perfectAttendance.upsert({
      where: { staffId_yearMonth: { staffId, yearMonth } },
      update: {},
      create: { staffId, yearMonth },
    });
  }
}

// ホーム画面表示のたびに呼び出す唯一のエントリーポイント。ストリーク・XP・
// コイン・スタンプ進捗を再計算しつつ、新たに条件を満たした称号・皆勤賞があれば
// このタイミングでDB保存する(退勤打刻忘れの後日補正でも、次に画面を開いた
// ときに自動的に遡って発火する)。
export async function syncAndGetGameState(staffId: string, now: Date = new Date()): Promise<GameState> {
  const todayKey = toJstDateValue(now);
  const yearMonth = currentJstYearMonth(now);

  const statuses = await loadDailyStatusMap(staffId, now);
  const streak = computeCurrentMonthStreak(statuses, yearMonth, todayKey);
  const monthCompletedDays = countCompletedDays(statuses, (k) => k.startsWith(yearMonth));
  const totalCompletedDays = countCompletedDays(statuses);

  let careerBonusCoins = 0;
  for (const count of completedCountsByMonth(statuses).values()) {
    if (count >= STAMP_MONTHLY_TARGET_DAYS) careerBonusCoins += STAMP_MONTHLY_BONUS_COINS;
  }

  const xp = totalCompletedDays * XP_PER_SHIFT;
  const coins = totalCompletedDays * COINS_PER_SHIFT + careerBonusCoins;
  const { level, xpIntoLevel, xpForNextLevel } = levelFromXp(xp);

  const [titles] = await Promise.all([
    syncTitles(staffId, streak),
    syncPerfectAttendance(staffId, yearMonth, statuses, todayKey),
    syncPerfectAttendance(staffId, previousYearMonth(yearMonth), statuses, todayKey),
  ]);

  const perfectAttendanceThisMonth = await prisma.perfectAttendance.findUnique({
    where: { staffId_yearMonth: { staffId, yearMonth } },
  });

  const stampBonusAwarded = monthCompletedDays >= STAMP_MONTHLY_TARGET_DAYS;
  const cells = Array.from({ length: STAMP_MONTHLY_TARGET_DAYS }, (_, i) => ({
    index: i,
    state: (i < monthCompletedDays
      ? "stamped"
      : i === monthCompletedDays
        ? "today"
        : "empty") as "stamped" | "today" | "empty",
  }));

  return {
    streak,
    level,
    xp,
    xpIntoLevel,
    xpForNextLevel,
    coins,
    titles: titles.map((t) => ({
      code: t.titleCode,
      label: TITLE_LABELS[t.titleCode],
      achievedAt: t.achievedAt,
    })),
    lockedTitles: TITLE_DEFINITIONS.filter(
      (def) => !titles.some((t) => t.titleCode === def.code)
    ),
    perfectAttendanceThisMonth: !!perfectAttendanceThisMonth,
    stamp: {
      yearMonth,
      targetDays: STAMP_MONTHLY_TARGET_DAYS,
      completedDays: monthCompletedDays,
      bonusCoins: STAMP_MONTHLY_BONUS_COINS,
      bonusAwarded: stampBonusAwarded,
      cells,
    },
  };
}

// 全称号(獲得済み/未獲得を問わず)の一覧。称号・バッジ一覧画面用。
export async function getAllTitlesForStaff(
  staffId: string
): Promise<{ code: GameTitleCode; label: string; minStreak: number; achievedAt: Date | null }[]> {
  const achieved = await prisma.gameTitle.findMany({ where: { staffId } });
  const achievedMap = new Map(achieved.map((t) => [t.titleCode, t.achievedAt]));
  return TITLE_DEFINITIONS.map((def) => ({
    ...def,
    achievedAt: achievedMap.get(def.code) ?? null,
  }));
}

export async function getPerfectAttendanceHistory(staffId: string) {
  return prisma.perfectAttendance.findMany({
    where: { staffId },
    orderBy: { yearMonth: "desc" },
  });
}

// 退職処理と同時にゲームデータを無効化する(仕様: 異動は保持、退職は削除)。
export async function deleteGameData(staffId: string): Promise<void> {
  await prisma.$transaction([
    prisma.gameTitle.deleteMany({ where: { staffId } }),
    prisma.perfectAttendance.deleteMany({ where: { staffId } }),
  ]);
}
