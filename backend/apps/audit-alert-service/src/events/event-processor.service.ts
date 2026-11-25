import { Injectable, Logger } from '@nestjs/common';
import type { KafkaContext } from '@nestjs/microservices';
import { Topics, dlqTopic } from '@app/contracts';
import type { AccessDeniedEvent, EventEnvelope, Topic } from '@app/contracts';
import { AlertsService } from '../alerts/alerts.service';
import { AuditService } from '../audit/audit.service';
import { KafkaPublisher } from '../kafka/kafka-publisher.service';
import { validateEvent } from './event-validation';
import { withRetry } from './retry';

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500; // waits 500 ms, then 1000 ms, between attempts

interface MessageInfo {
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
}

@Injectable()
export class EventProcessor {
  private readonly logger = new Logger(EventProcessor.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly alertsService: AlertsService,
    private readonly publisher: KafkaPublisher,
  ) {}

  /** Never throws: a bad message must never stop the consumer. */
  async process(event: unknown, ctx: unknown): Promise<void> {
    const info = this.readInfo(ctx);
    const envelope = event as Partial<EventEnvelope<string, unknown>> | null;

    this.logger.log(
      `topic=${info.topic} partition=${info.partition} offset=${info.offset} ` +
        `eventId=${envelope?.eventId} correlationId=${envelope?.correlationId}`,
    );

    try {
      // Remembered between attempts, so a retry never saves the same event twice
      let isNew: boolean | undefined;

      await withRetry(
        async () => {
          const problem = validateEvent(info.topic, event);
          if (problem) {
            throw new Error(`Invalid event: ${problem}`);
          }

          isNew ??= await this.auditService.record(
            event as EventEnvelope<string, unknown>,
            info,
          );

          // Only new events are checked, so a duplicate delivery cannot raise an alert twice
          if (isNew && info.topic === Topics.ACCESS_DENIED) {
            await this.alertsService.evaluate(event as AccessDeniedEvent);
          }
        },
        MAX_ATTEMPTS,
        BASE_DELAY_MS,
        (attempt, error) =>
          this.logger.warn(
            `Attempt ${attempt}/${MAX_ATTEMPTS} failed for topic=${info.topic} ` +
              `offset=${info.offset}: ${this.reasonOf(error)}`,
          ),
      );
    } catch (error) {
      await this.sendToDlq(event, info, error);
    }
  }

  private readInfo(ctx: unknown): MessageInfo {
    const kafkaCtx = ctx as KafkaContext; // Nest passes a KafkaContext here
    const message = kafkaCtx.getMessage();
    return {
      topic: kafkaCtx.getTopic(),
      partition: kafkaCtx.getPartition(),
      offset: message.offset,
      key: message.key?.toString() ?? null,
    };
  }

  private reasonOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async sendToDlq(event: unknown, info: MessageInfo, error: unknown): Promise<void> {
    const reason = this.reasonOf(error);
    const target = dlqTopic(info.topic as Topic);

    try {
      await this.publisher.publish(target, {
        key: info.key,
        value: {
          originalTopic: info.topic,
          partition: info.partition,
          offset: info.offset,
          failedAt: new Date().toISOString(),
          attempts: MAX_ATTEMPTS,
          error: reason,
          message: event, // the original message, unchanged
        },
      });
      this.logger.error(`Gave up after ${MAX_ATTEMPTS} attempts. Sent to ${target}: ${reason}`);
    } catch (dlqError) {
      // Do not throw, or the consumer would get stuck. Log everything so it can be recovered.
      this.logger.error(
        `Could not publish to ${target}: ${this.reasonOf(dlqError)}. ` +
          `Original message: ${JSON.stringify(event)}`,
      );
    }
  }
}