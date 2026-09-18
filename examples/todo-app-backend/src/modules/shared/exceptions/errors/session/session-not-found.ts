import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

export type SessionNotFoundExceptionMetadata = AbstractExceptionMetadata;

export class SessionNotFoundException extends AbstractException {
  constructor(metadata: SessionNotFoundExceptionMetadata = {}) {
    super('The session is not active.', 'SESSION_NOT_FOUND', metadata);
  }
}
