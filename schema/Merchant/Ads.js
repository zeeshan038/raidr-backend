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
     city: Joi.string().required().messages({
        'string.empty': 'City is required',
        'any.required': 'City is required',
     }),
     latitude: Joi.number().required().messages({
        'number.empty': 'Latitude is required',
        'any.required': 'Latitude is required',
     }),
     longitude: Joi.number().required().messages({
        'number.empty': 'Longitude is required',
        'any.required': 'Longitude is required',
     }),
     mysteryBoxReward: Joi.number().required().messages({
        'number.empty': 'Mystery box reward is required',
        'any.required': 'Mystery box reward is required',
     }),
    }).unknown(false);
    
    return schema.validate(payload);
}





//Update Ad
export const MerchantAdsUpdateSchema = (payload) => {
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
        city: Joi.string().required().messages({
            'string.empty': 'City is required',
            'any.required': 'City is required',
        }),
        latitude: Joi.number().required().messages({
            'number.empty': 'Latitude is required',
            'any.required': 'Latitude is required',
        }),
        longitude: Joi.number().required().messages({
            'number.empty': 'Longitude is required',
            'any.required': 'Longitude is required',
        }),
        mysteryBoxReward: Joi.number().required().messages({
            'number.empty': 'Mystery box reward is required',
            'any.required': 'Mystery box reward is required',
        }),
    }).unknown(false);

    return schema.validate(payload);
}
