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
        defaultRadiusMeter: Joi.number().messages({
            'any.required': 'Default radius is required',
            'number.base': 'Default radius must be a number'
        }),
        phone: Joi.string().messages({
            'any.required': 'Phone is required',
            'string.empty': 'Phone cannot be empty'
        }),
        photoUrl: Joi.string().messages({
            'any.required': 'Photo URL is required',
            'string.empty': 'Photo URL cannot be empty'
        }),
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