import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { Topics, WorkerStatus } from '@app/contracts';
import type { WorkerCreatedEvent } from '@app/contracts';
import { WorkerSnapshotsRepository } from '../worker-snapshots/worker-snapshots.repository';
import type {
  CredentialIssuedEvent,
  CredentialRevokedEvent,
  WorkerDeactivatedEvent,
  WorkerUpdatedEvent,
} from '@app/contracts';
import type { WorkerSnapshot } from '../worker-snapshots/schemas/worker-snapshot.schema';
import { DeadLetterService } from './dead-letter.service';

@Controller()
export class WorkerEventsController {
  constructor(
  private readonly snapshots: WorkerSnapshotsRepository,
  private readonly deadLetter: DeadLetterService,)
  {}

  @EventPattern(Topics.WORKER_CREATED)
  async onWorkerCreated(@Payload() event: WorkerCreatedEvent) {
    await this.deadLetter.process(Topics.WORKER_CREATED, event, async () => {
      const p = event.payload;
      await this.snapshots.upsert(p.workerId, {
        workerId: p.workerId,
        name: p.name,
        contractorId: p.contractorId,
        siteIds: p.siteIds,
        inductionDate: new Date(p.inductionDate),
        ticketExpiry: new Date(p.ticketExpiry),
        status: WorkerStatus.ACTIVE,
      });
    });
  }

  @EventPattern(Topics.WORKER_UPDATED)
  async onWorkerUpdated(@Payload() event: WorkerUpdatedEvent) {
    await this.deadLetter.process(Topics.WORKER_UPDATED, event, async () => {
      const { workerId, inductionDate, ticketExpiry, ...rest } = event.payload;

      const update: Partial<WorkerSnapshot> = { ...rest };
      if (inductionDate) update.inductionDate = new Date(inductionDate);
      if (ticketExpiry) update.ticketExpiry = new Date(ticketExpiry);

      await this.snapshots.upsert(workerId, update);
    });
  }

  @EventPattern(Topics.WORKER_DEACTIVATED)
  async onWorkerDeactivated(@Payload() event: WorkerDeactivatedEvent) {
    await this.deadLetter.process(Topics.WORKER_DEACTIVATED, event, async () => {
      await this.snapshots.upsert(event.payload.workerId, {
        status: WorkerStatus.INACTIVE,
      });
    });
  }

  @EventPattern(Topics.CREDENTIAL_ISSUED)
  async onCredentialIssued(@Payload() event: CredentialIssuedEvent) {
    await this.deadLetter.process(Topics.CREDENTIAL_ISSUED, event, async () => {
      const p = event.payload;
      await this.snapshots.upsert(p.workerId, {
        credentialNumber: p.credentialNumber,
        credentialRevoked: false,
      });
    });
  }

  @EventPattern(Topics.CREDENTIAL_REVOKED)
  async onCredentialRevoked(@Payload() event: CredentialRevokedEvent) {
    await this.deadLetter.process(Topics.CREDENTIAL_REVOKED, event, async () => {
      const p = event.payload;
      await this.snapshots.upsert(p.workerId, {
        credentialNumber: p.credentialNumber,
        credentialRevoked: true,
      });
    });
  }
}