import { Module } from '@nestjs/common';
import { AuditAlertServiceController } from './audit-alert-service.controller';
import { AuditAlertServiceService } from './audit-alert-service.service';

@Module({
  imports: [],
  controllers: [AuditAlertServiceController],
  providers: [AuditAlertServiceService],
})
export class AuditAlertServiceModule {}
