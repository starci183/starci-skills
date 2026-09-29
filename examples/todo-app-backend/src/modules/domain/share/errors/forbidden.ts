import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for an action attempted by someone other than the invitation's/task's owner. */
export interface ShareForbiddenExceptionMetadata extends DomainErrorMetadata {
  invitationId?: string;
  actorId?: string;
}

/** Revoking, or reading a collaborator list, is refused to anyone who is not the owner (or, for reading,
 * not a bound collaborator either) - see fr.share.revoke and fr.share.list. */
export class ShareForbiddenException extends DomainError {
    constructor({ invitationId, actorId, ...metadata }: ShareForbiddenExceptionMetadata = {
    }) {
        super("SHARE_FORBIDDEN_EXCEPTION",
            "This invitation belongs to somebody else’s task.",
            {
                metadata: {
                    invitationId, actorId, ...metadata 
                } 
            })
    }
}
