-- 紹介リファラルの自動計算用の設定。
CREATE TABLE IF NOT EXISTS "ReferralLink" (
  "id" TEXT NOT NULL,
  "referrerStaffId" TEXT NOT NULL,
  "refereeStaffId" TEXT NOT NULL,
  "companyPercent" INTEGER NOT NULL DEFAULT 10,
  "fromMonth" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralLink_referrerStaffId_refereeStaffId_key" ON "ReferralLink"("referrerStaffId","refereeStaffId");
ALTER TABLE "ReferralLink" ENABLE ROW LEVEL SECURITY;

-- 渡辺(00004)の紹介: 柴田(00005)・藤田(00006)・寺島(00007)・丸山(00008)。2026年11月払いから自動計算。
INSERT INTO "ReferralLink" ("id","referrerStaffId","refereeStaffId","companyPercent","fromMonth")
SELECT 'ref_' || r."employeeCode", w.id, r.id, 10, '2026-11'
FROM "Staff" w, "Staff" r
WHERE w."employeeCode" = '00004' AND r."employeeCode" IN ('00005','00006','00007','00008')
ON CONFLICT DO NOTHING;
