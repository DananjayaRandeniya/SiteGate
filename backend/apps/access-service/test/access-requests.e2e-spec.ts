import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import request from 'supertest';
import { DenialReason, Direction, Topics, WorkerStatus } from '@app/contracts';
import { AccessLog } from '../src/access-log/schemas/access-log.schema';
import type { AccessLogDocument } from '../src/access-log/schemas/access-log.schema';
import { AccessRequestsModule } from '../src/access-requests/access-requests.module';
import { EventPublisher } from '../src/events/event-publisher.service';
import { WorkerSnapshotsRepository } from '../src/worker-snapshots/worker-snapshots.repository';

describe('POST /access-requests (e2e)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let accessLogModel: Model<AccessLogDocument>;
  const publisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const tap = {
    credentialNumber: 'C-1001',
    siteId: 'S-01',
    gateId: 'G-01',
    direction: Direction.ENTRY,
  };

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();

    const moduleRef = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongo.getUri()), AccessRequestsModule],
    })
      .overrideProvider(EventPublisher)
      .useValue(publisher) // no real Kafka in this test
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    accessLogModel = moduleRef.get(getModelToken(AccessLog.name), { strict: false });

    // A valid worker in the in-memory database
    await moduleRef.get(WorkerSnapshotsRepository, { strict: false }).upsert('w1', {
      workerId: 'w1',
      name: 'Ali',
      siteIds: ['S-01'],
      inductionDate: new Date('2020-01-01'),
      ticketExpiry: new Date('2099-01-01'),
      status: WorkerStatus.ACTIVE,
      credentialNumber: 'C-1001',
      credentialRevoked: false,
    });
  }, 120000);

  afterAll(async () => {
    await app.close();
    await mongo.stop();
  });

  beforeEach(async () => {
    publisher.publish.mockClear();
    await accessLogModel.deleteMany({});
  });

  it('grants a valid worker, stores the decision and publishes access.granted', async () => {
    const res = await request(app.getHttpServer()).post('/access-requests').send(tap);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: 'GRANTED' });
    expect(await accessLogModel.countDocuments({ credentialNumber: 'C-1001' })).toBe(1);
    expect(publisher.publish).toHaveBeenCalledWith(
      Topics.ACCESS_GRANTED,
      'C-1001',
      expect.objectContaining({ workerId: 'w1' }),
    );
  });

  it('denies an unknown credential and publishes access.denied', async () => {
    const res = await request(app.getHttpServer())
      .post('/access-requests')
      .send({ ...tap, credentialNumber: 'C-9999' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: 'DENIED', reasonCode: DenialReason.UNKNOWN_CREDENTIAL });
    expect(publisher.publish).toHaveBeenCalledWith(
      Topics.ACCESS_DENIED,
      'C-9999',
      expect.objectContaining({ reasonCode: DenialReason.UNKNOWN_CREDENTIAL }),
    );
  });

  it('rejects a request with a missing field (400)', async () => {
    const { gateId: _omit, ...withoutGate } = tap;
    const res = await request(app.getHttpServer()).post('/access-requests').send(withoutGate);

    expect(res.status).toBe(400);
  });

  it('rejects unknown fields (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/access-requests')
      .send({ ...tap, extra: 'not allowed' });

    expect(res.status).toBe(400);
  });
});