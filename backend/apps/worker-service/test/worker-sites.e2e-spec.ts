import { Topics } from '@app/contracts';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { type Model, Types } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { requestLogging } from '../src/common/request-logging.middleware';
import { Contractor } from '../src/contractors/schemas/contractor.schema';
import { WorkerServiceModule } from '../src/worker-service.module';
import { WorkerEventsProducer } from '../src/workers/events/worker-events.producer';
import { Worker } from '../src/workers/schemas/worker.schema';

describe('Worker site assignments (e2e)', () => {
  const publish = jest.fn();
  const adminToken = 'sitegate-site-assignment-tests-only';
  const authorization = `Bearer ${adminToken}`;
  const correlationId = 'd17f3a9a-efea-4ddd-959a-2ce8128871c5';
  let app: INestApplication<App>;
  let workers: Model<Worker>;
  let contractorId: Types.ObjectId;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [WorkerServiceModule],
    })
      .overrideProvider(WorkerEventsProducer)
      .useValue({ publish })
      .compile();
    app = moduleRef.createNestApplication();
    app.use(requestLogging);
    app.get(ConfigService).set('WORKER_ADMIN_TOKEN', adminToken);
    await app.init();

    workers = app.get<Model<Worker>>(getModelToken(Worker.name));
    await workers.init();
    const contractors = app.get<Model<Contractor>>(
      getModelToken(Contractor.name),
    );
    const contractor = await contractors.create({
      name: 'Site Test Contractor',
    });
    contractorId = contractor._id;
  });

  beforeEach(() => {
    publish.mockReset().mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app?.close();
  });

  async function seed(overrides: Partial<Worker> = {}) {
    const worker = await workers.create({
      fullName: 'Site Test Worker',
      contractorId,
      inductionDate: new Date('2026-11-18'),
      safetyTicketExpiry: new Date('2027-02-28'),
      ...overrides,
    });
    return worker._id.toString();
  }

  function sites(id: string, method: 'post' | 'delete', input: object) {
    return request(app.getHttpServer())
      [method](`/workers/${id}/sites`)
      .set('Authorization', authorization)
      .set('x-correlation-id', correlationId)
      .send(input);
  }

  it('stores a site once and publishes only real changes to the complete list', async () => {
    const id = await seed({ assignedSiteIds: ['S-02'] });
    const added = { assignedSiteIds: ['S-02', 'S-01'] };
    await Promise.all([
      sites(id, 'post', { siteId: ' S-01 ' }).expect(200, added),
      sites(id, 'post', { siteId: 'S-01' }).expect(200, added),
    ]);
    expect((await workers.findById(id).orFail()).assignedSiteIds).toEqual(
      added.assignedSiteIds,
    );
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenNthCalledWith(
      1,
      Topics.WORKER_UPDATED,
      { workerId: id, siteIds: ['S-02', 'S-01'] },
      correlationId,
    );

    const removed = { assignedSiteIds: ['S-02'] };
    await sites(id, 'delete', { siteId: 'S-01' }).expect(200, removed);
    await sites(id, 'delete', { siteId: 'S-01' }).expect(200, removed);
    expect((await workers.findById(id).orFail()).assignedSiteIds).toEqual(
      removed.assignedSiteIds,
    );
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenNthCalledWith(
      2,
      Topics.WORKER_UPDATED,
      { workerId: id, siteIds: ['S-02'] },
      correlationId,
    );
  });

  it('removes all older duplicates and publishes an empty list for the last site', async () => {
    const id = await seed({ assignedSiteIds: ['S-01', 'S-01'] });
    await sites(id, 'delete', { siteId: 'S-01' }).expect(200, {
      assignedSiteIds: [],
    });
    expect((await workers.findById(id).orFail()).assignedSiteIds).toEqual([]);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      Topics.WORKER_UPDATED,
      { workerId: id, siteIds: [] },
      correlationId,
    );
  });

  it('stores each site once when a worker is first registered', async () => {
    const credentialNumber = 'SITE-REGISTRATION-01';
    const registration = await request(app.getHttpServer())
      .post('/workers')
      .set('Authorization', authorization)
      .send({
        fullName: 'Registered Site Worker',
        contractorId: contractorId.toString(),
        credentialNumber,
        inductionDate: '2026-11-18',
        safetyTicketExpiry: '2027-02-28',
        assignedSiteIds: ['S-01', ' S-01 ', 'S-02'],
      })
      .expect(201);
    const saved = await workers
      .findOne({ 'credentials.number': credentialNumber })
      .orFail();
    expect(saved.assignedSiteIds).toEqual(['S-01', 'S-02']);
    expect(registration.body).toMatchObject({
      assignedSiteIds: ['S-01', 'S-02'],
    });
    expect(publish).toHaveBeenCalledWith(
      Topics.WORKER_CREATED,
      expect.objectContaining({ siteIds: ['S-01', 'S-02'] }),
      expect.any(String),
    );
  });

  it('rejects unauthorized or invalid edits without writing or publishing', async () => {
    const id = await seed();
    const http = request(app.getHttpServer());
    for (const method of ['post', 'delete'] as const) {
      await http[method](`/workers/${id}/sites`)
        .send({ siteId: 'S-01' })
        .expect(401);
      await sites(id, method, { siteId: '  ' }).expect(400);
      await sites(id, method, { siteId: 1 }).expect(400);
    }
    expect((await workers.findById(id).orFail()).assignedSiteIds).toEqual([]);
    expect(publish).not.toHaveBeenCalled();
  });

  it('returns WORKER_NOT_FOUND for missing and archived workers', async () => {
    const missing = new Types.ObjectId().toString();
    const archived = await seed({
      deletedAt: new Date(),
      assignedSiteIds: ['S-01'],
    });
    for (const id of [missing, archived]) {
      for (const method of ['post', 'delete'] as const) {
        const response = await sites(id, method, { siteId: 'S-01' }).expect(
          404,
        );
        expect(response.body).toMatchObject({ code: 'WORKER_NOT_FOUND' });
      }
    }
    expect(publish).not.toHaveBeenCalled();
  });
});
