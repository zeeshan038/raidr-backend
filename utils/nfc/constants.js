/** Deep-link / NDEF scheme written to physical RAIDR NFC tags. */
export const NFC_URI_SCHEME = "raidr";
export const NFC_URI_HOST = "nfc";
export const NFC_URI_VERSION = "v1";

/** Coins / XP awarded once per user+merchant per local calendar day on first successful tap. */
export const NFC_VISIT_REWARD_COINS = Number(process.env.NFC_VISIT_REWARD_COINS || 5);
export const NFC_VISIT_REWARD_XP = Number(process.env.NFC_VISIT_REWARD_XP || 15);

export const NFC_COIN_SOURCE = "nfc_visit";
export const NFC_RECEIPT_COIN_SOURCE = "nfc_receipt";

/** Bonus coins/XP per ₪ on approved receipt (Phase 2). */
export const NFC_RECEIPT_COINS_PER_ILS = Number(
  process.env.NFC_RECEIPT_COINS_PER_ILS || 1
);
export const NFC_RECEIPT_XP_PER_ILS = Number(
  process.env.NFC_RECEIPT_XP_PER_ILS || 2
);
export const NFC_RECEIPT_MAX_COINS = Number(
  process.env.NFC_RECEIPT_MAX_COINS || 500
);
export const NFC_RECEIPT_MAX_XP = Number(process.env.NFC_RECEIPT_MAX_XP || 1000);
export const NFC_RECEIPT_MIN_AMOUNT_ILS = Number(
  process.env.NFC_RECEIPT_MIN_AMOUNT_ILS || 1
);
export const NFC_RECEIPT_MAX_AMOUNT_ILS = Number(
  process.env.NFC_RECEIPT_MAX_AMOUNT_ILS || 5000
);
/** How long after NFC tap a receipt may still be submitted (hours). */
export const NFC_RECEIPT_SUBMIT_WINDOW_HOURS = Number(
  process.env.NFC_RECEIPT_SUBMIT_WINDOW_HOURS || 24
);

export const NFC_RECEIPT_TZ = process.env.NFC_RECEIPT_TZ || "Asia/Jerusalem";
export const NFC_RECEIPT_VISION_MODEL =
  process.env.NFC_RECEIPT_VISION_MODEL || "gemini-2.0-flash";
