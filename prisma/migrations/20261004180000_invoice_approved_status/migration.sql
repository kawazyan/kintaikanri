-- 請求の流れ: 下書き → 承認済み → 送付済み。承認済みの状態と承認日時・承認者を追加(追加のみ。既存データに影響しない)
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
