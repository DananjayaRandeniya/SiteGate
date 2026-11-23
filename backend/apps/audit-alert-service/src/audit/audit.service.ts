import { Injectable, Logger } from '@nestjs/common';
import type { EventEnvelope } from '@app/contracts';
import { AuditRepository } from './audit.repository';

export interface KafkaMeta {
  topic: string;
  partition: number;
  offset: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly repository: AuditRepository) {}

  async record(
    event: EventEnvelope<string, unknown>,
    meta: KafkaMeta,
  ): Promise<void> {
    const payload = (event.payload ?? {}) as Record<string, unknown>;

    const saved = await this.repository.insertIfNew({
      eventId: event.eventId,
      eventType: event.eventType,
      version: event.version,
      occurredAt: new Date(event.occurredAt),
      source: event.source,
      correlationId: event.correlationId,
      payload,
      workerId: typeof payload.workerId === 'string' ? payload.workerId : undefined,
      credentialNumber:
        typeof payload.credentialNumber === 'string' ? payload.credentialNumber : undefined,
      topic: meta.topic,
      partition: meta.partition,
      offset: meta.offset,
    });

    if (!saved) {
      // Not an error: the same event arrived twice
      this.logger.debug(`Duplicate event ignored: ${event.eventId}`);
    }
  }
}