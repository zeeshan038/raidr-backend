import Joi from "joi";

//Create Avatar 
export const CreateAvatarSchema = (payload) => {
    const schema = Joi.object({
        name: Joi.string().required().messages({
            'any.required': 'Name is required',
            'string.empty': 'Name cannot be empty'
        }),
        frontUrl: Joi.string().required().messages({
            'string.email': 'Invalid frontUrl format',
            'any.required': 'FrontUrl is required',
            'string.empty': 'FrontUrl cannot be empty'
        }),
        backUrl: Joi.string().required().messages({
            'string.email': 'Invalid backUrl format',
            'any.required': 'BackUrl is required',
            'string.empty': 'BackUrl cannot be empty'
        }),
        price: Joi.number().required().messages({
            'number.base': 'Invalid price format',
            'any.required': 'Price is required',
            'number.empty': 'Price cannot be empty'
        }),
        isFeatured: Joi.boolean().optional().default(false),
        isNew: Joi.boolean().optional().default(true),
    }).unknown(true);

    return schema.validate(payload);
}

// Update Avatar
export const UpdateAvatarSchema = (payload) => {
    const schema = Joi.object({
        name: Joi.string().optional(),
        frontUrl: Joi.string().optional(),
        backUrl: Joi.string().optional(),
        price: Joi.number().optional(),
        isFeatured: Joi.boolean().optional(),
        isNew: Joi.boolean().optional()
    }).unknown(true);

    return schema.validate(payload);
}