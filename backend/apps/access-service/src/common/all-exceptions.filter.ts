import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { DomainError } from './domain-error';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const correlationId = (req.headers['x-correlation-id'] as string) ?? randomUUID();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong';

    if (exception instanceof DomainError) {
      statusCode = exception.httpStatus;
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse() as string | { message?: string | string[] };
      message =
        typeof body === 'string'
          ? body
          : Array.isArray(body.message)
            ? body.message.join('; ')
            : (body.message ?? exception.message);
      code = statusCode === 400 ? 'VALIDATION_ERROR' : statusCode === 404 ? 'NOT_FOUND' : `HTTP_${statusCode}`;
    } else {
      // Unknown error: the stack goes to the log, never to the client
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
        `correlationId=${correlationId}`,
      );
    }

    res.status(statusCode).json({
      statusCode,
      code,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
}