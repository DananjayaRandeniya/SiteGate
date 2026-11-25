import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AlertNotification, Notifier } from './notifier';

const TIMEOUT_MS = 5000;

/** Sends the alert as JSON to WEBHOOK_URL. If no URL is set, it does nothing. */
@Injectable()
export class WebhookNotifier implements Notifier {
  readonly name = 'webhook';
  private readonly logger = new Logger(WebhookNotifier.name);
  private readonly url?: string;

  constructor(config: ConfigService) {
    this.url = config.get<string>('WEBHOOK_URL') || undefined;
  }

  async notify(alert: AlertNotification): Promise<void> {
    if (!this.url) {
      this.logger.debug('WEBHOOK_URL is not set, skipping webhook');
      return;
    }

    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert),
      signal: AbortSignal.timeout(TIMEOUT_MS), // never wait forever
    });

    if (!response.ok) {
      throw new Error(`Webhook answered with HTTP ${response.status}`);
    }
  }
}