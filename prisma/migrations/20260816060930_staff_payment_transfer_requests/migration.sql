-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('FIXED', 'REQUEST');

-- CreateEnum
CREATE TYPE "TransferRequestStatus" AS ENUM ('REQUESTING', 'PAID');

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "address" TEXT,
ADD COLUMN     "bankAccountHolder" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankBranchName" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "fixedClosingDay" INTEGER,
ADD COLUMN     "fixedPaymentDay" INTEGER,
ADD COLUMN     "fixedPaymentMonthOffset" INTEGER,
ADD COLUMN     "invoiceRegistrationNumber" TEXT,
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'REQUEST',
ADD COLUMN     "phoneNumber" TEXT;

-- CreateTable
CREATE TABLE "ClockRecordHistory" (
    "id" TEXT NOT NULL,
    "clockRecordId" TEXT,
    "staffId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "operatorName" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClockRecordHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferRequest" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "desiredPaymentDate" TIMESTAMP(3) NOT NULL,
    "status" "TransferRequestStatus" NOT NULL DEFAULT 'REQUESTING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "paidAmount" INTEGER,
    "paidByOperatorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClockRecordHistory_clockRecordId_idx" ON "ClockRecordHistory"("clockRecordId");

-- CreateIndex
CREATE INDEX "ClockRecordHistory_staffId_idx" ON "ClockRecordHistory"("staffId");

-- CreateIndex
CREATE INDEX "TransferRequest_staffId_status_idx" ON "TransferRequest"("staffId", "status");

-- AddForeignKey
ALTER TABLE "ClockRecordHistory" ADD CONSTRAINT "ClockRecordHistory_clockRecordId_fkey" FOREIGN KEY ("clockRecordId") REFERENCES "ClockRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClockRecordHistory" ADD CONSTRAINT "ClockRecordHistory_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
