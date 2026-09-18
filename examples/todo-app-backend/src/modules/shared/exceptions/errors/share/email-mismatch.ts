import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

/** Metadata for an accept attempt whose email does not match the invited one. */
export interface ShareEmailMismatchExceptionMetadata extends AbstractExceptionMetadata {
  invitationId?: string;
}

/** fr.share.accept exceptionFlows: "Accepting with an email other than the invited one is refused." */
export class ShareEmailMismatchException extends AbstractException {
  constructor({ invitationId, ...metadata }: ShareEmailMismatchExceptionMetadata = {}) {
    super('This invitation was not addressed to that email.', 'SHARE_EMAIL_MISMATCH', { invitationId, ...metadata });
  }
}
