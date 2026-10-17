import test from "node:test";
import assert from "node:assert/strict";
import { transferRequestMessage } from "./transfer-request-notify";

test("通知文: スタッフ名・申請額・希望振込日・申請日時・一覧URL", () => {
  const m = transferRequestMessage({ staffName: "加藤　柊", amount: 12000, desiredDate: "2026-10-20", requestedAt: new Date("2026-10-17T05:49:00Z") });
  assert.match(m, /^【振込申請】/);
  assert.match(m, /加藤 柊さん/);
  assert.match(m, /申請額: ¥12,000/);
  assert.match(m, /希望振込日: 2026-10-20/);
  assert.match(m, /2026\/10\/17/);
  assert.match(m, /admin\/payments/);
});
