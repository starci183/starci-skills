import type { ListCollaboratorsRequest, ListCollaboratorsResult } from "../../application/list-collaborators.contracts"
import type { ListCollaboratorsInput } from "./dto/list-collaborators.input"
import type { ListCollaboratorsType } from "./dto/list-collaborators.type"

/** Maps the GraphQL input to the query request. */
export const toListCollaboratorsRequest = (input: ListCollaboratorsInput): ListCollaboratorsRequest => ({
    taskId: input.taskId,
})

/** Maps the listed invitations to the GraphQL types. */
export const toListCollaboratorsType = (result: ListCollaboratorsResult): Array<ListCollaboratorsType> =>
    result.collaborators.map((collaborator) => ({
        invitationId: collaborator.invitationId,
        email: collaborator.email,
        role: collaborator.role,
        status: collaborator.status,
    }))
