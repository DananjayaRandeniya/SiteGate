import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import { dlqTopic } from '@app/contracts';
import type { Topic } from '@app/contracts';

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

@Injectable()
export class DeadLetterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeadLetterService.name);
  private readonly producer: Producer;

  constructor(config: ConfigService) {
    const brokers = config.getOrThrow<string>('KAFKA_BROKERS').split(',');
    this.producer = new Kafka({ clientId: 'access-service-dlq', brokers }).producer();
  }

  async onModuleInit() {
    await this.producer.connect();
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  // Runs the work. If it fails, the message goes to the .dlq topic.
  async process(topic: Topic, event: unknown, work: () => Promise<void>) {
    if (!this.hasValidShape(event)) {
        await this.sendToDlq(topic, event, 'Invalid event: missing eventId, eventType or payload');
        return;
    }
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
        await work();
        return; // it worked, so we're done
        } catch (err) {
        lastError = err;
        this.logger.warn(`${topic}: attempt ${attempt} of ${MAX_ATTEMPTS} failed`);

        if (attempt < MAX_ATTEMPTS) {
            // wait 500 ms after the first failure, 1000 ms after the second
            await new Promise((resolve) => setTimeout(resolve, BASE_DELAY_MS * 2 ** (attempt - 1)));
        }
        }
    }

    // All attempts failed: dead-letter it
    const reason = lastError instanceof Error ? lastError.message : String(lastError);
    await this.sendToDlq(topic, event, reason);
    }

  private async sendToDlq(topic: Topic, event: unknown, reason: string) {
    await this.producer.send({
      topic: dlqTopic(topic),
      messages: [{ value: JSON.stringify({ originalTopic: topic, reason, event }) }],
    });
    this.logger.error(`Sent to ${dlqTopic(topic)}: ${reason}`);
  }

  private hasValidShape(event: unknown): boolean {
    const e = event as {
        eventId?: unknown;
        eventType?: unknown;
        payload?: unknown;
    } | null;

    return (
        !!e &&
        typeof e.eventId === 'string' &&
        typeof e.eventType === 'string' &&
        typeof e.payload === 'object' &&
        e.payload !== null
    );
    }
}