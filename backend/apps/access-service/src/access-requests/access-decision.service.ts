import { Injectable } from '@nestjs/common';
import { AccessResult } from '@app/contracts';
import type { DenialReason } from '@app/contracts';
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
}