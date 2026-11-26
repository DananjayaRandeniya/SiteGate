import { Injectable } from '@nestjs/common';
import { AccessResult, Topics } from '@app/contracts';
import type { AccessDeniedPayload, AccessGrantedPayload, DenialReason } from '@app/contracts';
import { WorkerSnapshotsRepository } from '../worker-snapshots/worker-snapshots.repository';
import type { AccessRequestDto } from './dto/access-request.dto';
import type { AccessContext, AccessRule } from './rules/access-rule';
import { UnknownCredentialRule } from './rules/unknown-credential.rule';
import { CredentialRevokedRule } from './rules/credential-revoked.rule';
import { WorkerInactiveRule } from './rules/worker-inactive.rule';
import { AssignedToSiteRule } from './rules/assigned-to-site.rule';
import { InductionValidRule } from './rules/induction-valid.rule';
import { TicketValidRule } from './rules/ticket-valid.rule';
import { AccessLogRepository } from '../access-log/access-log.repository';
import { EventPublisher } from '../events/event-publisher.service';

export interface AccessDecision {
  result: AccessResult;
  reasonCode?: DenialReason;
  workerId?: string;
}

@Injectable()
export class AccessDecisionService {
  private readonly rules: AccessRule[];

  constructor(
    private readonly snapshots: WorkerSnapshotsRepository,
    private readonly accessLog: AccessLogRepository,
    private readonly publisher: EventPublisher,
    unknownCredential: UnknownCredentialRule,
    credentialRevoked: CredentialRevokedRule,
    workerInactive: WorkerInactiveRule,
    assignedToSite: AssignedToSiteRule,
    inductionValid: InductionValidRule,
    ticketValid: TicketValidRule,
  ) {
    // The order matters: the first rule that fails decides the reason
    this.rules = [
      unknownCredential,
      credentialRevoked,
      workerInactive,
      assignedToSite,
      inductionValid,
      ticketValid,
    ];
  }

  async decide(dto: AccessRequestDto): Promise<AccessDecision> {
    const snapshot = await this.snapshots.findByCredentialNumber(dto.credentialNumber);
    const decision = this.evaluate({ snapshot, siteId: dto.siteId, now: new Date() });

    await this.accessLog.record({
        credentialNumber: dto.credentialNumber,
        workerId: decision.workerId,
        siteId: dto.siteId,
        gateId: dto.gateId,
        direction: dto.direction,
        result: decision.result,
        reasonCode: decision.reasonCode,
    });

    await this.publishDecision(dto, decision);
    return decision;
    }

    // The rules, unchanged: the first rule that fails decides the reason
    private evaluate(ctx: AccessContext): AccessDecision {
    for (const rule of this.rules) {
        const reasonCode = rule.check(ctx);
        if (reasonCode) {
        return {
            result: AccessResult.DENIED,
            reasonCode,
            workerId: ctx.snapshot?.workerId,
        };
        }
    }
    return { result: AccessResult.GRANTED, workerId: ctx.snapshot?.workerId };
    }

  private async publishDecision(dto: AccessRequestDto, decision: AccessDecision) {
    if (decision.result === AccessResult.GRANTED && decision.workerId) {
        const payload: AccessGrantedPayload = {
        credentialNumber: dto.credentialNumber,
        workerId: decision.workerId,
        siteId: dto.siteId,
        gateId: dto.gateId,
        direction: dto.direction,
        };
        await this.publisher.publish(Topics.ACCESS_GRANTED, dto.credentialNumber, payload);
    } else if (decision.reasonCode) {
        const payload: AccessDeniedPayload = {
        credentialNumber: dto.credentialNumber,
        workerId: decision.workerId, // missing for an unknown credential
        siteId: dto.siteId,
        gateId: dto.gateId,
        reasonCode: decision.reasonCode,
        };
        await this.publisher.publish(Topics.ACCESS_DENIED, dto.credentialNumber, payload);
    }
    }    
}