import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

/** Metadata for an accept attempt against an invitation past its fourteen-day window. */
export interface ShareInvitationExpiredExceptionMetadata extends AbstractExceptionMetadata {
  invitationId?: string;
}

/** br.share.invite.expiry: an invitation not accepted within fourteen days can no longer be accepted. */
export class ShareInvitationExpiredException extends AbstractException {
  constructor({ invitationId, ...metadata }: ShareInvitationExpiredExceptionMetadata = {}) {
    super('This invitation has expired.', 'SHARE_INVITATION_EXPIRED', { invitationId, ...metadata });
  }
}
