import type {
    RevokeCollaboratorRequest,
    RevokedCollaborator,
} from "../../application/revoke-collaborator.contracts"
import type { RevokeCollaboratorInput } from "./dto/revoke-collaborator.input"
import type { RevokeCollaboratorType } from "./dto/revoke-collaborator.type"

/** Maps the GraphQL input to the command request. */
export const toRevokeCollaboratorRequest = (input: RevokeCollaboratorInput): RevokeCollaboratorRequest => ({
    invitationId: input.invitationId,
})

/** Maps the revoked invitation to the GraphQL type. */
export const toRevokeCollaboratorType = (revoked: RevokedCollaborator): RevokeCollaboratorType => ({
    invitationId: revoked.invitationId,
    status: revoked.status,
})
