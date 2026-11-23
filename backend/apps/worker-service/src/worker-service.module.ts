import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { TerminusModule } from '@nestjs/terminus';
import { HttpErrorFilter } from './common/http-error.filter';
import { envValidationSchema } from './config/env.validation';
import {
  Contractor,
  ContractorSchema,
} from './contractors/schemas/contractor.schema';
import { HealthController } from './health/health.controller';
import { WorkerServiceController } from './worker-service.controller';
import { WorkerServiceService } from './worker-service.service';
import { Worker, WorkerSchema } from './workers/schemas/worker.schema';

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
    MongooseModule.forFeature([
      { name: Contractor.name, schema: ContractorSchema },
      { name: Worker.name, schema: WorkerSchema },
    ]),
    TerminusModule,
  ],
  controllers: [WorkerServiceController, HealthController],
  providers: [
    WorkerServiceService,
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
