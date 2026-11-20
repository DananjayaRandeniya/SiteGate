import {
  AlertSeverity,
  AlertType,
  DeactivationReason,
  DenialReason,
  Direction,
  RevokeReason,
} from './enums';
import { EventEnvelope } from './envelope';
import { Topics } from './topics';

// ---------- Payloads ----------

export interface WorkerCreatedPayload {
  workerId: string;
  name: string;
  contractorId: string;
  siteIds: string[];
  inductionDate: string;
  ticketExpiry: string;
}

// Only the fields that changed are sent
export interface WorkerUpdatedPayload {
  workerId: string;
  name?: string;
  contractorId?: string;
  siteIds?: string[];
  inductionDate?: string;
  ticketExpiry?: string;
}

export interface WorkerDeactivatedPayload {
  workerId: string;
  reason: DeactivationReason;
  note?: string;
}

export interface CredentialIssuedPayload {
  workerId: string;
  credentialNumber: string;
}

export interface CredentialRevokedPayload {
  workerId: string;
  credentialNumber: string;
  reason: RevokeReason;
  note?: string;
}

export interface AccessGrantedPayload {
  credentialNumber: string;
  workerId: string;
  siteId: string;
  gateId: string;
  direction: Direction;
}

export interface AccessDeniedPayload {
  credentialNumber: string;
  workerId?: string; // missing when the credential is unknown
  siteId: string;
  gateId: string;
  reasonCode: DenialReason;
}

export interface AlertRaisedPayload {
  alertId: string;
  type: AlertType;
  severity: AlertSeverity;
  workerId: string;
  siteId: string;
}

// ---------- Full events (envelope + payload) ----------

export type WorkerCreatedEvent = EventEnvelope<
  typeof Topics.WORKER_CREATED,
  WorkerCreatedPayload
>;
export type WorkerUpdatedEvent = EventEnvelope<
  typeof Topics.WORKER_UPDATED,
  WorkerUpdatedPayload
>;
export type WorkerDeactivatedEvent = EventEnvelope<
  typeof Topics.WORKER_DEACTIVATED,
  WorkerDeactivatedPayload
>;
export type CredentialIssuedEvent = EventEnvelope<
  typeof Topics.CREDENTIAL_ISSUED,
  CredentialIssuedPayload
>;
export type CredentialRevokedEvent = EventEnvelope<
  typeof Topics.CREDENTIAL_REVOKED,
  CredentialRevokedPayload
>;
export type AccessGrantedEvent = EventEnvelope<
  typeof Topics.ACCESS_GRANTED,
  AccessGrantedPayload
>;
export type AccessDeniedEvent = EventEnvelope<
  typeof Topics.ACCESS_DENIED,
  AccessDeniedPayload
>;
export type AlertRaisedEvent = EventEnvelope<
  typeof Topics.ALERT_RAISED,
  AlertRaisedPayload
>;