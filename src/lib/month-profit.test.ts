import { test } from "node:test";
import assert from "node:assert/strict";
import { adCostOf, latestSent } from "@/lib/month-profit";

const inv = (o: Partial<Parameters<typeof latestSent>[0][number]>) => ({ clientId: "c", kind: "WORK", branch: null, invoiceNumber: "KJ-202610-1", revision: 1, yearMonth: "2026-10", subtotalExTax: 100, totalInclTax: 110, statement: null, ...o });

test("訂正版があるときは送付済みの一番新しい版だけ数える", () => {
  const r = latestSent([inv({ revision: 1, subtotalExTax: 100 }), inv({ revision: 2, subtotalExTax: 150 }), inv({ clientId: "d", subtotalExTax: 70 })]);
  assert.deepEqual(r.map((x) => x.subtotalExTax).sort(), [150, 70]);
});

test("別途請求は請求番号の系列ごと、店舗ごとの請求は店舗ごとに数える", () => {
  const r = latestSent([
    inv({ kind: "EXTRA", invoiceNumber: "KJ-202610-X1" }),
    inv({ kind: "EXTRA", invoiceNumber: "KJ-202610-X2" }),
    inv({ branch: "A" }),
    inv({ branch: "B" }),
  ]);
  assert.equal(r.length, 4);
});

test("広告費は店舗・期間のある行だけ", () => {
  assert.equal(adCostOf({ clientExtras: [{ label: "a", store: "s", period: "p", amountExTax: 500 }, { label: "新幹線", amountExTax: 300 }] }), 500);
});
