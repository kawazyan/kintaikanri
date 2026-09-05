import type { IrregularReportType, IrregularReportStatus, ShiftChangeKind, OverrideApprovalStatus } from "@prisma/client";

// イレギュラー報告・シフト変更申請の表示ラベルを一箇所に集約する
// (スタッフ側フォーム・一覧、管理者側一覧・通知メールすべてで共有)。

export const IRREGULAR_REPORT_TYPE_LABEL: Record<IrregularReportType, string> = {
  LATE: "遅刻",
  EARLY_LEAVE: "早退",
  ABSENCE: "欠勤",
  SAME_DAY_ABSENCE: "当日欠勤",
  CLOCK_IN_CHANGE: "出勤時間変更",
  CLOCK_OUT_CHANGE: "退勤時間変更",
  LOCATION_CHANGE: "勤務場所変更",
  OTHER: "その他",
};

export const IRREGULAR_REPORT_TYPE_OPTIONS = Object.entries(IRREGULAR_REPORT_TYPE_LABEL).map(
  ([value, label]) => ({ value: value as IrregularReportType, label })
);

export const IRREGULAR_REPORT_STATUS_LABEL: Record<IrregularReportStatus, string> = {
  UNCONFIRMED: "未確認",
  IN_PROGRESS: "確認中",
  RESOLVED: "対応済み",
};

export const SHIFT_CHANGE_KIND_LABEL: Record<ShiftChangeKind, string> = {
  DATE_CHANGE: "勤務日変更",
  TIME_CHANGE: "勤務時間変更",
  LOCATION_CHANGE: "勤務場所変更",
  TO_OFF: "休みへの変更",
  TRANSFER: "別日への振替",
};

export const SHIFT_CHANGE_KIND_OPTIONS = Object.entries(SHIFT_CHANGE_KIND_LABEL).map(
  ([value, label]) => ({ value: value as ShiftChangeKind, label })
);

// シフト変更申請のstatusは既存のOverrideApprovalStatus(PENDING/APPROVED/REJECTED)を再利用している。
export const SHIFT_CHANGE_STATUS_LABEL: Record<OverrideApprovalStatus, string> = {
  PENDING: "申請中",
  APPROVED: "承認",
  REJECTED: "却下",
};
