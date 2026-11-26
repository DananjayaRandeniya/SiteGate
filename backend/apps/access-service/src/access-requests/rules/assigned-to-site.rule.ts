import { Injectable } from '@nestjs/common';
import { DenialReason } from '@app/contracts';
import type { AccessContext, AccessRule } from './access-rule';

@Injectable()
export class AssignedToSiteRule implements AccessRule {
  check(ctx: AccessContext) {
    return ctx.snapshot?.siteIds?.includes(ctx.siteId)
      ? null
      : DenialReason.NOT_ASSIGNED_TO_SITE;
  }
}