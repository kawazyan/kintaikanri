-- FixedPaymentCompletion: 固定支払の「振込完了」ボタンの記録(押していない月は未振込として扱う)
CREATE TABLE IF NOT EXISTS "FixedPaymentCompletion" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "closingYearMonth" TEXT NOT NULL,
  "paidAmount" INTEGER NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FixedPaymentCompletion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FixedPaymentCompletion_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "FixedPaymentCompletion_staffId_closingYearMonth_key" ON "FixedPaymentCompletion"("staffId","closingYearMonth");
CREATE INDEX IF NOT EXISTS "FixedPaymentCompletion_closingYearMonth_idx" ON "FixedPaymentCompletion"("closingYearMonth");
