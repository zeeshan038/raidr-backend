import Joi from "joi";

export const CreateB2bZoneSchema = (payload) => {
  const schema = Joi.object({
    name: Joi.string().required(),
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
    radius: Joi.number().integer().min(10).optional(),
    city: Joi.string().optional().allow("", null),
    country: Joi.string().optional().allow("", null),
    imageUrl: Joi.string().uri().optional().allow("", null),
    holdDurationHours: Joi.number().integer().valid(24, 48, 72).required(),
    b2bRewardType: Joi.string()
      .valid("DIGITAL_COUPON", "PHYSICAL", "CASH")
      .required(),
    b2bRewardTitle: Joi.string().required(),
    b2bRewardDescription: Joi.string().optional().allow("", null),
    b2bRewardImageUrl: Joi.string().uri().optional().allow("", null),
    b2bRewardRedemptionCode: Joi.string().optional().allow("", null),
    brandLogoUrl: Joi.string().uri().optional().allow("", null),
    eligibilityNote: Joi.string().optional().allow("", null),
    minOwnedZonesRequired: Joi.number().integer().min(0).optional(),
    coinsPerHour: Joi.number().integer().min(0).optional(),
  }).unknown(false);

  return schema.validate(payload);
};

export const UpdateB2bZoneSchema = (payload) => {
  const schema = Joi.object({
    name: Joi.string().optional(),
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional(),
    radius: Joi.number().integer().min(10).optional(),
    city: Joi.string().optional().allow("", null),
    country: Joi.string().optional().allow("", null),
    imageUrl: Joi.string().uri().optional().allow("", null),
    holdDurationHours: Joi.number().integer().valid(24, 48, 72).optional(),
    b2bRewardType: Joi.string()
      .valid("DIGITAL_COUPON", "PHYSICAL", "CASH")
      .optional(),
    b2bRewardTitle: Joi.string().optional(),
    b2bRewardDescription: Joi.string().optional().allow("", null),
    b2bRewardImageUrl: Joi.string().uri().optional().allow("", null),
    b2bRewardRedemptionCode: Joi.string().optional().allow("", null),
    brandLogoUrl: Joi.string().uri().optional().allow("", null),
    eligibilityNote: Joi.string().optional().allow("", null),
    minOwnedZonesRequired: Joi.number().integer().min(0).optional(),
    coinsPerHour: Joi.number().integer().min(0).optional(),
  })
    .min(1)
    .unknown(false);

  return schema.validate(payload);
};

export const B2bAiDraftSchema = (payload) => {
  const schema = Joi.object({
    prompt: Joi.string().min(10).required(),
  }).unknown(false);

  return schema.validate(payload);
};
