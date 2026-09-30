import type { ShareErrorCode } from "@modules/domain/share"
import type { Outcome } from "@modules/platform/primitives"

/** What inviting takes: the task, the invitee's email and the role to grant. */
export interface InviteRequest {
    /** The task id. */
    readonly taskId: string
    /** The address to invite. */
    readonly email: string
    /** The role to grant; the share capability refuses anything but viewer or editor. */
    readonly role: string
}

/** The pending invitation that was created. */
export interface InvitedCollaborator {
    /** The invitation id. */
    readonly invitationId: string
    /** The task id. */
    readonly taskId: string
    /** The invited address, normalized. */
    readonly email: string
    /** The role granted on accept. */
    readonly role: string
    /** The status: pending. */
    readonly status: string
}

/** The pending invitation, or the refusal that names why none was created. */
export type InviteResult = Outcome<InvitedCollaborator, ShareErrorCode>
