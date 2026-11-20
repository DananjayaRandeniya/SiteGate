export const DeactivationReason = {
  LEFT_COMPANY: 'LEFT_COMPANY',
  SAFETY_BREACH: 'SAFETY_BREACH',
  CONTRACT_ENDED: 'CONTRACT_ENDED',
  OTHER: 'OTHER',
} as const;
export type DeactivationReason =
  (typeof DeactivationReason)[keyof typeof DeactivationReason];

export const RevokeReason = {
  LOST: 'LOST',
  STOLEN: 'STOLEN',
  DAMAGED: 'DAMAGED',
  OTHER: 'OTHER',
} as const;
export type RevokeReason = (typeof RevokeReason)[keyof typeof RevokeReason];

export const Direction = {
  ENTRY: 'ENTRY',
  EXIT: 'EXIT',
} as const;
export type Direction = (typeof Direction)[keyof typeof Direction];

export const DenialReason = {
  TICKET_EXPIRED: 'TICKET_EXPIRED',
  WORKER_INACTIVE: 'WORKER_INACTIVE',
  NOT_ASSIGNED_TO_SITE: 'NOT_ASSIGNED_TO_SITE',
  INDUCTION_INVALID: 'INDUCTION_INVALID',
  CREDENTIAL_REVOKED: 'CREDENTIAL_REVOKED',
  UNKNOWN_CREDENTIAL: 'UNKNOWN_CREDENTIAL',
} as const;
export type DenialReason = (typeof DenialReason)[keyof typeof DenialReason];

export const AlertType = {
  REPEATED_DENIAL: 'REPEATED_DENIAL',
  EXPIRED_TICKET_ACCESS: 'EXPIRED_TICKET_ACCESS',
} as const;
export type AlertType = (typeof AlertType)[keyof typeof AlertType];

export const AlertSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;
export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];

export const AlertStatus = {
  OPEN: 'Open',
  ACKNOWLEDGED: 'Acknowledged',
  RESOLVED: 'Resolved',
} as const;
export type AlertStatus = (typeof AlertStatus)[keyof typeof AlertStatus];

export const WorkerStatus = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
} as const;
export type WorkerStatus = (typeof WorkerStatus)[keyof typeof WorkerStatus];

export const AccessResult = {
  GRANTED: 'GRANTED',
  DENIED: 'DENIED',
} as const;
export type AccessResult = (typeof AccessResult)[keyof typeof AccessResult];