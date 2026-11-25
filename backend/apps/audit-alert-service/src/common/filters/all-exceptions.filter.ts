import { randomUUID } from 'node:crypto';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { DomainError } from '../errors/domain-error';

// Minimal shapes, so we do not depend on express types
interface HttpRequest {
  headers: Record<string, string | string[] | undefined>;
}
interface HttpResponse {
  status(code: number): { json(body: unknown): void };
}

// The ONLY place that knows which domain error means which HTTP status
const STATUS_BY_CODE: Record<string, number> = {
  ALERT_NOT_FOUND: HttpStatus.NOT_FOUND,
  INVALID_ALERT_TRANSITION: HttpStatus.CONFLICT,
};

// Header name is still an open question in the contracts doc (#14)
const CORRELATION_HEADER = 'x-correlation-id';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<HttpRequest>();
    const response = http.getResponse<HttpResponse>();

    const header = request.headers[CORRELATION_HEADER];
    const correlationId = (Array.isArray(header) ? header[0] : header) ?? randomUUID();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong'; // unknown errors never show details to the client

    if (exception instanceof DomainError) {
      statusCode = STATUS_BY_CODE[exception.code] ?? HttpStatus.BAD_REQUEST;
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      // For example the validation errors from ValidationPipe
      statusCode = exception.getStatus();
      code = statusCode === HttpStatus.BAD_REQUEST ? 'VALIDATION_ERROR' : 'HTTP_ERROR';
      message = this.messageOf(exception);
    } else {
      // The stack trace goes to the log, never to the client
      this.logger.error(
        `Unhandled error (correlationId=${correlationId})`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({
      statusCode,
      code,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }

  private messageOf(exception: HttpException): string {
    const body = exception.getResponse();
    if (typeof body === 'string') {
      return body;
    }
    const message = (body as { message?: string | string[] }).message;
    return Array.isArray(message) ? message.join('; ') : (message ?? exception.message);
  }
}