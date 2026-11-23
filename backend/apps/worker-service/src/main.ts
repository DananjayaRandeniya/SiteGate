import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { requestLogging } from './common/request-logging.middleware';
import { setupWorkerApiDocs } from './openapi/worker-api-docs';
import { WorkerServiceModule } from './worker-service.module';
import { Worker } from './workers/schemas/worker.schema';

async function bootstrap() {
  const app = await NestFactory.create(WorkerServiceModule);
  app.enableShutdownHooks();
  app.use(requestLogging);
  setupWorkerApiDocs(app);
  const port = app.get(ConfigService).getOrThrow<number>('PORT');
  await app.get<Model<Worker>>(getModelToken(Worker.name)).init();
  await app.listen(port);
}
void bootstrap();
