-- 経費の「払い済み」の記録(申請支払の人の経費は月末に別で払うため、払ったかどうかを残す)。
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paidByName" TEXT;

-- 過去分: 申請支払の人の、2026年10月分までの承認済みの経費は「月末に払い済み」として記録する(加藤 9月分・10月分、坂本 10月分)。
UPDATE "Expense" e
SET "paidAt" = (date_trunc('month', to_date(e."yearMonth" || '-01', 'YYYY-MM-DD')) + interval '1 month' - interval '1 day')::timestamp - interval '9 hours',
    "paidByName" = '過去分(月末払い・一括記録)'
FROM "Staff" s
WHERE s.id = e."staffId" AND s."paymentMethod" = 'REQUEST' AND e.status = 'APPROVED' AND e."yearMonth" <= '2026-10' AND e."paidAt" IS NULL;
