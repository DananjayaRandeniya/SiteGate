import { Inject, Injectable, Logger } from '@nestjs/common';
import { AlertStatus } from '@app/contracts';
import type { AccessDeniedEvent } from '@app/contracts';
import { AlertsRepository } from './alerts.repository';
import { ALERT_RULES } from './rules/alert-rule';
import type { AlertRule } from './rules/alert-rule';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @Inject(ALERT_RULES) private readonly rules: AlertRule[],
    private readonly repository: AlertsRepository,
  ) {}

  /** Runs every rule on a denied-access event and stores the alerts they raise. */
  async evaluate(event: AccessDeniedEvent): Promise<void> {
    for (const rule of this.rules) {
      const candidate = await rule.evaluate(event);
      if (!candidate) {
        continue;
      }

      const alert = await this.repository.insertIfNoOpen({
        ...candidate,
        status: AlertStatus.OPEN,
        triggerEventId: event.eventId,
        correlationId: event.correlationId,
      });

      if (alert) {
        this.logger.log(
          `Alert raised: type=${candidate.type} severity=${candidate.severity} ` +
            `credential=${candidate.credentialNumber} eventId=${event.eventId}`,
        );
      } else {
        this.logger.debug(
          `Open alert already exists: type=${candidate.type} credential=${candidate.credentialNumber}`,
        );
      }
    }
  }
}