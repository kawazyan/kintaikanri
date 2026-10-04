-- 請求書の修正(宛名・件名・備考)と、取引先へのメール送信記録の追加(追加のみ。既存データに影響しない)
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "addressee" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "sentTo" TEXT;
