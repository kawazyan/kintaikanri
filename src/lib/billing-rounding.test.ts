import { test } from "node:test";
import assert from "node:assert/strict";
import { computeInvoiceTotals, taxOnSubtotal } from "./billing";

test("通常は消費税を切り捨て", () => {
  assert.equal(taxOnSubtotal(1749), 174);
  assert.deepEqual(computeInvoiceTotals([{ quantity: 1, unitPriceExTax: 1749 }]), { subtotalExTax: 1749, taxAmount: 174, totalInclTax: 1923 });
});

test("HALF_UP指定の請求書は消費税を四捨五入(交通費 税込962円×2 = 1,924円)", () => {
  assert.deepEqual(computeInvoiceTotals([{ quantity: 1, unitPriceExTax: 1749 }], "HALF_UP"), { subtotalExTax: 1749, taxAmount: 175, totalInclTax: 1924 });
  assert.equal(taxOnSubtotal(481749, "HALF_UP"), 48175);
  assert.equal(taxOnSubtotal(480000, "HALF_UP"), 48000);
});
