import Joi from "joi";
import { LIVE_EVENT_COLLECTION } from "../utils/liveEventModes.js";

/** Strip fields that do not apply to the chosen collection method (admin / API). */
export const normalizeSilentDropCreateBody = (body = {}) => {
  const method =
    body.collectionMethod === LIVE_EVENT_COLLECTION.BUSINESS_QR
      ? LIVE_EVENT_COLLECTION.BUSINESS_QR
      : LIVE_EVENT_COLLECTION.GPS_INSTANT;
  const next = { ...body, collectionMethod: method };
  if (method === LIVE_EVENT_COLLECTION.GPS_INSTANT) {
    delete next.merchantId;
    delete next.reward;
  } else {
    delete next.coinReward;
  }
  return next;
};

export const SilentDropCreateSchema = (payload) => {
  const schema = Joi.object({
    collectionMethod: Joi.string()
      .valid(LIVE_EVENT_COLLECTION.GPS_INSTANT, LIVE_EVENT_COLLECTION.BUSINESS_QR)
      .default(LIVE_EVENT_COLLECTION.GPS_INSTANT),
    merchantId: Joi.string().uuid().optional().allow(null, ""),
    title: Joi.string().required(),
    description: Joi.string().required(),
    address: Joi.string().optional().allow(""),
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
    startTime: Joi.date().required(),
    endTime: Joi.date().required(),
    reward: Joi.string().optional().allow(""),
    rewardQuantity: Joi.number().integer().min(1).required(),
    imageUrl: Joi.string().optional().allow(""),
    commanderAvatar: Joi.string().optional().allow(""),
    collectRadiusM: Joi.number().integer().min(5).max(500).optional(),
    coinReward: Joi.number().integer().min(1).max(100000).optional().allow(null),
  })
    .unknown(false)
    .custom((value, helpers) => {
      const method = value.collectionMethod ?? LIVE_EVENT_COLLECTION.GPS_INSTANT;
      if (method === LIVE_EVENT_COLLECTION.BUSINESS_QR) {
        if (!value.merchantId) {
          return helpers.message(
            "Restaurant is required for Method 2 — select a merchant, or use Method 1 (street / park coins)."
          );
        }
        if (!value.reward?.trim()) {
          return helpers.message("Partner reward label is required for restaurant QR drops.");
        }
        delete value.coinReward;
      } else {
        if (value.coinReward == null || value.coinReward < 1) {
          return helpers.message("Coins per collect is required for Method 1 (GPS street drops).");
        }
        delete value.merchantId;
        delete value.reward;
      }
      return value;
    }, "silent drop method rules");

  return schema.validate(payload, { abortEarly: false });
};

/** Merchant portal — in-store QR drops only (Method 2). Merchant id comes from auth, not the form. */
export const SilentDropMerchantCreateSchema = (payload, merchantIdFromAuth) => {
  const { coinReward: _coinReward, collectionMethod: _method, ...rest } = payload ?? {};
  return SilentDropCreateSchema({
    ...rest,
    collectionMethod: LIVE_EVENT_COLLECTION.BUSINESS_QR,
    merchantId: merchantIdFromAuth ?? rest.merchantId,
  });
};

export const SilentDropMerchantUpdateSchema = (payload) => {
  const body = { ...(payload ?? {}) };
  delete body.collectionMethod;
  delete body.coinReward;
  return SilentDropUpdateSchema(body);
};

export const SilentDropUpdateSchema = (payload) => {
  const schema = Joi.object({
    title: Joi.string().optional(),
    description: Joi.string().optional(),
    address: Joi.string().optional().allow(""),
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional(),
    startTime: Joi.date().optional(),
    endTime: Joi.date().optional(),
    reward: Joi.string().optional(),
    rewardQuantity: Joi.number().integer().min(1).optional(),
    imageUrl: Joi.string().optional().allow(""),
    commanderAvatar: Joi.string().optional().allow(""),
    collectionMethod: Joi.string()
      .valid(LIVE_EVENT_COLLECTION.GPS_INSTANT, LIVE_EVENT_COLLECTION.BUSINESS_QR)
      .optional(),
    collectRadiusM: Joi.number().integer().min(5).max(500).optional(),
    coinReward: Joi.number().integer().min(1).max(100000).optional().allow(null),
    status: Joi.string()
      .valid("scheduled", "live", "completed", "cancelled")
      .optional(),
  }).unknown(false);

  return schema.validate(payload);
};
