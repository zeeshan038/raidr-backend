import {
  NFC_RECEIPT_COINS_PER_ILS,
  NFC_RECEIPT_MAX_AMOUNT_ILS,
  NFC_RECEIPT_MAX_COINS,
  NFC_RECEIPT_MAX_XP,
  NFC_RECEIPT_MIN_AMOUNT_ILS,
  NFC_RECEIPT_TZ,
  NFC_RECEIPT_XP_PER_ILS,
} from "./constants.js";

/** Calendar YYYY-MM-DD in a given IANA timezone. */
export const calendarDayKeyInTz = (date = new Date(), timeZone = NFC_RECEIPT_TZ) => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
};

export const buildReceiptFingerprint = ({ merchantId, dateKey, amountIls }) => {
  const cents = Math.round(Number(amountIls) * 100);
  return `${merchantId}|${dateKey}|${cents}`;
};

export const computeReceiptBonus = (amountIls) => {
  const amount = Number(amountIls);
  if (!Number.isFinite(amount)) {
    return { ok: false, error: "Invalid amount" };
  }
  if (amount < NFC_RECEIPT_MIN_AMOUNT_ILS) {
    return {
      ok: false,
      error: `Purchase total must be at least ₪${NFC_RECEIPT_MIN_AMOUNT_ILS}`,
    };
  }
  if (amount > NFC_RECEIPT_MAX_AMOUNT_ILS) {
    return {
      ok: false,
      error: `Purchase total looks too high (max ₪${NFC_RECEIPT_MAX_AMOUNT_ILS})`,
    };
  }

  const coinsAwarded = Math.min(
    NFC_RECEIPT_MAX_COINS,
    Math.max(0, Math.floor(amount * NFC_RECEIPT_COINS_PER_ILS))
  );
  const xpAwarded = Math.min(
    NFC_RECEIPT_MAX_XP,
    Math.max(0, Math.floor(amount * NFC_RECEIPT_XP_PER_ILS))
  );

  return { ok: true, coinsAwarded, xpAwarded, amountIls: Math.round(amount * 100) / 100 };
};

/**
 * Receipt printed date must be "today" in merchant market timezone.
 * Accepts AI date key (YYYY-MM-DD) compared to today in NFC_RECEIPT_TZ.
 */
export const isReceiptDateToday = (receiptDateKey, now = new Date()) => {
  if (!receiptDateKey || typeof receiptDateKey !== "string") return false;
  const today = calendarDayKeyInTz(now);
  return receiptDateKey === today;
};
