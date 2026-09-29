import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for an accept attempt whose email does not match the invited one. */
export interface ShareEmailMismatchExceptionMetadata extends DomainErrorMetadata {
  invitationId?: string;
}

/** fr.share.accept exceptionFlows: "Accepting with an email other than the invited one is refused." */
export class ShareEmailMismatchException extends DomainError {
    constructor({ invitationId, ...metadata }: ShareEmailMismatchExceptionMetadata = {
    }) {
        super("SHARE_EMAIL_MISMATCH_EXCEPTION",
            "This invitation was not addressed to that email.",
            {
                metadata: {
                    invitationId, ...metadata 
                } 
            })
    }
}
