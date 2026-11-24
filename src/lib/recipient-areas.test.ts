import test from "node:test";
import assert from "node:assert/strict";
import { greetNamesFor, presetEmailsFor, recipientDetailsOf, recipientPresetsOf, recipientPresetsRawOf, type BillingTerms } from "./billing-terms";

const terms: BillingTerms = {
  recipientAreas: [
    {
      key: "iwate",
      label: "岩手",
      people: [
        { name: "千坂TSL", email: "s_chisaka@cosmonet.ne.jp", greet: true },
        { name: "浅野AM", email: "k_asano@cosmonet.ne.jp" },
        { name: "石沢 様", email: "r_ishizawa@cosmonet.ne.jp" },
      ],
    },
    {
      key: "fukushima",
      label: "福島",
      people: [
        { name: "竹内TL", email: "k_takeuchi@cosmonet.ne.jp", greet: true },
        { name: "石沢 様", email: "r_ishizawa@cosmonet.ne.jp" },
      ],
    },
  ],
  recipientPresets: [
    { label: "SB奥州水沢", emails: [], area: "iwate" },
    { label: "SB秋田山王店", emails: ["store@cosmonet.ne.jp", "S_CHISAKA@cosmonet.ne.jp"], area: "iwate" },
    { label: "福島の店", emails: [], area: "fukushima" },
    { label: "エリアなしの店", emails: ["x@example.com"] },
  ],
};

test("エリアを指定した店舗は、担当者のアドレスが先に入る(浅野AMと石沢様を含む)", () => {
  const r = recipientPresetsOf(terms);
  assert.deepEqual(r[0], { label: "SB奥州水沢", emails: ["s_chisaka@cosmonet.ne.jp", "k_asano@cosmonet.ne.jp", "r_ishizawa@cosmonet.ne.jp"], area: "iwate" });
});

test("福島は浅野AMが入らず、竹内TLと石沢様になる", () => {
  const f = recipientPresetsOf(terms).find((p) => p.label === "福島の店");
  assert.deepEqual(f?.emails, ["k_takeuchi@cosmonet.ne.jp", "r_ishizawa@cosmonet.ne.jp"]);
});

test("店舗だけの宛先は担当者のあとに並び、重複(大文字小文字違い)は1件になる", () => {
  const r = recipientPresetsOf(terms).find((p) => p.label === "SB秋田山王店");
  assert.deepEqual(r?.emails, ["s_chisaka@cosmonet.ne.jp", "k_asano@cosmonet.ne.jp", "r_ishizawa@cosmonet.ne.jp", "store@cosmonet.ne.jp"]);
});

test("エリアなしの店舗は、従来どおり(areaキーなし)", () => {
  const r = recipientPresetsOf(terms).find((p) => p.label === "エリアなしの店");
  assert.deepEqual(r, { label: "エリアなしの店", emails: ["x@example.com"] });
});

test("存在しないエリアを指定した店舗は、エリアなしとして扱う(アドレスがなければ除く)", () => {
  const t: BillingTerms = { ...terms, recipientPresets: [{ label: "A店", emails: [], area: "unknown" }, { label: "B店", emails: ["b@example.com"], area: "unknown" }] };
  assert.deepEqual(recipientPresetsOf(t), [{ label: "B店", emails: ["b@example.com"] }]);
});

test("編集画面用: 店舗だけの宛先とエリアをそのまま取り出す", () => {
  const raw = recipientPresetsRawOf(terms);
  assert.deepEqual(raw[0], { label: "SB奥州水沢", emails: [], area: "iwate" });
  assert.deepEqual(raw[1].emails, ["store@cosmonet.ne.jp", "S_CHISAKA@cosmonet.ne.jp"]);
});

test("宛先の名前: 登録した担当者は名前が付き、それ以外は名前なし", () => {
  assert.deepEqual(recipientDetailsOf(terms, ["s_chisaka@cosmonet.ne.jp", "R_ISHIZAWA@cosmonet.ne.jp", "other@example.com"]), [
    { email: "s_chisaka@cosmonet.ne.jp", name: "千坂TSL" },
    { email: "R_ISHIZAWA@cosmonet.ne.jp", name: "石沢 様" },
    { email: "other@example.com", name: null },
  ]);
});

test("本文に書く名前は、TSL/TL(greet)だけ。店舗名の表記違いは同じ扱い", () => {
  assert.deepEqual(greetNamesFor(terms, "ＳＢ奥州水沢"), ["千坂TSL"]);
  assert.deepEqual(greetNamesFor(terms, "福島の店"), ["竹内TL"]);
  assert.deepEqual(greetNamesFor(terms, "エリアなしの店"), []);
  assert.deepEqual(greetNamesFor(terms, null), []);
  assert.deepEqual(greetNamesFor(terms, "登録にない店"), []);
});

test("見積書の自由入力の店舗名でも、語尾の店・SB/ソフトバンクの違いを無視してTSLの名前が出る", () => {
  const terms = {
    recipientAreas: [{ key: "iwate", label: "岩手", people: [{ name: "千坂TSL", email: "s@x.jp", greet: true }] }],
    recipientPresets: [{ label: "SB奥州水沢", emails: [], area: "iwate" }],
  } as never;
  for (const n of ["SB奥州水沢", "SB奥州水沢店", "ソフトバンク奥州水沢店", "ＳＢ奥州水沢 店"]) {
    assert.deepEqual(greetNamesFor(terms, n), ["千坂TSL"], n);
  }
  assert.deepEqual(greetNamesFor(terms, "SB秋田山王店"), []);
});

test("店舗名に合う登録済み店舗の宛先(エリアの担当者を含む)を返す", () => {
  const terms = {
    recipientAreas: [{ key: "miyagi", label: "宮城", people: [{ name: "宮坂TSL", email: "m@x.jp", greet: true }, { name: "浅野AM", email: "a@x.jp" }] }],
    recipientPresets: [{ label: "SB小鶴", emails: [], area: "miyagi" }],
  } as never;
  assert.deepEqual(presetEmailsFor(terms, "SB小鶴店"), ["m@x.jp", "a@x.jp"]);
  assert.deepEqual(presetEmailsFor(terms, "SB別の店"), []);
});
