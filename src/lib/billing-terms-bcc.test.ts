import test from "node:test";
import assert from "node:assert/strict";
import { confirmBccFor } from "./billing-terms";

test("設定なしなら空", () => assert.deepEqual(confirmBccFor({}, ["a@x.jp"], []), []));
test("設定のアドレスをBCCにする", () =>
  assert.deepEqual(confirmBccFor({ confirmBcc: ["c-morita@kjgroup.info", "ch_87_ai@icloud.com"] }, ["a@x.jp"], ["keiri@kjgroup.info"]), ["c-morita@kjgroup.info", "ch_87_ai@icloud.com"]));
test("宛先・CCと重複(大文字小文字違い含む)・不正な形式・重複は除く", () =>
  assert.deepEqual(confirmBccFor({ confirmBcc: ["A@x.jp", "keiri@kjgroup.info", "bad", "b@y.jp", "B@y.jp"] }, ["a@x.jp"], ["keiri@kjgroup.info"]), ["b@y.jp"]));
