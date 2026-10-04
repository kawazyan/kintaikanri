-- 取引先ごとの請求書メール宛先(複数可)。追加のみ。既存データに影響しない
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "invoiceEmails" TEXT;
