import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TerminusModule } from '@nestjs/terminus';
import * as Joi from 'joi';
import { AccessServiceController } from './access-service.controller';
import { AccessServiceService } from './access-service.service';
import { HealthController } from './health/health.controller';
import { WorkerSnapshotsModule } from './worker-snapshots/worker-snapshots.module';
import { WorkerEventsController } from './events/worker-events.controller';
import { DeadLetterService } from './events/dead-letter.service';
import { ProcessedEventsModule } from './processed-events/processed-events.module';
import { AccessRequestsModule } from './access-requests/access-requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/access-service/.env',
      validationSchema: Joi.object({
        PORT: Joi.number().required(),
        MONGO_URI: Joi.string().required(),
        KAFKA_BROKERS: Joi.string().required(),
      }),
    }),
    TerminusModule,
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGO_URI'),
      }),
    }),
    WorkerSnapshotsModule,
    ProcessedEventsModule,
    AccessRequestsModule
  ],
  controllers: [AccessServiceController, HealthController, WorkerEventsController],
  providers: [AccessServiceService, DeadLetterService],
})
export class AccessServiceModule {}