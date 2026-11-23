// 紹介リファラルの計算(純粋な計算だけ。DBは触らない)。
//   渡辺さんのリファラル = 日割り後の単価 − 会社取り分(日割り後の単価の10%) − 日割り後の本人支払い
// 単価の日割りは請求書(invoice-draft.ts)と同じ値、本人支払いは earnings.ts の受取金額をそのまま使う。
// 会社取り分の端数は切り上げ(会社が不利にならない側)。

export type ReferralPart = {
  grossExTax: number; // 日割り後の単価(税抜・請求書の業務委託費)
  companyShare: number; // 会社取り分
  ownPay: number; // 本人への支払い(日割り後)
  referral: number; // 渡辺さんのリファラル(0未満は0)
  negative: boolean; // 本人支払い + 会社取り分が単価を超え、リファラルが0未満になった(0にしている)
};

export function companyShareOf(grossExTax: number, percent: number): number {
  return Math.ceil((grossExTax * percent) / 100);
}

export function computeReferralPart(grossExTax: number, ownPay: number, percent = 10): ReferralPart {
  const companyShare = companyShareOf(grossExTax, percent);
  const raw = grossExTax - companyShare - ownPay;
  return { grossExTax, companyShare, ownPay, referral: Math.max(0, raw), negative: raw < 0 };
}

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

// 申請の内訳に載せる、人ごとの計算式(1行。月は内訳のラベルに入っている)。
export function referralMemo(p: ReferralPart, percent: number, grossCalc: string): string {
  return `単価 ${yen(p.grossExTax)}（${grossCalc}） − 会社${percent}% ${yen(p.companyShare)} − 本人支払い ${yen(p.ownPay)}${p.negative ? "（0円未満のため0円）" : ""}`;
}
