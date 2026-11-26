import { Injectable } from '@nestjs/common';
import { DenialReason } from '@app/contracts';
import type { AccessContext, AccessRule } from './access-rule';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TicketValidRule implements AccessRule {
  check(ctx: AccessContext) {
    const expiry = ctx.snapshot?.ticketExpiry;
    if (!expiry) return DenialReason.TICKET_EXPIRED;

    // Valid through the expiry date, expired from the next day (our decision)
    const firstExpiredMoment = new Date(expiry.getTime() + ONE_DAY_MS);
    return ctx.now < firstExpiredMoment ? null : DenialReason.TICKET_EXPIRED;
  }
}