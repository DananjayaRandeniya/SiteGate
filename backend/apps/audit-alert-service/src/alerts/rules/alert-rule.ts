import type { AccessDeniedEvent, AlertSeverity, AlertType } from '@app/contracts';

/** What a rule returns when it decides an alert is needed. */
export interface AlertCandidate {
  type: AlertType;
  severity: AlertSeverity;
  credentialNumber: string;
  workerId?: string;
  siteId: string;
  gateId: string;
}

/** One rule = one class. Returns an alert candidate, or null for "no alert". */
export interface AlertRule {
  evaluate(event: AccessDeniedEvent): Promise<AlertCandidate | null>;
}

// Injection token: lets the service receive "all the rules" as one list
export const ALERT_RULES = Symbol('ALERT_RULES');

/** The event details every alert copies, so rules do not repeat this. */
export const fromEvent = (event: AccessDeniedEvent) => ({
  credentialNumber: event.payload.credentialNumber,
  workerId: event.payload.workerId,
  siteId: event.payload.siteId,
  gateId: event.payload.gateId,
});