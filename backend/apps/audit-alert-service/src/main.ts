import { NestFactory } from '@nestjs/core';
import { AuditAlertServiceModule } from './audit-alert-service.module';

async function bootstrap() {
  const app = await NestFactory.create(AuditAlertServiceModule);
  await app.listen(process.env.port ?? 3003);
}
void bootstrap();
