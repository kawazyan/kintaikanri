-- Estimates (見積書): new tables only. Existing tables/columns (Invoice etc.) are not changed.
DO $$ BEGIN
  CREATE TYPE "EstimateStatus" AS ENUM ('SAVED', 'SENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Estimate" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "estimateNumber" TEXT NOT NULL,
  "status" "EstimateStatus" NOT NULL DEFAULT 'SAVED',
  "issuedDate" TEXT NOT NULL,
  "addressee" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "note" TEXT,
  "taxMode" TEXT NOT NULL DEFAULT 'EX',
  "subtotalExTax" INTEGER NOT NULL DEFAULT 0,
  "taxAmount" INTEGER NOT NULL DEFAULT 0,
  "totalInclTax" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3),
  "sentTo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Estimate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Estimate_estimateNumber_key" ON "Estimate"("estimateNumber");
CREATE INDEX IF NOT EXISTS "Estimate_clientId_issuedDate_idx" ON "Estimate"("clientId", "issuedDate");

CREATE TABLE IF NOT EXISTS "EstimateLine" (
  "id" TEXT NOT NULL,
  "estimateId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPriceExTax" INTEGER NOT NULL,
  "unitPriceInclTax" INTEGER,
  CONSTRAINT "EstimateLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EstimateLine_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "EstimateLine_estimateId_idx" ON "EstimateLine"("estimateId");
