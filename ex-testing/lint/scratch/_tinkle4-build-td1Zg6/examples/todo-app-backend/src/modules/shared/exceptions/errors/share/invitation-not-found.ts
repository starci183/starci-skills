import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for an invitation that cannot be resolved. */
export interface ShareInvitationNotFoundExceptionMetadata extends AbstractExceptionMetadata {
  /** The invitation id looked up. */
  invitationId?: string;
}

/** House refusal carrying code SHARE_INVITATION_NOT_FOUND_EXCEPTION; every throw site attaches a metadata object naming the concrete ids the share invitation not found refusal turned on. */
export class ShareInvitationNotFoundException extends AbstractException {
    constructor({ invitationId, ...metadata }: ShareInvitationNotFoundExceptionMetadata = {
    }) {
        super("The invitation does not exist.",
            "SHARE_INVITATION_NOT_FOUND_EXCEPTION",
            {
                invitationId, ...metadata 
            })
    }
}
