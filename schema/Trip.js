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
        tripFrom: Joi.date().required().messages({
            'any.required': 'Trip From date is required',
            'date.base': 'Trip From must be a valid date'
        }),
        tripTo: Joi.date().required().messages({
            'any.required': 'Trip To date is required',
            'date.base': 'Trip To must be a valid date'
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
        hotelLat: Joi.number().required().messages({
            'any.required': 'Hotel latitude is required',
            'number.base': 'hotelLat must be a number'
        }),
        hotelLng: Joi.number().required().messages({
            'any.required': 'Hotel longitude is required',
            'number.base': 'hotelLng must be a number'
        }),
        destinationLat: Joi.number().required().messages({
            'any.required': 'Destination latitude is required',
            'number.base': 'destinationLat must be a number'
        }),
        destinationLng: Joi.number().required().messages({
            'any.required': 'Destination longitude is required',
            'number.base': 'destinationLng must be a number'
        }),
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

export const SaveJourneySchema = (payload) => {
    const locationItemSchema = Joi.object({
        index: Joi.number().integer().required(),
        category: Joi.string().required(),
        name: Joi.string().required(),
        lat: Joi.number().required(),
        lng: Joi.number().required()
    }).unknown(true);

    const schema = Joi.object({
        tripId: Joi.string().required().messages({
            'any.required': 'tripId is required',
            'string.empty': 'tripId cannot be empty'
        }),
        routeTitle: Joi.string().required().messages({
            'any.required': 'routeTitle is required',
            'string.empty': 'routeTitle cannot be empty'
        }),
        routesByDate: Joi.object().pattern(
            Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
            Joi.array().items(locationItemSchema)
        ).optional().messages({
            'object.base': 'routesByDate must be an object with YYYY-MM-DD keys'
        })
    });

    return schema.validate(payload);
}