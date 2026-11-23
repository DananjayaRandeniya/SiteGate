type DomainErrorCode =
  | 'WORKER_NOT_FOUND'
  | 'CREDENTIAL_IN_USE'
  | 'CREDENTIAL_NOT_ACTIVE'
  | 'CREDENTIAL_EVENT_UNCONFIRMED'
  | 'CONTRACTOR_NOT_FOUND'
  | 'REGISTRATION_EVENT_UNCONFIRMED'
  | 'WORKER_UPDATE_EVENT_UNCONFIRMED';

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}
