-- Invoice.kind: 請求の種類。WORK=稼働分の請求(従来) / EXTRA=別途請求(営業協力費など、スタッフの稼働とは別の請求)。既存の請求はすべて WORK
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'WORK';
