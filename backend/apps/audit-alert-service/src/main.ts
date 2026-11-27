import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AuditAlertServiceModule } from './audit-alert-service.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AuditAlertServiceModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('audit-alert-service')
    .setDescription('Audit trail and alerts')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

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