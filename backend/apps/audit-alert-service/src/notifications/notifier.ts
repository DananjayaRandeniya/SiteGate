/** What a notifier receives. Kept flat and simple so it is easy to send as JSON. */
export interface AlertNotification {
  alertId: string;
  type: string;
  severity: string;
  status: string;
  credentialNumber: string;
  workerId?: string;
  siteId: string;
  gateId?: string;
  correlationId: string;
  raisedAt: string; // ISO 8601
}

/** One way of telling someone about an alert. Add a class like this for email later. */
export interface Notifier {
  readonly name: string;
  notify(alert: AlertNotification): Promise<void>;
}

// Injection token: the service receives "all the notifiers" as one list
export const NOTIFIERS = Symbol('NOTIFIERS');