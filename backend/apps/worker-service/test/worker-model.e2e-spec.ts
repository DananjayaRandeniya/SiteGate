import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import type { Connection, Model, Types } from 'mongoose';
import { Contractor } from '../src/contractors/schemas/contractor.schema';
import { WorkerServiceModule } from '../src/worker-service.module';
import { Worker } from '../src/workers/schemas/worker.schema';

describe('Worker models (e2e)', () => {
  let moduleFixture: TestingModule;
  let workers: Model<Worker>;
  let contractorId: Types.ObjectId;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [WorkerServiceModule],
    }).compile();
    const connection = moduleFixture.get<Connection>(getConnectionToken());
    expect(connection.name).toBe('workers_db');

    const contractors = moduleFixture.get<Model<Contractor>>(
      getModelToken(Contractor.name),
    );
    workers = moduleFixture.get<Model<Worker>>(getModelToken(Worker.name));
    await workers.init();
    const contractor = await contractors.create({ name: 'Test Contractor' });
    contractorId = contractor._id;
  });

  afterAll(async () => {
    await moduleFixture?.close();
  });

  function workerDetails(fullName: string) {
    return {
      fullName,
      contractorId,
      inductionDate: new Date('2026-11-20'),
      safetyTicketExpiry: new Date('2027-11-20'),
    };
  }

  it('stores a contractor reference, timestamps, and the worker defaults', async () => {
    const worker = await workers.create(workerDetails('Maya'));
    const secondWorker = await workers.create(workerDetails('Lina'));
    expect(secondWorker.credentials).toHaveLength(0);
    expect(worker.toObject()).toMatchObject({
      contractorId,
      status: 'Active',
      assignedSiteIds: [],
      credentials: [],
      deletedAt: null,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
  });

  it('keeps just one card claim when two workers claim it at once', async () => {
    const credentials = [{ number: 'RACE-01' }];
    const results = await Promise.allSettled([
      workers.create({ ...workerDetails('First worker'), credentials }),
      workers.create({ ...workerDetails('Second worker'), credentials }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === 'rejected'),
    ).toMatchObject({
      reason: { code: 11000 },
    });
  });

  it('reserves a revoked number even after its worker is archived', async () => {
    await workers.create({
      ...workerDetails('Archived worker'),
      deletedAt: new Date(),
      credentials: [{ number: 'REVOKED-01', revokedAt: new Date() }],
    });

    await expect(
      workers.create({
        ...workerDetails('New worker'),
        credentials: [{ number: 'REVOKED-01' }],
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('rejects two active cards on a single worker', async () => {
    await expect(
      workers.create({
        ...workerDetails('Double card attempt'),
        credentials: [{ number: 'DOUBLE-01' }, { number: 'DOUBLE-02' }],
      }),
    ).rejects.toThrow('only one credential may be active');
  });
});
