-- イレギュラー報告(スタッフ→会社への一方向の報告。承認フローなし)。
CREATE TYPE "IrregularReportType" AS ENUM (
  'LATE', 'EARLY_LEAVE', 'ABSENCE', 'SAME_DAY_ABSENCE',
  'CLOCK_IN_CHANGE', 'CLOCK_OUT_CHANGE', 'LOCATION_CHANGE', 'OTHER'
);
CREATE TYPE "IrregularReportStatus" AS ENUM ('UNCONFIRMED', 'IN_PROGRESS', 'RESOLVED');

CREATE TABLE "IrregularReport" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "targetDate" TIMESTAMP(3) NOT NULL,
  "reportType" "IrregularReportType" NOT NULL,
  "reason" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "changedTime" TEXT,
  "changedLocation" TEXT,
  "status" "IrregularReportStatus" NOT NULL DEFAULT 'UNCONFIRMED',
  "reviewerName" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IrregularReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IrregularReport_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "IrregularReport_staffId_createdAt_idx" ON "IrregularReport"("staffId", "createdAt");
CREATE INDEX "IrregularReport_status_idx" ON "IrregularReport"("status");

-- シフト変更申請(スタッフ・稼働先・上長間で調整済みの内容をシステムへ申請。
-- 管理者が承認するまでは対象Shiftを一切変更しない)。
-- statusは既存のOverrideApprovalStatus(PENDING/APPROVED/REJECTED)を再利用。
CREATE TYPE "ShiftChangeKind" AS ENUM (
  'DATE_CHANGE', 'TIME_CHANGE', 'LOCATION_CHANGE', 'TO_OFF', 'TRANSFER'
);

CREATE TABLE "ShiftChangeRequest" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "shiftId" TEXT,
  "targetDate" TIMESTAMP(3) NOT NULL,
  "kind" "ShiftChangeKind" NOT NULL,
  "reason" TEXT NOT NULL,
  "newDate" TIMESTAMP(3),
  "newStartTime" TEXT,
  "newEndTime" TEXT,
  "newLocation" TEXT,
  "transferDate" TIMESTAMP(3),
  "approvalConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "status" "OverrideApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "reviewerName" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShiftChangeRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShiftChangeRequest_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShiftChangeRequest_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ShiftChangeRequest_staffId_createdAt_idx" ON "ShiftChangeRequest"("staffId", "createdAt");
CREATE INDEX "ShiftChangeRequest_status_idx" ON "ShiftChangeRequest"("status");
