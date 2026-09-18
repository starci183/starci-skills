export interface ListCollaboratorsQueryParams {
  readonly actorId: string;
  readonly taskId: string;
}

export interface CollaboratorSummaryResult {
  readonly invitationId: string;
  readonly email: string;
  readonly role: string;
  readonly status: string;
}

export interface ListCollaboratorsQueryResult {
  readonly collaborators: CollaboratorSummaryResult[];
}

/** fr.share.list as a CQRS read, dispatched by the GraphQL collaborators query resolver. */
export class ListCollaboratorsQuery {
  constructor(readonly params: ListCollaboratorsQueryParams) {}
}
