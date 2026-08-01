import Joi from "joi";

//Register
export const RegisterSchema = (payload) => {
    const schema = Joi.object({
        email: Joi.string().email().required().messages({
            'any.required': 'Email is required',
            'string.empty': 'Email cannot be empty',
            'string.email': 'Email must be a valid email'
        }),
        password: Joi.string().required().messages({
            'any.required': 'Password is required',
            'string.empty': 'Password cannot be empty'
        }),
        name: Joi.string().messages({
            'any.required': 'Name is required',
            'string.empty': 'Name cannot be empty'
        }),
        businessName: Joi.string().messages({
            'any.required': 'Business name is required',
            'string.empty': 'Business name cannot be empty'
        }),
        category: Joi.string().messages({
            'any.required': 'Category is required',
            'string.empty': 'Category cannot be empty'
        }),
        address: Joi.string().required().messages({
            'any.required': 'Address is required',
            'string.empty': 'Address cannot be empty'
        }),
        defaultRadiusMeter: Joi.number().optional(),
        phone: Joi.string().allow('').optional(),
        photoUrl: Joi.string().allow('').optional(),
    }).unknown(false);

    return schema.validate(payload);
}

//Login 
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

//Update User
export const UpdateUserSchema = (payload) => {
    const schema = Joi.object({
        name: Joi.string().required().messages({
            'any.required': 'Owner Name is required',
            'string.empty': 'Owner Name cannot be empty'
        }),
        email: Joi.string().email().required().messages({
            'string.email': 'Invalid email format',
            'any.required': 'Email is required',
            'string.empty': 'Email cannot be empty'
        }),
        phone: Joi.string().allow('').optional()
    }).unknown(false);

    return schema.validate(payload);
}

//Update Business
export const UpdateBusinessSchema = (payload) => {
    const schema = Joi.object({
        businessName: Joi.string().required().messages({
            'any.required': 'Business Name is required',
            'string.empty': 'Business Name cannot be empty'
        }),
        address: Joi.string().required().messages({
            'any.required': 'Business Address is required',
            'string.empty': 'Business Address cannot be empty'
        })
    }).unknown(false);

    return schema.validate(payload);
}

//Change Password
export const ChangePasswordSchema = (payload) => {
    const schema = Joi.object({
        currentPassword: Joi.string().required().messages({
            'any.required': 'Current Password is required',
            'string.empty': 'Current Password cannot be empty'
        }),
        newPassword: Joi.string().min(6).required().messages({
            'string.min': 'New Password must be at least 6 characters long',
            'any.required': 'New Password is required',
            'string.empty': 'New Password cannot be empty'
        }),
        confirmPassword: Joi.any().valid(Joi.ref('newPassword')).required().messages({
            'any.only': 'Confirm Password does not match New Password',
            'any.required': 'Confirm Password is required'
        })
    }).unknown(false);

    return schema.validate(payload);
}