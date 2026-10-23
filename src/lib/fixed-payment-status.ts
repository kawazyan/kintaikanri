import { jstDayRange } from "@/lib/time";

// 固定支払の「振込完了ボタン」の状態判定(純粋な関数。DBに触れない)。
//  DONE     = 振込完了ボタンが押されている
//  OVERDUE  = 支払日(前倒し後)が今日以前なのに、ボタンが押されていない → 「未振込」として赤字で表示
//  PENDING  = 支払日がまだ先(押していなくて普通)
//  UNTRACKED = 記録を始める前の支払い(支払日が PAYMENT_TRACKING_START より前)。ボタン運用の対象外
export type FixedPaymentState = "DONE" | "OVERDUE" | "PENDING" | "UNTRACKED";

// この日以降の支払日のものから、振込完了ボタンで管理する(それ以前は既に振込済みで記録がないため、未振込扱いにしない)。
export const PAYMENT_TRACKING_START = new Date("2026-10-23T00:00:00+09:00");

export function fixedPaymentState(input: { paymentDate: Date; completed: boolean; now: Date }): FixedPaymentState {
  const { paymentDate, completed, now } = input;
  if (paymentDate.getTime() < PAYMENT_TRACKING_START.getTime()) return "UNTRACKED";
  if (completed) return "DONE";
  return paymentDate.getTime() <= jstDayRange(now).start.getTime() ? "OVERDUE" : "PENDING";
}
