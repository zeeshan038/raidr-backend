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
        }),
        startLat: Joi.number().optional(),
        startLng: Joi.number().optional(),
        intenseMode: Joi.boolean().optional().default(false)
    }).unknown(true); // Allow unknown fields so client can send extra data if needed
    
    return schema.validate(payload);
}


export const SkipTripSchema = (payload) => {
    const schema = Joi.object({
        startLat: Joi.number().optional().messages({
            'number.base': 'startLat must be a number'
        }),
        startLng: Joi.number().optional().messages({
            'number.base': 'startLng must be a number'
        }),
        radiusKm: Joi.number().optional().messages({
            'number.base': 'radiusKm must be a number'
        }),
        intenseMode: Joi.boolean().optional().messages({
            'boolean.base': 'intenseMode must be a boolean'
        }),
        tags: Joi.array().items(Joi.string()).optional().messages({
            'array.base': 'tags must be an array of strings'
        })
    }).unknown(true);
    
    return schema.validate(payload);
}


export const StartAndPauseTripSchema = (payload) => {
    const schema = Joi.object({
        tripId: Joi.string().required().messages({
            'any.required': 'tripId is required'
        }),
        navStatus: Joi.string().valid('idle', 'navigating', 'paused').required().messages({
            'any.required': 'navStatus is required',
            'any.only': 'navStatus must be one of [idle, navigating, paused]'
        })
    });
    
    return schema.validate(payload);
}