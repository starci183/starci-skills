/** What listing collaborators takes: the task. */
export interface ListCollaboratorsRequest {
    /** The task id. */
    readonly taskId: string
}

/** One invitation on the task. */
export interface CollaboratorSummary {
    /** The invitation id. */
    readonly invitationId: string
    /** The invited address. */
    readonly email: string
    /** The role. */
    readonly role: string
    /** The live status. */
    readonly status: string
}

/** The invitations on a task, empty for a caller who is neither its owner nor a bound collaborator. */
export interface ListCollaboratorsResult {
    /** The invitations, at most the list bound of the share capability. */
    readonly collaborators: ReadonlyArray<CollaboratorSummary>
}
