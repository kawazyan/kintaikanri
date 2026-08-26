import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Wallet, ChevronRight } from "lucide-react";
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

  const nextPaymentDate =
    staff.paymentMethod === "FIXED" ? nextFixedPaymentDate(staff) : null;

  // Current punch state: whether the last action today was an IN without a
  // matching OUT yet, used to drive which single button (出勤/退勤) shows.
  const lastToday = todaysRecords[todaysRecords.length - 1];
  const canClockOut = !!lastToday && lastToday.type === "IN";

  const avatarState: AvatarState = !lastToday ? "HOME" : lastToday.type === "IN" ? "WORK" : "NIGHT";
  const finishedToday = avatarState === "NIGHT";

  const todayIn = todaysRecords.find((r) => r.type === "IN");
  const todayOut = [...todaysRecords].reverse().find((r) => r.type === "OUT");
  const todayHasShift = todaysRecords.some((r) => r.shiftId);

  const byDate = new Map<string, { in?: Date; out?: Date }>();
  for (const r of monthRecords) {
    const key = toJstDateValue(r.timestamp);
    const entry = byDate.get(key) ?? {};
    if (r.type === "IN" && !entry.in) entry.in = r.timestamp;
    if (r.type === "OUT") entry.out = r.timestamp;
    byDate.set(key, entry);
  }
  const monthHistory = [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([dateKey, v]) => {
      const [y, m, d] = dateKey.split("-").map(Number);
      // A calendar date's weekday doesn't depend on timezone, so compute it
      // directly from the Y/M/D — going through a JST-offset instant (as
      // before) shifted it back by one UTC day and showed the wrong weekday.
      const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      return {
        dateKey,
        label: `${m}/${d}(${WEEKDAY_LABELS[weekday]})`,
        inTime: v.in ? formatJst(v.in).slice(-5) : null,
        outTime: v.out ? formatJst(v.out).slice(-5) : null,
      };
    });

  return (
    <main className="min-h-dvh bg-gradient-to-b from-white via-[#fdfaf5] to-[#faf5eb]">
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 pt-6 pb-28">
      {/* 称号・コイン・連続勤務・XP + キャラクター画像を、継ぎ目なく1枚の
          赤いパネルとして繋げる(ページ最上部、画面幅いっぱい) */}
      <div className="-mx-4 flex flex-col">
      <GamePanel game={game} />

      <CharacterAvatar state={avatarState} staffName={staff.name}>
        {/* 1. 現在日時 */}
        <LiveClock />

        {/* 2. 出退勤ボタン */}
        <ClockButtons canClockOut={canClockOut} finishedToday={finishedToday} />

        {!todayHasShift && (todayIn || todayOut) && (
          <p className="text-center text-sm font-medium text-red-400">
            本日のシフトが登録されていません
          </p>
        )}
      </CharacterAvatar>
      </div>

      {/* 3. 今日の打刻履歴 */}
      <section className="rounded-2xl bg-gradient-to-b from-white to-slate-100 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
        <h2 className="mb-2 text-xs font-bold tracking-wide text-red-600 uppercase">
          今日の打刻履歴
        </h2>
        <div className="flex justify-between text-sm">
          <span className="font-medium text-slate-600">
            出勤{" "}
            <span className="text-slate-900">
              {todayIn ? formatJst(todayIn.timestamp).slice(-5) : "未打刻"}
            </span>
          </span>
          <span className="font-medium text-slate-600">
            退勤{" "}
            <span className="text-slate-900">
              {todayOut ? formatJst(todayOut.timestamp).slice(-5) : "未打刻"}
            </span>
          </span>
        </div>
        {lastToday && (
          <div className="mt-2 flex justify-end">
            <CancelPunchButton
              recordId={lastToday.id}
              timestamp={lastToday.timestamp.toISOString()}
            />
          </div>
        )}
      </section>

      {/* 4. 今月の確定受取金額 */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-700 p-5 text-center text-white shadow-[0_6px_20px_rgba(234,88,12,0.4)] ring-1 ring-amber-300/40">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />
        <h2 className="relative text-xs font-bold tracking-wide text-amber-50 uppercase">
          今月の確定受取金額
        </h2>
        <p className="relative mt-1 text-3xl font-black drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
          {earnings.confirmedAmount === null
            ? "－"
            : `${earnings.confirmedAmount.toLocaleString("ja-JP")}円`}
        </p>
      </section>

      {/* 5. 支払関連情報 */}
      <section className="rounded-2xl bg-gradient-to-b from-white to-slate-100 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
        <h2 className="mb-2 text-xs font-bold tracking-wide text-red-600 uppercase">
          支払情報
        </h2>
        {staff.paymentMethod === "FIXED" ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">次回支払予定日</span>
            <span className="font-semibold text-slate-900">
              {nextPaymentDate
                ? new Intl.DateTimeFormat("ja-JP", {
                    timeZone: "Asia/Tokyo",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }).format(nextPaymentDate)
                : "未設定"}
            </span>
          </div>
        ) : (
          transferBalance && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">申請済み</span>
                <span className="text-slate-900">
                  {transferBalance.requestedAmount.toLocaleString("ja-JP")}円
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">振込申請可能額</span>
                <span className="font-semibold text-slate-900">
                  {transferBalance.availableAmount.toLocaleString("ja-JP")}円
                </span>
              </div>
              <Link
                href="/payment/request"
                style={{
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 12px rgba(220,38,38,0.4), 0 2px 4px rgba(0,0,0,0.3)",
                }}
                className="relative mt-1 flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-b from-red-400 via-[#e0272e] to-red-800 py-2.5 text-center text-sm font-semibold text-white active:scale-[0.98]"
              >
                <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent" />
                <Wallet size={16} className="relative" />
                <span className="relative">振込申請</span>
              </Link>
              <Link
                href="/payment/history"
                className="flex items-center justify-center gap-1 text-center text-xs font-medium text-red-600"
              >
                振込申請履歴を見る
                <ChevronRight size={12} />
              </Link>
            </div>
          )
        )}
      </section>

      {/* 6. 今月の打刻履歴 */}
      <section className="rounded-2xl bg-gradient-to-b from-white to-slate-100 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
        <h2 className="mb-2 text-xs font-bold tracking-wide text-red-600 uppercase">
          今月の打刻履歴({yearMonthLabel(yearMonth)})
        </h2>
        {monthHistory.length === 0 ? (
          <p className="text-sm text-slate-500">打刻記録がありません。</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {monthHistory.map((h) => (
              <li
                key={h.dateKey}
                className="flex justify-between border-b border-slate-200 py-1 text-slate-700 last:border-0"
              >
                <span className="text-slate-400">{h.label}</span>
                <span>出勤 {h.inTime ?? "-"}</span>
                <span>退勤 {h.outTime ?? "-"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 今月の勤務スタンプ */}
      <StampCard stamp={game.stamp} />

      {/* 7. シフト登録への導線 */}
      <Link
        href="/shift"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px rgba(220,38,38,0.4), 0 3px 6px rgba(0,0,0,0.4)",
        }}
        className="relative mt-auto flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-b from-red-400 via-[#e0272e] to-red-800 py-3.5 text-sm font-bold text-white active:scale-[0.98]"
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent" />
        <CalendarDays size={18} className="relative" />
        <span className="relative">シフト登録・確認</span>
      </Link>
    </div>

      <BottomTabBar />
    </main>
  );
}
