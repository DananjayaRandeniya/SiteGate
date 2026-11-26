import { Injectable } from '@nestjs/common';
import { DenialReason, WorkerStatus } from '@app/contracts';
import type { AccessContext, AccessRule } from './access-rule';

@Injectable()
export class WorkerInactiveRule implements AccessRule {
  check(ctx: AccessContext) {
    return ctx.snapshot?.status === WorkerStatus.INACTIVE
      ? DenialReason.WORKER_INACTIVE
      : null;
  }
}