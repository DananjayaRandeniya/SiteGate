import { AlertSeverity, AlertType, DenialReason } from '@app/contracts';
import type { AccessDeniedEvent } from '@app/contracts';
import { ExpiredTicketRule } from './expired-ticket.rule';

// Builds a complete access.denied event. Only the reason changes between tests.
const makeEvent = (reasonCode: DenialReason, workerId?: string): AccessDeniedEvent =>
  ({
    eventId: 'a0000001-0000-4000-8000-000000000001',
    eventType: 'access.denied',
    version: 1,
    occurredAt: '2026-11-25T11:00:00.000Z',
    source: 'access-service',
    correlationId: '99999999-9999-4999-8999-999999999999',
    payload: {
      credentialNumber: 'C-2001',
      workerId,
      siteId: 'S-01',
      gateId: 'G-01',
      reasonCode,
    },
  }) as AccessDeniedEvent;

describe('ExpiredTicketRule', () => {
  const rule = new ExpiredTicketRule();

  it('returns a HIGH EXPIRED_TICKET_ACCESS alert when the reason is TICKET_EXPIRED', async () => {
    const result = await rule.evaluate(makeEvent(DenialReason.TICKET_EXPIRED, 'w-2'));

    expect(result).toEqual({
      type: AlertType.EXPIRED_TICKET_ACCESS,
      severity: AlertSeverity.HIGH,
      credentialNumber: 'C-2001',
      workerId: 'w-2',
      siteId: 'S-01',
      gateId: 'G-01',
    });
  });

  it('returns null for any other denial reason', async () => {
    const result = await rule.evaluate(makeEvent(DenialReason.WORKER_INACTIVE, 'w-2'));

    expect(result).toBeNull();
  });

  it('still alerts when the denial has no workerId', async () => {
    const result = await rule.evaluate(makeEvent(DenialReason.TICKET_EXPIRED));

    expect(result?.type).toBe(AlertType.EXPIRED_TICKET_ACCESS);
    expect(result?.workerId).toBeUndefined();
  });
});