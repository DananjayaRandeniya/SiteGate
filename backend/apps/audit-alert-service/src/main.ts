import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AuditAlertServiceModule } from './audit-alert-service.module';

async function bootstrap() {
  const app = await NestFactory.create(AuditAlertServiceModule);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  const port = app.get(ConfigService).getOrThrow<number>('PORT');
  await app.listen(port);
}
bootstrap();