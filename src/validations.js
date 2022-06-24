import Joi from "joi";

export const schemaParticipants = Joi.object({
    username: Joi.string().required()
});

export const schemaMessages = Joi.object({
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().valid('private_message', 'message').required()
});