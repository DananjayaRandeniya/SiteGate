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
import { AlertsService } from '../alerts/alerts.service';
import { AuditService } from '../audit/audit.service';

@Controller()
export class EventsController {
  private readonly logger = new Logger(EventsController.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly alertsService: AlertsService,
  ) {}

  @EventPattern(Topics.WORKER_CREATED)
  async onWorkerCreated(@Payload() event: WorkerCreatedEvent, @Ctx() ctx: unknown) {
    await this.handle(event, ctx);
  }

  @EventPattern(Topics.WORKER_UPDATED)
  async onWorkerUpdated(@Payload() event: WorkerUpdatedEvent, @Ctx() ctx: unknown) {
    await this.handle(event, ctx);
  }

  @EventPattern(Topics.WORKER_DEACTIVATED)
  async onWorkerDeactivated(@Payload() event: WorkerDeactivatedEvent, @Ctx() ctx: unknown) {
    await this.handle(event, ctx);
  }

  @EventPattern(Topics.CREDENTIAL_ISSUED)
  async onCredentialIssued(@Payload() event: CredentialIssuedEvent, @Ctx() ctx: unknown) {
    await this.handle(event, ctx);
  }

  @EventPattern(Topics.CREDENTIAL_REVOKED)
  async onCredentialRevoked(@Payload() event: CredentialRevokedEvent, @Ctx() ctx: unknown) {
    await this.handle(event, ctx);
  }

  @EventPattern(Topics.ACCESS_GRANTED)
  async onAccessGranted(@Payload() event: AccessGrantedEvent, @Ctx() ctx: unknown) {
    await this.handle(event, ctx);
  }

  // The only handler that does more than store the event
  @EventPattern(Topics.ACCESS_DENIED)
  async onAccessDenied(@Payload() event: AccessDeniedEvent, @Ctx() ctx: unknown) {
    const saved = await this.handle(event, ctx);
    if (saved) {
      // Only new events are checked, so a duplicate delivery cannot raise an alert twice
      await this.alertsService.evaluate(event);
    }
  }

  @EventPattern(Topics.ALERT_RAISED)
  async onAlertRaised(@Payload() event: AlertRaisedEvent, @Ctx() ctx: unknown) {
    await this.handle(event, ctx);
  }

  /** Logs the event and stores it. Returns true if it was new, false if a duplicate. */
  private async handle(
    event: EventEnvelope<string, unknown>,
    ctx: unknown,
  ): Promise<boolean> {
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

    return this.auditService.record(event, meta);
  }
}