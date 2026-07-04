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