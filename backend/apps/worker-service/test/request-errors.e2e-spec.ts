import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DomainError } from '../src/common/domain-error';
import { workerLogger } from '../src/common/logger';
import { requestLogging } from '../src/common/request-logging.middleware';
import { WorkerServiceModule } from '../src/worker-service.module';

class TestInput {
  @IsString()
  name!: string;
}

@Controller('test-errors')
class TestErrorController {
  @Post()
  validate(@Body() input: TestInput) {
    return input;
  }

  @Get('conflict')
  conflict() {
    throw new DomainError('CREDENTIAL_IN_USE', 'This card is already in use');
  }

  @Get('missing-worker')
  missingWorker() {
    throw new DomainError('WORKER_NOT_FOUND', 'Worker was not found');
  }

  @Get('unexpected')
  unexpected() {
    throw new Error('Private diagnostic detail');
  }
}

describe('Worker service request errors (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [WorkerServiceModule],
      controllers: [TestErrorController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(requestLogging);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('uses the supplied correlation ID in the reply and request log', async () => {
    const id = randomUUID();
    const log = jest.spyOn(workerLogger, 'info');
    try {
      await request(app.getHttpServer())
        .get('/health')
        .set('x-correlation-id', id)
        .expect('x-correlation-id', id)
        .expect(200);

      expect(log).toHaveBeenCalledWith(
        { correlationId: id, method: 'GET', statusCode: 200 },
        'Request completed',
      );
    } finally {
      log.mockRestore();
    }
  });

  it('rejects unexpected input fields and creates a new ID for an invalid one', async () => {
    const response = await request(app.getHttpServer())
      .post('/test-errors')
      .set('x-correlation-id', 'invalid-id')
      .send({ name: 'Maya', extra: true })
      .expect(400);

    const id = response.headers['x-correlation-id'];
    expect(id).toMatch(
      /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/,
    );
    expect(response.body).toEqual({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'property extra should not exist',
      correlationId: id,
      timestamp: expect.any(String),
    });
  });

  it.each([
    ['conflict', 409, 'CREDENTIAL_IN_USE'],
    ['missing-worker', 404, 'WORKER_NOT_FOUND'],
  ])('maps the %s business rule to HTTP %i', async (path, statusCode, code) => {
    const response = await request(app.getHttpServer())
      .get(`/test-errors/${path}`)
      .expect(statusCode);

    expect(response.body).toMatchObject({
      statusCode,
      code,
      correlationId: response.headers['x-correlation-id'],
    });
  });

  it('returns a generic 500 and logs the diagnostic with the same ID', async () => {
    const id = randomUUID();
    const log = jest.spyOn(workerLogger, 'error').mockImplementation(() => {});
    try {
      const response = await request(app.getHttpServer())
        .get('/test-errors/unexpected')
        .set('x-correlation-id', id)
        .expect('x-correlation-id', id)
        .expect(500);

      expect(response.body).toEqual({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        correlationId: id,
        timestamp: expect.any(String),
      });
      expect(log).toHaveBeenCalledWith(
        { correlationId: id, err: new Error('Private diagnostic detail') },
        'Request failed',
      );
    } finally {
      log.mockRestore();
    }
  });
});
