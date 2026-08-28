import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Medal,
  Sofa,
  Trophy,
  Users,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  jstDayRange,
  jstMonthRange,
  currentJstYearMonth,
  yearMonthLabel,
  toJstDateValue,
  formatJst,
} from "@/lib/time";
import { computeMonthlyEarnings, computeTransferBalance } from "@/lib/earnings";
import { nextFixedPaymentDate } from "@/lib/payment";
import { syncAndGetGameState } from "@/lib/game";
import { ClockButtons } from "./clock-buttons";
import { LiveClock } from "./live-clock";
import { CharacterAvatar, type AvatarState } from "./character-avatar";
import { CancelPunchButton } from "./cancel-punch-button";
import { GamePanel } from "./game-panel";
import { StampCard } from "./stamp-card";
import { BottomTabBar } from "@/components/bottom-tab-bar";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export default async function ClockPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  const { start: todayStart, end: todayEnd } = jstDayRange();
  const yearMonth = currentJstYearMonth();
  const { start: monthStart, end: monthEnd } = jstMonthRange(yearMonth);

  const [todaysRecords, monthRecords, earnings, transferBalance, game] = await Promise.all([
    prisma.clockRecord.findMany({
      where: { staffId, timestamp: { gte: todayStart, lt: todayEnd } },
      orderBy: { timestamp: "asc" },
    }),
    prisma.clockRecord.findMany({
      where: { staffId, timestamp: { gte: monthStart, lt: monthEnd } },
      orderBy: { timestamp: "asc" },
    }),
    computeMonthlyEarnings(staffId, yearMonth),
    staff.paymentMethod === "REQUEST" ? computeTransferBalance(staffId) : null,
    syncAndGetGameState(staffId),
  ]);

  const nextPaymentDate = staff.paymentMethod === "FIXED" ? nextFixedPaymentDate(staff) : null;
  const lastToday = todaysRecords[todaysRecords.length - 1];
  const canClockOut = !!lastToday && lastToday.type === "IN";
  const avatarState: AvatarState = !lastToday ? "HOME" : lastToday.type === "IN" ? "WORK" : "NIGHT";
  const finishedToday = avatarState === "NIGHT";
  const todayIn = todaysRecords.find((record) => record.type === "IN");
  const todayOut = [...todaysRecords].reverse().find((record) => record.type === "OUT");
  const todayHasShift = todaysRecords.some((record) => record.shiftId);
  const nextTitle = game.lockedTitles[0];

  const byDate = new Map<string, { in?: Date; out?: Date }>();
  for (const record of monthRecords) {
    const key = toJstDateValue(record.timestamp);
    const entry = byDate.get(key) ?? {};
    if (record.type === "IN" && !entry.in) entry.in = record.timestamp;
    if (record.type === "OUT") entry.out = record.timestamp;
    byDate.set(key, entry);
  }

  const monthHistory = [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([dateKey, value]) => {
      const [year, month, day] = dateKey.split("-").map(Number);
      const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      return {
        dateKey,
        label: `${month}/${day}(${WEEKDAY_LABELS[weekday]})`,
        inTime: value.in ? formatJst(value.in).slice(-5) : null,
        outTime: value.out ? formatJst(value.out).slice(-5) : null,
      };
    });

  return (
    <main className="min-h-dvh bg-[#efe7dc] text-slate-900">
      <div className="mx-auto w-full max-w-[430px] pb-24">
        <div className="px-2 pt-2">
          <GamePanel game={game} />

          <CharacterAvatar
            state={avatarState}
            characterId={staff.selectedCharacterId}
            staffName={staff.name}
          >
            <LiveClock />
            <ClockButtons canClockOut={canClockOut} finishedToday={finishedToday} />
            <p className="rounded-full bg-white/80 px-3 py-1 text-[12px] font-bold text-slate-700 shadow-sm backdrop-blur-sm">
              {canClockOut
                ? `出勤時刻 ${todayIn ? formatJst(todayIn.timestamp).slice(-5) : "--:--"}`
                : finishedToday
                  ? `退勤時刻 ${todayOut ? formatJst(todayOut.timestamp).slice(-5) : "--:--"}`
                  : "本日の打刻はまだありません"}
            </p>
            {!todayHasShift && (todayIn || todayOut) && (
              <p className="rounded-full bg-red-50/95 px-3 py-1 text-[11px] font-bold text-red-600 shadow-sm">
                本日のシフトが登録されていません
              </p>
            )}
          </CharacterAvatar>
        </div>

        <div className="-mt-px flex flex-col gap-3 px-3 pb-4 pt-3">
          <StampCard stamp={game.stamp} />

          {game.perfectAttendanceThisMonth && (
            <p className="rounded-2xl bg-gradient-to-r from-amber-100 to-amber-200 px-4 py-2.5 text-center text-sm font-black text-amber-800 shadow-[0_3px_10px_rgba(217,119,6,.15)]">
              <span className="inline-flex items-center justify-center gap-2"><CheckCircle2 size={16} />今月の皆勤賞を達成しました!</span>
            </p>
          )}

          <section className="flex min-h-[112px] items-center overflow-hidden rounded-[22px] bg-white shadow-[0_5px_18px_rgba(64,40,30,.12)] ring-1 ring-black/5">
            <div className="flex w-[31%] items-center justify-center self-stretch bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 via-orange-500 to-red-600 shadow-[0_6px_16px_rgba(220,38,38,.28)] ring-4 ring-white">
                <Medal size={36} className="text-white" />
              </div>
            </div>
            <div className="min-w-0 flex-1 px-4 py-3">
              <span className="inline-flex rounded-md bg-slate-800 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">Next Title</span>
              {nextTitle ? (
                <>
                  <p className="mt-1 truncate text-[18px] font-black tracking-tight text-red-700">{nextTitle.label}</p>
                  <p className="text-[11px] font-bold text-slate-500">連続{nextTitle.minStreak}勤務で獲得!</p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-[18px] font-black text-amber-600">ALL TITLES COMPLETE</p>
                  <p className="text-[11px] font-bold text-slate-500">すべての称号を獲得済み</p>
                </>
              )}
            </div>
            <div className="border-l border-slate-200 px-4 text-center">
              {nextTitle ? (
                <>
                  <p className="text-[11px] font-bold text-slate-600">あと</p>
                  <p className="text-[31px] font-black leading-none text-red-600">{Math.max(0, nextTitle.minStreak - game.streak)}</p>
                  <p className="text-[11px] font-black text-slate-700">勤務</p>
                </>
              ) : (
                <Trophy size={34} className="text-amber-500" />
              )}
            </div>
          </section>

          <section className="grid grid-cols-3 gap-2">
            <Link href="/titles" className="flex min-h-[105px] flex-col items-center justify-center rounded-[20px] bg-gradient-to-b from-red-500 to-red-700 px-2 py-3 text-center text-white shadow-[0_5px_15px_rgba(220,38,38,.25)] active:scale-[.98]">
              <Trophy size={30} className="mb-1.5" />
              <span className="whitespace-nowrap text-[clamp(10px,2.9vw,13px)] font-black">獲得した称号</span>
            </Link>
            <Link href="/my-room" className="flex min-h-[105px] flex-col items-center justify-center rounded-[20px] bg-gradient-to-b from-amber-300 to-amber-500 px-2 py-3 text-center text-amber-950 shadow-[0_5px_15px_rgba(245,158,11,.24)] active:scale-[.98]">
              <Sofa size={30} className="mb-1.5" />
              <span className="whitespace-nowrap text-[clamp(10px,2.9vw,13px)] font-black">マイルーム</span>
            </Link>
            <Link href="/town" className="flex min-h-[105px] flex-col items-center justify-center rounded-[20px] bg-gradient-to-b from-emerald-400 to-emerald-600 px-2 py-3 text-center text-white shadow-[0_5px_15px_rgba(5,150,105,.24)] active:scale-[.98]">
              <Users size={30} className="mb-1.5" />
              <span className="whitespace-nowrap text-[clamp(9px,2.65vw,12px)] font-black tracking-tight">今日の出勤メンバー</span>
            </Link>
          </section>

          <section className="rounded-[22px] bg-white p-4 shadow-[0_4px_14px_rgba(64,40,30,.1)] ring-1 ring-black/5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[14px] font-black text-slate-900">
                <Clock3 size={18} className="text-red-600" /> 今日の打刻履歴
              </h2>
              {lastToday && (
                <CancelPunchButton recordId={lastToday.id} timestamp={lastToday.timestamp.toISOString()} />
              )}
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-200 rounded-2xl bg-slate-50 py-3 text-center">
              <div>
                <p className="text-[10px] font-bold text-slate-400">出勤</p>
                <p className="mt-0.5 text-[18px] font-black tabular-nums">{todayIn ? formatJst(todayIn.timestamp).slice(-5) : "--:--"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400">退勤</p>
                <p className="mt-0.5 text-[18px] font-black tabular-nums">{todayOut ? formatJst(todayOut.timestamp).slice(-5) : "--:--"}</p>
              </div>
            </div>
          </section>

          <section className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 p-5 text-center text-white shadow-[0_5px_18px_rgba(234,88,12,.25)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
            <h2 className="relative text-[12px] font-black tracking-wide">今月の確定受取金額</h2>
            <p className="relative mt-1 text-[32px] font-black drop-shadow-sm">
              {earnings.confirmedAmount === null ? "－" : `${earnings.confirmedAmount.toLocaleString("ja-JP")}円`}
            </p>
          </section>

          <section className="rounded-[22px] bg-white p-4 shadow-[0_4px_14px_rgba(64,40,30,.1)] ring-1 ring-black/5">
            <h2 className="mb-3 text-[13px] font-black text-red-600">支払情報</h2>
            {staff.paymentMethod === "FIXED" ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">次回支払予定日</span>
                <span className="font-black text-slate-900">
                  {nextPaymentDate
                    ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" }).format(nextPaymentDate)
                    : "未設定"}
                </span>
              </div>
            ) : transferBalance ? (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">申請済み</span>
                  <span className="font-bold">{transferBalance.requestedAmount.toLocaleString("ja-JP")}円</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">振込申請可能額</span>
                  <span className="font-black">{transferBalance.availableAmount.toLocaleString("ja-JP")}円</span>
                </div>
                <Link href="/payment/request" className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-black text-white active:scale-[.98]">
                  <Wallet size={16} /> 振込申請
                </Link>
                <Link href="/payment/history" className="flex items-center justify-center gap-1 text-xs font-bold text-red-600">
                  振込申請履歴を見る <ChevronRight size={13} />
                </Link>
              </div>
            ) : null}
          </section>

          <section className="rounded-[22px] bg-white p-4 shadow-[0_4px_14px_rgba(64,40,30,.1)] ring-1 ring-black/5">
            <h2 className="mb-2 text-[13px] font-black text-red-600">今月の打刻履歴（{yearMonthLabel(yearMonth)}）</h2>
            {monthHistory.length === 0 ? (
              <p className="text-sm text-slate-500">打刻記録がありません。</p>
            ) : (
              <ul className="flex flex-col text-sm">
                {monthHistory.map((history) => (
                  <li key={history.dateKey} className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-slate-100 py-2 text-slate-700 last:border-0">
                    <span className="text-slate-400">{history.label}</span>
                    <span>出勤 {history.inTime ?? "-"}</span>
                    <span>退勤 {history.outTime ?? "-"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Link href="/shift" className="flex items-center justify-center gap-2 rounded-[18px] bg-gradient-to-b from-red-500 to-red-700 py-3.5 text-sm font-black text-white shadow-[0_5px_14px_rgba(220,38,38,.22)] active:scale-[.98]">
            <CalendarDays size={18} /> シフト登録・確認
          </Link>
        </div>
      </div>

      <BottomTabBar />
    </main>
  );
}
