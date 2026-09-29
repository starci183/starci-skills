import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for a duplicate invite attempt. */
export interface ShareInvitationAlreadyExistsExceptionMetadata extends DomainErrorMetadata {
  taskId?: string;
  email?: string;
}

/** data.share.invitation invariant: "Exactly one row exists per (taskId, email) pair at a time." A second
 * invite while the first is still pending or accepted is refused (see ui.share.invite's refused state:
 * "inviting an existing collaborator twice"). */
export class ShareInvitationAlreadyExistsException extends DomainError {
    constructor({ taskId, email, ...metadata }: ShareInvitationAlreadyExistsExceptionMetadata = {
    }) {
        super("SHARE_INVITATION_ALREADY_EXISTS_EXCEPTION",
            "That person already has an outstanding or active invitation on this task.",
            {
                metadata: {
                    taskId,
                    email,
                    ...metadata,
                } 
            })
    }
}
