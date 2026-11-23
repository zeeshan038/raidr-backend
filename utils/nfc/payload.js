import crypto from "crypto";
import {
  NFC_URI_HOST,
  NFC_URI_SCHEME,
  NFC_URI_VERSION,
} from "./constants.js";

/**
 * Generate an opaque token for embedding in an NFC tag.
 */
export const createNfcToken = () =>
  crypto.randomBytes(16).toString("base64url");

/**
 * Canonical URI written to the tag (Flutter / OS NDEF URI record).
 * Example: raidr://nfc/v1?token=abc
 */
export const buildNfcPayloadUri = ({ token, merchantId } = {}) => {
  if (!token) {
    throw new Error("token is required to build NFC payload");
  }
  const params = new URLSearchParams({ token: String(token) });
  if (merchantId) {
    params.set("merchantId", String(merchantId));
  }
  return `${NFC_URI_SCHEME}://${NFC_URI_HOST}/${NFC_URI_VERSION}?${params.toString()}`;
};

/**
 * Accepts Flutter body shapes:
 * - { payload: "raidr://nfc/v1?token=..." }
 * - { token: "..." }
 * - raw string URI / token
 */
export const parseNfcPayload = (input) => {
  if (input == null) {
    return { ok: false, error: "NFC payload is required" };
  }

  let raw = input;
  if (typeof input === "object") {
    raw = input.payload ?? input.uri ?? input.token ?? input.nfcPayload ?? null;
  }

  if (raw == null || String(raw).trim() === "") {
    return { ok: false, error: "NFC payload is required" };
  }

  const text = String(raw).trim();

  // Plain token (no scheme)
  if (!text.includes("://") && !text.includes("?")) {
    return { ok: true, token: text, merchantId: null, raw: text };
  }

  try {
    const normalized = text.replace(/^raidr:\/\//i, "https://");
    const url = new URL(normalized);
    const token =
      url.searchParams.get("token") ||
      url.pathname.split("/").filter(Boolean).pop() ||
      null;
    const merchantId = url.searchParams.get("merchantId");

    if (!token) {
      return { ok: false, error: "NFC payload missing token" };
    }

    return {
      ok: true,
      token: String(token),
      merchantId: merchantId || null,
      raw: text,
    };
  } catch {
    return { ok: false, error: "Invalid NFC payload format" };
  }
};

export const formatTagForClient = (tag, { includeMerchant = false } = {}) => {
  if (!tag) return null;
  const payloadUri = buildNfcPayloadUri({
    token: tag.token,
    merchantId: tag.merchantId,
  });
  return {
    id: tag.id,
    merchantId: tag.merchantId,
    label: tag.label,
    token: tag.token,
    chipUid: tag.chipUid ?? null,
    isActive: tag.isActive,
    payloadUri,
    /** Short instruction for programming the physical tag */
    programmingHint: `Write URI NDEF record: ${payloadUri}`,
    createdAt: tag.createdAt,
    ...(includeMerchant && tag.merchant
      ? {
          merchant: {
            id: tag.merchant.id,
            name: tag.merchant.name,
            businessName: tag.merchant.businessName,
          },
        }
      : {}),
  };
};
