import { AlertSeverity, AlertType, DenialReason } from '@app/contracts';
import type { AccessDeniedEvent } from '@app/contracts';
import type { AuditService } from '../../audit/audit.service';
import { RepeatedDenialRule } from './repeated-denial.rule';

const makeEvent = (): AccessDeniedEvent =>
  ({
    eventId: 'a0000001-0000-4000-8000-000000000001',
    eventType: 'access.denied',
    version: 1,
    occurredAt: '2026-11-25T11:06:00.000Z',
    source: 'access-service',
    correlationId: '99999999-9999-4999-8999-999999999999',
    payload: {
      credentialNumber: 'C-2001',
      workerId: 'w-2',
      siteId: 'S-01',
      gateId: 'G-01',
      reasonCode: DenialReason.WORKER_INACTIVE,
    },
  }) as AccessDeniedEvent;

describe('RepeatedDenialRule', () => {
  const countDenials = jest.fn();
  // Only countDenials is used by the rule, so a small fake is enough.
  // The double cast is needed because the fake is not a full AuditService.
  const auditService = { countDenials } as unknown as AuditService;
  const rule = new RepeatedDenialRule(auditService);

  beforeEach(() => {
    countDenials.mockReset();
  });

  it('returns a MEDIUM REPEATED_DENIAL alert when there are 3 denials', async () => {
    countDenials.mockResolvedValue(3);

    const result = await rule.evaluate(makeEvent());

    expect(result).toEqual({
      type: AlertType.REPEATED_DENIAL,
      severity: AlertSeverity.MEDIUM,
      credentialNumber: 'C-2001',
      workerId: 'w-2',
      siteId: 'S-01',
      gateId: 'G-01',
    });
  });

  it('still alerts when there are more than 3 denials', async () => {
    countDenials.mockResolvedValue(5);

    const result = await rule.evaluate(makeEvent());

    expect(result?.type).toBe(AlertType.REPEATED_DENIAL);
  });

  it('returns null when there are only 2 denials', async () => {
    countDenials.mockResolvedValue(2);

    const result = await rule.evaluate(makeEvent());

    expect(result).toBeNull();
  });

  it('counts denials in the 10 minutes that end at the event time', async () => {
    countDenials.mockResolvedValue(1);

    await rule.evaluate(makeEvent());

    expect(countDenials).toHaveBeenCalledWith(
      'C-2001',
      new Date('2026-11-25T10:56:00.000Z'),
      new Date('2026-11-25T11:06:00.000Z'),
    );
  });
});