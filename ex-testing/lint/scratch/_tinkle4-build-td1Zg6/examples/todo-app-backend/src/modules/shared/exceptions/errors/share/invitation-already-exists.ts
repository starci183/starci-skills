import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for a duplicate invite attempt. */
export interface ShareInvitationAlreadyExistsExceptionMetadata extends AbstractExceptionMetadata {
  taskId?: string;
  email?: string;
}

/** data.share.invitation invariant: "Exactly one row exists per (taskId, email) pair at a time." A second
 * invite while the first is still pending or accepted is refused (see ui.share.invite's refused state:
 * "inviting an existing collaborator twice"). */
export class ShareInvitationAlreadyExistsException extends AbstractException {
    constructor({ taskId, email, ...metadata }: ShareInvitationAlreadyExistsExceptionMetadata = {
    }) {
        super("That person already has an outstanding or active invitation on this task.",
            "SHARE_INVITATION_ALREADY_EXISTS_EXCEPTION",
            {
                taskId,
                email,
                ...metadata,
            })
    }
}
