import Joi from "joi";

export const UpdateNotificationPrefsSchema = (payload) => {
  const schema = Joi.object({
    masterEnabled: Joi.boolean().optional(),
    dailyDropReminders: Joi.boolean().optional(),
    rareDropAlerts: Joi.boolean().optional(),
    raidZoneShield: Joi.boolean().optional(),
    zoneAttackSnatch: Joi.boolean().optional(),
    b2bRivalryNearby: Joi.boolean().optional(),
    rewardsVoucher: Joi.boolean().optional(),
    eventsCoinRush: Joi.boolean().optional(),
    promotionalSponsored: Joi.boolean().optional(),
  }).unknown(false);

  return schema.validate(payload);
};
