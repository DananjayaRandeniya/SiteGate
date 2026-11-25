import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { AlertsRepository } from './alerts.repository';
import { AlertsService } from './alerts.service';
import { ALERT_RULES } from './rules/alert-rule';
import { ExpiredTicketRule } from './rules/expired-ticket.rule';
import { RepeatedDenialRule } from './rules/repeated-denial.rule';
import { Alert, AlertSchema } from './schemas/alert.schema';

@Module({
  imports: [
    AuditModule,
    MongooseModule.forFeature([{ name: Alert.name, schema: AlertSchema }]),
  ],
  providers: [
    AlertsRepository,
    AlertsService,
    RepeatedDenialRule,
    ExpiredTicketRule,
    // To add a rule later: write the class, add it to this list. Nothing else changes.
    {
      provide: ALERT_RULES,
      useFactory: (repeated: RepeatedDenialRule, expired: ExpiredTicketRule) => [
        repeated,
        expired,
      ],
      inject: [RepeatedDenialRule, ExpiredTicketRule],
    },
  ],
  exports: [AlertsService],
})
export class AlertsModule {}