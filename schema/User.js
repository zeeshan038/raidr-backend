import Joi from "joi";

export const RegisterSchema = (payload) => {
    const schema = Joi.object({
        name: Joi.string().required().messages({
            'any.required': 'Name is required',
            'string.empty': 'Name cannot be empty'
        }),
        email: Joi.string().email().required().messages({
            'string.email': 'Invalid email format',
            'any.required': 'Email is required',
            'string.empty': 'Email cannot be empty'
        }),
        password: Joi.string().min(6).required().messages({
            'string.min': 'Password must be at least 6 characters long',
            'any.required': 'Password is required',
            'string.empty': 'Password cannot be empty'
        })
    }).unknown(false);

    return schema.validate(payload);
}


export const LoginSchema = (payload) => {
    const schema = Joi.object({
        email: Joi.string().email().required().messages({
            'string.email': 'Invalid email format',
            'any.required': 'Email is required',
            'string.empty': 'Email cannot be empty'
        }),
        password: Joi.string().min(6).required().messages({
            'string.min': 'Password must be at least 6 characters long',
            'any.required': 'Password is required',
            'string.empty': 'Password cannot be empty'
        })
    }).unknown(false);

    return schema.validate(payload);
}


export const UpdateSchema = (payload) => {
    const schema = Joi.object({
        name: Joi.string().optional(),
        email: Joi.string().email().optional().messages({
            'string.email': 'Invalid email format'
        }),
        password: Joi.string().min(6).optional().messages({
            'string.min': 'Password must be at least 6 characters long'
        }),
        avatarFrontUrl: Joi.string().allow('').optional(),
        avatarBackUrl: Joi.string().allow('').optional(),
        selectedAvatarId: Joi.string().allow('').optional(),
        level: Joi.number().optional(),
        xp_earned: Joi.number().optional(),
        xp_progress: Joi.number().optional(),
        green_boxes_count: Joi.number().optional(),
        golden_boxes_count: Joi.number().optional(),
        purple_boxes_count: Joi.number().optional(),
        distance_covered_km: Joi.number().optional(),
        has_seen_level_welcome: Joi.boolean().optional(),
        fcmTokens: Joi.array().items(Joi.string()).optional()
    }).unknown(false);

    return schema.validate(payload);
}

export const ForgotPasswordSchema = (payload) => {
    const schema = Joi.object({
        email: Joi.string().email().required().messages({
            'string.email': 'Invalid email format',
            'any.required': 'Email is required',
            'string.empty': 'Email cannot be empty'
        })
    }).unknown(false);

    return schema.validate(payload);
}

export const ResetPasswordSchema = (payload) => {
    const schema = Joi.object({
        email: Joi.string().email().required().messages({
            'string.email': 'Invalid email format',
            'any.required': 'Email is required',
            'string.empty': 'Email cannot be empty'
        }),
        newPassword: Joi.string().min(6).required().messages({
            'string.min': 'Password must be at least 6 characters long',
            'any.required': 'New Password is required',
            'string.empty': 'New Password cannot be empty'
        })
    }).unknown(false);

    return schema.validate(payload);
}