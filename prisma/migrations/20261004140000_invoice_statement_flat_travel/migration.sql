-- 交通費「一律(月額)」と稼働明細書スナップショットの追加(いずれも既存データに影響しない追加のみ)
ALTER TYPE "TravelExpenseRule" ADD VALUE IF NOT EXISTS 'FLAT';
ALTER TABLE "WorkOrderStaff" ADD COLUMN IF NOT EXISTS "flatTravelAmountExTax" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "statement" JSONB;
