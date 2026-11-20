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

@Controller()
export class EventsController {
  private readonly logger = new Logger(EventsController.name);
  
  
//   constructor() {
//   this.logger.log('EventsController loaded');
// }

  // One handler per topic. For now each one only logs the event.
  @EventPattern(Topics.WORKER_CREATED)
  onWorkerCreated(@Payload() event: WorkerCreatedEvent, @Ctx() ctx: unknown) {
    this.logEvent(event, ctx);
  }

  @EventPattern(Topics.WORKER_UPDATED)
  onWorkerUpdated(@Payload() event: WorkerUpdatedEvent, @Ctx() ctx: unknown) {
    this.logEvent(event, ctx);
  }

  @EventPattern(Topics.WORKER_DEACTIVATED)
  onWorkerDeactivated(@Payload() event: WorkerDeactivatedEvent, @Ctx() ctx: unknown) {
    this.logEvent(event, ctx);
  }

  @EventPattern(Topics.CREDENTIAL_ISSUED)
  onCredentialIssued(@Payload() event: CredentialIssuedEvent, @Ctx() ctx: unknown) {
    this.logEvent(event, ctx);
  }

  @EventPattern(Topics.CREDENTIAL_REVOKED)
  onCredentialRevoked(@Payload() event: CredentialRevokedEvent, @Ctx() ctx: unknown) {
    this.logEvent(event, ctx);
  }

  @EventPattern(Topics.ACCESS_GRANTED)
  onAccessGranted(@Payload() event: AccessGrantedEvent, @Ctx() ctx: unknown) {
    this.logEvent(event, ctx);
  }

  @EventPattern(Topics.ACCESS_DENIED)
  onAccessDenied(@Payload() event: AccessDeniedEvent, @Ctx() ctx: unknown) {
    this.logEvent(event, ctx);
  }

  @EventPattern(Topics.ALERT_RAISED)
  onAlertRaised(@Payload() event: AlertRaisedEvent, @Ctx() ctx: unknown) {
    this.logEvent(event, ctx);
  }

  private logEvent(event: EventEnvelope<string, unknown>, ctx: unknown) {
    const kafkaCtx = ctx as KafkaContext; // Nest passes a KafkaContext here
    const key = kafkaCtx.getMessage().key?.toString();
    this.logger.log(
      `topic=${kafkaCtx.getTopic()} partition=${kafkaCtx.getPartition()} key=${key} ` +
        `eventId=${event.eventId} correlationId=${event.correlationId}`,
    );
  }
}