import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

/** Metadata for an action attempted by someone other than the invitation's/task's owner. */
export interface ShareForbiddenExceptionMetadata extends AbstractExceptionMetadata {
  invitationId?: string;
  actorId?: string;
}

/** Revoking, or reading a collaborator list, is refused to anyone who is not the owner (or, for reading,
 * not a bound collaborator either) - see fr.share.revoke and fr.share.list. */
export class ShareForbiddenException extends AbstractException {
  constructor({ invitationId, actorId, ...metadata }: ShareForbiddenExceptionMetadata = {}) {
    super('This invitation belongs to somebody else’s task.', 'SHARE_FORBIDDEN', { invitationId, actorId, ...metadata });
  }
}
