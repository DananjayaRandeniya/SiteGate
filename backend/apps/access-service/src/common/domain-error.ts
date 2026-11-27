// Base class for our own errors. Services throw these, never HttpException.
export class DomainError extends Error {
  constructor(
    readonly code: string, // stable code, for example "WORKER_NOT_FOUND"
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
  }
}