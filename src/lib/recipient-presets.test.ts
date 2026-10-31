import test from "node:test";
import assert from "node:assert/strict";
import { recipientPresetsOf } from "./billing-terms";

test("店舗ごとの宛先を、名前とアドレスつきで取り出す", () => {
  const r = recipientPresetsOf({
    recipientPresets: [
      { label: "SB秋田山王店", emails: ["sbakitasannou@cosmonet.ne.jp", "r_ishizawa@cosmonet.ne.jp"] },
      { label: "SBフレスポ富沢店", emails: ["t-miyasaka@cosmonet.ne.jp", "r_ishizawa@cosmonet.ne.jp"] },
    ],
  });
  assert.equal(r.length, 2);
  assert.deepEqual(r[1].emails, ["t-miyasaka@cosmonet.ne.jp", "r_ishizawa@cosmonet.ne.jp"]);
});

test("メール形式でないもの・重複・名前なし・アドレスなしは除く", () => {
  const r = recipientPresetsOf({
    recipientPresets: [
      { label: "A店", emails: ["a@x.example", "A@X.EXAMPLE", "not-an-email", " "] },
      { label: " ", emails: ["b@x.example"] },
      { label: "C店", emails: [] },
    ],
  });
  assert.deepEqual(r, [{ label: "A店", emails: ["a@x.example"] }]);
});

test("登録がなければ空になる", () => {
  assert.deepEqual(recipientPresetsOf(null), []);
  assert.deepEqual(recipientPresetsOf({}), []);
});
