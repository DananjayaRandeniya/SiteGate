import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { Topics } from '@app/contracts';
import type {
  AccessDeniedEvent,
  AccessGrantedEvent,
  AlertRaisedEvent,
  CredentialIssuedEvent,
  CredentialRevokedEvent,
  EventEnvelope,
  WorkerCreatedEvent,
  WorkerDeactivatedEvent,
  WorkerUpdatedEvent,
} from '@app/contracts';
import { AuditService } from '../audit/audit.service';

@Controller()
export class EventsController {
  private readonly logger = new Logger(EventsController.name);

  constructor(private readonly auditService: AuditService) {}

  @EventPattern(Topics.WORKER_CREATED)
  onWorkerCreated(@Payload() event: WorkerCreatedEvent, @Ctx() ctx: unknown) {
    return this.handle(event, ctx);
  }

  @EventPattern(Topics.WORKER_UPDATED)
  onWorkerUpdated(@Payload() event: WorkerUpdatedEvent, @Ctx() ctx: unknown) {
    return this.handle(event, ctx);
  }

  @EventPattern(Topics.WORKER_DEACTIVATED)
  onWorkerDeactivated(@Payload() event: WorkerDeactivatedEvent, @Ctx() ctx: unknown) {
    return this.handle(event, ctx);
  }

  @EventPattern(Topics.CREDENTIAL_ISSUED)
  onCredentialIssued(@Payload() event: CredentialIssuedEvent, @Ctx() ctx: unknown) {
    return this.handle(event, ctx);
  }

  @EventPattern(Topics.CREDENTIAL_REVOKED)
  onCredentialRevoked(@Payload() event: CredentialRevokedEvent, @Ctx() ctx: unknown) {
    return this.handle(event, ctx);
  }

  @EventPattern(Topics.ACCESS_GRANTED)
  onAccessGranted(@Payload() event: AccessGrantedEvent, @Ctx() ctx: unknown) {
    return this.handle(event, ctx);
  }

  @EventPattern(Topics.ACCESS_DENIED)
  onAccessDenied(@Payload() event: AccessDeniedEvent, @Ctx() ctx: unknown) {
    return this.handle(event, ctx);
  }

  @EventPattern(Topics.ALERT_RAISED)
  onAlertRaised(@Payload() event: AlertRaisedEvent, @Ctx() ctx: unknown) {
    return this.handle(event, ctx);
  }

  private async handle(event: EventEnvelope<string, unknown>, ctx: unknown) {
    const kafkaCtx = ctx as KafkaContext; // Nest passes a KafkaContext here
    const meta = {
      topic: kafkaCtx.getTopic(),
      partition: kafkaCtx.getPartition(),
      offset: kafkaCtx.getMessage().offset,
    };

    this.logger.log(
      `topic=${meta.topic} partition=${meta.partition} offset=${meta.offset} ` +
        `eventId=${event.eventId} correlationId=${event.correlationId}`,
    );

    await this.auditService.record(event, meta);
  }
}