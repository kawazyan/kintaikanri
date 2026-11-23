-- スタッフごとの経費の自動作成ルール。
--   kind = 'KM'    : 店舗(storeMatch を含む店名)ごとの自宅からの片道km。稼働日ごとに 片道km×2×ratePerKm円 を、月の交通費(ガソリン代)として自動作成
--   kind = 'FIXED' : 毎月かかる固定の経費(label・amount)を自動作成
CREATE TABLE IF NOT EXISTS "StaffExpenseRule" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "storeMatch" TEXT,
  "oneWayKm" DOUBLE PRECISION,
  "ratePerKm" INTEGER NOT NULL DEFAULT 10,
  "label" TEXT,
  "amount" INTEGER,
  "fromMonth" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffExpenseRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StaffExpenseRule_staffId_idx" ON "StaffExpenseRule"("staffId");
ALTER TABLE "StaffExpenseRule" ENABLE ROW LEVEL SECURITY;

-- 村上(00015)。ガソリン代は2026年11月稼働分から(10月分までは本人が申請済み)、AI利用料は12月稼働分から(11月分は申請済み)。
INSERT INTO "StaffExpenseRule" ("id","staffId","kind","storeMatch","oneWayKm","ratePerKm","label","amount","fromMonth")
SELECT v.id, s.id, v.kind, v.store, v.km, 10, v.label, v.amount, v.fm
FROM "Staff" s, (VALUES
  ('ser_00015_nishitaga','KM','西多賀',14.1::double precision,NULL::text,NULL::int,'2026-11'),
  ('ser_00015_higashisendai','KM','東仙台',6.7,NULL,NULL,'2026-11'),
  ('ser_00015_shiogama','KM','塩釜',14.8,NULL,NULL,'2026-11'),
  ('ser_00015_uesugi','KM','上杉',5.1,NULL,NULL,'2026-11'),
  ('ser_00015_murayama','KM','村山駅西',62.6,NULL,NULL,'2026-11'),
  ('ser_00015_ai','FIXED',NULL,NULL,'AI利用料（立替金）',3000,'2026-12')
) AS v(id,kind,store,km,label,amount,fm)
WHERE s."employeeCode" = '00015'
ON CONFLICT DO NOTHING;
