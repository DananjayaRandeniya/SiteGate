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

describe('Worker profile (e2e)', () => {
  const publish = jest.fn();
  const adminToken = 'sitegate-profile-tests-only-admin-token';
  const correlationId = 'd17f3a9a-efea-4ddd-959a-2ce8128871c5';
  let app: INestApplication<App>;
  let workers: Model<Worker>;
  let currentContractor: Types.ObjectId;
  let nextContractor: string;
  let archivedContractor: string;

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
    const [current, next, archived] = await contractors.create([
      { name: 'Current Profile Contractor' },
      { name: 'Next Profile Contractor' },
      { name: 'Archived Profile Contractor', deletedAt: new Date() },
    ]);
    currentContractor = current._id;
    nextContractor = next._id.toString();
    archivedContractor = archived._id.toString();
  });

  beforeEach(() => {
    publish.mockReset().mockResolvedValue(undefined);
    // It is already November 23 in Colombo and still November 22 in UTC.
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-22T19:00:00Z'));
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await app?.close();
  });

  function seed(overrides: Partial<Worker> = {}) {
    const credential = new Types.ObjectId().toString();
    return workers.create({
      fullName: 'Profile Test Worker',
      contractorId: currentContractor,
      inductionDate: new Date('2026-11-18'),
      safetyTicketExpiry: new Date('2027-02-28'),
      assignedSiteIds: ['S-01'],
      credentials: [{ number: credential }],
      ...overrides,
    });
  }

  function patch(id: string, input: object) {
    return request(app.getHttpServer())
      .patch(`/workers/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-correlation-id', correlationId)
      .send(input);
  }

  it('reads a profile and publishes only the fields changed by an edit', async () => {
    const worker = await seed();
    const id = worker._id.toString();
    const http = request(app.getHttpServer());

    await http.get(`/workers/${id}`).expect(200, {
      id,
      fullName: worker.fullName,
      contractorId: currentContractor.toString(),
      credentialNumber: worker.credentials[0].number,
      inductionDate: '2026-11-18',
      safetyTicketExpiry: '2027-02-28',
      assignedSiteIds: ['S-01'],
      status: 'Active',
    });
    expect(publish).not.toHaveBeenCalled();

    publish.mockImplementationOnce(async () => {
      const saved = await workers.findById(id).orFail();
      expect(saved.safetyTicketExpiry).toEqual(new Date('2027-04-30'));
      expect(saved.fullName).toBe(worker.fullName);
    });
    const updated = await patch(id, {
      fullName: `  ${worker.fullName}  `,
      safetyTicketExpiry: '2027-04-30',
    }).expect(200);
    expect(updated.headers['x-correlation-id']).toBe(correlationId);
    expect(updated.body).toMatchObject({
      fullName: worker.fullName,
      safetyTicketExpiry: '2027-04-30',
      assignedSiteIds: ['S-01'],
    });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      Topics.WORKER_UPDATED,
      { workerId: id, ticketExpiry: '2027-04-30' },
      correlationId,
    );
    await http.get(`/workers/${id}`).expect(200, updated.body as object);
    await patch(id, { safetyTicketExpiry: '2027-04-30' }).expect(200);
    await patch(id, {}).expect(200);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('accepts Colombo today and a new active contractor', async () => {
    const id = (await seed())._id.toString();

    await patch(id, {
      contractorId: nextContractor,
      inductionDate: '2026-11-23',
    }).expect(200);
    expect(publish).toHaveBeenCalledWith(
      Topics.WORKER_UPDATED,
      {
        workerId: id,
        contractorId: nextContractor,
        inductionDate: '2026-11-23',
      },
      correlationId,
    );
  });

  it('rejects unauthorized edits and preserves the original profile', async () => {
    const worker = await seed();
    await request(app.getHttpServer())
      .patch(`/workers/${worker._id.toString()}`)
      .send({ fullName: 'Unauthorized change' })
      .expect(401);
    expect((await workers.findById(worker._id).orFail()).fullName).toBe(
      worker.fullName,
    );
    expect(publish).not.toHaveBeenCalled();
  });

  it.each([
    { assignedSiteIds: ['S-02'] },
    { credentialNumber: 'NEW-CREDENTIAL' },
    { status: 'Inactive' },
    { fullName: null },
    { inductionDate: '2026-11-24' },
    { safetyTicketExpiry: '2027-02-30' },
  ])('rejects invalid profile input %j', async (input) => {
    const id = (await seed())._id.toString();
    await patch(id, input).expect(400);
    expect(publish).not.toHaveBeenCalled();
  });

  it('returns 404 for missing or archived workers and an unavailable contractor', async () => {
    const archived = await seed({ deletedAt: new Date() });
    for (const id of [
      new Types.ObjectId().toString(),
      archived._id.toString(),
    ]) {
      const read = await request(app.getHttpServer())
        .get(`/workers/${id}`)
        .expect(404);
      const edit = await patch(id, { fullName: 'Unavailable Worker' }).expect(
        404,
      );
      expect(read.body).toMatchObject({ code: 'WORKER_NOT_FOUND' });
      expect(edit.body).toMatchObject({ code: 'WORKER_NOT_FOUND' });
    }
    const id = (await seed())._id.toString();
    const edit = await patch(id, { contractorId: archivedContractor }).expect(
      404,
    );
    expect(edit.body).toMatchObject({ code: 'CONTRACTOR_NOT_FOUND' });
    expect(publish).not.toHaveBeenCalled();
  });

  it('preserves separate fields when two profile edits run concurrently', async () => {
    const id = (await seed())._id.toString();
    await Promise.all([
      patch(id, { fullName: 'Updated Profile Name' }).expect(200),
      patch(id, { safetyTicketExpiry: '2027-06-30' }).expect(200),
    ]);
    const saved = await workers.findById(id).orFail();
    expect(saved.fullName).toBe('Updated Profile Name');
    expect(saved.safetyTicketExpiry).toEqual(new Date('2027-06-30'));
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith(
      Topics.WORKER_UPDATED,
      { workerId: id, name: 'Updated Profile Name' },
      correlationId,
    );
    expect(publish).toHaveBeenCalledWith(
      Topics.WORKER_UPDATED,
      { workerId: id, ticketExpiry: '2027-06-30' },
      correlationId,
    );
  });

  it('reports an unconfirmed update event and keeps the saved edit', async () => {
    const id = (await seed())._id.toString();
    publish.mockRejectedValueOnce(new Error('Test broker unavailable'));

    const response = await patch(id, { fullName: 'Saved Profile Name' }).expect(
      503,
    );
    expect(response.body).toMatchObject({
      code: 'WORKER_UPDATE_EVENT_UNCONFIRMED',
      correlationId,
    });
    expect((await workers.findById(id).orFail()).fullName).toBe(
      'Saved Profile Name',
    );
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
