/** Deep-link / NDEF scheme written to physical RAIDR NFC tags. */
export const NFC_URI_SCHEME = "raidr";
export const NFC_URI_HOST = "nfc";
export const NFC_URI_VERSION = "v1";

/** Coins / XP awarded once per user+merchant per local calendar day on first successful tap. */
export const NFC_VISIT_REWARD_COINS = Number(process.env.NFC_VISIT_REWARD_COINS || 5);
export const NFC_VISIT_REWARD_XP = Number(process.env.NFC_VISIT_REWARD_XP || 15);

export const NFC_COIN_SOURCE = "nfc_visit";
