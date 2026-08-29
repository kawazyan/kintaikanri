import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Trophy,
  Sofa,
  Users,
  CircleDollarSign,
  CheckCircle2,
  Star,
} from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  jstDayRange,
  jstMonthRange,
  currentJstYearMonth,
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

function minutesBetween(a?: Date, b?: Date) {
  if (!a || !b) return 0;
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000));
}

export default async function ClockPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  const { start: todayStart, end: todayEnd } = jstDayRange();
  const ym = currentJstYearMonth();
  const { start: monthStart, end: monthEnd } = jstMonthRange(ym);
  const now = new Date();

  const [todayRecords, monthRecords, earnings, transferBalance, game, nextShift, memberCount] =
    await Promise.all([
      prisma.clockRecord.findMany({
        where: { staffId, timestamp: { gte: todayStart, lt: todayEnd } },
        orderBy: { timestamp: "asc" },
      }),
      prisma.clockRecord.findMany({
        where: { staffId, timestamp: { gte: monthStart, lt: monthEnd } },
        orderBy: { timestamp: "asc" },
      }),
      computeMonthlyEarnings(staffId, ym),
      staff.paymentMethod === "REQUEST" ? computeTransferBalance(staffId) : null,
      syncAndGetGameState(staffId),
      prisma.shift.findFirst({
        where: { staffId, cancelledAt: null, startTime: { gte: now } },
        orderBy: { startTime: "asc" },
      }),
      prisma.shift.count({
        where: { cancelledAt: null, startTime: { gte: todayStart, lt: todayEnd } },
      }),
    ]);

  const last = todayRecords[todayRecords.length - 1];
  const canClockOut = !!last && last.type === "IN";
  const finished = !!last && last.type === "OUT";
  const todayIn = todayRecords.find((r) => r.type === "IN");
  const todayOut = [...todayRecords].reverse().find((r) => r.type === "OUT");
  const todayHasShift = todayRecords.some((r) => r.shiftId);
  const avatarState: AvatarState = !last ? "HOME" : last.type === "IN" ? "WORK" : "NIGHT";
  const nextTitle = game.lockedTitles[0];

  const byDate = new Map<string, { in?: Date; out?: Date }>();
  for (const r of monthRecords) {
    const k = toJstDateValue(r.timestamp);
    const e = byDate.get(k) || {};
    if (r.type === "IN" && !e.in) e.in = r.timestamp;
    if (r.type === "OUT") e.out = r.timestamp;
    byDate.set(k, e);
  }
  const history = [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 3)
    .map(([k, v]) => {
      const [y, m, d] = k.split("-").map(Number);
      const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      const mins = minutesBetween(v.in, v.out);
      return {
        key: k,
        label: `${m}/${d}(${WEEKDAY_LABELS[wd]})`,
        in: v.in ? formatJst(v.in).slice(-5) : "--:--",
        out: v.out ? formatJst(v.out).slice(-5) : "--:--",
        mins,
        status: v.in && !v.out ? "勤務中" : "",
      };
    });
  const payDate = staff.paymentMethod === "FIXED" ? nextFixedPaymentDate(staff) : null;

  return (
    <main className="staff-screen">
      <div className="mx-auto max-w-[430px] pb-28">
        <div className="flex flex-col">
          <GamePanel game={game} />
          <CharacterAvatar
            state={avatarState}
            characterId={staff.selectedCharacterId}
            staffName={staff.name}
          >
            <LiveClock />
            <ClockButtons canClockOut={canClockOut} finishedToday={finished} />
            <p className="rounded-full bg-white/80 px-3 py-1 text-[12px] font-bold text-slate-700 shadow-sm backdrop-blur-sm">
              {canClockOut
                ? `出勤時刻 ${todayIn ? formatJst(todayIn.timestamp).slice(-5) : "--:--"}`
                : finished
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

        <div className="flex flex-col gap-3 px-4 pt-4">
          <StampCard stamp={game.stamp} />

          {game.perfectAttendanceThisMonth && (
            <p className="rounded-2xl bg-gradient-to-r from-amber-100 to-amber-200 px-4 py-2.5 text-center text-sm font-black text-amber-800 shadow-[0_3px_10px_rgba(217,119,6,.15)]">
              <span className="inline-flex items-center justify-center gap-2">
                <CheckCircle2 size={16} />
                今月の皆勤賞を達成しました！
              </span>
            </p>
          )}

          {nextTitle && (
            <section className="game-hud-frame game-cut-card flex min-h-[100px] items-center gap-3 overflow-hidden rounded-[20px] p-4 shadow-[0_5px_18px_rgba(64,40,30,.12)] ring-1 ring-black/5">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 via-orange-500 to-amber-700 shadow-[0_6px_16px_rgba(245,158,11,.3)]">
                <Star size={26} className="text-white" fill="currentColor" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black tracking-wide text-amber-600 uppercase">
                  Next Title
                </p>
                <p className="truncate text-[16px] font-black text-slate-900">{nextTitle.label}</p>
                <p className="text-[11px] font-bold text-slate-500">
                  連続{nextTitle.minStreak}勤務で獲得！
                </p>
              </div>
              <p className="shrink-0 text-center">
                <span className="block text-[10px] font-bold text-slate-500">あと</span>
                <span className="block text-[26px] font-black leading-none text-red-600">
                  {Math.max(0, nextTitle.minStreak - game.streak)}
                </span>
                <span className="block text-[10px] font-black text-slate-700">勤務</span>
              </p>
            </section>
          )}

          <section className="grid grid-cols-3 gap-2.5">
            <Link
              href="/titles"
              className="game-cut-card group relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#491416] via-[#271a22] to-[#111827] p-4 text-center text-white shadow-[0_10px_24px_rgba(15,23,42,.16)] active:translate-y-0.5"
            >
              <Trophy size={34} className="mx-auto" />
              <p className="mt-4 whitespace-nowrap text-[12px] font-black">称号</p>
              <p className="mt-1 whitespace-nowrap text-[9px] text-slate-300">{game.titles.length}個 獲得中</p>
            </Link>
            <Link
              href="/my-room"
              className="game-cut-card rounded-[22px] bg-gradient-to-br from-[#253547] to-[#101a26] p-4 text-center text-white shadow-[0_10px_24px_rgba(15,23,42,.16)] active:translate-y-0.5"
            >
              <Sofa size={35} className="mx-auto" />
              <p className="mt-4 whitespace-nowrap text-[12px] font-black">マイルーム</p>
              <p className="mt-1 whitespace-nowrap text-[9px] text-slate-300">キャラ・設定</p>
            </Link>
            <Link
              href="/town"
              className="game-cut-card rounded-[22px] bg-gradient-to-br from-[#203b3a] to-[#102526] p-4 text-center text-white shadow-[0_10px_24px_rgba(15,23,42,.16)] active:translate-y-0.5"
            >
              <Users size={36} className="mx-auto" />
              <p className="mt-4 whitespace-nowrap text-[11px] font-black">出勤メンバー</p>
              <p className="mt-1 whitespace-nowrap text-[9px] text-slate-300">{memberCount}人 予定</p>
            </Link>
          </section>

          <section className="game-hud-frame game-cut-card overflow-hidden rounded-[20px] shadow-[0_10px_24px_rgba(15,23,42,.08)] ring-1 ring-black/5">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="flex items-center gap-2 font-black">
                <Clock3 size={19} className="text-red-600" />
                今日の打刻履歴
              </h2>
              {last && (
                <CancelPunchButton recordId={last.id} timestamp={last.timestamp.toISOString()} />
              )}
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-200 border-t border-slate-100 py-4 text-center">
              <div>
                <p className="text-[10px] font-bold text-slate-400">出勤</p>
                <p className="mt-1 text-xl font-black tabular-nums">
                  {todayIn ? formatJst(todayIn.timestamp).slice(-5) : "--:--"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400">退勤</p>
                <p className="mt-1 text-xl font-black tabular-nums">
                  {todayOut ? formatJst(todayOut.timestamp).slice(-5) : "--:--"}
                </p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-[1.06fr_.94fr] gap-3">
            <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#11263a] to-[#081522] p-5 text-white shadow-[0_10px_24px_rgba(15,23,42,.16)]">
              <div className="absolute right-[-28px] top-[-30px] h-32 w-32 rounded-full border border-white/5" />
              <p className="text-sm font-black">今月の確定受取金額</p>
              <div className="mt-2 h-[3px] w-28 bg-gradient-to-r from-red-500 to-transparent" />
              <p className="mt-5 text-[35px] font-black tracking-tight">
                {earnings.confirmedAmount === null
                  ? "－"
                  : `¥ ${earnings.confirmedAmount.toLocaleString("ja-JP")}`}
              </p>
              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] px-3 py-3">
                <span className="text-xs text-slate-300">残高</span>
                <CircleDollarSign size={20} className="text-slate-300" />
                <span className="ml-auto text-sm font-black">
                  •••• {String(staff.employeeCode).slice(-4)}
                </span>
                <ChevronRight size={18} className="text-slate-400" />
              </div>
            </div>
            <div className="game-hud-frame game-cut-card rounded-[20px] p-5 shadow-[0_10px_24px_rgba(15,23,42,.08)] ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-black">
                  <CalendarDays size={22} />
                  支払情報
                </h2>
                <ChevronRight size={18} />
              </div>
              {staff.paymentMethod === "FIXED" ? (
                <>
                  <p className="mt-6 text-xs text-slate-500">次回支払予定日</p>
                  <p className="mt-2 text-[22px] font-black leading-tight">
                    {payDate
                      ? new Intl.DateTimeFormat("ja-JP", {
                          timeZone: "Asia/Tokyo",
                          month: "long",
                          day: "numeric",
                          weekday: "short",
                        }).format(payDate)
                      : "未設定"}
                  </p>
                  <div className="mt-5 border-t pt-3 text-xs font-bold">
                    <span className="rounded-lg bg-slate-100 px-2 py-1">支払方式</span>
                    <span className="ml-2 text-slate-600">固定支払</span>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-5 text-xs text-slate-500">振込申請可能額</p>
                  <p className="mt-2 text-[24px] font-black">
                    ¥{transferBalance?.availableAmount.toLocaleString("ja-JP") || 0}
                  </p>
                  <Link
                    href="/payment/request"
                    className="mt-4 block rounded-xl bg-slate-900 py-2.5 text-center text-xs font-black text-white"
                  >
                    振込申請
                  </Link>
                </>
              )}
            </div>
          </section>

          <section className="game-hud-frame game-cut-card overflow-hidden rounded-[20px] shadow-[0_10px_24px_rgba(15,23,42,.08)] ring-1 ring-black/5">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="flex items-center gap-2 font-black">
                <Clock3 size={19} />
                直近の打刻履歴
              </h2>
              <Link href="/history" className="flex items-center text-xs font-bold text-slate-600">
                すべて見る
                <ChevronRight size={16} />
              </Link>
            </div>
            {history.length ? (
              history.map((h) => (
                <div
                  key={h.key}
                  className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2 border-t px-5 py-3 text-sm"
                >
                  <div className="font-bold">{h.label}</div>
                  <div>
                    <span className="text-[10px] text-slate-400">出勤</span>
                    <p className="font-black">{h.in}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">退勤</span>
                    <p className="font-black">{h.out}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${h.status ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"}`}
                  >
                    {h.status || `${Math.floor(h.mins / 60)}時間${h.mins % 60}分`}
                  </span>
                </div>
              ))
            ) : (
              <p className="border-t px-5 py-5 text-sm text-slate-400">打刻記録がありません。</p>
            )}
          </section>

          {nextShift && (
            <section className="flex items-center gap-4 rounded-[24px] bg-gradient-to-r from-[#102235] to-[#13283d] p-4 text-white shadow-[0_10px_24px_rgba(15,23,42,.16)]">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/[.04]">
                <CalendarDays size={27} />
              </div>
              <div>
                <p className="text-xs text-slate-300">次のシフト</p>
                <p className="mt-1 text-2xl font-black">
                  {new Intl.DateTimeFormat("ja-JP", {
                    timeZone: "Asia/Tokyo",
                    month: "numeric",
                    day: "numeric",
                    weekday: "short",
                  }).format(nextShift.startTime)}
                </p>
              </div>
              <div className="ml-auto text-sm">
                <p className="font-bold">
                  {formatJst(nextShift.startTime).slice(-5)} - {formatJst(nextShift.endTime).slice(-5)}
                </p>
                <p className="mt-1 text-xs text-slate-300">{nextShift.storeName}</p>
              </div>
              <Link
                href="/shift"
                className="rounded-2xl bg-gradient-to-b from-red-500 to-red-700 px-4 py-3 text-sm font-black shadow-[0_4px_0_#7f1d1d]"
              >
                シフトを確認する
              </Link>
            </section>
          )}
        </div>
      </div>
      <BottomTabBar />
    </main>
  );
}
