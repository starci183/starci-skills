import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for an invite submitted with a role other than viewer or editor. */
export interface ShareInvalidRoleExceptionMetadata extends DomainErrorMetadata {
  /** The role that was submitted. */
  role?: string;
}

/** br.share.role.permissions: a collaborator is a viewer or an editor, never anything else.
 * fr.share.invite exceptionFlows: "A role other than viewer or editor is refused and nothing is created." */
export class ShareInvalidRoleException extends DomainError {
    constructor({ role, ...metadata }: ShareInvalidRoleExceptionMetadata = {
    }) {
        super("SHARE_INVALID_ROLE_EXCEPTION",
            "The role must be viewer or editor.",
            {
                metadata: {
                    role, ...metadata 
                } 
            })
    }
}
