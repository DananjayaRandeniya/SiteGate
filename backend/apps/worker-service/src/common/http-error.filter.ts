import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { DomainError } from './domain-error';
import { workerLogger } from './logger';
import { CORRELATION_ID_HEADER } from './request-logging.middleware';

const domainStatus = {
  WORKER_NOT_FOUND: HttpStatus.NOT_FOUND,
  CREDENTIAL_IN_USE: HttpStatus.CONFLICT,
  CREDENTIAL_NOT_ACTIVE: HttpStatus.CONFLICT,
  CREDENTIAL_EVENT_UNCONFIRMED: HttpStatus.SERVICE_UNAVAILABLE,
  CONTRACTOR_NOT_FOUND: HttpStatus.NOT_FOUND,
  REGISTRATION_EVENT_UNCONFIRMED: HttpStatus.SERVICE_UNAVAILABLE,
};

function clientMessage(exception: HttpException): string {
  const body = exception.getResponse();
  if (typeof body === 'string') return body;

  const message = 'message' in body ? body.message : undefined;
  if (Array.isArray(message)) return message.join('. ');
  return typeof message === 'string' ? message : exception.message;
}

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const correlationId = response.get(CORRELATION_ID_HEADER) ?? randomUUID();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Internal server error';

    if (exception instanceof DomainError) {
      statusCode = domainStatus[exception.code];
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      code = HttpStatus[statusCode] ?? 'HTTP_ERROR';
      if (statusCode < 500) message = clientMessage(exception);
    }

    if (statusCode >= 500) {
      workerLogger.error({ correlationId, err: exception }, 'Request failed');
    }
    if (response.headersSent) {
      response.end();
      return;
    }

    response.set(CORRELATION_ID_HEADER, correlationId).status(statusCode).json({
      statusCode,
      code,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
}
