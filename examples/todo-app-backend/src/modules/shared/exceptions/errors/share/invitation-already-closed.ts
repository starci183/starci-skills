import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

/** Metadata for an attempt to act on an invitation that is already expired or revoked. */
export interface ShareInvitationAlreadyClosedExceptionMetadata extends AbstractExceptionMetadata {
  invitationId?: string;
}

/** fr.share.revoke exceptionFlows: "Revoking an already expired or already revoked invitation is refused."
 * Also covers a second accept attempt against a row a different actor already bound. */
export class ShareInvitationAlreadyClosedException extends AbstractException {
  constructor({ invitationId, ...metadata }: ShareInvitationAlreadyClosedExceptionMetadata = {}) {
    super('This invitation is already closed.', 'SHARE_INVITATION_ALREADY_CLOSED', { invitationId, ...metadata });
  }
}
