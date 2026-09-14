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
        coinsPerHour: Joi.number().optional()
    }).unknown(false);

    return schema.validate(payload);
};
