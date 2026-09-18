import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

export type SessionExpiredExceptionMetadata = AbstractExceptionMetadata;

export class SessionExpiredException extends AbstractException {
  constructor(metadata: SessionExpiredExceptionMetadata = {}) {
    super('The session has expired.', 'SESSION_EXPIRED', metadata);
  }
}
