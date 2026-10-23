-- 報酬タイプ「月ごとに手入力(MANUAL)」と、その月ごとの支払い金額テーブル
ALTER TYPE "StaffPayType" ADD VALUE IF NOT EXISTS 'MANUAL';

CREATE TABLE IF NOT EXISTS "ManualPayAmount" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "yearMonth" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ManualPayAmount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ManualPayAmount_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ManualPayAmount_staffId_yearMonth_key" ON "ManualPayAmount"("staffId","yearMonth");
