import Joi from "joi";

export const NfcVerifySchema = (payload) => {
  const schema = Joi.object({
    payload: Joi.alternatives().try(Joi.string(), Joi.object()).optional(),
    token: Joi.string().trim().min(8).max(128).optional(),
    uri: Joi.string().trim().optional(),
    nfcPayload: Joi.string().trim().optional(),
    latitude: Joi.number().min(-90).max(90).optional().allow(null),
    longitude: Joi.number().min(-180).max(180).optional().allow(null),
    lat: Joi.number().min(-90).max(90).optional().allow(null),
    lng: Joi.number().min(-180).max(180).optional().allow(null),
    chipUid: Joi.string().trim().max(128).optional().allow(null, ""),
  })
    .or("payload", "token", "uri", "nfcPayload")
    .unknown(false);

  return schema.validate(payload, { abortEarly: false });
};

export const CreateNfcTagSchema = (payload) => {
  const schema = Joi.object({
    label: Joi.string().trim().max(80).optional().allow("", null),
    chipUid: Joi.string().trim().max(128).optional().allow("", null),
  }).unknown(false);

  return schema.validate(payload ?? {}, { abortEarly: false });
};

export const NfcReceiptSubmitSchema = (payload) => {
  const schema = Joi.object({
    visitId: Joi.string().uuid().required(),
    imageUrl: Joi.string().uri().optional(),
    captureSource: Joi.string().valid("camera").required(),
  })
    .unknown(true);

  return schema.validate(payload ?? {}, { abortEarly: false });
};
