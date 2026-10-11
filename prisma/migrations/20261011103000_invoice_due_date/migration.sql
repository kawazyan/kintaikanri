-- Invoice: payment due date chosen on the edit screen (YYYY-MM-DD). NULL = the month after the work month, end of month.
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "dueDate" TEXT;
