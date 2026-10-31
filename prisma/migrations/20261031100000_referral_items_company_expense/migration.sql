-- 別途報酬: 振込済みの記録と、申請の内訳(1行ずつ)。会社経費テーブル。
ALTER TABLE "CompensationRequest" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "CompensationRequest" ADD COLUMN IF NOT EXISTS "paidAmount" INTEGER;
ALTER TABLE "CompensationRequest" ADD COLUMN IF NOT EXISTS "paidByOperatorName" TEXT;

CREATE TABLE IF NOT EXISTS "CompensationRequestItem" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "label" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "memo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompensationRequestItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompensationRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CompensationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CompensationRequestItem_requestId_idx" ON "CompensationRequestItem"("requestId");

CREATE TABLE IF NOT EXISTS "CompanyExpense" (
  "id" TEXT NOT NULL,
  "expenseDate" TEXT NOT NULL,
  "yearMonth" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "item" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "recurring" BOOLEAN NOT NULL DEFAULT false,
  "memo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyExpense_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CompanyExpense_yearMonth_idx" ON "CompanyExpense"("yearMonth");
