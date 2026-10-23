-- TransferRequest: 却下(REJECTED)を追加
ALTER TYPE "TransferRequestStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TABLE "TransferRequest" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "TransferRequest" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "TransferRequest" ADD COLUMN IF NOT EXISTS "rejectedByOperatorName" TEXT;
