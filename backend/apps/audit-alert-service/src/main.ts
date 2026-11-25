import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AuditAlertServiceModule } from './audit-alert-service.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AuditAlertServiceModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // Kafka side
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'audit-alert-service',
        brokers: config.getOrThrow<string>('KAFKA_BROKERS').split(','),
      },
      consumer: { groupId: 'audit-alert-service-group' },
      subscribe: { fromBeginning: true },
      postfixId: '',
    },
  });
  await app.startAllMicroservices();

  // HTTP side
  await app.listen(config.getOrThrow<number>('PORT'));
}
bootstrap();