import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EventsController } from './events.controller';

@Module({
  imports: [AuditModule],
  controllers: [EventsController],
})
export class EventsModule {}