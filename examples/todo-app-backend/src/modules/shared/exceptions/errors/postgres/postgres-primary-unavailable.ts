import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

/** Metadata for a failed reach to the primary Postgres connection. */
export interface PostgresPrimaryUnavailableExceptionMetadata extends AbstractExceptionMetadata {
  /** The underlying failure or unexpected result, stringified. */
  reason?: string;
}

export class PostgresPrimaryUnavailableException extends AbstractException {
  constructor({ reason, ...metadata }: PostgresPrimaryUnavailableExceptionMetadata) {
    super('The database could not be reached.', 'POSTGRES_UNAVAILABLE', { reason, ...metadata });
  }
}
