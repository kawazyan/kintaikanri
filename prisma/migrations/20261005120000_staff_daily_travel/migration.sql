-- Staff: fixed per-day travel allowance (tax-inclusive yen per worked day)
ALTER TABLE "Staff"
  ADD COLUMN IF NOT EXISTS "dailyTravelInclTax" INTEGER;
