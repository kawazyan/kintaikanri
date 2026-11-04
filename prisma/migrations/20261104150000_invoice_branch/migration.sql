-- Invoice.branch: 請求先(店舗など)。同じ取引先の中で店舗ごとに請求書を分けるときの店舗名。NULL=会社あて(従来どおり)
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "branch" TEXT;
