import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReceiptFingerprint,
  calendarDayKeyInTz,
  computeReceiptBonus,
  isReceiptDateToday,
} from "../utils/nfc/receiptRewards.js";

test("computeReceiptBonus awards floor coins/xp and caps amount", () => {
  const ok = computeReceiptBonus(48.9);
  assert.equal(ok.ok, true);
  assert.equal(ok.amountIls, 48.9);
  assert.equal(ok.coinsAwarded, 48);
  assert.equal(ok.xpAwarded, 97);

  const tooSmall = computeReceiptBonus(0.5);
  assert.equal(tooSmall.ok, false);

  const tooBig = computeReceiptBonus(99999);
  assert.equal(tooBig.ok, false);
});

test("buildReceiptFingerprint is stable per merchant/day/cents", () => {
  const a = buildReceiptFingerprint({
    merchantId: "m1",
    dateKey: "2026-11-23",
    amountIls: 10.5,
  });
  const b = buildReceiptFingerprint({
    merchantId: "m1",
    dateKey: "2026-11-23",
    amountIls: 10.5,
  });
  assert.equal(a, b);
  assert.equal(a, "m1|2026-11-23|1050");
});

test("isReceiptDateToday uses Asia/Jerusalem calendar day", () => {
  const today = calendarDayKeyInTz(new Date(), "Asia/Jerusalem");
  assert.equal(isReceiptDateToday(today), true);
  assert.equal(isReceiptDateToday("1999-01-01"), false);
});
