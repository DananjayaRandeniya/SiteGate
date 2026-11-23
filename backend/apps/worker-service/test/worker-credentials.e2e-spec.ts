import { RevokeReason, Topics } from '@app/contracts';
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

describe('Worker credentials (e2e)', () => {
  const publish = jest.fn();
  const adminToken = 'sitegate-credential-tests-only-admin';
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
      name: 'Credential Test Contractor',
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
      fullName: 'Credential Test Worker',
      contractorId,
      inductionDate: new Date('2026-11-18'),
      safetyTicketExpiry: new Date('2027-02-28'),
      ...overrides,
    });
    return worker._id.toString();
  }

  function post(workerId: string, action: 'issue' | 'revoke', input: object) {
    const suffix = action === 'revoke' ? '/revoke' : '';
    return request(app.getHttpServer())
      .post(`/workers/${workerId}/credentials${suffix}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-correlation-id', correlationId)
      .send(input);
  }

  it('issues, revokes the specified credential, and keeps its history after replacement', async () => {
    const workerId = await seed();
    const credentialNumber = 'LIFECYCLE-01';
    const replacement = 'LIFECYCLE-02';
    publish.mockImplementationOnce(async () => {
      const saved = await workers.findById(workerId).orFail();
      expect(saved.credentials).toMatchObject([
        { number: credentialNumber, revokedAt: null },
      ]);
    });

    // Mongo accepts uppercase IDs. Kafka should still use the canonical ID.
    const issued = await post(workerId.toUpperCase(), 'issue', {
      credentialNumber: ` ${credentialNumber} `,
    }).expect(201);
    expect(issued.headers['x-correlation-id']).toBe(correlationId);
    expect(issued.body).toMatchObject({ credentialNumber });

    const blocked = await post(workerId, 'issue', {
      credentialNumber: replacement,
    }).expect(409);
    expect(blocked.body).toMatchObject({ code: 'CREDENTIAL_IN_USE' });

    const revoked = await post(workerId, 'revoke', {
      credentialNumber,
      reason: RevokeReason.LOST,
      note: ' Reported at gate ',
    }).expect(200);
    expect(revoked.body).toMatchObject({
      credentialNumber,
      reason: RevokeReason.LOST,
      note: 'Reported at gate',
    });
    await post(workerId, 'issue', { credentialNumber: replacement }).expect(
      201,
    );
    const stale = await post(workerId, 'revoke', {
      credentialNumber,
      reason: RevokeReason.LOST,
    }).expect(409);
    expect(stale.body).toMatchObject({ code: 'CREDENTIAL_NOT_ACTIVE' });

    const saved = await workers.findById(workerId).orFail();
    expect(saved.credentials).toMatchObject([
      {
        number: credentialNumber,
        revokedAt: expect.any(Date),
        revokeReason: RevokeReason.LOST,
        revokeNote: 'Reported at gate',
      },
      { number: replacement, revokedAt: null },
    ]);
    expect(publish).toHaveBeenCalledTimes(3);
    expect(publish).toHaveBeenNthCalledWith(
      1,
      Topics.CREDENTIAL_ISSUED,
      { workerId, credentialNumber },
      correlationId,
    );
    expect(publish).toHaveBeenNthCalledWith(
      2,
      Topics.CREDENTIAL_REVOKED,
      {
        workerId,
        credentialNumber,
        reason: RevokeReason.LOST,
        note: 'Reported at gate',
      },
      correlationId,
    );
    expect(publish).toHaveBeenNthCalledWith(
      3,
      Topics.CREDENTIAL_ISSUED,
      { workerId, credentialNumber: replacement },
      correlationId,
    );
  });

  it('allows only one of two concurrent issues for the same worker', async () => {
    const id = await seed();
    const replies = await Promise.all([
      post(id, 'issue', { credentialNumber: 'RACE-ONE-WORKER-01' }),
      post(id, 'issue', { credentialNumber: 'RACE-ONE-WORKER-02' }),
    ]);
    expect(replies.map(({ status }) => status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    const saved = await workers.findById(id).orFail();
    expect(saved.credentials).toHaveLength(1);
    expect(saved.credentials[0].revokedAt).toBeNull();
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('allows only one worker to take a number even across simultaneous requests', async () => {
    const [first, second] = await Promise.all([seed(), seed()]);
    const credentialNumber = 'RACE-SHARED-NUMBER-01';
    const replies = await Promise.all([
      post(first, 'issue', { credentialNumber }),
      post(second, 'issue', { credentialNumber }),
    ]);
    expect(replies.map(({ status }) => status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    expect(
      await workers.countDocuments({ 'credentials.number': credentialNumber }),
    ).toBe(1);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('keeps a revoked number reserved for both the prior holder and other workers', async () => {
    const first = await seed();
    const second = await seed();
    const credentialNumber = 'HISTORICAL-NUMBER-01';
    await post(first, 'issue', { credentialNumber }).expect(201);
    await post(first, 'revoke', {
      credentialNumber,
      reason: RevokeReason.DAMAGED,
    }).expect(200);
    publish.mockClear();

    for (const id of [first, second]) {
      const reused = await post(id, 'issue', { credentialNumber }).expect(409);
      expect(reused.body).toMatchObject({ code: 'CREDENTIAL_IN_USE' });
    }
    expect(publish).not.toHaveBeenCalled();
  });

  it('rejects unauthorized requests, invalid reasons, and archived or missing workers', async () => {
    const id = await seed();
    const credentialNumber = 'REJECTED-CREDENTIAL-01';
    const http = request(app.getHttpServer());
    await http
      .post(`/workers/${id}/credentials`)
      .send({ credentialNumber })
      .expect(401);
    await http
      .post(`/workers/${id}/credentials/revoke`)
      .send({ credentialNumber, reason: RevokeReason.LOST })
      .expect(401);
    await post(id, 'issue', { credentialNumber: '   ' }).expect(400);
    await post(id, 'revoke', { credentialNumber, reason: 'CARD_LOST' }).expect(
      400,
    );
    await post(id, 'revoke', {
      credentialNumber,
      reason: RevokeReason.LOST,
      note: null,
    }).expect(400);
    const archived = await seed({ deletedAt: new Date() });
    for (const invalid of [archived, new Types.ObjectId().toString()]) {
      const reply = await post(invalid, 'issue', { credentialNumber }).expect(
        404,
      );
      expect(reply.body).toMatchObject({ code: 'WORKER_NOT_FOUND' });
      await post(invalid, 'revoke', {
        credentialNumber,
        reason: RevokeReason.LOST,
      }).expect(404);
    }
    expect((await workers.findById(id).orFail()).credentials).toHaveLength(0);
    expect(publish).not.toHaveBeenCalled();
  });

  it('reports an unconfirmed Kafka event and keeps the recorded credential change', async () => {
    const id = await seed();
    const credentialNumber = 'CREDENTIAL-PUBLICATION-FAILURE';
    publish.mockRejectedValueOnce(new Error('Test broker unavailable'));
    const response = await post(id, 'issue', { credentialNumber }).expect(503);
    expect(response.body).toMatchObject({
      code: 'CREDENTIAL_EVENT_UNCONFIRMED',
      correlationId,
    });
    expect((await workers.findById(id).orFail()).credentials).toMatchObject([
      { number: credentialNumber, revokedAt: null },
    ]);
  });
});
