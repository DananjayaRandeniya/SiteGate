import { DenialReason, Topics } from '@app/contracts';
import { validateEvent } from './event-validation';

// A complete, valid event. Tests change one thing at a time.
const makeEvent = (overrides: Record<string, unknown> = {}) => ({
  eventId: 'a0000001-0000-4000-8000-000000000001',
  eventType: 'access.denied',
  version: 1,
  occurredAt: '2026-11-25T11:00:00.000Z',
  source: 'access-service',
  correlationId: '99999999-9999-4999-8999-999999999999',
  payload: {
    credentialNumber: 'C-2001',
    workerId: 'w-2',
    siteId: 'S-01',
    gateId: 'G-01',
    reasonCode: DenialReason.TICKET_EXPIRED,
  },
  ...overrides,
});

describe('validateEvent', () => {
  it('accepts a valid access.denied event', () => {
    expect(validateEvent(Topics.ACCESS_DENIED, makeEvent())).toBeNull();
  });

  it('accepts access.denied without workerId (unknown credential)', () => {
    const event = makeEvent({
      payload: {
        credentialNumber: 'C-9999',
        siteId: 'S-01',
        gateId: 'G-01',
        reasonCode: DenialReason.UNKNOWN_CREDENTIAL,
      },
    });

    expect(validateEvent(Topics.ACCESS_DENIED, event)).toBeNull();
  });

  it('accepts an alert.raised event without workerId', () => {
    const event = makeEvent({
      eventType: 'alert.raised',
      source: 'audit-alert-service',
      payload: {
        alertId: 'alert-1',
        type: 'REPEATED_DENIAL',
        severity: 'MEDIUM',
        siteId: 'S-01',
      },
    });

    // expect(validateEvent(Topics.ALERT_RAISED, event)).toContain('');
    expect(validateEvent(Topics.ALERT_RAISED, event)).toBeNull();
  });

  it('rejects an event without eventId and names the field', () => {
    const { eventId, ...withoutId } = makeEvent();
    void eventId;

    expect(validateEvent(Topics.ACCESS_DENIED, withoutId)).toContain('eventId');
  });

  it('rejects an eventId that is not a uuid', () => {
    const result = validateEvent(Topics.ACCESS_DENIED, makeEvent({ eventId: 'not-a-uuid' }));

    expect(result).toContain('eventId');
  });

  it('rejects an eventType that does not match the topic', () => {
    const result = validateEvent(Topics.ACCESS_DENIED, makeEvent({ eventType: 'access.granted' }));

    expect(result).toContain('does not match topic');
  });

  it('rejects a payload with an unknown reasonCode', () => {
    const event = makeEvent({
      payload: {
        credentialNumber: 'C-2001',
        siteId: 'S-01',
        gateId: 'G-01',
        reasonCode: 'NOT_A_REAL_REASON',
      },
    });

    const result = validateEvent(Topics.ACCESS_DENIED, event);

    expect(result).toMatch(/^payload:/);
    expect(result).toContain('reasonCode');
  });

  it('rejects a value that is not an object', () => {
    expect(validateEvent(Topics.ACCESS_DENIED, 'this is not json')).not.toBeNull();
  });

  it('rejects an unknown topic', () => {
    const result = validateEvent('foo.bar', makeEvent({ eventType: 'foo.bar' }));

    expect(result).toContain('no schema for topic');
  });
});