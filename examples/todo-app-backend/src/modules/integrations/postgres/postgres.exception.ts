import { AbstractException } from '../../platform/errors';

export class PostgresUnavailableException extends AbstractException {
  constructor(reason: string) {
    super('The database could not be reached.', 'POSTGRES_UNAVAILABLE', { reason });
  }
}
