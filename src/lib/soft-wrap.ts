// 請求内訳書の「項目」の列のように、幅の狭い欄に長い文字列を入れるときの自動改行(react-pdf は、空白のない日本語を折り返さず、隣の列に重なってしまうため)。
// 幅は全角=1、半角=0.5 で数える。maxEm を超えるときは、まず開き括弧「（」「(」の手前で改行し、それでも収まらなければ maxEm で改行する。
// 行頭に来てはいけない文字(閉じ括弧・句読点・「〜」「・」など)が行頭に来るときは、1文字前で改行する。すでにある改行(\n)はそのまま残す。
const NO_LINE_START = new Set("）)」』】、。，．,.・〜～ー!！?？:：;；");
const OPEN_BRACKETS = new Set("（(「『【");

const emOf = (ch: string) => {
  const c = ch.codePointAt(0) ?? 0;
  return c <= 0x7f || (c >= 0xff61 && c <= 0xff9f) ? 0.5 : 1;
};
const widthOf = (s: string) => [...s].reduce((a, ch) => a + emOf(ch), 0);

function wrapLine(line: string, maxEm: number): string[] {
  const out: string[] = [];
  let rest = [...line];
  while (widthOf(rest.join("")) > maxEm) {
    // maxEm に収まる最大の文字数
    let w = 0;
    let fit = 0;
    while (fit < rest.length && w + emOf(rest[fit]) <= maxEm) w += emOf(rest[fit++]);
    if (fit === 0) fit = 1;
    let cut = fit;
    // 収まる範囲に開き括弧があれば、その手前で切る(先頭は除く)
    const open = rest.slice(1, fit + 1).findIndex((ch) => OPEN_BRACKETS.has(ch));
    if (open >= 0) cut = open + 1;
    else while (cut > 1 && NO_LINE_START.has(rest[cut])) cut--;
    out.push(rest.slice(0, cut).join(""));
    rest = rest.slice(cut);
  }
  out.push(rest.join(""));
  return out;
}

export function softWrap(text: string, maxEm: number): string {
  return text.split("\n").flatMap((line) => wrapLine(line, maxEm)).join("\n");
}
