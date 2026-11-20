export interface EventEnvelope<TType extends string, TPayload> {
  eventId: string; // uuid v4, used to ignore duplicate deliveries
  eventType: TType; // the topic name, e.g. "worker.created"
  version: number; // starts at 1, bumps on breaking changes
  occurredAt: string; // ISO 8601 date string
  source: string; // which service sent it
  correlationId: string; // uuid v4, traces one action across services
  payload: TPayload;
}