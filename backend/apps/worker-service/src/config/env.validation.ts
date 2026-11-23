import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().integer().min(1).max(65535).required(),
  MONGO_URI: Joi.string().trim().required(),
  KAFKA_BROKERS: Joi.string().trim().required(),
  WORKER_ADMIN_TOKEN: Joi.string().trim().min(32).pattern(/^\S+$/).optional(),
});
