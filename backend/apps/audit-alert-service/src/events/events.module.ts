import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { AuditModule } from '../audit/audit.module';
import { EventsController } from './events.controller';

@Module({
  imports: [AuditModule, AlertsModule],
  controllers: [EventsController],
})
export class EventsModule {}