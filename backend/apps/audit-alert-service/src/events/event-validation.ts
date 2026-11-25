import * as Joi from 'joi';
import {
  AlertSeverity,
  AlertType,
  DeactivationReason,
  DenialReason,
  Direction,
  RevokeReason,
  Topics,
} from '@app/contracts';
import type { Topic } from '@app/contracts';

const id = Joi.string().min(1).required();
const text = Joi.string().min(1).required();
const isoDate = Joi.string().isoDate().required();
const optionalNote = Joi.string().allow('');

// Every event has the same envelope. Extra optional fields are allowed (see contract rules).
const envelopeSchema = Joi.object({
  eventId: Joi.string().uuid().required(),
  eventType: text,
  version: Joi.number().integer().min(1).required(),
  occurredAt: isoDate,
  source: text,
  correlationId: Joi.string().uuid().required(),
  payload: Joi.object().required(),
}).unknown(true);

// One payload schema per topic, following libs/contracts/src/events.ts
const payloadSchemas: Record<Topic, Joi.ObjectSchema> = {
  [Topics.WORKER_CREATED]: Joi.object({
    workerId: id,
    name: text,
    contractorId: id,
    siteIds: Joi.array().items(Joi.string().min(1)).required(),
    inductionDate: isoDate,
    ticketExpiry: isoDate,
  }).unknown(true),

  [Topics.WORKER_UPDATED]: Joi.object({
    workerId: id,
    name: Joi.string().min(1),
    contractorId: Joi.string().min(1),
    siteIds: Joi.array().items(Joi.string().min(1)),
    inductionDate: Joi.string().isoDate(),
    ticketExpiry: Joi.string().isoDate(),
  }).unknown(true),

  [Topics.WORKER_DEACTIVATED]: Joi.object({
    workerId: id,
    reason: Joi.string().valid(...Object.values(DeactivationReason)).required(),
    note: optionalNote,
  }).unknown(true),

  [Topics.CREDENTIAL_ISSUED]: Joi.object({
    workerId: id,
    credentialNumber: id,
  }).unknown(true),

  [Topics.CREDENTIAL_REVOKED]: Joi.object({
    workerId: id,
    credentialNumber: id,
    reason: Joi.string().valid(...Object.values(RevokeReason)).required(),
    note: optionalNote,
  }).unknown(true),

  [Topics.ACCESS_GRANTED]: Joi.object({
    credentialNumber: id,
    workerId: id,
    siteId: id,
    gateId: id,
    direction: Joi.string().valid(...Object.values(Direction)).required(),
  }).unknown(true),

  [Topics.ACCESS_DENIED]: Joi.object({
    credentialNumber: id,
    workerId: Joi.string().min(1), // missing when the credential is unknown
    siteId: id,
    gateId: id,
    reasonCode: Joi.string().valid(...Object.values(DenialReason)).required(),
  }).unknown(true),

  [Topics.ALERT_RAISED]: Joi.object({
    alertId: id,
    type: Joi.string().valid(...Object.values(AlertType)).required(),
    severity: Joi.string().valid(...Object.values(AlertSeverity)).required(),
    workerId: Joi.string().min(1), // optional: missing when the credential is unknown
    siteId: id,
  }).unknown(true),
};

/** Returns a short error text if the message breaks the contract, or null if it is fine. */
export function validateEvent(topic: string, value: unknown): string | null {
  const envelope = envelopeSchema.validate(value, { abortEarly: false });
  if (envelope.error) {
    return envelope.error.message;
  }

  const event = value as { eventType: string; payload: unknown };
  if (event.eventType !== topic) {
    return `eventType "${event.eventType}" does not match topic "${topic}"`;
  }

  const schema = payloadSchemas[topic as Topic];
  if (!schema) {
    return `no schema for topic "${topic}"`;
  }
  const payload = schema.validate(event.payload, { abortEarly: false });
  return payload.error ? `payload: ${payload.error.message}` : null;
}