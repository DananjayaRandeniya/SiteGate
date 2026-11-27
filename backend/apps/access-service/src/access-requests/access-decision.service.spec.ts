// npm run test -- access-decision

import { AccessResult, DenialReason, Direction, Topics, WorkerStatus } from '@app/contracts';
import { AccessDecisionService } from './access-decision.service';
import { AssignedToSiteRule } from './rules/assigned-to-site.rule';
import { CredentialRevokedRule } from './rules/credential-revoked.rule';
import { InductionValidRule } from './rules/induction-valid.rule';
import { TicketValidRule } from './rules/ticket-valid.rule';
import { UnknownCredentialRule } from './rules/unknown-credential.rule';
import { WorkerInactiveRule } from './rules/worker-inactive.rule';

const dto = {
  credentialNumber: 'C-1001',
  siteId: 'S-01',
  gateId: 'G-01',
  direction: Direction.ENTRY,
};

const validWorker = {
  workerId: 'w1',
  siteIds: ['S-01'],
  inductionDate: new Date('2020-01-01'),
  ticketExpiry: new Date('2099-01-01'),
  status: WorkerStatus.ACTIVE,
  credentialRevoked: false,
};

// Builds the service with fake repositories and a fake publisher
function build(snapshot: unknown) {
  const snapshots = { findByCredentialNumber: jest.fn().mockResolvedValue(snapshot) };
  const accessLog = { record: jest.fn().mockResolvedValue(undefined) };
  const publisher = { publish: jest.fn().mockResolvedValue(undefined) };

  // "as never" lets us pass fakes where the real classes are expected
  const service = new AccessDecisionService(
    snapshots as never,
    accessLog as never,
    publisher as never,
    new UnknownCredentialRule(),
    new CredentialRevokedRule(),
    new WorkerInactiveRule(),
    new AssignedToSiteRule(),
    new InductionValidRule(),
    new TicketValidRule(),
  );
  return { service, accessLog, publisher };
}

describe('AccessDecisionService', () => {
  it('grants a valid worker, logs it and publishes access.granted', async () => {
    const { service, accessLog, publisher } = build({ ...validWorker });

    const decision = await service.decide(dto);

    expect(decision.result).toBe(AccessResult.GRANTED);
    expect(decision.reasonCode).toBeUndefined();
    expect(accessLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ result: AccessResult.GRANTED, workerId: 'w1' }),
    );
    expect(publisher.publish).toHaveBeenCalledWith(
      Topics.ACCESS_GRANTED,
      'C-1001',
      expect.objectContaining({ workerId: 'w1', siteId: 'S-01', direction: Direction.ENTRY }),
    );
  });

  it('denies an unknown credential, without a workerId', async () => {
    const { service, accessLog, publisher } = build(null);

    const decision = await service.decide(dto);

    expect(decision.result).toBe(AccessResult.DENIED);
    expect(decision.reasonCode).toBe(DenialReason.UNKNOWN_CREDENTIAL);
    expect(accessLog.record).toHaveBeenCalledTimes(1);
    expect(publisher.publish).toHaveBeenCalledWith(
      Topics.ACCESS_DENIED,
      'C-1001',
      expect.objectContaining({ reasonCode: DenialReason.UNKNOWN_CREDENTIAL, workerId: undefined }),
    );
  });

  it('denies a worker at a site they are not assigned to', async () => {
    const { service } = build({ ...validWorker });

    const decision = await service.decide({ ...dto, siteId: 'S-99' });

    expect(decision.reasonCode).toBe(DenialReason.NOT_ASSIGNED_TO_SITE);
  });

  it('reports the first failing rule when several apply', async () => {
    // revoked AND inactive: the revoked rule comes first in the order
    const { service } = build({
      ...validWorker,
      credentialRevoked: true,
      status: WorkerStatus.INACTIVE,
    });

    const decision = await service.decide(dto);

    expect(decision.reasonCode).toBe(DenialReason.CREDENTIAL_REVOKED);
  });

  it('reports an expired ticket only when everything else is fine', async () => {
    const { service } = build({ ...validWorker, ticketExpiry: new Date('2020-01-01') });

    const decision = await service.decide(dto);

    expect(decision.reasonCode).toBe(DenialReason.TICKET_EXPIRED);
  });
});