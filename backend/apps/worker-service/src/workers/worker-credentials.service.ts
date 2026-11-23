import {
  Topics,
  type CredentialIssuedPayload,
  type CredentialRevokedPayload,
} from '@app/contracts';
import { Injectable } from '@nestjs/common';
import { DomainError } from '../common/domain-error';
import { workerLogger } from '../common/logger';
import type { RevokeCredentialDto } from './dto/worker-credential.dto';
import { WorkerEventsProducer } from './events/worker-events.producer';
import { WorkersRepository } from './workers.repository';

type CredentialChange =
  | [typeof Topics.CREDENTIAL_ISSUED, CredentialIssuedPayload]
  | [typeof Topics.CREDENTIAL_REVOKED, CredentialRevokedPayload];

@Injectable()
export class WorkerCredentialsService {
  constructor(
    private readonly workers: WorkersRepository,
    private readonly events: WorkerEventsProducer,
  ) {}

  async issue(
    workerId: string,
    credentialNumber: string,
    correlationId: string,
  ) {
    const issuedAt = new Date();
    if (
      !(await this.workers.issueCredential(
        workerId,
        credentialNumber,
        issuedAt,
      ))
    ) {
      await this.requireWorker(workerId);
      throw new DomainError(
        'CREDENTIAL_IN_USE',
        'The worker already has an active credential or has used this number before',
      );
    }

    await this.publish(
      [Topics.CREDENTIAL_ISSUED, { workerId, credentialNumber }],
      correlationId,
    );
    return { credentialNumber, issuedAt };
  }

  async revoke(
    workerId: string,
    input: RevokeCredentialDto,
    correlationId: string,
  ) {
    const { credentialNumber, reason, note } = input;
    const revokedAt = new Date();
    if (!(await this.workers.revokeCredential(workerId, input, revokedAt))) {
      await this.requireWorker(workerId);
      throw new DomainError(
        'CREDENTIAL_NOT_ACTIVE',
        'This credential is not active for this worker',
      );
    }

    const payload: CredentialRevokedPayload = {
      workerId,
      credentialNumber,
      reason,
    };
    if (note !== undefined) payload.note = note;
    await this.publish([Topics.CREDENTIAL_REVOKED, payload], correlationId);
    return {
      credentialNumber,
      revokedAt,
      reason,
      ...(note === undefined ? {} : { note }),
    };
  }

  private async requireWorker(workerId: string) {
    if (!(await this.workers.existsVisible(workerId))) {
      throw new DomainError('WORKER_NOT_FOUND', 'Worker was not found');
    }
  }

  private async publish(
    [topic, payload]: CredentialChange,
    correlationId: string,
  ) {
    try {
      await this.events.publish(topic, payload, correlationId);
    } catch (error) {
      workerLogger.error(
        { err: error, workerId: payload.workerId, correlationId, topic },
        'Credential change saved but event publication could not be confirmed',
      );
      throw new DomainError(
        'CREDENTIAL_EVENT_UNCONFIRMED',
        'The credential change was saved, but its event could not be confirmed',
      );
    }
  }
}
