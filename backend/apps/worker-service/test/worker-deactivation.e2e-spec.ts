import { DeactivationReason, Topics, WorkerStatus } from '@app/contracts';
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

describe('Worker deactivation and archive (e2e)', () => {
  const publish = jest.fn();
  const adminToken = 'sitegate-deactivation-tests-only-admin-token';
  const correlationId = 'd17f3a9a-efea-4ddd-959a-2ce8128871c5';
  let app: INestApplication<App>;
  let workers: Model<Worker>;
  let contractorId: Types.ObjectId;

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [WorkerServiceModule],
    })
      .overrideProvider(WorkerEventsProducer)
      .useValue({ publish })
      .compile();
    app = testingModule.createNestApplication();
    app.use(requestLogging);
    app.get(ConfigService).set('WORKER_ADMIN_TOKEN', adminToken);
    await app.init();

    workers = app.get<Model<Worker>>(getModelToken(Worker.name));
    await workers.init();
    const contractors = app.get<Model<Contractor>>(
      getModelToken(Contractor.name),
    );
    const contractor = await contractors.create({
      name: 'Deactivation Test Contractor',
    });
    contractorId = contractor._id;
  });

  beforeEach(() => {
    publish.mockReset().mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app?.close();
  });

  async function seed() {
    const worker = await workers.create({
      fullName: 'Deactivation Test Worker',
      contractorId,
      inductionDate: new Date('2026-11-18'),
      safetyTicketExpiry: new Date('2027-02-28'),
      assignedSiteIds: ['S-01'],
      credentials: [
        { number: `DEACTIVATION-${new Types.ObjectId().toString()}` },
      ],
    });
    return worker._id.toString();
  }

  function deactivate(id: string, body?: object) {
    const operation = request(app.getHttpServer())
      .patch(`/workers/${id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-correlation-id', correlationId);
    return body === undefined ? operation : operation.send(body);
  }

  function archive(id: string) {
    return request(app.getHttpServer())
      .delete(`/workers/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-correlation-id', correlationId);
  }

  it('saves Inactive before publishing and leaves the profile readable', async () => {
    const id = await seed();
    const reason = DeactivationReason.CONTRACT_ENDED;
    const note = 'Project finished';
    publish.mockImplementationOnce(async () => {
      const saved = await workers.findById(id).orFail();
      expect(saved).toMatchObject({
        status: WorkerStatus.INACTIVE,
        deletedAt: null,
        deactivationReason: reason,
        deactivationNote: note,
      });
    });

    await deactivate(id.toUpperCase(), { reason, note: ` ${note} ` }).expect(
      200,
      { id, status: WorkerStatus.INACTIVE },
    );
    const reply = await request(app.getHttpServer())
      .get(`/workers/${id}`)
      .expect(200);
    expect(reply.body).toMatchObject({
      id,
      status: WorkerStatus.INACTIVE,
      assignedSiteIds: ['S-01'],
    });
    await deactivate(id, { reason: DeactivationReason.OTHER }).expect(200);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      Topics.WORKER_DEACTIVATED,
      { workerId: id, reason, note },
      correlationId,
    );
    expect((await workers.findById(id).orFail()).deactivationReason).toBe(
      reason,
    );
  });

  it('archives an active worker and publishes one deactivation event', async () => {
    const id = await seed();
    await archive(id).expect(204);
    const saved = await workers.findById(id).orFail();
    expect(saved.deletedAt).toBeInstanceOf(Date);
    expect(saved.status).toBe(WorkerStatus.INACTIVE);
    expect(saved.credentials).toHaveLength(1);
    expect(saved.assignedSiteIds).toEqual(['S-01']);
    const reply = await request(app.getHttpServer())
      .get(`/workers/${id}`)
      .expect(404);
    expect(reply.body).toMatchObject({ code: 'WORKER_NOT_FOUND' });
    await archive(id).expect(404);
    await deactivate(id).expect(404);
    expect((await workers.findById(id).orFail()).deletedAt).toEqual(
      saved.deletedAt,
    );
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      Topics.WORKER_DEACTIVATED,
      {
        workerId: id,
        reason: DeactivationReason.OTHER,
        note: 'Worker archived',
      },
      correlationId,
    );
  });

  it('archives an already inactive worker without repeating the event', async () => {
    const id = await seed();
    await deactivate(id).expect(200);
    expect(publish).toHaveBeenCalledWith(
      Topics.WORKER_DEACTIVATED,
      { workerId: id, reason: DeactivationReason.OTHER },
      correlationId,
    );
    publish.mockClear();
    await archive(id).expect(204);
    expect((await workers.findById(id).orFail()).deletedAt).toBeInstanceOf(
      Date,
    );
    expect(publish).not.toHaveBeenCalled();
  });

  it('publishes one event when deactivate and archive race', async () => {
    const id = await seed();
    const [changed, archived] = await Promise.all([
      deactivate(id),
      archive(id),
    ]);
    expect([200, 404]).toContain(changed.status);
    expect(archived.status).toBe(204);
    const saved = await workers.findById(id).orFail();
    expect(saved.status).toBe(WorkerStatus.INACTIVE);
    expect(saved.deletedAt).toBeInstanceOf(Date);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('rejects unauthorized or invalid requests and missing workers', async () => {
    const id = await seed();
    const http = request(app.getHttpServer());
    await http.patch(`/workers/${id}/deactivate`).send({}).expect(401);
    await http.delete(`/workers/${id}`).expect(401);
    await deactivate(id, { reason: 'CONTRACT_COMPLETED' }).expect(400);
    await deactivate(id, { note: '   ' }).expect(400);
    const missing = new Types.ObjectId().toString();
    await deactivate(missing).expect(404);
    await archive(missing).expect(404);
    expect((await workers.findById(id).orFail()).status).toBe(
      WorkerStatus.ACTIVE,
    );
    expect(publish).not.toHaveBeenCalled();
  });

  it('keeps the worker archived when publication is unconfirmed', async () => {
    const id = await seed();
    publish.mockRejectedValueOnce(new Error('Test broker unavailable'));
    const response = await archive(id).expect(503);
    expect(response.body).toMatchObject({
      code: 'WORKER_DEACTIVATION_EVENT_UNCONFIRMED',
      correlationId,
    });
    const saved = await workers.findById(id).orFail();
    expect(saved.status).toBe(WorkerStatus.INACTIVE);
    expect(saved.deletedAt).toBeInstanceOf(Date);
  });
});
