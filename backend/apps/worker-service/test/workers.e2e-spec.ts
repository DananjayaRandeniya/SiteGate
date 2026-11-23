import { DeactivationReason, Topics, WorkerStatus } from '@app/contracts';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import type { OpenAPIObject, OperationObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import type { Model } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { requestLogging } from '../src/common/request-logging.middleware';
import { Contractor } from '../src/contractors/schemas/contractor.schema';
import { setupWorkerApiDocs } from '../src/openapi/worker-api-docs';
import { WorkerServiceModule } from '../src/worker-service.module';
import { WorkerEventsProducer } from '../src/workers/events/worker-events.producer';
import { Worker } from '../src/workers/schemas/worker.schema';

function documentedBody(
  operation: OperationObject | undefined,
  name: string,
): Record<string, unknown> {
  const body = operation?.requestBody;
  const example =
    body && 'content' in body
      ? body.content['application/json']?.examples?.[name]
      : undefined;
  const value: unknown =
    example && 'value' in example ? example.value : undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Swagger request example ${name} is missing`);
  }
  return { ...value };
}

describe('Worker registration and deactivation (e2e)', () => {
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
    setupWorkerApiDocs(app);
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

  it('serves Swagger UI and describes the admin operations and error responses', async () => {
    const http = request(app.getHttpServer());
    await http
      .get('/docs')
      .expect(200)
      .expect('Content-Type', /html/)
      .expect(/Swagger UI/);
    const document = await http.get('/docs-json').expect(200);
    const openApi = document.body as OpenAPIObject;
    expect(openApi.components?.securitySchemes?.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
    expect(openApi.components?.schemas?.CreateWorkerDto).toMatchObject({
      required: [
        'fullName',
        'contractorId',
        'credentialNumber',
        'inductionDate',
        'safetyTicketExpiry',
      ],
      properties: {
        inductionDate: { type: 'string', format: 'date' },
        assignedSiteIds: { type: 'array' },
      },
    });
    expect(openApi.paths[path]?.post).toMatchObject({
      security: [{ bearer: [] }],
      responses: {
        '201': {
          content: {
            'application/json': { example: { status: WorkerStatus.ACTIVE } },
          },
        },
        '400': {
          content: { 'application/json': { example: { code: 'BAD_REQUEST' } } },
        },
        '401': {
          content: {
            'application/json': { example: { code: 'UNAUTHORIZED' } },
          },
        },
        '404': {
          content: {
            'application/json': { example: { code: 'CONTRACTOR_NOT_FOUND' } },
          },
        },
        '409': {
          content: {
            'application/json': {
              example: { statusCode: 409, code: 'CREDENTIAL_IN_USE' },
            },
          },
        },
        '503': {
          content: {
            'application/json': {
              example: { code: 'REGISTRATION_EVENT_UNCONFIRMED' },
            },
          },
        },
      },
    });
    expect(openApi.paths['/workers/{id}/deactivate']?.patch).toMatchObject({
      security: [{ bearer: [] }],
      parameters: [{ name: 'id', in: 'path', required: true }],
      requestBody: { required: false },
      responses: {
        '200': {
          content: {
            'application/json': { example: { status: WorkerStatus.INACTIVE } },
          },
        },
        '404': {
          content: {
            'application/json': { example: { code: 'WORKER_NOT_FOUND' } },
          },
        },
        '503': {
          content: {
            'application/json': {
              example: { code: 'WORKER_DEACTIVATION_EVENT_UNCONFIRMED' },
            },
          },
        },
      },
    });
  });

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

  it('runs WS-01 registration, duplicate rejection, and deactivation using the documented requests', async () => {
    const http = request(app.getHttpServer());
    const document = await http.get('/docs-json').expect(200);
    const openApi = document.body as OpenAPIObject;
    const example = documentedBody(openApi.paths[path]?.post, 'registration');
    const credentialNumber = example.credentialNumber;
    if (typeof credentialNumber !== 'string')
      throw new Error(
        'The Swagger registration example needs a credential number',
      );
    const input = { ...example, contractorId };
    const created = await register(input).expect(201);
    const initial = await workers
      .findOne({ 'credentials.number': credentialNumber })
      .orFail();
    const id = initial._id.toString();
    expect(initial.status).toBe(WorkerStatus.ACTIVE);
    expect(created.body).toMatchObject({ id, status: WorkerStatus.ACTIVE });
    expect(publish).toHaveBeenNthCalledWith(
      1,
      Topics.WORKER_CREATED,
      expect.objectContaining({ workerId: id }),
      correlationId,
    );
    expect(publish).toHaveBeenNthCalledWith(
      2,
      Topics.CREDENTIAL_ISSUED,
      { workerId: id, credentialNumber },
      correlationId,
    );

    const duplicate = await register({
      ...input,
      fullName: 'Another Worker',
    }).expect(409);
    expect(duplicate.body).toMatchObject({ code: 'CREDENTIAL_IN_USE' });
    expect(
      await workers.countDocuments({
        'credentials.number': credentialNumber,
      }),
    ).toBe(1);
    expect(publish).toHaveBeenCalledTimes(2);

    const deactivation = documentedBody(
      openApi.paths['/workers/{id}/deactivate']?.patch,
      'contractEnded',
    );
    await http
      .patch(`${path}/${id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-correlation-id', correlationId)
      .send(deactivation)
      .expect(200, { id, status: WorkerStatus.INACTIVE });
    expect((await workers.findById(id).orFail()).status).toBe(
      WorkerStatus.INACTIVE,
    );
    expect(publish).toHaveBeenCalledTimes(3);
    expect(publish).toHaveBeenNthCalledWith(
      3,
      Topics.WORKER_DEACTIVATED,
      {
        workerId: id,
        ...deactivation,
        reason: DeactivationReason.CONTRACT_ENDED,
      },
      correlationId,
    );
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
