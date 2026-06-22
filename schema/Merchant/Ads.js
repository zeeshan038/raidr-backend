import Joi from 'joi';


//Create Ad
export const MerchantAdsCreateSchema = (payload) => {
    const schema = Joi.object({
     adTitle: Joi.string().required().messages({
        'string.empty': 'Ad title is required',
        'any.required': 'Ad title is required',
     }),
     adCategory: Joi.string().required().messages({
        'string.empty': 'Ad category is required',
        'any.required': 'Ad category is required',
     }),
     address: Joi.string().required().messages({
        'string.empty': 'Address is required',
        'any.required': 'Address is required',
     }),
     city: Joi.string().optional().allow(''),
     country: Joi.string().optional().allow(''),
     latitude: Joi.number().required().messages({
        'number.base': 'Latitude must be a number',
        'any.required': 'Latitude is required',
     }),
     longitude: Joi.number().required().messages({
        'number.base': 'Longitude must be a number',
        'any.required': 'Longitude is required',
     }),
     mysteryBoxReward: Joi.string().required().messages({
        'string.empty': 'Mystery box reward is required',
        'any.required': 'Mystery box reward is required',
     }),
     stockLimit: Joi.number().required().messages({
        'number.base': 'Stock limit must be a number',
        'any.required': 'Stock limit is required',
     }),
     adImage: Joi.string().required().messages({
        'string.empty': 'Ad image is required',
        'any.required': 'Ad image is required',
     }),
     descriptionText: Joi.string().optional().allow(''),
     categoryName: Joi.string().required().messages({
        'string.empty': 'Location category is required',
        'any.required': 'Location category is required',
     }),
     logoUrl: Joi.string().optional().allow(''),
     isActive: Joi.boolean().optional()
    }).unknown(true);
    
    return schema.validate(payload);
}



//Update Ad
export const MerchantAdsUpdateSchema = (payload) => {
    const schema = Joi.object({
        adTitle: Joi.string().optional().allow(''),
        adCategory: Joi.string().optional().allow(''),
        address: Joi.string().optional().allow(''),
        city: Joi.string().optional().allow(''),
        country: Joi.string().optional().allow(''),
        latitude: Joi.number().optional(),
        longitude: Joi.number().optional(),
        mysteryBoxReward: Joi.string().optional().allow(''),
        stockLimit: Joi.number().optional(),
        adImage: Joi.string().optional().allow(''),
        descriptionText: Joi.string().optional().allow(''),
        categoryName: Joi.string().optional().allow(''),
        logoUrl: Joi.string().optional().allow(''),
        isActive: Joi.boolean().optional(),
        radius: Joi.number().optional()
    }).unknown(true);

    return schema.validate(payload);
}
