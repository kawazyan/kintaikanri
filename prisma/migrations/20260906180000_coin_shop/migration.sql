CREATE TYPE "CoinBonusType" AS ENUM ('ATTENDANCE', 'PERFECT');
CREATE TYPE "GiftExchangeStatus" AS ENUM ('REQUESTED', 'FULFILLED', 'REJECTED');

CREATE TABLE "CoinBonus" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "yearMonth" TEXT NOT NULL,
  "type" "CoinBonusType" NOT NULL,
  "coins" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoinBonus_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CoinBonus_staffId_yearMonth_type_key" ON "CoinBonus"("staffId", "yearMonth", "type");
CREATE INDEX "CoinBonus_staffId_createdAt_idx" ON "CoinBonus"("staffId", "createdAt");
ALTER TABLE "CoinBonus" ADD CONSTRAINT "CoinBonus_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GiftExchange" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "brand" TEXT NOT NULL,
  "amountYen" INTEGER NOT NULL,
  "coinsUsed" INTEGER NOT NULL,
  "status" "GiftExchangeStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fulfilledAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "adminNote" TEXT,
  CONSTRAINT "GiftExchange_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GiftExchange_staffId_requestedAt_idx" ON "GiftExchange"("staffId", "requestedAt");
CREATE INDEX "GiftExchange_status_requestedAt_idx" ON "GiftExchange"("status", "requestedAt");
ALTER TABLE "GiftExchange" ADD CONSTRAINT "GiftExchange_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
