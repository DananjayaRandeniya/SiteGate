import { Injectable } from '@nestjs/common';
import { AlertSeverity, AlertType, DenialReason } from '@app/contracts';
import type { AccessDeniedEvent } from '@app/contracts';
import { fromEvent } from './alert-rule';
import type { AlertCandidate, AlertRule } from './alert-rule';

/** One denial with reason TICKET_EXPIRED is enough: severity HIGH. */
@Injectable()
export class ExpiredTicketRule implements AlertRule {
  async evaluate(event: AccessDeniedEvent): Promise<AlertCandidate | null> {
    if (event.payload.reasonCode !== DenialReason.TICKET_EXPIRED) {
      return null;
    }
    return {
      type: AlertType.EXPIRED_TICKET_ACCESS,
      severity: AlertSeverity.HIGH,
      ...fromEvent(event),
    };
  }
}