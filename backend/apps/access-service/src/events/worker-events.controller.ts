import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { Topics, WorkerStatus } from '@app/contracts';
import type { WorkerCreatedEvent } from '@app/contracts';
import { WorkerSnapshotsRepository } from '../worker-snapshots/worker-snapshots.repository';

@Controller()
export class WorkerEventsController {
  constructor(private readonly snapshots: WorkerSnapshotsRepository) {}

  @EventPattern(Topics.WORKER_CREATED)
  async onWorkerCreated(@Payload() event: WorkerCreatedEvent) {
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
  }
}