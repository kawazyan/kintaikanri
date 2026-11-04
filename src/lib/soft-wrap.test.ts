import test from "node:test";
import assert from "node:assert/strict";
import { softWrap } from "./soft-wrap";

test("収まる文字列はそのまま", () => {
  assert.equal(softWrap("業務委託費", 13), "業務委託費");
  assert.equal(softWrap("交通費相当額（税込1100円）", 13), "交通費相当額（税込1100円）");
});

test("長い項目名は、開き括弧の手前で改行する(OSUPLUSの交通費)", () => {
  assert.equal(softWrap("他店応援稼働時交通費(六町〜池上・往復)", 13), "他店応援稼働時交通費\n(六町〜池上・往復)");
});

test("括弧がない長い文字列は、幅で改行する", () => {
  assert.equal(softWrap("あいうえおかきくけこさしすせそ", 13), "あいうえおかきくけこさしす\nせそ");
});

test("行頭に句読点・閉じ括弧・〜が来ないようにする", () => {
  const out = softWrap("あいうえおかきくけこさしす、せそ", 13);
  assert.ok(!out.split("\n").some((l) => /^[、。）)〜・]/.test(l)), out);
});

test("すでにある改行は残し、各行を別々に折り返す", () => {
  assert.equal(softWrap("交通費相当額\n六町", 13), "交通費相当額\n六町");
  assert.equal(softWrap("あ\n他店応援稼働時交通費(六町〜池上・往復)", 13), "あ\n他店応援稼働時交通費\n(六町〜池上・往復)");
});

test("半角は0.5で数える", () => {
  assert.equal(softWrap("abcdefghijklmnopqrstuvwxyz", 13), "abcdefghijklmnopqrstuvwxyz");
  assert.equal(softWrap("abcdefghijklmnopqrstuvwxyzA", 13), "abcdefghijklmnopqrstuvwxyz\nA");
});

test("空文字・改行だけでも壊れない", () => {
  assert.equal(softWrap("", 13), "");
  assert.equal(softWrap("\n", 13), "\n");
});

