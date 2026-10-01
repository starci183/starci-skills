import type { AcceptInvitationRequest, AcceptedInvitation } from "../../application/accept-invitation.contracts"
import type { AcceptInvitationInput } from "./dto/accept-invitation.input"
import type { AcceptInvitationType } from "./dto/accept-invitation.type"

/** Maps the GraphQL input to the command request. */
export const toAcceptInvitationRequest = (input: AcceptInvitationInput): AcceptInvitationRequest => ({
    invitationId: input.invitationId,
    email: input.email,
})

/** Maps the accepted invitation to the GraphQL type. */
export const toAcceptInvitationType = (invitation: AcceptedInvitation): AcceptInvitationType => ({
    invitationId: invitation.invitationId,
    role: invitation.role,
    status: invitation.status,
})
