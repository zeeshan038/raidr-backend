import Joi from "joi";
import { BRAND_MONTH_REWARD_TYPE } from "../../utils/brandMonth.js";

const rewardTypeField = Joi.string().valid(
  BRAND_MONTH_REWARD_TYPE.INLINE,
  BRAND_MONTH_REWARD_TYPE.COMMERCIAL_VOUCHER
);

const validateRewardShape = (value) => {
  if (value.rewardType === BRAND_MONTH_REWARD_TYPE.COMMERCIAL_VOUCHER) {
    if (!value.commercialVoucherId) {
      return "commercialVoucherId is required when rewardType is COMMERCIAL_VOUCHER";
    }
  } else if (value.rewardType === BRAND_MONTH_REWARD_TYPE.INLINE) {
    if (!value.rewardTitle || !value.rewardSponsorName) {
      return "rewardTitle and rewardSponsorName are required when rewardType is INLINE";
    }
  }
  return null;
};

export const CreateBrandMonthSchema = (payload) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(1).required(),
    description: Joi.string().optional().allow("", null),
    brandLogoUrl: Joi.string().uri().optional().allow("", null),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().greater(Joi.ref("startDate")).required(),
    xpTarget: Joi.number().integer().min(1).required(),
    inventoryTotal: Joi.number().integer().min(0).required(),
    rewardType: rewardTypeField.default(BRAND_MONTH_REWARD_TYPE.INLINE),
    commercialVoucherId: Joi.string().uuid().optional().allow(null),
    rewardTitle: Joi.string().optional().allow("", null),
    rewardSponsorName: Joi.string().optional().allow("", null),
    rewardDescription: Joi.string().optional().allow("", null),
    rewardImageUrl: Joi.string().uri().optional().allow("", null),
    rewardRedemptionCode: Joi.string().optional().allow("", null),
    sponsoredThemeId: Joi.string().uuid().optional().allow(null),
    isActive: Joi.boolean().optional(),
  }).unknown(false);

  const result = schema.validate(payload);
  if (result.error) {
    return result;
  }
  const shapeErr = validateRewardShape(result.value);
  if (shapeErr) {
    return { error: { message: shapeErr }, value: result.value };
  }
  return result;
};

export const UpdateBrandMonthSchema = (payload) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(1).optional(),
    description: Joi.string().optional().allow("", null),
    brandLogoUrl: Joi.string().uri().optional().allow("", null),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    xpTarget: Joi.number().integer().min(1).optional(),
    inventoryTotal: Joi.number().integer().min(0).optional(),
    inventoryRemaining: Joi.number().integer().min(0).optional(),
    rewardType: rewardTypeField.optional(),
    commercialVoucherId: Joi.string().uuid().optional().allow(null),
    rewardTitle: Joi.string().optional().allow("", null),
    rewardSponsorName: Joi.string().optional().allow("", null),
    rewardDescription: Joi.string().optional().allow("", null),
    rewardImageUrl: Joi.string().uri().optional().allow("", null),
    rewardRedemptionCode: Joi.string().optional().allow("", null),
    sponsoredThemeId: Joi.string().uuid().optional().allow(null),
    isActive: Joi.boolean().optional(),
  }).unknown(false);

  const result = schema.validate(payload);
  if (result.error) {
    return result;
  }

  if (result.value.startDate && result.value.endDate) {
    if (new Date(result.value.endDate) <= new Date(result.value.startDate)) {
      return { error: { message: "endDate must be after startDate" }, value: result.value };
    }
  }

  if (result.value.rewardType) {
    const shapeErr = validateRewardShape({
      rewardType: result.value.rewardType,
      commercialVoucherId: result.value.commercialVoucherId,
      rewardTitle: result.value.rewardTitle,
      rewardSponsorName: result.value.rewardSponsorName,
    });
    if (shapeErr) {
      return { error: { message: shapeErr }, value: result.value };
    }
  }

  return result;
};
