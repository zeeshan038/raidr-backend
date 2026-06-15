import Joi from 'joi';


export const PlanYourTripSchema = (payload) => {
    const schema = Joi.object({
    destination: Joi.string().required().messages({
            'any.required': 'Destination is required',
            'string.empty': 'Destination cannot be empty'
        }),
        hotelLocation: Joi.string().required().messages({
            'any.required': 'Hotel Location is required',
            'string.empty': 'Hotel Location cannot be empty'
        }),
        tripDates: Joi.array().items(Joi.date()).required().messages({
            'any.required': 'Trip Dates are required',
            'array.empty': 'Trip Dates cannot be empty'
        }),
        radiusKm: Joi.number().required().messages({
            'any.required': 'Radius is required',
            'number.base': 'Radius must be a number'
        }),
        travelWith: Joi.array().items(Joi.string()).required().messages({
            'any.required': 'Travel With is required',
            'array.empty': 'Travel With cannot be empty'
        }),
        interestedVibes: Joi.array().items(Joi.string()).required().messages({
            'any.required': 'Interested Vibes are required',
            'array.empty': 'Interested Vibes cannot be empty'
        }),
        imageUrls: Joi.array().items(Joi.string()).required().messages({
            'any.required': 'Image URLs are required',
            'array.empty': 'Image URLs cannot be empty'
        })
    }).unknown(false);
    
    return schema.validate(payload);
}