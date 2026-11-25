import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AlertStatus, Topics } from '@app/contracts';
import type {
  AccessDeniedEvent,
  AlertRaisedEvent,
  AlertSeverity,
  AlertType,
} from '@app/contracts';
import { KafkaPublisher } from '../kafka/kafka-publisher.service';
import { NotificationService } from '../notifications/notification.service';
import { AlertsRepository } from './alerts.repository';
import type { StoredAlert } from './alerts.repository';
import { ALERT_RULES } from './rules/alert-rule';
import type { AlertRule } from './rules/alert-rule';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @Inject(ALERT_RULES) private readonly rules: AlertRule[],
    private readonly repository: AlertsRepository,
    private readonly notifications: NotificationService,
    private readonly publisher: KafkaPublisher,
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

      if (!alert) {
        this.logger.debug(
          `Open alert already exists: type=${candidate.type} credential=${candidate.credentialNumber}`,
        );
        continue;
      }

      this.logger.log(
        `Alert raised: type=${alert.type} severity=${alert.severity} ` +
          `credential=${alert.credentialNumber} eventId=${event.eventId}`,
      );
      await this.announce(alert);
    }
  }

  /** Tells people (notifiers) and other services (alert.raised). Never throws. */
  private async announce(alert: StoredAlert): Promise<void> {
    await this.notifications.notifyAll({
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      status: alert.status,
      credentialNumber: alert.credentialNumber,
      workerId: alert.workerId,
      siteId: alert.siteId,
      gateId: alert.gateId,
      correlationId: alert.correlationId,
      raisedAt: new Date().toISOString(),
    });
    await this.publishRaised(alert);
  }

  private async publishRaised(alert: StoredAlert): Promise<void> {
    const event: AlertRaisedEvent = {
      eventId: randomUUID(),
      eventType: Topics.ALERT_RAISED,
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'audit-alert-service',
      correlationId: alert.correlationId, // same ID as the denial that caused it
      payload: {
        alertId: alert.id,
        type: alert.type as AlertType, // saved as text, but the schema allows only valid values
        severity: alert.severity as AlertSeverity,
        workerId: alert.workerId,
        siteId: alert.siteId,
      },
    };

    try {
      await this.publisher.publish(Topics.ALERT_RAISED, { key: alert.id, value: event });
    } catch (error) {
      // The alert is saved, so do not fail the denial event because of this
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Could not publish alert.raised for alert ${alert.id}: ${reason}`);
    }
  }
}