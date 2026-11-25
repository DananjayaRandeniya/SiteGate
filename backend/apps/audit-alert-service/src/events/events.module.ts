import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { AuditModule } from '../audit/audit.module';
import { KafkaModule } from '../kafka/kafka.module';
import { EventProcessor } from './event-processor.service';
import { EventsController } from './events.controller';

@Module({
  imports: [AuditModule, AlertsModule, KafkaModule],
  controllers: [EventsController],
  providers: [EventProcessor],
})
export class EventsModule {}