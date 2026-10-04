// 同じ店舗の表記ゆれを統一する(請求内訳書の稼働場所用)。
// 例: 「西多賀」と「auショップ西多賀」→「auショップ西多賀」。
// ある名前が、別の名前の一部に含まれていれば、長い方に統一する。
// 長い名前の候補が複数あって決められない場合(「イオン」→「イオンモール秋田」「イオン藤崎」など)は、統一しない。
const norm = (s: string) => s.replace(/[\s　]/g, "");

// 表示用: 店名の末尾に「店」を付ける(すでに「店」で終わる名前、空欄・「未定」・「店舗未定」はそのまま)。
export function withShopSuffix(name: string): string {
  const t = name.trim();
  if (!t || t === "未定" || t === "店舗未定" || t.endsWith("店")) return name;
  return `${t}店`;
}

export function unifyStoreNames(names: string[]): Map<string, string> {
  const uniq = [...new Set(names)];
  const map = new Map<string, string>();
  for (const a of uniq) {
    const na = norm(a);
    let target = a;
    if (na.length >= 2) {
      const longer = uniq.filter((b) => b !== a && norm(b).length > na.length && norm(b).includes(na));
      // 候補のうち一番長いものが、他の候補をすべて含んでいるときだけ、それに統一する
      const top = [...longer].sort((x, y) => norm(y).length - norm(x).length)[0];
      if (top && longer.every((b) => norm(top).includes(norm(b)))) target = top;
    }
    map.set(a, target);
  }
  return map;
}
