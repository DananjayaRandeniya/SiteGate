import { DomainError } from '../common/errors/domain-error';

export class AlertNotFoundError extends DomainError {
  readonly code = 'ALERT_NOT_FOUND';

  constructor(id: string) {
    super(`Alert ${id} was not found`);
  }
}

export class InvalidAlertTransitionError extends DomainError {
  readonly code = 'INVALID_ALERT_TRANSITION';

  constructor(from: string, to: string) {
    super(`Cannot change an alert from ${from} to ${to}`);
  }
}