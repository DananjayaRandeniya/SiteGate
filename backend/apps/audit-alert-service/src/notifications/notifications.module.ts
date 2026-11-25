import { Module } from '@nestjs/common';
import { ConsoleNotifier } from './console.notifier';
import { NotificationService } from './notification.service';
import { NOTIFIERS } from './notifier';
import { WebhookNotifier } from './webhook.notifier';

@Module({
  providers: [
    ConsoleNotifier,
    WebhookNotifier,
    NotificationService,
    // To add a notifier later: write the class, add it to this list. Nothing else changes.
    {
      provide: NOTIFIERS,
      useFactory: (console: ConsoleNotifier, webhook: WebhookNotifier) => [console, webhook],
      inject: [ConsoleNotifier, WebhookNotifier],
    },
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}