import { DeactivationReason, Topics, WorkerStatus } from '@app/contracts';
import { Test, type TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { DomainError } from '../common/domain-error';
import { workerLogger } from '../common/logger';
import { ContractorsService } from '../contractors/contractors.service';
import { WorkerEventsProducer } from './events/worker-events.producer';
import type { Worker } from './schemas/worker.schema';
import { WorkersRepository } from './workers.repository';
import { WorkersService } from './workers.service';

const workerId = '669f2a62d20bae6882af1871';
const contractorId = '669f2a62d20bae6882af1870';
const nextContractorId = '669f2a62d20bae6882af1872';
const correlationId = 'd17f3a9a-efea-4ddd-959a-2ce8128871c5';
const registration = {
  fullName: 'Test Worker',
  contractorId,
  credentialNumber: 'C-1001',
  inductionDate: '2026-11-18',
  safetyTicketExpiry: '2027-02-28',
  assignedSiteIds: ['S-01'],
};
const worker = {
  _id: new Types.ObjectId(workerId),
  fullName: registration.fullName,
  contractorId: new Types.ObjectId(contractorId),
  inductionDate: new Date(registration.inductionDate),
  safetyTicketExpiry: new Date(registration.safetyTicketExpiry),
  assignedSiteIds: registration.assignedSiteIds,
  status: WorkerStatus.ACTIVE,
  deletedAt: null,
  credentials: [
    {
      number: registration.credentialNumber,
      issuedAt: new Date('2026-11-18'),
      revokedAt: null,
    },
  ],
} satisfies Worker & { _id: Types.ObjectId };

describe('WorkersService', () => {
  const repository = {
    create: jest.fn(),
    listVisible: jest.fn(),
    findVisibleById: jest.fn(),
    deactivate: jest.fn(),
    existsVisible: jest.fn(),
    archive: jest.fn(),
    updateVisibleProfile: jest.fn(),
    assignSite: jest.fn(),
    unassignSite: jest.fn(),
  };
  const contractors = { get: jest.fn(), namesByIds: jest.fn() };
  const publish = jest.fn();
  let moduleRef: TestingModule;
  let service: WorkersService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        WorkersService,
        { provide: WorkersRepository, useValue: repository },
        { provide: ContractorsService, useValue: contractors },
        { provide: WorkerEventsProducer, useValue: { publish } },
      ],
    }).compile();
    service = moduleRef.get(WorkersService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    repository.create.mockResolvedValue(worker);
    repository.findVisibleById.mockResolvedValue(worker);
    contractors.get.mockResolvedValue({
      id: contractorId,
      name: 'Test Contractor',
    });
    publish.mockResolvedValue(undefined);
    jest.spyOn(workerLogger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(() => moduleRef.close());

  it('checks the contractor and publishes both registration events after saving', async () => {
    const saved = {
      ...registration,
      id: workerId,
      status: WorkerStatus.ACTIVE,
    };
    await expect(
      service.register(registration, correlationId),
    ).resolves.toEqual(saved);
    expect(contractors.get).toHaveBeenCalledWith(contractorId);
    expect(repository.create).toHaveBeenCalledWith(registration);
    expect(repository.create.mock.invocationCallOrder[0]).toBeLessThan(
      publish.mock.invocationCallOrder[0],
    );
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenNthCalledWith(
      1,
      Topics.WORKER_CREATED,
      {
        workerId,
        name: saved.fullName,
        contractorId,
        siteIds: saved.assignedSiteIds,
        inductionDate: saved.inductionDate,
        ticketExpiry: saved.safetyTicketExpiry,
      },
      correlationId,
    );
    expect(publish).toHaveBeenNthCalledWith(
      2,
      Topics.CREDENTIAL_ISSUED,
      { workerId, credentialNumber: saved.credentialNumber },
      correlationId,
    );
  });

  it('stops before writing or publishing when the contractor is unavailable', async () => {
    const failure = new DomainError(
      'CONTRACTOR_NOT_FOUND',
      'Contractor missing',
    );
    contractors.get.mockRejectedValueOnce(failure);

    await expect(service.register(registration, correlationId)).rejects.toBe(
      failure,
    );
    expect(repository.create).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a credential conflict',
      new DomainError('CREDENTIAL_IN_USE', 'Card already used'),
    ],
    ['a database write failure', new Error('Database unavailable')],
  ])('publishes nothing when registration hits %s', async (_case, failure) => {
    repository.create.mockRejectedValueOnce(failure);

    await expect(service.register(registration, correlationId)).rejects.toBe(
      failure,
    );
    expect(publish).not.toHaveBeenCalled();
  });

  it.each([
    [0, Topics.WORKER_CREATED],
    [1, Topics.CREDENTIAL_ISSUED],
  ])(
    'reports the unconfirmed registration event after %i successful sends',
    async (confirmed, topic) => {
      const failure = new Error('Broker unavailable');
      if (confirmed === 1) publish.mockResolvedValueOnce(undefined);
      publish.mockRejectedValueOnce(failure);

      await expect(
        service.register(registration, correlationId),
      ).rejects.toMatchObject({
        code: 'REGISTRATION_EVENT_UNCONFIRMED',
      });
      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledTimes(confirmed + 1);
      expect(workerLogger.error).toHaveBeenCalledWith(
        { err: failure, workerId, correlationId, unconfirmedTopic: topic },
        expect.any(String),
      );
    },
  );

  it('joins the page with contractor names and returns the requested pagination metadata', async () => {
    const historicWorker = {
      ...worker,
      _id: new Types.ObjectId(),
      contractorId: new Types.ObjectId(nextContractorId),
      credentials: [{ ...worker.credentials[0], revokedAt: new Date() }],
    };
    const query = { page: 2, limit: 2 };
    repository.listVisible.mockResolvedValueOnce({
      workers: [worker, historicWorker],
      total: 5,
    });
    contractors.namesByIds.mockResolvedValueOnce(
      new Map([[contractorId, 'Test Contractor']]),
    );

    await expect(service.list(query)).resolves.toMatchObject({
      items: [
        {
          id: workerId,
          contractorName: 'Test Contractor',
          credentialNumber: 'C-1001',
        },
        {
          id: historicWorker._id.toString(),
          contractorName: null,
          credentialNumber: null,
        },
      ],
      page: 2,
      limit: 2,
      total: 5,
      totalPages: 3,
    });
    expect(repository.listVisible).toHaveBeenCalledWith(query);
    expect(contractors.namesByIds).toHaveBeenCalledWith([
      worker.contractorId,
      historicWorker.contractorId,
    ]);
    expect(publish).not.toHaveBeenCalled();
  });

  it('reads a visible worker and reports a missing profile', async () => {
    await expect(service.get(workerId)).resolves.toEqual({
      ...registration,
      id: workerId,
      status: WorkerStatus.ACTIVE,
    });
    repository.findVisibleById.mockResolvedValueOnce(null);

    await expect(service.get(workerId)).rejects.toMatchObject({
      code: 'WORKER_NOT_FOUND',
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it('writes validated profile changes and publishes their contract field names', async () => {
    const input = {
      fullName: 'New Name',
      contractorId: nextContractorId.toUpperCase(),
      inductionDate: '2026-11-19',
      safetyTicketExpiry: '2027-04-30',
    };
    repository.updateVisibleProfile.mockResolvedValueOnce(worker);

    await expect(
      service.update(workerId, input, correlationId),
    ).resolves.toMatchObject({
      ...input,
      contractorId: nextContractorId,
      credentialNumber: 'C-1001',
      assignedSiteIds: ['S-01'],
    });
    expect(contractors.get).toHaveBeenCalledWith(nextContractorId);
    expect(repository.updateVisibleProfile).toHaveBeenCalledWith(workerId, {
      fullName: input.fullName,
      contractorId: new Types.ObjectId(nextContractorId),
      inductionDate: new Date(input.inductionDate),
      safetyTicketExpiry: new Date(input.safetyTicketExpiry),
    });
    expect(publish).toHaveBeenCalledWith(
      Topics.WORKER_UPDATED,
      {
        workerId,
        name: input.fullName,
        contractorId: nextContractorId,
        inductionDate: input.inductionDate,
        ticketExpiry: input.safetyTicketExpiry,
      },
      correlationId,
    );
  });

  it('rejects a change to an unavailable contractor before writing', async () => {
    const failure = new DomainError(
      'CONTRACTOR_NOT_FOUND',
      'Contractor missing',
    );
    contractors.get.mockRejectedValueOnce(failure);

    await expect(
      service.update(
        workerId,
        { contractorId: nextContractorId },
        correlationId,
      ),
    ).rejects.toBe(failure);
    expect(repository.updateVisibleProfile).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it.each([{}, { contractorId: contractorId.toUpperCase() }])(
    'leaves an unmodified profile alone for %j',
    async (input) => {
      await expect(
        service.update(workerId, input, correlationId),
      ).resolves.toMatchObject({
        id: workerId,
      });
      expect(contractors.get).not.toHaveBeenCalled();
      expect(repository.updateVisibleProfile).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    },
  );

  it('does not publish when a date normalization leaves the visible date unchanged', async () => {
    repository.updateVisibleProfile.mockResolvedValueOnce({
      ...worker,
      inductionDate: new Date('2026-11-18T10:00:00Z'),
    });
    await expect(
      service.update(workerId, { inductionDate: '2026-11-18' }, correlationId),
    ).resolves.toMatchObject({ inductionDate: '2026-11-18' });
    expect(publish).not.toHaveBeenCalled();
  });

  it('reads the current profile when an atomic update is a no-op', async () => {
    repository.updateVisibleProfile.mockResolvedValueOnce(null);
    await expect(
      service.update(workerId, { fullName: worker.fullName }, correlationId),
    ).resolves.toMatchObject({ id: workerId, fullName: worker.fullName });
    expect(publish).not.toHaveBeenCalled();
  });

  it('reports a missing worker when the profile update cannot find a visible record', async () => {
    repository.updateVisibleProfile.mockResolvedValueOnce(null);
    repository.findVisibleById.mockResolvedValueOnce(null);
    await expect(
      service.update(workerId, { fullName: 'Changed' }, correlationId),
    ).rejects.toMatchObject({ code: 'WORKER_NOT_FOUND' });
    expect(publish).not.toHaveBeenCalled();
  });

  it.each([
    ['assign', 'assignSite', ['S-01', 'S-02']],
    ['unassign', 'unassignSite', []],
  ] as const)(
    'sends the complete site list after %s',
    async (action, method, assignedSiteIds) => {
      repository[method].mockResolvedValueOnce({ ...worker, assignedSiteIds });

      await expect(
        service.changeSiteAssignment(workerId, 'S-01', action, correlationId),
      ).resolves.toEqual({ assignedSiteIds });
      expect(repository[method]).toHaveBeenCalledWith(workerId, 'S-01');
      expect(publish).toHaveBeenCalledWith(
        Topics.WORKER_UPDATED,
        { workerId, siteIds: assignedSiteIds },
        correlationId,
      );
    },
  );

  it('returns the stored list when site membership is unchanged', async () => {
    repository.assignSite.mockResolvedValueOnce(null);
    await expect(
      service.changeSiteAssignment(workerId, 'S-01', 'assign', correlationId),
    ).resolves.toEqual({ assignedSiteIds: ['S-01'] });
    expect(publish).not.toHaveBeenCalled();
  });

  it('reports a failed update publication after the site change was saved', async () => {
    repository.unassignSite.mockResolvedValueOnce({
      ...worker,
      assignedSiteIds: [],
    });
    publish.mockRejectedValueOnce(new Error('Broker unavailable'));
    await expect(
      service.changeSiteAssignment(workerId, 'S-01', 'unassign', correlationId),
    ).rejects.toMatchObject({ code: 'WORKER_UPDATE_EVENT_UNCONFIRMED' });
    expect(repository.unassignSite).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('publishes one deactivation and skips a retry on an already inactive worker', async () => {
    repository.deactivate
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    repository.existsVisible.mockResolvedValueOnce(true);
    await expect(
      service.deactivate(
        workerId.toUpperCase(),
        { reason: DeactivationReason.LEFT_COMPANY, note: 'Final shift' },
        correlationId,
      ),
    ).resolves.toEqual({ id: workerId, status: WorkerStatus.INACTIVE });
    await service.deactivate(workerId, undefined, correlationId);

    expect(repository.deactivate).toHaveBeenNthCalledWith(
      2,
      workerId,
      DeactivationReason.OTHER,
      undefined,
    );
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      Topics.WORKER_DEACTIVATED,
      {
        workerId,
        reason: DeactivationReason.LEFT_COMPANY,
        note: 'Final shift',
      },
      correlationId,
    );
  });

  it('reports a missing worker when deactivation finds no visible record', async () => {
    repository.deactivate.mockResolvedValueOnce(false);
    repository.existsVisible.mockResolvedValueOnce(null);
    await expect(
      service.deactivate(workerId, {}, correlationId),
    ).rejects.toMatchObject({ code: 'WORKER_NOT_FOUND' });
    expect(publish).not.toHaveBeenCalled();
  });

  it('uses the shared default reason when none was supplied', async () => {
    repository.deactivate.mockResolvedValueOnce(true);
    await service.deactivate(workerId, undefined, correlationId);
    expect(repository.deactivate).toHaveBeenCalledWith(
      workerId,
      DeactivationReason.OTHER,
      undefined,
    );
    expect(publish).toHaveBeenCalledWith(
      Topics.WORKER_DEACTIVATED,
      { workerId, reason: DeactivationReason.OTHER },
      correlationId,
    );
  });

  it('only announces deactivation when an archive made an active worker inactive', async () => {
    repository.archive.mockResolvedValueOnce(worker).mockResolvedValueOnce({
      ...worker,
      status: WorkerStatus.INACTIVE,
    });
    await service.archive(workerId, correlationId);
    await service.archive(workerId, correlationId);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      Topics.WORKER_DEACTIVATED,
      { workerId, reason: DeactivationReason.OTHER, note: 'Worker archived' },
      correlationId,
    );
  });

  it('reports a missing worker when archive makes no change', async () => {
    repository.archive.mockResolvedValueOnce(null);
    await expect(
      service.archive(workerId, correlationId),
    ).rejects.toMatchObject({ code: 'WORKER_NOT_FOUND' });
    expect(publish).not.toHaveBeenCalled();
  });

  it('reports a failed deactivation publication after archiving', async () => {
    repository.archive.mockResolvedValueOnce(worker);
    publish.mockRejectedValueOnce(new Error('Broker unavailable'));
    await expect(
      service.archive(workerId, correlationId),
    ).rejects.toMatchObject({ code: 'WORKER_DEACTIVATION_EVENT_UNCONFIRMED' });
    expect(repository.archive).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'updateVisibleProfile',
      (workers: WorkersService) =>
        workers.update(workerId, { fullName: 'New Name' }, correlationId),
    ],
    [
      'assignSite',
      (workers: WorkersService) =>
        workers.changeSiteAssignment(workerId, 'S-01', 'assign', correlationId),
    ],
    [
      'unassignSite',
      (workers: WorkersService) =>
        workers.changeSiteAssignment(
          workerId,
          'S-01',
          'unassign',
          correlationId,
        ),
    ],
    [
      'deactivate',
      (workers: WorkersService) =>
        workers.deactivate(workerId, {}, correlationId),
    ],
    [
      'archive',
      (workers: WorkersService) => workers.archive(workerId, correlationId),
    ],
  ] as const)(
    'publishes nothing when %s fails to write',
    async (method, action) => {
      const failure = new Error('Database unavailable');
      repository[method].mockRejectedValueOnce(failure);
      await expect(action(service)).rejects.toBe(failure);
      expect(publish).not.toHaveBeenCalled();
    },
  );
});
