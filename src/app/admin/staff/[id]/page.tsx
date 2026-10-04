import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "../../admin-nav";
import { updateStaffDetails } from "../actions";
import { SubmitButton } from "@/components/submit-button";

function toDateInputValue(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

const FIELD_CLASS =
  "rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

export default async function AdminStaffDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { saved } = await searchParams;

  const staff = await prisma.staff.findUnique({ where: { id } });
  if (!staff) notFound();

  // スタッフがシフト登録時に入力した単価(SPOTのみ)。管理者が日当を決める際の参考表示。
  const enteredPrices = (
    await prisma.shift.groupBy({
      by: ["unitAmount"],
      where: { staffId: staff.id, workType: "SPOT", cancelledAt: null, unitAmount: { not: null } },
      _count: { _all: true },
      _max: { startTime: true },
    })
  )
    .filter((g) => g.unitAmount !== null)
    .sort((a, b) => b._count._all - a._count._all || b._max.startTime!.getTime() - a._max.startTime!.getTime());
  const suggestedDailyRate = enteredPrices[0]?.unitAmount ?? null;
  const fmtDate = (d: Date | null) =>
    d ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).format(d) : "-";

  const boundAction = updateStaffDetails.bind(null, staff.id);

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <AdminNav />
      <h1 className="mb-6 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        スタッフ詳細 - {staff.name}({staff.employeeCode})
      </h1>

      {saved === "1" && (
        <p className="mb-4 rounded-lg border border-emerald-700 bg-emerald-950/40 px-3 py-2 text-sm font-semibold text-emerald-300">
          保存しました
        </p>
      )}

      {/* key を保存時刻に紐づけることで、保存のたびにフォームを作り直させる。
          そうしないと select/input の defaultValue は初回マウント時にしか
          反映されないため、支払方法などを変更して保存しても画面上は変更前の
          値のまま据え置かれて見えてしまう(実際の保存自体はできている)。 */}
      <form key={staff.updatedAt.getTime()} action={boundAction} className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-blue-400/80">個人情報</h2>
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          生年月日
          <input
            type="date"
            name="birthDate"
            defaultValue={toDateInputValue(staff.birthDate)}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          電話番号
          <input
            type="tel"
            name="phoneNumber"
            defaultValue={staff.phoneNumber ?? ""}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          住所
          <input
            type="text"
            name="address"
            defaultValue={staff.address ?? ""}
            className={FIELD_CLASS}
          />
        </label>

        <h2 className="mt-2 text-sm font-semibold text-blue-400/80">報酬振込先口座</h2>
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          銀行名
          <input
            type="text"
            name="bankName"
            defaultValue={staff.bankName ?? ""}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          支店名
          <input
            type="text"
            name="bankBranchName"
            defaultValue={staff.bankBranchName ?? ""}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          口座番号
          <input
            type="text"
            name="bankAccountNumber"
            defaultValue={staff.bankAccountNumber ?? ""}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          口座名義人
          <input
            type="text"
            name="bankAccountHolder"
            defaultValue={staff.bankAccountHolder ?? ""}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          インボイス登録番号(任意)
          <input
            type="text"
            name="invoiceRegistrationNumber"
            defaultValue={staff.invoiceRegistrationNumber ?? ""}
            className={FIELD_CLASS}
          />
        </label>

        <h2 className="mt-2 text-sm font-semibold text-blue-400/80">支払方法</h2>
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          支払方法
          <select name="paymentMethod" defaultValue={staff.paymentMethod} className={FIELD_CLASS}>
            <option value="REQUEST">申請支払(スタッフが都度振込申請)</option>
            <option value="FIXED">固定支払(会社指定の支払日)</option>
          </select>
        </label>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
          <p className="mb-2 text-xs text-slate-500">
            固定支払を選んだ場合のみ使用します(申請支払では無視されます)。
          </p>
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              締日
              <select
                name="fixedClosingDay"
                defaultValue={staff.fixedClosingDay ?? ""}
                className={`${FIELD_CLASS} py-2 text-sm`}
              >
                <option value="">-</option>
                <option value="0">月末</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}日
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              支払月
              <select
                name="fixedPaymentMonthOffset"
                defaultValue={staff.fixedPaymentMonthOffset ?? ""}
                className={`${FIELD_CLASS} py-2 text-sm`}
              >
                <option value="">-</option>
                <option value="0">当月</option>
                <option value="1">翌月</option>
                <option value="2">翌々月</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              支払日
              <select
                name="fixedPaymentDay"
                defaultValue={staff.fixedPaymentDay ?? ""}
                className={`${FIELD_CLASS} py-2 text-sm`}
              >
                <option value="">-</option>
                <option value="0">月末</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}日
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <h2 className="mt-2 text-sm font-semibold text-blue-400/80">報酬設定</h2>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
          <p className="mb-2 text-xs text-slate-500">
            未設定の場合は、従来どおりシフトに入力された単価で計算します。設定した場合、単価が入っていないシフトにこの設定が使われます。
          </p>
          <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-3 text-xs text-amber-200">
            <p className="mb-1 font-semibold">スタッフが入力した単価(参考・管理者のみ表示)</p>
            {enteredPrices.length === 0 ? (
              <p className="text-amber-200/70">入力された単価はありません。</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {enteredPrices.map((g) => (
                  <li key={g.unitAmount}>
                    {g.unitAmount!.toLocaleString("ja-JP")}円 × {g._count._all}回(最終 {fmtDate(g._max.startTime)})
                  </li>
                ))}
              </ul>
            )}
            {suggestedDailyRate !== null && staff.dailyRate === null && (
              <p className="mt-1 text-amber-200/70">
                日当が未入力の間は、最も多い金額({suggestedDailyRate.toLocaleString("ja-JP")}円)を日当欄に仮表示しています。変更して保存できます。
              </p>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              報酬タイプ
              <select
                name="payType"
                defaultValue={staff.payType ?? ""}
                className={`${FIELD_CLASS} py-2 text-sm`}
              >
                <option value="">未設定</option>
                <option value="DAILY">日当(稼働日数 × 日当)</option>
                <option value="MONTHLY">月固定(稼働日数に関わらず定額)</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                日当(円/日)
                <input
                  type="number"
                  name="dailyRate"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  defaultValue={staff.dailyRate ?? suggestedDailyRate ?? ""}
                  className={`${FIELD_CLASS} py-2 text-sm`}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                月固定(円/月)
                <input
                  type="number"
                  name="monthlyAmount"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  defaultValue={staff.monthlyAmount ?? ""}
                  className={`${FIELD_CLASS} py-2 text-sm`}
                />
              </label>
            </div>
            <p className="text-xs text-slate-500">
              ※ 報酬タイプで選んだほうの金額だけが使われます。
            </p>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              交通費
              <select
                name="travelExpenseIncluded"
                defaultValue={
                  staff.travelExpenseIncluded === null || staff.travelExpenseIncluded === undefined
                    ? ""
                    : String(staff.travelExpenseIncluded)
                }
                className={`${FIELD_CLASS} py-2 text-sm`}
              >
                <option value="">未設定</option>
                <option value="true">込み(報酬に含まれる)</option>
                <option value="false">別払い(月末締め後に精算)</option>
              </select>
            </label>
          </div>
        </div>

        <SubmitButton
          className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-white shadow-lg shadow-blue-950/50 active:scale-[0.98]"
        >
          保存
        </SubmitButton>
      </form>
    </main>
  );
}
