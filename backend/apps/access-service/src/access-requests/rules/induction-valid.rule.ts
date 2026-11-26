import { Injectable } from '@nestjs/common';
import { DenialReason } from '@app/contracts';
import type { AccessContext, AccessRule } from './access-rule';

@Injectable()
export class InductionValidRule implements AccessRule {
  check(ctx: AccessContext) {
    const date = ctx.snapshot?.inductionDate;
    // Invalid if missing, or dated in the future (the brief says it can't be)
    return date && date <= ctx.now ? null : DenialReason.INDUCTION_INVALID;
  }
}