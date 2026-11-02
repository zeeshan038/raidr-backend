import Joi from "joi";

export const ValidateReferralSchema = (payload) => {
  const schema = Joi.object({
    inviteCode: Joi.string().trim().max(128).optional(),
    invite_code: Joi.string().trim().max(128).optional(),
  })
    .or("inviteCode", "invite_code")
    .messages({
      "object.missing": "Invite code is required",
    })
    .unknown(false);

  return schema.validate(payload);
};
