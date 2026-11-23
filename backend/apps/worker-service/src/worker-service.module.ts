import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { TerminusModule } from '@nestjs/terminus';
import { HttpErrorFilter } from './common/http-error.filter';
import { envValidationSchema } from './config/env.validation';
import { ContractorsModule } from './contractors/contractors.module';
import { HealthController } from './health/health.controller';
import { WorkerServiceController } from './worker-service.controller';
import { WorkerServiceService } from './worker-service.service';
import { WorkerEventsProducer } from './workers/events/worker-events.producer';
import { Worker, WorkerSchema } from './workers/schemas/worker.schema';
import { WorkersController } from './workers/workers.controller';
import { WorkersRepository } from './workers/workers.repository';
import { WorkersService } from './workers/workers.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/worker-service/.env',
      validationSchema: envValidationSchema,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGO_URI'),
        dbName: 'workers_db',
      }),
    }),
    MongooseModule.forFeature([{ name: Worker.name, schema: WorkerSchema }]),
    ContractorsModule,
    TerminusModule,
  ],
  controllers: [WorkerServiceController, HealthController, WorkersController],
  providers: [
    WorkerServiceService,
    WorkersService,
    WorkersRepository,
    WorkerEventsProducer,
    { provide: APP_FILTER, useClass: HttpErrorFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class WorkerServiceModule {}
