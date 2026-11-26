import { Injectable } from '@nestjs/common';
import { DenialReason } from '@app/contracts';
import type { AccessContext, AccessRule } from './access-rule';

@Injectable()
export class CredentialRevokedRule implements AccessRule {
  check(ctx: AccessContext) {
    return ctx.snapshot?.credentialRevoked ? DenialReason.CREDENTIAL_REVOKED : null;
  }
}