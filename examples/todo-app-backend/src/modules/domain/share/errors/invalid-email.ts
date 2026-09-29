import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for an invite submitted with a malformed email. */
export interface ShareInvalidEmailExceptionMetadata extends DomainErrorMetadata {
  /** The email that was submitted. */
  email?: string;
}

/** fr.share.invite exceptionFlows: "An invalid email is refused and nothing is created." */
export class ShareInvalidEmailException extends DomainError {
    constructor({ email, ...metadata }: ShareInvalidEmailExceptionMetadata = {
    }) {
        super("SHARE_INVALID_EMAIL_EXCEPTION",
            "That email address is not well formed.",
            {
                metadata: {
                    email, ...metadata 
                } 
            })
    }
}
