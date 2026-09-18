import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

/** Metadata for an accept attempt against a revoked invitation. */
export interface ShareInvitationRevokedExceptionMetadata extends AbstractExceptionMetadata {
  invitationId?: string;
}

/** fr.share.accept exceptionFlows: "Accepting a revoked invitation is refused." */
export class ShareInvitationRevokedException extends AbstractException {
  constructor({ invitationId, ...metadata }: ShareInvitationRevokedExceptionMetadata = {}) {
    super('This invitation was revoked.', 'SHARE_INVITATION_REVOKED', { invitationId, ...metadata });
  }
}
