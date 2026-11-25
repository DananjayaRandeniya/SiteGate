import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(3003),
  MONGO_URI: Joi.string().required(),
  KAFKA_BROKERS: Joi.string().required(),
  WEBHOOK_URL: Joi.string().uri().allow('').optional(),
});