import { AbstractException } from '../../../errors';

export class PostgresPrimaryUnavailableException extends AbstractException {
  constructor(reason: string) {
    super('The database could not be reached.', 'POSTGRES_UNAVAILABLE', { reason });
  }
}
