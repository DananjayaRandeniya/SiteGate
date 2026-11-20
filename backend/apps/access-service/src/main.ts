import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessServiceModule } from './access-service.module';

async function bootstrap() {
  const app = await NestFactory.create(AccessServiceModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = app.get(ConfigService).getOrThrow<number>('PORT');
  await app.listen(port);
}
bootstrap();