import Joi from "joi";

export const schemaParticipants = Joi.object({
    username: Joi.string().required()
});