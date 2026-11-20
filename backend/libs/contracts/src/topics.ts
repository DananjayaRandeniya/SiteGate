export const Topics = {
  WORKER_CREATED: 'worker.created',
  WORKER_UPDATED: 'worker.updated',
  WORKER_DEACTIVATED: 'worker.deactivated',
  CREDENTIAL_ISSUED: 'credential.issued',
  CREDENTIAL_REVOKED: 'credential.revoked',
  ACCESS_GRANTED: 'access.granted',
  ACCESS_DENIED: 'access.denied',
  ALERT_RAISED: 'alert.raised',
} as const;

export type Topic = (typeof Topics)[keyof typeof Topics];

// Every topic has a matching dead-letter topic, e.g. "access.denied.dlq"
export const dlqTopic = (topic: Topic): string => `${topic}.dlq`;