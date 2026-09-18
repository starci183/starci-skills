import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

/** Metadata for an invite submitted with a malformed email. */
export interface ShareInvalidEmailExceptionMetadata extends AbstractExceptionMetadata {
  /** The email that was submitted. */
  email?: string;
}

/** fr.share.invite exceptionFlows: "An invalid email is refused and nothing is created." */
export class ShareInvalidEmailException extends AbstractException {
  constructor({ email, ...metadata }: ShareInvalidEmailExceptionMetadata = {}) {
    super('That email address is not well formed.', 'SHARE_INVALID_EMAIL', { email, ...metadata });
  }
}
