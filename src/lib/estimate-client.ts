import { splitEmails } from "@/lib/invoice-defaults";

// 見積書を送付した相手が、取引先一覧にすでにいるかを調べる(純粋なロジック。DBには触れない)。
// 「会社名」または「メールアドレス」のどちらかが既存の取引先と一致したら、その取引先とみなす。

export type ClientForMatch = {
  id: string;
  name: string;
  email: string | null;
  invoiceEmails: string | null;
  updatedAt: Date;
};

// 会社名の比較用: 全角・半角をそろえ(NFKC)、空白(全角含む)を除き、英字は小文字にする。
// 「株式会社」と「(株)」のような言い換えは同じとは扱わない。
export function normalizeCompanyName(name: string) {
  return name.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// 取引先に登録されているメールアドレス(請求用の宛先と、従来の email の両方)。
export function clientEmails(c: Pick<ClientForMatch, "email" | "invoiceEmails">) {
  return [...splitEmails(c.invoiceEmails), ...splitEmails(c.email)].map(normalizeEmail);
}

// 会社名が一致する取引先を優先し、なければメールアドレスが一致する取引先を返す。
// 複数一致したときは、更新日時が新しいものを選ぶ。会社名・メールが両方とも空なら一致なし。
export function findExistingClient(clients: ClientForMatch[], name: string, emails: string[]) {
  const newest = (xs: ClientForMatch[]) => [...xs].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null;
  const n = normalizeCompanyName(name);
  if (n) {
    const byName = newest(clients.filter((c) => normalizeCompanyName(c.name) === n));
    if (byName) return byName;
  }
  const mine = new Set(emails.map(normalizeEmail).filter(Boolean));
  if (!mine.size) return null;
  return newest(clients.filter((c) => clientEmails(c).some((e) => mine.has(e))));
}
