import type { InviteRequest, InvitedCollaborator } from "../../application/invite.contracts"
import type { InviteInput } from "./dto/invite.input"
import type { InviteType } from "./dto/invite.type"

/** Maps the GraphQL input to the command request. */
export const toInviteRequest = (input: InviteInput): InviteRequest => ({
    taskId: input.taskId,
    email: input.email,
    role: input.role,
})

/** Maps the created invitation to the GraphQL type. */
export const toInviteType = (invitation: InvitedCollaborator): InviteType => ({
    invitationId: invitation.invitationId,
    taskId: invitation.taskId,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
})
