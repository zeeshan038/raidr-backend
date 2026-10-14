import Joi from "joi";

export const CreateZoneSchema = (payload) => {
    const schema = Joi.object({
        name: Joi.string().required().messages({
            'any.required': 'Name is required',
            'string.empty': 'Name cannot be empty'
        }),
        latitude: Joi.number().required().messages({
            'any.required': 'Latitude is required',
            'number.base': 'Latitude must be a number'
        }),
        longitude: Joi.number().required().messages({
            'any.required': 'Longitude is required',
            'number.base': 'Longitude must be a number'
        }),
        radius: Joi.number().optional().messages({
            'number.base': 'Radius must be a number'
        }),
        isActive: Joi.boolean().optional().messages({
            'boolean.base': 'isActive must be a boolean'
        }),
        city: Joi.string().optional().allow("").allow(null),
        country: Joi.string().optional().allow("").allow(null),
        coinsPerHour: Joi.number().optional().messages({
            'number.base': 'coinsPerHour must be a number'
        })
    }).unknown(false);

    return schema.validate(payload);
};

export const UpdateZoneSchema = (payload) => {
    const schema = Joi.object({
        name: Joi.string().optional(),
        latitude: Joi.number().optional(),
        longitude: Joi.number().optional(),
        radius: Joi.number().optional(),
        isActive: Joi.boolean().optional(),
        city: Joi.string().optional().allow("").allow(null),
        country: Joi.string().optional().allow("").allow(null),
        coinsPerHour: Joi.number().optional()
    }).unknown(false);

    return schema.validate(payload);
};

export const UpdateGameConfigSchema = (payload) => {
    const schema = Joi.object({
        baseCaptureTimeSec: Joi.number().integer().min(5).optional(),
        shieldDurationMin: Joi.number().integer().min(1).optional(),
        ownershipDefenseSecPerDay: Joi.number().integer().min(0).optional(),
        secondsPerGuard: Joi.number().integer().min(0).optional(),
        maxGuardsPerZone: Joi.number().integer().min(0).optional(),
        guardPurchaseCoinPrice: Joi.number().integer().min(0).optional(),
        guardEliminationCoinPrice: Joi.number().integer().min(0).optional(),
        empireVipMinOwnedZones: Joi.number().integer().min(0).optional(),
        vipRewardMultiplier: Joi.number().min(1).optional(),
        rivalryMilestoneHours: Joi.array().items(Joi.number().integer().min(1)).optional(),
        allowedHoldDurationHours: Joi.array().items(Joi.number().integer().valid(24, 48, 72)).optional(),
        shieldWarningMinutesBefore: Joi.number().integer().min(1).optional(),
        maxOwnedZonesPerPlayer: Joi.number().integer().min(1).allow(null).optional(),
        dailyDropXpNormal: Joi.number().integer().min(0).optional(),
        dailyDropXpRare: Joi.number().integer().min(0).optional(),
    }).unknown(false);

    return schema.validate(payload);
};
