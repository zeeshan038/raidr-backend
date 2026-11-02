import Joi from "joi";

/** UUID or admin seed slug (e.g. male, 25_34, fashion). */
const profileOptionRef = Joi.string().trim().min(1);

export const SaveProfilePreferencesSchema = (payload) => {
  const schema = Joi.object({
    homeAddress: Joi.string().trim().min(1).required().messages({
      "any.required": "Home address is required",
      "string.empty": "Home address is required",
    }),
    homeCityLabel: Joi.string().trim().min(1).required().messages({
      "any.required": "Home city is required",
      "string.empty": "Home city is required",
    }),
    homeLatitude: Joi.number().optional(),
    homeLongitude: Joi.number().optional(),
    genderOptionId: profileOptionRef.optional(),
    ageRangeOptionId: profileOptionRef.optional(),
    raidCityOptionIds: Joi.array().items(profileOptionRef).optional(),
    interestOptionIds: Joi.array().items(profileOptionRef).optional(),
  }).unknown(false);

  return schema.validate(payload);
};

export const UpdateProfilePreferencesSchema = (payload) => {
  const schema = Joi.object({
    homeAddress: Joi.string().trim().min(1).optional(),
    homeCityLabel: Joi.string().trim().min(1).optional(),
    homeLatitude: Joi.number().optional(),
    homeLongitude: Joi.number().optional(),
    genderOptionId: profileOptionRef.optional(),
    ageRangeOptionId: profileOptionRef.optional(),
    raidCityOptionIds: Joi.array().items(profileOptionRef).optional(),
    interestOptionIds: Joi.array().items(profileOptionRef).optional(),
  })
    .unknown(false)
    .min(1)
    .messages({
      "object.min": "At least one field is required to update",
    });

  return schema.validate(payload);
};

export const AdminProfileOptionCreateSchema = (payload) => {
  const schema = Joi.object({
    type: Joi.string().valid("RAID_CITY", "INTEREST", "GENDER", "AGE_RANGE").required(),
    label: Joi.string().trim().min(1).required(),
    subtitle: Joi.string().allow("", null).optional(),
    iconKey: Joi.string().allow("", null).optional(),
    accentColor: Joi.string().allow("", null).optional(),
    slug: Joi.string().allow("", null).optional(),
    sortOrder: Joi.number().integer().optional(),
    isActive: Joi.boolean().optional(),
  }).unknown(false);

  return schema.validate(payload);
};

export const AdminProfileOptionUpdateSchema = (payload) => {
  const schema = Joi.object({
    type: Joi.string().valid("RAID_CITY", "INTEREST", "GENDER", "AGE_RANGE").optional(),
    label: Joi.string().trim().min(1).optional(),
    subtitle: Joi.string().allow("", null).optional(),
    iconKey: Joi.string().allow("", null).optional(),
    accentColor: Joi.string().allow("", null).optional(),
    slug: Joi.string().allow("", null).optional(),
    sortOrder: Joi.number().integer().optional(),
    isActive: Joi.boolean().optional(),
  }).unknown(false);

  return schema.validate(payload);
};
