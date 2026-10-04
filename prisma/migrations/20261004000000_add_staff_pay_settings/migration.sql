-- Staff に報酬設定(日当/月固定/交通費)を追加。加算のみ・冪等(本番DBには同内容を適用済み)
DO $$ BEGIN
  CREATE TYPE "StaffPayType" AS ENUM ('DAILY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Staff"
  ADD COLUMN IF NOT EXISTS "payType" "StaffPayType",
  ADD COLUMN IF NOT EXISTS "dailyRate" INTEGER,
  ADD COLUMN IF NOT EXISTS "monthlyAmount" INTEGER,
  ADD COLUMN IF NOT EXISTS "travelExpenseIncluded" BOOLEAN;
