import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

/** Metadata for an invitation that cannot be resolved. */
export interface ShareInvitationNotFoundExceptionMetadata extends AbstractExceptionMetadata {
  /** The invitation id looked up. */
  invitationId?: string;
}

export class ShareInvitationNotFoundException extends AbstractException {
  constructor({ invitationId, ...metadata }: ShareInvitationNotFoundExceptionMetadata = {}) {
    super('The invitation does not exist.', 'SHARE_INVITATION_NOT_FOUND', { invitationId, ...metadata });
  }
}
