import { test } from "node:test";
import assert from "node:assert/strict";
import { matchStore, prorateByDays, splitByStore } from "@/lib/store-sections";
import type { StatementStaff, StatementExtra } from "@/lib/invoice-draft";

const ads = ["auショップ西多賀店", "auフォレオ東仙台店", "auショップ塩釜店", "auショップイオンモール上杉店", "auショップ村山駅西店"];

test("勤怠とK.J EVENTの表記揺れを同じ店舗として照合する", () => {
  assert.equal(matchStore("au西多賀", ads), "auショップ西多賀店");
  assert.equal(matchStore("au東仙台フォレオ", ads), "auフォレオ東仙台店");
  assert.equal(matchStore("au塩釜", ads), "auショップ塩釜店");
  assert.equal(matchStore("auイオンモール仙台上杉", ads), "auショップイオンモール上杉店");
  assert.equal(matchStore("Joshin長岡愛宕店", ads), null);
});

test("日数で按分し、端数は日数の多い店舗(同数なら先)に足す", () => {
  const m = prorateByDays(550000, [{ key: "西多賀", days: 3 }, { key: "フォレオ", days: 6 }, { key: "塩釜", days: 6 }, { key: "上杉", days: 3 }]);
  assert.deepEqual([...m.values()], [91665, 183340, 183330, 91665]);
});

test("村上さん10月: 店舗ごとに分けて合計550,000円", () => {
  const place: Record<string, string> = {};
  const add = (ds: number[], p: string) => ds.forEach((d) => (place[`2026-10-${String(d).padStart(2, "0")}`] = p));
  add([1, 2, 5], "au西多賀"); add([6, 19, 20, 21, 22, 23], "au東仙台フォレオ"); add([8, 9, 10, 11, 12, 30], "au塩釜"); add([13, 15, 16], "auイオンモール仙台上杉");
  const dates = Object.keys(place).sort();
  const s: StatementStaff = { name: "村上　潤之介", places: [], carriers: [], dates, dayPlaces: place, days: dates.length, serviceExTax: 550000, serviceCalc: "月額 ¥550,000（固定・16稼働）", travel: { mode: "NONE", amountExTax: 0, amountInclTax: 0 } };
  const ex: StatementExtra[] = ads.map((a) => ({ label: a, store: a, period: "10月1日～10月2日", amountExTax: 100, amountInclTax: 110 }));
  const r = splitByStore([s], ex);
  assert.deepEqual(r.staff.map((x) => [x.section, x.days, x.serviceExTax]), [
    ["auショップ西多賀店", 3, 91665], ["auフォレオ東仙台店", 6, 183340], ["auショップ塩釜店", 6, 183330], ["auショップイオンモール上杉店", 3, 91665],
  ]);
  assert.equal(r.staff[1].serviceCalc, "月額 ¥550,000 ÷ 稼働18日 = 1日 ¥30,555 × 6日 ＋ 端数調整 ¥10");
  assert.deepEqual(r.extras.map((e) => e.section), ads);
});
