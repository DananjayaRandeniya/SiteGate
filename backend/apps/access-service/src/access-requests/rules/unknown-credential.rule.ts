import { Injectable } from '@nestjs/common';
import { DenialReason } from '@app/contracts';
import type { AccessContext, AccessRule } from './access-rule';

@Injectable()
export class UnknownCredentialRule implements AccessRule {
  check(ctx: AccessContext) {
    return ctx.snapshot ? null : DenialReason.UNKNOWN_CREDENTIAL;
  }
}