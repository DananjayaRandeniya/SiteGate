type DomainErrorCode = 'WORKER_NOT_FOUND' | 'CREDENTIAL_IN_USE';

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}
