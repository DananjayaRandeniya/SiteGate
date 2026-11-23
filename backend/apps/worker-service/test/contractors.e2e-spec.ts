import type { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import type { Model } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Contractor } from '../src/contractors/schemas/contractor.schema';
import { WorkerServiceModule } from '../src/worker-service.module';

describe('Contractor directory (e2e)', () => {
  let app: INestApplication<App>;
  let contractors: Model<Contractor>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [WorkerServiceModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    contractors = app.get<Model<Contractor>>(getModelToken(Contractor.name));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('creates, lists, reads, and renames an active contractor', async () => {
    const http = request(app.getHttpServer());
    const { body } = await http
      .post('/contractors')
      .send({ name: '  West Construction  ' })
      .expect(201);

    expect(body).toEqual({ id: expect.any(String), name: 'West Construction' });
    const id = String(body.id);
    const path = `/contractors/${id}`;
    await http.get(path).expect(200, { id, name: 'West Construction' });
    await http
      .patch(path)
      .send({ name: 'Central Construction' })
      .expect(200, { id, name: 'Central Construction' });

    const directory = await http.get('/contractors').expect(200);
    expect(directory.body).toContainEqual({ id, name: 'Central Construction' });
  });

  it('archives once, keeps the MongoDB record, and hides it from reads', async () => {
    const http = request(app.getHttpServer());
    const contractor = await contractors.create({
      name: 'Archive Test Contractor',
    });
    const id = contractor._id.toString();
    const path = `/contractors/${id}`;

    const archives = await Promise.all([http.delete(path), http.delete(path)]);
    const statuses = archives.map((result) => result.status);
    expect(statuses.sort((left, right) => left - right)).toEqual([204, 404]);
    expect(
      archives.find((result) => result.status === 404)?.body,
    ).toMatchObject({
      code: 'CONTRACTOR_NOT_FOUND',
    });

    const saved = await contractors.findById(id).exec();
    expect(saved?.deletedAt).toBeInstanceOf(Date);
    await http.get(path).expect(404);
    await http.patch(path).send({ name: 'Updated contractor' }).expect(404);

    const directory = await http.get('/contractors').expect(200);
    expect(directory.body).not.toContainEqual({ id, name: contractor.name });
  });

  it('rejects invalid input and reports a missing contractor', async () => {
    const http = request(app.getHttpServer());
    await http.post('/contractors').send({ name: '   ' }).expect(400);
    await http
      .post('/contractors')
      .send({ name: 'Invalid Contractor', deletedAt: null })
      .expect(400);
    await http.get('/contractors/invalid-id').expect(400);

    const missing = await http
      .get(`/contractors/${new Types.ObjectId().toString()}`)
      .expect(404);
    expect(missing.body).toMatchObject({ code: 'CONTRACTOR_NOT_FOUND' });
  });
});
