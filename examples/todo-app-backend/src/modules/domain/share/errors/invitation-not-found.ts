import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for an invitation that cannot be resolved. */
export interface ShareInvitationNotFoundExceptionMetadata extends DomainErrorMetadata {
  /** The invitation id looked up. */
  invitationId?: string;
}

/** House refusal carrying code SHARE_INVITATION_NOT_FOUND_EXCEPTION; every throw site attaches a metadata object naming the concrete ids the share invitation not found refusal turned on. */
export class ShareInvitationNotFoundException extends DomainError {
    constructor({ invitationId, ...metadata }: ShareInvitationNotFoundExceptionMetadata = {
    }) {
        super("SHARE_INVITATION_NOT_FOUND_EXCEPTION",
            "The invitation does not exist.",
            {
                metadata: {
                    invitationId, ...metadata 
                } 
            })
    }
}
