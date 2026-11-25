import { Injectable, Logger } from '@nestjs/common';
import type { AlertNotification, Notifier } from './notifier';

@Injectable()
export class ConsoleNotifier implements Notifier {
  readonly name = 'console';
  private readonly logger = new Logger('ALERT');

  async notify(alert: AlertNotification): Promise<void> {
    this.logger.warn(
      `[${alert.severity}] ${alert.type} credential=${alert.credentialNumber} ` +
        `worker=${alert.workerId ?? 'unknown'} site=${alert.siteId} alertId=${alert.alertId}`,
    );
  }
}