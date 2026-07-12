import Joi from 'joi';

export const MerchantEventCreateSchema = (payload) => {
    const schema = Joi.object({
        title: Joi.string().required().messages({
            'string.empty': 'Event title is required',
            'any.required': 'Event title is required',
        }),
        description: Joi.string().required().messages({
            'string.empty': 'Description is required',
            'any.required': 'Description is required',
        }),
        address: Joi.string().optional().allow('').messages({
            'string.empty': 'Address is required',
            'any.required': 'Address is required',
        }),
        latitude: Joi.number().required().messages({
            'number.base': 'Latitude must be a number',
            'any.required': 'Latitude is required',
        }),
        longitude: Joi.number().required().messages({
            'number.base': 'Longitude must be a number',
            'any.required': 'Longitude is required',
        }),
        startTime: Joi.date().required().messages({
            'date.base': 'Start time must be a valid date',
            'any.required': 'Start time is required',
        }),
        endTime: Joi.date().required().messages({
            'date.base': 'End time must be a valid date',
            'any.required': 'End time is required',
        }),
        reward: Joi.string().required().messages({
            'string.empty': 'Reward is required',
            'any.required': 'Reward is required',
        }),
        rewardQuantity: Joi.number().integer().min(1).required().messages({
            'number.base': 'Reward quantity must be a number',
            'number.min': 'Reward quantity must be at least 1',
            'any.required': 'Reward quantity is required',
        }),
        size: Joi.string().valid('small', 'medium', 'large').required().messages({
            'any.only': 'Event size must be one of: small, medium, large',
            'any.required': 'Event size is required',
        }),
        commanderAvatar: Joi.string().optional().allow(''),
        imageUrl: Joi.string().optional().allow('')
    }).unknown(true);

    return schema.validate(payload);
};

export const MerchantEventUpdateSchema = (payload) => {
    const schema = Joi.object({
        title: Joi.string().optional(),
        description: Joi.string().optional(),
        address: Joi.string().optional().allow(''),
        latitude: Joi.number().optional(),
        longitude: Joi.number().optional(),
        startTime: Joi.date().optional(),
        endTime: Joi.date().optional(),
        reward: Joi.string().optional(),
        rewardQuantity: Joi.number().integer().min(1).optional(),
        commanderAvatar: Joi.string().optional().allow(''),
        imageUrl: Joi.string().optional().allow('')
    }).unknown(true);

    return schema.validate(payload);
};
