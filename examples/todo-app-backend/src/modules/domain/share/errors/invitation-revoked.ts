import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for an accept attempt against a revoked invitation. */
export interface ShareInvitationRevokedExceptionMetadata extends DomainErrorMetadata {
  invitationId?: string;
}

/** fr.share.accept exceptionFlows: "Accepting a revoked invitation is refused." */
export class ShareInvitationRevokedException extends DomainError {
    constructor({ invitationId, ...metadata }: ShareInvitationRevokedExceptionMetadata = {
    }) {
        super("SHARE_INVITATION_REVOKED_EXCEPTION",
            "This invitation was revoked.",
            {
                metadata: {
                    invitationId, ...metadata 
                } 
            })
    }
}
