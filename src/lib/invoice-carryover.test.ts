import assert from "node:assert/strict";
import test from "node:test";
import { mergeCarryOver } from "./invoice-carryover";
import type { StatementSnapshot, StatementStaff } from "./invoice-draft";

const travel0 = { mode: "NONE" as const, amountExTax: 0, amountInclTax: 0 };
const staff = (name: string, o: Partial<StatementStaff> = {}): StatementStaff => ({
  name,
  places: ["A店"],
  carriers: [],
  dates: ["2026-09-01", "2026-09-02"],
  dayPlaces: { "2026-09-01": "A店", "2026-09-02": "A店" },
  days: 2,
  serviceExTax: 20000,
  serviceCalc: "日額 ¥10,000 × 2日",
  travel: travel0,
  ...o,
});
const prevOf = (edited: StatementStaff[], base: StatementStaff[], extras = [] as StatementSnapshot["clientExtras"], baseExtras = [] as NonNullable<StatementSnapshot["clientExtras"]>): StatementSnapshot => ({
  clientName: "c",
  yearMonth: "2026-09",
  staff: edited,
  clientExtras: extras,
  baseline: { staff: base.map((s) => ({ name: s.name, dates: s.dates, dayPlaces: s.dayPlaces, serviceExTax: s.serviceExTax, serviceCalc: s.serviceCalc, travel: s.travel })), clientExtras: baseExtras },
});

test("手で直した金額だけ引き継ぎ、直していないスタッフは最新の計算を使う", () => {
  const prev = prevOf([staff("山田", { serviceExTax: 25000, serviceCalc: "手修正" }), staff("佐藤")], [staff("山田"), staff("佐藤")]);
  const fresh = [staff("山田", { days: 3, dates: ["2026-09-01", "2026-09-02", "2026-09-03"], serviceExTax: 30000 }), staff("佐藤", { serviceExTax: 40000 })];
  const r = mergeCarryOver({ staff: fresh, clientExtras: [] }, prev);
  assert.equal(r.staff[0].serviceExTax, 25000);
  assert.equal(r.staff[0].serviceCalc, "手修正");
  assert.equal(r.staff[0].days, 3); // 稼働日は直していないので最新
  assert.equal(r.staff[1].serviceExTax, 40000); // 直していない → 最新
});

test("稼働日・稼働店舗の修正を引き継ぐ", () => {
  const edited = staff("山田", { dates: ["2026-09-01", "2026-09-05"], dayPlaces: { "2026-09-01": "B店", "2026-09-05": "B店" }, days: 2, places: ["B店"] });
  const prev = prevOf([edited], [staff("山田")]);
  const r = mergeCarryOver({ staff: [staff("山田")], clientExtras: [] }, prev);
  assert.deepEqual(r.staff[0].dates, ["2026-09-01", "2026-09-05"]);
  assert.deepEqual(r.staff[0].dayPlaces, { "2026-09-01": "B店", "2026-09-05": "B店" });
  assert.deepEqual(r.staff[0].places, ["B店"]);
  assert.equal(r.staff[0].days, 2);
});

test("店舗だけ直した場合は、その日だけ上書きする", () => {
  const edited = staff("山田", { dayPlaces: { "2026-09-01": "A店", "2026-09-02": "C店" }, places: ["A店", "C店"] });
  const prev = prevOf([edited], [staff("山田")]);
  const r = mergeCarryOver({ staff: [staff("山田", { dayPlaces: { "2026-09-01": "A店", "2026-09-02": "A店" } })], clientExtras: [] }, prev);
  assert.deepEqual(r.staff[0].dayPlaces, { "2026-09-01": "A店", "2026-09-02": "C店" });
  assert.deepEqual(r.staff[0].places, ["A店", "C店"]);
});

test("共通の項目は、直していれば引き継ぎ、直していなければ最新を使う", () => {
  const ex = [{ label: "新幹線代", amountExTax: 5000, amountInclTax: 5500 }];
  const edited = prevOf([staff("山田")], [staff("山田")], ex, []);
  assert.deepEqual(mergeCarryOver({ staff: [staff("山田")], clientExtras: [] }, edited).clientExtras, ex);
  const untouched = prevOf([staff("山田")], [staff("山田")], [], []);
  const fresh = [{ label: "広告", amountExTax: 1, amountInclTax: 1 }];
  assert.deepEqual(mergeCarryOver({ staff: [staff("山田")], clientExtras: fresh }, untouched).clientExtras, fresh);
});

test("元の値(baseline)がない旧形式の下書きは、金額を勝手に引き継がず注意を出す", () => {
  const prev: StatementSnapshot = { clientName: "c", yearMonth: "2026-09", staff: [staff("山田", { serviceExTax: 1 })] };
  const r = mergeCarryOver({ staff: [staff("山田")], clientExtras: [] }, prev);
  assert.equal(r.staff[0].serviceExTax, 20000);
  assert.ok(r.notes.some((n) => n.includes("旧形式")));
});

test("前の下書きにいたスタッフが今回いなければ注意を出す(空白の違いは同一人物)", () => {
  const prev = prevOf([staff("山田　太郎"), staff("佐藤")], [staff("山田　太郎"), staff("佐藤")]);
  const r = mergeCarryOver({ staff: [staff("山田 太郎")], clientExtras: [] }, prev);
  assert.equal(r.staff.length, 1);
  assert.ok(r.notes.some((n) => n.includes("佐藤")));
});
