import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload } from '@nestjs/microservices';
import { Topics } from '@app/contracts';
import { EventProcessor } from './event-processor.service';

/** Kafka plumbing only: every topic goes to the same processor. */
@Controller()
export class EventsController {
  constructor(private readonly processor: EventProcessor) {}

  @EventPattern(Topics.WORKER_CREATED)
  onWorkerCreated(@Payload() event: unknown, @Ctx() ctx: unknown) {
    return this.processor.process(event, ctx);
  }

  @EventPattern(Topics.WORKER_UPDATED)
  onWorkerUpdated(@Payload() event: unknown, @Ctx() ctx: unknown) {
    return this.processor.process(event, ctx);
  }

  @EventPattern(Topics.WORKER_DEACTIVATED)
  onWorkerDeactivated(@Payload() event: unknown, @Ctx() ctx: unknown) {
    return this.processor.process(event, ctx);
  }

  @EventPattern(Topics.CREDENTIAL_ISSUED)
  onCredentialIssued(@Payload() event: unknown, @Ctx() ctx: unknown) {
    return this.processor.process(event, ctx);
  }

  @EventPattern(Topics.CREDENTIAL_REVOKED)
  onCredentialRevoked(@Payload() event: unknown, @Ctx() ctx: unknown) {
    return this.processor.process(event, ctx);
  }

  @EventPattern(Topics.ACCESS_GRANTED)
  onAccessGranted(@Payload() event: unknown, @Ctx() ctx: unknown) {
    return this.processor.process(event, ctx);
  }

  @EventPattern(Topics.ACCESS_DENIED)
  onAccessDenied(@Payload() event: unknown, @Ctx() ctx: unknown) {
    return this.processor.process(event, ctx);
  }

  @EventPattern(Topics.ALERT_RAISED)
  onAlertRaised(@Payload() event: unknown, @Ctx() ctx: unknown) {
    return this.processor.process(event, ctx);
  }
}