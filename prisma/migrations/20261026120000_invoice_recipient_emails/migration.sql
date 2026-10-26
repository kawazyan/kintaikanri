-- Invoice.recipientEmails: 請求書ごとに手入力する送信先(店舗ごとに宛先が違う取引先用)。空なら取引先の登録を使う
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "recipientEmails" TEXT;
