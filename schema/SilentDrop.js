import Joi from "joi";
import { LIVE_EVENT_COLLECTION } from "../utils/liveEventModes.js";

export const SilentDropCreateSchema = (payload) => {
  const schema = Joi.object({
    merchantId: Joi.string().uuid().optional(),
    title: Joi.string().required(),
    description: Joi.string().required(),
    address: Joi.string().optional().allow(""),
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
    startTime: Joi.date().required(),
    endTime: Joi.date().required(),
    reward: Joi.string().required(),
    rewardQuantity: Joi.number().integer().min(1).required(),
    imageUrl: Joi.string().optional().allow(""),
    commanderAvatar: Joi.string().optional().allow(""),
    collectionMethod: Joi.string()
      .valid(LIVE_EVENT_COLLECTION.GPS_INSTANT, LIVE_EVENT_COLLECTION.BUSINESS_QR)
      .default(LIVE_EVENT_COLLECTION.GPS_INSTANT),
    collectRadiusM: Joi.number().integer().min(5).max(500).optional(),
  }).unknown(false);

  return schema.validate(payload);
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
    status: Joi.string()
      .valid("scheduled", "live", "completed", "cancelled")
      .optional(),
  }).unknown(false);

  return schema.validate(payload);
};
