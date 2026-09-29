import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for an accept attempt against an invitation past its fourteen-day window. */
export interface ShareInvitationExpiredExceptionMetadata extends DomainErrorMetadata {
  invitationId?: string;
}

/** br.share.invite.expiry: an invitation not accepted within fourteen days can no longer be accepted. */
export class ShareInvitationExpiredException extends DomainError {
    constructor({ invitationId, ...metadata }: ShareInvitationExpiredExceptionMetadata = {
    }) {
        super("SHARE_INVITATION_EXPIRED_EXCEPTION",
            "This invitation has expired.",
            {
                metadata: {
                    invitationId, ...metadata 
                } 
            })
    }
}
