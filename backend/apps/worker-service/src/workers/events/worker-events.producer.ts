import type {
  CredentialIssuedEvent,
  CredentialRevokedEvent,
  EventEnvelope,
  WorkerCreatedEvent,
  WorkerDeactivatedEvent,
  WorkerUpdatedEvent,
} from '@app/contracts';
import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Partitioners, type Producer } from 'kafkajs';
import { randomUUID } from 'node:crypto';

type WorkerEvent =
  | WorkerCreatedEvent
  | WorkerUpdatedEvent
  | WorkerDeactivatedEvent
  | CredentialIssuedEvent
  | CredentialRevokedEvent;

type PayloadByTopic = {
  [Event in WorkerEvent as Event['eventType']]: Event['payload'];
};

@Injectable()
export class WorkerEventsProducer implements OnApplicationShutdown {
  private readonly producer: Producer;
  private connection?: Promise<void>;

  constructor(config: ConfigService) {
    const brokers = config
      .getOrThrow<string>('KAFKA_BROKERS')
      .split(',')
      .map((broker) => broker.trim())
      .filter(Boolean);

    this.producer = new Kafka({ clientId: 'worker-service', brokers }).producer(
      {
        createPartitioner: Partitioners.DefaultPartitioner,
      },
    );
  }

  async publish<Topic extends keyof PayloadByTopic>(
    eventType: Topic,
    payload: PayloadByTopic[NoInfer<Topic>],
    correlationId: string,
  ): Promise<void> {
    const event: EventEnvelope<Topic, PayloadByTopic[Topic]> = {
      eventId: randomUUID(),
      eventType,
      version: 1,
      occurredAt: new Date().toISOString(),
      source: 'worker-service',
      correlationId,
      payload,
    };

    await this.connect();
    await this.producer.send({
      topic: eventType,
      messages: [{ key: payload.workerId, value: JSON.stringify(event) }],
    });
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.connection) {
      await this.connection.catch(() => undefined);
      await this.producer.disconnect();
    }
  }

  private connect(): Promise<void> {
    // Share an in-flight connection and allow a later publish to retry.
    this.connection ??= this.producer.connect().catch((error: unknown) => {
      this.connection = undefined;
      throw error;
    });
    return this.connection;
  }
}
