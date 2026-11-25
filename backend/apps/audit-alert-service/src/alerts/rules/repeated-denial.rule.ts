import { Injectable } from '@nestjs/common';
import { AlertSeverity, AlertType } from '@app/contracts';
import type { AccessDeniedEvent } from '@app/contracts';
import { AuditService } from '../../audit/audit.service';
import { fromEvent } from './alert-rule';
import type { AlertCandidate, AlertRule } from './alert-rule';

const WINDOW_MINUTES = 10;
const THRESHOLD = 3;

/** 3 denials for one credential within 10 minutes: severity MEDIUM. */
@Injectable()
export class RepeatedDenialRule implements AlertRule {
  constructor(private readonly auditService: AuditService) {}

  async evaluate(event: AccessDeniedEvent): Promise<AlertCandidate | null> {
    // The window ends at the event's own time, not "now", so the result is repeatable
    const to = new Date(event.occurredAt);
    const from = new Date(to.getTime() - WINDOW_MINUTES * 60 * 1000);

    // The current event is already saved, so it counts as one of the denials
    const count = await this.auditService.countDenials(
      event.payload.credentialNumber,
      from,
      to,
    );
    if (count < THRESHOLD) {
      return null;
    }
    return {
      type: AlertType.REPEATED_DENIAL,
      severity: AlertSeverity.MEDIUM,
      ...fromEvent(event),
    };
  }
}