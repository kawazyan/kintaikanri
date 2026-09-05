import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  TimerReset,
  Swords,
  Trophy,
  Sofa,
  Users,
  CheckCircle2,
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
import { getAttendingStaff } from "@/lib/attendance";
import { nextFixedPaymentDate } from "@/lib/payment";
import { syncAndGetGameState } from "@/lib/game";
import { resolveAvatarSrc } from "@/lib/character-config";
import { ClockButtons } from "./clock-buttons";
import { LiveClock } from "./live-clock";
import { CharacterAvatar, type AvatarState } from "./character-avatar";
import { CancelPunchButton } from "./cancel-punch-button";
import { GamePanel } from "./game-panel";
import { StampCard } from "./stamp-card";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { HexIcon } from "@/components/hex-icon";

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
      getAttendingStaff(now).then((list) => list.length),
    ]);

  const last = todayRecords[todayRecords.length - 1];
  const canClockOut = !!last && last.type === "IN";
  const finished = !!last && last.type === "OUT";
  const todayIn = todayRecords.find((r) => r.type === "IN");
  const todayOut = [...todayRecords].reverse().find((r) => r.type === "OUT");
  const todayHasShift = todayRecords.some((r) => r.shiftId);
  const avatarState: AvatarState = !last ? "HOME" : last.type === "IN" ? "WORK" : "NIGHT";
  const avatarSrc = resolveAvatarSrc(staff.selectedCharacterId, avatarState, {
    home: staff.customAvatarHome,
    work: staff.customAvatarWork,
    night: staff.customAvatarNight,
  });
  const nextTitle = game.lockedTitles[0];

  const byDate = new Map<string, { in?: Date; out?: Date }>();
  for (const r of monthRecords) {
    const k = toJstDateValue(r.timestamp);
    const e = byDate.get(k) || {};
    if (r.type === "IN" && !e.in) e.in = r.timestamp;
    if (r.type === "OUT") e.out = r.timestamp;
    byDate.set(k, e);
  }
  const todayKey = toJstDateValue(now);
  const history = [...byDate.entries()]
    .filter(([k]) => k !== todayKey)
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
          <CharacterAvatar
            state={avatarState}
            imageSrc={avatarSrc}
            staffName={staff.name}
          >
            <LiveClock />
            <ClockButtons canClockOut={canClockOut} />
            {last && (
              <CancelPunchButton recordId={last.id} timestamp={last.timestamp.toISOString()} compact />
            )}
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
          <div className="px-3 pt-3"><GamePanel game={game} /></div>
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
            <section className="relative overflow-hidden rounded-[24px] border border-[#7f8589] bg-[linear-gradient(115deg,#15090b_0%,#080a0d_42%,#030608_100%)] p-[6px] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.08),0_14px_30px_rgba(0,0,0,.5)]">
              <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_13%_45%,rgba(145,18,18,.25),transparent_28%),linear-gradient(90deg,transparent_0_68%,rgba(6,10,13,.15)_73%,rgba(2,5,7,.92)_100%)]" />
              <div className="pointer-events-none absolute right-[13%] top-0 h-full w-[27%] opacity-35 [background-image:repeating-linear-gradient(90deg,transparent_0_14px,rgba(164,179,188,.11)_15px_16px,transparent_17px_30px),linear-gradient(0deg,rgba(0,0,0,.05),rgba(0,0,0,.8))]" />
              <div className="relative flex min-h-[146px] items-center rounded-[19px] border border-[#30363a] px-3 py-3 shadow-[inset_0_0_28px_rgba(0,0,0,.78)]">
                <div className="flex h-[102px] w-[102px] shrink-0 items-center justify-center rounded-[24px] border-2 border-[#d8d9d7] bg-[radial-gradient(circle_at_50%_45%,#351011,#12090b_58%,#050607)] shadow-[inset_0_0_0_4px_rgba(255,255,255,.04),inset_0_0_24px_rgba(170,20,20,.28),0_0_14px_rgba(177,20,20,.25)]">
                  <div className="challenger-crest"><Swords size={52} strokeWidth={1.7} /></div>
                </div>

                <div className="min-w-0 flex-1 px-4">
                  <p className="text-[11px] font-black tracking-[.06em] text-[#e3342d]">NEXT TITLE</p>
                  <p className="mt-1 line-clamp-2 text-[19px] font-black leading-tight tracking-[-.03em] text-[#e9e9e6] [text-shadow:0_2px_0_#333,0_4px_6px_#000]">{nextTitle.label}</p>
                  <div className="mt-3 h-px bg-[linear-gradient(90deg,#8d8d88,rgba(141,141,136,.1))]" />
                  <p className="mt-3 whitespace-nowrap text-[14px] font-bold text-[#c8c5c1]">連続{nextTitle.minStreak}勤務で獲得！</p>
                </div>

                <div className="flex h-[112px] w-[74px] shrink-0 flex-col items-center justify-center border-l border-[#4b4f51] text-center">
                  <span className="text-[14px] font-bold text-[#d8d6d2]">あと</span>
                  <span className="text-[48px] font-black leading-none text-[#b51e19] [text-shadow:0_2px_0_#3b0505,0_0_8px_rgba(181,30,25,.28)]">{Math.max(0, nextTitle.minStreak - game.streak)}</span>
                  <span className="mt-1 text-[13px] font-black text-[#d8d6d2]">勤務</span>
                </div>
              </div>
            </section>
          )}

          <section className="grid grid-cols-3 gap-2.5">
            {[
              { href: "/titles", label: "称号", sub: `${game.titles.length}個 獲得中`, Icon: Trophy, tone: "red" as const },
              { href: "/my-room", label: "マイルーム", sub: "キャラ・設定", Icon: Sofa, tone: "blue" as const },
              { href: "/town", label: "出勤メンバー", sub: `現在${memberCount}人出勤中`, Icon: Users, tone: "green" as const },
            ].map(({ href, label, sub, Icon, tone }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-1.5 rounded-[20px] border border-white/10 bg-[linear-gradient(160deg,#14171b,#07090a)] px-2 py-4 text-center text-white active:scale-[.97]"
              >
                <HexIcon icon={Icon} tone={tone} size={26} />
                <span className="mt-1 whitespace-nowrap text-[12px] font-black">{label}</span>
                <span className="whitespace-nowrap text-[9px] text-slate-400">{sub}</span>
              </Link>
            ))}
          </section>

          <section className="today-punch-panel">
            <div className="today-punch-head">
              <div className="today-punch-clock"><span className="today-punch-clock-ring"><TimerReset size={36} strokeWidth={1.7} /></span></div>
              <div className="min-w-0 flex-1">
                <h2 className="today-punch-title">今日の打刻履歴</h2>
                <p className="today-punch-note">5分経過後は管理者に修正を依頼してください</p>
              </div>
            </div>
            {last && (
              <div className="today-punch-cancel-row">
                <CancelPunchButton recordId={last.id} timestamp={last.timestamp.toISOString()} />
              </div>
            )}
            <div className="today-punch-times">
              <div className="today-punch-time-block">
                <p className="today-punch-label">↪ <span>出勤</span></p>
                <p className="today-punch-value">{todayIn ? formatJst(todayIn.timestamp).slice(-5) : "--:--"}</p>
              </div>
              <div className="today-punch-time-block">
                <p className="today-punch-label">↪ <span>退勤</span></p>
                <p className="today-punch-value">{todayOut ? formatJst(todayOut.timestamp).slice(-5) : "--:--"}</p>
              </div>
            </div>
          </section>

          <section className="payment-metal-panel">
            <div className="payment-metal-main">
              <div className="payment-metal-amount">
                <p className="payment-metal-kicker">今月の確定受取金額</p>
                <div className="payment-metal-glint" />
                <p className="payment-metal-yen">
                  {earnings.confirmedAmount === null
                    ? "－"
                    : `¥${earnings.confirmedAmount.toLocaleString("ja-JP")}`}
                </p>
              </div>
              <div className="payment-metal-info">
                <Link href="/payment/info" className="payment-metal-link">
                  <CalendarDays size={25} />
                  <span>支払情報</span>
                  <ChevronRight size={22} />
                </Link>
                {staff.paymentMethod === "FIXED" ? (
                  <>
                    <p className="payment-metal-label">次回支払予定日</p>
                    <p className="payment-metal-date">
                      {payDate
                        ? new Intl.DateTimeFormat("ja-JP", {
                            timeZone: "Asia/Tokyo",
                            month: "long",
                            day: "numeric",
                            weekday: "short",
                          }).format(payDate)
                        : "未設定"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="payment-metal-label">振込申請可能額</p>
                    <p className="payment-metal-date">¥{transferBalance?.availableAmount.toLocaleString("ja-JP") || 0}</p>
                  </>
                )}
              </div>
            </div>
            <div className="payment-metal-bottom payment-metal-bottom-single">
              <div className="payment-metal-method">
                <span>支払方式</span>
                <strong>{staff.paymentMethod === "FIXED" ? "固定支払" : "申請支払"}</strong>
              </div>
            </div>
          </section>

          <section className="recent-metal-card">
            <div className="recent-metal-head">
              <h2 className="recent-metal-title">
                <span className="recent-metal-clock"><Clock3 size={25} /></span>
                直近の打刻履歴
              </h2>
              <Link href="/history" className="recent-metal-all">
                すべて見る <ChevronRight size={17} />
              </Link>
            </div>
            {history.length ? (
              history.map((h) => (
                <div key={h.key} className="recent-metal-row">
                  <div className="recent-metal-date">{h.label}</div>
                  <div className="recent-metal-time"><span>出勤</span><strong>{h.in}</strong></div>
                  <div className="recent-metal-time"><span>退勤</span><strong>{h.out}</strong></div>
                  <div className={`recent-metal-status ${h.status ? "working" : ""}`}>
                    {h.status || `${Math.floor(h.mins / 60)}時間${h.mins % 60}分`}
                  </div>
                </div>
              ))
            ) : (
              <p className="px-6 py-7 text-sm text-slate-400">打刻記録がありません。</p>
            )}
          </section>

          {nextShift && (
            <section className="rounded-[24px] bg-gradient-to-r from-[#102235] to-[#13283d] p-4 text-white shadow-[0_10px_24px_rgba(15,23,42,.16)]">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[.04]">
                  <CalendarDays size={27} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-300">次のシフト</p>
                  <p className="mt-1 truncate text-2xl font-black">
                    {new Intl.DateTimeFormat("ja-JP", {
                      timeZone: "Asia/Tokyo",
                      month: "numeric",
                      day: "numeric",
                      weekday: "short",
                    }).format(nextShift.startTime)}
                  </p>
                </div>
                <div className="ml-auto shrink-0 text-right text-sm">
                  <p className="whitespace-nowrap font-bold">
                    {formatJst(nextShift.startTime).slice(-5)} - {formatJst(nextShift.endTime).slice(-5)}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-300">{nextShift.storeName}</p>
                </div>
              </div>
              <Link
                href="/shift"
                className="mt-3 flex items-center justify-center whitespace-nowrap rounded-2xl bg-gradient-to-b from-red-500 to-red-700 px-4 py-3 text-sm font-black shadow-[0_4px_0_#7f1d1d]"
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
