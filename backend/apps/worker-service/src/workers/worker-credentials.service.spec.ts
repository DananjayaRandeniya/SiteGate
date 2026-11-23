import { RevokeReason, Topics } from '@app/contracts';
import { Test, type TestingModule } from '@nestjs/testing';
import { DomainError } from '../common/domain-error';
import { workerLogger } from '../common/logger';
import { WorkerEventsProducer } from './events/worker-events.producer';
import { WorkerCredentialsService } from './worker-credentials.service';
import { WorkersRepository } from './workers.repository';

const workerId = '669f2a62d20bae6882af1871';
const credentialNumber = 'C-1001';
const correlationId = 'd17f3a9a-efea-4ddd-959a-2ce8128871c5';
const revokedCredential = {
  credentialNumber,
  reason: RevokeReason.LOST,
};

describe('WorkerCredentialsService', () => {
  const repository = {
    issueCredential: jest.fn(),
    revokeCredential: jest.fn(),
    existsVisible: jest.fn(),
  };
  const publish = jest.fn();
  let moduleRef: TestingModule;
  let service: WorkerCredentialsService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        WorkerCredentialsService,
        { provide: WorkersRepository, useValue: repository },
        { provide: WorkerEventsProducer, useValue: { publish } },
      ],
    }).compile();
    service = moduleRef.get(WorkerCredentialsService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    publish.mockResolvedValue(undefined);
    jest.spyOn(workerLogger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(() => moduleRef.close());

  it('issues the credential and publishes after the repository succeeds', async () => {
    repository.issueCredential.mockResolvedValueOnce(true);
    const issued = await service.issue(
      workerId,
      credentialNumber,
      correlationId,
    );

    expect(issued).toEqual({ credentialNumber, issuedAt: expect.any(Date) });
    expect(repository.issueCredential).toHaveBeenCalledWith(
      workerId,
      credentialNumber,
      issued.issuedAt,
    );
    expect(repository.issueCredential.mock.invocationCallOrder[0]).toBeLessThan(
      publish.mock.invocationCallOrder[0],
    );
    expect(publish).toHaveBeenCalledWith(
      Topics.CREDENTIAL_ISSUED,
      { workerId, credentialNumber },
      correlationId,
    );
  });

  it.each([
    revokedCredential,
    { ...revokedCredential, note: 'Reported at gate' },
  ])('publishes the saved reason and optional note for %j', async (input) => {
    repository.revokeCredential.mockResolvedValueOnce(true);
    const revoked = await service.revoke(workerId, input, correlationId);

    expect(revoked).toEqual({ ...input, revokedAt: expect.any(Date) });
    expect(repository.revokeCredential).toHaveBeenCalledWith(
      workerId,
      input,
      revoked.revokedAt,
    );
    expect(publish).toHaveBeenCalledWith(
      Topics.CREDENTIAL_REVOKED,
      { workerId, ...input },
      correlationId,
    );
  });

  it('reports the conflict on a visible worker who cannot be issued another credential', async () => {
    repository.issueCredential.mockResolvedValueOnce(false);
    repository.existsVisible.mockResolvedValueOnce({ _id: workerId });
    await expect(
      service.issue(workerId, credentialNumber, correlationId),
    ).rejects.toMatchObject({ code: 'CREDENTIAL_IN_USE' });
    expect(publish).not.toHaveBeenCalled();
  });

  it('reports an inactive credential when a repeated revocation changes nothing', async () => {
    repository.revokeCredential.mockResolvedValueOnce(false);
    repository.existsVisible.mockResolvedValueOnce({ _id: workerId });
    await expect(
      service.revoke(workerId, revokedCredential, correlationId),
    ).rejects.toMatchObject({ code: 'CREDENTIAL_NOT_ACTIVE' });
    expect(publish).not.toHaveBeenCalled();
  });

  it.each([
    [
      'issueCredential',
      (credentials: WorkerCredentialsService) =>
        credentials.issue(workerId, credentialNumber, correlationId),
    ],
    [
      'revokeCredential',
      (credentials: WorkerCredentialsService) =>
        credentials.revoke(workerId, revokedCredential, correlationId),
    ],
  ] as const)(
    'reports a missing worker when %s finds no visible record',
    async (method, action) => {
      repository[method].mockResolvedValueOnce(false);
      repository.existsVisible.mockResolvedValueOnce(null);
      await expect(action(service)).rejects.toMatchObject({
        code: 'WORKER_NOT_FOUND',
      });
      expect(publish).not.toHaveBeenCalled();
    },
  );

  it('preserves a duplicate-number error and does not publish', async () => {
    const failure = new DomainError(
      'CREDENTIAL_IN_USE',
      'This credential is already in use',
    );
    repository.issueCredential.mockRejectedValueOnce(failure);
    await expect(
      service.issue(workerId, credentialNumber, correlationId),
    ).rejects.toBe(failure);
    expect(publish).not.toHaveBeenCalled();
  });

  it('publishes nothing after a failed revocation write', async () => {
    const failure = new Error('Database unavailable');
    repository.revokeCredential.mockRejectedValueOnce(failure);
    await expect(
      service.revoke(workerId, revokedCredential, correlationId),
    ).rejects.toBe(failure);
    expect(publish).not.toHaveBeenCalled();
  });

  it('reports an unconfirmed event after saving a credential change', async () => {
    const failure = new Error('Broker unavailable');
    repository.issueCredential.mockResolvedValueOnce(true);
    publish.mockRejectedValueOnce(failure);

    await expect(
      service.issue(workerId, credentialNumber, correlationId),
    ).rejects.toMatchObject({ code: 'CREDENTIAL_EVENT_UNCONFIRMED' });
    expect(repository.issueCredential).toHaveBeenCalledTimes(1);
    expect(workerLogger.error).toHaveBeenCalledWith(
      {
        err: failure,
        workerId,
        correlationId,
        topic: Topics.CREDENTIAL_ISSUED,
      },
      expect.any(String),
    );
  });
});
