import Joi from 'joi';

export const CreateHybridCoinRushEventSchema = (payload) => {
    const checkpointSchema = Joi.object({
        type: Joi.string().valid('GPS', 'QR', 'CODE', 'QA', 'PHOTO').required().messages({
            'any.only': 'Checkpoint type must be one of: GPS, QR, CODE, QA, PHOTO',
            'any.required': 'Checkpoint type is required'
        }),
        description: Joi.string().optional().allow(''),
        latitude: Joi.when('type', {
            is: 'GPS',
            then: Joi.number().required().messages({ 'any.required': 'Latitude is required for GPS checkpoints' }),
            otherwise: Joi.forbidden()
        }),
        longitude: Joi.when('type', {
            is: 'GPS',
            then: Joi.number().required().messages({ 'any.required': 'Longitude is required for GPS checkpoints' }),
            otherwise: Joi.forbidden()
        }),
        secretCode: Joi.when('type', {
            is: 'CODE',
            then: Joi.string().min(1).max(8).required().messages({ 
                'any.required': 'secretCode is required for CODE checkpoints',
                'string.max': 'secretCode must be between 1 and 8 characters',
                'string.min': 'secretCode must be between 1 and 8 characters'
            }),
            otherwise: Joi.forbidden()
        }),
        question: Joi.when('type', {
            is: 'QA',
            then: Joi.string().required().messages({ 'any.required': 'question is required for QA checkpoints' }),
            otherwise: Joi.forbidden()
        }),
        answer: Joi.when('type', {
            is: 'QA',
            then: Joi.string().required().messages({ 'any.required': 'answer is required for QA checkpoints' }),
            otherwise: Joi.forbidden()
        }),
        photoRequirements: Joi.alternatives().conditional('type', {
            is: 'PHOTO',
            then: Joi.string().optional().allow(''),
            otherwise: Joi.forbidden()
        }),
        referencePhotoUrl: Joi.alternatives().conditional('type', {
            is: 'PHOTO',
            then: Joi.string().optional().allow(''),
            otherwise: Joi.forbidden()
        })
    });

    const schema = Joi.object({
        title: Joi.string().required().messages({
            'string.empty': 'Event title is required',
            'any.required': 'Event title is required',
        }),
        description: Joi.string().required().messages({
            'string.empty': 'Description is required',
            'any.required': 'Description is required',
        }),
        checkpointCount: Joi.number().integer().min(3).max(10).optional().default(5).messages({
            'number.min': 'Hybrid events must have at least 3 checkpoints',
            'number.max': 'Hybrid events can have at most 10 checkpoints'
        }),
        duration: Joi.number().integer().min(1).required().messages({
            'number.base': 'Duration must be a number (minutes)',
            'any.required': 'Duration is required',
        }),
        startTime: Joi.date().optional(),
        endTime: Joi.date().optional(),
        latitude: Joi.number().optional(),
        longitude: Joi.number().optional(),
        checkpoints: Joi.array().items(checkpointSchema).required().messages({
            'any.required': 'checkpoints array is required'
        }),
        rewardType: Joi.string().required().messages({
            'string.empty': 'Reward type is required',
            'any.required': 'Reward type is required',
        }),
        rewardTitle: Joi.string().required().messages({
            'string.empty': 'Reward title is required',
            'any.required': 'Reward title is required',
        }),
        rewardImageUrl: Joi.string().optional().allow(''),
        rewardDescription: Joi.string().optional().allow(''),
        rewardClaimInstructions: Joi.string().optional().allow(''),
        rewardValue: Joi.number().optional().default(0.0)
    }).unknown(true);

    return schema.validate(payload);
};

export const CreateCoinRushEventSchema = (payload) => {
    const legacyCheckpointSchema = Joi.object({
        latitude: Joi.number().required().messages({ 'any.required': 'Latitude is required for manual checkpoints' }),
        longitude: Joi.number().required().messages({ 'any.required': 'Longitude is required for manual checkpoints' }),
        description: Joi.string().optional().allow('')
    });

    const schema = Joi.object({
        title: Joi.string().required().messages({
            'string.empty': 'Event title is required',
            'any.required': 'Event title is required',
        }),
        description: Joi.string().required().messages({
            'string.empty': 'Description is required',
            'any.required': 'Description is required',
        }),
        eventType: Joi.string().valid('GPS', 'QR').required().messages({
            'any.only': 'Event type must be either GPS or QR',
            'any.required': 'Event type is required'
        }),
        checkpointCount: Joi.number().integer().min(3).max(10).optional().default(5).messages({
            'number.min': 'Checkpoint count must be between 3 and 10',
            'number.max': 'Checkpoint count must be between 3 and 10'
        }),
        duration: Joi.number().integer().min(1).required().messages({
            'number.base': 'Duration must be a number (minutes)',
            'any.required': 'Duration is required',
        }),
        startTime: Joi.date().optional(),
        endTime: Joi.date().optional(),
        centerLat: Joi.number().optional(),
        centerLng: Joi.number().optional(),
        radiusMeter: Joi.number().optional(),
        checkpoints: Joi.array().items(legacyCheckpointSchema).optional(),
        rewardType: Joi.string().required().messages({
            'string.empty': 'Reward type is required',
            'any.required': 'Reward type is required',
        }),
        rewardTitle: Joi.string().required().messages({
            'string.empty': 'Reward title is required',
            'any.required': 'Reward title is required',
        }),
        rewardImageUrl: Joi.string().optional().allow(''),
        rewardDescription: Joi.string().optional().allow(''),
        rewardClaimInstructions: Joi.string().optional().allow(''),
        rewardValue: Joi.number().optional().default(0.0)
    }).unknown(true);

    return schema.validate(payload);
};

