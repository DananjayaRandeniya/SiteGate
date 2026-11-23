import { WorkerStatus } from '@app/contracts';
import type { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { type Model, Types } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Contractor } from '../src/contractors/schemas/contractor.schema';
import { WorkerServiceModule } from '../src/worker-service.module';
import { WorkerEventsProducer } from '../src/workers/events/worker-events.producer';
import { Worker } from '../src/workers/schemas/worker.schema';

describe('Worker directory (e2e)', () => {
  const publish = jest.fn();
  let app: INestApplication<App>;
  let workers: Model<Worker>;
  let contractors: Model<Contractor>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [WorkerServiceModule],
    })
      .overrideProvider(WorkerEventsProducer)
      .useValue({ publish })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    workers = app.get<Model<Worker>>(getModelToken(Worker.name));
    contractors = app.get<Model<Contractor>>(getModelToken(Contractor.name));
    await workers.init();
  });

  afterEach(() => {
    expect(publish).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    await app?.close();
  });

  function contractor(name: string, deletedAt: Date | null = null) {
    return contractors.create({ name, deletedAt });
  }

  function seed(
    contractorId: Types.ObjectId,
    data: Partial<Worker> = {},
    createdAt = new Date('2026-11-19'),
  ) {
    return workers.create({
      fullName: 'Directory Test Worker',
      contractorId,
      inductionDate: new Date('2026-11-18'),
      safetyTicketExpiry: new Date('2027-02-28'),
      assignedSiteIds: ['S-01'],
      createdAt,
      ...data,
    });
  }

  function list(query: Record<string, string | number>) {
    return request(app.getHttpServer()).get('/workers').query(query);
  }

  it('returns defaults and a historical contractor name while excluding archived workers', async () => {
    const vendor = await contractor(
      'Archived Directory Contractor',
      new Date(),
    );
    const visible = await seed(vendor._id);
    await seed(vendor._id, { deletedAt: new Date() });

    const response = await list({ contractorId: vendor._id.toString() }).expect(
      200,
    );
    expect(response.body).toEqual({
      items: [
        {
          id: visible._id.toString(),
          fullName: 'Directory Test Worker',
          contractorId: vendor._id.toString(),
          contractorName: 'Archived Directory Contractor',
          credentialNumber: null,
          inductionDate: '2026-11-18',
          safetyTicketExpiry: '2027-02-28',
          assignedSiteIds: ['S-01'],
          status: WorkerStatus.ACTIVE,
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it('keeps the contractor ID if a historical reference has no matching record', async () => {
    const missing = new Types.ObjectId();
    const row = await seed(missing);
    const reply = await list({ contractorId: missing.toString() }).expect(200);
    expect(reply.body).toMatchObject({
      items: [
        {
          id: row._id.toString(),
          contractorId: missing.toString(),
          contractorName: null,
        },
      ],
      total: 1,
    });
  });

  it('searches names case-insensitively and treats punctuation as literal', async () => {
    const { _id } = await contractor('Literal Search Contractor');
    const match = await seed(_id, { fullName: 'Directory [A]. Perera' });
    await seed(_id, { fullName: 'Directory AX Perera' });
    const response = await list({
      contractorId: _id.toString(),
      search: ' [a]. p ',
    }).expect(200);
    expect(response.body).toMatchObject({
      items: [{ id: match._id.toString() }],
      total: 1,
    });
    const empty = await list({
      contractorId: _id.toString(),
      search: '(',
    }).expect(200);
    expect(empty.body).toEqual({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it('matches active credentials and excludes revoked numbers from search', async () => {
    const { _id } = await contractor('Credential Search Contractor');
    const activeNumber = 'DIRECTORY-CREDENTIAL-ACTIVE';
    const match = await seed(_id, {
      credentials: [
        { number: activeNumber, issuedAt: new Date(), revokedAt: null },
      ],
    });
    await seed(_id, {
      credentials: [
        {
          number: 'DIRECTORY-CREDENTIAL-REVOKED',
          issuedAt: new Date(),
          revokedAt: new Date(),
        },
        { number: 'UNRELATED-NEW-CARD', issuedAt: new Date(), revokedAt: null },
      ],
    });
    const response = await list({
      contractorId: _id.toString(),
      search: 'DirEctory-Credential',
    }).expect(200);
    expect(response.body).toMatchObject({
      items: [{ id: match._id.toString(), credentialNumber: activeNumber }],
      total: 1,
    });
  });

  it('combines status, contractor, site and search in both the page and the count', async () => {
    const [vendor, other] = await Promise.all([
      contractor('Combined Filter Contractor'),
      contractor('Other Filter Contractor'),
    ]);
    const condition = {
      status: WorkerStatus.INACTIVE,
      assignedSiteIds: ['S-02'],
    };
    const match = await seed(vendor._id, condition);
    await Promise.all([
      seed(vendor._id, { ...condition, deletedAt: new Date() }),
      seed(vendor._id, { ...condition, assignedSiteIds: ['S-01'] }),
      seed(vendor._id, { ...condition, status: WorkerStatus.ACTIVE }),
      seed(vendor._id, { ...condition, fullName: 'Different Search Text' }),
      seed(other._id, condition),
    ]);
    const response = await list({
      status: WorkerStatus.INACTIVE,
      contractorId: vendor._id.toString(),
      siteId: ' S-02 ',
      search: 'directory',
    }).expect(200);
    expect(response.body).toMatchObject({
      items: [{ id: match._id.toString(), contractorName: vendor.name }],
      total: 1,
      totalPages: 1,
    });
  });

  it('uses the ID to break timestamp ties and returns a stable second page', async () => {
    const { _id } = await contractor('Directory Pagination Contractor');
    const contractorId = _id.toString();
    const workersWithTiedDates = await Promise.all(
      Array.from({ length: 14 }, () => seed(_id)),
    );
    const newest = await seed(_id, {}, new Date('2026-11-20'));
    const ids = [
      newest._id.toString(),
      ...workersWithTiedDates
        .map((worker) => worker._id.toString())
        .sort((a, b) => b.localeCompare(a)),
    ];
    const first = await list({ contractorId, page: 1, limit: 10 }).expect(200);
    const second = await list({ contractorId, page: 2, limit: 10 }).expect(200);
    const pastEnd = await list({ contractorId, page: 3, limit: 10 }).expect(
      200,
    );
    expect(first.body).toMatchObject({
      items: ids.slice(0, 10).map((id) => ({ id })),
      page: 1,
      limit: 10,
      total: 15,
      totalPages: 2,
    });
    expect(second.body).toMatchObject({
      items: ids.slice(10).map((id) => ({ id })),
      page: 2,
      limit: 10,
      total: 15,
      totalPages: 2,
    });
    expect(pastEnd.body).toEqual({
      items: [],
      page: 3,
      limit: 10,
      total: 15,
      totalPages: 2,
    });
  });

  it.each([
    { page: 0 },
    { page: '1e2' },
    { page: '9007199254740992' },
    { limit: 101 },
    { limit: '1.5' },
    { status: 'active' },
    { contractorId: 'not-an-id' },
    { siteId: '   ' },
    { search: 'x'.repeat(121) },
    { unsupported: 'field' },
  ])('rejects an invalid query %j', async (query) => {
    await list(query).expect(400);
  });
});
