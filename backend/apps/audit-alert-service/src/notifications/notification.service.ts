import { Inject, Injectable, Logger } from '@nestjs/common';
import { NOTIFIERS } from './notifier';
import type { AlertNotification, Notifier } from './notifier';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(@Inject(NOTIFIERS) private readonly notifiers: Notifier[]) {}

  /** Calls every notifier. Never throws: a broken notifier must not stop the others. */
  async notifyAll(alert: AlertNotification): Promise<void> {
    await Promise.all(
      this.notifiers.map(async (notifier) => {
        try {
          await notifier.notify(alert);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          this.logger.error(`Notifier "${notifier.name}" failed for alert ${alert.alertId}: ${reason}`);
        }
      }),
    );
  }
}