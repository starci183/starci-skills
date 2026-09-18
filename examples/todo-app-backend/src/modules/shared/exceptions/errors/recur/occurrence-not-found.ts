import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

/** Metadata for an occurrence that cannot be resolved. */
export interface RecurOccurrenceNotFoundExceptionMetadata extends AbstractExceptionMetadata {
  /** The occurrence id looked up. */
  occurrenceId?: string;
}

export class RecurOccurrenceNotFoundException extends AbstractException {
  constructor({ occurrenceId, ...metadata }: RecurOccurrenceNotFoundExceptionMetadata = {}) {
    super('The occurrence does not exist.', 'RECUR_OCCURRENCE_NOT_FOUND', { occurrenceId, ...metadata });
  }
}
