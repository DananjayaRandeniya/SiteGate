import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KAFKA_CLIENT, KafkaPublisher } from './kafka-publisher.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: KAFKA_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'audit-alert-service-producer',
              brokers: config.getOrThrow<string>('KAFKA_BROKERS').split(','),
            },
          },
        }),
      },
    ]),
  ],
  providers: [KafkaPublisher],
  exports: [KafkaPublisher],
})
export class KafkaModule {}