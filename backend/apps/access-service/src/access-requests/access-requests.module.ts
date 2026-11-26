import { Module } from '@nestjs/common';
import { WorkerSnapshotsModule } from '../worker-snapshots/worker-snapshots.module';
import { AccessDecisionService } from './access-decision.service';
import { AccessRequestsController } from './access-requests.controller';
import { AssignedToSiteRule } from './rules/assigned-to-site.rule';
import { CredentialRevokedRule } from './rules/credential-revoked.rule';
import { InductionValidRule } from './rules/induction-valid.rule';
import { TicketValidRule } from './rules/ticket-valid.rule';
import { UnknownCredentialRule } from './rules/unknown-credential.rule';
import { WorkerInactiveRule } from './rules/worker-inactive.rule';
import { AccessLogModule } from '../access-log/access-log.module';
import { EventPublisherModule } from '../events/event-publisher.module';

@Module({
  imports: [WorkerSnapshotsModule, AccessLogModule, EventPublisherModule],
  controllers: [AccessRequestsController],
  providers: [
    AccessDecisionService,
    UnknownCredentialRule,
    CredentialRevokedRule,
    WorkerInactiveRule,
    AssignedToSiteRule,
    InductionValidRule,
    TicketValidRule,
  ],
})
export class AccessRequestsModule {}