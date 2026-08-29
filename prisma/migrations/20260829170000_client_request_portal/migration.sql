-- 取引先の事前登録を不要にし、/client から直接稼働依頼できるようにする拡張。
-- 既存データを保持するため、既存 WorkOrder には安全なデフォルトを設定する。
CREATE TYPE "WorkRequestType" AS ENUM ('CATCH', 'CLOSER', 'BAND');
CREATE TYPE "SchedulePattern" AS ENUM ('FIXED', 'VARIES');

ALTER TABLE "Client"
ADD COLUMN "contactDepartment" TEXT;

ALTER TABLE "WorkOrder"
ADD COLUMN "requestedCarrier" TEXT,
ADD COLUMN "requestType" "WorkRequestType" NOT NULL DEFAULT 'BAND',
ADD COLUMN "schedulePattern" "SchedulePattern" NOT NULL DEFAULT 'FIXED',
ADD COLUMN "fixedStartTime" TEXT,
ADD COLUMN "fixedEndTime" TEXT,
ADD COLUMN "clientContactDepartment" TEXT;

CREATE TABLE "WorkOrderScheduleDay" (
  "id" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "workDate" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT,
  "endTime" TEXT,
  "storeName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkOrderScheduleDay_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkOrderScheduleDay_workOrderId_workDate_idx"
ON "WorkOrderScheduleDay"("workOrderId", "workDate");

ALTER TABLE "WorkOrderScheduleDay"
ADD CONSTRAINT "WorkOrderScheduleDay_workOrderId_fkey"
FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
