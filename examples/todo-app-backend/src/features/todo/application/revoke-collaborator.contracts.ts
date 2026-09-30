import type { ShareErrorCode } from "@modules/domain/share"
import type { Outcome } from "@modules/platform/primitives"

/** What revoking takes: the invitation. */
export interface RevokeCollaboratorRequest {
    /** The invitation id. */
    readonly invitationId: string
}

/** The invitation after it was revoked. */
export interface RevokedCollaborator {
    /** The invitation id. */
    readonly invitationId: string
    /** The status: revoked. */
    readonly status: string
}

/** The revoked invitation, or the refusal that names why it was not revoked. */
export type RevokeCollaboratorResult = Outcome<RevokedCollaborator, ShareErrorCode>
