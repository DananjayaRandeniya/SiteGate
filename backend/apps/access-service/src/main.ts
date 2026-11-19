import { NestFactory } from '@nestjs/core';
import { AccessServiceModule } from './access-service.module';

async function bootstrap() {
  const app = await NestFactory.create(AccessServiceModule);
  await app.listen(process.env.port ?? 3002);
}
void bootstrap();
