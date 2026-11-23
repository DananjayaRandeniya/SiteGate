import { Topics, type WorkerUpdatedPayload } from '@app/contracts';
import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { DomainError } from '../common/domain-error';
import { workerLogger } from '../common/logger';
import { ContractorsService } from '../contractors/contractors.service';
import type { CreateWorkerDto } from './dto/create-worker.dto';
import type { UpdateWorkerDto } from './dto/update-worker.dto';
import { WorkerEventsProducer } from './events/worker-events.producer';
import type { Worker } from './schemas/worker.schema';
import {
  type WorkerProfileChanges,
  WorkersRepository,
} from './workers.repository';

function workerProfile(
  worker: Worker & { _id: Types.ObjectId },
  changes: WorkerProfileChanges = {},
) {
  return {
    id: worker._id.toString(),
    fullName: changes.fullName ?? worker.fullName,
    contractorId: (changes.contractorId ?? worker.contractorId).toString(),
    credentialNumber:
      worker.credentials.find(({ revokedAt }) => revokedAt === null)?.number ??
      null,
    inductionDate: (changes.inductionDate ?? worker.inductionDate)
      .toISOString()
      .slice(0, 10),
    safetyTicketExpiry: (
      changes.safetyTicketExpiry ?? worker.safetyTicketExpiry
    )
      .toISOString()
      .slice(0, 10),
    assignedSiteIds: worker.assignedSiteIds,
    status: worker.status,
  };
}

@Injectable()
export class WorkersService {
  constructor(
    private readonly contractors: ContractorsService,
    private readonly workers: WorkersRepository,
    private readonly events: WorkerEventsProducer,
  ) {}

  async register(input: CreateWorkerDto, correlationId: string) {
    await this.contractors.get(input.contractorId);
    const worker = await this.workers.create(input);
    const result = workerProfile(worker);

    let unconfirmedTopic:
      typeof Topics.WORKER_CREATED | typeof Topics.CREDENTIAL_ISSUED =
      Topics.WORKER_CREATED;
    try {
      await this.events.publish(
        Topics.WORKER_CREATED,
        {
          workerId: result.id,
          name: result.fullName,
          contractorId: result.contractorId,
          siteIds: result.assignedSiteIds,
          inductionDate: result.inductionDate,
          ticketExpiry: result.safetyTicketExpiry,
        },
        correlationId,
      );
      unconfirmedTopic = Topics.CREDENTIAL_ISSUED;
      await this.events.publish(
        Topics.CREDENTIAL_ISSUED,
        { workerId: result.id, credentialNumber: input.credentialNumber },
        correlationId,
      );
    } catch (error) {
      workerLogger.error(
        { err: error, workerId: result.id, correlationId, unconfirmedTopic },
        'Worker saved but event publication could not be confirmed',
      );
      throw new DomainError(
        'REGISTRATION_EVENT_UNCONFIRMED',
        'Worker was saved, but its registration events could not be confirmed',
      );
    }

    return result;
  }

  async get(id: string) {
    const worker = await this.workers.findVisibleById(id);
    if (!worker)
      throw new DomainError('WORKER_NOT_FOUND', 'Worker was not found');
    return workerProfile(worker);
  }

  async update(id: string, input: UpdateWorkerDto, correlationId: string) {
    const changes: WorkerProfileChanges = {};
    if (input.fullName !== undefined) changes.fullName = input.fullName;
    if (input.inductionDate !== undefined)
      changes.inductionDate = new Date(input.inductionDate);
    if (input.safetyTicketExpiry !== undefined)
      changes.safetyTicketExpiry = new Date(input.safetyTicketExpiry);
    if (input.contractorId !== undefined) {
      // Find the worker first so a missing profile consistently returns WORKER_NOT_FOUND.
      const worker = await this.get(id);
      const contractorId = input.contractorId.toLowerCase();
      if (contractorId !== worker.contractorId) {
        await this.contractors.get(contractorId);
        changes.contractorId = new Types.ObjectId(contractorId);
      }
    }

    if (Object.keys(changes).length === 0) return this.get(id);
    const previous = await this.workers.updateVisibleProfile(id, changes);
    if (!previous) return this.get(id);

    const before = workerProfile(previous);
    const after = workerProfile(previous, changes);
    const event: WorkerUpdatedPayload = { workerId: after.id };
    if (after.fullName !== before.fullName) event.name = after.fullName;
    if (after.contractorId !== before.contractorId)
      event.contractorId = after.contractorId;
    if (after.inductionDate !== before.inductionDate)
      event.inductionDate = after.inductionDate;
    if (after.safetyTicketExpiry !== before.safetyTicketExpiry)
      event.ticketExpiry = after.safetyTicketExpiry;
    if (Object.keys(event).length === 1) return after;

    await this.publishWorkerUpdate(event, correlationId);
    return after;
  }

  async changeSiteAssignment(
    id: string,
    siteId: string,
    action: 'assign' | 'unassign',
    correlationId: string,
  ) {
    const updated =
      action === 'assign'
        ? await this.workers.assignSite(id, siteId)
        : await this.workers.unassignSite(id, siteId);

    if (!updated) {
      const { assignedSiteIds } = await this.get(id);
      return { assignedSiteIds };
    }

    await this.publishWorkerUpdate(
      { workerId: updated._id.toString(), siteIds: updated.assignedSiteIds },
      correlationId,
    );
    return { assignedSiteIds: updated.assignedSiteIds };
  }

  private async publishWorkerUpdate(
    event: WorkerUpdatedPayload,
    correlationId: string,
  ) {
    try {
      await this.events.publish(Topics.WORKER_UPDATED, event, correlationId);
    } catch (error) {
      workerLogger.error(
        {
          err: error,
          workerId: event.workerId,
          correlationId,
          topic: Topics.WORKER_UPDATED,
        },
        'Worker changes saved but event publication could not be confirmed',
      );
      throw new DomainError(
        'WORKER_UPDATE_EVENT_UNCONFIRMED',
        'Worker changes were saved, but the update event could not be confirmed',
      );
    }
  }
}
