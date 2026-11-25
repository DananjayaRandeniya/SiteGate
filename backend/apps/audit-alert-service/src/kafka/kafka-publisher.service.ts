import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

export const KAFKA_CLIENT = 'KAFKA_CLIENT';

export interface OutgoingMessage {
  key?: string | null;
  value: unknown; // objects are sent as JSON
  headers?: Record<string, string>;
}

/** The only place in this service that writes to Kafka. */
@Injectable()
export class KafkaPublisher implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(KAFKA_CLIENT) private readonly client: ClientKafka) {}

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  async publish(topic: string, message: OutgoingMessage): Promise<void> {
    await lastValueFrom(this.client.emit(topic, message));
  }
}