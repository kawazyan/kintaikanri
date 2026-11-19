-- 請求書メールの送付履歴(初回送信・再送)。新しいテーブルを足すだけで、既存のテーブル・データは変えない
CREATE TABLE IF NOT EXISTS "InvoiceSendLog" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "toEmails" TEXT NOT NULL,
  "ccEmails" TEXT,
  "bccEmails" TEXT,
  "savedTo" TEXT,
  "addedEmails" TEXT,
  CONSTRAINT "InvoiceSendLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InvoiceSendLog_invoiceId_sentAt_idx" ON "InvoiceSendLog"("invoiceId", "sentAt");
DO $$ BEGIN
  ALTER TABLE "InvoiceSendLog" ADD CONSTRAINT "InvoiceSendLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "InvoiceSendLog" ENABLE ROW LEVEL SECURITY;
