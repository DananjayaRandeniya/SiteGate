import { Topics } from '@app/contracts';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import type { Model } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { requestLogging } from '../src/common/request-logging.middleware';
import { Contractor } from '../src/contractors/schemas/contractor.schema';
import { WorkerServiceModule } from '../src/worker-service.module';
import { WorkerEventsProducer } from '../src/workers/events/worker-events.producer';
import { Worker } from '../src/workers/schemas/worker.schema';

describe('Worker registration (e2e)', () => {
  let app: INestApplication<App>;
  let workers: Model<Worker>;
  let contractorId: string;
  let archivedContractorId: string;

  const path = '/workers';
  const adminToken = 'sitegate-registration-test-token-only';
  const correlationId = 'd17f3a9a-efea-4ddd-959a-2ce8128871c5';
  const publish = jest.fn();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [WorkerServiceModule],
    })
      .overrideProvider(WorkerEventsProducer)
      .useValue({ publish })
      .compile();
    app = moduleFixture.createNestApplication();
    app.use(requestLogging);
    app.get(ConfigService).set('WORKER_ADMIN_TOKEN', adminToken);
    await app.init();

    const contractors = app.get<Model<Contractor>>(
      getModelToken(Contractor.name),
    );
    workers = app.get<Model<Worker>>(getModelToken(Worker.name));
    await workers.init();
    const active = await contractors.create({
      name: 'Registration Contractor',
    });
    const archived = await contractors.create({
      name: 'Archived Registration Contractor',
      deletedAt: new Date(),
    });
    contractorId = active._id.toString();
    archivedContractorId = archived._id.toString();
  });

  beforeEach(() => {
    publish.mockReset().mockResolvedValue(undefined);
    // It is already 23 November at the site, but still 22 November in UTC.
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-22T19:00:00Z'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app?.close();
  });

  function validInput(credentialNumber = 'REGISTRATION-INVALID-INPUT-01') {
    return {
      fullName: 'Maya Perera',
      contractorId,
      credentialNumber,
      inductionDate: '2026-11-23',
      safetyTicketExpiry: '2027-11-23',
    };
  }

  function register(input: object) {
    return request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-correlation-id', correlationId)
      .send(input);
  }

  it('rejects missing or incorrect admin authorization before writing or publishing', async () => {
    const input = validInput('REGISTRATION-UNAUTHORIZED');
    const http = request(app.getHttpServer());
    await http.post(path).send(input).expect(401);
    await http
      .post(path)
      .set('Authorization', 'Bearer an-incorrect-token')
      .send(input)
      .expect(401);
    expect(
      await workers.exists({ 'credentials.number': input.credentialNumber }),
    ).toBeNull();
    expect(publish).not.toHaveBeenCalled();
  });

  it('saves an Active worker before publishing both events', async () => {
    const input = {
      ...validInput('REGISTRATION-ACTIVE'),
      assignedSiteIds: ['S-01'],
    };
    publish.mockImplementationOnce(async () => {
      const worker = await workers.findOne({
        'credentials.number': input.credentialNumber,
      });
      expect(worker).toMatchObject({
        status: 'Active',
        deletedAt: null,
        assignedSiteIds: ['S-01'],
        credentials: [{ number: input.credentialNumber, revokedAt: null }],
      });
    });
    const response = await register(input).expect(201);
    const worker = await workers
      .findOne({ 'credentials.number': input.credentialNumber })
      .orFail();
    const id = worker._id.toString();

    expect(response.body).toEqual({ ...input, id, status: 'Active' });
    expect(response.headers['x-correlation-id']).toBe(correlationId);
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenNthCalledWith(
      1,
      Topics.WORKER_CREATED,
      {
        workerId: id,
        name: input.fullName,
        contractorId: input.contractorId,
        siteIds: input.assignedSiteIds,
        inductionDate: input.inductionDate,
        ticketExpiry: input.safetyTicketExpiry,
      },
      correlationId,
    );
    expect(publish).toHaveBeenNthCalledWith(
      2,
      Topics.CREDENTIAL_ISSUED,
      { workerId: id, credentialNumber: input.credentialNumber },
      correlationId,
    );
  });

  it('rejects a duplicate credential without publishing again', async () => {
    const input = validInput('C-1001');
    const created = await register(input).expect(201);
    expect(created.body).toMatchObject({ assignedSiteIds: [] });
    publish.mockClear();

    const duplicate = await register({
      ...input,
      fullName: 'Another Worker',
    }).expect(409);
    expect(duplicate.body).toMatchObject({ code: 'CREDENTIAL_IN_USE' });
    expect(
      await workers.countDocuments({
        'credentials.number': input.credentialNumber,
      }),
    ).toBe(1);
    expect(publish).not.toHaveBeenCalled();
  });

  it('lets only one of two concurrent registrations use the same credential', async () => {
    const input = validInput('REGISTRATION-CONCURRENT');
    const results = await Promise.all([
      register(input),
      register({ ...input, fullName: 'Another Worker' }),
    ]);
    expect(results.map(({ status }) => status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    expect(
      await workers.countDocuments({
        'credentials.number': input.credentialNumber,
      }),
    ).toBe(1);
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('reports an unconfirmed Kafka event after a successful database write', async () => {
    const input = validInput('REGISTRATION-KAFKA-ERROR');
    publish
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Test broker unavailable'));

    const failure = await register(input).expect(503);
    expect(failure.body).toMatchObject({
      code: 'REGISTRATION_EVENT_UNCONFIRMED',
      correlationId,
    });
    expect(
      await workers.countDocuments({
        'credentials.number': input.credentialNumber,
      }),
    ).toBe(1);
    expect(publish).toHaveBeenCalledTimes(2);
    publish.mockClear();

    await register(input).expect(409);
    expect(publish).not.toHaveBeenCalled();
  });

  it.each([
    ['missing full name', { fullName: undefined }, /fullName/],
    ['extra field', { status: 'Active' }, /status should not exist/],
    ['blank credential', { credentialNumber: '  ' }, /credentialNumber/],
    ['malformed contractor ID', { contractorId: 'not-an-id' }, /contractorId/],
    [
      'future induction date',
      { inductionDate: '2026-11-24' },
      /today or earlier/,
    ],
    [
      'impossible induction date',
      { inductionDate: '2026-02-30' },
      /inductionDate/,
    ],
    [
      'impossible ticket expiry',
      { safetyTicketExpiry: '2027-02-29' },
      /safetyTicketExpiry/,
    ],
    [
      'date with a time',
      { safetyTicketExpiry: '2027-11-23T00:00:00Z' },
      /YYYY-MM-DD/,
    ],
    ['blank site ID', { assignedSiteIds: ['  '] }, /assignedSiteIds/],
    ['null sites', { assignedSiteIds: null }, /assignedSiteIds/],
  ])('rejects %s', async (_case, change, message) => {
    const response = await register({ ...validInput(), ...change }).expect(400);

    expect(response.body).toMatchObject({
      code: 'BAD_REQUEST',
      message: expect.stringMatching(message),
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it('rejects unknown and archived contractors', async () => {
    for (const id of [new Types.ObjectId().toString(), archivedContractorId]) {
      const response = await register({
        ...validInput(),
        contractorId: id,
      }).expect(404);
      expect(response.body).toMatchObject({ code: 'CONTRACTOR_NOT_FOUND' });
    }
    expect(publish).not.toHaveBeenCalled();
  });
});
