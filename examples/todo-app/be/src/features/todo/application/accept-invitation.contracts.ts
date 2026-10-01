import type { ShareErrorCode } from "@modules/domain/share"
import type { Outcome } from "@modules/platform/primitives"

/** What accepting an invitation takes: the invitation and the caller's own email. */
export interface AcceptInvitationRequest {
    /** The invitation id. */
    readonly invitationId: string
    /** The accepting person's own address, matched against the invited one. */
    readonly email: string
}

/** The invitation after it was accepted. */
export interface AcceptedInvitation {
    /** The invitation id. */
    readonly invitationId: string
    /** The role that is active now. */
    readonly role: string
    /** The status: accepted. */
    readonly status: string
}

/** The accepted invitation, or the refusal that names why it was not accepted. */
export type AcceptInvitationResult = Outcome<AcceptedInvitation, ShareErrorCode>
