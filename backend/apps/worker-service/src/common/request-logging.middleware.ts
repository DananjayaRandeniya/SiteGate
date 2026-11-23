import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { workerLogger } from './logger';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requestLogging(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const incomingId = request.get(CORRELATION_ID_HEADER);
  const correlationId =
    incomingId && uuidV4.test(incomingId) ? incomingId : randomUUID();
  response.set(CORRELATION_ID_HEADER, correlationId);

  response.once('finish', () => {
    workerLogger.info(
      {
        correlationId,
        method: request.method,
        statusCode: response.statusCode,
      },
      'Request completed',
    );
  });

  next();
}
