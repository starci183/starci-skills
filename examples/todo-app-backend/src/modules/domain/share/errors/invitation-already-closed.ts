import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for an attempt to act on an invitation that is already expired or revoked. */
export interface ShareInvitationAlreadyClosedExceptionMetadata extends DomainErrorMetadata {
  invitationId?: string;
}

/** fr.share.revoke exceptionFlows: "Revoking an already expired or already revoked invitation is refused."
 * Also covers a second accept attempt against a row a different actor already bound. */
export class ShareInvitationAlreadyClosedException extends DomainError {
    constructor({ invitationId, ...metadata }: ShareInvitationAlreadyClosedExceptionMetadata = {
    }) {
        super("SHARE_INVITATION_ALREADY_CLOSED_EXCEPTION",
            "This invitation is already closed.",
            {
                metadata: {
                    invitationId, ...metadata 
                } 
            })
    }
}
