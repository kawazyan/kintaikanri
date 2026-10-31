import test from "node:test";
import assert from "node:assert/strict";
import { parseCompensationItems } from "./compensation-items";

test("渡辺さんの実例(4人分)の合計が申請金額になる", () => {
  const r = parseCompensationItems(
    ["柴田", "藤田", "寺島", "丸山"],
    ["62000", "84000", "87000", "60000"],
    ["単価38万/給料28万/会社10% 3.8万", "", "", ""],
  );
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.total, 293000);
    assert.equal(r.items.length, 4);
    assert.equal(r.items[0].memo, "単価38万/給料28万/会社10% 3.8万");
    assert.equal(r.items[1].memo, null);
  }
});

test("全角数字・カンマ・円記号は半角の整数として読む", () => {
  const r = parseCompensationItems(["A"], ["６２，０００円"], [""]);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.total, 62000);
});

test("3つとも空の行は読み飛ばす", () => {
  const r = parseCompensationItems(["A", "", ""], ["100", "", ""], ["", "", ""]);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.items.length, 1);
});

test("対象だけ・金額だけの行はエラーにする", () => {
  const a = parseCompensationItems(["A"], [""], [""]);
  assert.ok(!a.ok);
  const b = parseCompensationItems([""], ["500"], [""]);
  assert.ok(!b.ok);
});

test("0円・小数・文字・負の数はエラーにする", () => {
  for (const v of ["0", "1.5", "abc", "-100"]) {
    assert.ok(!parseCompensationItems(["A"], [v], [""]).ok, v);
  }
});

test("内訳が1行もないときはエラーにする", () => {
  assert.ok(!parseCompensationItems([""], [""], [""]).ok);
  assert.ok(!parseCompensationItems([], [], []).ok);
});
