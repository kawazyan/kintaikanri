-- 振込・金額設定・経費・別途報酬の変更履歴。新しいテーブルを足すだけで、既存のテーブル・データは変えない
CREATE TABLE IF NOT EXISTS "PaymentAuditLog" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "staffName" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "yearMonth" TEXT,
  "actorType" TEXT NOT NULL,
  "actorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PaymentAuditLog_staffId_createdAt_idx" ON "PaymentAuditLog"("staffId", "createdAt");
ALTER TABLE "PaymentAuditLog" ENABLE ROW LEVEL SECURITY;
