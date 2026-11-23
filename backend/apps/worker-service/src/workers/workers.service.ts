import { Topics } from '@app/contracts';
import { Injectable } from '@nestjs/common';
import { DomainError } from '../common/domain-error';
import { workerLogger } from '../common/logger';
import { ContractorsService } from '../contractors/contractors.service';
import type { CreateWorkerDto } from './dto/create-worker.dto';
import { WorkerEventsProducer } from './events/worker-events.producer';
import { WorkersRepository } from './workers.repository';

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
    const result = {
      id: worker._id.toString(),
      fullName: worker.fullName,
      contractorId: worker.contractorId.toString(),
      credentialNumber: input.credentialNumber,
      inductionDate: input.inductionDate,
      safetyTicketExpiry: input.safetyTicketExpiry,
      assignedSiteIds: worker.assignedSiteIds,
      status: worker.status,
    };

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
        { workerId: result.id, credentialNumber: result.credentialNumber },
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
}
