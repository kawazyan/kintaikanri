-- リファラルのみの人(スタッフ登録なし)への支払い。計算は画面を開くたびに行い、払った記録だけを残す。
CREATE TABLE IF NOT EXISTS "ReferralPayee" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralPayee_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "ReferralPayeeRule" (
  "id" TEXT NOT NULL,
  "payeeId" TEXT NOT NULL,
  "kind" TEXT NOT NULL, -- FIXED=毎月固定額 / SHARE_STAFF=(単価−本人支払い−システム利用料)×取り分 / SHARE_EXTRA=(別途請求−システム利用料)×取り分
  "label" TEXT NOT NULL,
  "fromMonth" TEXT NOT NULL, -- この稼働月(YYYY-MM)から
  "payLagMonths" INTEGER NOT NULL, -- 支払い月 = 稼働月 + この月数(その月の末日払い)
  "amount" INTEGER, -- FIXED の月額
  "staffName" TEXT, -- SHARE_STAFF の対象スタッフ名
  "clientName" TEXT, -- 請求書を探す取引先名(部分一致)
  "systemFee" INTEGER NOT NULL DEFAULT 10000,
  "sharePercent" INTEGER NOT NULL DEFAULT 50,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralPayeeRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ReferralPayeeRule_payeeId_idx" ON "ReferralPayeeRule"("payeeId");
CREATE TABLE IF NOT EXISTS "ReferralPayeePaid" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "workMonth" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "operatorName" TEXT,
  CONSTRAINT "ReferralPayeePaid_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralPayeePaid_ruleId_workMonth_key" ON "ReferralPayeePaid"("ruleId","workMonth");
ALTER TABLE "ReferralPayee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReferralPayeeRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReferralPayeePaid" ENABLE ROW LEVEL SECURITY;

-- 給与計算(振込関係・粗利)から外すスタッフ(社長本人など)。
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "excludeFromPayroll" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Staff" SET "excludeFromPayroll" = true WHERE "employeeCode" = '00001';

INSERT INTO "ReferralPayee" ("id","name","note") VALUES
  ('payee_matsuura','松浦','亀井さんの紹介料 月3万円'),
  ('payee_sogo','十河','半崎さん・アルティム営業協力費の紹介分')
ON CONFLICT DO NOTHING;
INSERT INTO "ReferralPayeeRule" ("id","payeeId","kind","label","fromMonth","payLagMonths","amount","staffName","clientName","systemFee","sharePercent") VALUES
  ('rule_matsuura_fixed','payee_matsuura','FIXED','亀井さんの紹介料(月額固定)','2026-11',1,30000,NULL,NULL,0,100),
  ('rule_sogo_hanasaki','payee_sogo','SHARE_STAFF','半崎さんの分','2026-10',2,NULL,'半崎','Faice',10000,50),
  ('rule_sogo_extra','payee_sogo','SHARE_EXTRA','アルティム営業協力費の分','2026-10',2,NULL,NULL,'ULTI-ME',10000,50)
ON CONFLICT DO NOTHING;
