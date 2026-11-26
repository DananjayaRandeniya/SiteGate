import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Kafka, Producer } from 'kafkajs';
import type { EventEnvelope, Topic } from '@app/contracts';

@Injectable()
export class EventPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventPublisher.name);
  private readonly producer: Producer;

  constructor(config: ConfigService) {
    const brokers = config.getOrThrow<string>('KAFKA_BROKERS').split(',');
    this.producer = new Kafka({ clientId: 'access-service-publisher', brokers }).producer();
  }

  async onModuleInit() {
    await this.producer.connect();
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async publish<TType extends Topic, TPayload>(
    topic: TType,
    key: string,
    payload: TPayload,
  ): Promise<void> {
    // The envelope every event uses (from the contracts)
    const event: EventEnvelope<TType, TPayload> = {
      eventId: randomUUID(),
      eventType: topic,
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'access-service',
      correlationId: randomUUID(),
      payload,
    };

    try {
      await this.producer.send({
        topic,
        messages: [{ key, value: JSON.stringify(event) }],
      });
    } catch (err) {
      // The gate must still get its answer if Kafka is down
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`Could not publish ${topic}: ${reason}`);
    }
  }
}