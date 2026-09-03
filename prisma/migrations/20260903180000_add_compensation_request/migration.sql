-- 別途報酬申請(リファラル報酬・インセンティブ・その他)機能。
CREATE TYPE "CompensationCategory" AS ENUM ('REFERRAL', 'INCENTIVE', 'OTHER');

CREATE TABLE "CompensationRequest" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "yearMonth" TEXT NOT NULL,
  "category" "CompensationCategory" NOT NULL,
  "description" TEXT,
  "amountTaxInclusive" INTEGER NOT NULL,
  "amountExTax" INTEGER NOT NULL,
  "taxAmount" INTEGER NOT NULL,
  "taxRate" INTEGER NOT NULL DEFAULT 10,
  "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewerName" TEXT,
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompensationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompensationRequest_staffId_yearMonth_idx" ON "CompensationRequest"("staffId", "yearMonth");
CREATE INDEX "CompensationRequest_status_idx" ON "CompensationRequest"("status");

ALTER TABLE "CompensationRequest"
ADD CONSTRAINT "CompensationRequest_staffId_fkey"
FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
